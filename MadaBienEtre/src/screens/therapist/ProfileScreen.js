import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Switch,
  TextInput,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Animatable from 'react-native-animatable';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import { searchLocation, formatFullAddress, getAddressFromCoords } from '../../services/geocoding';
import { DEFAULT_REGION, MARKER_COLORS } from '../../config/googleMaps';
import MapViewWrapper from '../../components/map/MapViewWrapper';
import useLocationTracking from '../../hooks/useLocationTracking';
import { haversineDistance } from '../../services/routing';
import { put, handleApiError } from '../../services/api';
import api from '../../services/api';
import { API_URL } from '../../config/env';

// ✅ IMPORT DU CERTIFICATE CARD
import CertificateCard from '../../components/therapist/CertificateCard';

// ✅ IMPORT DU CIN SECTION
import CinSection from '../../components/common/CinSection';

// ✅ IMPORT DE LA SECTION CERTIFICAT PROFESSIONNEL (NOUVEAU)
import CertificateProfessionnelSection from '../../components/common/CertificateProfessionnelSection';

const { width, height } = Dimensions.get('window');

// ✅ Icons personnalisés pour les marqueurs
const getMarkerIcon = (color, scale = 12) => {
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.5,
    anchor: { x: 12, y: 24 },
  };
};

const ProfileScreen = ({ navigation }) => {
  const { user, logout, updateProfile, token } = useAuth();
  const { colors: themeColors, isDark, toggleTheme } = useTheme();

  // ✅ Hook pour la localisation GPS en temps réel
  const { location: deviceLocation } = useLocationTracking({
    enabled: true,
    distanceIntervalMeters: 10,
    timeIntervalMs: 5000,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    fullname: '',
    email: '',
    phone: '',
    bio: '',
    experience_years: 0,
    base_price: 0,
    latitude: null,
    longitude: null,
    address: '',
    coordinate: null,
    distance: null,
    // ✅ NOUVEAU : CIN
    cin_number: '',
    identity_document_url: '',
    // ✅ NOUVEAU : Certificat professionnel
    certificate_professionnel: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: DEFAULT_REGION.latitude || -18.8792,
    longitude: DEFAULT_REGION.longitude || 47.5079,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: null,
    longitude: null,
    address: '',
    fullAddress: {
      lot: '',
      rue: '',
      ville: '',
      pays: '',
      codePostal: '',
      display_name: '',
    },
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  // ✅ Force refresh pour recharger l'image après upload
  const [forceRefresh, setForceRefresh] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);

  const menuItems = [
    {
      id: 'documents',
      icon: 'document-text-outline',
      label: 'Mes documents',
      onPress: () => navigation.navigate('UploadDocuments'),
    },
    {
      id: 'earnings',
      icon: 'wallet-outline',
      label: 'Mes gains',
      onPress: () => navigation.navigate('Earnings'),
    },
    {
      id: 'availability',
      icon: 'calendar-outline',
      label: 'Disponibilités',
      onPress: () => navigation.navigate('Availability'),
    },
    {
      id: 'settings',
      icon: 'settings-outline',
      label: 'Paramètres',
      onPress: () => {},
    },
    {
      id: 'help',
      icon: 'help-circle-outline',
      label: 'Aide et support',
      onPress: () => {},
    },
    {
      id: 'about',
      icon: 'information-circle-outline',
      label: 'À propos',
      onPress: () => {},
    },
  ];

  // ============================================================
  // ✅ EXTRAIRE LES COMPOSANTS D'ADRESSE
  // ============================================================
  const extractAddressComponents = (address) => {
    if (!address) {
      return { lot: '', rue: '', ville: '', pays: '', codePostal: '', display_name: '' };
    }

    const parts = address.split(',').map((s) => s.trim());
    const result = {
      lot: '',
      rue: '',
      ville: '',
      pays: '',
      codePostal: '',
      display_name: address,
    };

    if (parts.length >= 1) result.rue = parts[0] || '';
    if (parts.length >= 2) result.ville = parts[1] || '';
    if (parts.length >= 3) result.pays = parts[2] || '';

    const lotMatch = address.match(/Lot\s+([A-Z0-9\s]+)/i);
    if (lotMatch) result.lot = lotMatch[1].trim();

    const postalMatch = address.match(/\b(\d{5})\b/);
    if (postalMatch) result.codePostal = postalMatch[1];

    return result;
  };

  // ============================================================
  // ✅ RECHERCHE DE LOCALISATION AVEC searchLocation HYBRIDE
  // ============================================================
  const handleLocationSearch = async () => {
    if (!addressSearchQuery.trim()) {
      Alert.alert('⚠️ Erreur', 'Veuillez saisir une adresse, un lot ou un lieu');
      return;
    }

    setIsSearchingAddress(true);
    setSearchResult(null);

    try {
      console.log(`🔍 Recherche de: "${addressSearchQuery}"`);
      console.log('🌐 Mampiasa searchLocation hybride (Google + OSM)');

      const result = await searchLocation(addressSearchQuery);

      console.log('📦 Résultat:', result);
      console.log(`📦 Lot: "${result?.lot}", Approx: ${result?.isApproximate}`);

      if (result) {
        setSelectedLocation({
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.display_name || addressSearchQuery,
          fullAddress: {
            lot: result.lot || '',
            rue: result.rue || '',
            ville: result.ville || '',
            pays: result.pays || 'Madagascar',
            codePostal: result.codePostal || '',
            display_name: result.display_name || addressSearchQuery,
          },
        });

        setMapRegion({
          latitude: result.latitude,
          longitude: result.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        setSearchResult({
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.display_name,
          isApproximate: result.isApproximate || false,
          fullAddress: {
            lot: result.lot || '',
            rue: result.rue || '',
            ville: result.ville || '',
            pays: result.pays || 'Madagascar',
            codePostal: result.codePostal || '',
            display_name: result.display_name,
          },
        });

        setMapKey(prev => prev + 1);

        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: result.latitude,
              longitude: result.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 500);
          }
        }, 300);

        const fullAddress = formatFullAddress(result.fullAddress);
        const approxNote = result.isApproximate
          ? (result.isCityFallback
              ? "\n\n⚠️ Lot exact non trouvé — position approximative (centre-ville d'Antananarivo)."
              : "\n\n⚠️ Lot exact non trouvé — position approximative du quartier/zone.")
          : '';

        Alert.alert(
          result.isApproximate ? '📍 Zone approximative trouvée' : '✅ Lieu trouvé',
          `📍 ${fullAddress || result.display_name}${approxNote}\n\nLatitude: ${result.latitude.toFixed(6)}\nLongitude: ${result.longitude.toFixed(6)}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '❌ Erreur',
          `Aucun résultat trouvé pour "${addressSearchQuery}".\n\n💡 Suggestions:\n- Vérifiez l'orthographe\n- Essayez: "Fianarantsoa, Madagascar"\n- Essayez: "Lot III A 78, Antananarivo"\n- Essayez: "Toamasina"`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error searching location:', error);
      Alert.alert('❌ Erreur', "Impossible de rechercher l'adresse. Vérifiez votre connexion internet.");
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // ============================================================
  // ✅ OBTENIR LA LOCALISATION ACTUELLE
  // ============================================================
  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('⚠️ Permission refusée', "Veuillez autoriser l'accès à la localisation");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      const address = await getAddressFromCoords(latitude, longitude);
      const fullAddress = extractAddressComponents(address || '');

      setSelectedLocation({
        latitude,
        longitude,
        address: address || 'Position actuelle',
        fullAddress: {
          ...fullAddress,
          display_name: address || 'Position actuelle',
        },
      });

      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      setSearchResult({
        latitude,
        longitude,
        address: address || 'Position actuelle',
        isApproximate: false,
        fullAddress: fullAddress,
      });

      setMapKey(prev => prev + 1);

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 500);
        }
      }, 300);

      Alert.alert('✅ Localisation trouvée', `📍 ${address || 'Position actuelle'}`);
    } catch (error) {
      console.error('❌ Error getting location:', error);
      Alert.alert('❌ Erreur', "Impossible d'obtenir votre position");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // ============================================================
  // ✅ GESTION DU CLIC SUR LA CARTE
  // ============================================================
  const handleMapPress = async (coordinate) => {
    if (!coordinate || !coordinate.latitude || !coordinate.longitude) return;

    const { latitude, longitude } = coordinate;

    setIsLoadingLocation(true);
    try {
      const address = await getAddressFromCoords(latitude, longitude);
      const fullAddress = extractAddressComponents(address || '');

      setSelectedLocation({
        latitude,
        longitude,
        address: address || `${latitude}, ${longitude}`,
        fullAddress: {
          ...fullAddress,
          display_name: address || `${latitude}, ${longitude}`,
        },
      });

      setSearchResult({
        latitude,
        longitude,
        address: address || `${latitude}, ${longitude}`,
        isApproximate: false,
        fullAddress: fullAddress,
      });
    } catch (error) {
      console.error('❌ Error getting address from coords:', error);
      setSelectedLocation({
        latitude,
        longitude,
        address: `${latitude}, ${longitude}`,
        fullAddress: {
          display_name: `${latitude}, ${longitude}`,
          lot: '',
          rue: '',
          ville: '',
          pays: '',
          codePostal: '',
        },
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // ============================================================
  // ✅ VALIDER LA LOCALISATION AVEC COORDINATE ET DISTANCE
  // ============================================================
  const validateLocation = () => {
    if (!selectedLocation.latitude || !selectedLocation.longitude) {
      Alert.alert('⚠️ Erreur', 'Veuillez sélectionner une position sur la carte');
      return;
    }

    let computedDistance = null;
    if (deviceLocation?.latitude && deviceLocation?.longitude) {
      computedDistance = haversineDistance(
        deviceLocation.latitude,
        deviceLocation.longitude,
        selectedLocation.latitude,
        selectedLocation.longitude
      );
      if (computedDistance != null) {
        computedDistance = Number(computedDistance.toFixed(1));
      }
    }

    setProfileData({
      ...profileData,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      address: selectedLocation.address,
      coordinate: {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      },
      distance: computedDistance,
    });

    setShowMapModal(false);
    setSearchResult(null);
    Alert.alert('✅ Succès', `📍 ${selectedLocation.address || 'Position enregistrée'}`);
  };

  // ============================================================
  // ✅ METTRE À JOUR LE PROFIL VERS LE BACKEND (AVEC CIN)
  // ============================================================
  const handleUpdateProfile = async () => {
    setIsLoading(true);

    if (!profileData.latitude || !profileData.longitude) {
      Alert.alert(
        '📍 Localisation requise',
        'Veuillez définir votre position sur la carte avant de continuer',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Définir', onPress: () => setShowMapModal(true) },
        ]
      );
      setIsLoading(false);
      return;
    }

    try {
      const userId = user?.id;
      
      if (!userId) {
        Alert.alert('❌ Erreur', 'Utilisateur non identifié');
        setIsLoading(false);
        return;
      }

      // ✅ Données à envoyer (incluant cin_number et identity_document_url)
      const updateData = {
        fullname: profileData.fullname,
        phone: profileData.phone,
        bio: profileData.bio,
        experience_years: profileData.experience_years,
        base_price: profileData.base_price,
        latitude: profileData.latitude,
        longitude: profileData.longitude,
        address: profileData.address,
        // ✅ NOUVEAU : CIN
        cin_number: profileData.cin_number,
        identity_document_url: profileData.identity_document_url,
        // ✅ NOUVEAU : Certificat professionnel
        certificate_professionnel: profileData.certificate_professionnel,
      };

      console.log('📤 Envoi des données au backend (Thérapeute):', updateData);

      const { data, error } = await put(`/users/${userId}`, updateData);

      if (error) {
        console.error('❌ Erreur mise à jour:', error);
        Alert.alert('❌ Erreur', error.message || 'Impossible de mettre à jour le profil');
        setIsLoading(false);
        return;
      }

      console.log('✅ Profil mis à jour avec succès:', data);

      if (updateProfile) {
        await updateProfile(updateData);
      }

      Alert.alert('✅ Succès', 'Votre profil a été mis à jour avec succès');
      setIsEditing(false);

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour:', error);
      Alert.alert('❌ Erreur', 'Une erreur est survenue lors de la mise à jour du profil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
  };

  // ============================================================
  // ✅ UPLOADER UNE PHOTO DE PROFIL (AVEC CORRECTION POUR WEB)
  // ============================================================
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Erreur', 'Permission de galerie refusée');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setIsUploading(true);
      try {
        const asset = result.assets[0];
        const uriParts = asset.uri.split('.');
        const fileExtension = uriParts[uriParts.length - 1] || 'jpg';
        const mimeType = asset.mimeType || `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
        const filename = `profile.${fileExtension}`;

        let fileToSend;

        // ✅ Si on est sur le web, il faut récupérer le blob et créer un File
        if (Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          fileToSend = new File([blob], filename, { type: mimeType });
        } else {
          // Sur mobile, on utilise l'objet avec uri, type, name
          fileToSend = {
            uri: asset.uri,
            type: mimeType,
            name: filename,
          };
        }

        const formData = new FormData();
        formData.append('file', fileToSend);

        // ✅ Utiliser api.post directement
        const response = await api.post('/users/upload-profile-photo', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data && response.data.profile_image) {
          // ✅ Mettre à jour le contexte Auth
          if (typeof updateProfile === 'function') {
            await updateProfile({ profile_image: response.data.profile_image });
          } else {
            // ✅ Fallback : mise à jour directe via PUT
            const userId = user?.id;
            if (userId) {
              await put(`/users/${userId}`, { profile_image: response.data.profile_image });
            }
          }
          // ✅ Forcer le re-rendu de l'avatar
          setForceRefresh(prev => prev + 1);
          Alert.alert('✅ Succès', 'Photo de profil mise à jour');
        } else {
          console.warn('⚠️ Réponse backend sans "profile_image":', response.data);
          Alert.alert('⚠️ Attention', "La photo a été envoyée mais l'URL n'a pas été reçue en retour.");
        }
      } catch (error) {
        console.error('❌ Error uploading photo:', error);
        Alert.alert('Erreur', 'Impossible de télécharger la photo');
      } finally {
        setIsUploading(false);
      }
    }
  };

  // ============================================================
  // RENDU DE LA CARTE AVEC MARQUEURS PERSONNALISÉS
  // ============================================================
  const renderMapModal = () => {
    if (!showMapModal) return null;

    const markers = [];

    if (searchResult && searchResult.latitude && searchResult.longitude) {
      markers.push({
        id: 'search-result',
        coordinate: {
          latitude: searchResult.latitude,
          longitude: searchResult.longitude,
        },
        title: searchResult.isApproximate ? '📍 Zone approximative' : '📍 Adresse recherchée',
        description: searchResult.address || 'Adresse recherchée',
        pinColor: '#FF6B00',
        icon: getMarkerIcon('#FF6B00'),
        available: true,
      });
    }

    if (selectedLocation.latitude && selectedLocation.longitude) {
      const isSame = markers.some(
        (m) =>
          Math.abs(m.coordinate.latitude - selectedLocation.latitude) < 0.0001 &&
          Math.abs(m.coordinate.longitude - selectedLocation.longitude) < 0.0001
      );

      if (!isSame) {
        markers.push({
          id: 'selected-location',
          coordinate: {
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
          },
          title: 'Position sélectionnée',
          description: selectedLocation.address || '',
          pinColor: '#22C55E',
          icon: getMarkerIcon('#22C55E'),
          available: true,
        });
      }
    }

    return (
      <View style={styles.mapModalOverlayRoot}>
        <View style={styles.mapModalContainer}>
          <View style={[styles.mapModalContent, { backgroundColor: themeColors.surface }]}>
            <View style={styles.mapModalHeader}>
              <Text style={[styles.mapModalTitle, { color: themeColors.text }]}>
                📍 Sélectionnez votre position
              </Text>
              <TouchableOpacity onPress={() => setShowMapModal(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.addressSearchContainer}>
              <View
                style={[
                  styles.addressSearchBar,
                  {
                    backgroundColor: isDark ? '#1a1a1a' : '#F5F5F5',
                    borderColor: themeColors.border || '#E0E0E0',
                  },
                ]}
              >
                <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} />
                <TextInput
                  style={[styles.addressSearchInput, { color: themeColors.text }]}
                  placeholder="Rechercher une adresse, lot ou lieu..."
                  placeholderTextColor={themeColors.textSecondary}
                  value={addressSearchQuery}
                  onChangeText={setAddressSearchQuery}
                  onSubmitEditing={handleLocationSearch}
                  returnKeyType="search"
                />
                {isSearchingAddress ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  addressSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setAddressSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  )
                )}
              </View>
              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: colors.primary }]}
                onPress={handleLocationSearch}
                disabled={isSearchingAddress}
              >
                <Text style={styles.searchButtonText}>🔍 Rechercher</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.currentLocationInlineButton}
              onPress={getCurrentLocation}
              disabled={isLoadingLocation}
              activeOpacity={0.8}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="locate" size={16} color={colors.primary} />
              )}
              <Text style={styles.currentLocationInlineText}>Utiliser ma position actuelle</Text>
            </TouchableOpacity>

            <View style={styles.mapContainer}>
              <MapViewWrapper
                ref={mapRef}
                key={mapKey}
                style={styles.map}
                region={mapRegion}
                initialRegion={mapRegion}
                markers={markers}
                selectionMarker={
                  selectedLocation.latitude
                    ? {
                        latitude: selectedLocation.latitude,
                        longitude: selectedLocation.longitude,
                      }
                    : null
                }
                onMapPress={handleMapPress}
                onSelectionDragEnd={handleMapPress}
                showUserLocation={true}
                trackUserLocation={false}
                showMapTypeControl={true}
                onMapReady={() => console.log('✅ Carte prête')}
                fitToMarkersOnLoad={true}
              />

              {isSearchingAddress && (
                <View style={styles.searchingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.searchingText, { color: themeColors.text }]}>
                    Recherche en cours...
                  </Text>
                </View>
              )}
            </View>

            {searchResult && searchResult.address && (
              <ScrollView style={styles.searchResultScroll}>
                <View style={[
                  styles.searchResultContainer,
                  { backgroundColor: themeColors.background },
                  searchResult.isApproximate && styles.searchResultContainerApprox
                ]}>
                  <View style={styles.searchResultHeader}>
                    <Ionicons
                      name={searchResult.isApproximate ? 'warning' : 'checkmark-circle'}
                      size={20}
                      color={searchResult.isApproximate ? '#F59E0B' : '#4CAF50'}
                    />
                    <Text style={[styles.searchResultTitle, { color: themeColors.text }]}>
                      {searchResult.isApproximate ? '📍 Zone approximative' : '✅ Lieu trouvé'}
                    </Text>
                  </View>

                  <View style={styles.addressDetails}>
                    {searchResult.fullAddress?.lot ? (
                      <View style={styles.addressRow}>
                        <Text style={[styles.addressLabel, { color: themeColors.textSecondary }]}>Lot :</Text>
                        <Text style={[styles.addressValue, { color: themeColors.text }]}>
                          {searchResult.fullAddress.lot}
                        </Text>
                      </View>
                    ) : null}

                    {searchResult.fullAddress?.rue ? (
                      <View style={styles.addressRow}>
                        <Text style={[styles.addressLabel, { color: themeColors.textSecondary }]}>Rue :</Text>
                        <Text style={[styles.addressValue, { color: themeColors.text }]}>
                          {searchResult.fullAddress.rue}
                        </Text>
                      </View>
                    ) : null}

                    {searchResult.fullAddress?.ville ? (
                      <View style={styles.addressRow}>
                        <Text style={[styles.addressLabel, { color: themeColors.textSecondary }]}>Ville :</Text>
                        <Text style={[styles.addressValue, { color: themeColors.text }]}>
                          {searchResult.fullAddress.ville}
                        </Text>
                      </View>
                    ) : null}

                    {searchResult.fullAddress?.pays ? (
                      <View style={styles.addressRow}>
                        <Text style={[styles.addressLabel, { color: themeColors.textSecondary }]}>Pays :</Text>
                        <Text style={[styles.addressValue, { color: themeColors.text }]}>
                          {searchResult.fullAddress.pays}
                        </Text>
                      </View>
                    ) : null}

                    {searchResult.fullAddress?.codePostal ? (
                      <View style={styles.addressRow}>
                        <Text style={[styles.addressLabel, { color: themeColors.textSecondary }]}>Code Postal :</Text>
                        <Text style={[styles.addressValue, { color: themeColors.text }]}>
                          {searchResult.fullAddress.codePostal}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.addressDivider} />

                  <Text style={[styles.addressFullText, { color: themeColors.text }]} numberOfLines={2}>
                    📍 {searchResult.address}
                  </Text>

                  {searchResult.isApproximate && (
                    <Text style={[styles.approxNote, { color: '#F59E0B' }]}>
                      ⚠️ Position approximative — le lot exact n'est pas trouvé dans la base de données.
                    </Text>
                  )}

                  <View style={styles.coordsContainer}>
                    <View style={styles.coordRow}>
                      <Text style={[styles.coordLabel, { color: themeColors.textSecondary }]}>Latitude :</Text>
                      <Text style={[styles.coordValue, { color: themeColors.text }]}>
                        {searchResult.latitude.toFixed(6)}
                      </Text>
                    </View>
                    <View style={styles.coordRow}>
                      <Text style={[styles.coordLabel, { color: themeColors.textSecondary }]}>Longitude :</Text>
                      <Text style={[styles.coordValue, { color: themeColors.text }]}>
                        {searchResult.longitude.toFixed(6)}
                      </Text>
                    </View>
                  </View>

                  {deviceLocation?.latitude && deviceLocation?.longitude && (
                    <View style={styles.distanceContainer}>
                      <Ionicons name="navigate-outline" size={14} color={colors.primary} />
                      <Text style={[styles.distanceText, { color: themeColors.textSecondary }]}>
                        📏 {haversineDistance(
                          deviceLocation.latitude,
                          deviceLocation.longitude,
                          searchResult.latitude,
                          searchResult.longitude
                        )?.toFixed(1) || '?'} km de votre position actuelle
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            <View style={styles.mapModalButtons}>
              <TouchableOpacity
                style={[styles.mapModalButton, styles.mapModalCancel]}
                onPress={() => {
                  setShowMapModal(false);
                  setSearchResult(null);
                }}
              >
                <Text style={[styles.mapModalButtonText, { color: themeColors.text }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapModalButton, styles.mapModalConfirm]}
                onPress={validateLocation}
                disabled={!selectedLocation.latitude || !selectedLocation.longitude}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.mapModalButtonConfirmText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ============================================================
  // ✅ USE EFFECT - CHARGEMENT DES DONNÉES UTILISATEUR (AVEC CIN)
  // ============================================================
  // ⚠️ Ce useEffect resynchronise profileData depuis le user du
  // AuthContext. Il ne doit PAS s'exécuter pendant que le formulaire
  // est en cours d'édition (isEditing === true), sinon toute mise à
  // jour de "user" survenant en arrière-plan (ex: refreshUser() appelé
  // après l'upload du certificat professionnel ou du CIN, ou après
  // l'upload de la photo de profil) écrase les champs que l'utilisateur
  // est en train de remplir (nom, bio, adresse, prix, etc.) avant
  // même qu'il ait appuyé sur "Enregistrer".
  //
  // ✅ CORRECTIF : on ne resynchronise le formulaire depuis le serveur
  // que lorsqu'on N'EST PAS en train d'éditer. Les uploads de documents
  // (certificat professionnel, CIN, photo) continuent de s'afficher
  // immédiatement grâce aux callbacks onCertificateUploaded /
  // onCinImageUploaded qui mettent à jour uniquement leur propre champ
  // dans profileData, sans toucher au reste du formulaire.
  useEffect(() => {
    if (user && !isEditing) {
      setProfileData({
        fullname: user.fullname || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        experience_years: user.experience_years || 0,
        base_price: user.base_price || 0,
        latitude: user.latitude || null,
        longitude: user.longitude || null,
        address: user.address || '',
        coordinate: user.latitude && user.longitude ? {
          latitude: user.latitude,
          longitude: user.longitude,
        } : null,
        distance: null,
        // ✅ NOUVEAU : CIN
        cin_number: user.cin_number || '',
        identity_document_url: user.identity_document_url || '',
        // ✅ NOUVEAU : Certificat professionnel
        certificate_professionnel: user.certificate_professionnel || '',
      });

      if (user.latitude && user.longitude) {
        setMapRegion({
          latitude: user.latitude,
          longitude: user.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setSelectedLocation({
          latitude: user.latitude,
          longitude: user.longitude,
          address: user.address || '',
          fullAddress: extractAddressComponents(user.address || ''),
        });
      }
    }
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    // ✅ isEditing est volontairement dans les dépendances : quand on
    // quitte le mode édition (bouton crayon ou après enregistrement),
    // le formulaire se resynchronise avec les dernières données serveur.
  }, [user, forceRefresh, isEditing]);

  // ============================================================
  // ✅ RENDU PRINCIPAL
  // ============================================================
  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Profil" />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* En-tête du profil */}
        <View style={styles.profileHeader}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight || colors.primary]}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.avatarContainer}>
              <TouchableOpacity onPress={pickImage} disabled={isUploading}>
                {user?.profile_image ? (
                  <Image
                    key={`profile-${forceRefresh}`}
                    source={{ uri: user.profile_image }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{user?.fullname?.charAt(0) || 'T'}</Text>
                  </View>
                )}
                {isUploading ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : (
                  <View style={styles.avatarEdit}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{user?.fullname || 'Thérapeute'}</Text>

            {/* ✅ Statut dynamique selon verification_status */}
            <View style={[
              styles.userBadge,
              { backgroundColor: 
                user?.verification_status === 'approved' ? '#4CAF50' :
                user?.verification_status === 'pending' ? '#FF9800' :
                user?.verification_status === 'rejected' ? '#F44336' : '#999'
              }
            ]}>
              <Text style={styles.userBadgeText}>
                {user?.verification_status === 'approved' ? '✅ Vérifié' :
                 user?.verification_status === 'pending' ? '⏳ En attente' :
                 user?.verification_status === 'rejected' ? '❌ Rejeté' : 'Statut inconnu'}
              </Text>
            </View>

            <Text style={styles.userEmail}>{user?.email}</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user?.rating || 0}</Text>
                <Text style={styles.statLabel}>Note ⭐</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user?.total_reviews || 0}</Text>
                <Text style={styles.statLabel}>Avis</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user?.experience_years || 0} ans</Text>
                <Text style={styles.statLabel}>Expérience</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ✅ AFFICHAGE DU CERTIFICATE CARD */}
        <CertificateCard />

        {/* Informations du profil */}
        <Animatable.View animation="fadeInUp" delay={200} duration={600}>
          <View style={[styles.infoCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.infoHeader}>
              <Text style={[styles.infoTitle, { color: themeColors.text }]}>
                Informations professionnelles
              </Text>
              <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
                <Text style={styles.editButton}>{isEditing ? 'Annuler' : 'Modifier'}</Text>
              </TouchableOpacity>
            </View>

            {isEditing ? (
              // ✅ SECTION D'ÉDITION - TOUS LES CHAMPS (AVEC CIN)
              <View>
                {/* Nom complet */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.text }]}>Nom complet</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: themeColors.text,
                        borderColor: themeColors.border || '#E0E0E0',
                      },
                    ]}
                    value={profileData.fullname}
                    onChangeText={(text) => setProfileData({ ...profileData, fullname: text })}
                  />
                </View>

                {/* Téléphone */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.text }]}>Téléphone</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: themeColors.text,
                        borderColor: themeColors.border || '#E0E0E0',
                      },
                    ]}
                    value={profileData.phone}
                    onChangeText={(text) => setProfileData({ ...profileData, phone: text })}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Bio */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.text }]}>Bio</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.bioInput,
                      {
                        color: themeColors.text,
                        borderColor: themeColors.border || '#E0E0E0',
                      },
                    ]}
                    value={profileData.bio}
                    onChangeText={(text) => setProfileData({ ...profileData, bio: text })}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Années d'expérience et Prix de base */}
                <View style={styles.rowInputs}>
                  <View style={[styles.rowInput, styles.halfInput]}>
                    <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                      Années d'expérience
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: themeColors.text,
                          borderColor: themeColors.border || '#E0E0E0',
                        },
                      ]}
                      value={profileData.experience_years.toString()}
                      onChangeText={(text) =>
                        setProfileData({ ...profileData, experience_years: parseInt(text) || 0 })
                      }
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.rowInput, styles.halfInput]}>
                    <Text style={[styles.inputLabel, { color: themeColors.text }]}>Prix de base (Ar)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: themeColors.text,
                          borderColor: themeColors.border || '#E0E0E0',
                        },
                      ]}
                      value={profileData.base_price.toString()}
                      onChangeText={(text) =>
                        setProfileData({ ...profileData, base_price: parseInt(text) || 0 })
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Adresse et position */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.text }]}>📍 Adresse et position</Text>

                  <TouchableOpacity
                    style={[
                      styles.locationSelector,
                      {
                        borderColor: themeColors.border || '#E0E0E0',
                        backgroundColor: themeColors.background,
                      },
                    ]}
                    onPress={() => setShowMapModal(true)}
                  >
                    {profileData.latitude && profileData.longitude ? (
                      <View style={styles.locationInfo}>
                        <View style={styles.locationStatus}>
                          <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                          <Text style={[styles.locationStatusText, { color: '#4CAF50' }]}>
                            Position définie
                          </Text>
                        </View>
                        {profileData.address && (
                          <Text style={[styles.locationAddress, { color: themeColors.text }]} numberOfLines={2}>
                            📍 {profileData.address}
                          </Text>
                        )}
                        <Text style={[styles.locationCoords, { color: themeColors.textSecondary }]}>
                          {profileData.latitude.toFixed(6)}, {profileData.longitude.toFixed(6)}
                        </Text>
                        {profileData.distance != null && (
                          <Text style={[styles.locationCoords, { color: themeColors.textSecondary }]}>
                            📏 {profileData.distance} km de votre position actuelle
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={styles.locationPlaceholder}>
                        <Ionicons name="location-outline" size={24} color={themeColors.textSecondary} />
                        <Text style={[styles.locationPlaceholderText, { color: themeColors.textSecondary }]}>
                          Cliquez pour définir votre position sur la carte
                        </Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mapPreviewButton} onPress={() => setShowMapModal(true)}>
                    <LinearGradient
                      colors={[colors.primary, colors.primaryLight || colors.primary]}
                      style={styles.mapPreviewGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="map-outline" size={18} color="#fff" />
                      <Text style={styles.mapPreviewText}>
                        {profileData.latitude ? '📌 Modifier la position' : '🗺️ Ouvrir la carte'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* ✅ NOUVEAU : SECTION CIN */}
                <CinSection
                  cinNumber={profileData.cin_number}
                  onChangeCinNumber={(text) => setProfileData({ ...profileData, cin_number: text })}
                  cinImageUrl={profileData.identity_document_url || user?.identity_document_url}
                  onCinImageUploaded={(url) => setProfileData({ ...profileData, identity_document_url: url })}
                  themeColors={themeColors}
                />

                {/* ✅ NOUVEAU : SECTION CERTIFICAT PROFESSIONNEL */}
                <CertificateProfessionnelSection
                  certificateUrl={profileData.certificate_professionnel || user?.certificate_professionnel}
                  onCertificateUploaded={(url) =>
                    setProfileData({ ...profileData, certificate_professionnel: url })
                  }
                  themeColors={themeColors}
                />

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleUpdateProfile}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primaryLight || colors.primary]}
                    style={styles.saveGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.saveText}>💾 Enregistrer</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              // ✅ AFFICHAGE DES INFORMATIONS (Mode lecture)
              <View>
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={20} color={themeColors.textSecondary} />
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>{user?.fullname}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={20} color={themeColors.textSecondary} />
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>{user?.phone}</Text>
                </View>
                {user?.bio && (
                  <View style={styles.infoRow}>
                    <Ionicons name="text-outline" size={20} color={themeColors.textSecondary} />
                    <Text style={[styles.infoValue, { color: themeColors.text }]}>{user.bio}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Ionicons name="briefcase-outline" size={20} color={themeColors.textSecondary} />
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>
                    {user?.experience_years || 0} ans d'expérience
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" size={20} color={themeColors.textSecondary} />
                  <Text style={[styles.infoValue, { color: colors.primary }]}>
                    {user?.base_price?.toLocaleString() || 0} Ar / séance
                  </Text>
                </View>
                {user?.address && (
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={20} color={themeColors.textSecondary} />
                    <Text style={[styles.infoValue, { color: themeColors.text }]}>📍 {user.address}</Text>
                  </View>
                )}
                {user?.latitude && user?.longitude && (
                  <View style={styles.infoRow}>
                    <Ionicons name="navigate-outline" size={20} color={themeColors.textSecondary} />
                    <Text style={[styles.infoValue, { color: themeColors.textSecondary, fontSize: 12 }]}>
                      {user.latitude.toFixed(6)}, {user.longitude.toFixed(6)}
                    </Text>
                  </View>
                )}
                {/* ✅ NOUVEAU : Affichage du CIN en mode lecture */}
                {user?.cin_number && (
                  <View style={styles.infoRow}>
                    <Ionicons name="card-outline" size={20} color={themeColors.textSecondary} />
                    <Text style={[styles.infoValue, { color: themeColors.text }]}>
                      {user.cin_number}
                    </Text>
                  </View>
                )}
                {user?.identity_document_url && (
                  <View style={styles.infoRow}>
                    <Ionicons name="document-outline" size={20} color={themeColors.textSecondary} />
                    <Text style={[styles.infoValue, { color: colors.primary, fontSize: 12 }]}>
                     CIN téléchargé
                    </Text>
                  </View>
                )}
                {/* ✅ NOUVEAU : Affichage du certificat professionnel en mode lecture */}
                {user?.certificate_professionnel && (
                  <View style={styles.infoRow}>
                    <Ionicons name="ribbon-outline" size={20} color={themeColors.textSecondary} />
                    <Text style={[styles.infoValue, { color: colors.primary, fontSize: 12 }]}>
                      Certificat professionnel téléchargé
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </Animatable.View>

        {/* Menu */}
        <Animatable.View animation="fadeInUp" delay={400} duration={600}>
          <View style={[styles.menuCard, { backgroundColor: themeColors.surface }]}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  index < menuItems.length - 1 && styles.menuItemBorder,
                  { borderBottomColor: themeColors.border },
                ]}
                onPress={item.onPress}
              >
                <View style={styles.menuLeft}>
                  <Ionicons name={item.icon} size={24} color={colors.primary} />
                  <Text style={[styles.menuLabel, { color: themeColors.text }]}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            ))}

            <View style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: themeColors.border }]}>
              <View style={styles.menuLeft}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={24} color={colors.primary} />
                <Text style={[styles.menuLabel, { color: themeColors.text }]}>
                  Mode {isDark ? 'sombre' : 'clair'}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#ccc', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </Animatable.View>

        {/* Déconnexion */}
        <Animatable.View animation="fadeInUp" delay={600} duration={600}>
          <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutModal(true)}>
            <LinearGradient
              colors={['#D32F2F', '#E53935']}
              style={styles.logoutGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>
      </Animated.ScrollView>

      {/* Modal de déconnexion */}
      {showLogoutModal && (
        <View style={styles.mapModalOverlayRoot}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: themeColors.surface }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="log-out-outline" size={48} color={colors.error} />
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>Déconnexion</Text>
              </View>
              <Text style={[styles.modalText, { color: themeColors.textSecondary }]}>
                Êtes-vous sûr de vouloir vous déconnecter ?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancel]}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.modalConfirm]} onPress={handleLogout}>
                  <Text style={styles.modalConfirmText}>Se déconnecter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {renderMapModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  profileHeader: { marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: 20, overflow: 'hidden' },
  headerGradient: { padding: spacing.lg, alignItems: 'center' },
  avatarContainer: { position: 'relative', marginBottom: spacing.md },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { fontSize: typography.fontSize.xxxl, fontFamily: typography.fontFamily.bold, color: '#fff' },
  avatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: '#fff' },
  userBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
    alignSelf: 'center',
  },
  userBadgeText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  userEmail: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: '#fff' },
  statLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  infoCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  infoTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  editButton: { color: colors.primary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  inputGroup: { marginBottom: spacing.sm },
  inputLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  rowInputs: { flexDirection: 'row', gap: spacing.sm },
  rowInput: { flex: 1 },
  halfInput: { flex: 0.5 },
  saveButton: { borderRadius: 8, overflow: 'hidden', marginTop: spacing.sm },
  saveGradient: { paddingVertical: spacing.sm, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  infoValue: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, flex: 1 },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 60,
  },
  locationInfo: { flex: 1 },
  locationStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationStatusText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  locationAddress: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, marginTop: 2 },
  locationCoords: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 1 },
  locationPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  locationPlaceholderText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, flex: 1 },
  mapPreviewButton: { marginTop: spacing.sm, borderRadius: 8, overflow: 'hidden' },
  mapPreviewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  mapPreviewText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  menuCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 16,
    paddingVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  menuItemBorder: { borderBottomWidth: 1 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuLabel: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular },
  logoutButton: { marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: 12, overflow: 'hidden' },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  logoutText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  mapModalOverlayRoot: {
    ...Platform.select({
      web: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' },
      default: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    }),
    zIndex: 9999,
    elevation: 9999,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { borderRadius: 20, padding: spacing.lg, width: '85%', maxWidth: 400 },
  modalHeader: { alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, marginTop: spacing.sm },
  modalText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginBottom: spacing.lg },
  modalButtons: { flexDirection: 'row', gap: spacing.sm },
  modalButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
  modalCancel: { backgroundColor: '#f5f5f5' },
  modalCancelText: { color: colors.textSecondary, fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.medium },
  modalConfirm: { backgroundColor: colors.error },
  modalConfirmText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
  mapModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  mapModalContent: { borderRadius: 20, padding: spacing.md, width: '95%', maxHeight: '90%' },
  mapModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  mapModalTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  addressSearchContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  addressSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  addressSearchInput: { flex: 1, paddingHorizontal: spacing.sm, fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular },
  searchButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  currentLocationInlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  currentLocationInlineText: { color: colors.primary, fontSize: 13, fontFamily: typography.fontFamily.medium },
  mapContainer: { height: 280, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  map: { width: '100%', height: '100%' },
  searchingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchingText: { marginTop: spacing.sm, fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.medium },
  searchResultScroll: { maxHeight: 180, marginTop: spacing.sm },
  searchResultContainer: { padding: spacing.md, borderRadius: 8 },
  searchResultContainerApprox: { borderWidth: 1, borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.05)' },
  searchResultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  searchResultTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  addressDetails: { gap: 2 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressLabel: { fontSize: 12, fontFamily: typography.fontFamily.medium, minWidth: 90 },
  addressValue: { fontSize: 12, fontFamily: typography.fontFamily.regular, flex: 1 },
  addressDivider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: spacing.sm },
  addressFullText: { fontSize: 13, fontFamily: typography.fontFamily.regular },
  approxNote: { fontSize: 12, fontFamily: typography.fontFamily.medium, marginTop: 4 },
  coordsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coordLabel: { fontSize: 11, fontFamily: typography.fontFamily.medium },
  coordValue: { fontSize: 11, fontFamily: typography.fontFamily.regular },
  distanceContainer: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 4 },
  distanceText: { fontSize: 11, fontFamily: typography.fontFamily.regular },
  mapModalButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  mapModalButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mapModalCancel: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#E0E0E0' },
  mapModalConfirm: { backgroundColor: colors.primary, flexDirection: 'row', gap: spacing.xs },
  mapModalButtonText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.medium },
  mapModalButtonConfirmText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
});

export default ProfileScreen;