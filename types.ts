// types.ts

// --- Navigation Types ---

// Define the different views the app can have
export enum View {
  HOME,
  PRODUCT_DETAIL,
  CART,
  CHECKOUT,
  ORDER_SUCCESS,
  ORDER_PENDING,
  ORDER_FAILED,
  AUTH,
  ADMIN,
  ACCOUNT,
  WISHLIST,
  CONTACT,
  TUTORIAL,
  ABOUT_US,
  REVIEWS,
}

// Define the shape of the view state
export type AppView =
  | { name: View.HOME }
  | { name: View.PRODUCT_DETAIL; product: Product }
  | { name: View.CART }
  | { name: View.CHECKOUT }
  | { name: View.ORDER_SUCCESS; orderId: string }
  | { name: View.ORDER_PENDING; orderId: string }
  | { name: View.ORDER_FAILED; message: string }
  | { name: View.AUTH }
  | { name: View.ADMIN }
  | { name: View.ACCOUNT }
  | { name: View.WISHLIST }
  | { name: View.CONTACT }
  | { name: View.TUTORIAL }
  | { name: View.ABOUT_US }
  | { name: View.REVIEWS };

// --- End Navigation Types ---


export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  price: number;
  sku: string | null;
  gtin: string | null;
  weight: number; // in grams
  stock: number;
  imageUrls: string[];
  videoUrl: string | null;
  options: Record<string, string>;
}

export interface ProductVariantOptionValue {
    value: string;
    label?: string; // e.g., for color swatches
}
  
export interface ProductVariantOption {
    name: string; // e.g., "Size", "Color"
    values: ProductVariantOptionValue[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  longDescription: string;
  imageUrls: string[];
  videoUrl: string | null;
  variants: ProductVariant[];
  variantOptions: ProductVariantOption[];
  createdAt: string;
}

export interface CartItem {
  cartItemId: string;
  product: {
    id: string;
    name: string;
    category: string;
  };
  variant: ProductVariant;
  quantity: number;
}

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// RajaOngkir / Komerce Location Types
export interface Province {
  id: string;
  name: string;
}

export interface City {
  id: string;
  name: string;
  type?: string;
}

export interface District {
  id: string;
  name: string;
}

export interface Subdistrict {
  id: string;
  name: string;
}

export interface ShippingOption {
    code: string;
    name: string;
    service: string;
    description: string;
    cost: number;
    etd: string;
    shipping_cost_original?: number;
    shipping_cashback?: number;
    service_fee?: number;
    insurance_value: number;
    vehicle_type?: string;
}

export interface CustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  province: { id: string; name: string; };
  city: { id: string; name: string; };
  district: { id: string; name: string; };
  subdistrict: { id: string; name: string; } | null;
}

// Order Types
export interface OrderItem {
    quantity: number;
    price: number;
    product_variants: {
        id: string;
        name: string;
        products: {
            id: string;
            name: string;
        }
    }
}

export interface FullOrder {
    id: number;
    created_at: string;
    order_number: string;
    customer_id: string;
    shipping_address_id: number;
    status: 'pending_payment' | 'paid' | 'processing' | 'label_created' | 'shipped' | 'delivered' | 'cancelled' | 'failed';
    total_amount: number;
    subtotal_amount: number;
    shipping_amount: number;
    shipping_provider: string;
    shipping_service: string;
    shipping_vehicle: string | null;
    komerce_order_no: string | null;
    awb_number: string | null;
    waybill_url: string | null;
    shipping_cost_original: number | null;
    shipping_cashback: number | null;
    service_fee: number | null;
    insurance_amount: number | null;
    customers: {
        id: string;
        created_at: string;
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
    };
    order_items: OrderItem[];
}

export interface KomerceOrderDetail {
  order_no: string;
  awb: string | null;
  order_status: string;
  order_date: string;
  brand_name: string;
  shipper_name: string;
  shipper_phone: string;
  shipper_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  shipping: string;
  shipping_type: string;
  payment_method: string;
  shipping_cost: number;
  shipping_cashback: number;
  service_fee: number;
  additional_cost: number;
  grand_total: number;
  insurance_value: number;
  live_tracking_url: string | null;
  order_details: {
    product_name: string;
    product_variant_name: string;
    qty: number;
    subtotal: number;
  }[];
}


// Meta Marketing API Types
export interface MetaAdAccount {
    id: string;
    name: string;
}

export interface MetaCampaignInsights {
    spend: string;
    impressions: string;
    clicks: string;
    cpc?: string;
    ctr?: string;
}

export interface MetaCampaign {
    id: string;
    name: string;
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    objective: string;
    insights: MetaCampaignInsights | null;
}

export interface Profile {
  full_name: string | null;
  phone_number: string | null;
  role: string | null;
  email: string | null;
}