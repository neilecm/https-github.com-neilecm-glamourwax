// supabase/functions/meta-marketing-api-proxy/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const META_API_BASE_URL = 'https://graph.facebook.com/v20.0/';

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
    const { accessToken, path, method, params } = await req.json();

    if (!accessToken || !path) {
      throw new Error('accessToken and path are required parameters.');
    }

    const url = new URL(`${META_API_BASE_URL}${path}`);
    url.searchParams.append('access_token', accessToken);

    let body = null;
    if (method === 'GET') {
      for (const key in params) {
        url.searchParams.append(key, params[key]);
      }
    } else if (method === 'POST') {
       // For POST requests, params are sent in the body
       body = new URLSearchParams(params).toString();
    }
    
    console.log(`Proxying ${method} request to: ${url.toString()}`);

    const metaResponse = await fetch(url.toString(), {
      method: method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body,
    });
    
    const responseData = await metaResponse.json();

    if (!metaResponse.ok) {
        console.error("Meta API Error:", responseData);
        const errorMessage = responseData.error?.message || 'An unknown error occurred with the Meta API.';
        throw new Error(`[Meta API] ${errorMessage}`);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in Meta API proxy function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
