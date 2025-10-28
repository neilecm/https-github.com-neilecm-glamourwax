// services/supabaseService.ts

import { supabase } from './supabase';
import type { Product, FullOrder, ContactFormData } from '../types';

// A generic helper to standardize error handling for Supabase calls
const handleSupabaseError = (error: any, context: string) => {
  if (error) {
    console.error(`Error in ${context}:`, error.message);
    // Extract a more specific error from function invocation if possible
    const functionError = (error as any).context?.error_cause?.error;
    const errorMessage = functionError || `Database operation failed: ${context}. Please check application logs for details.`;
    throw new Error(errorMessage);
  }
};

export const supabaseService = {
  /**
   * Fetches all products with their variants from the database.
   * This is a read operation and is safe to call from the client.
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
    const products = (data || []).map(p => ({ ...p, variants: p.variants || [] }));
    
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
   * This is a read operation and is safe to call from the client.
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
   * Invokes a secure Edge Function to add a new product and its variants.
   */
  async addProduct(productData: Omit<Product, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await supabase.functions.invoke('add-product', {
      body: { productData }, // Wrap the payload to be consistent with other functions
    });
    handleSupabaseError(error, 'adding new product');
  },

  /**
   * Invokes a secure Edge Function to update an existing product and its variants.
   */
  async updateProduct(id: string, productData: Omit<Product, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await supabase.functions.invoke('update-product', {
      body: { id, productData },
    });
    handleSupabaseError(error, `updating product with id ${id}`);
  },

  /**
   * Invokes a secure Edge Function to delete a product.
   */
  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.functions.invoke('delete-product', {
      body: { id },
    });
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