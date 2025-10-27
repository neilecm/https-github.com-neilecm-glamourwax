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

export interface Order {
  id: string;
  customer_details: CustomerDetails;
  order_items: CartItem[];
  shipping_details: ShippingOption;
  subtotal: number;
  total_amount: number;
  midtrans_response: any;
  created_at: string;
}
