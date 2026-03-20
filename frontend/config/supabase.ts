import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { secureStorage } from '../utils/secureStorage';

/**
 * SECURE SUPABASE CONFIGURATION
 * Integrated with Cyber-Hardened SecureStorage wrapper
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Expert Fix: Use the custom secureStorage wrapper to handle both 
// the token size issues and prevent plaintext leakage.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
