// supabase/functions/get-shipping-cost/index.ts
// This function has been completely refactored to align with the correct Komerce API documentation.

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KOMERCE_API_URL = 'https://api-sandbox.collaborator.komerce.id/tariff/api/v1/calculate';

// Helper function to calculate insurance based on Komerce documentation rules
const calculateInsurance = (courier: string, itemValue: number, grandTotal: number): number => {
    if (itemValue < 300000) return 0;

    let insuranceValue = 0;
    const upperCourier = courier.toUpperCase();

    switch (upperCourier) {
        case 'JNE':
            insuranceValue = (0.002 * itemValue) + 5000;
            break;
        case 'SICEPAT':
            if (grandTotal > 500000) {
                insuranceValue = 0.003 * grandTotal;
            }
            break;
        case 'IDEXPRESS':
            insuranceValue = 0.002 * itemValue;
            break;
        case 'SAP':
            insuranceValue = (0.003 * itemValue) + 2000;
            break;
        case 'NINJA':
            insuranceValue = (itemValue <= 1000000) ? 2500 : (0.0025 * itemValue);
            break;
        case 'J&T': // Assuming JNT from the calculate API maps to J&T
        case 'JNT':
            insuranceValue = 0.002 * itemValue;
            break;
        case 'LION':
            insuranceValue = 0.003 * itemValue;
            break;
        case 'GOSEND':
            // Docs are unclear on how to select Silver/Gold/Platinum, so we won't offer it for now.
            insuranceValue = 0;
            break;
        default:
            insuranceValue = 0;
    }
    return Math.ceil(insuranceValue);
};

serve(async (req) => {
  console.log("get-shipping-cost function invoked.");

  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { origin, destination, weight, itemValue } = await req.json();
    console.log(`Received cost request: origin=${origin}, destination=${destination}, weight=${weight}g, itemValue=${itemValue}`);
    if (!origin || !destination || !weight || !itemValue) {
      throw new Error("origin, destination, weight, and itemValue are required parameters.");
    }

    const KOMERCE_API_KEY = Deno.env.get('KOMERCE_API_KEY');
    if (!KOMERCE_API_KEY) {
        throw new Error("KOMERCE_API_KEY not set in secrets.");
    }

    const params = new URLSearchParams({
      shipper_destination_id: origin,
      receiver_destination_id: destination,
      weight: (weight / 1000).toString(),
      item_value: itemValue.toString(),
      cod: 'yes',
      origin_pin_point: '-8.6705, 115.2124',
      destination_pin_point: '-8.6705, 115.2124',
    });
    
    const endpoint = `${KOMERCE_API_URL}?${params.toString()}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'x-api-key': KOMERCE_API_KEY, 'Accept': 'application/json' },
    });

    const json = await res.json();
    if (!res.ok || json.meta?.status !== 'success') {
      throw new Error(`[Komerce API] ${json.meta?.message || res.statusText}`);
    }

    let allServices: any[] = [];
    if (json.data) {
        if (Array.isArray(json.data.calculate_reguler)) allServices.push(...json.data.calculate_reguler);
        if (Array.isArray(json.data.calculate_cargo)) allServices.push(...json.data.calculate_cargo);
        if (Array.isArray(json.data.calculate_instant)) allServices.push(...json.data.calculate_instant);
    }
    
    // Add calculated insurance value to each service
    const servicesWithInsurance = allServices.map(service => {
        const grandTotal = itemValue + service.shipping_cost_net;
        const insurance_value = calculateInsurance(service.shipping_name, itemValue, grandTotal);
        return { ...service, insurance_value };
    });

    const responseBody = {
      rajaongkir: {
        status: json.meta,
        results: servicesWithInsurance,
      },
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error("Error in get-shipping-cost function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});