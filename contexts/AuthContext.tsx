import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const fetchProfile = useCallback(async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error && error.code === 'PGRST116') { // No profile found, create it
        console.log('No profile found for user, creating one.');
        const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
                id: user.id,
                full_name: user.user_metadata.full_name || user.email?.split('@')[0],
                phone_number: user.user_metadata.phone_number,
                email: user.email,
            })
            .select()
            .single();
        if (insertError) throw insertError;
        setProfile(newProfile);
      } else if (error) {
          throw error;
      } else {
        setProfile(data);
      }
    } catch (error: any) {
      console.error('Error fetching or creating profile:', error.message);
      setProfile(null); // Ensure profile is null on error
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
    // onAuthStateChange is called immediately with the current session,
    // so it handles the initial check for us, removing the race condition.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        const currentUser = session?.user ?? null;
        setSession(session);
        setUser(currentUser);
        setProfile(null); // Reset profile on auth change
        setIsAdmin(false);

        if (currentUser) {
            // A user exists (either real or anonymous)
            setIsAnonymous(currentUser.is_anonymous);
            await fetchProfile(currentUser);
            await checkAdminStatus(currentUser.email);
            setLoading(false);
        } else {
            // No user session found. This happens on initial load or after a sign out.
            // Let's create an anonymous session.
            const { error } = await supabase.auth.signInAnonymously();
            if (error) {
                console.error("Failed to sign in anonymously:", error);
                setLoading(false); // If anonymous sign in fails, we have to stop loading or app hangs
            }
            // If signInAnonymously is successful, onAuthStateChange will be triggered again
            // with the new anonymous session, and the `if (currentUser)` block will run.
        }
    });

    return () => {
        subscription.unsubscribe();
    };
  }, [fetchProfile, checkAdminStatus]);

  const signOut = async () => {
    await supabase.auth.signOut();
    // The onAuthStateChange listener will handle creating a new anonymous session.
  };

  const value = {
    session,
    user,
    profile,
    loading,
    isAdmin,
    isAnonymous,
    signOut,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};