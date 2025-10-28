// supabase/functions/update-product/index.ts

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
    const { id, productData } = await req.json();
    if (!id || !productData) {
      throw new Error("Product 'id' and 'productData' are required.");
    }
    
    const { variants, ...productInfo } = productData;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- Step 1: Update the main product data ---
    const productToUpdate = {
      name: productInfo.name,
      category: productInfo.category,
      long_description: productInfo.longDescription,
      variant_options: productInfo.variantOptions,
      image_urls: productInfo.imageUrls,
      video_url: productInfo.videoUrl,
    };
    const { error: productError } = await supabaseAdmin
      .from('products')
      .update(productToUpdate)
      .eq('id', id);
    if (productError) throw new Error(`DB Error (Product Update): ${productError.message}`);

    // --- Step 2: Manage Variants (Delete, Update, Add) ---
    if (variants && Array.isArray(variants)) {
      // Get IDs of current variants in the DB for this product
      const { data: currentVariants, error: fetchError } = await supabaseAdmin
        .from('product_variants')
        .select('id')
        .eq('product_id', id);
      if (fetchError) throw new Error(`DB Error (Fetch Variants): ${fetchError.message}`);

      const currentVariantIds = currentVariants?.map(v => v.id) || [];
      const incomingVariantIds = variants.map(v => v.id).filter(Boolean);

      // A) Delete variants that are no longer present
      const variantsToDelete = currentVariantIds.filter(vid => !incomingVariantIds.includes(vid));
      if (variantsToDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('product_variants')
          .delete()
          .in('id', variantsToDelete);
        if (deleteError) throw new Error(`DB Error (Delete Variants): ${deleteError.message}`);
      }
      
      // B) Upsert incoming variants (updates existing, adds new)
      const variantsToUpsert = variants.map((v: any) => ({
        id: v.id || undefined, // id is undefined for new variants
        product_id: id,
        name: v.name,
        price: v.price,
        sku: v.sku || null,
        gtin: v.gtin || null,
        weight: v.weight,
        stock: v.stock,
        image_urls: v.imageUrls,
        video_url: v.videoUrl,
        options: v.options,
      }));
      
      if (variantsToUpsert.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('product_variants')
          .upsert(variantsToUpsert, { onConflict: 'id' });
        if (upsertError) throw new Error(`DB Error (Upsert Variants): ${upsertError.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, productId: id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in update-product function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
