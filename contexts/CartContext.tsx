import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import type { CartItem, Product, ProductVariant } from '../types';
import { useAuth } from './AuthContext';
import { supabaseService } from '../services/supabaseService';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, variant: ProductVariant, quantity: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  cartCount: number;
  cartTotal: number;
  isLoading: boolean;
  error: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchCart = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setCartItems([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const items = await supabaseService.getUserCart();
      setCartItems(items);
    } catch (err: any) {
      setError(err.message || 'Failed to load cart.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Fetch cart only when auth is done loading and we have a user.
    if (!authLoading) {
      fetchCart();
    }
  }, [authLoading, fetchCart]);

  const addToCart = async (product: Product, variant: ProductVariant, quantity: number) => {
    try {
      await supabaseService.addUserCartItem(variant.id, quantity);
      await fetchCart(); // Refresh cart from DB
    } catch (err: any) {
      setError(err.message || 'Failed to add item to cart.');
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    try {
      await supabaseService.removeUserCartItem(cartItemId);
      await fetchCart(); // Refresh
    } catch (err: any) {
      setError(err.message || 'Failed to remove item from cart.');
    }
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(cartItemId);
    } else {
      try {
        await supabaseService.updateUserCartItemQuantity(cartItemId, quantity);
        await fetchCart(); // Refresh
      } catch (err: any) {
        setError(err.message || 'Failed to update item quantity.');
      }
    }
  };

  const clearCart = async () => {
    try {
      await supabaseService.clearUserCart();
      setCartItems([]); // Optimistic update
    } catch (err: any) {
      setError(err.message || 'Failed to clear cart.');
    }
  };

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = cartItems.reduce((acc, item) => acc + item.variant.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal, isLoading, error }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};