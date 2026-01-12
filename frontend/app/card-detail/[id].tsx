import React, { useState, useEffect, useMemo } from 'react';
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
  Dimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import ImageViewer from 'react-native-image-zoom-viewer';
import { cardAPI, Card, Merchant } from '../../utils/api';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CardDetailScreen() {
  const { id, autoZoom } = useLocalSearchParams<{ id: string, autoZoom?: string }>();
  const router = useRouter();
  
  const [card, setCard] = useState<Card | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedCard, setEditedCard] = useState<Partial<Card>>({});
  const [merchantModalVisible, setMerchantModalVisible] = useState(false);
  const [merchantSearchQuery, setMerchantSearchQuery] = useState('');
  const [imageZoomModal, setImageZoomModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadCard(true); // Initial load with autoZoom potential
      loadMerchants();
    }
  }, [id]);

  useEffect(() => {
    const backAction = () => {
      if (imageZoomModal) {
        setImageZoomModal(false);
        return true;
      }
      if (merchantModalVisible) {
        setMerchantModalVisible(false);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [imageZoomModal, merchantModalVisible]);

  const loadCard = async (shouldAutoZoom: boolean = false) => {
    try {
      setLoading(true);
      const data = await cardAPI.getCard(id);
      setCard(data);
      setEditedCard(data);
      
      // EXPERT UX FIX: Only auto-zoom on initial entry, not after saving
      if (shouldAutoZoom && autoZoom !== 'false' && data.image_base64) {
        setImageZoomModal(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (error) {
      console.error('Error loading card:', error);
      Toast.show({ type: 'error', text1: 'Failed to load card' });
    } finally {
      setLoading(false);
    }
  };

  const loadMerchants = async () => {
    try {
      const data = await cardAPI.getMerchants();
      setMerchants(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading merchants:', error);
    }
  };

  const filteredMerchants = useMemo(() => {
    if (!merchantSearchQuery) return merchants;
    return merchants.filter(m => m.name.toLowerCase().includes(merchantSearchQuery.toLowerCase()));
  }, [merchants, merchantSearchQuery]);

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
      setEditedCard({ ...editedCard, image_base64: `data:image/jpeg;base64,${result.assets[0].base64}` });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = async () => {
    if (!card?.card_id) return;
    try {
      setSaving(true);
      await cardAPI.updateCard(card.card_id, editedCard);
      
      // EXPERT UX FIX: Heavy success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Success', 'Card details updated successfully!');
      
      setEditing(false);
      loadCard(false); // Refresh data WITHOUT auto-zooming
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: 'error', text1: 'Update failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Card', 'Remove this card?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { 
          if (card?.card_id) { 
            await cardAPI.deleteCard(card.card_id); 
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/'); 
          } 
        } catch (e) {}
      }}
    ]);
  };

  const toggleFavorite = async () => {
    if (!card?.card_id) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cardAPI.toggleFavorite(card.card_id, !card.is_favorite);
      setCard({ ...card, is_favorite: !card.is_favorite });
    } catch (error) {}
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!card) return <View style={styles.center}><Text>Card not found</Text></View>;

  const currentImage = editing ? editedCard.image_base64 : card.image_base64;
  const currentMerchantName = editing ? merchants.find(m => m.merchant_id === editedCard.merchant_id)?.name || card.merchant_name : card.merchant_name;
  const currentMerchantLogo = editing ? merchants.find(m => m.merchant_id === editedCard.merchant_id)?.logo_url || card.merchant_logo_url : card.merchant_logo_url;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={28} /></TouchableOpacity>
          <Text style={styles.headerTitle}>{editing ? 'Edit Card' : 'Card Details'}</Text>
          <TouchableOpacity onPress={toggleFavorite}>
            <Ionicons name={card.is_favorite ? 'star' : 'star-outline'} size={28} color={card.is_favorite ? '#FFD700' : '#8E8E93'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 100}}>
          <TouchableOpacity 
            activeOpacity={editing ? 0.7 : 0.9} 
            onPress={() => editing ? Alert.alert('Photo', 'Select:', [{text:'Camera', onPress:()=>pickImage(true)}, {text:'Gallery', onPress:()=>pickImage(false)}, {text:'Cancel'}]) : (currentImage && setImageZoomModal(true))}
            style={styles.imageWrapper}
          >
            {currentImage ? <Image source={{ uri: currentImage }} style={styles.cardImage} /> : <View style={styles.noImage}><Ionicons name="camera" size={48} color="#CCC" /></View>}
            <View style={styles.actionBadge}><Ionicons name={editing ? "camera" : "expand"} size={18} color="#FFF" /></View>
          </TouchableOpacity>

          <View style={styles.content}>
            <TouchableOpacity style={[styles.merchantRow, editing && styles.editableRow]} disabled={!editing} onPress={() => setMerchantModalVisible(true)}>
              {currentMerchantLogo && <Image source={{ uri: currentMerchantLogo }} style={styles.merchantLogo} />}
              <Text style={styles.merchantName}>{currentMerchantName}</Text>
              {editing && <Ionicons name="chevron-forward" size={20} color="#007AFF" style={{marginLeft: 'auto'}} />}
            </TouchableOpacity>

            <View style={styles.barcodeBox}>
              <Text style={styles.barcodeLabel}>{editing ? 'EDIT BARCODE' : 'SCAN AT COUNTER'}</Text>
              {editing ? <TextInput style={styles.barcodeInput} value={editedCard.barcode} onChangeText={t => setEditedCard({...editedCard, barcode: t})} /> : <Text style={styles.barcodeText}>{card.barcode}</Text>}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Card Name</Text>
              {editing ? <TextInput style={styles.input} value={editedCard.card_name} onChangeText={t => setEditedCard({...editedCard, card_name: t})} /> : <Text style={styles.value}>{card.card_name}</Text>}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notes</Text>
              {editing ? <TextInput style={[styles.input, {height: 80}]} multiline value={editedCard.notes} onChangeText={t => setEditedCard({...editedCard, notes: t})} /> : <Text style={styles.value}>{card.notes || 'No notes'}</Text>}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {editing ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btnSec} onPress={() => { setEditing(false); setEditedCard(card); }}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnPrim} onPress={handleSave}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPrimText}>Save Changes</Text>}</TouchableOpacity>
            </View>
          ) : (
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btnSec, {flex: 1}]} onPress={() => setEditing(true)}><Ionicons name="create-outline" size={20} color="#007AFF" /><Text style={styles.btnSecTextBlue}>Edit</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnSec, {flex: 1}]} onPress={handleDelete}><Ionicons name="trash-outline" size={20} color="#FF3B30" /><Text style={styles.btnSecTextRed}>Delete</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={merchantModalVisible} animationType="slide" transparent={true} onRequestClose={() => setMerchantModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Merchant</Text><TouchableOpacity onPress={() => setMerchantModalVisible(false)}><Ionicons name="close" size={28} /></TouchableOpacity></View><View style={styles.searchBar}><Ionicons name="search" size={20} color="#8E8E93" /><TextInput placeholder="Search..." style={{flex:1, marginLeft: 10}} value={merchantSearchQuery} onChangeText={setMerchantSearchQuery} /></View><ScrollView style={{paddingHorizontal: 20}}>{filteredMerchants.map(m => (<TouchableOpacity key={m.merchant_id} style={styles.mItem} onPress={() => { setEditedCard({...editedCard, merchant_id: m.merchant_id}); setMerchantModalVisible(false); }}><Image source={{ uri: m.logo_url }} style={styles.mLogo} /><Text style={styles.mName}>{m.name}</Text></TouchableOpacity>))}</ScrollView></View></View>
      </Modal>

      <Modal visible={imageZoomModal} transparent={true} animationType="fade" statusBarTranslucent={true} onRequestClose={() => setImageZoomModal(false)}>
        <View style={styles.masterZoomWrapper}>
          <TouchableOpacity style={styles.topCloseBtn} onPress={() => setImageZoomModal(false)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.rotatedContainer}>
            <ImageViewer
              imageUrls={[{ url: currentImage || '' }]}
              renderIndicator={() => <></>}
              enableSwipeDown={true}
              onSwipeDown={() => setImageZoomModal(false)}
              backgroundColor="transparent"
              style={{ width: SCREEN_HEIGHT, height: SCREEN_WIDTH }}
              renderImage={(props) => (
                <Image {...props} style={[props.style]} resizeMode="contain" />
              )}
            />
          </View>
          <View style={styles.expertActionBar}>
            <TouchableOpacity style={styles.actionIconBtn} onPress={() => { setImageZoomModal(false); setEditing(true); }}>
              <Ionicons name="create-outline" size={24} color="#FFF" />
              <Text style={styles.actionLabel}>Edit</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionIconBtn} onPress={() => { setImageZoomModal(false); handleDelete(); }}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              <Text style={[styles.actionLabel, {color: '#FF3B30'}]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  imageWrapper: { width: '100%', height: 220, backgroundColor: '#FFF', position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  noImage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  actionBadge: { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 25 },
  content: { padding: 24 },
  merchantRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, padding: 12, borderRadius: 12 },
  editableRow: { backgroundColor: '#EBF5FF', borderWidth: 1, borderColor: '#007AFF' },
  merchantLogo: { width: 32, height: 32, borderRadius: 6, marginRight: 12 },
  merchantName: { fontSize: 20, fontWeight: '700' },
  barcodeBox: { backgroundColor: '#000', padding: 24, borderRadius: 16, alignItems: 'center', marginBottom: 24 },
  barcodeLabel: { color: '#8E8E93', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  barcodeText: { color: '#FFF', fontSize: 32, fontWeight: '700', letterSpacing: 2 },
  barcodeInput: { color: '#FFF', fontSize: 32, fontWeight: '700', letterSpacing: 2, borderBottomWidth: 1, borderBottomColor: '#007AFF', width: '100%', textAlign: 'center' },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 13, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  value: { fontSize: 17, color: '#1A1A1A', backgroundColor: '#FFF', padding: 16, borderRadius: 12 },
  input: { fontSize: 17, backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#007AFF' },
  footer: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  row: { flexDirection: 'row', gap: 12 },
  btnPrim: { flex: 1, backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  btnSec: { flex: 1, backgroundColor: '#F2F2F7', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnSecTextBlue: { color: '#007AFF', fontWeight: '700' },
  btnSecTextRed: { color: '#FF3B30', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', margin: 20, padding: 12, borderRadius: 12 },
  mItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  mLogo: { width: 36, height: 36, borderRadius: 8, marginRight: 15 },
  mName: { flex: 1, fontSize: 17, fontWeight: '500' },
  masterZoomWrapper: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  topCloseBtn: { position: 'absolute', top: 50, left: 24, zIndex: 1000, padding: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 30 },
  rotatedContainer: { width: SCREEN_HEIGHT, height: SCREEN_WIDTH, transform: [{ rotate: '90deg' }], justifyContent: 'center', alignItems: 'center' },
  expertActionBar: { position: 'absolute', bottom: 40, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, alignItems: 'center', gap: 24, zIndex: 1000, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  actionIconBtn: { alignItems: 'center', gap: 4 },
  actionLabel: { color: '#FFF', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actionDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' }
});
