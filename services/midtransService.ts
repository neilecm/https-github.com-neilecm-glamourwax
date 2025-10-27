
import type { Order, CustomerDetails, CartItem } from '../types';

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

    console.log("Mock Midtrans: Creating transaction with payload:", payload);

    // In a real app, you'd send this payload to your backend, which then communicates with Midtrans.
    // The backend would return a transaction token.
    // Here, we'll just simulate that token.
    const mockTransactionToken = `mock-token-${orderId}`;
    
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(mockTransactionToken);
        }, 500);
    });
  },

  openPaymentGateway: (token: string, onSuccess: () => void, onPending: () => void, onError: () => void, onClose: () => void) => {
    // This function will simulate the Snap popup.
    // It doesn't use the token since we are not connecting to Midtrans.
    console.log("Simulating Midtrans Snap popup...");

    // In a real app, you would call window.snap.pay()
    // window.snap.pay(token, { onSuccess, onPending, onError, onClose });
    
    // For this mock, we'll use a timeout to simulate the user taking action on the popup.
    // We will simulate a success after a few seconds.
    setTimeout(() => {
        console.log("Simulating successful payment.");
        onSuccess();
    }, 3000); 
  }
};
