import React, { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { cardAPI } from '../../utils/api';

export default function AddCardScreen() {
  const router = useRouter();
  const [merchantName, setMerchantName] = useState('');
  const [cardName, setCardName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [saving, setSaving] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    try {
      // Request permissions
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

      // Launch picker
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
    if (!merchantName.trim()) {
      Alert.alert('Missing Info', 'Please enter the merchant name');
      return;
    }
    if (!cardName.trim()) {
      Alert.alert('Missing Info', 'Please enter the card name');
      return;
    }
    if (!barcode.trim()) {
      Alert.alert('Missing Info', 'Please enter the barcode number');
      return;
    }

    try {
      setSaving(true);
      await cardAPI.createCard({
        merchant_name: merchantName.trim(),
        card_name: cardName.trim(),
        barcode: barcode.trim(),
        notes: notes.trim(),
        image_base64: imageBase64,
        is_favorite: false,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Reset form
      setMerchantName('');
      setCardName('');
      setBarcode('');
      setNotes('');
      setImageBase64('');
      
      // Navigate back to home
      router.push('/(tabs)/');
    } catch (error) {
      console.error('Error saving card:', error);
      Alert.alert('Error', 'Failed to save card. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

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
              <Text style={styles.label}>Merchant Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Starbucks"
                placeholderTextColor="#8E8E93"
                value={merchantName}
                onChangeText={setMerchantName}
              />
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
});
