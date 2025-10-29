// supabase/functions/get-shipping-cost/index.ts
// This function has been completely refactored to align with the correct Komerce API documentation.

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KOMERCE_API_URL = 'https://api-sandbox.collaborator.komerce.id/tariff/api/v1/calculate';

serve(async (req) => {
  console.log("get-shipping-cost function invoked.");

  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { origin, destination, weight, itemValue } = await req.json();
    console.log(`Received cost request: origin=${origin}, destination=${destination}, weight=${weight}g, itemValue=${itemValue}`);
    if (!origin || !destination || !weight || !itemValue) {
      throw new Error("origin, destination, weight, and itemValue are required parameters.");
    }

    console.log("Retrieving KOMERCE_API_KEY from secrets...");
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) {
        console.error("KOMERCE_API_KEY not set in secrets.");
        throw new Error("KOMERCE_API_KEY not set in secrets.");
    }
    console.log("KOMERCE_API_KEY retrieved successfully.");

    // Construct the URL with query parameters for the GET request
    const params = new URLSearchParams({
      shipper_destination_id: origin,
      receiver_destination_id: destination,
      weight: (weight / 1000).toString(), // Convert grams to kilograms
      item_value: itemValue.toString(),
      cod: 'yes', // Get all options, including COD and non-COD
      // Hardcoded pinpoints as they are required for some couriers (like instant)
      // In a real app, these might be dynamically determined.
      origin_pin_point: '-8.6705, 115.2124', // Denpasar, Bali
      destination_pin_point: '-8.6705, 115.2124', // Placeholder, API is lenient for non-instant
    });
    
    const endpoint = `${KOMERCE_API_URL}?${params.toString()}`;
    console.log(`Fetching from endpoint: ${endpoint}`);
    
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-api-key': KOMERCE_API_KEY,
        'Accept': 'application/json'
      },
    });

    console.log(`API response status: ${res.status}`);
    const json = await res.json();

    if (!res.ok || json.meta?.status !== 'success') {
      console.error("Komerce API Error:", JSON.stringify(json, null, 2));
      throw new Error(`[Komerce API] ${json.meta?.message || res.statusText}`);
    }

    console.log("Successfully fetched shipping costs. Normalizing response for frontend.");
    
    // Correctly parse and flatten the Komerce response
    const allServices: any[] = [];
    if (json.data) {
        if (Array.isArray(json.data.calculate_reguler)) {
            allServices.push(...json.data.calculate_reguler);
        }
        if (Array.isArray(json.data.calculate_cargo)) {
            allServices.push(...json.data.calculate_cargo);
        }
        if (Array.isArray(json.data.calculate_instant)) {
            allServices.push(...json.data.calculate_instant);
        }
    }

    const responseBody = {
      rajaongkir: { // Keep this wrapper for consistency with other location functions
        status: json.meta,
        results: allServices, // Return the flattened array
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