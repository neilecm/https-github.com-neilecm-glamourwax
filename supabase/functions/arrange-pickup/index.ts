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

function getPickupSchedule() {
    // Calculate a time 2 hours from now for the pickup
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); 
    // Convert this time to the local time in Bali (WITA)
    const witaDate = new Date(futureTime.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));

    const year = witaDate.getFullYear();
    const month = (witaDate.getMonth() + 1).toString().padStart(2, '0');
    const day = witaDate.getDate().toString().padStart(2, '0');
    const hours = witaDate.getHours().toString().padStart(2, '0');
    const minutes = witaDate.getMinutes().toString().padStart(2, '0');
    
    return {
        pickup_date: `${year}-${month}-${day}`,
        pickup_time: `${hours}:${minutes}`,
    };
}

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

    // --- 1. Get the official Komerce order number from our database ---
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('komerce_order_no')
      .eq('order_number', orderNo)
      .single();

    if (fetchError) throw new Error(`DB Error (Fetch Order): ${fetchError.message}`);
    if (!order?.komerce_order_no) {
      throw new Error(`Order ${orderNo} has not been submitted to the shipping partner yet or is missing its Komerce order number.`);
    }
    const komerceOrderNo = order.komerce_order_no;

    // --- 2. Call Komerce API with the correct order number ---
    const { pickup_date, pickup_time } = getPickupSchedule();
    const komercePayload = {
      pickup_date,
      pickup_time,
      pickup_vehicle: "Motor",
      orders: [{ order_no: komerceOrderNo }],
    };

    const komerceResponse = await fetch(KOMERCE_API_URL, {
      method: 'POST',
      headers: { 'x-api-key': KOMERCE_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(komercePayload),
    });
    
    const komerceJson = await komerceResponse.json();
    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      throw new Error(`[Komerce API] ${komerceJson.meta?.message || 'Failed to request pickup.'}`);
    }

    const pickupResult = komerceJson.data?.[0];
    if (!pickupResult || pickupResult.status !== 'success' || !pickupResult.awb) {
        throw new Error(`[Komerce API] Pickup failed for order ${komerceOrderNo}. Response: ${JSON.stringify(pickupResult)}`);
    }

    // --- 3. Update our database with the AWB number and 'shipped' status ---
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'shipped', awb_number: pickupResult.awb })
      .eq('order_number', orderNo); // Use original order number for the WHERE clause

    if (updateError) {
        throw new Error(`Pickup arranged (AWB ${pickupResult.awb}), but failed to update local DB for order ${orderNo}.`);
    }

    return new Response(JSON.stringify(komerceJson.data), {
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