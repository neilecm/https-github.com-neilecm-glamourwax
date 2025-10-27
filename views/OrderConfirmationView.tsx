
import React from 'react';

interface OrderConfirmationViewProps {
  orderId: string;
  onBackToHome: () => void;
}

const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({ orderId, onBackToHome }) => {
  return (
    <div className="text-center bg-white p-12 rounded-lg shadow-xl max-w-2xl mx-auto">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Thank You For Your Order!</h1>
      <p className="text-gray-600 mb-6">Your payment was successful and your order is being processed.</p>
      <div className="bg-gray-100 p-4 rounded-md inline-block">
        <p className="text-gray-700">Your Order ID is: <span className="font-bold text-pink-600">{orderId}</span></p>
      </div>
      <p className="text-gray-600 mt-6">You will receive an email confirmation shortly.</p>
      <button 
        onClick={onBackToHome}
        className="mt-8 bg-pink-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-pink-600 transition-colors"
      >
        Continue Shopping
      </button>
    </div>
  );
};

export default OrderConfirmationView;
