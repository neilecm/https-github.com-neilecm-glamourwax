import React, { useState, useEffect, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';
import type { Product, FullOrder, OrderStatus } from '../types';
import Spinner from '../components/Spinner';

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

const OrdersView: React.FC = () => {
    const [orders, setOrders] = useState<FullOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

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

    const handleArrangePickup = async (orderId: string) => {
        try {
            await supabaseService.updateOrderStatus(orderId, 'shipped');
            fetchOrders(); // Refresh the list
        } catch (err: any) {
            setError(err.message || "Failed to update order status.");
        }
    };
    
    const handlePrintWaybill = () => {
        window.print();
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
    if (error) return <div className="text-red-500 bg-red-100 p-4 rounded-lg">{error}</div>;

    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4">My Orders</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-3 px-4 text-left">Client Name</th>
                            <th className="py-3 px-4 text-left">Total Paid</th>
                            <th className="py-3 px-4 text-left">Status & Countdown</th>
                            <th className="py-3 px-4 text-left">Shipping Channel</th>
                            <th className="py-3 px-4 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map(order => {
                            const deadline = getShippingDeadline(order);
                            const isExpanded = expandedOrderId === order.id;
                            return (
                                <React.Fragment key={order.id}>
                                    <tr className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4">{order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : 'N/A'}</td>
                                        <td className="py-3 px-4">Rp{order.total_amount.toLocaleString('id-ID')}</td>
                                        <td className="py-3 px-4">
                                            <span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full ${order.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                            {deadline && <CountdownTimer deadline={deadline} />}
                                        </td>
                                        <td className="py-3 px-4">{order.shipping_provider} ({order.shipping_service})</td>
                                        <td className="py-3 px-4 space-x-2">
                                            <button onClick={() => setExpandedOrderId(isExpanded ? null : order.id)} className="text-blue-500 hover:underline text-sm">View Items</button>
                                            <button onClick={() => handleArrangePickup(order.id)} disabled={order.status !== 'paid'} className="text-green-500 hover:underline disabled:text-gray-400 disabled:no-underline text-sm">Arrange Pick Up</button>
                                            <button onClick={handlePrintWaybill} className="text-indigo-500 hover:underline text-sm">Print Waybill</button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-gray-50">
                                            <td colSpan={5} className="p-4">
                                                <h4 className="font-semibold mb-2">Purchased Items:</h4>
                                                <ul className="list-disc pl-5 text-sm text-gray-700">
                                                    {order.order_items.map(item => (
                                                        <li key={item.products?.id}>{item.products?.name || 'Unknown Product'} x {item.quantity}</li>
                                                    ))}
                                                </ul>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
                {orders.length === 0 && <p className="text-center py-8 text-gray-500">No orders found.</p>}
            </div>
        </div>
    );
};


const ProductsView: React.FC<{ onEdit: (product: Product) => void; onAddNew: () => void; }> = ({ onEdit, onAddNew }) => {
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
                <button
                    onClick={onAddNew}
                    className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors font-semibold"
                >
                    + Add New Product
                </button>
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
        case 'products': return <ProductsView onEdit={handleEditProduct} onAddNew={handleAddNewProduct} />;
        case 'addProduct': return <ProductForm product={editingProduct} onFinish={handleFormFinish} />;
        case 'marketing': return <PlaceholderView section="Marketing Centre" />;
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
                    (activeView === key || (activeView === 'addProduct' && key === 'products'))
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