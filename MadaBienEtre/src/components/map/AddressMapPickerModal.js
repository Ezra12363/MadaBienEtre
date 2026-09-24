// src/components/map/AddressMapPickerModal.js
// ============================================
// ✅ Modal hisafidianana adiresy amin'ny carte:
//    - Mampiseho ny toerana misy ny client ANKEHITRINY (GPS)
//    - Mamela hisafidy toerana hafa amin'ny TAPE na DRAG eo amin'ny carte
//    - ✅ NOUVEAU : Barre de recherche (lot, rue, adresse, ville) avec
//      suggestions en direct — branchée sur services/geocoding.js
//    - Mamerina ny adiresy an-tsoratra (reverse geocoding) + coordonnées
//
// ✅ FIXÉ (BUG LEHIBE) : nesorina ny composant <Modal> avy amin'i
// React Native, satria io dia matetika TSY MISEHO MIHITSY amin'ny web
// (react-native-web) — tsy "portal" tsara amin'ny document.body, ka
// na dia visible={true} aza dia mijanona miafina ny anatiny.
//
// Solony amin'ity dia OVERLAY MANOKANA (View misy position:
// fixed/absolute + zIndex avo), izay MANDEHA TSARA amin'ny WEB,
// ANDROID, ary iOS samy izy, satria tsy miankina amin'ny "portal"
// mahazatra intsony.
// ============================================
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import MapViewWrapper from './MapViewWrapper';
import useLocationTracking from '../../hooks/useLocationTracking';
import { reverseGeocode, getAddressSuggestions, getPlaceDetails } from '../../services/geocoding';
import { DEFAULT_REGION } from '../../config/googleMaps';

