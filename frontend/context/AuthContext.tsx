import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserProfile(session.access_token);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserProfile(session.access_token);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(token: string) {
    try {
      const response = await axios.get(`${API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
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

      if (response.data.session) {
        const { access_token, refresh_token } = response.data.session;
        await supabase.auth.setSession({ access_token, refresh_token });
      }
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

      if (response.data.session) {
        const { access_token, refresh_token } = response.data.session;
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      await AsyncStorage.clear();
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
    } catch (error) {
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
