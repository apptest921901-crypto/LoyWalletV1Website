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
import api from '../../utils/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, signInWithGoogle } = useAuth();
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
      const detail = error.response?.data?.detail;
      
      // Check if email is not verified
      if (detail?.toLowerCase().includes('email') && detail?.toLowerCase().includes('confirm')) {
        Alert.alert(
          'Email Not Verified',
          'Please verify your email before logging in. Check your inbox or resend the verification email.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Resend Email', onPress: handleResendVerification }
          ]
        );
      } else {
        const message = detail || 'Invalid credentials. Please try again.';
        Alert.alert('Access Denied', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address first.');
      return;
    }
    
    try {
      await api.post('auth/resend-verification', { email });
      Alert.alert('Success', 'Verification email has been resent. Please check your inbox.');
    } catch (error) {
      Alert.alert('Error', 'Could not resend verification email. Please try again later.');
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      // Error handled in AuthContext
    } finally {
      setIsGoogleLoading(false);
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
            disabled={isLoading || isGoogleLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Enter Wallet</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity 
            style={styles.googleButton} 
            onPress={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#1A1A1A" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#1A1A1A" style={{marginRight: 10}} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
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
  header: { alignItems: 'center', marginBottom: 40 },
  logoWrapper: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#F0F7FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16, elevation: 5 },
  logo: { width: 50, height: 50 },
  brandName: { fontSize: 32, fontWeight: '800', color: '#1A1A1A' },
  tagline: { fontSize: 16, fontWeight: '600', color: '#4A4A4A', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' },
  winText: { color: '#007AFF' },
  form: { width: '100%' },
  inputGroup: { marginBottom: 20 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', textTransform: 'uppercase' },
  forgotText: { fontSize: 13, color: '#007AFF', fontWeight: '700' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#F0F0F0' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1A1A1A' },
  loginButton: { backgroundColor: '#007AFF', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 4 },
  loginButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: '#F0F0F0' },
  dividerText: { marginHorizontal: 16, color: '#8E8E93', fontSize: 12, fontWeight: '700' },
  googleButton: { backgroundColor: '#FFFFFF', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E5EA', flexDirection: 'row' },
  googleButtonText: { color: '#1A1A1A', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: '#8E8E93', fontSize: 15 },
  signupLink: { color: '#007AFF', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { backgroundColor: '#A0CFFF' },
});
