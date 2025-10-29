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

// Helper to map Midtrans status to our internal status
const mapMidtransStatus = (transactionStatus: string, fraudStatus?: string): 'paid' | 'failed' | null => {
  if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
    if (fraudStatus === 'challenge' || fraudStatus === 'accept') {
      return 'paid';
    }
  } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
    return 'failed';
  }
  return null; // Ignore 'pending' and other non-final states
};

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
        'Authorization': `Basic ${btoa(midtransServerKey + ':')}`
      },
    });

    const statusJson = await midtransResponse.json();

    if (!midtransResponse.ok) {
        throw new Error(`[Midtrans API] ${statusJson.status_message || 'Failed to fetch transaction status.'}`);
    }

    // --- Update DB based on status ---
    const newStatus = mapMidtransStatus(statusJson.transaction_status, statusJson.fraud_status);
    let message = `Midtrans status is '${statusJson.transaction_status}'. No update needed.`;

    if (newStatus) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ status: newStatus })
        .eq('order_number', orderNumber)
        .neq('status', newStatus) // Only update if the status is different
        .select('id, status')
        .single();
      
      if (updateError && updateError.code !== 'PGRST116') { // Ignore 'no rows' error
        throw new Error(`DB Error (Update): ${updateError.message}`);
      }

      if (updatedOrder) {
        message = `Order status updated to '${newStatus}'.`;
        // If updated to 'paid', trigger confirmation email
        if (updatedOrder.status === 'paid') {
          supabaseAdmin.functions.invoke('send-order-confirmation-email', {
            body: { order_id: updatedOrder.id },
          }).catch(err => console.error(`Error invoking email function for order ${updatedOrder.id}:`, err.message));
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message, midtransStatus: statusJson.transaction_status }), {
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