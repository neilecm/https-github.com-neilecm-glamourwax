// services/komerceService.ts
import { supabase } from './supabase';
import type { KomerceOrderDetail } from '../types';

const invokeFunction = async <T = any>(functionName: string, body?: object): Promise<T> => {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) {
        const errorMessage = error.context?.error_cause?.error || `Function '${functionName}' failed: ${error.message}`;
        throw new Error(errorMessage);
    }
    return data;
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
   * Requests a pickup for an order that has been submitted to Komerce.
   * This changes the order status to 'shipped' and adds an AWB number.
   */
  async arrangePickup(orderNo: string): Promise<any> {
    return invokeFunction('arrange-pickup', { orderNo });
  },

  /**
   * Fetches the waybill (shipping label) for an order from Komerce.
   * Now accepts an array of order numbers for bulk printing.
   * The function returns the raw PDF blob.
   */
  async printWaybill(orderNos: string[]): Promise<Blob> {
      const { data, error } = await supabase.functions.invoke('print-waybill', {
        body: { orderNos },
        responseType: 'blob'
      });

      if (error) {
          const errorMessage = error.context?.error_cause?.error || `Failed to invoke 'print-waybill': ${error.message}`;
          throw new Error(errorMessage);
      }
      
      return data;
  },

  /**
   * Fetches the latest details of an order from the Komerce system using the internal order number.
   */
  async getKomerceOrderDetails(orderNo: string): Promise<KomerceOrderDetail> {
    return invokeFunction('get-komerce-order-details', { orderNo });
  },
};