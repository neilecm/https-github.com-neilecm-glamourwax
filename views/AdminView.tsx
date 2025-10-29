import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent, Fragment } from 'react';
import { supabaseService } from '../services/supabaseService';
import { komerceService } from '../services/komerceService';
import type { FullOrder, KomerceOrderDetail, Product, ProductVariant, ProductVariantOption } from '../types';
import Spinner from '../components/Spinner';
import MarketingView from './MarketingView';

type ActionLoadingState = {
    [key: string]: boolean;
};

// Modal Component for Shipping Details
const ShippingDetailModal: React.FC<{ details: KomerceOrderDetail | null; onClose: () => void; isLoading: boolean }> = ({ details, onClose, isLoading }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold">Shipping Details</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                {isLoading ? <Spinner /> : details && (
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div><strong>Order Number:</strong> {details.order_no}</div>
                            <div><strong>Status:</strong> <span className="font-semibold text-blue-600">{details.order_status}</span></div>
                            <div><strong>AWB / Tracking:</strong> {details.awb || 'Not available'}</div>
                             <div><strong>Courier:</strong> {details.shipping} ({details.shipping_type})</div>
                        </div>

                        {details.live_tracking_url && (
                            <a href={details.live_tracking_url} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline">
                                Track Shipment &rarr;
                            </a>
                        )}

                        <div className="border-t pt-4">
                            <h3 className="font-semibold mb-2">Recipient</h3>
                            <p>{details.receiver_name}</p>
                            <p>{details.receiver_phone}</p>
                            <p className="text-gray-600">{details.receiver_address}</p>
                        </div>
                         <div className="border-t pt-4">
                            <h3 className="font-semibold mb-2">Cost Breakdown</h3>
                            <div className="grid grid-cols-2 gap-x-4">
                                <div>Shipping:</div> <div>Rp{details.shipping_cost?.toLocaleString('id-ID')}</div>
                                <div>Cashback:</div> <div>- Rp{details.shipping_cashback?.toLocaleString('id-ID')}</div>
                                <div>Insurance:</div> <div>Rp{details.insurance_value?.toLocaleString('id-ID')}</div>
                                <div>Service Fee:</div> <div>Rp{details.service_fee?.toLocaleString('id-ID')}</div>
                                <div className="font-bold border-t pt-1 mt-1">Grand Total:</div> <div className="font-bold border-t pt-1 mt-1">Rp{details.grand_total?.toLocaleString('id-ID')}</div>
                            </div>
                        </div>
                        <div className="border-t pt-4">
                            <h3 className="font-semibold mb-2">Items</h3>
                            <ul>
                                {details.order_details.map((item, index) => (
                                    <li key={index} className="flex justify-between">
                                        <span>{item.product_name} ({item.product_variant_name}) x {item.qty}</span>
                                        <span>Rp{item.subtotal.toLocaleString('id-ID')}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


const OrdersManager: React.FC = () => {
    const [orders, setOrders] = useState<FullOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<ActionLoadingState>({});
    
    // State for the details modal
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<KomerceOrderDetail | null>(null);
    const [isModalLoading, setIsModalLoading] = useState(false);


    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await supabaseService.getOrders();
            setOrders(data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch orders.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);
    
    const handleAction = async (orderId: string, action: () => Promise<any>) => {
        setActionLoading(prev => ({ ...prev, [orderId]: true }));
        setError(null);
        try {
            await action();
            await fetchOrders(); // Refresh the list after action
        } catch (err: any) {
            setError(`Action failed: ${err.message}`);
        } finally {
            setActionLoading(prev => ({ ...prev, [orderId]: false }));
        }
    };

    const handleSubmitToKomerce = (order: FullOrder) => {
        handleAction(`submit-${order.id}`, () => komerceService.submitOrderToKomerce(order.id));
    };

    const handleArrangePickup = (order: FullOrder) => {
        handleAction(`pickup-${order.order_number}`, () => komerceService.arrangePickup(order.order_number));
    };
    
    const handlePrintWaybill = async (order: FullOrder) => {
        const actionId = `waybill-${order.order_number}`;
        setActionLoading(prev => ({ ...prev, [actionId]: true }));
        setError(null);
        try {
            // The service now handles bulk printing, so we pass an array
            const pdfBlob = await komerceService.printWaybill([order.order_number]);
            const url = URL.createObjectURL(pdfBlob);
            window.open(url, '_blank');
            // Optimistically update the local state to show the waybill is available
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, waybill_url: url } : o));
        } catch(err: any) {
             setError(`Failed to print waybill for ${order.order_number}: ${err.message}`);
        } finally {
            setActionLoading(prev => ({ ...prev, [actionId]: false }));
        }
    };
    
    const handleVerifyPayment = (order: FullOrder) => {
        handleAction(`check-${order.order_number}`, async () => {
            await supabaseService.checkOrderStatus(order.order_number);
        });
    };

    const handleShowDetails = async (order: FullOrder) => {
        if (!order.komerce_order_no) {
            setError("This order has not been submitted to the shipping partner yet.");
            return;
        }
        setIsModalLoading(true);
        setIsDetailModalOpen(true);
        setSelectedOrderDetails(null);
        setError(null);
        try {
            const details = await komerceService.getKomerceOrderDetails(order.order_number);
            
            // Merge data: live Komerce data + reliable local cost data
            const mergedDetails: KomerceOrderDetail = {
                ...details,
                shipping_cost: order.shipping_cost_original ?? details.shipping_cost,
                shipping_cashback: order.shipping_cashback ?? details.shipping_cashback,
                service_fee: order.service_fee ?? details.service_fee,
                insurance_value: order.insurance_amount ?? details.insurance_value,
                grand_total: order.total_amount, // Our DB total is the source of truth
            };

            setSelectedOrderDetails(mergedDetails);
        } catch (err: any) {
            setError(`Failed to fetch shipping details: ${err.message}`);
            setIsDetailModalOpen(false); // Close modal on error
        } finally {
            setIsModalLoading(false);
        }
    };

    if (isLoading) return <Spinner />;

    return (
        <div>
            {isDetailModalOpen && (
                <ShippingDetailModal 
                    details={selectedOrderDetails}
                    isLoading={isModalLoading}
                    onClose={() => setIsDetailModalOpen(false)}
                />
            )}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">My Orders</h2>
                <button onClick={fetchOrders} disabled={isLoading} className="text-sm bg-gray-200 px-3 py-1 rounded-md hover:bg-gray-300 disabled:bg-gray-100">Refresh</button>
            </div>
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 break-words">{error}</div>}
            <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {orders.map(order => (
                            <tr key={order.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button onClick={() => handleShowDetails(order)} disabled={!order.komerce_order_no} className="text-sm font-medium text-pink-600 hover:underline disabled:text-gray-500 disabled:no-underline">
                                        {order.order_number}
                                    </button>
                                    <div className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{order.customers.first_name} {order.customers.last_name}</div>
                                    <div className="text-sm text-gray-500">{order.customers.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rp{order.total_amount.toLocaleString('id-ID')}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        order.status === 'paid' ? 'bg-green-100 text-green-800' :
                                        order.status === 'label_created' ? 'bg-purple-100 text-purple-800' :
                                        order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                                        order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
                                        order.status === 'failed' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {order.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                     {order.status === 'pending_payment' && (
                                         <button onClick={() => handleVerifyPayment(order)} disabled={actionLoading[`check-${order.order_number}`]} className="bg-yellow-500 text-white px-2 py-1 rounded disabled:bg-yellow-300">
                                            {actionLoading[`check-${order.order_number}`] ? 'Verifying...' : 'Verify'}
                                        </button>
                                    )}
                                    {order.status === 'paid' && (
                                        <button onClick={() => handleSubmitToKomerce(order)} disabled={actionLoading[`submit-${order.id}`]} className="bg-blue-500 text-white px-2 py-1 rounded disabled:bg-blue-300">
                                            {actionLoading[`submit-${order.id}`] ? 'Submitting...' : 'Submit to Komerce'}
                                        </button>
                                    )}
                                    {order.status === 'processing' && (
                                         <button onClick={() => handleArrangePickup(order)} disabled={actionLoading[`pickup-${order.order_number}`]} className="bg-green-500 text-white px-2 py-1 rounded disabled:bg-green-300">
                                            {actionLoading[`pickup-${order.order_number}`] ? 'Arranging...' : 'Arrange Pickup'}
                                        </button>
                                    )}
                                     {(order.status === 'label_created' || order.status === 'shipped') && (
                                        <button onClick={() => handlePrintWaybill(order)} disabled={actionLoading[`waybill-${order.order_number}`]} className="bg-gray-500 text-white px-2 py-1 rounded disabled:bg-gray-300">
                                            {actionLoading[`waybill-${order.order_number}`] ? 'Printing...' : 'Print Label'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {orders.length === 0 && <div className="text-center py-8 text-gray-500">No orders found.</div>}
            </div>
        </div>
    );
};


const ProductsManager: React.FC = () => {
    return <div className="text-gray-500">Product management UI is not implemented in this snippet.</div>;
};


const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'marketing'>('orders');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'orders':
        return <OrdersManager />;
      case 'products':
        return <ProductsManager />;
      case 'marketing':
        return <MarketingView />;
      default:
        return null;
    }
  };

  const TabButton: React.FC<{ tabName: 'orders' | 'products' | 'marketing', label: string }> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 text-sm font-medium rounded-md ${
        activeTab === tabName ? 'bg-pink-500 text-white' : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="flex space-x-2 border-b mb-6">
        <TabButton tabName="orders" label="My Orders" />
        <TabButton tabName="products" label="Products" />
        <TabButton tabName="marketing" label="Marketing" />
      </div>
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminView;