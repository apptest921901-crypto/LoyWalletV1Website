import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
          // EXPERT FIX: Remove fixed height, use dynamic padding
          // This ensures the bar expands to fit the system navigation icons
          height: Platform.OS === 'ios' ? 60 + insets.bottom : 70 + (insets.bottom > 0 ? insets.bottom : 10),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : (insets.bottom > 0 ? insets.bottom : 15),
          paddingTop: 12,
          position: 'absolute', // Ensures the layout doesn't "jump"
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0, // Remove Android shadow to use manual border
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-card"
        options={{
          title: 'Add Card',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={30} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
