
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabaseService } from '../services/supabaseService';
import Spinner from '../components/Spinner';
import type { FullOrder } from '../types';
import type { AppView } from '../App';

interface AccountViewProps {
  onNavigate: (view: AppView) => void;
}

const getStatusBadgeClass = (status: FullOrder['status']) => {
    switch (status) {
        case 'paid':
        case 'processing':
        case 'label_created':
        case 'shipped':
        case 'delivered':
            return 'bg-green-100 text-green-800';
        case 'pending_payment':
            return 'bg-yellow-100 text-yellow-800';
        case 'failed':
        case 'cancelled':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const AccountView: React.FC<AccountViewProps> = ({ onNavigate }) => {
  const { profile, user } = useAuth();
  const [orders, setOrders] = useState<FullOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserOrders = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const userOrders = await supabaseService.getUserOrders();
        setOrders(userOrders);
      } catch (err: any) {
        setError(err.message || "Failed to fetch your orders.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserOrders();
  }, [user]);
  
  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">My Account</h1>
      
      {/* Profile Section */}
      <section className="mb-8 p-6 bg-gray-50 rounded-lg border">
        <h2 className="text-2xl font-semibold mb-4">My Profile</h2>
        {profile ? (
          <div className="space-y-2">
            <p><strong>Name:</strong> {profile.full_name}</p>
            <p><strong>Email:</strong> {profile.email}</p>
            <p><strong>Phone:</strong> {profile.phone_number || 'Not provided'}</p>
          </div>
        ) : (
          <p className="text-gray-500">Loading profile...</p>
        )}
      </section>

      {/* Order History Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">My Order History</h2>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <div className="text-red-500 bg-red-100 p-4 rounded-lg">{error}</div>
        ) : orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map(order => (
                        <tr key={order.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.order_number}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rp{order.total_amount.toLocaleString('id-ID')}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(order.status)}`}>
                                    {order.status.replace('_', ' ')}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 bg-gray-50 p-8 rounded-lg">
            <p>You haven't placed any orders yet.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default AccountView;
