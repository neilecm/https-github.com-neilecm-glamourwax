// FIX: Removed unused 'Order' type which is not exported from '../types'.
import type { CustomerDetails, CartItem, ShippingOption } from '../types';
import { supabase } from './supabase';

declare global {
    interface Window {
        snap: any;
    }
}

export const midtransService = {
  createTransaction: async (
      customerDetails: CustomerDetails, 
      cartItems: CartItem[], 
      shippingOption: ShippingOption
  ): Promise<{ token: string, orderId: string }> => {
    
    const subtotal = cartItems.reduce((acc, item) => acc + item.variant.price * item.quantity, 0);
    const total = subtotal + shippingOption.cost;
    
    const payload = {
      customerDetails,
      cartItems,
      shippingOption,
      subtotal,
      total,
    };

    console.log("Invoking 'create-midtrans-transaction' function to create pending order and get token:", payload);

    const { data, error } = await supabase.functions.invoke('create-midtrans-transaction', {
        body: payload,
    });
    
    if (error) {
        console.error('Error creating Midtrans transaction:', error);
        const errorMessage = error.context?.error_cause?.error || `Failed to create payment transaction. Supabase function error: ${error.message}`;
        throw new Error(errorMessage);
    }
    
    if (!data?.token || !data?.orderId) {
        console.error('Supabase function did not return a Midtrans token or Order ID.', data);
        throw new Error('Could not retrieve payment token. Please try again.');
    }

    console.log("Successfully received Midtrans token and Order ID from Supabase function.");
    return { token: data.token, orderId: data.orderId };
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