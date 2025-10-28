// supabase/functions/create-order/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { CartItem, CustomerDetails, ShippingOption } from '../../../types.ts'

interface RequestBody {
  customerDetails: CustomerDetails;
  cartItems: CartItem[];
  shippingOption: ShippingOption;
  subtotal: number;
  total: number;
  midtransResult: any;
}

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
    const {
      customerDetails,
      cartItems,
      shippingOption,
      subtotal,
      total,
      midtransResult,
    }: RequestBody = await req.json();

    if (!customerDetails || !cartItems || !shippingOption || !total || !midtransResult) {
      throw new Error("Missing required order information.");
    }
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // --- Transactional Logic using direct Supabase client calls ---

    // 1. Find or create the customer record.
    console.log("Upserting customer...");
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

    if (customerError) throw new Error(`Failed to create/update customer: ${customerError.message}`);
    console.log("Customer upserted successfully:", customer.id);


    // 2. Create the address record.
    console.log("Inserting address...");
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

    if (addressError) throw new Error(`Failed to save address: ${addressError.message}`);
    console.log("Address inserted successfully:", address.id);


    // 3. Create the order record.
    console.log("Inserting order...");
    const orderStatus = midtransResult.transaction_status === 'settlement' || midtransResult.transaction_status === 'capture' ? 'paid' : 'pending_payment';
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: midtransResult.order_id,
        customer_id: customer.id,
        shipping_address_id: address.id,
        subtotal_amount: subtotal,
        shipping_amount: shippingOption.cost,
        total_amount: total,
        status: orderStatus,
        shipping_provider: shippingOption.name,
        shipping_service: shippingOption.service,
      })
      .select()
      .single();

    if (orderError) throw new Error(`Failed to create order: ${orderError.message}`);
    console.log("Order inserted successfully:", order.id);

    // 4. Create the payment record.
    console.log("Inserting payment record...");
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id: order.id,
        midtrans_id: midtransResult.order_id,
        status_code: midtransResult.status_code,
        status_message: midtransResult.status_message,
        payment_type: midtransResult.payment_type,
        raw_response: midtransResult,
      });

    if (paymentError) throw new Error(`Failed to save payment details: ${paymentError.message}`);
    console.log("Payment record inserted successfully.");


    // 5. Create the order item records.
    console.log("Inserting order items...");
    const itemsToInsert = cartItems.map(item => ({
      order_id: order.id,
      product_id: item.product.id,
      product_variant_id: item.variant.id,
      quantity: item.quantity,
      price: item.variant.price,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) throw new Error(`Failed to save order items: ${itemsError.message}`);
    console.log("Order items inserted successfully.");


    console.log("Successfully created full order with ID:", order.id);

    return new Response(JSON.stringify({ success: true, orderId: midtransResult.order_id, newOrderId: order.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in create-order function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});