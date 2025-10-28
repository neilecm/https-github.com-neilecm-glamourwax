// supabase/functions/midtrans-notification-handler/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
  crypto: any; // Use Deno's global crypto
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to create a SHA-512 hash using Deno's Web Crypto API
async function createHash(data: string) {
  const encoder = new TextEncoder();
  const buffer = await Deno.crypto.subtle.digest('SHA-512', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const notification = await req.json();
    console.log("Received Midtrans notification:", JSON.stringify(notification, null, 2));

    const { order_id, status_code, gross_amount, signature_key, transaction_status } = notification;

    if (!order_id || !status_code || !gross_amount || !signature_key || !transaction_status) {
        throw new Error("Invalid notification payload from Midtrans.");
    }

    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY is not configured in secrets.");
    }

    // --- 1. Verify Signature Key for Security ---
    const expectedSignature = await createHash(`${order_id}${status_code}${gross_amount}${serverKey}`);
    if (signature_key !== expectedSignature) {
      console.error(`Signature mismatch. Expected: ${expectedSignature}, Got: ${signature_key}`);
      throw new Error("Invalid signature. Request is not from Midtrans.");
    }
    console.log("Signature verified successfully.");

    // --- 2. Determine New Order Status ---
    let newStatus: 'paid' | 'failed' | 'pending_payment' = 'pending_payment';
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      newStatus = 'paid';
    } else if (transaction_status === 'expire' || transaction_status === 'cancel' || transaction_status === 'deny') {
      newStatus = 'failed';
    } else {
        console.log(`Unhandled transaction status: ${transaction_status}. Order status will not be changed.`);
        return new Response('ok', { status: 200 }); // Acknowledge receipt
    }
    
    // --- 3. Update the Database ---
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
        // Important: Still return 200 to Midtrans so it doesn't retry, but log the critical error.
        console.error(`CRITICAL: Received valid notification for non-existent order_number: ${order_id}`);
        return new Response('Order not found, but acknowledged.', { status: 200 });
    }

    // Idempotency check: Don't update if status is already correct
    if (order.status === newStatus) {
        console.log(`Order ${order_id} is already in status '${newStatus}'. No update needed.`);
        return new Response('ok', { status: 200 });
    }

    const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

    if (updateError) throw new Error(`Failed to update order status: ${updateError.message}`);
    
    // --- 4. Log Payment and Trigger Confirmation Email ---
    
    // Insert a record into the payments table for auditing purposes.
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id: order.id,
        midtrans_id: notification.transaction_id || order_id,
        status_code: status_code,
        status_message: notification.status_message,
        payment_type: notification.payment_type,
        raw_response: notification,
      });

    if (paymentError) console.error(`Failed to log payment notification for order ${order_id}: ${paymentError.message}`);

    // If payment was successful, invoke the email sending function
    if (newStatus === 'paid') {
      console.log(`Payment successful for order ${order_id}. Invoking confirmation email function...`);
      const { error: invokeError } = await supabaseAdmin.functions.invoke('send-order-confirmation-email', {
          body: { order_id: order.id },
      });
      if (invokeError) {
          // This is a non-critical error. The payment is processed, but the email failed.
          // Log it for monitoring, but don't fail the webhook response to Midtrans.
          console.error(`Failed to invoke order confirmation email for order ${order.id}:`, invokeError.message);
      } else {
          console.log(`Successfully invoked email function for order ${order.id}.`);
      }
    }

    console.log(`Successfully updated order ${order_id} to status '${newStatus}'`);
    
    return new Response('Notification processed successfully.', { headers: corsHeaders, status: 200 });

  } catch (err) {
    console.error("Error in Midtrans notification handler:", err.message);
    // Return 500 so Midtrans knows to retry (if it's a temporary issue).
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});