// supabase/functions/cron-check-pending-payments/index.ts

// This function is designed to be run as a scheduled cron job.
// In your Supabase dashboard, go to "Database" -> "Cron Jobs" and create a new job.
// Schedule: */5 * * * * (runs every 5 minutes)
// Function: cron-check-pending-payments
// You must also set a 'CRON_SECRET' in your project's secrets. The cron job
// needs an Authorization header: 'Bearer YOUR_CRON_SECRET'.

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MIDTRANS_API_URL_BASE = 'https://api.sandbox.midtrans.com/v2/';

const mapMidtransStatus = (transactionStatus: string, fraudStatus?: string): 'paid' | 'failed' | null => {
  if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
    if (fraudStatus === 'challenge' || fraudStatus === 'accept') return 'paid';
  } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
    return 'failed';
  }
  return null;
};

serve(async (req) => {
  // 1. Authenticate the cron job request
  const cronSecret = req.headers.get('Authorization')?.replace('Bearer ', '');
  const storedCronSecret = Deno.env.get('CRON_SECRET');
  if (!storedCronSecret || cronSecret !== storedCronSecret) {
    console.warn("Unauthorized cron job attempt.");
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!midtransServerKey) throw new Error("MIDTRANS_SERVER_KEY is not set.");

    // 2. Fetch all orders that are currently pending payment
    const { data: pendingOrders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number')
      .eq('status', 'pending_payment');

    if (fetchError) throw new Error(`DB Error (Fetch Pending): ${fetchError.message}`);

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(JSON.stringify({ message: "No pending orders to check." }), { status: 200 });
    }

    console.log(`Found ${pendingOrders.length} pending order(s) to check.`);
    let updatedCount = 0;
    const errors: string[] = [];

    // 3. Loop through each pending order and check its status
    for (const order of pendingOrders) {
      try {
        const endpoint = `${MIDTRANS_API_URL_BASE}${order.order_number}/status`;
        const midtransResponse = await fetch(endpoint, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'Authorization': `Basic ${btoa(midtransServerKey + ':')}` },
        });
        
        const statusJson = await midtransResponse.json();
        if (!midtransResponse.ok) {
            throw new Error(`Midtrans API Error for ${order.order_number}: ${statusJson.status_message}`);
        }

        const newStatus = mapMidtransStatus(statusJson.transaction_status, statusJson.fraud_status);

        if (newStatus) {
          const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ status: newStatus })
            .eq('id', order.id);
          
          if (updateError) {
              throw new Error(`DB Error (Update Order ${order.id}): ${updateError.message}`);
          }
          
          updatedCount++;
          console.log(`Order ${order.order_number} (ID: ${order.id}) updated to '${newStatus}'.`);

          if (newStatus === 'paid') {
            supabaseAdmin.functions.invoke('send-order-confirmation-email', {
              body: { order_id: order.id },
            }).catch(err => console.error(`Error invoking email fn for order ${order.id}:`, err.message));
          }
        }
      } catch (e) {
        console.error(`Failed to process order ${order.order_number}: ${e.message}`);
        errors.push(e.message);
      }
    }

    const summary = `Cron job finished. Checked ${pendingOrders.length} orders. Updated ${updatedCount}. Errors: ${errors.length}.`;
    console.log(summary);
    return new Response(JSON.stringify({ message: summary, errors }), { status: 200 });

  } catch (err) {
    console.error("Critical error in cron-check-pending-payments:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});