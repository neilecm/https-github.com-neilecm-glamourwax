// supabase/functions/add-product/index.ts

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const productData = await req.json();

    // --- Input Validation ---
    if (!productData || typeof productData !== 'object' || !productData.name || !productData.category) {
      throw new Error("Invalid product data provided. 'name' and 'category' are required.");
    }

    const { variants, ...productInfo } = productData;

    // --- Initialize Admin Client ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // --- Step 1: Insert the main product data ---
    const productToInsert = {
      name: productInfo.name,
      category: productInfo.category,
      long_description: productInfo.longDescription || '', // Add fallback
      variant_options: productInfo.variantOptions || [], // Add fallback
      image_urls: productInfo.imageUrls || [],
      video_url: productInfo.videoUrl || null,
    };
    
    const { data: newProduct, error: productError } = await supabaseAdmin
      .from('products')
      .insert(productToInsert)
      .select('id')
      .single();

    if (productError) throw new Error(`DB Error (Product Insert): ${productError.message}`);
    if (!newProduct) throw new Error("Failed to get ID for the newly created product.");

    // --- Step 2: Insert the product variants ---
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantsToInsert = variants.map((v: any) => ({
        product_id: newProduct.id,
        name: v.name,
        price: v.price,
        sku: v.sku || null,
        gtin: v.gtin || null,
        weight: v.weight,
        stock: v.stock,
        image_urls: v.imageUrls || [],
        video_url: v.videoUrl || null,
        options: v.options,
      }));

      const { error: variantError } = await supabaseAdmin
        .from('product_variants')
        .insert(variantsToInsert);
      
      if (variantError) throw new Error(`DB Error (Variant Insert): ${variantError.message}`);
    }

    return new Response(JSON.stringify({ success: true, productId: newProduct.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in add-product function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});