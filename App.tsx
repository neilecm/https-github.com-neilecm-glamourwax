import React, { useState, useCallback, useEffect } from 'react';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import HomeView from './views/HomeView';
import ProductDetailView from './views/ProductDetailView';
import CartView from './views/CartView';
import CheckoutView from './views/CheckoutView';
import OrderConfirmationView from './views/OrderConfirmationView';
import AdminView from './views/AdminView';
import WishlistView from './views/WishlistView';
import Footer from './components/Footer';
import PaymentPendingView from './views/PaymentPendingView';
import PaymentFailedView from './views/PaymentFailedView';
import ContactView from './views/ContactView';
import AuthView from './views/AuthView';
import TutorialView from './views/TutorialView';
import Spinner from './components/Spinner';
import AboutUsView from './views/AboutUsView';


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
  AUTH,
  TUTORIAL,
  ABOUT_US,
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
  | { name: View.CONTACT }
  | { name: View.AUTH }
  | { name: View.ABOUT_US }
  | { name: View.TUTORIAL };

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>({ name: View.HOME });
  const [intendedView, setIntendedView] = useState<AppView | null>(null);
  const { session, loading, isAdmin } = useAuth();

  const navigate = useCallback((view: AppView) => {
    // Protected route logic
    const protectedViews: View[] = [View.TUTORIAL];
    if (protectedViews.includes(view.name) && !session) {
        setIntendedView(view);
        setCurrentView({ name: View.AUTH });
    } else if (view.name === View.ADMIN && (!session || !isAdmin)) {
        // Admin-only route.
        if (!session) {
            // If not logged in at all, go to login first
            setIntendedView(view); 
            setCurrentView({ name: View.AUTH });
        } else {
            // Logged in but not an admin, just go home.
            setCurrentView({ name: View.HOME });
        }
    } else {
        setCurrentView(view);
    }
    window.scrollTo(0, 0);
  }, [session, isAdmin]);

  // This effect handles redirection after a successful login.
  useEffect(() => {
    if (session && currentView.name === View.AUTH) {
      // If the intended view was admin and the user is NOT an admin, redirect home.
      if (intendedView?.name === View.ADMIN && !isAdmin) {
          navigate({ name: View.HOME });
      } else {
          navigate(intendedView || { name: View.HOME });
      }
      setIntendedView(null);
    }
  }, [session, currentView.name, navigate, intendedView, isAdmin]);


  const renderView = () => {
    if (loading) {
        return <div className="pt-32"><Spinner /></div>;
    }
    
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
        // Double check auth and admin status before rendering
        return session && isAdmin ? <AdminView /> : <HomeView onProductClick={(product) => navigate({ name: View.PRODUCT_DETAIL, productId: product.id })} />;
      case View.WISHLIST:
        return <WishlistView onProductClick={(product) => navigate({ name: View.PRODUCT_DETAIL, productId: product.id })} />;
      case View.CONTACT:
        return <ContactView />;
      case View.AUTH:
        // The onLoginSuccess prop no longer needs to handle navigation, as the useEffect does it.
        return <AuthView onLoginSuccess={() => {}} />;
      case View.TUTORIAL:
        // Double check auth status before rendering
        return session ? <TutorialView /> : <AuthView onLoginSuccess={() => {}} />;
      case View.ABOUT_US:
        return <AboutUsView />;
      default:
        return <HomeView onProductClick={(product) => navigate({ name: View.PRODUCT_DETAIL, productId: product.id })} />;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--natural-beige)', color: 'var(--dark-text)' }}>
      <Header onNavigate={navigate} />
      <main className="container mx-auto px-4 py-8 pt-24">
        {renderView()}
      </main>
      <Footer onNavigate={navigate} />
    </div>
  );
}


const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <AppContent />
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
