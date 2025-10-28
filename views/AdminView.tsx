// views/AdminView.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';
import { komerceService } from '../services/komerceService';
import type { FullOrder, Product, OrderStatus } from '../types';
import Spinner from '../components/Spinner';
import MarketingView from './MarketingView'; // We will render this component in one of the tabs

// Tab Component
const Tab: React.FC<{ title: string; isActive: boolean; onClick: () => void }> = ({ title, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-3 font-semibold text-sm transition-colors ${
            isActive
                ? 'border-b-2 border-pink-500 text-pink-600'
                : 'text-gray-500 hover:text-gray-700'
        }`}
    >
        {title}
    </button>
);


// Order Row Component
const OrderRow: React.FC<{ order: FullOrder; onRefresh: () => void; }> = ({ order, onRefresh }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAction = async (action: () => Promise<any>, successMessage: string) => {
        setIsSubmitting(true);
        setError(null);
        try {
            await action();
            alert(successMessage); // Simple feedback for demo purposes
            onRefresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintWaybill = async (orderNo: string) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const { base_64 } = await komerceService.printWaybill(orderNo);
            const pdfBlob = new Blob([Uint8Array.from(atob(base_64), c => c.charCodeAt(0))], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `waybill-${orderNo}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch(err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    const getStatusChip = (status: OrderStatus) => {
        const styles: Record<OrderStatus, string> = {
            'pending_payment': 'bg-yellow-100 text-yellow-800',
            'paid': 'bg-green-100 text-green-800',
            'shipped': 'bg-blue-100 text-blue-800',
            'failed': 'bg-red-100 text-red-800',
            'delivered': 'bg-purple-100 text-purple-800',
        };
        return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>{status.replace('_', ' ').toUpperCase()}</span>;
    };
    
    return (
        <tr className="border-b hover:bg-gray-50 text-sm">
            <td className="p-3">{order.order_number}</td>
            <td className="p-3">{new Date(order.created_at).toLocaleDateString()}</td>
            <td className="p-3">{order.customers?.first_name} {order.customers?.last_name}</td>
            <td className="p-3">Rp{order.total_amount.toLocaleString('id-ID')}</td>
            <td className="p-3">{getStatusChip(order.status)}</td>
            <td className="p-3 space-x-1">
                {order.status === 'paid' && !order.komerce_order_no && (
                    <button onClick={() => handleAction(() => komerceService.submitOrderToShipping(order.id), 'Order submitted to shipping partner!')} disabled={isSubmitting} className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:bg-blue-300">Submit</button>
                )}
                {order.status === 'paid' && order.komerce_order_no && !order.awb_number && (
                     <button onClick={() => handleAction(() => komerceService.arrangePickup(order.order_number), 'Pickup arranged successfully!')} disabled={isSubmitting} className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 disabled:bg-purple-300">Arrange Pickup</button>
                )}
                {order.status === 'shipped' && order.awb_number && (
                    <button onClick={() => handlePrintWaybill(order.order_number)} disabled={isSubmitting} className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 disabled:bg-gray-300">Print Label</button>
                )}
                 {isSubmitting && <Spinner />}
                 {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </td>
        </tr>
    );
};

// Order Management Tab
const OrderManagement: React.FC = () => {
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

    if (isLoading) return <Spinner />;
    if (error) return <div className="text-red-500 bg-red-100 p-4 rounded">{error}</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">All Orders</h3>
                <button onClick={fetchOrders} className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">Refresh</button>
            </div>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider">Order #</th>
                            <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                            <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider">Customer</th>
                            <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider">Total</th>
                            <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                            <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length > 0 ? (
                            orders.map(order => <OrderRow key={order.id} order={order} onRefresh={fetchOrders} />)
                        ) : (
                            <tr><td colSpan={6} className="text-center p-8 text-gray-500">No orders found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Placeholder for Product Management - a real implementation would be much larger
const ProductManagement: React.FC = () => {
    // This would contain logic to fetch, add, edit, and delete products.
    // For this fix, a placeholder is sufficient.
    return (
        <div className="bg-white p-8 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4">Product Management</h3>
            <p className="text-gray-500">
                This section would allow you to add, edit, and delete products.
                The full implementation requires creating complex forms for product and variant details.
                The necessary backend functions (`add-product`, `update-product`, `delete-product`) and client-side services are already in place.
            </p>
        </div>
    );
};


// Main Admin View Component
const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'marketing'>('orders');

    const renderContent = () => {
        switch (activeTab) {
            case 'orders':
                return <OrderManagement />;
            case 'products':
                return <ProductManagement />;
            case 'marketing':
                return <MarketingView />;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
            <div className="border-b mb-6 flex">
                <Tab title="Order Management" isActive={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
                <Tab title="Product Management" isActive={activeTab === 'products'} onClick={() => setActiveTab('products')} />
                <Tab title="Marketing Centre" isActive={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} />
            </div>
            <div>
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminView;
