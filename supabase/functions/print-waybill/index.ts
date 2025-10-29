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
    const { orderNos } = await req.json(); // Expecting an array, e.g., ["CB-123", "CB-456"]
    if (!orderNos || !Array.isArray(orderNos) || orderNos.length === 0) {
      throw new Error("orderNos (an array of strings) is a required parameter.");
    }
    
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- 1. Get the official Komerce order numbers from our database ---
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('komerce_order_no')
      .in('order_number', orderNos);

    if (fetchError) throw new Error(`DB Error (Fetch Orders): ${fetchError.message}`);

    const komerceOrderNos = orders?.map(o => o.komerce_order_no).filter(Boolean);
    if (!komerceOrderNos || komerceOrderNos.length === 0) {
      throw new Error(`Cannot print waybill. No valid Komerce order numbers found for the provided orders.`);
    }
    
    // --- 2. Call Komerce API with a comma-separated list of order numbers ---
    const url = new URL(KOMERCE_API_URL);
    url.searchParams.append('page', 'page_5'); // Thermal printer size
    url.searchParams.append('order_no', komerceOrderNos.join(','));
    
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