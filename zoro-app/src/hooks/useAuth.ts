'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { User } from '@/types';
import type { Session, AuthError } from '@supabase/supabase-js';

interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ? mapSupabaseUserToUser(session.user) : null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ? mapSupabaseUserToUser(session.user) : null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error && data.session) {
      setSession(data.session);
      setUser(mapSupabaseUserToUser(data.session.user));
    }
    
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
      },
    });
    
    if (!error && data.session) {
      setSession(data.session);
      setUser(mapSupabaseUserToUser(data.session.user));
    }
    
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabaseClient.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    
    const { error } = await supabaseClient.auth.updateUser({
      data: updates,
    });
    
    if (!error) {
      setUser({ ...user, ...updates });
    }
  }, [user]);

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateUser,
  };
};

// Helper function to map Supabase user to our User type
function mapSupabaseUserToUser(supabaseUser: {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    role?: string;
    avatar_url?: string;
  };
}): User {
  const roleValue = supabaseUser.user_metadata?.role;
  const validRole = roleValue === 'planner' || roleValue === 'admin' ? roleValue : 'user';
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
    role: validRole as 'user' | 'planner' | 'admin',
    avatar_url: supabaseUser.user_metadata?.avatar_url,
  };
}

