// services/komerceService.ts
import { supabase, supabaseUrl } from './supabase';
import type { KomerceOrderDetail } from '../types';

// This is a robust helper that uses a direct fetch call.
// It provides better error handling than the standard supabase.functions.invoke().
const invokeFunction = async <T = any>(functionName: string, body?: object): Promise<T> => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
        throw new Error('User not authenticated.');
    }
    
    const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        // Try to parse a more specific error from the function's JSON response
        try {
            const errorData = await response.json();
            throw new Error(errorData.error || `Edge function '${functionName}' returned status ${response.status}.`);
        } catch (e) {
            // If the response isn't JSON, fall back to the status text
            throw new Error(`Edge function '${functionName}' returned an error: ${response.statusText}`);
        }
    }
    return response.json();
};

export const komerceService = {
  /**
   * Submits a confirmed order to the Komerce system to get a Komerce order number.
   * This changes the order status to 'processing'.
   */
  async submitOrderToKomerce(orderId: number): Promise<{ komerceOrderNo: string }> {
    return invokeFunction('submit-order-to-komerce', { orderId });
  },

  /**
   * Requests a pickup for one or more orders that have been submitted to Komerce.
   * This changes the order status to 'shipped' and adds an AWB number.
   */
  async arrangePickup(details: { orderNos: string[]; pickupDate: string; pickupTime: string; pickupVehicle: string; }): Promise<any> {
    return invokeFunction('arrange-pickup', details);
  },

  /**
   * Fetches the waybill (shipping label) for an order from Komerce.
   * This is a special case that uses fetch directly to handle a PDF blob response.
   */
  async printWaybill(orderNos: string[]): Promise<Blob> {
      const functionName = 'print-waybill';
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
          throw new Error('User not authenticated for waybill printing.');
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

      const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderNos }),
      });

      if (!response.ok) {
          try {
              const errorData = await response.json();
              throw new Error(errorData.error || `Failed to invoke 'print-waybill'.`);
          } catch(e) {
               throw new Error(`Failed to invoke 'print-waybill': ${response.statusText}`);
          }
      }
      
      return response.blob();
  },

  /**
   * Fetches the latest details of an order from the Komerce system using the internal order number.
   */
  async getKomerceOrderDetails(orderNo: string): Promise<KomerceOrderDetail> {
    return invokeFunction('get-komerce-order-details', { orderNo });
  },
  
  /**
   * Cancels an order by calling the single, consolidated 'cancel-order' function.
   */
  async cancelOrder(orderNo: string): Promise<any> {
    return invokeFunction('cancel-order', { orderNo });
  },
};
