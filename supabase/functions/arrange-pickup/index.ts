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

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  try {
    const { orderNos, pickupDate, pickupTime, pickupVehicle } = await req.json();
    if (!orderNos || !Array.isArray(orderNos) || orderNos.length === 0 || !pickupDate || !pickupTime || !pickupVehicle) {
      throw new Error("orderNos (array), pickupDate, pickupTime, and pickupVehicle are required.");
    }
    
    // --- Time Validation (remains the same) ---
    const requestedPickupDateTime = new Date(`${pickupDate}T${pickupTime}:00.000+08:00`);
    const nowUtc = new Date();
    const minPickupDateTimeUtc = new Date(nowUtc.getTime() + 90 * 60 * 1000);

    if (requestedPickupDateTime < minPickupDateTimeUtc) {
      const witaOffsetMilliseconds = 8 * 60 * 60 * 1000;
      const minPickupDateTimeInWita = new Date(minPickupDateTimeUtc.getTime() + witaOffsetMilliseconds);
      const hours = minPickupDateTimeInWita.getUTCHours().toString().padStart(2, '0');
      const minutes = minPickupDateTimeInWita.getUTCMinutes().toString().padStart(2, '0');
      const formattedMinTime = `${hours}:${minutes}`;
      throw new Error(
        `Pickup time must be at least 90 minutes in the future. Please select a time after ${formattedMinTime} WITA.`
      );
    }
    
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) throw new Error("KOMERCE_API_KEY secret not set.");
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- 1. Get Komerce order numbers for all provided internal order numbers ---
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('order_number, komerce_order_no')
      .in('order_number', orderNos);

    if (fetchError) throw new Error(`DB Error (Fetch Orders): ${fetchError.message}`);
    const foundKomerceNos = orders?.map(o => o.komerce_order_no).filter(Boolean) || [];
    if (foundKomerceNos.length !== orderNos.length) {
      throw new Error(`Could not find Komerce order numbers for all requested orders. Please ensure all have been submitted to Komerce.`);
    }
    
    // --- 2. Prepare payload for Komerce API ---
    const komercePayload = {
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      pickup_vehicle: pickupVehicle,
      orders: foundKomerceNos.map(komerce_no => ({ order_no: komerce_no })),
    };

    // --- 3. Call Komerce API ---
    const komerceResponse = await fetch(KOMERCE_API_URL, {
      method: 'POST',
      headers: { 'x-api-key': KOMERCE_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(komercePayload)
    });
    
    const komerceJson = await komerceResponse.json();
    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      throw new Error(`[Komerce API] ${komerceJson.meta?.message || 'Failed to arrange pickup.'}`);
    }
    
    // --- 4. Process response and update orders ---
    const pickupResults = komerceJson.data || [];
    const updatePromises: Promise<any>[] = [];
    const failedPickups: string[] = [];

    for (const result of pickupResults) {
      const internalOrder = orders?.find(o => o.komerce_order_no === result.order_no);
      if (!internalOrder) continue;

      if (result.status === 'success' && result.awb) {
        updatePromises.push(
          supabaseAdmin
            .from('orders')
            .update({ awb_number: result.awb, status: 'label_created' })
            .eq('order_number', internalOrder.order_number)
        );
      } else {
        failedPickups.push(internalOrder.order_number);
      }
    }

    await Promise.all(updatePromises);
    
    if (failedPickups.length > 0) {
      throw new Error(`Komerce pickup failed for some orders. Failed: ${failedPickups.join(', ')}`);
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