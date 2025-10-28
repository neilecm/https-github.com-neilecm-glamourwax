
import React, { useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useAuth } from '../contexts/AuthContext';
import type { AppView } from '../App';
import { View } from '../App';

interface HeaderProps {
  onNavigate: (view: AppView) => void;
}

const UserMenu: React.FC<{ onNavigate: (view: AppView) => void }> = ({ onNavigate }) => {
    const { profile, signOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    const handleLogout = async () => {
        await signOut();
        onNavigate({ name: View.HOME });
    };

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600 hover:text-pink-500 transition-colors">
                Hi, {profile?.full_name?.split(' ')[0] || 'User'}
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
};

const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { session, isAdmin } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <button onClick={() => onNavigate({ name: View.HOME })} className="text-2xl font-bold text-pink-500 tracking-wider">
          Cera Brasileira
        </button>
        <nav className="flex items-center space-x-6">
          <button onClick={() => onNavigate({ name: View.HOME })} className="text-gray-600 hover:text-pink-500 transition-colors">
            Shop
          </button>
          <button 
            onClick={() => onNavigate({ name: View.TUTORIAL })} 
            className="text-gray-600 hover:text-pink-500 transition-colors"
          >
            AI Waxing Tutor
          </button>
          {session && isAdmin && (
            <button 
              onClick={() => onNavigate({ name: View.ADMIN })} 
              className="text-gray-600 hover:text-pink-500 transition-colors"
            >
              Admin Dashboard
            </button>
          )}
          <button onClick={() => onNavigate({ name: View.CONTACT })} className="text-gray-600 hover:text-pink-500 transition-colors">
            Contact
          </button>

          {session ? (
            <UserMenu onNavigate={onNavigate} />
          ) : (
            <button onClick={() => onNavigate({ name: View.AUTH })} className="text-gray-600 hover:text-pink-500 transition-colors">
                Login
            </button>
          )}

          <button onClick={() => onNavigate({ name: View.WISHLIST })} className="relative text-gray-600 hover:text-pink-500 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 016.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
             </svg>
             {wishlistCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {wishlistCount}
              </span>
            )}
          </button>
          <button onClick={() => onNavigate({ name: View.CART })} className="relative text-gray-600 hover:text-pink-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;