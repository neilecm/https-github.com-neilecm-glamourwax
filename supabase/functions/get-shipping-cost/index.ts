
// supabase/functions/get-shipping-cost/index.ts
// This function is now correctly aligned with the RajaOngkir V2 API documentation.

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAJAONGKIR_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

serve(async (req) => {
  console.log("get-shipping-cost function invoked.");

  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { origin, destination, weight, courier } = await req.json();
    console.log(`Received cost request: origin=${origin}, destination=${destination}, weight=${weight}, courier=${courier}`);
    if (!origin || !destination || !weight || !courier) {
      throw new Error("origin, destination, weight, and courier are required parameters.");
    }

    console.log("Retrieving RAJAONGKIR_KEY from secrets...");
    const RAJAONGKIR_KEY = Deno.env.get('RAJAONGKIR_KEY');
    if (!RAJAONGKIR_KEY) {
        console.error("RAJAONGKIR_KEY not set in secrets.");
        throw new Error("RAJAONGKIR_KEY not set in secrets.");
    }
    console.log("RAJAONGKIR_KEY retrieved successfully.");

    // The API expects data in x-www-form-urlencoded format
    const formBody = new URLSearchParams({
      origin: origin,
      destination: destination,
      weight: weight.toString(),
      courier: courier,
      price: "lowest", // as per documentation example
    });
    
    const endpoint = `${RAJAONGKIR_BASE_URL}/calculate/district/domestic-cost`;
    console.log(`Fetching from endpoint: ${endpoint} with body: ${formBody.toString()}`);
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'key': RAJAONGKIR_KEY, // lowercase 'k' as per docs for POST
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });

    console.log(`API response status: ${res.status}`);
    const json = await res.json();

    if (!res.ok || json.meta?.code !== 200) {
      console.error("Komerce API Error:", JSON.stringify(json, null, 2));
      throw new Error(`[Komerce API] ${json.meta?.message || res.statusText}`);
    }

    console.log("Successfully fetched shipping costs. Normalizing response.");
    // The response is a simple array, so we don't need a complex transform
    const responseBody = {
      rajaongkir: {
        status: json.meta,
        results: json.data || [],
      },
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error("Error in get-shipping-cost function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
