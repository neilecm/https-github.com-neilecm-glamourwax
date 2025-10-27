import React, { useState, useEffect, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';
import type { Product, FullOrder } from '../types';
import Spinner from '../components/Spinner';

type FormState = Omit<Product, 'id' | 'imageUrl' | 'createdAt'> & { imageUrl: string | null };
type AdminTab = 'orders' | 'products' | 'addProduct';

const initialFormState: FormState = {
  name: '',
  price: 0,
  description: '',
  longDescription: '',
  category: '',
  weight: 0,
  imageUrl: null,
};

const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<FullOrder[]>([]);
  const [isLoading, setIsLoading] = useState({ products: true, orders: true });
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProductsAndOrders = useCallback(async () => {
    try {
      setIsLoading({ products: true, orders: true });
      setError(null);
      const productsData = await supabaseService.getProducts();
      setProducts(productsData);
      setIsLoading(prev => ({ ...prev, products: false }));

      const ordersData = await supabaseService.getOrders();
      setOrders(ordersData);
      setIsLoading(prev => ({ ...prev, orders: false }));

    } catch (err) {
      let errorMessage = 'An unexpected error occurred while fetching data.';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String(err.message);
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setError(errorMessage);
      setIsLoading({ products: false, orders: false });
    }
  }, []);

  useEffect(() => {
    fetchProductsAndOrders();
  }, [fetchProductsAndOrders]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: name === 'price' || name === 'weight' ? Number(value) : value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
        setError("Please select an image for the product.");
        return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
        const imageUrl = await supabaseService.uploadImage(imageFile);
        const newProductData = { ...formState, imageUrl };
        await supabaseService.insertProduct(newProductData);
        
        setFormState(initialFormState);
        setImageFile(null);
        (document.getElementById('imageFile') as HTMLInputElement).value = '';
        await fetchProductsAndOrders();
        setActiveTab('products'); // Switch to products tab after adding

    } catch (err: any) {
        setError(err.message || "An unexpected error occurred while adding the product.");
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const renderTabButton = (tab: AdminTab, label: string) => (
    <button
        onClick={() => setActiveTab(tab)}
        className={`py-2 px-5 font-semibold transition-colors text-sm rounded-t-lg focus:outline-none ${
            activeTab === tab 
                ? 'border-b-2 border-pink-500 text-pink-600 bg-pink-50' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
        }`}
    >
        {label}
    </button>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-lg text-gray-600 mt-2">Manage your products and view recent orders.</p>
      </div>

      {error && <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</div>}
      
      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-gray-200">
        {renderTabButton('orders', 'My Orders')}
        {renderTabButton('products', 'My Products')}
        {renderTabButton('addProduct', 'Add New Product')}
      </div>

      {/* Conditional Content */}
      {activeTab === 'orders' && (
        <div className="bg-white p-8 rounded-lg shadow-lg">
           <h2 className="text-2xl font-bold mb-6">Recent Orders</h2>
           {isLoading.orders ? <Spinner /> : (
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead>
                          <tr className="border-b">
                              <th className="p-4">Order ID</th>
                              <th className="p-4">Date</th>
                              <th className="p-4">Customer</th>
                              <th className="p-4">Total</th>
                              <th className="p-4">Status</th>
                          </tr>
                      </thead>
                      <tbody>
                          {orders.map(order => (
                              <tr key={order.id} className="border-b hover:bg-gray-50">
                                  <td className="p-4 font-mono text-sm text-gray-600 truncate" title={order.order_number}>{order.order_number.split('-').slice(0, 3).join('-')}...</td>
                                  <td className="p-4 text-gray-600">{new Date(order.created_at).toLocaleDateString()}</td>
                                  <td className="p-4 font-semibold">
                                    {order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : 'N/A'}
                                  </td>
                                  <td className="p-4 text-gray-600">Rp{order.total_amount.toLocaleString('id-ID')}</td>
                                  <td className="p-4">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                      order.status === 'paid' ? 'bg-green-100 text-green-800' : 
                                      order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
                                      order.status === 'failed' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>{order.status.replace('_', ' ')}</span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           )}
           {orders.length === 0 && !isLoading.orders && <p className="text-center text-gray-500 py-4">No orders found.</p>}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-white p-8 rounded-lg shadow-lg">
           <h2 className="text-2xl font-bold mb-6">Existing Products</h2>
           {isLoading.products ? <Spinner /> : (
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead>
                          <tr className="border-b">
                              <th className="p-4">Image</th>
                              <th className="p-4">Name</th>
                              <th className="p-4">Category</th>
                              <th className="p-4">Price</th>
                          </tr>
                      </thead>
                      <tbody>
                          {products.map(product => (
                              <tr key={product.id} className="border-b hover:bg-gray-50">
                                  <td className="p-2"><img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded-md"/></td>
                                  <td className="p-4 font-semibold">{product.name}</td>
                                  <td className="p-4 text-gray-600">{product.category}</td>
                                  <td className="p-4 text-gray-600">Rp{product.price.toLocaleString('id-ID')}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           )}
           {products.length === 0 && !isLoading.products && <p className="text-center text-gray-500 py-4">No products found.</p>}
        </div>
      )}
      
      {activeTab === 'addProduct' && (
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-6">Add New Product</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="name" placeholder="Product Name" value={formState.name} onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
              <input name="category" placeholder="Category" value={formState.category} onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
              <input type="number" name="price" placeholder="Price (IDR)" value={formState.price || ''} onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
              <input type="number" name="weight" placeholder="Weight (grams)" value={formState.weight || ''} onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
            </div>
            <textarea name="description" placeholder="Short Description" value={formState.description} onChange={handleInputChange} required className="p-3 border rounded-md w-full h-24"></textarea>
            <textarea name="longDescription" placeholder="Long Description" value={formState.longDescription} onChange={handleInputChange} required className="p-3 border rounded-md w-full h-40"></textarea>
            <div>
              <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
              <input id="imageFile" type="file" onChange={handleFileChange} required className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"/>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-pink-500 text-white py-3 rounded-lg font-semibold hover:bg-pink-600 disabled:bg-pink-300 transition-colors">
              {isSubmitting ? <Spinner/> : 'Add Product'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminView;