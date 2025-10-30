import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import type { Product } from '../types';
import { useAuth } from './AuthContext';
import { supabaseService } from '../services/supabaseService';

interface WishlistContextType {
  wishlistItems: Product[];
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  wishlistCount: number;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setWishlistItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const items = await supabaseService.getUserWishlist();
      setWishlistItems(items);
    } catch (err) {
      console.error("Failed to load wishlist", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchWishlist();
    }
  }, [authLoading, fetchWishlist]);

  const addToWishlist = async (product: Product) => {
    await supabaseService.addUserWishlistItem(product.id);
    await fetchWishlist(); // Refresh
  };

  const removeFromWishlist = async (productId: string) => {
    await supabaseService.removeUserWishlistItem(productId);
    await fetchWishlist(); // Refresh
  };

  const isInWishlist = useCallback((productId: string) => {
    return wishlistItems.some(item => item.id === productId);
  }, [wishlistItems]);

  const wishlistCount = wishlistItems.length;

  return (
    <WishlistContext.Provider value={{ wishlistItems, addToWishlist, removeFromWishlist, isInWishlist, wishlistCount, isLoading }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};