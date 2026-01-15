import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import Toast from 'react-native-toast-message';
import AnimatedSplash from '../components/AnimatedSplash';

export default function RootLayout() {
  const [splashComplete, setSplashComplete] = useState(false);

  // If splash isn't complete, we render the animation first
  if (!splashComplete) {
    return (
      <SafeAreaProvider>
        <AnimatedSplash onComplete={() => setSplashComplete(true)} />
      </SafeAreaProvider>
    );
  }

  // Once splash completes, we render the full Auth & Navigation stack
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="card-detail/[id]" 
            options={{ 
              presentation: 'modal',
              headerShown: false 
            }} 
          />
        </Stack>
      </AuthProvider>
      {/* Toast must be outside AuthProvider to avoid being covered during transitions */}
      <Toast />
    </SafeAreaProvider>
  );
}
