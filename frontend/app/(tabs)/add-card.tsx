import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { cardAPI, Merchant } from '../../utils/api';

export default function AddCardScreen() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [merchantDropdownVisible, setMerchantDropdownVisible] = useState(false);
  const [cardName, setCardName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    try {
      const data = await cardAPI.getMerchants();
      setMerchants(data);
      if (data.length > 0) {
        setSelectedMerchant(data[0]);
      }
    } catch (error) {
      console.error('Error loading merchants:', error);
      Alert.alert('Error', 'Failed to load merchants');
    } finally {
      setLoading(false);
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
          `We need ${useCamera ? 'camera' : 'photo library'} permissions to add card images.`
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
        setImageBase64(base64String);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const showImageSourceOptions = () => {
    Alert.alert('Add Card Image', 'Choose an option:', [
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
    // Validation
    if (!selectedMerchant) {
      Alert.alert('Select a Merchant', 'Please choose which store or brand this loyalty card is for.');
      return;
    }
    if (!cardName.trim()) {
      Alert.alert('Card Name Required', 'Please give your card a name (e.g., "Gold Member Card" or "Rewards Card").');
      return;
    }
    // Barcode is now optional - no validation needed

    try {
      setSaving(true);
      await cardAPI.createCard({
        merchant_id: selectedMerchant.merchant_id,
        card_name: cardName.trim(),
        barcode: barcode.trim() || 'N/A',  // Use 'N/A' if empty
        notes: notes.trim(),
        image_base64: imageBase64,
        is_favorite: isFavorite,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        '✅ Card Added!',
        'Your loyalty card has been saved successfully. You can now view it on your home screen.',
        [{ 
          text: 'View My Cards', 
          onPress: () => {
            // Reset form
            setCardName('');
            setBarcode('');
            setNotes('');
            setImageBase64('');
            setIsFavorite(false);
            router.push('/');
          }
        }]
      );
    } catch (error: any) {
      console.error('Error saving card:', error);
      
      let errorMessage = 'We couldn\'t save your card. Please try again.';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Could Not Save Card', errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading merchants...</Text>
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
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image 
              source={{ uri: 'https://customer-assets.emergentagent.com/job_lovaltyorganizer/artifacts/cn1jsy8n_Logo%203%20circle.png' }}
              style={styles.logoSmall}
              resizeMode="contain"
            />
            <Text style={styles.title}>Add New Card</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Image Picker */}
          <TouchableOpacity style={styles.imagePicker} onPress={showImageSourceOptions}>
            {imageBase64 ? (
              <Image source={{ uri: imageBase64 }} style={styles.cardImage} />
            ) : (
              <View style={styles.imagePickerPlaceholder}>
                <Ionicons name="camera" size={48} color="#8E8E93" />
                <Text style={styles.imagePickerText}>Add Card Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Custom Merchant Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Merchant *</Text>
              <TouchableOpacity
                style={styles.customDropdown}
                onPress={() => setMerchantDropdownVisible(true)}
              >
                {selectedMerchant ? (
                  <View style={styles.selectedMerchantDisplay}>
                    {selectedMerchant.logo_url && (
                      <Image
                        source={{ uri: selectedMerchant.logo_url }}
                        style={styles.dropdownLogo}
                        resizeMode="contain"
                      />
                    )}
                    <Text style={styles.selectedMerchantName}>{selectedMerchant.name}</Text>
                  </View>
                ) : (
                  <Text style={styles.dropdownPlaceholder}>Select a merchant</Text>
                )}
                <Ionicons name="chevron-down" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Card Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Gold Member Card"
                placeholderTextColor="#8E8E93"
                value={cardName}
                onChangeText={setCardName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Barcode Number (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1234567890"
                placeholderTextColor="#8E8E93"
                value={barcode}
                onChangeText={setBarcode}
                keyboardType="default"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any additional notes..."
                placeholderTextColor="#8E8E93"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Favorite Toggle */}
            <TouchableOpacity
              style={styles.favoriteToggle}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsFavorite(!isFavorite);
              }}
            >
              <View style={styles.favoriteToggleContent}>
                <Ionicons
                  name={isFavorite ? 'star' : 'star-outline'}
                  size={28}
                  color={isFavorite ? '#FFD700' : '#8E8E93'}
                />
                <View style={styles.favoriteTextContainer}>
                  <Text style={styles.favoriteToggleLabel}>Add to Favorites</Text>
                  <Text style={styles.favoriteToggleHint}>
                    Mark this card as a favorite for quick access
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Card</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Merchant Selection Modal */}
      <Modal
        visible={merchantDropdownVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMerchantDropdownVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Merchant</Text>
              <TouchableOpacity onPress={() => setMerchantDropdownVisible(false)}>
                <Ionicons name="close" size={28} color="#000000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.merchantList}>
              {merchants.map((merchant) => (
                <TouchableOpacity
                  key={merchant.merchant_id}
                  style={[
                    styles.merchantItem,
                    selectedMerchant?.merchant_id === merchant.merchant_id && styles.merchantItemSelected
                  ]}
                  onPress={() => {
                    setSelectedMerchant(merchant);
                    setMerchantDropdownVisible(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  {merchant.logo_url && (
                    <Image
                      source={{ uri: merchant.logo_url }}
                      style={styles.merchantItemLogo}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={styles.merchantItemName}>{merchant.name}</Text>
                  {selectedMerchant?.merchant_id === merchant.merchant_id && (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoSmall: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imagePicker: {
    marginHorizontal: 24,
    marginTop: 24,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePickerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  customDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedMerchantDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#F2F2F7',
  },
  selectedMerchantName: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#8E8E93',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  favoriteToggle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  favoriteToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  favoriteToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  favoriteToggleHint: {
    fontSize: 13,
    color: '#8E8E93',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  merchantList: {
    paddingHorizontal: 24,
  },
  merchantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  merchantItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  merchantItemLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#F2F2F7',
  },
  merchantItemName: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
});
