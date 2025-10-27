// supabase/functions/get-admin-email/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

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
    // Note: The Supabase client library automatically handles passing the
    // user's authentication token, so we don't need to manually check it here.
    // If the function is invoked without a valid user session, Supabase will reject it.
    
    const adminEmail = Deno.env.get('ADMIN_EMAIL');

    if (!adminEmail) {
      console.error("ADMIN_EMAIL secret is not set in Supabase Edge Function settings.");
      throw new Error("Server configuration error: Admin email is not set.");
    }

    return new Response(JSON.stringify({ adminEmail: adminEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in get-admin-email function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
