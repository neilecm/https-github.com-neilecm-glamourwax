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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderNo } = await req.json(); // Our internal "CB-..." number
    if (!orderNo) {
      throw new Error("orderNo is a required parameter.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) throw new Error("KOMERCE_API_KEY secret not set.");

    // 1. Fetch order details from our DB
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('status, komerce_order_no')
      .eq('order_number', orderNo)
      .single();

    if (fetchError) throw new Error(`DB Error (Fetch): ${fetchError.message}`);
    if (!order) throw new Error(`Order ${orderNo} not found.`);

    // 2. Check if order can be cancelled
    if (order.status !== 'paid' && order.status !== 'processing') {
      throw new Error(`Cannot cancel order. Status is '${order.status}'.`);
    }

    // 3. If it has a komerce_order_no, cancel it with Komerce
    if (order.komerce_order_no) {
      const KOMERCE_CANCEL_URL = 'https://api-sandbox.collaborator.komerce.id/order/api/v1/orders/cancel';
      
      const formData = new URLSearchParams();
      formData.append('order_no', order.komerce_order_no);
      formData.append('reason', 'Cancelled by customer request from admin dashboard.');

      const komerceResponse = await fetch(KOMERCE_CANCEL_URL, {
        method: 'POST',
        headers: {
          'x-api-key': KOMERCE_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formData.toString()
      });

      const komerceJson = await komerceResponse.json();
      if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
        throw new Error(`[Komerce API] ${komerceJson.meta?.message || 'Failed to cancel order.'}`);
      }
    }

    // 4. Update our DB status to 'cancelled'
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('order_number', orderNo);

    if (updateError) throw new Error(`DB Error (Update): ${updateError.message}`);

    return new Response(JSON.stringify({ success: true, message: `Order ${orderNo} cancelled.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in cancel-order function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});