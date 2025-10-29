// types.ts

// From Product & Cart contexts
export interface ProductVariant {
  id: string;
  product_id?: string; // From DB schema
  productId?: string; // Mapped property
  name: string;
  price: number;
  sku: string | null;
  gtin: string | null;
  weight: number; // in grams
  stock: number;
  imageUrls: string[];
  videoUrl: string | null;
  options: Record<string, string>;
  created_at?: string;
}

export interface ProductVariantOptionValue {
  value: string;
  label: string;
}

export interface ProductVariantOption {
  name: string;
  values: ProductVariantOptionValue[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  longDescription: string;
  variantOptions: ProductVariantOption[];
  imageUrls: string[];
  videoUrl: string | null;
  createdAt: string;
  variants: ProductVariant[];
}

export interface CartItem {
  cartItemId: string;
  product: { id: string; name: string; category: string };
  variant: ProductVariant;
  quantity: number;
}


// From RajaOngkir & Checkout
export interface Province {
  id: number | string;
  name: string;
}

export interface City {
  id: number | string;
  name: string;
  type?: string;
}

export interface District {
  id: number | string;
  name: string;
}

export interface Subdistrict {
  id: number | string;
  name: string;
}

export interface ShippingOption {
  code: string;
  name: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
  shipping_cost_original: number;
  shipping_cashback: number;
  service_fee: number;
  insurance_value: number;
}

export interface CustomerDetails {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    postalCode: string;
    province: { id: string, name: string };
    city: { id: string, name: string };
    district: { id: string, name: string };
    subdistrict: { id: string, name: string } | null;
}

// From Supabase & Admin
export interface OrderItem {
    quantity: number;
    price: number;
    products: {
        id: string;
        name: string;
        product_variants: {
            id: string;
            name: string;
        }
    }
}

export interface Customer {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
}

export interface FullOrder {
    id: number;
    order_number: string;
    customer_id: string;
    shipping_address_id: string;
    status: 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed';
    total_amount: number;
    subtotal_amount: number;
    shipping_amount: number;
    shipping_provider: string;
    shipping_service: string;
    created_at: string;
    customers: Customer;
    order_items: OrderItem[];
    komerce_order_no: string | null;
    awb_number: string | null;
    waybill_url: string | null;
}

export interface ContactFormData {
    name: string;
    email: string;
    subject: string;
    message: string;
}

// From Komerce
export interface KomerceOrderDetail {
    order_no: string;
    order_date: string;
    order_time: string;
    awb: string | null;
    status_name: string;
    receiver_name: string;
    receiver_phone: string;
    receiver_address: string;
    // ... add more fields as needed from the actual API response
}


// From Meta Marketing API
export interface MetaAdAccount {
    id: string;
    name: string;
}

export interface MetaCampaign {
    id: string;
    name: string;
    status: 'ACTIVE' | 'PAUSED' | string;
    objective: string;
    insights?: {
        spend: string;
        impressions: string;
        clicks: string;
        cpc: string;
        ctr: string;
    };
}
