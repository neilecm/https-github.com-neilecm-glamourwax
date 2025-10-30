import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
// FIX: Import AuthChangeEvent to explicitly type the auth state change event.
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
      } else {
        // If profile doesn't exist for a non-anonymous user, create it.
        // This handles users who signed up before the trigger was in place.
        if (!user.is_anonymous) {
          console.log(`Profile for user ${user.id} not found. Creating one.`);
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
          if (createError) throw new Error(`DB Error (Create Profile): ${createError.message}`);
          setProfile(newProfile);
        } else {
            setProfile(null);
        }
      }
    } catch (error: any) {
      console.error('Error fetching or creating profile:', error.message);
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

  useEffect(() => {
    // onAuthStateChange is the single source of truth.
    // It fires once on initial load with the current session or null.
    // It then fires again on any auth event (SIGN_IN, SIGN_OUT, etc.)
    // FIX: Explicitly type the _event parameter to improve type safety and resolve potential compiler issues.
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, newSession) => {
      setAuthEvent(_event);
      // If we have a session, it's either a real user or a guest.
      if (newSession) {
        setSession(newSession);
        const currentUser = newSession.user;
        setUser(currentUser);
        setIsAnonymous(currentUser.is_anonymous);
        await fetchProfile(currentUser);
        await checkAdminStatus(currentUser.email);
        setLoading(false);
      } 
      // If the session is null, it means we're either a new visitor or just signed out.
      // In either case, we need to create a new anonymous session.
      else {
        // Don't handle PASSWORD_RECOVERY here, as it provides a session.
        if (_event !== 'PASSWORD_RECOVERY') {
            setSession(null);
            setUser(null);
            setProfile(null);
            setIsAdmin(false);
            setIsAnonymous(false);
            
            // Don't set loading to false yet. We're about to get a new session.
            const { error } = await supabase.auth.signInAnonymously();
            if (error) {
                console.error("Critical failure: Could not sign in anonymously.", error);
                // If even anonymous sign-in fails, we stop loading and show the app in a logged-out state.
                setLoading(false);
            }
            // On success, the onAuthStateChange listener will fire again with the new anonymous session.
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfile, checkAdminStatus]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    }
    // The onAuthStateChange listener will automatically handle signing in as a new anonymous user.
  }, []);

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

  // Render children only when the initial authentication check is complete.
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
