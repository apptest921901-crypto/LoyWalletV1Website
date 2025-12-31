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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.email);
      setSession(session);
      
      if (session?.user) {
        await loadUserProfile(session.access_token);
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
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated and on auth screen
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  async function loadSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session load error:', error);
        setLoading(false);
        return;
      }

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
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
      // If profile fails, sign out
      await supabase.auth.signOut();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, fullName: string, username: string) {
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_URL}/api/auth/signup`, {
        email,
        password,
        full_name: fullName,
        username
      });

      if (response.data.session?.access_token) {
        // Set session in Supabase
        const { access_token, refresh_token } = response.data.session;
        await supabase.auth.setSession({ access_token, refresh_token });
        
        Toast.show({
          type: 'success',
          text1: '🎉 Welcome!',
          text2: 'Your account has been created successfully!',
          position: 'top',
          visibilityTime: 4000,
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Account Created',
          text2: 'Please sign in with your credentials',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      });

      if (response.data.session?.access_token) {
        const { access_token, refresh_token } = response.data.session;
        await supabase.auth.setSession({ access_token, refresh_token });
        
        Toast.show({
          type: 'success',
          text1: 'Welcome Back!',
          text2: `Signed in as ${response.data.user?.email}`,
          position: 'top',
          visibilityTime: 2000,
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      setLoading(true);
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear local state
      setUser(null);
      setSession(null);
      
      Toast.show({
        type: 'info',
        text1: 'Signed Out',
        text2: 'You have been logged out successfully',
        position: 'top',
        visibilityTime: 2000,
      });
      
      // Navigate to login
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Signout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to sign out. Please try again.',
        position: 'top',
        visibilityTime: 2000,
      });
    } finally {
      setLoading(false);
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
        text2: 'Your profile has been saved successfully',
        position: 'top',
        visibilityTime: 2000,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Could not update profile. Please try again.',
        position: 'top',
        visibilityTime: 2000,
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
