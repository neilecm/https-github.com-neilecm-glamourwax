// services/supabaseService.ts

import { supabase } from './supabase';
import type { Product, FullOrder, ContactFormData, ProductVariant } from '../types';

// A generic helper to standardize error handling for Supabase calls
const handleSupabaseError = (error: any, context: string) => {
  if (error) {
    console.error(`Error in ${context}:`, error.message);
    // Provide a more user-friendly error message
    throw new Error(`Database operation failed: ${context}. Please check application logs for details.`);
  }
};

export const supabaseService = {
  /**
   * Fetches all products with their variants from the database.
   */
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants (
          *
        )
      `)
      .order('created_at', { ascending: false });

    handleSupabaseError(error, 'fetching products');
    // Ensure variants is always an array
    const products = (data || []).map(p => ({ ...p, variants: p.variants || [] }));
    
    // Map snake_case from DB to camelCase for the app
    return products.map(p => ({
      ...p,
      longDescription: p.long_description,
      variantOptions: p.variant_options,
      imageUrls: p.image_urls,
      videoUrl: p.video_url,
      createdAt: p.created_at,
      variants: p.variants.map((v: any) => ({
        ...v,
        productId: v.product_id,
        imageUrls: v.image_urls,
        videoUrl: v.video_url,
      }))
    }));
  },

  /**
   * Fetches a single product by its ID, including its variants.
   */
  async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants (
          *
        )
      `)
      .eq('id', id)
      .single();

    handleSupabaseError(error, `fetching product with id ${id}`);
    if (data) {
        const p = { ...data, variants: data.variants || [] };
        // Map snake_case to camelCase
        return {
          ...p,
          longDescription: p.long_description,
          variantOptions: p.variant_options,
          imageUrls: p.image_urls,
          videoUrl: p.video_url,
          createdAt: p.created_at,
          variants: p.variants.map((v: any) => ({
            ...v,
            productId: v.product_id,
            imageUrls: v.image_urls,
            videoUrl: v.video_url,
          }))
        };
    }
    return null;
  },

  /**
   * Adds a new product and its associated variants to the database.
   */
  async addProduct(productData: Omit<Product, 'id' | 'createdAt'>): Promise<void> {
    const { variants, ...productInfo } = productData;

    // Map camelCase from app to snake_case for DB
    const productToInsert = {
        name: productInfo.name,
        category: productInfo.category,
        long_description: productInfo.longDescription,
        variant_options: productInfo.variantOptions,
        image_urls: productInfo.imageUrls,
        video_url: productInfo.videoUrl,
    };

    const { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert(productToInsert)
      .select('id')
      .single();

    handleSupabaseError(productError, 'adding new product');
    if (!newProduct) throw new Error('Failed to get ID for new product.');

    if (variants && variants.length > 0) {
      const variantsToInsert = variants.map(v => ({
        ...v,
        product_id: newProduct.id,
        image_urls: v.imageUrls,
        video_url: v.videoUrl
      }));
      const { error: variantError } = await supabase
        .from('product_variants')
        .insert(variantsToInsert);
      
      handleSupabaseError(variantError, 'adding product variants');
    }
  },

  /**
   * Updates an existing product and its variants.
   */
  async updateProduct(id: string, productData: Omit<Product, 'id' | 'createdAt'>): Promise<void> {
    const { variants, ...productInfo } = productData;

    const productToUpdate = {
        name: productInfo.name,
        category: productInfo.category,
        long_description: productInfo.longDescription,
        variant_options: productInfo.variantOptions,
        image_urls: productInfo.imageUrls,
        video_url: productInfo.videoUrl,
    };

    const { error: productError } = await supabase
      .from('products')
      .update(productToUpdate)
      .eq('id', id);
    handleSupabaseError(productError, `updating product with id ${id}`);

    if (variants) {
      const { data: currentVariants, error: fetchError } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', id);
      handleSupabaseError(fetchError, 'fetching current variants for update');

      const currentVariantIds = currentVariants?.map(v => v.id) || [];
      const incomingVariantIds = variants.map(v => v.id).filter(Boolean);

      const variantsToDelete = currentVariantIds.filter(vid => !incomingVariantIds.includes(vid));
      if (variantsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('product_variants')
          .delete()
          .in('id', variantsToDelete);
        handleSupabaseError(deleteError, 'deleting old product variants');
      }
      
      const variantsToUpsert = variants.map(v => ({
        ...v,
        product_id: id,
        id: v.id || undefined, 
        image_urls: v.imageUrls,
        video_url: v.videoUrl
      }));
      
      if (variantsToUpsert.length > 0) {
          const { error: upsertError } = await supabase
            .from('product_variants')
            .upsert(variantsToUpsert, { onConflict: 'id' });
          handleSupabaseError(upsertError, 'upserting product variants');
      }
    }
  },

  /**
   * Deletes a product from the database.
   */
  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('id', id);
    handleSupabaseError(error, `deleting product with id ${id}`);
  },

  /**
   * Uploads a media file (image/video) to Supabase Storage.
   */
  async uploadProductMedia(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product_media')
      .upload(filePath, file);

    handleSupabaseError(uploadError, 'uploading product media');

    const { data } = supabase.storage.from('product_media').getPublicUrl(filePath);
    return data.publicUrl;
  },

  /**
   * Fetches all orders with detailed information about customers and items.
   */
  async getOrders(): Promise<FullOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (*),
        order_items (
          quantity,
          price,
          product_variants (
            id, name,
            products (id, name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    handleSupabaseError(error, 'fetching orders');
    if (!data) return [];
    
    // Transform the data to match the FullOrder type expected by the frontend
    const transformedData = data.map(order => ({
      ...order,
      order_items: order.order_items.map((item: any) => ({
          quantity: item.quantity,
          price: item.price,
          products: item.product_variants && item.product_variants.products ? {
            id: item.product_variants.products.id,
            name: item.product_variants.products.name,
            product_variants: {
              id: item.product_variants.id,
              name: item.product_variants.name,
            },
          } : null,
      })),
    }));

    return transformedData as FullOrder[];
  },

  /**
   * Invokes the 'send-contact-email' edge function.
   */
  async sendContactMessage(formData: ContactFormData): Promise<void> {
    const { error } = await supabase.functions.invoke('send-contact-email', {
      body: formData,
    });
    
    if (error) {
        console.error('Error from send-contact-email function:', error);
        const errorMessage = (error as any).context?.error_cause?.error 
            || `Failed to send message. Supabase function error: ${error.message}`;
        throw new Error(errorMessage);
    }
  },
};