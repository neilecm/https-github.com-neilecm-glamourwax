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

    // If only one order, check for cached waybill first
    if (orderNos.length === 1) {
        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('waybill_url')
            .eq('order_number', orderNos[0])
            .single();
        
        if (fetchError) throw new Error(`DB Error (Fetch Order): ${fetchError.message}`);

        if (order && order.waybill_url) {
            const response = await fetch(order.waybill_url);
            if (!response.ok) throw new Error("Failed to fetch cached waybill from storage.");
            const pdfBlob = await response.blob();
            return new Response(pdfBlob, {
                headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
                status: 200,
            });
        }
    }

    // --- Fetch Komerce order numbers for all requested internal numbers ---
    const { data: orders, error: fetchAllError } = await supabaseAdmin
        .from('orders')
        .select('order_number, komerce_order_no')
        .in('order_number', orderNos);

    if (fetchAllError) throw new Error(`DB Error (Fetch Komerce Nos): ${fetchAllError.message}`);

    const komerceOrderNos = orders?.map(o => o.komerce_order_no).filter(Boolean);
    if (!komerceOrderNos || komerceOrderNos.length === 0) {
        throw new Error("No valid Komerce order numbers found for the provided orders.");
    }
    
    // --- Call Komerce API with parameters as form-urlencoded ---
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
    
    // --- If it's a single waybill, save it to storage and update the DB ---
    if (orderNos.length === 1 && orders?.[0]) {
        const order = orders[0];
        const filePath = `${order.komerce_order_no}-${Date.now()}.pdf`;
        
        const { error: uploadError } = await supabaseAdmin.storage
            .from('waybills')
            .upload(filePath, pdfData, { contentType: 'application/pdf' });
        
        if (uploadError) {
            console.error("Storage Error:", uploadError.message);
        } else {
            const { data: { publicUrl } } = supabaseAdmin.storage.from('waybills').getPublicUrl(filePath);
            if (publicUrl) {
                const { error: dbUpdateError } = await supabaseAdmin
                    .from('orders')
                    .update({ waybill_url: publicUrl })
                    .eq('order_number', order.order_number);
                if (dbUpdateError) console.error("DB Update Error:", dbUpdateError.message);
            }
        }
    }

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