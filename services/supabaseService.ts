import { supabase } from './supabase';
import type { Product, CartItem, CustomerDetails, ShippingOption, FullOrder } from '../types';

// Helper to convert database snake_case to application camelCase
const fromSupabase = (dbProduct: any): Product => ({
  id: dbProduct.id,
  name: dbProduct.name,
  price: dbProduct.price,
  description: dbProduct.description,
  longDescription: dbProduct.long_description,
  imageUrl: dbProduct.image_url,
  category: dbProduct.category,
  weight: dbProduct.weight,
  createdAt: dbProduct.created_at,
});

// Helper to convert application camelCase to database snake_case
const toSupabase = (product: Partial<Omit<Product, 'id' | 'createdAt'>>) => ({
  name: product.name,
  price: product.price,
  description: product.description,
  long_description: product.longDescription,
  image_url: product.imageUrl,
  category: product.category,
  weight: product.weight,
});


export const supabaseService = {
  getProducts: async (): Promise<Product[]> => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error.message, error);
      throw new Error(`Failed to fetch products. Supabase error: ${error.message}. Please check your Supabase credentials and RLS policies.`);
    }
    return data.map(fromSupabase);
  },

  getProductById: async (id: string): Promise<Product | null> => {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();

    if (error) {
      console.error(`Error fetching product ${id}:`, error.message, error);
      return null;
    }
    return fromSupabase(data);
  },
  
  uploadImage: async (file: File): Promise<string> => {
    const fileName = `${Date.now()}-${file.name.replace(/\s/g, '-')}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file);

    if (uploadError) {
        console.error('Error uploading image:', uploadError.message, uploadError);
        throw new Error(`Failed to upload image. Supabase error: ${uploadError.message}. Check your storage bucket RLS policies.`);
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
    
    if (!data.publicUrl) {
        throw new Error('Could not get public URL for the uploaded image.');
    }

    return data.publicUrl;
  },
  
  insertProduct: async (productData: Omit<Product, 'id' | 'createdAt'>): Promise<Product> => {
    const { data, error } = await supabase
        .from('products')
        .insert([toSupabase(productData)])
        .select()
        .single();
    
    if (error) {
        console.error('Error inserting product:', error.message, error);
        throw new Error(`Failed to add product. Supabase error: ${error.message}. Check your RLS policies for the 'products' table.`);
    }
    
    return fromSupabase(data);
  },

  createOrder: async (
      customerDetails: CustomerDetails, 
      cartItems: CartItem[], 
      shippingOption: ShippingOption,
      subtotal: number, 
      total: number,
      midtransResult: any,
    ): Promise<{ orderId: string }> => {
    
    console.log("Invoking 'create-order' Supabase function...");
    const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
            customerDetails,
            cartItems,
            shippingOption,
            subtotal,
            total,
            midtransResult
        },
    });
    
    if (error) {
        console.error('Error creating order via function:', error);
        throw new Error(`Failed to save order. Supabase function error: ${error.message}.`);
    }

    console.log("Order creation function returned:", data);
    return data;
  },

  getOrders: async (): Promise<FullOrder[]> => {
    // FIX: The query is updated to use the table name 'customers' as the key for the joined data.
    // This removes ambiguity and helps Supabase's query builder correctly
    // identify and use the foreign key relationship defined in the database.
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        created_at,
        customers!customer_id (
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      throw new Error(`Failed to fetch orders. Supabase error: ${error.message}`);
    }

    return data as FullOrder[];
  },
};