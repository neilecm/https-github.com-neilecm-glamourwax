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

const sanitizePhoneNumber = (phone: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.substring(1)}`;
  if (digits.startsWith('62')) return digits;
  return digits;
};

const getCurrentWitaDateTime = () => {
    const now = new Date();
    const witaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
    const year = witaDate.getFullYear();
    const month = (witaDate.getMonth() + 1).toString().padStart(2, '0');
    const day = witaDate.getDate().toString().padStart(2, '0');
    const hours = witaDate.getHours().toString().padStart(2, '0');
    const minutes = witaDate.getMinutes().toString().padStart(2, '0');
    return {
        order_date: `${year}-${month}-${day}`,
        order_time: `${hours}:${minutes}`,
    };
};

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

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, customers (*)')
      .eq('id', orderId)
      .single();
    if (orderError) throw new Error(`DB Error (Fetch Order): ${orderError.message}`);
    if (!order || !order.customers) throw new Error(`Could not find order or customer for ID: ${orderId}`);

    const { data: address, error: addressError } = await supabaseAdmin
        .from('addresses')
        .select('*')
        .eq('id', order.shipping_address_id)
        .single();
    if (addressError) throw new Error(`DB Error (Fetch Address): ${addressError.message}`);
    if (!address) throw new Error(`Could not find address with ID: ${order.shipping_address_id}`);

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('quantity, price, product_variants ( name, weight, products (name) )')
      .eq('order_id', orderId);
    if (itemsError) throw new Error(`DB Error (Fetch Items): ${itemsError.message}`);
    if (!items || items.length === 0) throw new Error(`No items found for order ID: ${orderId}`);

    const shipperDetails = {
        name: "Cera Brasileira Store", phone: "81234567890",
        destination_id: 1391, address: "Jl. Cok Agung Tresna No.1, Denpasar, Bali",
        email: "shipping@cerabrasileira.com", brand_name: "Cera Brasileira"
    };

    const orderDetails = items.map((item: any) => ({
        product_name: item.product_variants.products.name,
        product_variant_name: item.product_variants.name,
        product_price: item.price, product_weight: item.product_variants.weight,
        product_width: 10, product_height: 8, product_length: 15,
        qty: item.quantity, subtotal: item.price * item.quantity,
    }));
    
    const { order_date, order_time } = getCurrentWitaDateTime();
    const insuranceValue = order.insurance_amount || 0;

    const komercePayload = {
      order_date, order_time,
      brand_name: shipperDetails.brand_name, shipper_name: shipperDetails.name,
      shipper_phone: shipperDetails.phone, shipper_destination_id: shipperDetails.destination_id,
      shipper_address: shipperDetails.address, shipper_email: shipperDetails.email,
      receiver_name: `${order.customers.first_name} ${order.customers.last_name}`,
      receiver_phone: sanitizePhoneNumber(order.customers.phone),
      receiver_destination_id: parseInt(address.district_id, 10),
      receiver_address: address.street,
      shipping: order.shipping_provider, shipping_type: order.shipping_service,
      payment_method: "BANK TRANSFER",
      shipping_cost: order.shipping_cost_original ?? 0,
      shipping_cashback: order.shipping_cashback ?? 0,
      service_fee: order.service_fee ?? 0,
      additional_cost: insuranceValue, // Pass insurance cost to buyer
      grand_total: order.total_amount,
      cod_value: 0,
      insurance_value: insuranceValue, // Declare insurance value
      order_details: orderDetails,
    };
    
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

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ komerce_order_no: komerceOrderNo, status: 'processing' })
      .eq('id', orderId);
    if (updateError) { throw new Error(`DB Error (Update Komerce No and Status): ${updateError.message}`); }

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