// services/komerceService.ts

import { supabase, supabaseUrl } from './supabase';

// A helper to invoke functions using a direct fetch call for robustness.
const invokeFunction = async <T = any>(
  functionName: string,
  options: { method?: 'GET' | 'POST'; body?: object } = {}
): Promise<T> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('User not authenticated.');
  }
  
  const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

  const response = await fetch(functionUrl, {
    method: options.method || 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Edge function '${functionName}' returned a non-2xx status code.`);
  }

  return response.json();
};


export const komerceService = {
  /**
   * Submits a paid order to the Komerce shipping partner.
   * @param orderId The internal UUID of the order.
   */
  async submitOrderToShipping(orderId: string): Promise<{ success: boolean; komerceOrderNo: string }> {
    return await invokeFunction('submit-order-to-komerce', {
      body: { orderId },
    });
  },

  /**
   * Arranges a pickup for an order that has been submitted to Komerce.
   * @param orderNo The internal order number (e.g., "CB-12345").
   */
  async arrangePickup(orderNo: string): Promise<any> {
    return await invokeFunction('arrange-pickup', {
      body: { orderNo },
    });
  },

  /**
   * Gets the base64-encoded PDF for one or more shipping labels.
   * @param orderNos An array of internal order numbers (e.g., ["CB-12345"]).
   */
  async printWaybill(orderNos: string[]): Promise<{ base_64: string }> {
    return await invokeFunction('print-waybill', {
      body: { orderNos },
    });
  },
};