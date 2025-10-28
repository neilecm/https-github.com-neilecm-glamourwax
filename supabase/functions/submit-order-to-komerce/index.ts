// supabase/functions/submit-order-to-komerce/index.ts

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

const KOMERCE_API_URL = 'https://api-sandbox.collaborator.komerce.id/order/api/v1/orders/store';

// Helper to format phone numbers to meet Komerce API requirements (must not start with '0' or '+')
const sanitizePhoneNumber = (phone: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, ''); // Remove all non-numeric characters
  if (digits.startsWith('0')) {
    // Replace leading '0' with '62' if it's an Indonesian number
    return `62${digits.substring(1)}`;
  }
  if (digits.startsWith('62')) {
      return digits;
  }
  // If it doesn't start with 0, assume it's a valid format like '812...'
  return digits;
};


serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  try {
    const { orderId } = await req.json();
    if (!orderId) { throw new Error("orderId is a required parameter."); }
    console.log(`[komerce] Received request for orderId: ${orderId}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) { throw new Error("KOMERCE_API_KEY is not set in secrets."); }

    // --- Definitive Fix: Fetch data in robust, separate steps ---

    // 1. Fetch the Order and its associated Customer
    console.log(`[komerce] Step 1: Fetching order and customer for orderId: ${orderId}`);
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, customers (*)')
      .eq('id', orderId)
      .single();
    if (orderError) throw new Error(`DB Error (Fetch Order): ${orderError.message}`);
    if (!order || !order.customers) throw new Error(`Could not find order or associated customer for ID: ${orderId}`);
    console.log("[komerce] Step 1 successful.");

    // 2. Fetch the Shipping Address using the ID from the order
    console.log(`[komerce] Step 2: Fetching address for address_id: ${order.shipping_address_id}`);
    const { data: address, error: addressError } = await supabaseAdmin
        .from('addresses')
        .select('*')
        .eq('id', order.shipping_address_id)
        .single();
    if (addressError) throw new Error(`DB Error (Fetch Address): ${addressError.message}`);
    if (!address) throw new Error(`Could not find address with ID: ${order.shipping_address_id}`);
    console.log("[komerce] Step 2 successful.");

    // 3. Fetch the Order Items and their related Product/Variant info
    console.log(`[komerce] Step 3: Fetching order items for orderId: ${orderId}`);
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('quantity, price, product_variants ( name, weight, products (name) )')
      .eq('order_id', orderId);
    if (itemsError) throw new Error(`DB Error (Fetch Items): ${itemsError.message}`);
    if (!items || items.length === 0) throw new Error(`No items found for order ID: ${orderId}`);
    console.log("[komerce] Step 3 successful.");

    // --- 4. Construct Komerce API Payload ---
    console.log("[komerce] Step 4: Constructing Komerce payload.");
    const shipperDetails = {
        name: "Cera Brasileira Store",
        phone: "81234567890", // Already in valid format
        destination_id: 1391, // Hardcoded: Denpasar Selatan
        address: "Jl. Cok Agung Tresna No.1, Denpasar, Bali",
        email: "shipping@cerabrasileira.com",
        brand_name: "Cera Brasileira"
    };

    const orderDetails = items.map((item: any) => ({
        product_name: item.product_variants.products.name,
        product_variant_name: item.product_variants.name,
        product_price: item.price,
        product_weight: item.product_variants.weight,
        product_width: 10,  // Default value
        product_height: 8, // Default value
        product_length: 15, // Default value
        qty: item.quantity,
        subtotal: item.price * item.quantity,
    }));

    const komercePayload = {
      order_date: new Date(order.created_at).toISOString().split('T')[0],
      brand_name: shipperDetails.brand_name,
      shipper_name: shipperDetails.name,
      shipper_phone: shipperDetails.phone,
      shipper_destination_id: shipperDetails.destination_id,
      shipper_address: shipperDetails.address,
      shipper_email: shipperDetails.email,
      receiver_name: `${order.customers.first_name} ${order.customers.last_name}`,
      receiver_phone: sanitizePhoneNumber(order.customers.phone),
      receiver_destination_id: address.district_id,
      receiver_address: address.street,
      shipping: order.shipping_provider,
      shipping_type: order.shipping_service,
      payment_method: "BANK TRANSFER",
      shipping_cost: order.shipping_amount,
      shipping_cashback: 0,
      service_fee: 0,
      additional_cost: 0,
      grand_total: order.total_amount,
      cod_value: 0,
      insurance_value: 0, // Simplified for this example
      order_details: orderDetails,
    };
    
    // --- 5. Send Request to Komerce API ---
    console.log("[komerce] Step 5: Sending request to Komerce API.");
    const komerceResponse = await fetch(KOMERCE_API_URL, {
        method: 'POST',
        headers: { 'x-api-key': KOMERCE_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(komercePayload),
    });
    
    const komerceJson = await komerceResponse.json();
    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      throw new Error(`[Komerce API] ${komerceJson.meta?.message || 'Failed to store order.'} - Payload: ${JSON.stringify(komercePayload)}`);
    }
    const komerceOrderNo = komerceJson.data?.order_no;
    if (!komerceOrderNo) { throw new Error("Komerce API did not return an order_no."); }
    console.log(`[komerce] Step 5 successful. Received Komerce Order No: ${komerceOrderNo}`);

    // --- 6. Update local DB with Komerce Order Number ---
    console.log(`[komerce] Step 6: Updating local order with Komerce order number.`);
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ komerce_order_no: komerceOrderNo })
      .eq('id', orderId);
    if (updateError) { throw new Error(`DB Error (Update Komerce No): ${updateError.message}`); }
    console.log("[komerce] Step 6 successful.");

    return new Response(JSON.stringify({ success: true, komerceOrderNo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error("Error in submit-order-to-komerce function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});