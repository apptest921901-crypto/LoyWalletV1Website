import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import Toast from 'react-native-toast-message';
import AnimatedSplash from '../components/AnimatedSplash';

export default function RootLayout() {
  const [splashComplete, setSplashComplete] = useState(false);

  if (!splashComplete) {
    return (
      <SafeAreaProvider>
        <AnimatedSplash onComplete={() => setSplashComplete(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="splash" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          {/* TOTAL INTEGRITY FIX: Exact path mapping for folder-based routes */}
          <Stack.Screen 
            name="card-detail/[id]" 
            options={{ 
              presentation: 'modal',
              headerShown: false 
            }} 
          />
        </Stack>
      </AuthProvider>
      <Toast />
    </SafeAreaProvider>
  );
}
