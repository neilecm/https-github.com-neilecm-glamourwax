// supabase/functions/get-orders/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Security Check: Verify the caller is an admin ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        throw new Error("Missing Authorization header.");
    }
    
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Authentication failed." }), { status: 401 });
    }
    
    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    if (!adminEmail || user.email !== adminEmail) {
      return new Response(JSON.stringify({ error: "Forbidden: Not an admin." }), { status: 403 });
    }
    console.log(`Admin user ${user.email} verified. Proceeding to fetch orders.`);

    // --- Fetch Orders with Admin Privileges ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        customers (*),
        order_items (
          quantity,
          price,
          product_variants (
            id, name,
            products (id, name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`DB Error (Fetching Orders): ${error.message}`);
    }
    
    // The data from the query directly matches the FullOrder[] type expected by the frontend.
    // The previous incorrect transformation logic has been removed.
    console.log(`DB query returned ${data?.length || 0} orders.`);
    
    return new Response(JSON.stringify(data || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in get-orders function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});