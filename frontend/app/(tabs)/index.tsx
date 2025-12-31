import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { cardAPI, MerchantGroup } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [merchants, setMerchants] = useState<MerchantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [expandedMerchants, setExpandedMerchants] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (session) {
      loadMerchants();
    }
  }, [session]);

  const loadMerchants = async () => {
    try {
      setLoading(true);
      const data = await cardAPI.getMerchantsGrouped(searchQuery || undefined, favoritesOnly);
      setMerchants(data);
    } catch (error) {
      console.error('Error loading merchants:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load cards',
        text2: 'Please try again',
        position: 'top',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMerchants();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, favoritesOnly]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMerchants();
  };

  const toggleMerchant = (merchantName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedMerchants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(merchantName)) {
        newSet.delete(merchantName);
      } else {
        newSet.add(merchantName);
      }
      return newSet;
    });
  };

  const toggleFavorite = async (cardId: string, currentStatus: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cardAPI.toggleFavorite(cardId, !currentStatus);
      Toast.show({
        type: 'success',
        text1: !currentStatus ? '⭐ Favorited' : 'Removed from favorites',
        position: 'top',
        visibilityTime: 1000,
      });
      loadMerchants();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleCardPress = (cardId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/card-detail/${cardId}`);
  };

  const handleAddCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/add-card');
  };

  if (loading && !refreshing) {
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
        <View style={styles.headerLeft}>
          <Image 
            source={{ uri: 'https://customer-assets.emergentagent.com/job_lovaltyorganizer/artifacts/cn1jsy8n_Logo%203%20circle.png' }}
            style={styles.logoSmall}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.title}>My Cards</Text>
            <Text style={styles.headerSubtitle}>LoyWallet</Text>
          </View>
        </View>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cards..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFavoritesOnly(!favoritesOnly);
            }}
            style={styles.favoriteButton}
          >
            <Ionicons
              name={favoritesOnly ? 'star' : 'star-outline'}
              size={24}
              color={favoritesOnly ? '#FFD700' : '#8E8E93'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
      >
        {merchants.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color="#E5E5EA" />
            <Text style={styles.emptyTitle}>No Cards Yet</Text>
            <Text style={styles.emptyText}>
              {favoritesOnly
                ? 'No favorite cards found'
                : searchQuery
                ? 'No cards match your search'
                : 'Add your first loyalty card to get started'}
            </Text>
          </View>
        ) : (
          merchants.map((merchant, index) => (
            <View key={merchant.merchant_name} style={[styles.merchantGroup, index === 0 && styles.firstGroup]}>
              <TouchableOpacity
                style={styles.merchantHeader}
                onPress={() => toggleMerchant(merchant.merchant_name)}
              >
                <View style={styles.merchantTitleContainer}>
                  {merchant.merchant_logo_url ? (
                    <Image 
                      source={{ uri: merchant.merchant_logo_url }} 
                      style={styles.merchantLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.merchantLogoPlaceholder}>
                      <Ionicons name="business" size={20} color="#8E8E93" />
                    </View>
                  )}
                  <Text style={styles.merchantName}>{merchant.merchant_name}</Text>
                  <View style={styles.cardCountBadge}>
                    <Text style={styles.cardCountText}>{merchant.card_count}</Text>
                  </View>
                </View>
                <Ionicons
                  name={expandedMerchants.has(merchant.merchant_name) ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#8E8E93"
                />
              </TouchableOpacity>

              {expandedMerchants.has(merchant.merchant_name) && (
                <View style={styles.cardsContainer}>
                  {merchant.cards.map((card) => (
                    <TouchableOpacity
                      key={card.card_id}
                      style={styles.cardTile}
                      onPress={() => card.card_id && handleCardPress(card.card_id.toString())}
                    >
                      <View style={styles.cardContent}>
                        <View style={styles.cardTextContainer}>
                          <Text style={styles.cardName}>{card.card_name}</Text>
                          <Text style={styles.cardBarcode}>{card.barcode}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            card.card_id && toggleFavorite(card.card_id.toString(), card.is_favorite);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={card.is_favorite ? 'star' : 'star-outline'}
                            size={24}
                            color={card.is_favorite ? '#FFD700' : '#8E8E93'}
                          />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={handleAddCard}>
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoSmall: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 20,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 2,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    height: '100%',
  },
  favoriteButton: {
    marginLeft: 8,
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
  },
  merchantGroup: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  firstGroup: {
    marginTop: 0,
  },
  merchantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  merchantTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  merchantLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#F2F2F7',
  },
  merchantLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
    flex: 1,
  },
  cardCountBadge: {
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cardCountText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
  },
  cardsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  cardTile: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  cardBarcode: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: Platform.OS === 'ios' ? 96 : 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
