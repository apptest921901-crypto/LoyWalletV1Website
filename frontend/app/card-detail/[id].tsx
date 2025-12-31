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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { cardAPI, Card, Merchant } from '../../utils/api';
import Toast from 'react-native-toast-message';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedCard, setEditedCard] = useState<Partial<Card>>({});
  const [imageZoomModal, setImageZoomModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadCard();
      loadMerchants();
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
      Toast.show({
        type: 'error',
        text1: 'Failed to load card details',
        position: 'top',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMerchants = async () => {
    try {
      const data = await cardAPI.getMerchants();
      setMerchants(data);
    } catch (error) {
      console.error('Error loading merchants:', error);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          `We need ${useCamera ? 'camera' : 'photo library'} permissions to update card image.`
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 10],
            quality: 0.8,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 10],
            quality: 0.8,
            base64: true,
          });

      if (!result.canceled && result.assets[0].base64) {
        const base64String = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setEditedCard({ ...editedCard, image_base64: base64String });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to pick image',
        position: 'top',
      });
    }
  };

  const showImageSourceOptions = () => {
    Alert.alert('Update Card Image', 'Choose an option:', [
      {
        text: 'Take Photo',
        onPress: () => pickImage(true),
      },
      {
        text: 'Choose from Library',
        onPress: () => pickImage(false),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handleSave = async () => {
    if (!card?.card_id) return;

    try {
      setSaving(true);
      await cardAPI.updateCard(card.card_id, editedCard);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Card updated successfully!',
        position: 'top',
      });
      setCard({ ...card, ...editedCard });
      setEditing(false);
      // Reload to get the latest merchant data
      loadCard();
    } catch (error) {
      console.error('Error updating card:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to update card',
        position: 'top',
      });
    } finally {
      setSaving(false);
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
              if (card?.card_id) {
                await cardAPI.deleteCard(card.card_id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Toast.show({
                  type: 'success',
                  text1: 'Card deleted successfully',
                  position: 'top',
                });
                router.back();
              }
            } catch (error) {
              console.error('Error deleting card:', error);
              Toast.show({
                type: 'error',
                text1: 'Failed to delete card',
                position: 'top',
              });
            }
          },
        },
      ]
    );
  };

  const toggleFavorite = async () => {
    if (!card?.card_id) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cardAPI.toggleFavorite(card.card_id, !card.is_favorite);
      setCard({ ...card, is_favorite: !card.is_favorite });
      Toast.show({
        type: 'success',
        text1: !card.is_favorite ? '⭐ Favorited' : 'Removed from favorites',
        position: 'top',
        visibilityTime: 1000,
      });
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

  const currentImage = editing ? (editedCard.image_base64 || card.image_base64) : card.image_base64;

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
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => currentImage && setImageZoomModal(true)}
            onLongPress={editing ? showImageSourceOptions : undefined}
          >
            {currentImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: currentImage }} style={styles.cardImage} />
                {editing && (
                  <TouchableOpacity 
                    style={styles.editImageButton}
                    onPress={showImageSourceOptions}
                  >
                    <Ionicons name="camera" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.imageContainer, styles.noImageContainer]}
                onPress={editing ? showImageSourceOptions : undefined}
              >
                <Ionicons name="card-outline" size={64} color="#E5E5EA" />
                {editing && <Text style={styles.addPhotoText}>Tap to add photo</Text>}
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Merchant Badge with Logo */}
          <View style={styles.merchantBadgeContainer}>
            {card.merchant_logo_url && (
              <Image 
                source={{ uri: card.merchant_logo_url }}
                style={styles.merchantBadgeLogo}
                resizeMode="contain"
              />
            )}
            <Text style={styles.merchantBadgeText}>
              {editing && editedCard.merchant_id ? 
                merchants.find(m => m.merchant_id === editedCard.merchant_id)?.name || card.merchant_name
                : card.merchant_name
              }
            </Text>
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
                  placeholder="e.g., Gold Member Card"
                  placeholderTextColor="#8E8E93"
                />
              ) : (
                <Text style={styles.fieldValue}>{card.card_name}</Text>
              )}
            </View>

            {editing && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Merchant</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={editedCard.merchant_id || card.merchant_id}
                    onValueChange={(itemValue) => setEditedCard({ ...editedCard, merchant_id: itemValue })}
                    style={styles.picker}
                  >
                    {merchants.map((merchant) => (
                      <Picker.Item key={merchant.merchant_id} label={merchant.name} value={merchant.merchant_id} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

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
                  placeholder="Add notes..."
                  placeholderTextColor="#8E8E93"
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
              <TouchableOpacity 
                style={[styles.actionButton, styles.saveButton, saving && styles.saveButtonDisabled]} 
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
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

      {/* Image Zoom Modal */}
      <Modal
        visible={imageZoomModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageZoomModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setImageZoomModal(false)}
          >
            <Ionicons name="close" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          <Image 
            source={{ uri: currentImage || '' }} 
            style={styles.zoomedImage}
            resizeMode="contain"
          />
          <Text style={styles.zoomHintText}>Rotate for better scanning</Text>
        </View>
      </Modal>
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
  editImageButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addPhotoText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  merchantBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  merchantBadgeLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
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
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
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
  saveButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  zoomedImage: {
    width: '100%',
    height: '80%',
  },
  zoomHintText: {
    position: 'absolute',
    bottom: 60,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
