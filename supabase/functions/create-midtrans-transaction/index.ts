// supabase/functions/create-midtrans-transaction/index.ts

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

const MIDTRANS_API_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { customerDetails, cartItems, shippingOption, subtotal, total } = await req.json();

    // --- 1. Get Secrets & Supabase Admin Client ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey || !midtransServerKey) {
      throw new Error("Missing environment variables in Supabase secrets.");
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const orderNumber = `CB-${Date.now()}`;

    // --- 2. Create Order in Database (Corrected Logic) ---

    // Step A: Upsert Customer
    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert({
        email: customerDetails.email,
        first_name: customerDetails.firstName,
        last_name: customerDetails.lastName,
        phone: customerDetails.phone,
      }, { onConflict: 'email' })
      .select('id')
      .single();
    if (customerError) throw new Error(`DB Error (Customer): ${customerError.message}`);

    // Step B: Insert Address
    const { data: addressData, error: addressError } = await supabaseAdmin
      .from('addresses')
      .insert({
        customer_id: customerData.id,
        street: customerDetails.address,
        province_id: customerDetails.province.id,
        province_name: customerDetails.province.name,
        city_id: customerDetails.city.id,
        city_name: customerDetails.city.name,
        district_id: customerDetails.district.id,
        district_name: customerDetails.district.name,
        subdistrict_id: customerDetails.subdistrict?.id,
        subdistrict_name: customerDetails.subdistrict?.name,
        postal_code: customerDetails.postalCode,
      })
      .select('id')
      .single();
    if (addressError) throw new Error(`DB Error (Address): ${addressError.message}`);

    // Step C: Insert Order
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerData.id,
        shipping_address_id: addressData.id,
        status: 'pending_payment',
        total_amount: Math.round(total),
        subtotal_amount: Math.round(subtotal),
        shipping_amount: Math.round(shippingOption.cost),
        shipping_provider: shippingOption.code.toUpperCase(),
        shipping_service: shippingOption.service,
      })
      .select('id')
      .single();
    if (orderError) throw new Error(`DB Error (Order): ${orderError.message}`);

    // Step D: Insert Order Items
    const orderItemsToInsert = cartItems.map((item: any) => ({
      order_id: orderData.id,
      product_id: item.variant.productId,
      product_variant_id: item.variant.id,
      quantity: item.quantity,
      price: Math.round(item.variant.price),
    }));
    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItemsToInsert);
    if (itemsError) throw new Error(`DB Error (Items): ${itemsError.message}`);

    // --- 3. Create Midtrans Transaction ---
    const item_details = [
      ...cartItems.map((item: any) => ({
        id: item.variant.id,
        price: Math.round(item.variant.price),
        quantity: item.quantity,
        name: `${item.product.name} - ${item.variant.name}`.substring(0, 50),
      })),
      {
        id: 'SHIPPING',
        price: Math.round(shippingOption.cost),
        quantity: 1,
        name: `Shipping: ${shippingOption.name}`,
      },
    ];

    const gross_amount = item_details.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const midtransPayload = {
      transaction_details: { order_id: orderNumber, gross_amount },
      item_details,
      customer_details: {
        first_name: customerDetails.firstName,
        last_name: customerDetails.lastName,
        email: customerDetails.email,
        phone: customerDetails.phone,
        shipping_address: {
            first_name: customerDetails.firstName, last_name: customerDetails.lastName,
            email: customerDetails.email, phone: customerDetails.phone, address: customerDetails.address,
            city: customerDetails.city.name, postal_code: customerDetails.postalCode, country_code: 'IDN'
        }
      },
      expiry: { unit: "day", duration: 1 }
    };

    const midtransResponse = await fetch(MIDTRANS_API_URL, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Basic ${btoa(midtransServerKey + ':')}` },
      body: JSON.stringify(midtransPayload),
    });
    
    const midtransJson = await midtransResponse.json();
    if (!midtransResponse.ok) {
      throw new Error(`[Midtrans API] ${midtransJson.error_messages?.join(', ') || 'Failed to create transaction.'}`);
    }
    if (!midtransJson.token) {
        throw new Error("Midtrans did not return a transaction token.");
    }
    
    // --- 4. Return Token and Order ID to Client ---
    return new Response(JSON.stringify({ token: midtransJson.token, orderId: orderNumber }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in create-midtrans-transaction function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});