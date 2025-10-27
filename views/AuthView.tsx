import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import Spinner from '../components/Spinner';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'signIn' | 'signUp'>('signIn');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signUp({
        email: formState.email,
        password: formState.password,
        options: {
          data: {
            full_name: formState.fullName,
            phone_number: formState.phone,
          },
        },
      });

      if (error) throw error;
      setMessage('Registration successful! Please check your email to confirm your account.');
      setFormState({ fullName: '', email: '', phone: '', password: '' });
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formState.email,
        password: formState.password,
      });

      if (error) throw error;
      // The onAuthStateChange listener in AuthContext will handle navigation
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // Supabase handles the redirect, no need to setLoading(false) on success
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg">
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('signIn')}
          className={`w-1/2 py-3 text-center font-semibold transition-colors ${activeTab === 'signIn' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-500'}`}
        >
          Sign In
        </button>
        <button
          onClick={() => setActiveTab('signUp')}
          className={`w-1/2 py-3 text-center font-semibold transition-colors ${activeTab === 'signUp' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-500'}`}
        >
          Sign Up
        </button>
      </div>
      
      {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</div>}
      {message && <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-sm">{message}</div>}

      {activeTab === 'signIn' ? (
        <form onSubmit={handleSignIn} className="space-y-4">
          <input type="email" name="email" placeholder="Email" value={formState.email} onChange={handleInputChange} required className="w-full p-3 border rounded-md" />
          <input type="password" name="password" placeholder="Password" value={formState.password} onChange={handleInputChange} required className="w-full p-3 border rounded-md" />
          <button type="submit" disabled={loading} className="w-full bg-pink-500 text-white p-3 rounded-md font-semibold hover:bg-pink-600 disabled:bg-pink-300">
            {loading ? <Spinner /> : 'Sign In'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="space-y-4">
          <input type="text" name="fullName" placeholder="Full Name" value={formState.fullName} onChange={handleInputChange} required className="w-full p-3 border rounded-md" />
          <input type="email" name="email" placeholder="Email" value={formState.email} onChange={handleInputChange} required className="w-full p-3 border rounded-md" />
          <input type="tel" name="phone" placeholder="Phone Number (e.g., +62812...)" value={formState.phone} onChange={handleInputChange} required className="w-full p-3 border rounded-md" />
          <input type="password" name="password" placeholder="Password" value={formState.password} onChange={handleInputChange} required className="w-full p-3 border rounded-md" />
          <button type="submit" disabled={loading} className="w-full bg-pink-500 text-white p-3 rounded-md font-semibold hover:bg-pink-600 disabled:bg-pink-300">
            {loading ? <Spinner /> : 'Create Account'}
          </button>
        </form>
      )}

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with</span>
        </div>
      </div>
      
      <div className="space-y-3">
         <button onClick={() => handleOAuthSignIn('google')} disabled={loading} className="w-full flex items-center justify-center p-3 border rounded-md hover:bg-gray-50 disabled:opacity-50">
            {/* Simple SVG for Google */}
            <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.804 9.81C34.553 5.952 29.563 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039L38.804 9.81C34.553 5.952 29.563 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.618-3.319-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 36.417 44 30.638 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
            Sign in with Google
         </button>
         <button onClick={() => handleOAuthSignIn('apple')} disabled={loading} className="w-full flex items-center justify-center p-3 border rounded-md hover:bg-gray-50 disabled:opacity-50">
            {/* Simple SVG for Apple */}
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12.01,16.16c-0.33,0-0.66-0.02-1-0.05c-1.37-0.12-2.34-0.63-3.13-1.48c-0.8-0.85-1.25-1.9-1.25-3.11 c0-2.25,1.66-3.76,4.2-3.82c0.32-0.01,0.64-0.01,0.96,0c1.4,0.11,2.33,0.6,3.15,1.44c0.4,0.42,0.63,0.9,0.76,1.43 c-2.12-0.04-3.83,1.13-3.83,2.68c0,1.25,0.96,2.01,2.44,2.01c0.3,0,0.59-0.05,0.87-0.14c-0.45,1.27-1.43,2.23-2.92,2.37 C12.8,16.14,12.4,16.16,12.01,16.16z M15.11,3.67C14.3,3.75,13.23,4.3,12.44,5.19c-0.7,0.78-1.24,1.82-1.4,2.94 c1.26-0.34,2.6-0.07,3.56,0.77c0.88,0.78,1.3,1.88,1.19,3.08c1.69-0.61,2.83-2.22,2.83-4.14c0-2.43-1.92-4.11-4.42-4.25h-0.09V3.67z"></path></svg>
            Sign in with Apple
         </button>
         <p className="text-xs text-gray-400 mt-4 text-center">
            Note: You must configure Google & Apple providers in your Supabase dashboard for these to work.
         </p>
      </div>
    </div>
  );
};

export default AuthView;
