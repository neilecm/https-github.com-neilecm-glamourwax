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

const MIDTRANS_API_BASE_URL = 'https://api.sandbox.midtrans.com/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderNumber } = await req.json();
    if (!orderNumber) {
      throw new Error("Missing 'orderNumber' in request body.");
    }

    // --- 1. Get Secrets ---
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY is not configured in secrets.");
    }

    // --- 2. Query Midtrans for Transaction Status ---
    const midtransUrl = `${MIDTRANS_API_BASE_URL}/${orderNumber}/status`;
    const midtransResponse = await fetch(midtransUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(serverKey + ':')}`
      }
    });

    const statusJson = await midtransResponse.json();
    if (!midtransResponse.ok) {
        throw new Error(`[Midtrans API] ${statusJson.status_message || 'Failed to get transaction status.'}`);
    }
    
    // --- 3. Determine New Order Status from Midtrans Response ---
    const { transaction_status, order_id } = statusJson;
    let newStatus: 'paid' | 'failed' | 'pending_payment' = 'pending_payment';

    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      newStatus = 'paid';
    } else if (transaction_status === 'expire' || transaction_status === 'cancel' || transaction_status === 'deny') {
      newStatus = 'failed';
    } else {
      console.log(`Order ${order_id} status is still '${transaction_status}'. No update needed.`);
      return new Response(JSON.stringify({ status: transaction_status, message: 'Status has not changed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // --- 4. Update the Database if Status has Changed ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: order, error: findError } = await supabaseAdmin
        .from('orders')
        .select('id, status')
        .eq('order_number', order_id)
        .single();
    
    if (findError || !order) {
        throw new Error(`Order ${order_id} not found in the database.`);
    }

    if (order.status === newStatus) {
        console.log(`Order ${order_id} is already in the correct state ('${newStatus}').`);
        // FIX: Even if status is correct, we should still try to submit to komerce just in case it failed before.
    } else {
        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ status: newStatus })
            .eq('id', order.id);

        if (updateError) throw new Error(`Failed to update order status: ${updateError.message}`);
    }


    // --- 5. Trigger Post-Payment Actions if Payment was Successful ---
    if (newStatus === 'paid') {
      console.log(`Payment confirmed for order ${order_id}. Triggering post-payment actions...`);
      
      // Submit order to shipping partner
      // FIX: Manually stringify the body to prevent potential silent serialization issues
      // when one function invokes another. This is a more robust way to make the call.
      const { error: komerceError } = await supabaseAdmin.functions.invoke('submit-order-to-komerce', {
        body: JSON.stringify({ orderId: order.id }),
      });
      if (komerceError) {
        console.error(`CRITICAL: Failed to submit order ${order.id} to Komerce after manual status check. Manual action required. Error:`, komerceError.message);
      } else {
        console.log(`Successfully submitted order ${order.id} to Komerce via manual check.`);
      }

      // Invoke confirmation email
      const { error: emailError } = await supabaseAdmin.functions.invoke('send-order-confirmation-email', {
          body: { order_id: order.id },
      });
      if (emailError) {
          console.error(`Failed to invoke order confirmation email for order ${order.id}:`, emailError.message);
      }
    }

    console.log(`Successfully synced and updated order ${order_id} to status '${newStatus}'`);
    
    return new Response(JSON.stringify({ status: newStatus, message: 'Order status successfully updated.' }), {
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