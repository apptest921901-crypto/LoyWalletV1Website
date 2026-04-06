import React, { useState, useEffect, useMemo } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { cardAPI, Merchant } from '../../utils/api';
import BarcodeDisplay from '../../components/BarcodeDisplay';

interface ScanResult {
  barcode: string;
  imageBase64: string;
}

export default function AddCardScreen() {
  const router = useRouter();
  const { scannedBarcode, scannedImage } = useLocalSearchParams<{ scannedBarcode?: string; scannedImage?: string }>();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [merchantDropdownVisible, setMerchantDropdownVisible] = useState(false);
  const [merchantSearchQuery, setMerchantSearchQuery] = useState('');
  
  const [cardName, setCardName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Handle scanned barcode and image from scanner screen
  useEffect(() => {
    if (scannedBarcode) {
      setBarcode(scannedBarcode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (scannedImage) {
      setImageBase64(scannedImage);
    }
  }, [scannedBarcode, scannedImage]);

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    try {
      console.log('Loading merchants from:', process.env.EXPO_PUBLIC_BACKEND_URL);
      const data = await cardAPI.getMerchants();
      console.log('Merchants loaded:', data.length);
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setMerchants(sorted);
    } catch (error: any) {
      console.error('Error loading merchants:', error);
      console.error('Error details:', error.message, error.code, error.response?.status);
      Alert.alert('Error', `Failed to load merchants: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredMerchants = useMemo(() => {
    if (!merchantSearchQuery) return merchants;
    return merchants.filter(m => 
      m.name.toLowerCase().includes(merchantSearchQuery.toLowerCase())
    );
  }, [merchants, merchantSearchQuery]);

  const resetForm = () => {
    setSelectedMerchant(null);
    setCardName('');
    setBarcode('');
    setNotes('');
    setImageBase64('');
    setIsFavorite(false);
    setMerchantSearchQuery('');
  };

  const handleSave = async () => {
    if (!selectedMerchant) {
      Alert.alert('Merchant Required', 'Please select a brand for your card.');
      return;
    }
    if (!cardName.trim()) {
      Alert.alert('Name Required', 'Please give your card a name.');
      return;
    }

    try {
      setSaving(true);
      await cardAPI.createCard({
        merchant_id: selectedMerchant.merchant_id,
        card_name: cardName.trim(),
        barcode: barcode.trim() || 'N/A',
        notes: notes.trim(),
        image_base64: imageBase64,
        is_favorite: isFavorite,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();

      Alert.alert('🎉 Card Added!', 'Your card has been saved successfully to LoyWallet.', [
        { text: 'View My Cards', onPress: () => router.push('/') }
      ]);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Save card error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      Alert.alert('Error', `Could not save card. ${error.response?.data?.detail || error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      base64: true,
    };
    const result = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0].base64) {
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const openBarcodeScanner = () => {
    router.push({
      pathname: '/barcode-scanner',
      params: { 
        returnPath: '/(tabs)/add-card'
      }
    });
  };

  // Show loading overlay instead of replacing entire screen
  // This ensures Save button is always visible
  const isFormDisabled = loading;
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Image source={{ uri: 'https://customer-assets.emergentagent.com/job_lovaltyorganizer/artifacts/cn1jsy8n_Logo%203%20circle.png' }} style={styles.logoSmall} />
        <Text style={styles.title}>Add Card</Text>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {/* Barcode Scan Section - Changes based on scan state */}
          {barcode && barcode !== 'N/A' ? (
            /* SCANNED STATE: Live preview with rescan option */
            <View style={styles.scannedContainer}>
              <View style={styles.scannedHeader}>
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <Text style={styles.scannedText}>Barcode Scanned</Text>
              </View>
              
              {/* Live Barcode Preview */}
              <View style={styles.barcodePreviewContainer}>
                <BarcodeDisplay value={barcode} height={100} />
                <Text style={styles.barcodeNumber}>{barcode}</Text>
              </View>
              
              {/* Rescan Option */}
              <TouchableOpacity style={styles.rescanButton} onPress={openBarcodeScanner}>
                <Ionicons name="scan-outline" size={20} color="#007AFF" />
                <Text style={styles.rescanButtonText}>Rescan Barcode</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* EMPTY STATE: Initial scan prompt */
            <TouchableOpacity style={styles.scanCardButton} onPress={openBarcodeScanner}>
              <View style={styles.scanCardContent}>
                <Ionicons name="scan-outline" size={48} color="#007AFF" />
                <Text style={styles.scanCardTitle}>Scan Card Barcode</Text>
                <Text style={styles.scanCardSubtitle}>Point camera at barcode or QR code</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Photo Preview (populated after scan or manual add) */}
          <TouchableOpacity style={styles.imagePicker} onPress={() => Alert.alert('Add Photo', 'Source:', [{text:'Camera', onPress:()=>pickImage(true)}, {text:'Gallery', onPress:()=>pickImage(false)}, {text:'Cancel'}])}>
            {imageBase64 ? <Image source={{ uri: imageBase64 }} style={styles.cardImage} /> : (
              <View style={styles.imagePickerPlaceholder}>
                <Ionicons name="camera" size={32} color="#8E8E93" />
                <Text style={{color: '#8E8E93', marginTop: 8, fontSize: 14}}>Add Photo Manually</Text>
              </View>
            )}
          </TouchableOpacity>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={100}
          >
            <View style={styles.form}>
              <Text style={styles.label}>Merchant *</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setMerchantDropdownVisible(true)}>
                {selectedMerchant ? (
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Image source={{ uri: selectedMerchant.logo_url }} style={styles.dropdownLogo} />
                    <Text style={styles.selectedText}>{selectedMerchant.name}</Text>
                  </View>
                ) : <Text style={{color: '#8E8E93'}}>Select Merchant</Text>}
                <Ionicons name="chevron-down" size={20} color="#8E8E93" />
              </TouchableOpacity>

              <Text style={styles.label}>Card Name *</Text>
              <TextInput style={styles.input} value={cardName} onChangeText={setCardName} placeholder="e.g. Gold Rewards" />

              {/* RESTORED FAVORITE TOGGLE */}
              <TouchableOpacity 
                style={styles.favoriteRow} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsFavorite(!isFavorite);
                }}
              >
                <Ionicons name={isFavorite ? "star" : "star-outline"} size={24} color={isFavorite ? "#FFD700" : "#8E8E93"} />
                <Text style={[styles.favoriteText, isFavorite && {color: '#000'}]}>Mark as Favorite</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, {height: 80}]} value={notes} onChangeText={setNotes} multiline placeholder="Extra details..." />
            </View>
          </KeyboardAvoidingView>
          
          {/* Extra space at bottom to ensure content is scrollable above footer */}
          <View style={{height: 180}} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.saveButton, (!selectedMerchant || !cardName.trim()) && styles.saveButtonDisabled]} 
            onPress={handleSave} 
            disabled={saving || !selectedMerchant || !cardName.trim()}
          >
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveButtonText, (!selectedMerchant || !cardName.trim()) && styles.saveButtonTextDisabled]}>Save Card</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={merchantDropdownVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Select Merchant</Text><TouchableOpacity onPress={() => setMerchantDropdownVisible(false)}><Ionicons name="close" size={28} /></TouchableOpacity></View><View style={styles.searchBarContainer}><Ionicons name="search" size={20} color="#8E8E93" style={{marginLeft: 12}} /><TextInput style={styles.searchBarInput} placeholder="Search brands..." value={merchantSearchQuery} onChangeText={setMerchantSearchQuery} autoFocus={true}/></View><ScrollView style={{paddingHorizontal: 20}}>{filteredMerchants.map(m => (<TouchableOpacity key={m.merchant_id} style={styles.merchantItem} onPress={() => { Haptics.selectionAsync(); setSelectedMerchant(m); setMerchantDropdownVisible(false); setMerchantSearchQuery(''); }}><Image source={{ uri: m.logo_url }} style={styles.itemLogo} /><Text style={styles.itemName}>{m.name}</Text></TouchableOpacity>))}</ScrollView></View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  contentContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  logoSmall: { width: 32, height: 32, marginRight: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  scanCardButton: { 
    margin: 20, 
    height: 200, 
    borderRadius: 16, 
    backgroundColor: '#EBF5FF', 
    borderWidth: 2, 
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    overflow: 'hidden' 
  },
  scanCardContent: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 20 
  },
  scanCardTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#007AFF',
    marginTop: 12 
  },
  scanCardSubtitle: { 
    fontSize: 14, 
    color: '#5AC8FA',
    marginTop: 4,
    textAlign: 'center'
  },
  /* Scanned State Styles */
  scannedContainer: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#F0FFF4',
    borderWidth: 2,
    borderColor: '#34C759',
  },
  scannedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  scannedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
  barcodePreviewContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  barcodeNumber: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFF',
    gap: 8,
  },
  rescanButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  imagePicker: { marginHorizontal: 20, height: 120, borderRadius: 12, backgroundColor: '#FFF', elevation: 2, overflow: 'hidden', marginTop: 0 },
  cardImage: { width: '100%', height: '100%' },
  imagePickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA' },
  dropdownLogo: { width: 24, height: 24, borderRadius: 4, marginRight: 10 },
  selectedText: { fontSize: 16, fontWeight: '500' },
  input: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA', fontSize: 16 },
  favoriteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 10, padding: 4 },
  favoriteText: { fontSize: 16, fontWeight: '600', color: '#8E8E93' },
  footer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 100 : 110, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  saveButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 16, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#C7C7CC' },
  saveButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  saveButtonTextDisabled: { color: '#8E8E93' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', margin: 20, borderRadius: 12, height: 48 },
  searchBarInput: { flex: 1, fontSize: 16, paddingHorizontal: 10 },
  merchantItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  itemLogo: { width: 36, height: 36, borderRadius: 8, marginRight: 15 },
  itemName: { flex: 1, fontSize: 17, fontWeight: '500' }
});
