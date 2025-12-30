import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tzetcqpqrtxhusssndma.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6ZXRjcXBxcnR4aHVzc3NuZG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODczNjksImV4cCI6MjA4MjY2MzM2OX0.tXc7qbKfISDhuMU-ce1p1ehdPem_fqGqS8jC6AR1jxA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
