// supabase/functions/create-midtrans-transaction/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Midtrans API configuration
const MIDTRANS_API_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FIX: The custom btoa polyfill was removed. It contained Node.js-specific code (`Buffer`)
// that is not available in the Deno runtime, causing an error. Deno provides a built-in
// `btoa` function that can be used directly.

serve(async (req) => {
  console.log("create-midtrans-transaction function invoked.");

  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Received payload for Midtrans:", JSON.stringify(payload, null, 2));
    if (!payload.transaction_details || !payload.customer_details) {
      throw new Error("Invalid payload: transaction_details and customer_details are required.");
    }

    console.log("Retrieving MIDTRANS_SERVER_KEY from secrets...");
    const MIDTRANS_SERVER_KEY = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!MIDTRANS_SERVER_KEY) {
        console.error("MIDTRANS_SERVER_KEY not set in secrets.");
        throw new Error("MIDTRANS_SERVER_KEY not set in secrets. Please add it to your Supabase project's secrets.");
    }
    console.log("MIDTRANS_SERVER_KEY retrieved successfully.");

    // Midtrans requires the server key to be base64 encoded for Basic Authentication, with a colon appended.
    const encodedKey = btoa(`${MIDTRANS_SERVER_KEY}:`);

    console.log(`Sending request to Midtrans API at ${MIDTRANS_API_URL}`);
    const midtransResponse = await fetch(MIDTRANS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${encodedKey}`,
      },
      body: JSON.stringify(payload),
    });
    
    console.log(`Midtrans API response status: ${midtransResponse.status}`);
    const midtransJson = await midtransResponse.json();

    if (!midtransResponse.ok) {
        console.error("Midtrans API Error:", JSON.stringify(midtransJson, null, 2));
        const errorMessage = midtransJson.error_messages ? midtransJson.error_messages.join(', ') : 'Unknown Midtrans API error';
        throw new Error(`[Midtrans API] ${errorMessage}`);
    }

    if (!midtransJson.token) {
        console.error("Midtrans API did not return a token:", JSON.stringify(midtransJson, null, 2));
        throw new Error("Midtrans API response did not include a transaction token.");
    }
    
    console.log("Successfully created Midtrans transaction. Returning token.");

    return new Response(JSON.stringify({ token: midtransJson.token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in create-midtrans-transaction function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
