// supabase/functions/arrange-pickup/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KOMERCE_API_URL = 'https://api-sandbox.collaborator.komerce.id/order/api/v1/pickup/request';

// Helper to get a pickup time at least 90 minutes in the future, formatted for WITA timezone.
const getPickupDetails = () => {
    const pickupDateTime = new Date(Date.now() + 95 * 60 * 1000); // 95 minutes for a safe buffer
    const witaDate = new Date(pickupDateTime.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
    
    const year = witaDate.getFullYear();
    const month = (witaDate.getMonth() + 1).toString().padStart(2, '0');
    const day = witaDate.getDate().toString().padStart(2, '0');
    const hours = witaDate.getHours().toString().padStart(2, '0');
    const minutes = witaDate.getMinutes().toString().padStart(2, '0');
    
    return {
        pickup_date: `${year}-${month}-${day}`,
        pickup_time: `${hours}:${minutes}`,
    };
};


serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  try {
    const { orderNo } = await req.json(); // This is the internal order number, e.g., "CB-..."
    if (!orderNo) { throw new Error("orderNo is a required parameter."); }
    
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- 1. Get order details, including items and weights for vehicle selection ---
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select(`
        komerce_order_no,
        order_items (
            quantity,
            product_variants ( weight )
        )
      `)
      .eq('order_number', orderNo)
      .single();

    if (fetchError) throw new Error(`DB Error (Fetch Order): ${fetchError.message}`);
    if (!order?.komerce_order_no) {
      throw new Error(`Cannot arrange pickup. Order ${orderNo} is missing its Komerce order number.`);
    }

    // --- 2. Calculate total weight and determine vehicle type ---
    const totalWeightGrams = (order.order_items || []).reduce((acc: number, item: any) => {
        const itemWeight = item.product_variants?.weight || 0;
        return acc + (itemWeight * item.quantity);
    }, 0);
    const totalWeightKg = totalWeightGrams / 1000;

    let pickup_vehicle = 'Mobil'; // Default to car
    if (totalWeightKg < 5) pickup_vehicle = 'Motor';
    if (totalWeightKg >= 10) pickup_vehicle = 'Truk';
    
    // --- 3. Prepare payload for Komerce API ---
    const { pickup_date, pickup_time } = getPickupDetails();
    
    const komercePayload = {
      pickup_date,
      pickup_time,
      pickup_vehicle,
      orders: [{ order_no: order.komerce_order_no }],
    };

    // --- 4. Call Komerce API ---
    const komerceResponse = await fetch(KOMERCE_API_URL, {
      method: 'POST',
      headers: { 
        'x-api-key': KOMERCE_API_KEY, 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(komercePayload)
    });
    
    const komerceJson = await komerceResponse.json();
    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      const errorMessage = komerceJson.meta?.message || 'Failed to arrange pickup.';
      throw new Error(`[Komerce API] ${errorMessage}`);
    }
    
    // --- 5. Update order with AWB number if returned ---
    const pickupResult = komerceJson.data?.[0];
    if (pickupResult && pickupResult.status === 'success' && pickupResult.awb) {
        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ awb_number: pickupResult.awb, status: 'shipped' })
            .eq('order_number', orderNo);

        if (updateError) {
            console.error(`DB Error (Update AWB for ${orderNo}): ${updateError.message}`);
        }
    } else {
        throw new Error(`Komerce pickup failed for ${pickupResult?.order_no}: Status was '${pickupResult?.status}'`);
    }

    return new Response(JSON.stringify({ success: true, data: komerceJson.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in arrange-pickup function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});