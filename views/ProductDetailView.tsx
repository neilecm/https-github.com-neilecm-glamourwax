
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import type { Product } from '../types';
import { useCart } from '../contexts/CartContext';
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

  if (isLoading) {
    return <Spinner />;
  }

  if (!product) {
    return <div className="text-center">Product not found.</div>;
  }

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
          
          <button 
            onClick={handleAddToCart}
            className="w-full bg-pink-500 text-white py-3 rounded-lg text-lg font-semibold hover:bg-pink-600 transition-colors"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailView;
