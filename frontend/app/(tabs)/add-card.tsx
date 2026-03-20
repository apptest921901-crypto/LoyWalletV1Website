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
import { useRouter } from 'expo-router';
import { cardAPI, Merchant } from '../../utils/api';

export default function AddCardScreen() {
  const router = useRouter();
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

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    try {
      const data = await cardAPI.getMerchants();
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setMerchants(sorted);
    } catch (error) {
      console.error('Error loading merchants:', error);
      Alert.alert('Error', 'Failed to load merchants');
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
      Alert.alert('Error', 'Could not save card.');
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <View style={styles.header}>
          <Image source={{ uri: 'https://customer-assets.emergentagent.com/job_lovaltyorganizer/artifacts/cn1jsy8n_Logo%203%20circle.png' }} style={styles.logoSmall} />
          <Text style={styles.title}>Add Card</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.imagePicker} onPress={() => Alert.alert('Add Photo', 'Source:', [{text:'Camera', onPress:()=>pickImage(true)}, {text:'Gallery', onPress:()=>pickImage(false)}, {text:'Cancel'}])}>
            {imageBase64 ? <Image source={{ uri: imageBase64 }} style={styles.cardImage} /> : (
              <View style={styles.imagePickerPlaceholder}>
                <Ionicons name="camera" size={40} color="#8E8E93" />
                <Text style={{color: '#8E8E93', marginTop: 8}}>Add Card Photo</Text>
              </View>
            )}
          </TouchableOpacity>

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

            <Text style={styles.label}>Barcode (Optional)</Text>
            <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholder="Number on card" />

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
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Card</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={merchantDropdownVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Select Merchant</Text><TouchableOpacity onPress={() => setMerchantDropdownVisible(false)}><Ionicons name="close" size={28} /></TouchableOpacity></View><View style={styles.searchBarContainer}><Ionicons name="search" size={20} color="#8E8E93" style={{marginLeft: 12}} /><TextInput style={styles.searchBarInput} placeholder="Search brands..." value={merchantSearchQuery} onChangeText={setMerchantSearchQuery} autoFocus={true}/></View><ScrollView style={{paddingHorizontal: 20}}>{filteredMerchants.map(m => (<TouchableOpacity key={m.merchant_id} style={styles.merchantItem} onPress={() => { Haptics.selectionAsync(); setSelectedMerchant(m); setMerchantDropdownVisible(false); setMerchantSearchQuery(''); }}><Image source={{ uri: m.logo_url }} style={styles.itemLogo} /><Text style={styles.itemName}>{m.name}</Text></TouchableOpacity>))}</ScrollView></View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  logoSmall: { width: 32, height: 32, marginRight: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  scrollContent: { paddingBottom: 40 },
  imagePicker: { margin: 20, height: 180, borderRadius: 12, backgroundColor: '#FFF', elevation: 2, overflow: 'hidden' },
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
  footer: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  saveButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 16, alignItems: 'center' },
  saveButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
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
