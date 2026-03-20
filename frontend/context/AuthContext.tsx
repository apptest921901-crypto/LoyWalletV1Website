import React, { createContext, useContext, useState, useEffect } from 'react';
import { Keyboard } from 'react-native';
import { supabase } from '../config/supabase';
import api, { setApiToken } from '../utils/api';
import { useRouter, useSegments } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

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
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

WebBrowser.maybeCompleteAuthSession();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let isMounted = true;
    async function initialize() {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (isMounted) {
        if (initialSession) {
          setSession(initialSession);
          setApiToken(initialSession.access_token);
          try {
            const res = await api.get('profile');
            setUser(res.data);
          } catch (e) {}
        }
        setLoading(false);
      }
    }
    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (isMounted) {
        setSession(newSession);
        if (newSession) {
          setApiToken(newSession.access_token);
          if (event === 'SIGNED_IN') {
            try {
              const res = await api.get('profile');
              setUser(res.data);
            } catch (e) {}
          }
        } else {
          setApiToken(null);
          setUser(null);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  async function signInWithGoogle() {
    try {
      const redirectTo = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      
      if (result.type === 'success' && result.url) {
        const paramsStr = result.url.includes('#') ? result.url.split('#')[1] : result.url.split('?')[1];
        if (paramsStr) {
          const params = new URLSearchParams(paramsStr);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            const { data: sData } = await supabase.auth.setSession({ access_token, refresh_token });
            setSession(sData.session);
            Toast.show({ type: 'success', text1: 'Welcome to LoyWallet!' });
          }
        }
      }
    } catch (error: any) {
      console.error('Google Auth Error:', error);
      Toast.show({ type: 'error', text1: 'Google Login Failed' });
    }
  }

  async function signUp(email: string, password: string, fullName: string, username: string) {
    try {
      await api.post('auth/signup', { email, password, full_name: fullName, username });
      Toast.show({ type: 'success', text1: 'Verification Email Sent!', text2: 'Please check your inbox.' });
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Signup failed';
      Toast.show({ type: 'error', text1: msg });
      throw e;
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
        Toast.show({ type: 'success', text1: 'Welcome to LoyWallet!' });
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Invalid credentials';
      Toast.show({ type: 'error', text1: msg });
      throw e;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setApiToken(null);
    setSession(null);
    setUser(null);
    router.replace('/(auth)/login');
    Toast.show({ type: 'info', text1: 'Signed out successfully' });
  }

  async function updateProfile(data: Partial<User>) {
    try {
      const res = await api.put('profile', data);
      setUser(res.data);
      Toast.show({ type: 'success', text1: 'Profile updated' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Update failed' });
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
