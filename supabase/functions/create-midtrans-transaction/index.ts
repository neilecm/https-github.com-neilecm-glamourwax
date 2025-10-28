// supabase/functions/create-midtrans-transaction/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Note: Types are inferred from the payload structure for Deno compatibility.

const MIDTRANS_API_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { customerDetails, cartItems, shippingOption, subtotal, total } = await req.json();

    if (!customerDetails || !cartItems || !shippingOption || !total) {
      throw new Error("Missing required order information.");
    }
    
    // --- Stage 1: Create a pending order in our database ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 1a. Upsert customer
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert({
        email: customerDetails.email.toLowerCase(),
        first_name: customerDetails.firstName,
        last_name: customerDetails.lastName,
        phone: customerDetails.phone,
      }, { onConflict: 'email' })
      .select()
      .single();

    if (customerError) throw new Error(`DB Error (Customer): ${customerError.message}`);

    // 1b. Insert address
    const { data: address, error: addressError } = await supabaseAdmin
      .from('addresses')
      .insert({
        customer_id: customer.id,
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
      .select()
      .single();

    if (addressError) throw new Error(`DB Error (Address): ${addressError.message}`);

    // 1c. Insert order record with 'pending_payment' status
    const orderNumber = `order-cerabrasileira-${Date.now()}`;
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customer.id,
        shipping_address_id: address.id,
        subtotal_amount: subtotal,
        shipping_amount: shippingOption.cost,
        total_amount: total,
        status: 'pending_payment',
        shipping_provider: shippingOption.code, // Use code for consistency
        shipping_service: shippingOption.service,
      })
      .select()
      .single();

    if (orderError) throw new Error(`DB Error (Order): ${orderError.message}`);

    // 1d. Insert order items
    const itemsToInsert = cartItems.map((item: any) => ({
      order_id: order.id,
      product_id: item.product.id,
      product_variant_id: item.variant.id,
      quantity: item.quantity,
      price: item.variant.price,
    }));
    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(itemsToInsert);
    if (itemsError) throw new Error(`DB Error (Items): ${itemsError.message}`);

    console.log(`Successfully created pending order ${orderNumber} in database.`);

    // --- Stage 2: Create Midtrans transaction and return token ---
    const MIDTRANS_SERVER_KEY = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!MIDTRANS_SERVER_KEY) {
      throw new Error("MIDTRANS_SERVER_KEY not set in secrets.");
    }

    const midtransPayload = {
      transaction_details: {
        order_id: orderNumber,
        gross_amount: total,
      },
      customer_details: {
        first_name: customerDetails.firstName,
        last_name: customerDetails.lastName,
        email: customerDetails.email,
        phone: customerDetails.phone,
      },
    };

    const encodedKey = btoa(`${MIDTRANS_SERVER_KEY}:`);
    const midtransResponse = await fetch(MIDTRANS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${encodedKey}`,
      },
      body: JSON.stringify(midtransPayload),
    });

    const midtransJson = await midtransResponse.json();
    if (!midtransResponse.ok) {
      throw new Error(`[Midtrans API] ${midtransJson.error_messages?.join(', ') || 'Unknown API error'}`);
    }

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