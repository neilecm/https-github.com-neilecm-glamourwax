import React from 'react';
import type { Product } from '../types';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';

// Heart Icon Component
const HeartIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 016.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
    </svg>
);


interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
    const { addToCart } = useCart();
    const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

    const handleAddToCart = (e: React.MouseEvent) => {
        e.stopPropagation();
        addToCart(product, 1);
    };

    const handleWishlistToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isInWishlist(product.id)) {
            removeFromWishlist(product.id);
        } else {
            addToWishlist(product);
        }
    };

    const isWishlisted = isInWishlist(product.id);
    const imageUrl = product.imageUrls?.[0] || 'https://placehold.co/600x400?text=No+Image';

  return (
    <div 
      className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 cursor-pointer group"
      onClick={() => onClick(product)}
    >
      <div className="relative h-64">
        <img className="w-full h-full object-cover" src={imageUrl} alt={product.name} />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300"></div>
        <button 
          onClick={handleWishlistToggle} 
          className={`absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-2 transition-colors z-10 ${isWishlisted ? 'text-pink-500' : 'text-gray-500 hover:text-pink-500'}`}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <HeartIcon filled={isWishlisted} />
        </button>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 truncate">{product.name}</h3>
        <p className="text-gray-500 mt-1">{product.category}</p>
        <div className="flex justify-between items-center mt-4">
          <span className="text-xl font-bold text-pink-500">Rp{product.price.toLocaleString('id-ID')}</span>
          <button 
            onClick={handleAddToCart}
            className="bg-pink-500 text-white px-4 py-2 rounded-full hover:bg-pink-600 transition-colors transform hover:scale-105"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;