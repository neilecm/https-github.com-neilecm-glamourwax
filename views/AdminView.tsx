import React, { useState, useEffect, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';
import { komerceService } from '../services/komerceService';
import type { Product, FullOrder, OrderStatus } from '../types';
import Spinner from '../components/Spinner';
import MarketingView from './MarketingView'; // Import the new view

// #region Helper Functions
const base64ToBlob = (base64: string, contentType = '', sliceSize = 512) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
};

// #endregion

// #region Child Components for AdminView

const CountdownTimer: React.FC<{ deadline: Date }> = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState(deadline.getTime() - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(deadline.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (timeLeft <= 0) {
    return <span className="text-red-500 font-semibold">Past Due</span>;
  }

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div className="text-sm text-gray-700">
      {days > 0 && `${days}d `}
      {`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`}
    </div>
  );
};

const RenderOrderActions: React.FC<{
  order: FullOrder;
  isLoading: boolean;
  onArrangePickup: (order: FullOrder) => void;
  onPrintWaybill: (order: FullOrder) => void;
}> = ({ order, isLoading, onArrangePickup, onPrintWaybill }) => {
  switch (order.status) {
    case 'paid':
      return (
        <button
          onClick={() => onArrangePickup(order)}
          disabled={isLoading}
          className="bg-green-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-green-600 disabled:bg-gray-300 transition-colors w-32 text-center"
        >
          {isLoading ? <Spinner /> : 'Arrange Pickup'}
        </button>
      );
    case 'shipped':
      return (
        <button
          onClick={() => onPrintWaybill(order)}
          disabled={isLoading || !order.awb_number}
          className="bg-indigo-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-indigo-600 disabled:bg-gray-300 transition-colors w-32 text-center"
        >
          {isLoading ? <Spinner /> : 'Print Waybill'}
        </button>
      );
    case 'pending_payment':
      return <p className="text-xs text-yellow-600">Awaiting Payment</p>;
    case 'delivered':
      return <p className="text-xs text-green-600">Order Completed</p>;
    case 'failed':
      return <p className="text-xs text-red-600">Order Failed</p>;
    default:
      return <p className="text-xs text-gray-500">-</p>;
  }
};


const OrdersView: React.FC = () => {
    const [orders, setOrders] = useState<FullOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');

    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
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
    
    const filteredOrders = orders.filter(order => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        const clientName = `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.toLowerCase();
        const hasMatchingProduct = order.order_items.some(item =>
            item.products?.name.toLowerCase().includes(query)
        );
        const hasMatchingOrderNumber = order.order_number.toLowerCase().includes(query);

        return clientName.includes(query) || hasMatchingProduct || hasMatchingOrderNumber;
    });

    const handleArrangePickup = async (order: FullOrder) => {
        setActionLoading(prev => ({ ...prev, [order.id]: true }));
        setError(null);
        try {
            const result = await komerceService.arrangePickup(order.order_number);
            alert(`Pickup arranged successfully! AWB: ${result.awb}`);
            await fetchOrders(); // Refresh the list to show new status and AWB
        } catch (err: any) {
            setError(err.message || "Failed to arrange pickup.");
        } finally {
            setActionLoading(prev => ({ ...prev, [order.id]: false }));
        }
    };
    
    const handlePrintWaybill = async (order: FullOrder) => {
        setActionLoading(prev => ({ ...prev, [order.id]: true }));
        setError(null);
        try {
            const { base64 } = await komerceService.printWaybill(order.order_number);
            const blob = base64ToBlob(base64, 'application/pdf');
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if(printWindow) {
                printWindow.onload = () => {
                    printWindow.print();
                }
            } else {
                throw new Error("Could not open print window. Please disable pop-up blockers.");
            }
        } catch(err: any) {
            setError(err.message || "Failed to print waybill.");
        } finally {
            setActionLoading(prev => ({ ...prev, [order.id]: false }));
        }
    };
    
    const getShippingDeadline = (order: FullOrder): Date | null => {
        if (order.status !== 'paid') return null;
        
        const orderDate = new Date(order.created_at);
        const isSameDay = order.shipping_service.toLowerCase().includes('sameday') || order.shipping_service.toLowerCase().includes('instant');
        
        if (isSameDay) {
            const deadline = new Date(orderDate);
            deadline.setHours(17, 0, 0, 0); // 5:00 PM on the same day
            return deadline;
        } else {
            const deadline = new Date(orderDate);
            deadline.setDate(deadline.getDate() + 3); // 3 days for regular shipping
            return deadline;
        }
    };

    if (isLoading) return <Spinner />;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">My Orders</h2>
              <div className="relative w-full max-w-sm">
                  <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by Order No, Client, or Product..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                   <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                   </svg>
              </div>
            </div>
            {error && <div className="text-red-500 bg-red-100 p-4 rounded-lg my-4">{error}</div>}
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-3 px-4 text-left font-semibold">Client Name</th>
                            <th className="py-3 px-4 text-left font-semibold">Products Purchased</th>
                            <th className="py-3 px-4 text-left font-semibold">Status & Countdown</th>
                            <th className="py-3 px-4 text-left font-semibold">AWB / Tracking</th>
                            <th className="py-3 px-4 text-left font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.map(order => {
                            const deadline = getShippingDeadline(order);
                            return (
                                <tr key={order.id} className="border-b hover:bg-gray-50 align-top">
                                    <td className="py-3 px-4">
                                        <div className="font-medium">{order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : 'N/A'}</div>
                                        <div className="text-gray-500">Total: Rp{order.total_amount.toLocaleString('id-ID')}</div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <ul className="space-y-1">
                                        {order.order_items.map(item => (
                                          <li key={item.products?.id}>
                                            {item.products?.name || 'Unknown Product'} x <strong>{item.quantity}</strong>
                                          </li>
                                        ))}
                                      </ul>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full ${
                                            order.status === 'paid' ? 'bg-blue-100 text-blue-800' : 
                                            order.status === 'shipped' ? 'bg-green-100 text-green-800' :
                                            order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
                                            order.status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                                            order.status === 'failed' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-200 text-gray-800'
                                        }`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                        {deadline && <CountdownTimer deadline={deadline} />}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-xs">{order.awb_number || 'N/A'}</td>
                                    <td className="py-3 px-4">
                                      <RenderOrderActions
                                        order={order}
                                        isLoading={actionLoading[order.id]}
                                        onArrangePickup={handleArrangePickup}
                                        onPrintWaybill={handlePrintWaybill}
                                      />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredOrders.length === 0 && orders.length > 0 && (
                    <p className="text-center py-8 text-gray-500">No orders match your search criteria.</p>
                )}
                {orders.length === 0 && <p className="text-center py-8 text-gray-500">No orders found.</p>}
            </div>
        </div>
    );
};


