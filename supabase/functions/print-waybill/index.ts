// supabase/functions/print-waybill/index.ts

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

const KOMERCE_API_URL = 'https://api-sandbox.collaborator.komerce.id/order/api/v1/orders/print-label';

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
      throw new Error(`Cannot print waybill. Order ${orderNo} is missing its Komerce order number.`);
    }
    const komerceOrderNo = order.komerce_order_no;
    
    // --- 2. Call Komerce API with the correct order number ---
    const url = new URL(KOMERCE_API_URL);
    url.searchParams.append('page', 'page_5'); // Thermal printer size
    url.searchParams.append('order_no', komerceOrderNo);
    
    const komerceResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'x-api-key': KOMERCE_API_KEY, 'Accept': 'application/json' },
    });
    
    const komerceJson = await komerceResponse.json();
    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      const errorMessage = typeof komerceJson.data === 'string' ? komerceJson.data : komerceJson.meta?.message;
      throw new Error(`[Komerce API] ${errorMessage || 'Failed to generate label.'}`);
    }
    
    if (!komerceJson.data?.base_64) {
        throw new Error("[Komerce API] Response did not contain base_64 PDF data.");
    }

    return new Response(JSON.stringify({ base_64: komerceJson.data.base_64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in print-waybill function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});