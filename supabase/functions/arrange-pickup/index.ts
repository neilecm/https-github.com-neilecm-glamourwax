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

/**
 * Calculates the pickup date and time, ensuring it is at least 90 minutes
 * in the future from the base time (whichever is later: now or order creation).
 * The time is correctly formatted for the WITA (UTC+8) timezone.
 */
const calculatePickupTime = (orderCreationTime: string) => {
    const now = new Date();
    const orderCreatedAt = new Date(orderCreationTime);

    // Determine the base time: either now or when the order was created, whichever is later.
    const baseTime = now > orderCreatedAt ? now : orderCreatedAt;

    // Add 95 minutes (90 min minimum + 5 min buffer) to the base time.
    const pickupDateTime = new Date(baseTime.getTime() + 95 * 60 * 1000);

    // Deno's environment is UTC, so we need to manually adjust for UTC+8 (WITA).
    const witaOffset = 8 * 60 * 60 * 1000;
    const witaDate = new Date(pickupDateTime.getTime() + witaOffset);

    const year = witaDate.getUTCFullYear();
    const month = (witaDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = witaDate.getUTCDate().toString().padStart(2, '0');
    const hours = witaDate.getUTCHours().toString().padStart(2, '0');
    const minutes = witaDate.getUTCMinutes().toString().padStart(2, '0');
    const seconds = witaDate.getUTCSeconds().toString().padStart(2, '0');

    return {
        pickup_date: `${year}-${month}-${day}`,
        pickup_time: `${hours}:${minutes}:${seconds}`,
    };
};


/**
 * Fallback function to determine vehicle type for older orders.
 */
const getVehicleType = (totalWeight: number, shippingProvider: string, shippingService: string): 'Motor' | 'Mobil' | 'Truk' => {
    const upperService = shippingService.toUpperCase();
    const upperProvider = shippingProvider.toUpperCase();

    if (upperService.includes('TRUCKING') || upperService.includes('CARGO')) return 'Truk';
    if (upperProvider.includes('GOSEND') || upperProvider.includes('GRAB') || upperService.includes('INSTANT') || upperService.includes('SAMEDAY')) return 'Motor';

    if (totalWeight >= 10000) return 'Truk'; // 10 kg
    if (totalWeight >= 5000) return 'Mobil';   // 5 kg
    return 'Motor';
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

    // --- 1. Get order details, now including created_at ---
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, created_at, komerce_order_no, shipping_vehicle, shipping_provider, shipping_service')
      .eq('order_number', orderNo)
      .single();

    if (fetchError) throw new Error(`DB Error (Fetch Order): ${fetchError.message}`);
    if (!order?.komerce_order_no) {
      throw new Error(`Cannot arrange pickup. Order ${orderNo} is missing its Komerce order number.`);
    }
    
    let pickupVehicle = order.shipping_vehicle;

    // --- 2. Fallback logic for older orders without a saved vehicle ---
    if (!pickupVehicle) {
        console.log(`No shipping_vehicle found for order ${orderNo}. Using fallback logic.`);
        
        const { data: items, error: itemsError } = await supabaseAdmin
            .from('order_items')
            .select('quantity, product_variants(weight)')
            .eq('order_id', order.id);
        
        if (itemsError) throw new Error(`DB Error (Fetch Items for Fallback): ${itemsError.message}`);
        
        const totalWeight = items.reduce((acc: number, item: any) => {
            const weight = item.product_variants?.weight || 0;
            return acc + (weight * item.quantity);
        }, 0);

        pickupVehicle = getVehicleType(totalWeight, order.shipping_provider, order.shipping_service);
        console.log(`Fallback determined vehicle for ${orderNo} is '${pickupVehicle}' based on weight ${totalWeight}g.`);
    }
    
    // --- 3. Prepare payload for Komerce API with correct time calculation ---
    const { pickup_date, pickup_time } = calculatePickupTime(order.created_at);
    
    const komercePayload = {
      pickup_date,
      pickup_time,
      pickup_vehicle: pickupVehicle,
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
            .update({ awb_number: pickupResult.awb, status: 'label_created' })
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