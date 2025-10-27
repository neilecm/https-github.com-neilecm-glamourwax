import React from 'react';

interface PaymentFailedViewProps {
  errorMessage: string;
  onBackToHome: () => void;
  onRetry: () => void;
}

const PaymentFailedView: React.FC<PaymentFailedViewProps> = ({ errorMessage, onBackToHome, onRetry }) => {
  return (
    <div className="text-center bg-white p-12 rounded-lg shadow-xl max-w-2xl mx-auto">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Failed</h1>
      <p className="text-gray-600 mb-6">Unfortunately, we were unable to process your payment.</p>
      <div className="bg-red-50 text-red-700 p-4 rounded-md">
        <p className="font-semibold">Reason:</p>
        <p>{errorMessage}</p>
      </div>
      <p className="text-gray-600 mt-6">Please try again, or use a different payment method.</p>
      <div className="flex justify-center gap-4 mt-8">
        <button 
          onClick={onRetry}
          className="bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
        >
          Try Again
        </button>
        <button 
          onClick={onBackToHome}
          className="bg-pink-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-pink-600 transition-colors"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
};

export default PaymentFailedView;