const ProductsView: React.FC<{
  onEdit: (product: Product) => void;
  onAddNew: () => void;
  onManageBrands: () => void;
}> = ({ onEdit, onAddNew, onManageBrands }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
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

    const handleDelete = async (productId: string) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                setError(null);
                await supabaseService.deleteProduct(productId);
                await fetchProducts();
            } catch (err: any) {
                setError(err.message || 'Failed to delete product.');
            }
        }
    };
    
    if (isLoading) return <Spinner />;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">My Products</h2>
                <div className="flex items-center gap-4">
                    <button
                        onClick={onManageBrands}
                        className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors font-semibold"
                    >
                        Brand Management
                    </button>
                    <button
                        onClick={onAddNew}
                        className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors font-semibold"
                    >
                        + Add New Product
                    </button>
                </div>
            </div>
            {error && <div className="text-red-500 bg-red-100 p-4 rounded-lg mb-4">{error}</div>}
             <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                    <tr>
                        <th className="py-3 px-4 text-left">Product</th>
                        <th className="py-3 px-4 text-left">Price</th>
                        <th className="py-3 px-4 text-left">Category</th>
                        <th className="py-3 px-4 text-left">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {products.map((product) => (
                        <tr key={product.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 flex items-center">
                            <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded-md mr-4" />
                            <span>{product.name}</span>
                        </td>
                        <td className="py-3 px-4">
                            Rp{product.price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4">{product.category}</td>
                        <td className="py-3 px-4">
                            <button onClick={() => onEdit(product)} className="text-blue-500 hover:underline mr-4">
                            Edit
                            </button>
                            <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:underline">
                            Delete
                            </button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                {products.length === 0 && (
                    <p className="text-center py-8 text-gray-500">No products found.</p>
                )}
            </div>
        </div>
    );
};

type FormState = Omit<Product, 'id' | 'createdAt'>;
const initialFormState: FormState = { name: '', price: 0, category: '', imageUrl: '', longDescription: '', weight: 0 };

const ProductForm: React.FC<{ product: Product | null; onFinish: () => void }> = ({ product, onFinish }) => {
    const [formState, setFormState] = useState<FormState>(initialFormState);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (product) {
            setFormState({
                name: product.name,
                price: product.price,
                category: product.category,
                imageUrl: product.imageUrl,
                longDescription: product.longDescription,
                weight: product.weight,
            });
        } else {
            setFormState(initialFormState);
        }
    }, [product]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState((prev) => ({...prev, [name]: name === 'price' || name === 'weight' ? parseFloat(value) || 0 : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            if (product) {
                await supabaseService.updateProduct(product.id, formState);
            } else {
                await supabaseService.addProduct(formState);
            }
            onFinish();
        } catch (err: any) {
            setError(err.message || 'Failed to save product.');
        }
    };
    
    return (
        <div className="p-6 bg-gray-50 rounded-lg border">
            <h2 className="text-2xl font-semibold mb-4">{product ? 'Edit Product' : 'Add New Product'}</h2>
            {error && <div className="text-red-500 bg-red-100 p-4 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="name" placeholder="Product Name" value={formState.name} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
                    <input type="number" name="price" placeholder="Price (IDR)" value={formState.price} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
                    <input name="category" placeholder="Category" value={formState.category} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
                    <input type="number" name="weight" placeholder="Weight (grams)" value={formState.weight} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
                </div>
                <input name="imageUrl" placeholder="Image URL" value={formState.imageUrl} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
                <textarea name="longDescription" placeholder="Long Description" value={formState.longDescription} onChange={handleInputChange} required rows={4} className="p-3 border rounded-md w-full" />
                <div className="flex justify-end gap-4">
                    <button type="button" onClick={onFinish} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Cancel</button>
                    <button type="submit" className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600">{product ? 'Update' : 'Save'}</button>
                </div>
            </form>
        </div>
    );
};

const PlaceholderView: React.FC<{ section: string }> = ({ section }) => (
    <div className="text-center bg-gray-50 p-12 rounded-lg border-dashed border-2">
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">{section}</h2>
        <p className="text-gray-500">This feature is coming soon.</p>
    </div>
);

const BrandManagementView: React.FC<{ onBack: () => void }> = ({ onBack }) => (
    <div>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Brand Management</h2>
            <button
                onClick={onBack}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold"
            >
                &larr; Back to Products
            </button>
        </div>
        <div className="text-center bg-gray-50 p-12 rounded-lg border-dashed border-2">
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Manage Brands</h2>
            <p className="text-gray-500">Functionality to add, edit, and delete brands will be implemented here.</p>
        </div>
    </div>
);


// #endregion

const AdminView: React.FC = () => {
  const [activeView, setActiveView] = useState('orders');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setActiveView('addProduct'); // Switch to the form view
  };

  const handleFormFinish = () => {
    setEditingProduct(null);
    setActiveView('products'); // Go back to the product list
  }
  
  const handleAddNewProduct = () => {
    setEditingProduct(null);
    setActiveView('addProduct');
  };
  
  const handleManageBrands = () => {
    setActiveView('brandManagement');
  };

  const navItems = {
      'orders': 'Orders',
      'products': 'Product',
      'marketing': 'Marketing Centre',
      'customerservice': 'Customer Service',
      'finance': 'Finance',
      'data': 'Data',
      'shop': 'Shop'
  };

  const renderActiveView = () => {
    switch(activeView) {
        case 'orders': return <OrdersView />;
        case 'products': return <ProductsView onEdit={handleEditProduct} onAddNew={handleAddNewProduct} onManageBrands={handleManageBrands} />;
        case 'addProduct': return <ProductForm product={editingProduct} onFinish={handleFormFinish} />;
        case 'brandManagement': return <BrandManagementView onBack={() => setActiveView('products')} />;
        case 'marketing': return <MarketingView />;
        case 'customerservice': return <PlaceholderView section="Customer Service" />;
        case 'finance': return <PlaceholderView section="Finance" />;
        case 'data': return <PlaceholderView section="Data" />;
        case 'shop': return <PlaceholderView section="Shop Settings" />;
        default: return <OrdersView />;
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="flex flex-wrap border-b mb-6 gap-2">
        {Object.entries(navItems).map(([key, value]) => (
            <button
                key={key}
                onClick={() => setActiveView(key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    (activeView === key || 
                     (activeView === 'addProduct' && key === 'products') ||
                     (activeView === 'brandManagement' && key === 'products')
                    )
                    ? 'border-b-2 border-pink-500 text-pink-600 bg-pink-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
            >
                {value}
            </button>
        ))}
      </div>
      
      <div className="mt-6">
        {renderActiveView()}
      </div>
    </div>
  );
};

export default AdminView;