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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { cardAPI, Merchant } from '../../utils/api';

export default function AddCardScreen() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [cardName, setCardName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [merchantDropdownVisible, setMerchantDropdownVisible] = useState(false);

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    try {
      const data = await cardAPI.getMerchants();
      setMerchants(data);
      if (data.length > 0) {
        setSelectedMerchantId(data[0].merchant_id);
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
    if (!selectedMerchantId) {
      Alert.alert('Select a Merchant', 'Please choose which store or brand this loyalty card is for.');
      return;
    }
    if (!cardName.trim()) {
      Alert.alert('Card Name Required', 'Please give your card a name (e.g., "Gold Member Card" or "Rewards Card").');
      return;
    }
    if (!barcode.trim()) {
      Alert.alert('Barcode Required', 'Please enter the barcode number from your card. You\'ll need this to use your card.');
      return;
    }

    try {
      setSaving(true);
      await cardAPI.createCard({
        merchant_id: selectedMerchantId,
        card_name: cardName.trim(),
        barcode: barcode.trim(),
        notes: notes.trim(),
        image_base64: imageBase64,
        is_favorite: false,
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
          <Text style={styles.title}>Add New Card</Text>
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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Merchant *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedMerchantId}
                  onValueChange={(itemValue) => setSelectedMerchantId(itemValue)}
                  style={styles.picker}
                >
                  {merchants.map((merchant) => (
                    <Picker.Item key={merchant.merchant_id} label={merchant.name} value={merchant.merchant_id} />
                  ))}
                </Picker>
              </View>
              {/* Show merchant logo */}
              {selectedMerchantId && merchants.find(m => m.merchant_id === selectedMerchantId)?.logo_url && (
                <View style={styles.selectedMerchantLogoContainer}>
                  <Image 
                    source={{ uri: merchants.find(m => m.merchant_id === selectedMerchantId)?.logo_url }} 
                    style={styles.selectedMerchantLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.selectedMerchantText}>
                    {merchants.find(m => m.merchant_id === selectedMerchantId)?.name}
                  </Text>
                </View>
              )}
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
              <Text style={styles.label}>Barcode Number *</Text>
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
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
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
  selectedMerchantLogoContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedMerchantLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  selectedMerchantText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },
});
