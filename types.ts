
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  longDescription: string;
  imageUrl: string;
  category: string;
  weight: number; // in grams
  createdAt: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface CustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  province: { id: string; name: string };
  city: { id: string; name: string };
  district: { id: string; name: string };
  subdistrict: { id: string; name: string } | null; // Subdistrict can be optional
  postalCode: string;
}

export interface ShippingOption {
  name: string;
  code: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

// DEPRECATED: This was for the old, flat data structure.
// The new structure is normalized across multiple tables.
export interface Order {
  id: string;
  customer: CustomerDetails;
  items: CartItem[];
  shipping: ShippingOption;
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
}

// NEW: Type for displaying comprehensive order data in the Admin Dashboard
export interface FullOrder {
  id: string; // Order UUID
  order_number: string; // User-facing ID from Midtrans
  status: string;
  total_amount: number;
  created_at: string;
  customers: { // FIX: Renamed from 'customer' to match the table name for query clarity
    first_name: string;
    last_name: string;
    email: string;
  } | null; // Allow null in case of data inconsistency
}


// Types for Step-by-Step location fetching
export interface Province {
  id: number;
  name: string;
}

export interface City {
  id: number;
  name: string;
  zip_code: string;
}

export interface District {
  id: number;
  name: string;
  zip_code: string;
}

export interface Subdistrict {
  id: number;
  name: string;
  zip_code: string;
}