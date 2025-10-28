// supabase/functions/check-midtrans-status/index.ts

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

const MIDTRANS_API_URL_BASE = 'https://api.sandbox.midtrans.com/v2/';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Security Check: Only allow admins ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization header.");
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    if (!user || !adminEmail || user.email !== adminEmail) {
      return new Response(JSON.stringify({ error: "Forbidden: Not an admin." }), { status: 403 });
    }

    // --- Main Logic ---
    const { orderNumber } = await req.json();
    if (!orderNumber) {
      throw new Error("orderNumber is a required parameter.");
    }

    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!midtransServerKey) {
      throw new Error("MIDTRANS_SERVER_KEY is not set in secrets.");
    }

    const endpoint = `${MIDTRANS_API_URL_BASE}${orderNumber}/status`;
    
    const midtransResponse = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(midtransServerKey + ':')}`
      },
    });

    const statusJson = await midtransResponse.json();

    if (!midtransResponse.ok) {
        throw new Error(`[Midtrans API] ${statusJson.status_message || 'Failed to fetch transaction status.'}`);
    }

    return new Response(JSON.stringify({ status: statusJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error("Error in check-midtrans-status function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
