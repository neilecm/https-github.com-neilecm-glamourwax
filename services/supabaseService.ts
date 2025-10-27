// services/supabaseService.ts

import { supabase } from './supabase';
import type {
  Product,
  CustomerDetails,
  CartItem,
  ShippingOption,
  FullOrder,
  OrderStatus,
  ProductVariant,
  ContactFormData,
} from '../types';

// Type for product data before it's inserted (no ID or createdAt)
type NewProductPayload = Omit<Product, 'id' | 'createdAt' | 'variants'> & {
  variants: Omit<ProductVariant, 'id' | 'productId'>[];
};
// Type for product data when updating (all fields are partial)
type UpdateProductPayload = Partial<Omit<Product, 'id' | 'createdAt' | 'variants'>> & {
  variants?: (Partial<ProductVariant> & { id?: string })[]; // Variants can be new or existing
};


export const supabaseService = {
  // Fetch all products with their variants
  async getProducts(): Promise<Product[]> {
    // Step 1: Fetch all products without trying to join variants.
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw new Error(
        `Failed to fetch products. Supabase error: ${productsError.message}`
      );
    }
    if (!products || products.length === 0) {
        return [];
    }

    // Step 2: Fetch all variants for the retrieved products.
    const productIds = products.map(p => p.id);
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('*')
      .in('productId', productIds);

    if (variantsError) {
      console.error('Error fetching variants:', variantsError);
      throw new Error(`Failed to fetch variants. Supabase error: ${variantsError.message}`);
    }

    // Step 3: Manually map variants to their parent products.
    const variantsByProductId = (variants || []).reduce((acc, variant) => {
        if (!acc[variant.productId]) {
            acc[variant.productId] = [];
        }
        acc[variant.productId].push(variant as ProductVariant);
        return acc;
    }, {} as Record<string, ProductVariant[]>);

    const productsWithVariants = products.map(product => {
        const productVariants = variantsByProductId[product.id] || [];
        return {
            ...product,
            variants: productVariants,
            // Hoist the first variant's media to be the main product media.
            imageUrls: productVariants[0]?.imageUrls || [],
            videoUrl: productVariants[0]?.videoUrl || null,
        };
    });

    return productsWithVariants;
  },

  // Fetch a single product by its ID with its variants
  async getProductById(id: string): Promise<Product | null> {
    // Step 1: Fetch the main product data.
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (productError) {
      // If no product is found, Supabase returns an error. We should return null.
      if (productError.code === 'PGRST116') { 
        return null;
      }
      console.error(`Error fetching product with id ${id}:`, productError);
      throw new Error(
        `Failed to fetch product. Supabase error: ${productError.message}`
      );
    }
    
    if (!product) {
        return null;
    }

    // Step 2: Fetch the variants for that specific product.
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('*')
      .eq('productId', id);
    
    if (variantsError) {
        console.error(`Error fetching variants for product ${id}:`, variantsError);
        throw new Error(`Failed to fetch variants. Supabase error: ${variantsError.message}`);
    }

    // Step 3: Combine them into a single Product object.
    const fetchedVariants = (variants || []) as ProductVariant[];
    return {
        ...product,
        variants: fetchedVariants,
        // The main product media are considered to be the media of the first variant.
        imageUrls: fetchedVariants[0]?.imageUrls || [],
        videoUrl: fetchedVariants[0]?.videoUrl || null,
    };
  },

  // Create a new product and its variants
  async addProduct(payload: NewProductPayload): Promise<Product> {
    // 1. Separate media URLs from the main product data to prevent inserting into the wrong table.
    const { variants, imageUrls, videoUrl, ...productData } = payload as any;

    const { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (productError) {
      console.error('Error adding product:', productError);
      throw new Error(`Failed to add product. Supabase error: ${productError.message}`);
    }

    // 2. Prepare and insert the variants, assigning the main media to the first variant.
    if (variants && variants.length > 0) {
      if (imageUrls) {
        variants[0].imageUrls = imageUrls;
      }
      if (videoUrl) {
        variants[0].videoUrl = videoUrl;
      }
      const variantsToInsert = variants.map(variant => ({
        ...variant,
        productId: newProduct.id,
      }));

      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantsToInsert);
      
      if (variantsError) {
        console.error('Error adding product variants:', variantsError);
        // Attempt to roll back product creation for consistency
        await supabase.from('products').delete().eq('id', newProduct.id);
        throw new Error(`Product creation failed while adding variants (rolled back). Supabase error: ${variantsError.message}`);
      }
    }
    
    return (await supabaseService.getProductById(newProduct.id)) as Product;
  },

  // Update an existing product and its variants
  async updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
    // 1. Separate media URLs from the main product data to avoid updating a non-existent column.
    const { variants, imageUrls, videoUrl, ...productData } = payload as any;
    
    const { data: updatedProduct, error: productError } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id)
      .select()
      .single();

    if (productError) {
      console.error('Error updating product:', productError);
      throw new Error(`Failed to update product. Supabase error: ${productError.message}`);
    }
    
    // 2. Manage variants, assigning main media to the first variant if they exist.
    if (variants) {
        if (imageUrls && variants.length > 0) {
            variants[0].imageUrls = imageUrls;
        }
        if (videoUrl && variants.length > 0) {
            variants[0].videoUrl = videoUrl;
        }


        const variantsToUpdate = variants.filter(v => v.id);
        const variantsToAdd = variants.filter(v => !v.id).map(v => ({ ...v, productId: id }));

        const { data: existingVariants } = await supabase.from('product_variants').select('id').eq('productId', id);
        const existingVariantIds = existingVariants?.map(v => v.id) || [];
        const newVariantIds = variantsToUpdate.map(v => v.id).filter(Boolean) as string[];
        const variantsToDelete = existingVariantIds.filter(vid => !newVariantIds.includes(vid));

        const [updateResult, addResult, deleteResult] = await Promise.all([
            variantsToUpdate.length > 0 ? supabase.from('product_variants').upsert(variantsToUpdate) : Promise.resolve({ error: null }),
            variantsToAdd.length > 0 ? supabase.from('product_variants').insert(variantsToAdd) : Promise.resolve({ error: null }),
            variantsToDelete.length > 0 ? supabase.from('product_variants').delete().in('id', variantsToDelete) : Promise.resolve({ error: null }),
        ]);
        
        const anyError = updateResult.error || addResult.error || deleteResult.error;
        if (anyError) {
             console.error('Error managing variants:', anyError);
             throw new Error(`Product updated, but failed to sync variants. Error: ${anyError.message}`);
        }
    }
    
    return (await supabaseService.getProductById(updatedProduct.id)) as Product;
  },

  // Delete a product and its variants
  async deleteProduct(id: string): Promise<void> {
    // Manually delete variants first since there is no guaranteed FK cascade.
    const { error: variantError } = await supabase
        .from('product_variants')
        .delete()
        .eq('productId', id);

    if (variantError) {
      console.error('Error deleting product variants:', variantError);
      throw new Error(
        `Failed to delete product variants. Supabase error: ${variantError.message}`
      );
    }
    
    const { error: productError } = await supabase.from('products').delete().eq('id', id);

    if (productError) {
      console.error('Error deleting product:', productError);
      throw new Error(
        `Failed to delete product. Supabase error: ${productError.message}`
      );
    }
  },

  // Upload a file to the 'product-images' storage bucket.
  async uploadProductMedia(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw new Error(`Failed to upload file. Supabase error: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error("Could not get public URL for the uploaded file.");
    }

    return data.publicUrl;
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
        awb_number,
        customers (*),
        order_items (
          quantity,
          price,
          products (id, name),
          product_variants (id, name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      throw new Error(`Failed to fetch orders. Supabase error: ${error.message}`);
    }
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
  },

  // Send a contact form message
  async sendContactMessage(formData: ContactFormData): Promise<{ success: boolean }> {
    const { data, error } = await supabase.functions.invoke('send-contact-email', {
      body: formData,
    });

    if (error) {
      console.error('Error sending contact message:', error);
      // Attempt to get a more specific error from the function's response
      const errorMessage = error.context?.error_cause?.error || `Failed to send message. Supabase function error: ${error.message}`;
      throw new Error(errorMessage);
    }

    return data;
  },
};