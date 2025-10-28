// supabase/functions/midtrans-notification-handler/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HmacSha512 } from 'https://deno.land/std@0.119.0/hash/sha512.ts';

// Helper to map Midtrans status to our internal status
const mapMidtransStatus = (transactionStatus: string, fraudStatus?: string): 'paid' | 'failed' | null => {
  if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
    if (fraudStatus === 'challenge' || fraudStatus === 'accept') {
      return 'paid';
    }
  } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
    return 'failed';
  }
  // 'pending' and other statuses are ignored, as we only care about final states.
  return null;
};

serve(async (req) => {
  try {
    const notificationJson = await req.json();
    console.log("Received Midtrans notification:", JSON.stringify(notificationJson, null, 2));

    const {
      order_id: orderNumber,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
    } = notificationJson;

    // --- 1. Get Secrets & Supabase Admin Client ---
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!midtransServerKey) {
      console.error("FATAL: MIDTRANS_SERVER_KEY is not set.");
      return new Response('Server configuration error', { status: 500 });
    }
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- 2. Verify Signature Key ---
    const expectedSignature = new HmacSha512(midtransServerKey)
      .update(`${orderNumber}${statusCode}${grossAmount}`)
      .toString();

    if (signatureKey !== expectedSignature) {
      console.error(`Signature mismatch for order ${orderNumber}. Expected: ${expectedSignature}, Got: ${signatureKey}`);
      return new Response('Invalid signature', { status: 403 });
    }
    console.log(`Signature verified for order ${orderNumber}.`);

    // --- 3. Update Order Status in Database ---
    const newStatus = mapMidtransStatus(transactionStatus, fraudStatus);
    if (!newStatus) {
      console.log(`Ignoring status '${transactionStatus}' for order ${orderNumber}.`);
      return new Response('Notification processed, status ignored.', { status: 200 });
    }

    console.log(`Updating order ${orderNumber} to status '${newStatus}'.`);
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: newStatus })
      .eq('order_number', orderNumber)
      .select('id, status')
      .single();

    if (updateError) {
      console.error(`DB Error (Update Order Status): ${updateError.message}`);
      // Return 500 so Midtrans might retry
      return new Response('Database update failed', { status: 500 });
    }
    if (!updatedOrder) {
        console.warn(`Order with order_number ${orderNumber} not found in database.`);
        return new Response('Order not found', { status: 404 });
    }

    // --- 4. Trigger Post-Payment Actions (e.g., Email) ---
    if (updatedOrder.status === 'paid') {
      console.log(`Triggering confirmation email for order ID ${updatedOrder.id}`);
      // Invoke the email function without waiting for it to complete.
      // The notification handler's primary job is to quickly respond to Midtrans.
      supabaseAdmin.functions.invoke('send-order-confirmation-email', {
        body: { order_id: updatedOrder.id },
      }).catch(err => {
        // Log error but don't fail the response to Midtrans
        console.error(`Error invoking send-order-confirmation-email for order ${updatedOrder.id}:`, err.message);
      });
    }

    console.log(`Successfully processed notification for order ${orderNumber}.`);
    return new Response('Notification received successfully.', { status: 200 });

  } catch (err) {
    console.error("Error in Midtrans notification handler:", err.message);
    return new Response('Internal server error', { status: 500 });
  }
});
