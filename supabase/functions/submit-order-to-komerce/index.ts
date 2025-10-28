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

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  try {
    const { orderId } = await req.json();
    if (!orderId) { throw new Error("orderId is a required parameter."); }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) { throw new Error("KOMERCE_API_KEY is not set in secrets."); }

    // --- 1. Fetch all required order data from local DB ---
    const { data: orderData, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select(`
        created_at, total_amount, shipping_amount,
        shipping_provider, shipping_service,
        customers ( first_name, last_name, email, phone ),
        addresses ( street, district_id ),
        order_items (
            quantity,
            price,
            product_variants (
                name, weight,
                products ( name )
            )
        )
      `)
      .eq('id', orderId)
      .single();
      
    if (fetchError) throw new Error(`DB Error (Fetch Order): ${fetchError.message}`);
    if (!orderData || !orderData.customers || !orderData.addresses) throw new Error(`Could not find complete order details for ID: ${orderId}`);

    // --- 2. Construct Komerce API Payload ---
    // NOTE: Shipper details are hardcoded for this example. In production,
    // these should come from environment variables or a settings table.
    const shipperDetails = {
        name: "Cera Brasileira Store",
        phone: "81234567890",
        destination_id: 1391, // Hardcoded: Denpasar Selatan
        address: "Jl. Cok Agung Tresna No.1, Denpasar, Bali",
        email: "shipping@cerabrasileira.com",
        brand_name: "Cera Brasileira"
    };

    const orderDetails = orderData.order_items.map((item: any) => ({
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

    const totalProductValue = orderDetails.reduce((sum: number, item: any) => sum + item.subtotal, 0);

    const komercePayload = {
      order_date: new Date(orderData.created_at).toISOString().split('T')[0],
      brand_name: shipperDetails.brand_name,
      shipper_name: shipperDetails.name,
      shipper_phone: shipperDetails.phone,
      shipper_destination_id: shipperDetails.destination_id,
      shipper_address: shipperDetails.address,
      shipper_email: shipperDetails.email,
      receiver_name: `${orderData.customers.first_name} ${orderData.customers.last_name}`,
      receiver_phone: orderData.customers.phone,
      receiver_destination_id: orderData.addresses.district_id,
      receiver_address: orderData.addresses.street,
      shipping: orderData.shipping_provider,
      shipping_type: orderData.shipping_service,
      payment_method: "BANK TRANSFER",
      shipping_cost: orderData.shipping_amount,
      shipping_cashback: 0,
      service_fee: 0,
      additional_cost: 0,
      grand_total: orderData.total_amount,
      cod_value: 0,
      insurance_value: 0, // Simplified for this example
      order_details: orderDetails,
    };
    
    // --- 3. Send Request to Komerce API ---
    const komerceResponse = await fetch(KOMERCE_API_URL, {
        method: 'POST',
        headers: { 'x-api-key': KOMERCE_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(komercePayload),
    });
    
    const komerceJson = await komerceResponse.json();
    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      throw new Error(`[Komerce API] ${komerceJson.meta?.message || 'Failed to store order.'}`);
    }
    const komerceOrderNo = komerceJson.data?.order_no;
    if (!komerceOrderNo) { throw new Error("Komerce API did not return an order_no."); }

    // --- 4. Update local DB with Komerce Order Number ---
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ komerce_order_no: komerceOrderNo })
      .eq('id', orderId);
    if (updateError) { throw new Error(`DB Error (Update Komerce No): ${updateError.message}`); }

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