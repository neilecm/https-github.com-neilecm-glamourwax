// supabase/functions/send-order-confirmation-email/index.ts

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

const RESEND_API_URL = 'https://api.resend.com/emails';

const formatCurrency = (amount: number) => {
    return `Rp${amount.toLocaleString('id-ID')}`;
};

const generateEmailHtml = (order: any) => {
    const customerName = `${order.customers.first_name} ${order.customers.last_name}`;
    const fullAddress = [
        order.addresses.street,
        order.addresses.subdistrict_name,
        order.addresses.district_name,
        order.addresses.city_name,
        `${order.addresses.province_name} ${order.addresses.postal_code}`
    ].filter(Boolean).join(', ');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
                .header { text-align: center; border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
                .header h1 { color: #DB2777; margin: 0; }
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .items-table th, .items-table td { text-align: left; padding: 10px; border-bottom: 1px solid #eee; }
                .items-table th { background-color: #f9f9f9; }
                .totals-table { width: 100%; max-width: 300px; margin-left: auto; }
                .totals-table td { padding: 5px; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Cera Brasileira</h1>
                    <h2>Thank you for your order!</h2>
                </div>
                <p>Hi ${customerName},</p>
                <p>We've received your order #${order.order_number} and are getting it ready for shipment. Here is a summary of your purchase:</p>
                
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.order_items.map((item: any) => `
                            <tr>
                                <td>
                                    <strong>${item.product_variants.products.name}</strong>
                                    <br>
                                    <small>${item.product_variants.name}</small>
                                </td>
                                <td>${item.quantity}</td>
                                <td>${formatCurrency(item.price * item.quantity)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <table class="totals-table">
                    <tr>
                        <td>Subtotal:</td>
                        <td style="text-align:right;">${formatCurrency(order.subtotal_amount)}</td>
                    </tr>
                    <tr>
                        <td>Shipping (${order.shipping_provider} - ${order.shipping_service}):</td>
                        <td style="text-align:right;">${formatCurrency(order.shipping_amount)}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; border-top: 2px solid #333; padding-top: 10px;">Total:</td>
                        <td style="font-weight: bold; text-align:right; border-top: 2px solid #333; padding-top: 10px;">${formatCurrency(order.total_amount)}</td>
                    </tr>
                </table>

                <h3 style="margin-top: 30px;">Shipping Address</h3>
                <p>${fullAddress}</p>

                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} Cera Brasileira. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();
    if (!order_id) {
      throw new Error("Missing 'order_id' in request body.");
    }

    // --- 1. Get Secrets & Supabase Admin Client ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set in Supabase secrets.");
    }

    // --- 2. Fetch Full Order Details ---
    const { data: orderData, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select(`
            order_number, total_amount, subtotal_amount, shipping_amount, shipping_provider, shipping_service,
            customers ( first_name, last_name, email ),
            addresses ( street, city_name, province_name, district_name, subdistrict_name, postal_code ),
            order_items (
                quantity,
                price,
                product_variants (
                    name,
                    products ( name )
                )
            )
        `)
        .eq('id', order_id)
        .single();
    
    if (fetchError) throw new Error(`DB Error (Fetch Order): ${fetchError.message}`);
    if (!orderData || !orderData.customers || !orderData.addresses) {
        throw new Error(`Could not find complete order details for ID: ${order_id}`);
    }

    // --- 3. Construct and Send Email ---
    const emailHtml = generateEmailHtml(orderData);
    const customerEmail = orderData.customers.email;

    const emailPayload = {
      from: 'Cera Brasileira <onboarding@resend.dev>', // Resend requires this format for the free tier
      to: [customerEmail],
      subject: `Your Cera Brasileira Order Confirmation #${orderData.order_number}`,
      html: emailHtml,
    };

    const resendResponse = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
    });
    
    const resendJson = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error("Resend API Error:", resendJson);
      throw new Error(`[Resend API] ${resendJson?.message || 'Failed to send email.'}`);
    }

    console.log(`Successfully sent order confirmation to ${customerEmail} for order ${orderData.order_number}.`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in send-order-confirmation-email function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});