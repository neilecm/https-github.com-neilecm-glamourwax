import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isAnonymous: boolean;
  signOut: () => Promise<void>;
  authEvent: AuthChangeEvent | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [authEvent, setAuthEvent] = useState<AuthChangeEvent | null>(null);
  
  // Use a ref for the sign-out flag to prevent the useEffect from re-running.
  // This makes the auth listener much more stable.
  const explicitlySigningOut = useRef(false);

  const fetchProfile = useCallback(async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116: no rows found

      if (data) {
        setProfile(data);
      } else if (!user.is_anonymous) {
        console.log(`Profile for user ${user.id} not found. Attempting client-side creation as a fallback.`);
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata.full_name || user.email,
            phone_number: user.user_metadata.phone_number || null,
          })
          .select()
          .single();

        if (createError) {
          console.warn(
            `Client-side profile creation failed: "${createError.message}". ` +
            `This is likely due to a restrictive Row Level Security (RLS) policy. ` +
            `To fix this permanently, ensure you have a DB trigger that creates a profile for new users, ` +
            `or adjust your RLS policy to allow users to insert their own profile.`
          );
          setProfile(null);
        } else {
          console.log(`Successfully created profile for user ${user.id} via client-side fallback.`);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error.message);
      setProfile(null);
    }
  }, []);

  const checkAdminStatus = useCallback(async (userEmail: string | undefined) => {
    if (!userEmail) {
      setIsAdmin(false);
      return;
    }
    try {
      const { data: { adminEmail }, error } = await supabase.functions.invoke('get-admin-email');
      if (error) throw error;
      setIsAdmin(userEmail === adminEmail);
    } catch (error: any) {
      console.error("Failed to check admin status:", error.message);
      setIsAdmin(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    explicitlySigningOut.current = true; // Set ref before calling signOut
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
      explicitlySigningOut.current = false; // Reset ref on error
    }
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setAuthEvent(_event);

      if (newSession) {
        setSession(newSession);
        const currentUser = newSession.user;
        setUser(currentUser);
        setIsAnonymous(currentUser.is_anonymous);
        await fetchProfile(currentUser);
        await checkAdminStatus(currentUser.email);
        explicitlySigningOut.current = false; // A new session is active, reset the flag.
        setLoading(false);
      } else { // newSession is null
        // Create a new anonymous session ONLY if this is the first load OR if the user explicitly clicked sign out.
        if (_event === 'INITIAL_SESSION' || explicitlySigningOut.current) {
          explicitlySigningOut.current = false; // Reset ref
          const { error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error("Critical failure: Could not sign in anonymously.", error);
            setLoading(false); // Stop loading if guest session fails
          }
          // The listener will re-fire with the new anonymous session, no need to set state here.
        } else {
          // For other SIGNED_OUT events (like during a login flow), just clear the state and wait for the subsequent SIGNED_IN event.
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setIsAnonymous(false);
          setLoading(false);
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfile, checkAdminStatus]); // Dependencies are now stable, effect runs only once.

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    isAdmin,
    isAnonymous,
    signOut,
    authEvent,
  }), [session, user, profile, loading, isAdmin, isAnonymous, signOut, authEvent]);

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
