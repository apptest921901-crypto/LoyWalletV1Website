import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../config/supabase';
import Toast from 'react-native-toast-message';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleEmailConfirmation();
  }, []);

  const handleEmailConfirmation = async () => {
    try {
      // Get the access_token and refresh_token from URL params
      const access_token = params.access_token as string;
      const refresh_token = params.refresh_token as string;
      const type = params.type as string;

      if (access_token && refresh_token) {
        // Set the session with the tokens from the email link
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          Toast.show({
            type: 'success',
            text1: 'Email Verified!',
            text2: 'Your account has been confirmed. Welcome to LoyWallet!',
          });
          
          // Redirect to main app
          router.replace('/(tabs)');
          return;
        }
      }

      // If no tokens in URL, check if user is already confirmed
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/(tabs)');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: 'Could not verify your email. Please try again.',
        });
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Email confirmation error:', error);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'An error occurred. Please try logging in.',
      });
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>Verifying your email...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A4A4A',
  },
});
