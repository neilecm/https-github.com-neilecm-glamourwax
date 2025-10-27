import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error.message);
      return null;
    }
    return data as Profile;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sessionState) => {
        setLoading(true);
        setSession(sessionState);
        const currentUser = sessionState?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          const userProfile = await fetchProfile(currentUser.id);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Initial session load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const userProfile = await fetchProfile(currentUser.id);
        setProfile(userProfile);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
