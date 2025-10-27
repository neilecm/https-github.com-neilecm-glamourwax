
import { supabase } from './supabase';
import type { Province, City, District, Subdistrict, ShippingOption } from '../types';

// This is the store's origin location. Per the API docs, this must be a District ID.
// Example: Kecamatan Denpasar Selatan, Kota Denpasar, Bali
const ORIGIN_DISTRICT_ID = '1391';

// A generic helper to handle the normalized response from our backend functions
async function invokeAndNormalize<T>(functionName: string, method: 'GET' | 'POST' = 'GET', body?: object): Promise<T[]> {
  const { data, error } = await supabase.functions.invoke(functionName, { method, body });

  if (error) {
    // Attempt to parse a more specific error message from the function's response
    let errorMessage = `Error invoking Supabase function '${functionName}': ${error.message}`;
    if (error.context?.error_cause) {
        try {
            const cause = JSON.parse(error.context.error_cause);
            errorMessage = cause.error || errorMessage;
        } catch (e) { /* Ignore parsing error */ }
    }
    
    // Check if the error is a non-2xx status code, which is a common failure mode
    if (error.message.includes('non-2xx status code')) {
        errorMessage = `Error invoking ${functionName}: The function returned a server error. Check the function logs in your Supabase dashboard for more details.`;
    }
    
    console.error(`Error in ${functionName}:`, error);
    throw new Error(errorMessage);
  }

  // The backend functions are now designed to return a standardized { rajaongkir: { results: [] } } structure
  return data?.rajaongkir?.results || [];
}


export const rajaOngkirService = {
  getProvinces: (): Promise<Province[]> => {
    return invokeAndNormalize<Province>('get-provinces', 'GET');
  },

  getCities: (provinceId: string): Promise<City[]> => {
    if (!provinceId) return Promise.resolve([]);
    return invokeAndNormalize<City>('get-cities', 'POST', { provinceId });
  },

  getDistricts: (cityId: string): Promise<District[]> => {
    if (!cityId) return Promise.resolve([]);
    return invokeAndNormalize<District>('get-districts', 'POST', { cityId });
  },

  getSubdistricts: (districtId: string): Promise<Subdistrict[]> => {
    if (!districtId) return Promise.resolve([]);
    return invokeAndNormalize<Subdistrict>('get-subdistricts', 'POST', { districtId });
  },

  // This now correctly uses a District ID, not a Subdistrict ID
  getShippingCost: (
    destinationDistrictId: string, 
    weight: number // in grams
  ): Promise<ShippingOption[]> => {
    return invokeAndNormalize<ShippingOption>('get-shipping-cost', 'POST', {
        origin: ORIGIN_DISTRICT_ID, 
        destination: destinationDistrictId, 
        weight: weight,
        // Query multiple couriers as per the documentation example
        courier: 'jne:sicepat:jnt:pos:tiki:ninja:lion'
    });
  },
};
