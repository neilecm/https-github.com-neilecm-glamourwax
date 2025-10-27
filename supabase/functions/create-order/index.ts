// supabase/functions/create-order/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from '@supabase/supabase-js'
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
    
    const args = {
      customer_first_name: customerDetails.firstName,
      customer_last_name: customerDetails.lastName,
      customer_email: customerDetails.email,
      customer_phone: customerDetails.phone,
      address_street: customerDetails.address,
      address_province_id: customerDetails.province.id,
      address_province_name: customerDetails.province.name,
      address_city_id: customerDetails.city.id,
      address_city_name: customerDetails.city.name,
      address_district_id: customerDetails.district.id,
      address_district_name: customerDetails.district.name,
      address_subdistrict_id: customerDetails.subdistrict?.id,
      address_subdistrict_name: customerDetails.subdistrict?.name,
      address_postal_code: customerDetails.postalCode,
      order_subtotal: subtotal,
      order_shipping_cost: shippingOption.cost,
      order_total: total,
      order_shipping_provider: shippingOption.name,
      order_shipping_service: shippingOption.service,
      // Map cart items to the structure expected by the JSONB parameter
      order_items_json: cartItems.map(item => ({
        product_id: item.product.id,
        variant_id: item.variant.id,
        quantity: item.quantity,
        price: item.variant.price // Use variant price
      })),
      payment_midtrans_id: midtransResult.order_id,
      payment_status_code: midtransResult.status_code,
      payment_status_message: midtransResult.status_message,
      payment_type: midtransResult.payment_type,
      payment_raw_response: midtransResult,
    };

    console.log("Calling create_full_order_with_variants with args:", JSON.stringify(args, null, 2));

    // Call the updated PostgreSQL function
    const { data: newOrderId, error } = await supabaseAdmin.rpc('create_full_order_with_variants', args);

    if (error) {
      console.error('Error calling create_full_order_with_variants function:', error);
      throw error;
    }
    
    console.log("Successfully created order with ID:", newOrderId);

    return new Response(JSON.stringify({ success: true, orderId: midtransResult.order_id, newOrderId }), {
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
