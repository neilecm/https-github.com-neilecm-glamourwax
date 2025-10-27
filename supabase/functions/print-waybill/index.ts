// supabase/functions/print-waybill/index.ts

// FIX: Added Deno declaration to resolve TypeScript errors.
declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KOMERCE_API_URL = 'https://api-sandbox.collaborator.komerce.id/order/api/v1/orders/print-label';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderNo } = await req.json();
    if (!orderNo) {
      throw new Error("orderNo is a required parameter.");
    }
    console.log(`Print waybill request for order: ${orderNo}`);
    
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) {
      throw new Error("KOMERCE_API_KEY is not set in secrets.");
    }
    
    // As per Komerce docs, page format and order_no are query parameters
    const url = new URL(KOMERCE_API_URL);
    url.searchParams.append('page', 'page_5'); // Defaulting to thermal printer size
    url.searchParams.append('order_no', orderNo);

    console.log(`Sending request to Komerce: ${url.toString()}`);
    
    const komerceResponse = await fetch(url.toString(), {
      method: 'POST', // The endpoint requires POST
      headers: {
        'x-api-key': KOMERCE_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    const komerceJson = await komerceResponse.json();
    console.log("Received from Komerce:", komerceJson.meta);


    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      // Check for specific error message if available
      const errorMessage = typeof komerceJson.data === 'string' ? komerceJson.data : komerceJson.meta?.message;
      throw new Error(`[Komerce API] ${errorMessage || 'Failed to generate label.'}`);
    }
    
    if (!komerceJson.data?.base_64) {
        throw new Error("[Komerce API] Response did not contain base_64 PDF data.");
    }

    console.log("Successfully retrieved base64 waybill data.");

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