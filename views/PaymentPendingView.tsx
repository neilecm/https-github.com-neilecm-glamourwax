import React from 'react';

interface PaymentPendingViewProps {
  orderId: string;
  onBackToHome: () => void;
}

const PaymentPendingView: React.FC<PaymentPendingViewProps> = ({ orderId, onBackToHome }) => {
  return (
    <div className="text-center bg-white p-12 rounded-lg shadow-xl max-w-2xl mx-auto">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-yellow-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Waiting For Payment</h1>
      <p className="text-gray-600 mb-6">Your order has been placed and is waiting for payment confirmation.</p>
      <div className="bg-gray-100 p-4 rounded-md inline-block">
        <p className="text-gray-700">Your Midtrans Order ID is: <span className="font-bold text-pink-600">{orderId}</span></p>
      </div>
      <p className="text-gray-600 mt-6">Please follow the instructions provided by Midtrans to complete your payment. Instructions have also been sent to your email.</p>
      <button 
        onClick={onBackToHome}
        className="mt-8 bg-pink-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-pink-600 transition-colors"
      >
        Continue Shopping
      </button>
    </div>
  );
};

export default PaymentPendingView;