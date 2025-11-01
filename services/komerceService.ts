// services/komerceService.ts
import { supabase, supabaseUrl } from './supabase';
import type { KomerceOrderDetail } from '../types';

const invokeFunction = async <T = any>(functionName: string, body?: object): Promise<T> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    const err: any = new Error('User not authenticated.');
    err.code = 401;
    throw err;
  }

  const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const raw = await res.text();
    try {
      const ed = JSON.parse(raw);
      const err: any = new Error(ed.error || res.statusText);
      err.code = ed.status ?? res.status;
      err.details = ed;           // includes provider info from the edge function
      throw err;
    } catch {
      const err: any = new Error(res.statusText);
      err.code = res.status;
      err.raw = raw;
      throw err;
    }
  }

  return res.json();
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

  // New explicit helper to avoid accidentally passing CB-…:
  async cancelOrderByKomerceId(komerceOrderNo: string): Promise<any> {
    return invokeFunction('cancel-order', { orderNo: komerceOrderNo });
  },
};
