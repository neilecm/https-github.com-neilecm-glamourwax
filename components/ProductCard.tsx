
import React from 'react';
import type { Product } from '../types';
import { useCart } from '../contexts/CartContext';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
    const { addToCart } = useCart();
    const handleAddToCart = (e: React.MouseEvent) => {
        e.stopPropagation();
        addToCart(product, 1);
    };

  return (
    <div 
      className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 cursor-pointer group"
      onClick={() => onClick(product)}
    >
      <div className="relative h-64">
        <img className="w-full h-full object-cover" src={product.imageUrl} alt={product.name} />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300"></div>
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
