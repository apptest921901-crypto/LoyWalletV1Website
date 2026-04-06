import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Clipboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { cardAPI, Stats, api } from '../../utils/api';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const { user, signOut, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedName, setEditedName] = useState(user?.full_name || '');
  const [editedUsername, setEditedUsername] = useState(user?.username || '');
  const [editedAvatar, setEditedAvatar] = useState(user?.avatar_url || '');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await cardAPI.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission Required', 'We need photo library access to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setEditedAvatar(`data:image/jpeg;base64,${result.assets[0].base64}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleUpdate = async () => {
    if (!editedName || !editedUsername) {
      Alert.alert('Missing Info', 'Full Name and Username are required.');
      return;
    }

    try {
      setIsUpdating(true);
      await updateProfile({
        full_name: editedName,
        username: editedUsername,
        avatar_url: editedAvatar
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Success', 'Your profile has been updated successfully!');
      setEditModalVisible(false);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Update Failed', 'Could not save changes. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out of LoyWallet?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  const openLegalLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open the link. Please try again later.');
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Please confirm you want to delete your account permanently.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Confirm Delete', 
                  style: 'destructive', 
                  onPress: async () => {
                    try {
                      await api.delete('profile');
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Account Deleted', 'Your account has been deleted successfully.');
                      signOut();
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete account. Please try again later.');
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const response = await api.get('profile/export');
      const dataStr = JSON.stringify(response.data, null, 2);
      
      setIsExporting(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Data Export Ready',
        'Your data has been prepared according to GDPR portability standards.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Copy to Clipboard', 
            onPress: () => {
              Clipboard.setString(dataStr);
              Alert.alert('Copied', 'Data copied to clipboard.');
            }
          },
          { 
            text: 'Share via Email', 
            onPress: () => {
              const body = encodeURIComponent(dataStr);
              // mailto has character limits (~2000), so we check length
              if (body.length > 1800) {
                Alert.alert(
                  'Data too large for Email', 
                  'Your export contains too many cards to send via email link. Please use "Copy to Clipboard" instead.',
                  [{ text: 'OK' }]
                );
              } else {
                Linking.openURL(`mailto:?subject=My LoyWallet Data Export&body=${body}`);
              }
            }
          }
        ]
      );
    } catch (error) {
      setIsExporting(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Export Failed', 'Failed to prepare your data. Please check your connection and try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.full_name?.charAt(0) || 'U'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user?.full_name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.total_cards || 0}</Text>
            <Text style={styles.statLabel}>Cards</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.favorite_cards || 0}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.total_merchants || 0}</Text>
            <Text style={styles.statLabel}>Merchants</Text>
          </View>
        </View>

        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Settings</Text>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => {
              setEditedName(user?.full_name || '');
              setEditedUsername(user?.username || '');
              setEditedAvatar(user?.avatar_url || '');
              setEditModalVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={22} color="#007AFF" />
              <Text style={styles.menuItemText}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
              <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Logout</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.menu}>
          <Text style={styles.menuTitle}>GDPR Data Rights</Text>
          <TouchableOpacity 
            style={[styles.menuItem, isExporting && { opacity: 0.5 }]} 
            onPress={handleExportData}
            disabled={isExporting}
          >
            <View style={styles.menuItemLeft}>
              {isExporting ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Ionicons name="download-outline" size={22} color="#007AFF" />
              )}
              <Text style={styles.menuItemText}>{isExporting ? 'Preparing Export...' : 'Export My Data'}</Text>
            </View>
            {!isExporting && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Delete Account</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Legal & Support</Text>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => openLegalLink('https://apptest921901-crypto.github.io/LoyWalletV1Website/privacy.html')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={22} color="#007AFF" />
              <Text style={styles.menuItemText}>Privacy Policy</Text>
            </View>
            <Ionicons name="open-outline" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => openLegalLink('https://apptest921901-crypto.github.io/LoyWalletV1Website/terms.html')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={22} color="#007AFF" />
              <Text style={styles.menuItemText}>Terms of Service</Text>
            </View>
            <Ionicons name="open-outline" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => openLegalLink('https://apptest921901-crypto.github.io/LoyWalletV1Website/mentions-legales.html')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="business-outline" size={22} color="#007AFF" />
              <Text style={styles.menuItemText}>Legal Notice</Text>
            </View>
            <Ionicons name="open-outline" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => openLegalLink('https://apptest921901-crypto.github.io/LoyWalletV1Website/')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={22} color="#007AFF" />
              <Text style={styles.menuItemText}>Support & Contact</Text>
            </View>
            <Ionicons name="open-outline" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Image 
            source={{ uri: 'https://customer-assets.emergentagent.com/job_lovaltyorganizer/artifacts/cn1jsy8n_Logo%203%20circle.png' }}
            style={styles.logoSmall}
            resizeMode="contain"
          />
          <Text style={styles.versionText}>LoyWallet v1.0.0</Text>
        </View>
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" transparent={true} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><Ionicons name="close" size={28} color="#000" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalForm}>
              <TouchableOpacity style={styles.avatarPicker} onPress={pickImage}>
                <View style={styles.avatarPreviewContainer}>
                  {editedAvatar ? <Image source={{ uri: editedAvatar }} style={styles.avatarPreview} /> : (
                    <View style={[styles.avatarPreview, { backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="person" size={40} color="#8E8E93" />
                    </View>
                  )}
                  <View style={styles.cameraBadge}><Ionicons name="camera" size={18} color="#FFF" /></View>
                </View>
                <Text style={styles.avatarPickerText}>Change Photo</Text>
              </TouchableOpacity>
              <View style={styles.inputGroup}><Text style={styles.label}>Email (Read Only)</Text><TextInput style={[styles.input, styles.disabledInput]} value={user?.email} editable={false} /></View>
              <View style={styles.inputGroup}><Text style={styles.label}>Full Name</Text><TextInput style={styles.input} value={editedName} onChangeText={setEditedName} placeholder="John Doe" /></View>
              <View style={styles.inputGroup}><Text style={styles.label}>Username</Text><TextInput style={styles.input} value={editedUsername} onChangeText={setEditedUsername} autoCapitalize="none" placeholder="johndoe" /></View>
              <TouchableOpacity style={[styles.saveButton, isUpdating && styles.buttonDisabled]} onPress={handleUpdate} disabled={isUpdating}>
                {isUpdating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  scrollContent: { paddingBottom: 40 },
  header: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#FFFFFF' },
  avatarContainer: { marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 40, color: '#FFFFFF', fontWeight: '600' },
  userName: { fontSize: 24, fontWeight: '700', color: '#000000' },
  userEmail: { fontSize: 16, color: '#8E8E93', marginTop: 4 },
  statsGrid: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', elevation: 2 },
  statNumber: { fontSize: 20, fontWeight: '700', color: '#007AFF' },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  menu: { marginTop: 24, backgroundColor: '#FFFFFF' },
  menuTitle: { fontSize: 13, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', padding: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemText: { fontSize: 17 },
  footer: { marginTop: 40, alignItems: 'center', gap: 8 },
  logoSmall: { width: 48, height: 48, opacity: 0.8 },
  versionText: { fontSize: 14, color: '#C7C7CC', fontWeight: '600', marginBottom: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalForm: { padding: 24, gap: 20, paddingBottom: 60 },
  avatarPicker: { alignItems: 'center', marginBottom: 10 },
  avatarPreviewContainer: { position: 'relative' },
  avatarPreview: { width: 100, height: 100, borderRadius: 50 },
  cameraBadge: { position: 'absolute', right: 0, bottom: 0, backgroundColor: '#007AFF', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF' },
  avatarPickerText: { marginTop: 12, color: '#007AFF', fontWeight: '600' },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  input: { backgroundColor: '#F2F2F7', padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  disabledInput: { color: '#8E8E93', backgroundColor: '#F9F9F9' },
  saveButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 }
});
