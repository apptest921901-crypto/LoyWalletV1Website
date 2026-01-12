import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      // EXPERT UX FIX: Handle the "Email not confirmed" case specifically
      const detail = error.response?.data?.detail;
      const message = detail || 'Invalid credentials. Please try again.';
      
      Alert.alert('Access Denied', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image 
              source={{ uri: 'https://customer-assets.emergentagent.com/job_lovaltyorganizer/artifacts/cn1jsy8n_Logo%203%20circle.png' }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandName}>LoyWallet</Text>
          <Text style={styles.tagline}>Open. Scan. <Text style={styles.winText}>Win.</Text></Text>
          <Text style={styles.instruction}>Sign in your wallet to manage all your loyalty cards</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#007AFF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="hello@loywallet.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.passwordHeader}>
              <Text style={styles.inputLabel}>Password</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={styles.forgotText}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#007AFF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, isLoading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Enter Wallet</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to LoyWallet? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.signupLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 32, backgroundColor: '#FFFFFF', paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 48 },
  logoWrapper: { width: 90, height: 90, borderRadius: 24, backgroundColor: '#F0F7FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 5 },
  logo: { width: 60, height: 60 },
  brandName: { fontSize: 34, fontWeight: '800', color: '#1A1A1A' },
  tagline: { fontSize: 18, fontWeight: '600', color: '#4A4A4A', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' },
  winText: { color: '#007AFF' },
  instruction: { fontSize: 15, color: '#8E8E93', textAlign: 'center', marginTop: 16, lineHeight: 22 },
  form: { width: '100%' },
  inputGroup: { marginBottom: 24 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', textTransform: 'uppercase' },
  forgotText: { fontSize: 14, color: '#007AFF', fontWeight: '700' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 16, paddingHorizontal: 16, height: 60, borderWidth: 1, borderColor: '#F0F0F0' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1A1A1A' },
  loginButton: { backgroundColor: '#007AFF', height: 64, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 16, elevation: 8 },
  loginButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: '#8E8E93', fontSize: 16 },
  signupLink: { color: '#007AFF', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { backgroundColor: '#A0CFFF' },
});
