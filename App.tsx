

import React, { useState, useCallback } from 'react';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import Header from './components/Header';
import HomeView from './views/HomeView';
import ProductDetailView from './views/ProductDetailView';
import CartView from './views/CartView';
import CheckoutView from './views/CheckoutView';
import OrderConfirmationView from './views/OrderConfirmationView';
import AdminView from './views/AdminView';
import WishlistView from './views/WishlistView';
import Footer from './components/Footer';
import type { Product } from './types';
import PaymentPendingView from './views/PaymentPendingView';
import PaymentFailedView from './views/PaymentFailedView';
import ContactView from './views/ContactView';

export enum View {
  HOME,
  PRODUCT_DETAIL,
  CART,
  CHECKOUT,
  CONFIRMATION,
  ADMIN,
  PENDING,
  FAILED,
  WISHLIST,
  CONTACT,
}

export type AppView =
  | { name: View.HOME }
  | { name: View.PRODUCT_DETAIL; productId: string }
  | { name: View.CART }
  | { name: View.CHECKOUT }
  | { name: View.CONFIRMATION; orderId: string }
  | { name: View.ADMIN }
  | { name: View.PENDING; orderId: string }
  | { name: View.FAILED; message: string }
  | { name: View.WISHLIST }
  | { name: View.CONTACT };

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>({ name: View.HOME });

  const navigate = useCallback((view: AppView) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  }, []);

  const renderView = () => {
    switch (currentView.name) {
      case View.HOME:
        return <HomeView onProductClick={(product) => navigate({ name: View.PRODUCT_DETAIL, productId: product.id })} />;
      case View.PRODUCT_DETAIL:
        return <ProductDetailView productId={currentView.productId} onBack={() => navigate({ name: View.HOME })} />;
      case View.CART:
        return <CartView onCheckout={() => navigate({ name: View.CHECKOUT })} />;
      case View.CHECKOUT:
        return (
          <CheckoutView 
            onOrderSuccess={(orderId) => navigate({ name: View.CONFIRMATION, orderId })}
            onOrderPending={(orderId) => navigate({ name: View.PENDING, orderId })}
            onOrderFailed={(message) => navigate({ name: View.FAILED, message })}
          />
        );
      case View.CONFIRMATION:
        return <OrderConfirmationView orderId={currentView.orderId} onBackToHome={() => navigate({ name: View.HOME })} />;
       case View.PENDING:
        return <PaymentPendingView orderId={currentView.orderId} onBackToHome={() => navigate({ name: View.HOME })} />;
      case View.FAILED:
        return <PaymentFailedView errorMessage={currentView.message} onBackToHome={() => navigate({ name: View.HOME })} onRetry={() => navigate({ name: View.CART })} />;
      case View.ADMIN:
        return <AdminView />;
      case View.WISHLIST:
        return <WishlistView onProductClick={(product) => navigate({ name: View.PRODUCT_DETAIL, productId: product.id })} />;
      case View.CONTACT:
        return <ContactView />;
      default:
        return <HomeView onProductClick={(product) => navigate({ name: View.PRODUCT_DETAIL, productId: product.id })} />;
    }
  };

  return (
    <CartProvider>
      <WishlistProvider>
        <div className="bg-gray-50 min-h-screen text-gray-800">
          <Header onNavigate={navigate} />
          <main className="container mx-auto px-4 py-8 pt-24">
            {renderView()}
          </main>
          <Footer onNavigate={navigate} />
        </div>
      </WishlistProvider>
    </CartProvider>
  );
};

export default App;
