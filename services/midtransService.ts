// FIX: Removed unused 'Order' type which is not exported from '../types'.
import type { CustomerDetails, CartItem } from '../types';
import { supabase } from './supabase';

interface MidtransTransactionDetails {
  order_id: string;
  gross_amount: number;
}

interface MidtransCustomerDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface MidtransPayload {
  transaction_details: MidtransTransactionDetails;
  customer_details: MidtransCustomerDetails;
}

declare global {
    interface Window {
        snap: any;
    }
}

export const midtransService = {
  createTransaction: async (
      customerDetails: CustomerDetails, 
      cartItems: CartItem[], 
      shippingCost: number, 
      subtotal: number): Promise<string> => {
    
    const orderId = `order-glamourwax-${Date.now()}`;
    const totalAmount = subtotal + shippingCost;
    
    const payload: MidtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,
      },
      customer_details: {
        first_name: customerDetails.firstName,
        last_name: customerDetails.lastName,
        email: customerDetails.email,
        phone: customerDetails.phone,
      },
    };

    console.log("Invoking Supabase function 'create-midtrans-transaction' with payload:", payload);

    const { data, error } = await supabase.functions.invoke('create-midtrans-transaction', {
        body: payload,
    });
    
    if (error) {
        console.error('Error creating Midtrans transaction:', error);
        // Try to provide a more specific error message from the function response
        const errorMessage = error.context?.error_cause?.error || `Failed to create payment transaction. Supabase function error: ${error.message}`;
        throw new Error(errorMessage);
    }
    
    if (!data?.token) {
        console.error('Supabase function did not return a Midtrans token.', data);
        throw new Error('Could not retrieve payment token. Please try again.');
    }

    console.log("Successfully received Midtrans token from Supabase function.");
    return data.token;
  },

  openPaymentGateway: (token: string, onSuccess: (result: any) => void, onPending: (result: any) => void, onError: (result: any) => void, onClose: () => void) => {
    if (!window.snap) {
        console.error('Midtrans Snap.js is not loaded.');
        onError({ status_message: 'Payment gateway is not available. Please refresh the page.'});
        return;
    }
    
    console.log("Opening Midtrans Snap with token:", token);
    
    window.snap.pay(token, {
        onSuccess: (result: any) => {
            console.log('Midtrans payment success:', result);
            onSuccess(result);
        },
        onPending: (result: any) => {
            console.log('Midtrans payment pending:', result);
            onPending(result);
        },
        onError: (result: any) => {
            console.error('Midtrans payment error:', result);
            onError(result);
        },
        onClose: () => {
            console.log('Midtrans Snap popup closed by user.');
            onClose();
        }
    });
  }
};