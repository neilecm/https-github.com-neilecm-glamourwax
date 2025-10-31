import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
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
      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfile(data);
      } else if (!user.is_anonymous) {
        console.log(`Profile for user ${user.id} not found. Creating fallback profile.`);
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
          console.warn(`Client-side profile creation failed: "${createError.message}". This can happen if RLS policies are too restrictive or a DB trigger is missing.`);
          setProfile(null);
        } else {
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
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    }
  }, []);
  
  useEffect(() => {
    setLoading(true);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setAuthEvent(_event);
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser && !currentUser.is_anonymous) {
          // A real user is logged in.
          setIsAnonymous(false);
          await fetchProfile(currentUser);
          await checkAdminStatus(currentUser.email);
          setLoading(false); // Stop loading after user data is fetched.
        } else if (currentUser && currentUser.is_anonymous) {
          // An anonymous session is active.
          setIsAnonymous(true);
          setProfile(null);
          setIsAdmin(false);
          setLoading(false); // Stop loading, guest session is ready.
        } else {
          // No session at all, this happens on initial load and after sign out.
          setIsAnonymous(true);
          setProfile(null);
          setIsAdmin(false);
          // Attempt to get an anonymous session.
          const { error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) {
            console.error("Critical: Failed to sign in anonymously.", anonError);
            // If we can't get any session, we have to stop loading to prevent a freeze.
            setLoading(false);
          }
          // If anonymous sign-in is successful, the listener will fire AGAIN with the
          // new anonymous session, and the logic in the second 'if' block will run,
          // eventually setting loading to false. We do nothing here to prevent a race condition.
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfile, checkAdminStatus]);


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
