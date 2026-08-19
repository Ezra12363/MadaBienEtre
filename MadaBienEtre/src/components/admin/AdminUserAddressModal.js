// src/components/admin/AdminUserAddressModal.js
// ============================================================
// ✅ MODAL ADRESSE — barre de recherche pour géocodage (INDÉPENDANTE)
// ✅ FIXÉ : PLEIN ÉCRAN amin'ny web (100vw/100vh, sans coins arrondis,
// carte plus grande), fa mijanona compact/centré amin'ny mobile.
// ✅ INDÉPENDANT : Tsy mandefa data any amin'ny parent, tsy misy
// connexion amin'ny searchQuery de UsersScreen.
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import MapViewWrapper from '../map/MapViewWrapper';
import { searchLocation, reverseGeocode } from '../../services/geocoding';
import { get, put } from '../../services/api';
import { DEFAULT_REGION } from '../../config/googleMaps';

const IS_WEB = Platform.OS === 'web';

const AdminUserAddressModal = ({ visible, onClose, userId, userName, onSaved }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  // ✅ FIXÉ: "addressSearchQuery" ao anaty modal ihany, tsy mifandray amin'ny searchQuery de UsersScreen
  const [addressSearchQuery, setAddressSearchQuery] = useState('');

  const [addressText, setAddressText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: null,
    longitude: null,
  });
  const [searchResult, setSearchResult] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!visible || !userId) return;
    const loadAddress = async () => {
      setIsLoading(true);
      setSearchResult(null);
      setAddressSearchQuery('');
      try {
        const { data, error } = await get(`/admin/users/${userId}/address`);
        if (error) {
          Alert.alert('❌ Erreur', error.message || "Impossible de charger l'adresse");
          return;
        }
        setAddressText(data.address || '');
        setSelectedLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        setMapKey((prev) => prev + 1);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadAddress();
  }, [visible, userId]);

  // ✅ FIXÉ: "addressSearchQuery" no ampiasaina, tsy "searchQuery"
  const handleAddressSearch = useCallback(async () => {
    if (!addressSearchQuery.trim()) {
      Alert.alert('⚠️ Erreur', 'Veuillez saisir une adresse, un lot ou un lieu');
      return;
    }
    setIsSearching(true);
    try {
      const result = await searchLocation(addressSearchQuery);
      if (result) {
        setSelectedLocation({
          latitude: result.latitude,
          longitude: result.longitude,
        });
        setAddressText(result.display_name || addressSearchQuery);
        setSearchResult(result);
        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: result.latitude,
            longitude: result.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          });
        }, 300);
        if (result.isApproximate) {
          Alert.alert(
            '📍 Zone approximative',
            "Le lot exact n'a pas été trouvé — une position approximative a été utilisée. Vous pouvez ajuster en déplaçant le marqueur sur la carte."
          );
        }
      } else {
        Alert.alert('❌ Erreur', `Aucun résultat trouvé pour "${addressSearchQuery}"`);
      }
    } catch (e) {
      Alert.alert('❌ Erreur', "Impossible de rechercher l'adresse");
    } finally {
      setIsSearching(false);
    }
  }, [addressSearchQuery]);

  const handleMapPress = useCallback(async (coordinate) => {
    if (!coordinate?.latitude || !coordinate?.longitude) return;
    setSelectedLocation(coordinate);
    try {
      const result = await reverseGeocode(coordinate.latitude, coordinate.longitude);
      if (result?.display_name) {
        setAddressText(result.display_name);
      }
    } catch (e) {
      console.warn('⚠️ Reverse geocoding échoué:', e.message);
    }
  }, []);

  const handleSave = async () => {
    if (!selectedLocation.latitude || !selectedLocation.longitude) {
      Alert.alert('⚠️ Erreur', 'Veuillez sélectionner une position sur la carte');
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await put(`/admin/users/${userId}/address`, {
        address: addressText,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      });
      if (error) {
        Alert.alert('❌ Erreur', error.message || "Impossible d'enregistrer l'adresse");
        return;
      }
      Alert.alert('✅ Succès', 'Adresse mise à jour avec succès');
      // ✅ FIXÉ: Tsy mandefa data intsony, tsy misy fandraisana data ao amin'ny UsersScreen
      if (onSaved) {
        onSaved();
      }
      onClose();
    } catch (e) {
      Alert.alert('❌ Erreur', "Une erreur est survenue lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  const mapCenter = selectedLocation.latitude ? selectedLocation : DEFAULT_REGION;
  const markers = searchResult?.latitude ? [{
    id: 'search-result',
    coordinate: { latitude: searchResult.latitude, longitude: searchResult.longitude },
    title: '📍 Résultat de recherche',
    pinColor: '#FF6B00',
    available: true,
  }] : [];

  return (
    <Modal
      visible={visible}
      transparent={!IS_WEB}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.overlayRoot,
          IS_WEB
            ? styles.overlayRootWebFull
            : { backgroundColor: 'rgba(0,0,0,0.5)' },
        ]}
      >
        <View
          style={[
            styles.container,
            IS_WEB && styles.containerWebFull,
            { backgroundColor: themeColors.surface },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: themeColors.border || '#eee' }]}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={26} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
              📍 Adresse — {userName || `Utilisateur #${userId}`}
            </Text>
            <View style={{ width: 26 }} />
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Chargement de l'adresse...</Text>
            </View>
          ) : (
            <View style={[styles.bodyWrapper, IS_WEB && styles.bodyWrapperWebFull]}>
              <View style={[IS_WEB && styles.topSectionWebFull]}>
                <View style={styles.searchContainer}>
                  <View style={[styles.searchBar, { backgroundColor: isDark ? '#1a1a1a' : '#F5F5F5' }]}>
                    <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} />
                    <TextInput
                      style={[styles.searchInput, { color: themeColors.text }]}
                      placeholder="Rechercher une adresse, un lot ou un lieu..."
                      placeholderTextColor={themeColors.textSecondary}
                      // ✅ FIXÉ: "addressSearchQuery" no ampiasaina
                      value={addressSearchQuery}
                      onChangeText={setAddressSearchQuery}
                      onSubmitEditing={handleAddressSearch}
                      returnKeyType="search"
                    />
                    {isSearching && <ActivityIndicator size="small" color={colors.primary} />}
                  </View>
                  <TouchableOpacity
                    style={[styles.searchButton, { backgroundColor: colors.primary }]}
                    onPress={handleAddressSearch}
                    disabled={isSearching}
                  >
                    <Text style={styles.searchButtonText}>🔍</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.addressInput, {
                    backgroundColor: isDark ? '#1a1a1a' : '#F5F5F5',
                    color: themeColors.text,
                  }]}
                  placeholder="Adresse complète"
                  placeholderTextColor={themeColors.textSecondary}
                  value={addressText}
                  onChangeText={setAddressText}
                  multiline
                />
              </View>

              <View style={[styles.mapContainer, IS_WEB && styles.mapContainerWebFull, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}>
                <MapViewWrapper
                  ref={mapRef}
                  key={mapKey}
                  style={styles.map}
                  initialRegion={{
                    latitude: mapCenter.latitude,
                    longitude: mapCenter.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  markers={markers}
                  selectionMarker={selectedLocation.latitude ? {
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                  } : null}
                  onMapPress={handleMapPress}
                  onSelectionDragEnd={handleMapPress}
                  showUserLocation={false}
                  trackUserLocation={false}
                  showMapTypeControl={false}
                />
                {!selectedLocation.latitude && (
                  <View style={styles.emptyMapHint}>
                    <Ionicons name="location-outline" size={32} color={themeColors.textSecondary} />
                    <Text style={[styles.emptyMapHintText, { color: themeColors.textSecondary }]}>
                      Aucune position définie — recherchez une adresse ou touchez la carte
                    </Text>
                  </View>
                )}
              </View>

              {selectedLocation.latitude && (
                <View style={styles.coordsRow}>
                  <Ionicons name="navigate-outline" size={14} color={colors.primary} />
                  <Text style={[styles.coordsText, { color: themeColors.textSecondary }]}>
                    {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              )}

              <View style={[styles.footerButtons, IS_WEB && styles.footerButtonsWebFull]}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor: themeColors.border || '#e0e0e0' }]}
                  onPress={onClose}
                >
                  <Text style={[styles.cancelButtonText, { color: themeColors.text }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  disabled={isSaving || !selectedLocation.latitude}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.saveButtonText}>Enregistrer</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  overlayRootWebFull: {
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
      },
    }),
    padding: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    zIndex: 9999,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  containerWebFull: {
    maxWidth: '100%',
    maxHeight: '100%',
    height: '100%',
    width: '100%',
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 13,
  },
  bodyWrapper: {},
  bodyWrapperWebFull: {
    flex: 1,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  topSectionWebFull: {
    width: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    paddingBottom: 0,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  searchButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchButtonText: {
    fontSize: 16,
  },
  addressInput: {
    margin: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    minHeight: 40,
  },
  mapContainer: {
    height: 260,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mapContainerWebFull: {
    flex: 1,
    height: undefined,
    minHeight: 400,
    marginHorizontal: spacing.lg,
    borderRadius: 16,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  emptyMapHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  emptyMapHintText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  coordsText: {
    fontSize: 11,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  footerButtonsWebFull: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {},
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AdminUserAddressModal;