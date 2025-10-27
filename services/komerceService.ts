// services/komerceService.ts

import { supabase } from './supabase';

export const komerceService = {
  /**
   * Invokes a Supabase function to arrange a pickup for a specific order via the Komerce API.
   * @param orderNo The unique order number (e.g., "KOM-...") for which to arrange pickup.
   * @returns A promise that resolves with the pickup arrangement result, including the AWB.
   */
  async arrangePickup(orderNo: string): Promise<{ status: string; order_no: string; awb: string }> {
    console.log(`Invoking 'arrange-pickup' function for order: ${orderNo}`);
    const { data, error } = await supabase.functions.invoke('arrange-pickup', {
      body: { orderNo },
    });

    if (error) {
      console.error('Error arranging pickup via Supabase function:', error);
      throw new Error(`Failed to arrange pickup. Supabase function error: ${error.message}`);
    }
    
    // The Komerce API returns an array, we expect one result for our single order.
    if (!data || !data[0] || data[0].status !== 'success') {
        console.error('Komerce API failed to arrange pickup:', data);
        throw new Error(data[0]?.message || 'Failed to arrange pickup. Please check the order details.');
    }

    console.log("Successfully arranged pickup:", data[0]);
    return data[0];
  },

  /**
   * Invokes a Supabase function to get a printable waybill (shipping label) for an order.
   * @param orderNo The unique order number for which to print the waybill.
   * @returns A promise that resolves with the base64 encoded PDF data for the label.
   */
  async printWaybill(orderNo: string): Promise<{ base64: string }> {
    console.log(`Invoking 'print-waybill' function for order: ${orderNo}`);
    const { data, error } = await supabase.functions.invoke('print-waybill', {
      body: { orderNo },
    });

    if (error) {
      console.error('Error printing waybill via Supabase function:', error);
      throw new Error(`Failed to print waybill. Supabase function error: ${error.message}`);
    }
    
    if (!data || !data.base_64) {
        console.error('Komerce API did not return waybill data:', data);
        throw new Error('Could not retrieve waybill data from the shipping provider.');
    }

    console.log("Successfully retrieved waybill data.");
    return { base64: data.base_64 };
  },
};
