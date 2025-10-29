// supabase/functions/get-komerce-order-details/index.ts

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

// Corrected endpoint for fetching order details
const KOMERCE_API_URL = 'https://api-sandbox.collaborator.komerce.id/order/api/v1/orders/detail';

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  try {
    const { orderNo } = await req.json(); // This is the internal order number, e.g., "CB-..."
    if (!orderNo) { throw new Error("orderNo is a required parameter."); }
    
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) throw new Error("KOMERCE_API_KEY secret not set.");
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Look up the Komerce order number from our internal order number
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('komerce_order_no')
      .eq('order_number', orderNo)
      .single();

    if (fetchError) throw new Error(`DB Error (Fetch Order): ${fetchError.message}`);
    if (!order?.komerce_order_no) {
      throw new Error(`Order ${orderNo} does not have a Komerce order number.`);
    }
    
    const komerceOrderNo = order.komerce_order_no;

    // 2. Call the Komerce API with the correct order number
    const params = new URLSearchParams({ order_no: komerceOrderNo });
    const endpoint = `${KOMERCE_API_URL}?${params.toString()}`;
    
    const komerceResponse = await fetch(endpoint, {
      method: 'GET',
      headers: { 
        'x-api-key': KOMERCE_API_KEY,
        'Accept': 'application/json',
      },
    });

    const komerceJson = await komerceResponse.json();
    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      const errorMessage = komerceJson.meta?.message || 'Failed to fetch Komerce order details.';
      throw new Error(`[Komerce API] ${errorMessage}`);
    }

    return new Response(JSON.stringify(komerceJson.data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in get-komerce-order-details function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});