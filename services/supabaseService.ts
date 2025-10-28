import { supabase, supabaseUrl } from './supabase';
import type { Product, FullOrder, ContactFormData } from '../types';

// A new, robust helper to invoke functions using a direct fetch call.
// This avoids the silent failures sometimes seen with supabase.functions.invoke().
const invokeFunction = async <T = any>(
  functionName: string,
  options: { method?: 'GET' | 'POST'; body?: object } = {}
): Promise<T> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('User not authenticated.');
  }
  
  const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

  const response = await fetch(functionUrl, {
    method: options.method || 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Edge function '${functionName}' returned a non-2xx status code.`);
  }

  return response.json();
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

    if (error) throw new Error(`Database operation failed: fetching products. ${error.message}`);
    
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

    if (error) throw new Error(`Database operation failed: fetching product with id ${id}. ${error.message}`);

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
    await invokeFunction('add-product', {
      body: productData,
    });
  },

  /**
   * Invokes a secure Edge Function to update an existing product and its variants.
   */
  async updateProduct(id: string, productData: Omit<Product, 'id' | 'createdAt'>): Promise<void> {
    await invokeFunction('update-product', {
      body: { id, productData },
    });
  },

  /**
   * Invokes a secure Edge Function to delete a product.
   */
  async deleteProduct(id: string): Promise<void> {
    await invokeFunction('delete-product', {
      body: { id },
    });
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

    if (uploadError) throw new Error(`Database operation failed: uploading product media. ${uploadError.message}`);

    const { data } = supabase.storage.from('product_media').getPublicUrl(filePath);
    return data.publicUrl;
  },

  /**
   * Fetches all orders with detailed information by invoking a secure Edge Function.
   */
  async getOrders(): Promise<FullOrder[]> {
    return await invokeFunction<FullOrder[]>('get-orders', { method: 'GET' });
  },

  /**
   * Manually checks an order's status with Midtrans via a secure Edge Function.
   */
  async checkOrderStatus(orderNumber: string): Promise<{ status: string }> {
    return await invokeFunction('check-midtrans-status', {
      body: { orderNumber },
    });
  },

  /**
   * Invokes the 'send-contact-email' edge function.
   */
  async sendContactMessage(formData: ContactFormData): Promise<void> {
    await invokeFunction('send-contact-email', {
      body: formData,
    });
  },
};