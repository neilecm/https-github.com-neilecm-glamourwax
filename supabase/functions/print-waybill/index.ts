// supabase/functions/print-waybill/index.ts
declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from "https://deno.land/std@0.203.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KOMERCE_API_URL = 'https://api-sandbox.collaborator.komerce.id/order/api/v1/orders/print-label';

// Ten years in seconds for the signed URL expiry
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365 * 10; 

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  try {
    const { orderNos } = await req.json(); // Array of internal order numbers "CB-..."
    if (!orderNos || !Array.isArray(orderNos) || orderNos.length === 0) { 
      throw new Error("orderNos (array) is a required parameter."); 
    }

    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) throw new Error("KOMERCE_API_KEY secret not set.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- Step 1: Fetch order details from DB ---
    const { data: orders, error: fetchOrdersError } = await supabaseAdmin
        .from('orders')
        .select('order_number, komerce_order_no, waybill_url') // Also fetch waybill_url
        .in('order_number', orderNos);

    if (fetchOrdersError) {
        throw new Error(`DB Error fetching order details: ${fetchOrdersError.message}`);
    }
    if (!orders || orders.length === 0) {
        throw new Error('Could not find any of the specified orders in the database.');
    }

    // --- Step 2: Attempt to serve from cache for single order requests ---
    if (orders.length === 1) {
        const order = orders[0];
        if (order.waybill_url) {
            try {
                console.log(`Attempting to fetch cached waybill from URL: ${order.waybill_url}`);
                const cacheResponse = await fetch(order.waybill_url);
                if (!cacheResponse.ok) {
                    // Throw an error to trigger the fallback logic if the URL is expired/invalid
                    throw new Error(`Failed to fetch from cached URL, status: ${cacheResponse.status}`);
                }
                const pdfBlob = await cacheResponse.blob();
                console.log(`Successfully served cached waybill for ${order.order_number} from URL.`);
                return new Response(pdfBlob, {
                    headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
                    status: 200,
                });
            } catch (e) {
                 console.error(`Cache miss for order ${order.order_number} (URL fetch failed): ${e.message}. Will fetch a new one from Komerce.`);
                 // Fall-through to fetch a new one from the API.
            }
        }
    }
    
    // --- Step 3: Fetch new label from Komerce API if cache fails or for bulk requests ---
    console.log("Proceeding to fetch new label(s) from Komerce API.");
    const komerceOrderNos = orders.map(o => o.komerce_order_no).filter(Boolean);
    if (komerceOrderNos.length !== orders.length) {
        throw new Error("Some requested orders have not been submitted to Komerce yet.");
    }
    
    const formData = new URLSearchParams();
    formData.append('page', 'page_5');
    formData.append('order_no', komerceOrderNos.join(','));

    const komerceResponse = await fetch(KOMERCE_API_URL, {
        method: 'POST',
        headers: { 
            'x-api-key': KOMERCE_API_KEY,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: formData.toString()
    });

    const komerceJson = await komerceResponse.json();
    if (!komerceResponse.ok || komerceJson.meta?.status !== 'success') {
      throw new Error(`[Komerce API] ${komerceJson.meta?.message || 'Failed to generate label.'}`);
    }
    
    const base64Pdf = komerceJson.data?.base_64;
    if (!base64Pdf) throw new Error("Komerce API did not return waybill data.");

    const pdfData = decode(base64Pdf);
    
    // --- Step 4: Cache the label if it's a single request ---
    if (orders.length === 1) {
        const order = orders[0];
        const filePath = `${order.komerce_order_no}.pdf`; // Consistent filename.
        
        const { error: uploadError } = await supabaseAdmin.storage
            .from('waybills')
            .upload(filePath, pdfData, { contentType: 'application/pdf', upsert: true });
        
        if (uploadError) {
            console.error("Storage Upload Error:", uploadError.message);
        } else {
            // Generate a long-lived signed URL to store
            const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
                .from('waybills')
                .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

            if (signedUrlError) {
                console.error("Signed URL Creation Error:", signedUrlError.message);
            } else if (signedUrlData?.signedUrl) {
                const { error: dbUpdateError } = await supabaseAdmin
                    .from('orders')
                    .update({ waybill_url: signedUrlData.signedUrl })
                    .eq('order_number', order.order_number);
                if (dbUpdateError) console.error("DB Update Error:", dbUpdateError.message);
            }
        }
    }

    // --- Step 5: Return the PDF data ---
    return new Response(pdfData, {
        headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
        status: 200,
    });

  } catch (err) {
    console.error("Error in print-waybill function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});