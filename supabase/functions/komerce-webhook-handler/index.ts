// supabase/functions/komerce-webhook-handler/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

// Helper function to map Komerce webhook status to our internal status
const mapKomerceStatus = (komerceStatus: string): 'shipped' | 'delivered' | 'cancelled' | null => {
    if (!komerceStatus) return null;
    const lowerStatus = komerceStatus.toLowerCase();
    if (lowerStatus.includes('picked up') || lowerStatus.includes('on process') || lowerStatus.includes('delivering')) {
        return 'shipped';
    }
    if (lowerStatus.includes('delivered')) {
        return 'delivered';
    }
    if (lowerStatus.includes('cancelled')) {
        return 'cancelled';
    }
    return null; // Ignore other statuses
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Received Komerce webhook:", JSON.stringify(payload, null, 2));

    // Komerce sandbox sometimes sends notifications in an array
    const notification = Array.isArray(payload) ? payload[0] : payload;
    
    // Extract key details from the webhook payload
    const komerceOrderNo = notification.order_no;
    const awb = notification.awb;
    const komerceStatus = notification.status_pengiriman; 

    if (!komerceOrderNo) {
      console.warn("Webhook received without 'order_no'. Ignoring.");
      return new Response(JSON.stringify({ warning: "Missing order_no" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Acknowledge receipt
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, status, awb_number')
      .eq('komerce_order_no', komerceOrderNo)
      .single();

    if (fetchError || !order) {
      console.error(`Order with Komerce number ${komerceOrderNo} not found. Error: ${fetchError?.message}`);
      return new Response('Order not found', { status: 404 });
    }

    const updatePayload: { status?: string, awb_number?: string } = {};

    if (awb && awb !== order.awb_number) {
        updatePayload.awb_number = awb;
        // When an AWB is assigned, we can confidently move the status to 'shipped'
        if (order.status === 'processing' || order.status === 'label_created') {
             updatePayload.status = 'shipped';
        }
    }
    
    const newInternalStatus = mapKomerceStatus(komerceStatus);
    if (newInternalStatus && newInternalStatus !== order.status) {
        updatePayload.status = newInternalStatus;
    }

    if (Object.keys(updatePayload).length === 0) {
        console.log(`No updates needed for order ${komerceOrderNo}.`);
        return new Response('No update required', { status: 200 });
    }

    console.log(`Updating order ${komerceOrderNo} with payload:`, JSON.stringify(updatePayload));
    
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('komerce_order_no', komerceOrderNo);

    if (updateError) {
      throw new Error(`DB Error (Update Order): ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Order updated successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in komerce-webhook-handler:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});