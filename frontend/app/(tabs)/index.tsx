import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api, { cardAPI, MerchantGroup, Card } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// --- SKELETON COMPONENT ---
const HomeSkeleton = () => (
  <View style={styles.skeletonContainer}>
    {/* Quick Access Skeleton */}
    <View style={styles.skeletonSection}>
      <View style={[styles.skeletonText, { width: 100, marginBottom: 15 }]} />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={styles.skeletonCircle} />
        ))}
      </View>
    </View>
    {/* List Skeleton */}
    {[1, 2, 3].map(i => (
      <View key={i} style={styles.skeletonCard} />
    ))}
  </View>
);

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  
  const [merchants, setMerchants] = useState<MerchantGroup[]>([]);
  const [quickCards, setQuickCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [expandedMerchants, setExpandedMerchants] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, searchQuery, favoritesOnly]);

  const loadData = async () => {
    try {
      // In V1.1.0 we show skeleton on initial load or search change
      if (!refreshing) setLoading(true);
      
      const [groupedData, quickData] = await Promise.all([
        cardAPI.getMerchantsGrouped(searchQuery || undefined, favoritesOnly),
        api.get('cards/quick').then(res => res.data)
      ]);
      setMerchants(groupedData);
      setQuickCards(quickData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
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
      loadData();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleCardPress = (cardId: string, autoZoom: boolean = true) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: `/card-detail/${cardId}`,
      params: { autoZoom: autoZoom ? 'true' : 'false' }
    });
  };

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
        {loading && !refreshing ? (
          <HomeSkeleton />
        ) : (
          <>
            {quickCards.length > 0 && !searchQuery && !favoritesOnly && (
              <View style={styles.quickAccessContainer}>
                <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScrollContent}>
                  {quickCards.map((card) => (
                    <TouchableOpacity 
                      key={`quick-${card.card_id}`} 
                      style={styles.quickCardBubble}
                      onPress={() => handleCardPress(card.card_id!, true)}
                    >
                      <View style={styles.quickLogoWrapper}>
                        {card.merchant_logo_url ? (
                          <Image source={{ uri: card.merchant_logo_url }} style={styles.quickLogo} />
                        ) : (
                          <Ionicons name="card" size={24} color="#007AFF" />
                        )}
                      </View>
                      <Text style={styles.quickCardName} numberOfLines={1}>{card.merchant_name || card.card_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {merchants.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="card-outline" size={64} color="#E5E5EA" />
                <Text style={styles.emptyTitle}>No Cards Yet</Text>
                <Text style={styles.emptyText}>
                  {favoritesOnly ? 'No favorite cards' : 'Add your first loyalty card to get started'}
                </Text>
              </View>
            ) : (
              merchants.map((merchant) => (
                <View key={merchant.merchant_name} style={styles.merchantGroup}>
                  <TouchableOpacity
                    style={styles.merchantHeader}
                    onPress={() => toggleMerchant(merchant.merchant_name)}
                  >
                    <View style={styles.merchantTitleContainer}>
                      {merchant.merchant_logo_url ? (
                        <Image source={{ uri: merchant.merchant_logo_url }} style={styles.merchantLogo} />
                      ) : (
                        <View style={styles.merchantLogoPlaceholder}><Ionicons name="business" size={20} color="#8E8E93" /></View>
                      )}
                      <Text style={styles.merchantName}>{merchant.merchant_name}</Text>
                      <View style={styles.cardCountBadge}><Text style={styles.cardCountText}>{merchant.card_count}</Text></View>
                    </View>
                    <Ionicons name={expandedMerchants.has(merchant.merchant_name) ? 'chevron-up' : 'chevron-down'} size={20} color="#8E8E93" />
                  </TouchableOpacity>

                  {expandedMerchants.has(merchant.merchant_name) && (
                    <View style={styles.cardsContainer}>
                      {merchant.cards.map((card) => (
                        <TouchableOpacity key={card.card_id} style={styles.cardTile} onPress={() => handleCardPress(card.card_id!)}>
                          <View style={styles.cardContent}>
                            <View style={styles.cardImagePreviewContainer}>
                              {card.image_base64 ? (
                                <Image source={{ uri: card.image_base64 }} style={styles.cardImagePreview} />
                              ) : (
                                <View style={styles.cardImagePlaceholder}>
                                  <Ionicons name="card" size={20} color="#8E8E93" />
                                </View>
                              )}
                            </View>

                            <View style={styles.cardTextContainer}>
                              <Text style={styles.cardName}>{card.card_name}</Text>
                              <Text style={styles.cardBarcode}>{card.barcode}</Text>
                            </View>
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleFavorite(card.card_id!, card.is_favorite); }}>
                              <Ionicons name={card.is_favorite ? 'star' : 'star-outline'} size={24} color={card.is_favorite ? '#FFD700' : '#8E8E93'} />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity 
        style={[
          styles.fab, 
          { bottom: Platform.OS === 'ios' ? insets.bottom + 80 : insets.bottom + 90 }
        ]} 
        onPress={() => router.push('/(tabs)/add-card')}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  logoSmall: { width: 40, height: 40, marginRight: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#000000' },
  headerSubtitle: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#000000' },
  favoriteButton: { marginLeft: 8 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },
  quickAccessContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#8E8E93', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  quickScrollContent: { gap: 16, paddingRight: 24 },
  quickCardBubble: { alignItems: 'center', width: 80 },
  quickLogoWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, marginBottom: 8 },
  quickLogo: { width: 40, height: 40, borderRadius: 8, resizeMode: 'contain' },
  quickCardName: { fontSize: 12, fontWeight: '600', color: '#1A1A1A', textAlign: 'center' },
  merchantGroup: { marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 12, elevation: 2, overflow: 'hidden' },
  merchantHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  merchantTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  merchantLogo: { width: 32, height: 32, borderRadius: 6, marginRight: 12 },
  merchantLogoPlaceholder: { width: 32, height: 32, borderRadius: 6, marginRight: 12, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  merchantName: { fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 },
  cardCountBadge: { backgroundColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  cardCountText: { fontSize: 12, color: '#8E8E93' },
  cardsContainer: { borderTopWidth: 1, borderTopColor: '#F2F2F7' },
  cardTile: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  cardImagePreviewContainer: { marginRight: 16 },
  cardImagePreview: { width: 50, height: 32, borderRadius: 4, backgroundColor: '#F2F2F7' },
  cardImagePlaceholder: { width: 50, height: 32, borderRadius: 4, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  cardTextContainer: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '500', color: '#1A1A1A' },
  cardBarcode: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  emptyText: { color: '#8E8E93', marginTop: 8 },
  fab: { position: 'absolute', right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  // SKELETON STYLES
  skeletonContainer: { paddingTop: 16 },
  skeletonSection: { marginBottom: 32 },
  skeletonCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E1E9EE' },
  skeletonCard: { width: '100%', height: 80, borderRadius: 12, backgroundColor: '#E1E9EE', marginBottom: 12 },
  skeletonText: { height: 12, borderRadius: 4, backgroundColor: '#E1E9EE' },
});
