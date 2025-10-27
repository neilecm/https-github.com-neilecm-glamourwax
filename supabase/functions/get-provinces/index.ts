
// supabase/functions/get-provinces/index.ts
// This function is now correctly aligned with the RajaOngkir V2 API documentation.

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAJAONGKIR_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

serve(async (req) => {
  console.log("get-provinces function invoked.");

  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Retrieving RAJAONGKIR_KEY from secrets...");
    const RAJAONGKIR_KEY = Deno.env.get('RAJAONGKIR_KEY');
    if (!RAJAONGKIR_KEY) {
      console.error("RAJAONGKIR_KEY not set in secrets.");
      throw new Error("RAJAONGKIR_KEY not set in secrets.");
    }
    console.log("RAJAONGKIR_KEY retrieved successfully.");

    const endpoint = `${RAJAONGKIR_BASE_URL}/destination/province`;
    console.log(`Fetching from endpoint: ${endpoint}`);

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Key': RAJAONGKIR_KEY, // Capital 'K' as per docs
        'Content-Type': 'application/json',
      },
    });

    console.log(`API response status: ${res.status}`);
    const json = await res.json();

    if (!res.ok || json.meta?.code !== 200) {
      console.error("Komerce API Error:", JSON.stringify(json, null, 2));
      throw new Error(`[Komerce API] ${json.meta?.message || res.statusText}`);
    }

    console.log("Successfully fetched provinces. Normalizing response.");
    // Normalize the response to match the working model's structure
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
    console.error("Error in get-provinces function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
