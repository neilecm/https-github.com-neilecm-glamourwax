import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { supabaseService } from '../services/supabaseService';
import { komerceService } from '../services/komerceService';
import type { FullOrder, Product, ProductVariant, ProductVariantOption } from '../types';
import Spinner from '../components/Spinner';
import MarketingView from './MarketingView';

const initialProductState: Omit<Product, 'id' | 'createdAt'> = {
  name: '',
  category: '',
  longDescription: '',
  variantOptions: [],
  imageUrls: [],
  videoUrl: null,
  variants: [],
};

// --- ProductForm Component ---
const ProductForm: React.FC<{
  productToEdit: Product | null;
  onClose: () => void;
  onSave: () => void;
}> = ({ productToEdit, onClose, onSave }) => {
  const [product, setProduct] = useState<Omit<Product, 'id' | 'createdAt'>>(initialProductState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productToEdit) {
      setProduct({ ...productToEdit });
    } else {
      setProduct(initialProductState);
    }
  }, [productToEdit]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProduct(prev => ({ ...prev, [name]: value }));
  };

  const handleVariantChange = (index: number, field: keyof Omit<ProductVariant, 'id' | 'productId'>, value: any) => {
    const updatedVariants = [...product.variants];
    // @ts-ignore
    updatedVariants[index][field] = value;
    setProduct(prev => ({ ...prev, variants: updatedVariants }));
  };

  const addVariant = () => {
    const newVariant: any = { name: '', price: 0, weight: 0, stock: 0, imageUrls: [], options: {} };
    setProduct(prev => ({ ...prev, variants: [...prev.variants, newVariant] }));
  };

  const removeVariant = (index: number) => {
    setProduct(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (productToEdit) {
        await supabaseService.updateProduct(productToEdit.id, product);
      } else {
        await supabaseService.addProduct(product);
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save product.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">{productToEdit ? 'Edit Product' : 'Add New Product'}</h2>
          {error && <div className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</div>}
          <div className="space-y-4">
            <input name="name" placeholder="Product Name" value={product.name} onChange={handleInputChange} className="p-2 border rounded-md w-full" />
            <input name="category" placeholder="Category" value={product.category} onChange={handleInputChange} className="p-2 border rounded-md w-full" />
            <textarea name="longDescription" placeholder="Long Description" value={product.longDescription} onChange={handleInputChange} className="p-2 border rounded-md w-full h-24" />
            
            <h3 className="font-semibold text-lg border-t pt-4 mt-4">Variants</h3>
            {product.variants.map((variant, index) => (
              <div key={index} className="p-3 border rounded-md space-y-2 bg-gray-50">
                <input placeholder="Variant Name (e.g., Red, 500g)" value={variant.name} onChange={(e) => handleVariantChange(index, 'name', e.target.value)} className="p-2 border rounded-md w-full" />
                <div className="grid grid-cols-3 gap-2">
                    <input type="number" placeholder="Price" value={variant.price} onChange={(e) => handleVariantChange(index, 'price', parseFloat(e.target.value))} className="p-2 border rounded-md w-full" />
                    <input type="number" placeholder="Weight (g)" value={variant.weight} onChange={(e) => handleVariantChange(index, 'weight', parseInt(e.target.value, 10))} className="p-2 border rounded-md w-full" />
                    <input type="number" placeholder="Stock" value={variant.stock} onChange={(e) => handleVariantChange(index, 'stock', parseInt(e.target.value, 10))} className="p-2 border rounded-md w-full" />
                </div>
                <button onClick={() => removeVariant(index)} className="text-red-500 text-sm">Remove Variant</button>
              </div>
            ))}
            <button onClick={addVariant} className="text-pink-500 font-semibold">+ Add Variant</button>
          </div>
        </div>
        <div className="bg-gray-100 p-4 flex justify-end gap-4 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300">Cancel</button>
          <button onClick={handleSave} disabled={isLoading} className="px-4 py-2 rounded-md bg-pink-500 text-white hover:bg-pink-600 disabled:bg-pink-300">
            {isLoading ? <Spinner /> : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  );
};


// --- ProductsTab Component ---
const ProductsTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await supabaseService.getProducts();
            setProducts(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch products.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleAdd = () => {
        setProductToEdit(null);
        setIsFormOpen(true);
    };

    const handleEdit = (product: Product) => {
        setProductToEdit(product);
        setIsFormOpen(true);
    };

    const handleDelete = async (productId: string) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                await supabaseService.deleteProduct(productId);
                fetchProducts();
            } catch (err: any) {
                setError(err.message || 'Failed to delete product.');
            }
        }
    };
    
    const handleSave = () => {
        setIsFormOpen(false);
        fetchProducts();
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Manage Products</h2>
                <button onClick={handleAdd} className="bg-pink-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-pink-600">
                    + Add Product
                </button>
            </div>
            {error && <div className="text-red-500 bg-red-100 p-4 rounded-lg my-4">{error}</div>}
            {isLoading ? <Spinner /> : (
                <div className="space-y-3">
                    {products.map(product => (
                        <div key={product.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-bold text-lg">{product.name}</p>
                                <p className="text-sm text-gray-500">{product.category} - {product.variants.length} variant(s)</p>
                            </div>
                            <div className="space-x-2">
                                <button onClick={() => handleEdit(product)} className="text-blue-500 hover:underline">Edit</button>
                                <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:underline">Delete</button>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && <p className="text-center py-8 text-gray-500">No products found. Add one to get started!</p>}
                </div>
            )}
            {isFormOpen && <ProductForm productToEdit={productToEdit} onClose={() => setIsFormOpen(false)} onSave={handleSave} />}
        </div>
    );
};

// --- OrdersTab Component ---
const OrdersTab: React.FC = () => {
    const [orders, setOrders] = useState<FullOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await supabaseService.getOrders();
            setOrders(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch orders.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);
    
    // In a real app, you would have a modal for details, but for simplicity, we'll just list them.
    
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4">Customer Orders</h2>
            {error && <div className="text-red-500 bg-red-100 p-4 rounded-lg my-4">{error}</div>}
            {isLoading ? <Spinner /> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="py-3 px-4 text-left font-semibold">Order #</th>
                                <th className="py-3 px-4 text-left font-semibold">Date</th>
                                <th className="py-3 px-4 text-left font-semibold">Customer</th>
                                <th className="py-3 px-4 text-left font-semibold">Total</th>
                                <th className="py-3 px-4 text-left font-semibold">Status</th>
                                <th className="py-3 px-4 text-left font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-4 font-mono">{order.order_number}</td>
                                    <td className="py-3 px-4">{new Date(order.created_at).toLocaleDateString()}</td>
                                    <td className="py-3 px-4">{order.customers.first_name} {order.customers.last_name}</td>
                                    <td className="py-3 px-4">Rp{order.total_amount.toLocaleString('id-ID')}</td>
                                    <td className="py-3 px-4 font-semibold">{order.status}</td>
                                    <td className="py-3 px-4 space-x-2">
                                        <button className="text-blue-500 hover:underline">Details</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {orders.length === 0 && <p className="text-center py-8 text-gray-500">No orders found.</p>}
                </div>
            )}
        </div>
    );
};


const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'marketing'>('orders');

    const renderTabContent = () => {
        switch (activeTab) {
            case 'orders':
                return <OrdersTab />;
            case 'products':
                return <ProductsTab />;
            case 'marketing':
                return <MarketingView />;
            default:
                return null;
        }
    };
    
    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl min-h-[80vh]">
            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
            <div className="flex border-b mb-6">
                <button
                    onClick={() => setActiveTab('orders')}
                    className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'orders' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-500 hover:text-pink-500'}`}
                >
                    Orders
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'products' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-500 hover:text-pink-500'}`}
                >
                    Products
                </button>
                 <button
                    onClick={() => setActiveTab('marketing')}
                    className={`px-4 py-2 text-lg font-semibold transition-colors ${activeTab === 'marketing' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-500 hover:text-pink-500'}`}
                >
                    Marketing Centre
                </button>
            </div>
            <div>{renderTabContent()}</div>
        </div>
    );
};

export default AdminView;
