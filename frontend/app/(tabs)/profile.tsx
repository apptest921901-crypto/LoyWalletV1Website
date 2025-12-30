import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cardAPI, Stats } from '../../utils/api';

export default function ProfileScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await cardAPI.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={64} color="#007AFF" />
          </View>
          <Text style={styles.userName}>Loyalty App User</Text>
          <Text style={styles.userEmail}>user@loyaltyapp.com</Text>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Cards</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="card" size={32} color="#007AFF" />
              </View>
              <Text style={styles.statValue}>{stats?.total_cards || 0}</Text>
              <Text style={styles.statLabel}>Total Cards</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="star" size={32} color="#FFD700" />
              </View>
              <Text style={styles.statValue}>{stats?.favorite_cards || 0}</Text>
              <Text style={styles.statLabel}>Favorites</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="business" size={32} color="#34C759" />
              </View>
              <Text style={styles.statValue}>{stats?.total_merchants || 0}</Text>
              <Text style={styles.statLabel}>Merchants</Text>
            </View>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About LoyaltyApp</Text>
          <Text style={styles.infoText}>
            Keep all your loyalty cards organized in one place. Never miss out on rewards again!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#8E8E93',
  },
  statsSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
  infoSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 24,
  },
});
