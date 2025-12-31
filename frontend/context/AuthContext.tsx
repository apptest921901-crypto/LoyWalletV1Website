import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import axios from 'axios';
import { useRouter, useSegments } from 'expo-router';
import Toast from 'react-native-toast-message';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  email?: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  phone_number?: string;
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

  useEffect(() => {
    // Check for existing session on mount
    loadSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      setSession(session);
      
      if (session?.user) {
        // Don't wait for profile load to navigate
        loadUserProfile(session.access_token);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  async function loadSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setSession(session);
        await loadUserProfile(session.access_token);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading session:', error);
      setLoading(false);
    }
  }

  async function loadUserProfile(token: string) {
    try {
      const response = await axios.get(`${API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000 // 5 second timeout
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
      await supabase.auth.signOut();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, fullName: string, username: string) {
    try {
      const response = await axios.post(`${API_URL}/api/auth/signup`, {
        email,
        password,
        full_name: fullName,
        username
      });

      if (response.data.session?.access_token) {
        const { access_token, refresh_token } = response.data.session;
        await supabase.auth.setSession({ access_token, refresh_token });
        
        Toast.show({
          type: 'success',
          text1: '🎉 Welcome!',
          text2: 'Account created successfully',
          position: 'top',
          visibilityTime: 2000,
        });
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      });

      if (response.data.session?.access_token) {
        const { access_token, refresh_token } = response.data.session;
        
        // Set session first (this triggers auth state change)
        await supabase.auth.setSession({ access_token, refresh_token });
        
        Toast.show({
          type: 'success',
          text1: 'Welcome Back!',
          text2: 'Signed in successfully',
          position: 'top',
          visibilityTime: 1500,
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      
      Toast.show({
        type: 'info',
        text1: 'Signed Out',
        text2: 'See you next time!',
        position: 'top',
        visibilityTime: 1500,
      });
      
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Signout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to sign out',
        position: 'top',
      });
    }
  }

  async function updateProfile(data: Partial<User>) {
    try {
      if (!session) throw new Error('No session');
      
      const response = await axios.put(
        `${API_URL}/api/profile`,
        data,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      
      setUser(response.data);
      
      Toast.show({
        type: 'success',
        text1: 'Profile Updated',
        text2: 'Changes saved successfully',
        position: 'top',
        visibilityTime: 1500,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Could not update profile',
        position: 'top',
      });
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
