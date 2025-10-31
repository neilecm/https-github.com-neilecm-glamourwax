// supabase/functions/cancel-order/index.ts

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

const KOMERCE_CANCEL_URL = 'https://api-sandbox.collaborator.komerce.id/order/api/v1/orders/cancel';

serve(async (req) => {
  console.log(`[cancel-order] Invoked with method: ${req.method}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderNo } = await req.json();
    if (!orderNo) throw new Error("Missing 'orderNo' in request body.");
    console.log(`[cancel-order] Received request for order: ${orderNo}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) throw new Error("KOMERCE_API_KEY secret is not configured.");

    // Step 1: Fetch Order Details from DB
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('status, komerce_order_no')
      .eq('order_number', orderNo)
      .single();

    if (fetchError) throw new Error(`DB Error (Fetch Order): ${fetchError.message}`);
    if (!order) throw new Error(`Order ${orderNo} not found in the database.`);
    
    // Step 2: Validate Order Status for Cancellation
    if (order.status !== 'paid' && order.status !== 'processing') {
      throw new Error(`Cannot cancel order. Its current status is '${order.status}', which is not a cancellable state.`);
    }

    // Step 3: Cancel with Komerce API if applicable
    if (order.komerce_order_no) {
      console.log(`[cancel-order] Order has Komerce ID (${order.komerce_order_no}). Sending cancellation request to Komerce.`);
      
      const komercePayload = { order_no: order.komerce_order_no };

      const komerceResponse = await fetch(KOMERCE_CANCEL_URL, {
        method: 'PUT',
        headers: {
          'x-api-key': KOMERCE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(komercePayload)
      });

      const komerceJson = await komerceResponse.json();
      
      if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
        const errorMessage = komerceJson.data?.errors || komerceJson.meta?.message || 'Unknown Komerce API error.';
        console.error(`[cancel-order] Komerce API failed with status ${komerceResponse.status}:`, JSON.stringify(komerceJson));
        throw new Error(`Komerce API Error: ${errorMessage}`);
      }
      console.log(`[cancel-order] Successfully cancelled order with Komerce.`);
    } else {
       console.log(`[cancel-order] Order has no Komerce ID. Skipping Komerce API call.`);
    }

    // Step 4: Update Internal Order Status
    console.log(`[cancel-order] Updating internal status for order ${orderNo} to 'cancelled'.`);
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('order_number', orderNo);

    if (updateError) {
      throw new Error(`DB Error (Update Status): ${updateError.message}`);
    }

    console.log(`[cancel-order] Successfully completed cancellation for ${orderNo}.`);
    return new Response(JSON.stringify({ success: true, message: `Order ${orderNo} has been cancelled.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("[cancel-order] A critical error occurred:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
