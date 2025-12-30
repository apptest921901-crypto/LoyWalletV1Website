import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { cardAPI, Card } from '../../utils/api';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedCard, setEditedCard] = useState<Partial<Card>>({});

  useEffect(() => {
    if (id) {
      loadCard();
    }
  }, [id]);

  const loadCard = async () => {
    try {
      setLoading(true);
      const data = await cardAPI.getCard(id);
      setCard(data);
      setEditedCard(data);
    } catch (error) {
      console.error('Error loading card:', error);
      Alert.alert('Error', 'Failed to load card details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!card?.id) return;

    try {
      await cardAPI.updateCard(card.id, editedCard);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCard({ ...card, ...editedCard });
      setEditing(false);
    } catch (error) {
      console.error('Error updating card:', error);
      Alert.alert('Error', 'Failed to update card');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this card? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (card?.id) {
                await cardAPI.deleteCard(card.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
              }
            } catch (error) {
              console.error('Error deleting card:', error);
              Alert.alert('Error', 'Failed to delete card');
            }
          },
        },
      ]
    );
  };

  const toggleFavorite = async () => {
    if (!card?.id) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cardAPI.toggleFavorite(card.id, !card.is_favorite);
      setCard({ ...card, is_favorite: !card.is_favorite });
    } catch (error) {
      console.error('Error toggling favorite:', error);
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

  if (!card) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Card not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Card Details</Text>
          <TouchableOpacity onPress={toggleFavorite}>
            <Ionicons
              name={card.is_favorite ? 'star' : 'star-outline'}
              size={28}
              color={card.is_favorite ? '#FFD700' : '#8E8E93'}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Card Image */}
          {card.image_base64 ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: card.image_base64 }} style={styles.cardImage} />
            </View>
          ) : (
            <View style={[styles.imageContainer, styles.noImageContainer]}>
              <Ionicons name="card-outline" size={64} color="#E5E5EA" />
            </View>
          )}

          {/* Merchant Badge */}
          <View style={styles.merchantBadge}>
            <Text style={styles.merchantBadgeText}>{card.merchant_name}</Text>
          </View>

          {/* Barcode Display */}
          <View style={styles.barcodeContainer}>
            <Text style={styles.barcodeLabel}>Barcode Number</Text>
            {editing ? (
              <TextInput
                style={styles.barcodeInput}
                value={editedCard.barcode}
                onChangeText={(text) => setEditedCard({ ...editedCard, barcode: text })}
              />
            ) : (
              <Text style={styles.barcodeText}>{card.barcode}</Text>
            )}
          </View>

          {/* Editable Fields */}
          <View style={styles.detailsContainer}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Card Name</Text>
              {editing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={editedCard.card_name}
                  onChangeText={(text) => setEditedCard({ ...editedCard, card_name: text })}
                />
              ) : (
                <Text style={styles.fieldValue}>{card.card_name}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Merchant</Text>
              {editing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={editedCard.merchant_name}
                  onChangeText={(text) => setEditedCard({ ...editedCard, merchant_name: text })}
                />
              ) : (
                <Text style={styles.fieldValue}>{card.merchant_name}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Notes</Text>
              {editing ? (
                <TextInput
                  style={[styles.fieldInput, styles.notesInput]}
                  value={editedCard.notes}
                  onChangeText={(text) => setEditedCard({ ...editedCard, notes: text })}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : (
                <Text style={styles.fieldValue}>{card.notes || 'No notes'}</Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          {editing ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  setEditedCard(card);
                  setEditing(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => setEditing(true)}>
                <Ionicons name="create-outline" size={20} color="#007AFF" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#8E8E93',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#FFFFFF',
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  merchantBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 24,
    marginTop: -20,
    borderRadius: 8,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  merchantBadgeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  barcodeContainer: {
    backgroundColor: '#000000',
    marginHorizontal: 24,
    marginTop: 24,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  barcodeLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  barcodeText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  barcodeInput: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF',
    paddingVertical: 8,
    textAlign: 'center',
    minWidth: 200,
  },
  detailsContainer: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 17,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  fieldInput: {
    fontSize: 17,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#F2F2F7',
  },
  editButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#F2F2F7',
  },
  deleteButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FF3B30',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#8E8E93',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
