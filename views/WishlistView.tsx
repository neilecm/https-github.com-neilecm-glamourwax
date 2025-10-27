import React, { useState } from 'react';
import { useWishlist } from '../contexts/WishlistContext';
import { useCart } from '../contexts/CartContext';
import type { Product } from '../types';

interface WishlistViewProps {
  onProductClick: (product: Product) => void;
}

const WishlistView: React.FC<WishlistViewProps> = ({ onProductClick }) => {
  const { wishlistItems, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [addStates, setAddStates] = useState<Record<string, 'idle' | 'adding' | 'added'>>({});

  if (wishlistItems.length === 0) {
    return (
      <div className="text-center bg-white p-12 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-4">Your Wishlist is Empty</h1>
        <p className="text-gray-600">Explore our collection and add your favorite items by clicking the heart icon.</p>
      </div>
    );
  }

  const handleAction = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const hasVariants = product.variants && product.variants.length > 1;
    const defaultVariant = product.variants?.[0];
    const addState = addStates[product.id] || 'idle';

    if (hasVariants) {
      onProductClick(product);
    } else if (defaultVariant && addState === 'idle') {
      setAddStates(prev => ({ ...prev, [product.id]: 'adding' }));
      setTimeout(() => {
        addToCart(product, defaultVariant, 1);
        setAddStates(prev => ({ ...prev, [product.id]: 'added' }));
        setTimeout(() => {
          removeFromWishlist(product.id);
        }, 1000); // Wait 1s before removing from wishlist to show feedback
      }, 300);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold mb-6">My Wishlist</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {wishlistItems.map(item => {
            const hasMultipleVariants = item.variants && item.variants.length > 1;
            const isAvailable = item.variants && item.variants.length > 0;
            const price = item.variants?.[0]?.price || 0;
            const addState = addStates[item.id] || 'idle';

            const getButtonState = () => {
                if (hasMultipleVariants) {
                    return { text: 'View Options', disabled: false, className: 'bg-pink-500 hover:bg-pink-600' };
                }
                if (!isAvailable) {
                    return { text: 'Unavailable', disabled: true, className: 'bg-gray-300' };
                }
                switch (addState) {
                    case 'adding':
                        return { text: 'Adding...', disabled: true, className: 'bg-pink-400' };
                    case 'added':
                        return { text: 'Added ✓', disabled: true, className: 'bg-green-500' };
                    case 'idle':
                    default:
                        return { text: 'Move to Cart', disabled: false, className: 'bg-pink-500 hover:bg-pink-600' };
                }
            };
            const buttonState = getButtonState();

            return (
              <div 
                key={item.id} 
                className="bg-white rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 cursor-pointer group"
                onClick={() => onProductClick(item)}
              >
                <div className="relative h-64">
                  <img className="w-full h-full object-cover" src={item.imageUrls?.[0] || 'https://placehold.co/600x400'} alt={item.name} />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWishlist(item.id);
                    }} 
                    className="absolute top-2 right-2 bg-white rounded-full p-2 text-red-500 hover:text-red-700 transition-colors z-10"
                    aria-label="Remove from wishlist"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="text-md font-semibold text-gray-800 truncate">{item.name}</h3>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-lg font-bold text-pink-500">
                        {hasMultipleVariants ? `From ` : ''}Rp{price.toLocaleString('id-ID')}
                    </span>
                    <button 
                      onClick={(e) => handleAction(e, item)}
                      disabled={buttonState.disabled}
                      className={`text-white px-3 py-1.5 rounded-full text-sm transition-colors ${buttonState.className}`}
                    >
                      {buttonState.text}
                    </button>
                  </div>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};

export default WishlistView;
