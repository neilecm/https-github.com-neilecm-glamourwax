// services/supabaseService.ts

import { supabase } from './supabase';
import type {
  Product,
  CustomerDetails,
  CartItem,
  ShippingOption,
  FullOrder,
  OrderStatus,
} from '../types';

export const supabaseService = {
  // Fetch all products
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      throw new Error(
        `Failed to fetch products. Supabase error: ${error.message}`
      );
    }
    return data || [];
  },

  // Fetch a single product by its ID
  async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching product with id ${id}:`, error);
      throw new Error(
        `Failed to fetch product. Supabase error: ${error.message}`
      );
    }
    return data;
  },

  // Create a new product (for Admin view)
  async addProduct(
    product: Omit<Product, 'id' | 'createdAt'>
  ): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert([product])
      .select()
      .single();

    if (error) {
      console.error('Error adding product:', error);
      throw new Error(`Failed to add product. Supabase error: ${error.message}`);
    }
    return data;
  },

  // Update an existing product (for Admin view)
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      throw new Error(
        `Failed to update product. Supabase error: ${error.message}`
      );
    }
    return data;
  },

  // Delete a product (for Admin view)
  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      throw new Error(
        `Failed to delete product. Supabase error: ${error.message}`
      );
    }
  },

  // Create an order by invoking the Supabase Edge Function
  async createOrder(
    customerDetails: CustomerDetails,
    cartItems: CartItem[],
    shippingOption: ShippingOption,
    subtotal: number,
    total: number,
    midtransResult: any
  ): Promise<any> {
    const payload = {
      customerDetails,
      cartItems,
      shippingOption,
      subtotal,
      total,
      midtransResult,
    };

    console.log("Invoking 'create-order' function with payload:", payload);
    const { data, error } = await supabase.functions.invoke('create-order', {
      body: payload,
    });

    if (error) {
      console.error('Error creating order via Supabase function:', error);
      throw new Error(
        `Failed to save order. Supabase function error: ${error.message}`
      );
    }

    console.log("Successfully invoked 'create-order' function.", data);
    return data;
  },
  
  // Fetch all orders with related data for the Admin Dashboard
  async getOrders(): Promise<FullOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        created_at,
        shipping_provider,
        shipping_service,
        customers (*),
        order_items (
          quantity,
          price,
          products (*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      throw new Error(`Failed to fetch orders. Supabase error: ${error.message}`);
    }
    // Supabase TypeScript generator might type this as an array of objects
    // with a 'customers' property that is an object, not an array. We cast it here.
    return data as FullOrder[] || [];
  },
  
  // Update the status of an order
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<FullOrder> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating order status:', error);
      throw new Error(`Failed to update order status. Supabase error: ${error.message}`);
    }
    return data as FullOrder;
  }
};
