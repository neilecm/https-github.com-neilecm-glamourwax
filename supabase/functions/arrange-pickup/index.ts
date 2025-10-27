// supabase/functions/arrange-pickup/index.ts

// FIX: Added Deno declaration to resolve TypeScript errors.
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

// Helper to format date and time as required by Komerce API
function getPickupSchedule() {
    // Komerce requires pickup time to be at least 90 minutes in the future.
    // We'll schedule it for 2 hours from now for safety.
    const pickupDateTime = new Date(Date.now() + 2 * 60 * 60 * 1000); 

    const year = pickupDateTime.getFullYear();
    const month = (pickupDateTime.getMonth() + 1).toString().padStart(2, '0');
    const day = pickupDateTime.getDate().toString().padStart(2, '0');

    const hours = pickupDateTime.getHours().toString().padStart(2, '0');
    const minutes = pickupDateTime.getMinutes().toString().padStart(2, '0');

    return {
        pickup_date: `${year}-${month}-${day}`,
        pickup_time: `${hours}:${minutes}`,
    };
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderNo } = await req.json();
    if (!orderNo) {
      throw new Error("orderNo is a required parameter.");
    }
    console.log(`Arrange pickup request for order: ${orderNo}`);

    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) {
      throw new Error("KOMERCE_API_KEY is not set in secrets.");
    }

    const { pickup_date, pickup_time } = getPickupSchedule();

    const komercePayload = {
      pickup_date: pickup_date,
      pickup_time: pickup_time,
      pickup_vehicle: "Motor", // Defaulting to 'Motor' as per docs example
      orders: [{ order_no: orderNo }],
    };

    console.log("Sending payload to Komerce:", JSON.stringify(komercePayload, null, 2));

    const komerceResponse = await fetch(KOMERCE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': KOMERCE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(komercePayload),
    });
    
    const komerceJson = await komerceResponse.json();
    console.log("Received from Komerce:", JSON.stringify(komerceJson, null, 2));

    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      throw new Error(`[Komerce API] ${komerceJson.meta?.message || 'Failed to request pickup.'}`);
    }

    const pickupResult = komerceJson.data?.[0];
    if (!pickupResult || pickupResult.status !== 'success' || !pickupResult.awb) {
        throw new Error(`[Komerce API] Pickup was not successful for order ${orderNo}. Response: ${JSON.stringify(pickupResult)}`);
    }

    console.log(`Successfully arranged pickup. AWB: ${pickupResult.awb}. Updating database...`);

    // Now, update our own database with the AWB and new status
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'shipped', awb_number: pickupResult.awb })
      .eq('order_number', orderNo);

    if (updateError) {
        console.error("Failed to update order in database:", updateError);
        // Even if DB update fails, the pickup was arranged. Log this critical error.
        // In a production system, this might trigger an alert for manual correction.
        throw new Error(`Pickup arranged with AWB ${pickupResult.awb}, but failed to update local database. Please check order ${orderNo}.`);
    }

    console.log(`Database updated for order ${orderNo}.`);

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