import { supabase, supabaseUrl } from './supabase';
import type { Product, FullOrder, ContactFormData, CartItem } from '../types';

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
   * Fetches the order history for the currently logged-in user.
   * This is secured by Row Level Security policies in the database.
   */
  async getUserOrders(): Promise<FullOrder[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (*),
        order_items (
          quantity,
          price,
          product_variants (
            id,
            name,
            products (id, name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`DB Error (Get User Orders): ${error.message}`);
    
    // The query now returns data that directly matches the updated FullOrder type.
    // No manual and buggy transformation is needed.
    return (data || []) as FullOrder[];
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

  // --- Cart Management ---
  async getUserCart(): Promise<CartItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_cart_items')
      .select(`
        id,
        quantity,
        variant:product_variants (
          *,
          product:products (id, name, category)
        )
      `)
      .eq('user_id', user.id);

    if (error) throw new Error(`DB Error (Get Cart): ${error.message}`);
    if (!data) return [];

    return data.map((item: any) => ({
      cartItemId: item.id,
      product: item.variant.product,
      variant: { ...item.variant, productId: item.variant.product.id, imageUrls: item.variant.image_urls, videoUrl: item.variant.video_url },
      quantity: item.quantity,
    }));
  },

  async addUserCartItem(variantId: string, quantity: number): Promise<void> {
    const { error } = await supabase.rpc('add_to_cart', {
      p_variant_id: variantId,
      p_quantity: quantity,
    });
    if (error) throw new Error(`DB Error (Add to Cart): ${error.message}`);
  },

  async updateUserCartItemQuantity(cartItemId: string, quantity: number): Promise<void> {
    const { error } = await supabase
      .from('user_cart_items')
      .update({ quantity })
      .eq('id', cartItemId);
    if (error) throw new Error(`DB Error (Update Cart Quantity): ${error.message}`);
  },

  async removeUserCartItem(cartItemId: string): Promise<void> {
    const { error } = await supabase
      .from('user_cart_items')
      .delete()
      .eq('id', cartItemId);
    if (error) throw new Error(`DB Error (Remove From Cart): ${error.message}`);
  },

  async clearUserCart(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_cart_items')
      .delete()
      .eq('user_id', user.id);
    if (error) throw new Error(`DB Error (Clear Cart): ${error.message}`);
  },

  // --- Wishlist Management ---
  async getUserWishlist(): Promise<Product[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_wishlist_items')
      .select('products(*, variants:product_variants(*))')
      .eq('user_id', user.id);

    if (error) throw new Error(`DB Error (Get Wishlist): ${error.message}`);
    if (!data) return [];
    
    return data.map((item: any) => ({
      ...item.products,
      variants: item.products.variants || [],
      longDescription: item.products.long_description,
      variantOptions: item.products.variant_options,
      imageUrls: item.products.image_urls,
      videoUrl: item.products.video_url,
      createdAt: item.products.created_at
    }));
  },

  async addUserWishlistItem(productId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated.");

    const { error } = await supabase
      .from('user_wishlist_items')
      .insert({ user_id: user.id, product_id: productId });
    
    if (error && error.code !== '23505') { // Ignore unique constraint violation
      throw new Error(`DB Error (Add to Wishlist): ${error.message}`);
    }
  },

  async removeUserWishlistItem(productId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated.");

    const { error } = await supabase
      .from('user_wishlist_items')
      .delete()
      .match({ user_id: user.id, product_id: productId });
    if (error) throw new Error(`DB Error (Remove from Wishlist): ${error.message}`);
  },
};