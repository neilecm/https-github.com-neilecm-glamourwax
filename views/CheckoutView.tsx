import React, { useState, useEffect, useMemo } from 'react';
import { useCart } from '../contexts/CartContext';
import { rajaOngkirService } from '../services/rajaOngkirService';
import { midtransService } from '../services/midtransService';
import { supabaseService } from '../services/supabaseService';
import Spinner from '../components/Spinner';
import type { Province, City, District, Subdistrict, ShippingOption, CustomerDetails } from '../types';

interface CheckoutViewProps {
  onOrderSuccess: (orderId: string) => void;
  onOrderPending: (orderId: string) => void;
  onOrderFailed: (message: string) => void;
}

const CheckoutView: React.FC<CheckoutViewProps> = ({ onOrderSuccess, onOrderPending, onOrderFailed }) => {
  const { cartItems, cartTotal, cartCount, clearCart } = useCart();
  
  const [customer, setCustomer] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', postalCode: ''
  });
  
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subdistricts, setSubdistricts] = useState<Subdistrict[]>([]);
  
  const [selectedProvince, setSelectedProvince] = useState<{ id: string, name: string } | null>(null);
  const [selectedCity, setSelectedCity] = useState<{ id: string, name: string } | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<{ id: string, name: string } | null>(null);
  const [selectedSubdistrict, setSelectedSubdistrict] = useState<{ id: string, name: string } | null>(null);

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);

  const [isLoading, setIsLoading] = useState({
    provinces: true, cities: false, districts: false, subdistricts: false, shipping: false, payment: false
  });
  const [error, setError] = useState<string | null>(null);

  const totalWeight = useMemo(() => cartItems.reduce((acc, item) => acc + (item.variant.weight * item.quantity), 0), [cartItems]);

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        setError(null);
        const data = await rajaOngkirService.getProvinces();
        setProvinces(data);
      } catch (err: any) {
        setError(err.message || "Failed to load provinces. Please try again later.");
      } finally {
        setIsLoading(prev => ({ ...prev, provinces: false }));
      }
    };
    fetchProvinces();
  }, []);

  const handleProvinceChange = async (provinceId: string) => {
    const province = provinces.find(p => p.id.toString() === provinceId);
    setSelectedProvince(province ? { id: province.id.toString(), name: province.name } : null);
    setSelectedCity(null); setCities([]);
    setSelectedDistrict(null); setDistricts([]);
    setSelectedSubdistrict(null); setSubdistricts([]);
    setShippingOptions([]); setSelectedShipping(null);
    
    if (!provinceId) return;

    setIsLoading(prev => ({ ...prev, cities: true }));
    setError(null);
    try {
      const data = await rajaOngkirService.getCities(provinceId);
      setCities(data);
    } catch (err: any) {
      setError(err.message || "Failed to load cities.");
    } finally {
      setIsLoading(prev => ({ ...prev, cities: false }));
    }
  };
  
  const handleCityChange = async (cityId: string) => {
    const city = cities.find(c => c.id.toString() === cityId);
    setSelectedCity(city ? { id: city.id.toString(), name: city.name } : null);
    setSelectedDistrict(null); setDistricts([]);
    setSelectedSubdistrict(null); setSubdistricts([]);
    setShippingOptions([]); setSelectedShipping(null);
    
    if (!cityId) return;

    setIsLoading(prev => ({ ...prev, districts: true }));
    setError(null);
    try {
      const data = await rajaOngkirService.getDistricts(cityId);
      setDistricts(data);
    } catch (err: any) {
      setError(err.message || "Failed to load districts.");
    } finally {
      setIsLoading(prev => ({ ...prev, districts: false }));
    }
  };

  const handleDistrictChange = async (districtId: string) => {
    const district = districts.find(d => d.id.toString() === districtId);
    setSelectedDistrict(district ? { id: district.id.toString(), name: district.name } : null);
    setSelectedSubdistrict(null); setSubdistricts([]);
    setShippingOptions([]); setSelectedShipping(null);

    if (!districtId) return;

    setIsLoading(prev => ({ ...prev, subdistricts: true }));
    rajaOngkirService.getSubdistricts(districtId)
      .then(setSubdistricts)
      .catch(() => {})
      .finally(() => setIsLoading(prev => ({ ...prev, subdistricts: false })));

    setIsLoading(prev => ({ ...prev, shipping: true }));
    setError(null);
    try {
      const data = await rajaOngkirService.getShippingCost(districtId, totalWeight);
      setShippingOptions(data);
      if (data.length === 0) {
          setError("No shipping options available for this destination.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to calculate shipping costs.");
      setShippingOptions([]);
    } finally {
      setIsLoading(prev => ({ ...prev, shipping: false }));
    }
  };
  
  const handleSubdistrictChange = (subdistrictId: string) => {
    const subdistrict = subdistricts.find(s => s.id.toString() === subdistrictId);
    setSelectedSubdistrict(subdistrict ? { id: subdistrict.id.toString(), name: subdistrict.name } : null);
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomer(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipping || !selectedProvince || !selectedCity || !selectedDistrict) {
      setError("Please complete all fields, including selecting a district and shipping method.");
      return;
    }

    setIsLoading(prev => ({ ...prev, payment: true }));
    setError(null);

    const fullCustomerDetails: CustomerDetails = {
        ...customer,
        province: selectedProvince,
        city: selectedCity,
        district: selectedDistrict,
        subdistrict: selectedSubdistrict,
    };
    
    const subtotal = cartTotal;
    const total = subtotal + selectedShipping.cost;
    
    try {
        const token = await midtransService.createTransaction(fullCustomerDetails, cartItems, selectedShipping.cost, subtotal);
        
        const handlePaymentResult = async (result: any) => {
          try {
            await supabaseService.createOrder(fullCustomerDetails, cartItems, selectedShipping, subtotal, total, result);
            clearCart();
            if (result.status_code === '200') {
              onOrderSuccess(result.order_id);
            } else if (result.status_code === '201') {
              onOrderPending(result.order_id);
            } else {
              onOrderFailed(result.status_message || 'Payment was not successful.');
            }
          } catch(err: any) {
              console.error("Failed to save order to database:", err);
              onOrderFailed("Your payment was processed, but we had trouble saving your order. Please contact support with your Order ID: " + result.order_id);
          }
        };

        midtransService.openPaymentGateway(
            token,
            handlePaymentResult, // onSuccess
            handlePaymentResult, // onPending
            (result) => { // onError
                console.log("Payment failed.", result);
                onOrderFailed(result.status_message || 'Please try again or use a different payment method.');
                setIsLoading(prev => ({ ...prev, payment: false }));
            },
            () => { // onClose
                console.log("Payment popup closed by user.");
                setIsLoading(prev => ({ ...prev, payment: false }));
            }
        );

    } catch (err: any) {
        setError(err.message || "Failed to initiate payment.");
        setIsLoading(prev => ({ ...prev, payment: false }));
    }
  };

  const subtotal = cartTotal;
  const total = subtotal + (selectedShipping?.cost || 0);

  if (cartCount === 0) {
      return (
        <div className="text-center bg-white p-12 rounded-lg shadow-lg">
            <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
            <p className="text-gray-600">You cannot proceed to checkout with an empty cart.</p>
        </div>
      );
  }
  
  return (
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold mb-6">Checkout</h1>
      {error && <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg mb-4 break-words">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Customer & Shipping Details */}
            <div className="lg:col-span-2 space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input name="firstName" placeholder="First Name" onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
                        <input name="lastName" placeholder="Last Name" onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
                        <input type="email" name="email" placeholder="Email" onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
                        <input type="tel" name="phone" placeholder="Phone Number" onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Shipping Address</h2>
                    <div className="space-y-4">
                        <input name="address" placeholder="Street Address" onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <select onChange={e => handleProvinceChange(e.target.value)} required className="p-3 border rounded-md w-full bg-white" disabled={isLoading.provinces}>
                                <option value="">{isLoading.provinces ? 'Loading...' : 'Select Province'}</option>
                                {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select onChange={e => handleCityChange(e.target.value)} required className="p-3 border rounded-md w-full bg-white" disabled={!selectedProvince || isLoading.cities}>
                                <option value="">{isLoading.cities ? 'Loading...' : 'Select City'}</option>
                                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select onChange={e => handleDistrictChange(e.target.value)} required className="p-3 border rounded-md w-full bg-white" disabled={!selectedCity || isLoading.districts}>
                                <option value="">{isLoading.districts ? 'Loading...' : 'Select District'}</option>
                                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <select onChange={e => handleSubdistrictChange(e.target.value)} className="p-3 border rounded-md w-full bg-white" disabled={!selectedDistrict || isLoading.subdistricts}>
                                <option value="">{isLoading.subdistricts ? 'Loading...' : 'Select Subdistrict (Optional)'}</option>
                                {subdistricts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input name="postalCode" placeholder="Postal Code" onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
                        </div>
                    </div>
                </div>
                
                 {/* Shipping Options */}
                 {isLoading.shipping && <Spinner />}
                 {!isLoading.shipping && shippingOptions.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-semibold mb-4">Shipping Method</h2>
                        <div className="space-y-3">
                            {shippingOptions.map(opt => (
                                <label key={`${opt.code}-${opt.service}`} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-pink-50">
                                    <input type="radio" name="shipping" onChange={() => setSelectedShipping(opt)} required className="mr-4"/>
                                    <div className="flex-grow">
                                        <p className="font-semibold">{opt.name} ({opt.service})</p>
                                        <p className="text-sm text-gray-500">{opt.description} (est. {opt.etd})</p>
                                    </div>
                                    <span className="font-semibold">Rp{opt.cost.toLocaleString('id-ID')}</span>
                                 </label>
                            ))}
                        </div>
                    </div>
                 )}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1 bg-gray-50 p-6 rounded-lg h-fit">
                <h2 className="text-2xl font-semibold mb-4 border-b pb-4">Order Summary</h2>
                <div className="space-y-2">
                    {cartItems.map(item => (
                        <div key={item.cartItemId} className="flex justify-between text-sm">
                            <span>{item.product.name} ({item.variant.name}) x {item.quantity}</span>
                            <span>Rp{(item.variant.price * item.quantity).toLocaleString('id-ID')}</span>
                        </div>
                    ))}
                </div>
                <div className="border-t mt-4 pt-4 space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>Rp{subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Shipping</span>
                        <span>{selectedShipping ? `Rp${selectedShipping.cost.toLocaleString('id-ID')}` : '---'}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t mt-2 pt-2">
                        <span>Total</span>
                        <span>Rp{total.toLocaleString('id-ID')}</span>
                    </div>
                </div>
                 <button type="submit" disabled={!selectedShipping || isLoading.payment} className="w-full mt-6 bg-pink-500 text-white py-3 rounded-lg font-semibold hover:bg-pink-600 disabled:bg-pink-300 transition-colors">
                    {isLoading.payment ? <Spinner/> : 'Pay Now'}
                </button>
            </div>
        </div>
      </form>
    </div>
  );
};

export default CheckoutView;
