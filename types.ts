// types.ts

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string;
  longDescription: string;
  weight: number; // in grams
  createdAt?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Location {
  id: string | number;
  name: string;
}

export interface Province extends Location {}
export interface City extends Location {}
export interface District extends Location {}
export interface Subdistrict extends Location {}

export interface ShippingOption {
  code: string;
  name: string;
  service: string;
  description: string;
  cost: number;
  etd: string; // Estimated time of delivery
}

export interface CustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  province: { id: string; name: string };
  city: { id: string; name: string };
  district: { id: string; name: string };
  subdistrict: { id: string; name: string } | null;
}

// Detailed types for fetching from the database for the Admin Panel
export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface OrderItemWithProduct {
  quantity: number;
  price: number;
  products: Product | null;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'failed' | 'delivered';

export interface FullOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  shipping_provider: string;
  shipping_service: string;
  awb_number: string | null; // Added for Komerce AWB
  customers: Customer | null;
  order_items: OrderItemWithProduct[];
}

// Meta Marketing API Types
export interface MetaAdAccount {
  id: string;
  name: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  objective: string;
  insights?: MetaCampaignInsights; // Optional, to be merged later
}

export interface MetaCampaignInsights {
  spend: string;
  impressions: string;
  clicks: string;
  cpc: string; // Cost per click
  ctr: string; // Click-through rate
}
