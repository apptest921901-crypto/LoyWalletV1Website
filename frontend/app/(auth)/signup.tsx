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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signUp } = useAuth();
  const router = useRouter();

  const handleSignup = async () => {
    if (!email || !password || !fullName || !username) {
      Alert.alert('Missing Info', 'Please fill in all fields to create your wallet.');
      return;
    }

    if (!agreeToTerms) {
      Alert.alert('GDPR Consent', 'Please agree to our Privacy Policy and Terms of Service to continue.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Security', 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password, fullName, username);
      Alert.alert(
        '🎉 Account Created!',
        'Please check your email inbox to verify your account. You can log in after confirmation.',
        [{ text: 'Go to Login', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Could not create account. Please try again.';
      Alert.alert('Signup Failed', message);
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
          <Text style={styles.instruction}>Create your wallet to manage all your loyalty cards</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="#007AFF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="at" size={20} color="#007AFF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="johndoe"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          </View>

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
            <Text style={styles.inputLabel}>Password</Text>
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
            style={styles.consentContainer} 
            onPress={() => setAgreeToTerms(!agreeToTerms)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={agreeToTerms ? "checkbox" : "square-outline"} 
              size={24} 
              color={agreeToTerms ? "#007AFF" : "#C7C7CC"} 
            />
            <Text style={styles.consentText}>
              I agree to the <Text style={styles.linkText} onPress={() => Linking.openURL('https://loywallet.com/privacy')}>Privacy Policy</Text> and <Text style={styles.linkText} onPress={() => Linking.openURL('https://loywallet.com/terms')}>Terms of Service</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.signupButton, (!agreeToTerms || isLoading) && styles.buttonDisabled]} 
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signupButtonText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have a wallet? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 32, backgroundColor: '#FFFFFF', paddingTop: 40, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoWrapper: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#F0F7FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16, elevation: 4 },
  logo: { width: 50, height: 50 },
  brandName: { fontSize: 30, fontWeight: '800', color: '#1A1A1A' },
  tagline: { fontSize: 16, fontWeight: '600', color: '#4A4A4A', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' },
  winText: { color: '#007AFF' },
  instruction: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 12, lineHeight: 20 },
  form: { width: '100%' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 8, textTransform: 'uppercase' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 14, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#F0F0F0' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1A1A1A' },
  consentContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, gap: 10, paddingRight: 20 },
  consentText: { fontSize: 13, color: '#4A4A4A', lineHeight: 18, flex: 1 },
  linkText: { color: '#007AFF', fontWeight: '600' },
  signupButton: { backgroundColor: '#007AFF', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12, elevation: 6 },
  signupButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#8E8E93', fontSize: 15 },
  loginLink: { color: '#007AFF', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { backgroundColor: '#C7C7CC', elevation: 0 },
});
