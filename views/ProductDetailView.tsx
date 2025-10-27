
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import type { Product } from '../types';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import Spinner from '../components/Spinner';

interface ProductDetailViewProps {
  productId: string;
  onBack: () => void;
}

const ProductDetailView: React.FC<ProductDetailViewProps> = ({ productId, onBack }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

  useEffect(() => {
    const fetchProduct = async () => {
      setIsLoading(true);
      const data = await supabaseService.getProductById(productId);
      setProduct(data);
      setIsLoading(false);
    };
    fetchProduct();
  }, [productId]);
  
  const handleAddToCart = () => {
      if (product) {
          addToCart(product, quantity);
      }
  };

  const handleWishlistToggle = () => {
    if (!product) return;
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  if (isLoading) {
    return <Spinner />;
  }

  if (!product) {
    return <div className="text-center">Product not found.</div>;
  }

  const isWishlisted = isInWishlist(product.id);

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <button onClick={onBack} className="mb-6 text-pink-500 hover:text-pink-700">&larr; Back to Shop</button>
      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-1/2">
          <img src={product.imageUrl} alt={product.name} className="w-full h-auto object-cover rounded-lg" />
        </div>
        <div className="md:w-1/2">
          <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
          <p className="text-gray-500 text-lg mb-4">{product.category}</p>
          <p className="text-3xl font-bold text-pink-500 mb-6">Rp{product.price.toLocaleString('id-ID')}</p>
          <p className="text-gray-700 leading-relaxed mb-6">{product.longDescription}</p>
          
          <div className="flex items-center gap-4 mb-6">
            <label htmlFor="quantity" className="font-semibold">Quantity:</label>
            <input 
              type="number" 
              id="quantity"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20 p-2 border border-gray-300 rounded-md text-center"
            />
          </div>
          
          <div className="flex items-center gap-4">
             <button 
                onClick={handleAddToCart}
                className="flex-grow bg-pink-500 text-white py-3 rounded-lg text-lg font-semibold hover:bg-pink-600 transition-colors"
             >
                Add to Cart
             </button>
             <button
                onClick={handleWishlistToggle}
                className={`p-3 border rounded-lg transition-colors ${isWishlisted ? 'bg-pink-100 border-pink-500 text-pink-500' : 'border-gray-300 text-gray-500 hover:bg-gray-100'}`}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isWishlisted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 016.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                </svg>
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailView;
