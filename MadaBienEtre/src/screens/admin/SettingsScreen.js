// src/screens/admin/SettingsScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  SafeAreaView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';

const SettingsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark, toggleTheme } = useTheme();
  // ✅ CORRIGÉ : on utilise `updateProfile` (fusion locale sûre) au lieu
  // de `updateUser` pour les mises à jour PARTIELLES (photo). Voir plus
  // bas pour le détail du bug que ça corrige.
  const { user, logout, token, updateProfile } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // État pour la photo de profil
  const [profileImage, setProfileImage] = useState(user?.profile_image || null);

  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: true,
    smsNotifications: false,
    autoApprove: false,
    commissionRate: 10,
    minPrice: 25000,
    maxDistance: 10,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ============================================================
  // CHARGEMENT DES PARAMÈTRES
  // ============================================================
  useFocusEffect(
    useCallback(() => {
      loadSettings();
      // Mettre à jour la photo de profil si l'utilisateur change
      if (user?.profile_image) {
        setProfileImage(user.profile_image);
      }
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadSettings = async () => {
    try {
      const data = await adminService.getAdminSettings().catch(() => null);
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Impossible de charger les paramètres');
    }
  };

  // ============================================================
  // ✅ UPLOAD PHOTO DE PROFIL
  //
  // 🐛 BUG CORRIGÉ (redirection vers l'espace client après upload) :
  // cet écran appelait `updateUser({ profile_image: url })`, or
  // `updateUser` dans AuthContext.js faisait un REMPLACEMENT complet
  // (`setUser(userData)`), pas une fusion. Le `user` en contexte se
  // retrouvait donc réduit à `{ profile_image: url }` — plus de
  // `role`, `id`, `fullname`… Si votre navigateur racine choisit la
  // pile Admin/Thérapeute/Client selon `user.role`, perdre `role`
  // faisait retomber l'app sur la pile par défaut (Client), d'où la
  // redirection inattendue. `updateProfile` (voir AuthContext.js)
  // fusionne correctement les champs partiels dans le user existant.
  // ============================================================
  const handleUploadPhoto = async () => {
    try {
      // Demander la permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('⚠️ Permission refusée', "Veuillez autoriser l'accès à la galerie");
        return;
      }

      // Ouvrir la galerie
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];

        // ✅ CORRIGÉ : sur le Web, `selectedImage.uri` est une URL
        // blob:/data: SANS extension exploitable — se fier d'abord au
        // `mimeType` renvoyé par expo-image-picker, avec un repli sûr.
        let extension = 'jpg';
        let mimeType = selectedImage.mimeType;
        if (mimeType && mimeType.includes('/')) {
          extension = mimeType.split('/')[1] || 'jpg';
        } else {
          const guessedExt = selectedImage.uri.split('.').pop()?.toLowerCase();
          if (guessedExt && guessedExt.length <= 5 && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'].includes(guessedExt)) {
            extension = guessedExt;
          }
          mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
        }
        const fileName = `profile_${Date.now()}.${extension}`;

        setUploadingPhoto(true);

        // ✅ CORRIGÉ (bug 422 "Expected UploadFile, received: str",
        // Web uniquement — Android fonctionnait déjà) :
        // `formData.append('file', {uri, type, name})` est une forme
        // SPÉCIALE que seul React Native (natif) sait interpréter —
        // le moteur va lui-même lire le fichier depuis l'URI. Dans un
        // navigateur (Web), `FormData` est l'API native du navigateur :
        // elle ne comprend PAS cet objet et le convertit juste en
        // chaîne de caractères ("[object Object]"), ce que le backend
        // recevait comme `str` au lieu d'un vrai fichier. Sur le Web,
        // il faut donc récupérer le vrai contenu binaire (`fetch` +
        // `blob()`) et construire un objet `File` standard.
        let fileToUpload;
        if (Platform.OS === 'web') {
          const blob = await fetch(selectedImage.uri).then((r) => r.blob());
          fileToUpload = new File([blob], fileName, { type: mimeType });
        } else {
          fileToUpload = {
            uri: selectedImage.uri,
            type: mimeType,
            name: fileName,
          };
        }

        // Uploader la photo
        const response = await adminService.uploadProfilePhoto(fileToUpload);

        if (response && response.profile_image) {
          setProfileImage(response.profile_image);

          // ✅ Fusionne dans le contexte (ne perd plus role/id/etc.)
          if (updateProfile) {
            await updateProfile({ profile_image: response.profile_image });
          }

          Alert.alert('✅ Succès', 'Photo de profil mise à jour avec succès');
        } else {
          throw new Error("Réponse invalide du serveur (profile_image manquant)");
        }
      }
    } catch (error) {
      console.error('❌ Error uploading photo:', error);
      Alert.alert('❌ Erreur', `Impossible d'uploader la photo: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ============================================================
  // ✅ SUPPRIMER LA PHOTO DE PROFIL
  // ============================================================
  const handleRemovePhoto = async () => {
    Alert.alert(
      '🗑️ Supprimer la photo',
      'Voulez-vous supprimer votre photo de profil ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingPhoto(true);

              // Mettre à jour le profil avec profile_image = null
              await adminService.updateMyProfile({ profile_image: null });

              setProfileImage(null);

              // ✅ Fusionne dans le contexte (ne perd plus role/id/etc.)
              if (updateProfile) {
                await updateProfile({ profile_image: null });
              }

              Alert.alert('✅ Succès', 'Photo de profil supprimée');
            } catch (error) {
              console.error('❌ Error removing photo:', error);
              Alert.alert('❌ Erreur', `Impossible de supprimer la photo: ${error.message || 'Erreur inconnue'}`);
            } finally {
              setUploadingPhoto(false);
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // SAUVEGARDE DES PARAMÈTRES
  //
  // ⚠️ Cette fonction ne touche jamais `user`/le contexte d'auth et ne
  // navigue jamais explicitement — elle ne peut donc pas, à elle
  // seule, causer une redirection. Si une redirection vers l'espace
  // client survient encore après un "Enregistrer" une fois le correctif
  // ci-dessus en place, la cause est ailleurs (navigateur racine
  // réagissant à un changement de référence de `user`, ou état déjà
  // corrompu par une précédente action non corrigée dans la même
  // session) — vérifiez alors App.js / RootNavigator.js.
  // ============================================================
  const handleSaveSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await adminService.updateAdminSettings(settings);
      Alert.alert('✅ Succès', 'Paramètres enregistrés avec succès');
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      setError("Impossible d'enregistrer les paramètres");
      Alert.alert('❌ Erreur', `Impossible d'enregistrer: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // DÉCONNEXION
  // ============================================================
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setShowLogoutModal(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('❌ Logout error:', error);
      Alert.alert('❌ Erreur', 'Impossible de se déconnecter');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const openLogoutModal = () => setShowLogoutModal(true);
  const closeLogoutModal = () => setShowLogoutModal(false);

  // ============================================================
  // RENDU
  // ============================================================
  const settingSections = [
    {
      id: 'general',
      title: 'Notifications',
      icon: 'notifications-outline',
      items: [
        { id: 'notifications', label: 'Notifications push', type: 'switch' },
        { id: 'emailNotifications', label: 'Notifications email', type: 'switch' },
        { id: 'smsNotifications', label: 'Notifications SMS', type: 'switch' },
      ],
    },
    {
      id: 'platform',
      title: 'Plateforme',
      icon: 'settings-outline',
      items: [
        { id: 'commissionRate', label: 'Taux de commission (%)', type: 'input' },
        { id: 'minPrice', label: 'Prix minimum (Ar)', type: 'input' },
        { id: 'maxDistance', label: 'Distance max (km)', type: 'input' },
      ],
    },
    {
      id: 'moderation',
      title: 'Modération',
      icon: 'shield-outline',
      items: [
        { id: 'autoApprove', label: 'Approbation automatique', type: 'switch' },
      ],
    },
  ];

  const renderSettingItem = (item) => {
    if (item.type === 'switch') {
      return (
        <Switch
          value={settings[item.id] || false}
          onValueChange={(value) => {
            setSettings({ ...settings, [item.id]: value });
          }}
          trackColor={{ false: '#ccc', true: colors.primary }}
          thumbColor="#fff"
        />
      );
    } else if (item.type === 'input') {
      return (
        <TextInput
          style={[styles.settingInput, {
            color: themeColors.text,
            borderColor: themeColors.border || '#E0E0E0',
            backgroundColor: isDark ? '#1E1E1E' : '#F5F5F5',
          }]}
          value={String(settings[item.id] || 0)}
          onChangeText={(text) => {
            const value = parseFloat(text) || 0;
            setSettings({ ...settings, [item.id]: value });
          }}
          keyboardType="numeric"
        />
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Paramètres" showBack />

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: '#E74C3C20', borderColor: '#E74C3C' }]}>
            <Ionicons name="alert-circle" size={20} color="#E74C3C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Animated.ScrollView
          style={[styles.scrollView, { opacity: fadeAnim }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ✅ Profil admin avec upload de photo */}
          <View style={[styles.profileCard, { backgroundColor: themeColors.surface }]}>
            {/* Avatar avec possibilité d'upload */}
            <TouchableOpacity
              style={styles.profileAvatarContainer}
              onPress={handleUploadPhoto}
              disabled={uploadingPhoto}
              activeOpacity={0.8}
            >
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <View style={[styles.profileAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.profileAvatarText, { color: colors.primary }]}>
                    {user?.fullname?.charAt(0)?.toUpperCase() || 'A'}
                  </Text>
                </View>
              )}

              {/* Badge de modification */}
              <View style={styles.editBadge}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={14} color="#fff" />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: themeColors.text }]}>
                {user?.fullname || 'Administrateur'}
              </Text>
              <Text style={[styles.profileEmail, { color: themeColors.textSecondary }]}>
                {user?.email || 'admin@mada-bienetre.com'}
              </Text>
              <View style={styles.profileActions}>
                <View style={[styles.profileBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.profileBadgeText, { color: colors.primary }]}>
                    Administrateur
                  </Text>
                </View>
                {profileImage && (
                  <TouchableOpacity
                    style={[styles.removePhotoBtn, { backgroundColor: '#E74C3C20' }]}
                    onPress={handleRemovePhoto}
                    disabled={uploadingPhoto}
                  >
                    <Ionicons name="close" size={14} color="#E74C3C" />
                    <Text style={[styles.removePhotoText, { color: '#E74C3C' }]}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Sections */}
          {settingSections.map((section) => (
            <View key={section.id} style={[styles.sectionCard, { backgroundColor: themeColors.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name={section.icon} size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  {section.title}
                </Text>
              </View>
              {section.items.map((item) => (
                <View key={item.id} style={[styles.settingRow, {
                  borderBottomColor: themeColors.border || '#E0E0E0'
                }]}>
                  <Text style={[styles.settingLabel, { color: themeColors.text }]}>
                    {item.label}
                  </Text>
                  {renderSettingItem(item)}
                </View>
              ))}
            </View>
          ))}

          {/* Thème */}
          <View style={[styles.sectionCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Apparence
              </Text>
            </View>
            <View style={[styles.settingRow, {
              borderBottomColor: themeColors.border || '#E0E0E0'
            }]}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>
                Mode {isDark ? 'sombre' : 'clair'}
              </Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#ccc', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Bouton de sauvegarde */}
          <TouchableOpacity
            style={[styles.saveButton, { opacity: isLoading ? 0.7 : 1 }]}
            onPress={handleSaveSettings}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <View style={[styles.saveGradient, { backgroundColor: colors.primary }]}>
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveText}>💾 Enregistrer les paramètres</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Bouton Déconnexion */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={openLogoutModal}
            activeOpacity={0.8}
          >
            <View style={[styles.logoutGradient, { backgroundColor: '#E74C3C' }]}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </View>
          </TouchableOpacity>

          {/* Version */}
          <View style={styles.versionContainer}>
            <Text style={[styles.versionText, { color: themeColors.textSecondary }]}>
              Mada Bien-être v1.0.0
            </Text>
            <Text style={[styles.versionSubtext, { color: themeColors.textSecondary }]}>
              © 2026 Tous droits réservés
            </Text>
          </View>
        </Animated.ScrollView>

        {/* Modal de confirmation de déconnexion */}
        <Modal
          transparent={true}
          visible={showLogoutModal}
          animationType="fade"
          onRequestClose={closeLogoutModal}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: themeColors.surface }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="log-out-outline" size={48} color="#E74C3C" />
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                  Déconnexion
                </Text>
              </View>

              <Text style={[styles.modalText, { color: themeColors.textSecondary }]}>
                Êtes-vous sûr de vouloir vous déconnecter ?
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancel]}
                  onPress={closeLogoutModal}
                  activeOpacity={0.7}
                  disabled={isLoggingOut}
                >
                  <Text style={[styles.modalCancelText, { color: themeColors.text }]}>
                    Annuler
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirm]}
                  onPress={handleLogout}
                  activeOpacity={0.7}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Se déconnecter</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: '#E74C3C',
    fontFamily: typography.fontFamily.medium,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  // ✅ Profile Card avec photo
  profileCard: {
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileAvatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileAvatarText: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  profileEmail: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  profileBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  profileBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  removePhotoText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
  },
  sectionCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  settingLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  settingInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    width: 80,
    textAlign: 'center',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: 12,
  },
  saveText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  logoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  logoutText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  versionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  versionSubtext: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    borderRadius: 20,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.sm,
  },
  modalText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancel: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalCancelText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  modalConfirm: {
    backgroundColor: '#E74C3C',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
});

export default SettingsScreen;
