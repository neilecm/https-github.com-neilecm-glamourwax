
import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';

import Header from './components/Header';
import Footer from './components/Footer';
import HomeView from './views/HomeView';
import ProductDetailView from './views/ProductDetailView';
import CartView from './views/CartView';
import CheckoutView from './views/CheckoutView';
import OrderConfirmationView from './views/OrderConfirmationView';
import PaymentPendingView from './views/PaymentPendingView';
import PaymentFailedView from './views/PaymentFailedView';
import AuthView from './views/AuthView';
import AdminView from './views/AdminView';
import WishlistView from './views/WishlistView';
import ContactView from './views/ContactView';
import TutorialView from './views/TutorialView';
import AboutUsView from './views/AboutUsView';
import ReviewsView from './views/ReviewsView';
import AccountView from './views/AccountView';

import type { Product } from './types';

// Define the different views the app can have
export enum View {
  HOME,
  PRODUCT_DETAIL,
  CART,
  CHECKOUT,
  ORDER_SUCCESS,
  ORDER_PENDING,
  ORDER_FAILED,
  AUTH,
  ADMIN,
  ACCOUNT,
  WISHLIST,
  CONTACT,
  TUTORIAL,
  ABOUT_US,
  REVIEWS,
}

// Define the shape of the view state
export type AppView =
  | { name: View.HOME }
  | { name: View.PRODUCT_DETAIL; product: Product }
  | { name: View.CART }
  | { name: View.CHECKOUT }
  | { name: View.ORDER_SUCCESS; orderId: string }
  | { name: View.ORDER_PENDING; orderId: string }
  | { name: View.ORDER_FAILED; message: string }
  | { name: View.AUTH }
  | { name: View.ADMIN }
  | { name: View.ACCOUNT }
  | { name: View.WISHLIST }
  | { name: View.CONTACT }
  | { name: View.TUTORIAL }
  | { name: View.ABOUT_US }
  | { name: View.REVIEWS };

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>({ name: View.HOME });

  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    window.scrollTo(0, 0); // Scroll to top on view change
  };

  const renderView = () => {
    switch (currentView.name) {
      case View.HOME:
        return <HomeView onProductClick={(product) => handleNavigate({ name: View.PRODUCT_DETAIL, product })} />;
      case View.PRODUCT_DETAIL:
        return <ProductDetailView productId={currentView.product.id} onBack={() => handleNavigate({ name: View.HOME })} />;
      case View.CART:
        return <CartView onCheckout={() => handleNavigate({ name: View.CHECKOUT })} />;
      case View.CHECKOUT:
        return <CheckoutView
          onOrderSuccess={(orderId) => handleNavigate({ name: View.ORDER_SUCCESS, orderId })}
          onOrderPending={(orderId) => handleNavigate({ name: View.ORDER_PENDING, orderId })}
          onOrderFailed={(message) => handleNavigate({ name: View.ORDER_FAILED, message })}
          onAuthRedirect={() => handleNavigate({ name: View.AUTH })}
        />;
      case View.ORDER_SUCCESS:
        return <OrderConfirmationView orderId={currentView.orderId} onBackToHome={() => handleNavigate({ name: View.HOME })} />;
      case View.ORDER_PENDING:
        return <PaymentPendingView orderId={currentView.orderId} onBackToHome={() => handleNavigate({ name: View.HOME })} />;
       case View.ORDER_FAILED:
        return <PaymentFailedView errorMessage={currentView.message} onBackToHome={() => handleNavigate({ name: View.HOME })} onRetry={() => handleNavigate({ name: View.CHECKOUT })} />;
      case View.AUTH:
        return <AuthView onLoginSuccess={() => handleNavigate({ name: View.HOME })} />;
      case View.ADMIN:
        return <AdminView />;
      case View.ACCOUNT:
        return <AccountView onNavigate={handleNavigate} />;
      case View.WISHLIST:
        return <WishlistView onProductClick={(product) => handleNavigate({ name: View.PRODUCT_DETAIL, product })} />;
      case View.CONTACT:
        return <ContactView />;
      case View.TUTORIAL:
        return <TutorialView />;
      case View.ABOUT_US:
        return <AboutUsView />;
      case View.REVIEWS:
        return <ReviewsView />;
      default:
        return <HomeView onProductClick={(product) => handleNavigate({ name: View.PRODUCT_DETAIL, product })} />;
    }
  };

  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <div className="flex flex-col min-h-screen bg-gray-50">
            <Header onNavigate={handleNavigate} />
            <main className="flex-grow container mx-auto px-4 py-8 pt-24">
              {renderView()}
            </main>
            <Footer onNavigate={handleNavigate} />
          </div>
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
};

export default App;
