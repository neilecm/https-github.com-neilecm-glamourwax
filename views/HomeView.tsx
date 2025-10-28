import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import type { Product } from '../types';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';

interface HomeViewProps {
  onProductClick: (product: Product) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onProductClick }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await supabaseService.getProducts();
        setProducts(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch products. Please ensure your Supabase credentials are correct and the service is running.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  if (isLoading) {
    return <Spinner />;
  }

  if (error) {
    return <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</div>;
  }

  return (
    <div>
      <section id="hero" className="rounded-xl mb-12">
        <h2>Premium Brazilian Waxing Essentials</h2>
        <p>Natural, effective, and crafted for smooth confidence — shop our curated collection.</p>
        <a href="#products">Shop Now</a>
      </section>
      {products.length > 0 ? (
        <section id="products">
          <h2>Our Collection</h2>
          <div className="products-grid">
          {products.map(product => (
            <ProductCard key={product.id} product={product} onClick={onProductClick} />
          ))}
          </div>
        </section>
      ) : (
         <div className="text-center bg-white p-12 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">The Boutique is Currently Empty</h2>
            <p className="text-gray-500">It looks like there are no products to display. Go to the Admin Dashboard to add some!</p>
         </div>
      )}
    </div>
  );
};

export default HomeView;