const AddressMapPickerModal = ({
  visible,
  onClose,
  onConfirm, // ({ address, latitude, longitude }) => void
  initialCoordinate = null,
}) => {
  const [selectedCoord, setSelectedCoord] = useState(initialCoordinate);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [hasCenteredOnGps, setHasCenteredOnGps] = useState(false);
  const mapRef = useRef(null);

  // ✅ NOUVEAU : état de la barre de recherche (lot / rue / adresse / ville)
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef(null);

  // ✅ Tracking GPS — mahazo ny toerana ANKEHITRINY misy ny client
  const {
    location: userLocation,
    isTracking,
    isLocating,
    errorMsg: trackingError,
    permissionGranted,
  } = useLocationTracking({ enabled: visible, distanceIntervalMeters: 10, timeIntervalMs: 3000 });

  useEffect(() => {
    console.log('🗺️ [AddressMapPickerModal] visible =', visible, '| initialCoordinate =', initialCoordinate);
  }, [visible, initialCoordinate]);

  const resolveAddress = useCallback(async (coord) => {
    setIsResolvingAddress(true);
    try {
      const result = await reverseGeocode(coord.latitude, coord.longitude);
      setSelectedAddress(result?.display_name || `${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)}`);
    } catch (e) {
      console.warn('⚠️ [AddressMapPickerModal] reverseGeocode error:', e?.message);
      setSelectedAddress(`${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)}`);
    } finally {
      setIsResolvingAddress(false);
    }
  }, []);

  useEffect(() => {
    if (visible && initialCoordinate) {
      setSelectedCoord(initialCoordinate);
      resolveAddress(initialCoordinate);
    }
    if (!visible) {
      setHasCenteredOnGps(false);
      // ✅ Réinitialise la recherche à la fermeture du modal
      setSearchText('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialCoordinate]);

  useEffect(() => {
    if (visible && !initialCoordinate && !selectedCoord && userLocation && !hasCenteredOnGps) {
      const coord = { latitude: userLocation.latitude, longitude: userLocation.longitude };
      setSelectedCoord(coord);
      resolveAddress(coord);
      setHasCenteredOnGps(true);
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: coord.latitude,
          longitude: coord.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialCoordinate, selectedCoord, userLocation, hasCenteredOnGps]);

  // ============================================================
  // ✅ NOUVEAU : recherche d'adresse (lot / rue / adresse / ville réels)
  // Debounce de 400ms pour éviter de spammer l'API à chaque frappe.
  // Utilise getAddressSuggestions() de services/geocoding.js, qui
  // combine déjà Google Places Autocomplete + OpenStreetMap.
  // ============================================================
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const query = searchText.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await getAddressSuggestions(query);
        setSuggestions(results || []);
        setShowSuggestions(true);
      } catch (e) {
        console.warn('⚠️ [AddressMapPickerModal] getAddressSuggestions error:', e?.message);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchText]);

  const clearSearch = useCallback(() => {
    setSearchText('');
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }, []);

  // ✅ Sélection d'une suggestion : on récupère les coordonnées
  // (déjà présentes pour OSM, ou via getPlaceDetails pour Google
  // Places qui ne renvoie qu'un place_id), puis on recentre la carte
  // et on place le marqueur exactement dessus.
  const handleSelectSuggestion = useCallback(async (item) => {
    Keyboard.dismiss();
    setShowSuggestions(false);
    setSearchText(item.description || item.main_text || '');

    let coord = null;

    if (item.latitude != null && item.longitude != null) {
      coord = { latitude: item.latitude, longitude: item.longitude };
    } else if (item.place_id) {
      setIsResolvingAddress(true);
      try {
        const details = await getPlaceDetails(item.place_id);
        if (details) {
          coord = { latitude: details.latitude, longitude: details.longitude };
        }
      } catch (e) {
        console.warn('⚠️ [AddressMapPickerModal] getPlaceDetails error:', e?.message);
      } finally {
        setIsResolvingAddress(false);
      }
    }

    if (!coord) {
      console.warn('⚠️ [AddressMapPickerModal] Aucune coordonnée trouvée pour la suggestion sélectionnée.');
      return;
    }

    setSelectedCoord(coord);
    setSelectedAddress(item.description || item.main_text || selectedAddress);

    mapRef.current?.animateToRegion({
      latitude: coord.latitude,
      longitude: coord.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    });
  }, [selectedAddress]);

  const handleMapPress = useCallback((coord) => {
    setSelectedCoord(coord);
    resolveAddress(coord);
    setShowSuggestions(false);
  }, [resolveAddress]);

  const handleSelectionDragEnd = useCallback((coord) => {
    setSelectedCoord(coord);
    resolveAddress(coord);
  }, [resolveAddress]);

  const useCurrentLocationInModal = useCallback(() => {
    if (!userLocation) return;
    const coord = { latitude: userLocation.latitude, longitude: userLocation.longitude };
    setSelectedCoord(coord);
    resolveAddress(coord);
    setShowSuggestions(false);
    mapRef.current?.animateToRegion({
      latitude: coord.latitude,
      longitude: coord.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }, [userLocation, resolveAddress]);

  const handleConfirm = () => {
    if (!selectedCoord) return;
    onConfirm({
      address: selectedAddress,
      latitude: selectedCoord.latitude,
      longitude: selectedCoord.longitude,
    });
    onClose();
  };

  const mapCenter = selectedCoord
    || initialCoordinate
    || (userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : DEFAULT_REGION);

  if (!visible) return null;

  return (
    <View style={styles.overlayRoot}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choisir l'adresse</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Statut GPS */}
        <View style={styles.trackingBar}>
          <View style={[styles.trackingDot, { backgroundColor: isTracking ? colors.primary : '#999' }]} />
          <Text style={styles.trackingText}>
            {isTracking
              ? 'Position GPS active'
              : permissionGranted === false
                ? "Alalana localisation nolavina — jereo ny paramètres."
                : (trackingError || (isLocating ? 'Localisation en cours...' : 'GPS non disponible'))}
          </Text>
        </View>

        {/* Carte — APOSAKA MANDRAKARIVA, tsy miandry GPS */}
        <View style={styles.mapWrapper}>
          {/* ✅ NOUVEAU : Barre de recherche flottante (lot / rue / adresse / ville) */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#666" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher : lot, rue, adresse, ville..."
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={setSearchText}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                returnKeyType="search"
                autoCorrect={false}
              />
              {isSearching ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : searchText.length > 0 ? (
                <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>

            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  style={styles.suggestionsScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {suggestions.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.suggestionRow}
                      onPress={() => handleSelectSuggestion(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="location-outline" size={16} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionMain} numberOfLines={1}>{item.main_text}</Text>
                        {item.secondary_text ? (
                          <Text style={styles.suggestionSecondary} numberOfLines={1}>{item.secondary_text}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {showSuggestions && !isSearching && searchText.trim().length >= 2 && suggestions.length === 0 && (
              <View style={styles.suggestionsBox}>
                <View style={styles.noResultsRow}>
                  <Ionicons name="alert-circle-outline" size={16} color="#999" style={{ marginRight: 6 }} />
                  <Text style={styles.noResultsText}>Aucune adresse trouvée pour « {searchText} »</Text>
                </View>
              </View>
            )}
          </View>

          <MapViewWrapper
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: mapCenter.latitude,
              longitude: mapCenter.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            userLocation={userLocation}
            showUserLocation
            trackUserLocation={false}
            selectionMarker={selectedCoord}
            onMapPress={handleMapPress}
            onSelectionDragEnd={handleSelectionDragEnd}
            showMapTypeControl
          />

          {!showSuggestions && (
            <View style={styles.mapHint}>
              <Ionicons name="hand-left-outline" size={14} color="#fff" />
              <Text style={styles.mapHintText}>Touchez la carte pour choisir un point</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={useCurrentLocationInModal}
            disabled={!userLocation}
            activeOpacity={0.85}
          >
            {!userLocation && isLocating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="locate" size={20} color={userLocation ? colors.primary : '#999'} />
            )}
          </TouchableOpacity>
        </View>

        {/* Adresse résolue + confirmation */}
        <View style={styles.footer}>
          <View style={styles.addressPreview}>
            <Ionicons name="location" size={18} color={colors.primary} />
            {isResolvingAddress ? (
              <View style={styles.addressLoadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.addressLoadingText}>Recherche de l'adresse...</Text>
              </View>
            ) : (
              <Text style={styles.addressPreviewText} numberOfLines={2}>
                {selectedAddress || 'Touchez la carte, recherchez, ou utilisez votre position actuelle'}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, (!selectedCoord || isResolvingAddress) && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!selectedCoord || isResolvingAddress}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.confirmButtonText}>Confirmer cette adresse</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
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
      default: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
    }),
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: '#fff',
  },
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 50 : Platform.OS === 'web' ? spacing.md : 40,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerButton: { padding: 4 },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: '#333',
  },
  trackingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trackingDot: { width: 8, height: 8, borderRadius: 4 },
  trackingText: { fontSize: 12, color: '#666', fontFamily: typography.fontFamily.regular, flex: 1 },
  mapWrapper: { flex: 1, minHeight: 300, position: 'relative', backgroundColor: '#f5f5f5' },
  map: { flex: 1, width: '100%', height: '100%' },

  // ✅ NOUVEAU : barre de recherche flottante, style "Google Maps"
  searchBarContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontFamily: typography.fontFamily.regular,
    paddingVertical: 0,
  },
  suggestionsBox: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    overflow: 'hidden',
  },
  suggestionsScroll: { maxHeight: 220 },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionMain: { fontSize: 13, color: '#333', fontFamily: typography.fontFamily.medium },
  suggestionSecondary: { fontSize: 11, color: '#888', marginTop: 2, fontFamily: typography.fontFamily.regular },
  noResultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  noResultsText: { fontSize: 12, color: '#888', flex: 1 },

  mapHint: {
    position: 'absolute',
    top: 68,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapHintText: { color: '#fff', fontSize: 11, fontFamily: typography.fontFamily.medium },
  currentLocationButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
  },
  addressPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: 50,
  },
  addressPreviewText: { flex: 1, fontSize: typography.fontSize.sm, color: '#333', fontFamily: typography.fontFamily.regular },
  addressLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  addressLoadingText: { fontSize: 12, color: '#666', fontFamily: typography.fontFamily.regular },
  confirmButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
});

export default AddressMapPickerModal;