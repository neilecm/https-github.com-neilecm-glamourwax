import React from 'react';
import { useCart } from '../contexts/CartContext';

interface CartViewProps {
  onCheckout: () => void;
}

const CartView: React.FC<CartViewProps> = ({ onCheckout }) => {
  const { cartItems, removeFromCart, updateQuantity, cartTotal } = useCart();

  if (cartItems.length === 0) {
    return (
      <div className="text-center bg-white p-12 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
        <p className="text-gray-600">Looks like you haven't added anything to your cart yet.</p>
      </div>
    );
  }

  return (
    <div id="cart" className="bg-white p-8 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold mb-6" style={{ color: 'var(--brand-red)' }}>Your Cart</h1>
      <div className="divide-y divide-gray-200">
        {cartItems.map(item => (
          <div key={item.cartItemId} className="flex items-center py-4">
            <img 
              src={item.variant.imageUrls?.[0] || 'https://placehold.co/100x100?text=No+Img'} 
              alt={item.variant.name} 
              className="w-24 h-24 object-cover rounded-md" 
            />
            <div className="flex-grow ml-4">
              <h2 className="font-semibold">{item.product.name}</h2>
              <p className="text-sm text-gray-500">{item.variant.name}</p>
              <p className="text-sm text-gray-500">Rp{item.variant.price.toLocaleString('id-ID')}</p>
            </div>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                min="1" 
                value={item.quantity} 
                onChange={e => updateQuantity(item.cartItemId, parseInt(e.target.value, 10))}
                className="w-16 p-2 border border-gray-300 rounded-md text-center"
              />
              <p className="w-28 text-right font-semibold">Rp{(item.variant.price * item.quantity).toLocaleString('id-ID')}</p>
              <button onClick={() => removeFromCart(item.cartItemId)} className="text-red-500 hover:text-red-700 text-2xl font-bold">
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-right">
        <h2 className="text-2xl font-bold">Total: Rp{cartTotal.toLocaleString('id-ID')}</h2>
        <p className="text-gray-500">Shipping calculated at checkout</p>
        <button onClick={onCheckout} className="mt-4 text-white px-8 py-3 rounded-lg font-semibold transition-colors" style={{ background: 'var(--brand-red)' }}>
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
};

export default CartView;
