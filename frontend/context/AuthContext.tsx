import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  
  // EXPERT FIX: Use a ref to track the processed token.
  // This prevents the "Already Used" error by ensuring we don't process the same token twice
  // during background refreshes or re-renders.
  const lastProcessedToken = useRef<string | null>(null);

  const refreshProfile = useCallback(async (token: string) => {
    if (token === lastProcessedToken.current) return;
    lastProcessedToken.current = token;
    
    try {
      setApiToken(token);
      const res = await api.get('profile');
      setUser(res.data);
    } catch (e) {
      console.warn('Profile fetch failed:', e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (isMounted && initialSession) {
          setSession(initialSession);
          await refreshProfile(initialSession.access_token);
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (newSession) {
        // Prevent duplicate processing of the same session/token
        if (newSession.access_token !== lastProcessedToken.current) {
          setSession(newSession);
          await refreshProfile(newSession.access_token);
        }
      } else {
        setSession(null);
        setApiToken(null);
        setUser(null);
        lastProcessedToken.current = null;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshProfile]); // Dependency array is now stable

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  const showWelcomeToast = () => {
    Keyboard.dismiss();
    setTimeout(() => {
      Toast.show({
        type: 'success',
        text1: 'Welcome back!',
        position: 'top',
        visibilityTime: 3000,
      });
    }, 500);
  };

  async function signInWithGoogle() {
    try {
      const redirectTo = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
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
            try {
              const { data: sData } = await supabase.auth.setSession({ access_token, refresh_token });
              setSession(sData.session);
              showWelcomeToast();
            } catch (err: any) {
              // Ignore "Already Used" error as it means the listener handled it
              if (!err.message?.includes('Already Used')) throw err;
            }
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
      Keyboard.dismiss();
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
        
        try {
          await supabase.auth.setSession({ access_token, refresh_token });
        } catch (err: any) {
          if (!err.message?.includes('Already Used')) throw err;
        }

        setSession(response.data.session);
        await refreshProfile(access_token);
        showWelcomeToast();
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
    lastProcessedToken.current = null;
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
