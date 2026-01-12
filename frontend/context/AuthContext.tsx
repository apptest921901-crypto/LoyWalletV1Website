import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import api, { setApiToken } from '../utils/api';
import { useRouter, useSegments } from 'expo-router';
import Toast from 'react-native-toast-message';

interface User {
  user_id: string;
  email?: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  session: any;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // 1. Initial Session Load
  useEffect(() => {
    async function initialize() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession) {
          setSession(initialSession);
          setApiToken(initialSession.access_token);
          
          try {
            const res = await api.get('profile');
            setUser(res.data);
          } catch (profileErr) {
            console.warn('Could not load profile on init', profileErr);
          }
        }
      } catch (e) {
        console.warn('Initialization failed', e);
      } finally {
        setLoading(false);
      }
    }
    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setApiToken(newSession.access_token);
      } else {
        setApiToken(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Navigation "Gatekeeper"
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  async function signUp(email: string, password: string, fullName: string, username: string) {
    try {
      const response = await api.post('auth/signup', { email, password, full_name: fullName, username });
      
      if (response.data.session?.access_token) {
        const { access_token, refresh_token } = response.data.session;
        setApiToken(access_token);
        setUser(response.data.user);
        setSession(response.data.session);
        await supabase.auth.setSession({ access_token, refresh_token });
        Toast.show({ type: 'success', text1: 'Welcome!' });
      }
    } catch (error: any) {
      throw error;
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const response = await api.post('auth/login', { email, password });

      if (response.data.session?.access_token) {
        const { access_token, refresh_token } = response.data.session;
        setApiToken(access_token);
        setUser(response.data.user);
        setSession(response.data.session);
        await supabase.auth.setSession({ access_token, refresh_token });
        Toast.show({ type: 'success', text1: 'Welcome Back!' });
      }
    } catch (error: any) {
      throw error;
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
      setApiToken(null);
      setSession(null);
      setUser(null);
      router.replace('/(auth)/login');
    } catch (e) {
      console.error(e);
    }
  }

  async function updateProfile(data: Partial<User>) {
    const res = await api.put('profile', data);
    setUser(res.data);
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
