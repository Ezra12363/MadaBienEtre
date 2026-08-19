// src/screens/client/ProfileScreen.js

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';

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
  Linking,
  Platform,
  Pressable,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Animatable from 'react-native-animatable';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

import { colors, typography } from '../../theme';

import Header from '../../components/common/Header';
import MapViewWrapper from '../../components/map/MapViewWrapper';

import {
  searchLocation,
  getAddressFromCoords,
} from '../../services/geocoding';

import { DEFAULT_REGION } from '../../config/googleMaps';
import useLocationTracking from '../../hooks/useLocationTracking';

import { put } from '../../services/api';
import api from '../../services/api';

// ============================================================
// CONSTANTS
// ============================================================

const GREEN = '#22C55E';
const GREEN_DARK = '#16A34A';
const BLUE = colors.primary || '#0D2B7E';
const RED = '#E53935';
const ORANGE = '#F59E0B';

// ============================================================
// PROFILE SCREEN
// ============================================================

const ProfileScreen = ({ navigation }) => {
  // ==========================================================
  // HOOKS
  // ==========================================================

  const { user, logout, updateProfile } = useAuth();
  const {
    colors: themeColors,
    isDark,
    toggleTheme,
  } = useTheme();

  useLocationTracking({
    enabled: true,
    distanceIntervalMeters: 10,
    timeIntervalMs: 5000,
  });

  // ==========================================================
  // REFS
  // ==========================================================

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  const mapRef = useRef(null);

  const toastTimerRef = useRef(null);

  const toastOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const toastTranslateY = useRef(
    new Animated.Value(-24)
  ).current;

  // ==========================================================
  // STATES
  // ==========================================================

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);

  const [showLogoutModal, setShowLogoutModal] =
    useState(false);

  const [showMapModal, setShowMapModal] =
    useState(false);

  // ==========================================================
  // TOAST STATE
  // ==========================================================

  const [toast, setToast] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  // ==========================================================
  // LOCATION STATES
  // ==========================================================

  const [
    addressSearchQuery,
    setAddressSearchQuery,
  ] = useState('');

  const [
    isSearchingAddress,
    setIsSearchingAddress,
  ] = useState(false);

  const [
    isLoadingLocation,
    setIsLoadingLocation,
  ] = useState(false);

  const [searchResult, setSearchResult] =
    useState(null);

  const [mapRegion, setMapRegion] = useState({
    latitude:
      DEFAULT_REGION?.latitude || -18.8792,
    longitude:
      DEFAULT_REGION?.longitude || 47.5079,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  const [selectedLocation, setSelectedLocation] =
    useState({
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

  // ==========================================================
  // PROFILE DATA
  // ==========================================================

  const [profileData, setProfileData] = useState({
    fullname: '',
    email: '',
    phone: '',
    bio: '',
    latitude: null,
    longitude: null,
    address: '',
    coordinate: null,
  });

  // ==========================================================
  // TOAST HELPER
  // ==========================================================

  const showToast = (
    type = 'info',
    title = '',
    message = ''
  ) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({
      visible: true,
      type,
      title,
      message,
    });

    toastOpacity.setValue(0);
    toastTranslateY.setValue(-24);

    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 230,
        useNativeDriver: true,
      }),
      Animated.spring(toastTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();

    toastTimerRef.current = setTimeout(() => {
      hideToast();
    }, 3200);
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: -18,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setToast((previous) => ({
          ...previous,
          visible: false,
        }));
      }
    });
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // ==========================================================
  // TOAST CONFIG
  // ==========================================================

  const toastConfig = useMemo(() => {
    switch (toast.type) {
      case 'success':
        return {
          icon: 'checkmark-circle',
          color: GREEN,
          background: isDark
            ? '#12351F'
            : '#F0FDF4',
          border: isDark
            ? '#1F6B3A'
            : '#BBF7D0',
        };

      case 'error':
        return {
          icon: 'close-circle',
          color: RED,
          background: isDark
            ? '#3A1717'
            : '#FEF2F2',
          border: isDark
            ? '#7F2929'
            : '#FECACA',
        };

      case 'warning':
        return {
          icon: 'warning',
          color: ORANGE,
          background: isDark
            ? '#3A2B10'
            : '#FFFBEB',
          border: isDark
            ? '#795A1A'
            : '#FDE68A',
        };

      default:
        return {
          icon: 'information-circle',
          color: BLUE,
          background: isDark
            ? '#121E3D'
            : '#EFF6FF',
          border: isDark
            ? '#28468D'
            : '#BFDBFE',
        };
    }
  }, [toast.type, isDark]);

  // ==========================================================
  // ADDRESS HELPERS
  // ==========================================================

  const extractAddressComponents = (address) => {
    if (!address) {
      return {
        lot: '',
        rue: '',
        ville: '',
        pays: '',
        codePostal: '',
        display_name: '',
      };
    }

    const parts = address
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const result = {
      lot: '',
      rue: parts[0] || '',
      ville: parts[1] || '',
      pays: parts[2] || 'Madagascar',
      codePostal: '',
      display_name: address,
    };

    const lotMatch = address.match(
      /Lot\s+([A-Z0-9\s\-]+)/i
    );

    if (lotMatch) {
      result.lot = lotMatch[1].trim();
    }

    const postalMatch = address.match(
      /\b(\d{5})\b/
    );

    if (postalMatch) {
      result.codePostal = postalMatch[1];
    }

    return result;
  };

  const getInitials = (name) => {
    if (!name) return 'U';

    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 1) {
      return parts[0]
        .substring(0, 2)
        .toUpperCase();
    }

    return `${parts[0][0]}${
      parts[parts.length - 1][0]
    }`.toUpperCase();
  };

  const hasLocation =
    profileData.latitude !== null &&
    profileData.latitude !== undefined &&
    profileData.longitude !== null &&
    profileData.longitude !== undefined;

  const hasSelectedLocation =
    selectedLocation.latitude !== null &&
    selectedLocation.latitude !== undefined &&
    selectedLocation.longitude !== null &&
    selectedLocation.longitude !== undefined;

  // ==========================================================
  // MENU ITEMS
  // ==========================================================

  const menuItems = useMemo(
    () => [
      {
        id: 'bookings',
        icon: 'calendar-outline',
        label: 'Mes réservations',
        description:
          'Consulter mes rendez-vous',
        onPress: () => {
          showToast(
            'info',
            'Mes réservations',
            'Ouverture de vos réservations...'
          );

          navigation.navigate('Réservations');
        },
      },

      {
        id: 'payment',
        icon: 'card-outline',
        label: 'Moyens de paiement',
        description:
          'Gérer mes méthodes de paiement',
        onPress: () =>
          showToast(
            'info',
            'Moyens de paiement',
            'Cette fonctionnalité sera bientôt disponible.'
          ),
      },

      {
        id: 'settings',
        icon: 'settings-outline',
        label: 'Paramètres',
        description:
          'Préférences de votre compte',
        onPress: () => {
          showToast(
            'info',
            'Paramètres',
            'Ouverture des paramètres...'
          );

          navigation.navigate('Settings');
        },
      },

      {
        id: 'help',
        icon: 'help-circle-outline',
        label: 'Aide et support',
        description:
          'Besoin d’aide ? Contactez-nous',
        onPress: async () => {
          try {
            await Linking.openURL(
              'mailto:support@madabienetre.com'
            );
          } catch (error) {
            showToast(
              'error',
              'Erreur',
              'Impossible d’ouvrir votre application e-mail.'
            );
          }
        },
      },

      {
        id: 'about',
        icon: 'information-circle-outline',
        label: 'À propos',
        description:
          'Mada Bien-être • Version 1.0.0',
        onPress: () =>
          showToast(
            'info',
            'Mada Bien-être',
            'Version 1.0.0 • Application de mise en relation à domicile.'
          ),
      },
    ],
    [navigation]
  );

  // ==========================================================
  // STATS
  // ==========================================================

  const stats = [
    {
      icon: 'calendar-outline',
      label: 'Massages',
      value: user?.total_bookings || 0,
    },
    {
      icon: 'star',
      label: 'Note',
      value: user?.rating || 0,
    },
    {
      icon: 'chatbubble-ellipses-outline',
      label: 'Avis',
      value: user?.total_reviews || 0,
    },
  ];

  // ==========================================================
  // MAP
  // ==========================================================

  const openMapModal = () => {
    if (hasLocation) {
      const region = {
        latitude: Number(
          profileData.latitude
        ),
        longitude: Number(
          profileData.longitude
        ),
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };

      setMapRegion(region);

      setSelectedLocation({
        latitude: Number(
          profileData.latitude
        ),
        longitude: Number(
          profileData.longitude
        ),
        address: profileData.address || '',
        fullAddress:
          extractAddressComponents(
            profileData.address || ''
          ),
      });
    }

    setSearchResult(null);
    setShowMapModal(true);

    showToast(
      'info',
      'Position',
      'Sélectionnez votre adresse sur la carte.'
    );
  };

  const handleLocationSearch = async () => {
    const query =
      addressSearchQuery.trim();

    if (!query) {
      showToast(
        'warning',
        'Adresse manquante',
        'Veuillez saisir une adresse ou un lieu.'
      );
      return;
    }

    setIsSearchingAddress(true);
    setSearchResult(null);

    try {
      const result =
        await searchLocation(query);

      if (!result) {
        showToast(
          'warning',
          'Lieu introuvable',
          `Aucun résultat trouvé pour "${query}".`
        );
        return;
      }

      const latitude = Number(
        result.latitude
      );

      const longitude = Number(
        result.longitude
      );

      const fullAddress = {
        lot: result.lot || '',
        rue: result.rue || '',
        ville: result.ville || '',
        pays:
          result.pays || 'Madagascar',
        codePostal:
          result.codePostal || '',
        display_name:
          result.display_name || query,
      };

      const location = {
        latitude,
        longitude,
        address:
          result.display_name || query,
        fullAddress,
      };

      setSelectedLocation(location);

      setSearchResult({
        latitude,
        longitude,
        address:
          result.display_name || query,
        isApproximate:
          result.isApproximate || false,
        fullAddress,
      });

      const region = {
        latitude,
        longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };

      setMapRegion(region);

      setTimeout(() => {
        mapRef.current?.animateToRegion(
          region,
          500
        );
      }, 150);

      showToast(
        'success',
        'Adresse trouvée',
        'La position a été placée sur la carte.'
      );
    } catch (error) {
      console.error(
        'Location search error:',
        error
      );

      showToast(
        'error',
        'Erreur de recherche',
        'Impossible de rechercher cette adresse.'
      );
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);

    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        showToast(
          'warning',
          'Permission nécessaire',
          'Autorisez la localisation dans les paramètres.'
        );
        return;
      }

      const location =
        await Location.getCurrentPositionAsync(
          {
            accuracy:
              Location.Accuracy.High,
          }
        );

      const {
        latitude,
        longitude,
      } = location.coords;

      let address = '';

      try {
        address =
          (await getAddressFromCoords(
            latitude,
            longitude
          )) || '';
      } catch (error) {
        console.log(
          'Reverse geocoding error:',
          error
        );
      }

      const fullAddress =
        extractAddressComponents(address);

      const newLocation = {
        latitude,
        longitude,
        address:
          address ||
          'Ma position actuelle',
        fullAddress: {
          ...fullAddress,
          display_name:
            address ||
            'Ma position actuelle',
        },
      };

      setSelectedLocation(
        newLocation
      );

      setSearchResult({
        latitude,
        longitude,
        address:
          address ||
          'Ma position actuelle',
        isApproximate: false,
        fullAddress,
      });

      const region = {
        latitude,
        longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };

      setMapRegion(region);

      setTimeout(() => {
        mapRef.current?.animateToRegion(
          region,
          500
        );
      }, 150);

      showToast(
        'success',
        'Position trouvée',
        'Votre position actuelle a été détectée.'
      );
    } catch (error) {
      console.error(
        'Current location error:',
        error
      );

      showToast(
        'error',
        'Position indisponible',
        'Impossible d’obtenir votre position actuelle.'
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleMapPress = async (
    coordinate
  ) => {
    if (
      !coordinate ||
      coordinate.latitude === undefined ||
      coordinate.longitude === undefined
    ) {
      return;
    }

    const latitude = Number(
      coordinate.latitude
    );

    const longitude = Number(
      coordinate.longitude
    );

    setIsLoadingLocation(true);

    try {
      let address = '';

      try {
        address =
          (await getAddressFromCoords(
            latitude,
            longitude
          )) || '';
      } catch (error) {
        console.log(
          'Reverse geocoding error:',
          error
        );
      }

      const fullAddress =
        extractAddressComponents(address);

      const newLocation = {
        latitude,
        longitude,
        address:
          address ||
          `${latitude.toFixed(
            6
          )}, ${longitude.toFixed(6)}`,
        fullAddress: {
          ...fullAddress,
          display_name:
            address ||
            `${latitude.toFixed(
              6
            )}, ${longitude.toFixed(6)}`,
        },
      };

      setSelectedLocation(
        newLocation
      );

      setSearchResult({
        latitude,
        longitude,
        address:
          address ||
          `${latitude.toFixed(
            6
          )}, ${longitude.toFixed(6)}`,
        isApproximate: false,
        fullAddress,
      });

      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      });

      showToast(
        'success',
        'Position sélectionnée',
        'Cette position sera utilisée comme adresse.'
      );
    } catch (error) {
      console.error(
        'Map press error:',
        error
      );

      showToast(
        'error',
        'Erreur',
        'Impossible de récupérer cette adresse.'
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const validateLocation = () => {
    if (!hasSelectedLocation) {
      showToast(
        'warning',
        'Position manquante',
        'Sélectionnez d’abord une position sur la carte.'
      );
      return;
    }

    setProfileData((previous) => ({
      ...previous,
      latitude:
        selectedLocation.latitude,
      longitude:
        selectedLocation.longitude,
      address:
        selectedLocation.address ||
        `${selectedLocation.latitude.toFixed(
          6
        )}, ${selectedLocation.longitude.toFixed(
          6
        )}`,
      coordinate: {
        latitude:
          selectedLocation.latitude,
        longitude:
          selectedLocation.longitude,
      },
    }));

    setShowMapModal(false);
    setSearchResult(null);

    showToast(
      'success',
      'Position enregistrée',
      'Pensez à enregistrer votre profil.'
    );
  };

  // ==========================================================
  // PROFILE UPDATE
  // ==========================================================

  const handleUpdateProfile = async () => {
    if (!profileData.fullname.trim()) {
      showToast(
        'warning',
        'Nom requis',
        'Veuillez renseigner votre nom complet.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const userId = user?.id;

      if (!userId) {
        showToast(
          'error',
          'Erreur',
          'Utilisateur non identifié.'
        );
        return;
      }

      const updateData = {
        fullname:
          profileData.fullname.trim(),

        phone:
          profileData.phone?.trim() || '',

        bio:
          profileData.bio?.trim() || '',

        latitude:
          profileData.latitude,

        longitude:
          profileData.longitude,

        address:
          profileData.address || '',
      };

      const { data, error } =
        await put(
          `/users/${userId}`,
          updateData
        );

      if (error) {
        showToast(
          'error',
          'Mise à jour impossible',
          error.message ||
            'Impossible de mettre à jour votre profil.'
        );
        return;
      }

      if (
        typeof updateProfile ===
        'function'
      ) {
        await updateProfile(
          updateData
        );
      }

      setIsEditing(false);

      showToast(
        'success',
        'Profil mis à jour',
        'Vos informations ont été enregistrées avec succès.'
      );
    } catch (error) {
      console.error(
        'Update profile error:',
        error
      );

      showToast(
        'error',
        'Erreur',
        'Une erreur est survenue lors de la mise à jour.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================================
  // UPLOAD PHOTO
  // ==========================================================

  const handleUploadPhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showToast(
          'warning',
          'Permission nécessaire',
          'Autorisez l’accès à votre galerie pour choisir une photo.'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          }
        );

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      setIsUploading(true);

      const asset = result.assets[0];

      const extension =
        asset.fileName?.split('.').pop() ||
        asset.uri.split('.').pop() ||
        'jpg';

      const mimeType =
        asset.mimeType ||
        (extension.toLowerCase() ===
        'png'
          ? 'image/png'
          : 'image/jpeg');

      const filename = `profile.${extension}`;

      let fileToSend;

      if (Platform.OS === 'web') {
        const response =
          await fetch(asset.uri);

        const blob =
          await response.blob();

        fileToSend = new File(
          [blob],
          filename,
          {
            type: mimeType,
          }
        );
      } else {
        fileToSend = {
          uri: asset.uri,
          type: mimeType,
          name: filename,
        };
      }

      const formData =
        new FormData();

      formData.append(
        'file',
        fileToSend
      );

      const response =
        await api.post(
          '/users/upload-profile-photo',
          formData,
          {
            headers: {
              'Content-Type':
                'multipart/form-data',
            },
          }
        );

      if (
        response.data?.profile_image
      ) {
        if (
          typeof updateProfile ===
          'function'
        ) {
          await updateProfile({
            profile_image:
              response.data
                .profile_image,
          });
        }

        setForceRefresh(
          (value) => value + 1
        );

        showToast(
          'success',
          'Photo mise à jour',
          'Votre photo de profil a été modifiée.'
        );
      } else {
        showToast(
          'warning',
          'Attention',
          'La photo a été envoyée mais son adresse n’a pas été reçue.'
        );
      }
    } catch (error) {
      console.error(
        'Upload photo error:',
        error
      );

      showToast(
        'error',
        'Erreur',
        'Impossible de mettre à jour votre photo.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = async () => {
    setShowLogoutModal(false);

    try {
      await logout();
    } catch (error) {
      console.error(
        'Logout error:',
        error
      );

      showToast(
        'error',
        'Erreur',
        'Impossible de vous déconnecter.'
      );
    }
  };

  // ==========================================================
  // EFFECTS
  // ==========================================================

  useEffect(() => {
    if (user) {
      const latitude =
        user.latitude !==
          undefined &&
        user.latitude !== null
          ? Number(user.latitude)
          : null;

      const longitude =
        user.longitude !==
          undefined &&
        user.longitude !== null
          ? Number(user.longitude)
          : null;

      setProfileData({
        fullname:
          user.fullname || '',

        email:
          user.email || '',

        phone:
          user.phone || '',

        bio:
          user.bio || '',

        latitude,
        longitude,

        address:
          user.address || '',

        coordinate:
          latitude !== null &&
          longitude !== null
            ? {
                latitude,
                longitude,
              }
            : null,
      });

      if (
        latitude !== null &&
        longitude !== null
      ) {
        setMapRegion({
          latitude,
          longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        });

        setSelectedLocation({
          latitude,
          longitude,
          address:
            user.address || '',
          fullAddress:
            extractAddressComponents(
              user.address || ''
            ),
        });
      }
    }
  }, [user, forceRefresh]);

  useEffect(() => {
    Animated.timing(
      fadeAnim,
      {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }
    ).start();
  }, []);

  // ==========================================================
  // MAP MARKERS
  // ==========================================================

  const markers = [];

  if (hasSelectedLocation) {
    markers.push({
      id: 'selected-location',
      coordinate: {
        latitude: Number(
          selectedLocation.latitude
        ),
        longitude: Number(
          selectedLocation.longitude
        ),
      },
      title: 'Ma position',
      description:
        selectedLocation.address ||
        'Position sélectionnée',
      pinColor: GREEN,
      available: true,
    });
  }

  const selectionMarker =
    hasSelectedLocation
      ? {
          latitude: Number(
            selectedLocation.latitude
          ),
          longitude: Number(
            selectedLocation.longitude
          ),
        }
      : null;

  // ==========================================================
  // TOAST COMPONENT
  // ==========================================================

  const renderToast = () => {
    if (!toast.visible) {
      return null;
    }

    return (
      <View
        pointerEvents="box-none"
        style={styles.toastLayer}
      >
        <Animated.View
          style={[
            styles.toastContainer,
            {
              backgroundColor:
                toastConfig.background,

              borderColor:
                toastConfig.border,

              opacity: toastOpacity,

              transform: [
                {
                  translateY:
                    toastTranslateY,
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.toastIconContainer,
              {
                backgroundColor:
                  `${toastConfig.color}18`,
              },
            ]}
          >
            <Ionicons
              name={toastConfig.icon}
              size={22}
              color={toastConfig.color}
            />
          </View>

          <View
            style={styles.toastContent}
          >
            {toast.title ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.toastTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                {toast.title}
              </Text>
            ) : null}

            {toast.message ? (
              <Text
                numberOfLines={2}
                style={[
                  styles.toastMessage,
                  {
                    color:
                      themeColors
                        .textSecondary,
                  },
                ]}
              >
                {toast.message}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={hideToast}
            style={styles.toastClose}
            hitSlop={{
              top: 8,
              bottom: 8,
              left: 8,
              right: 8,
            }}
          >
            <Ionicons
              name="close"
              size={17}
              color={
                themeColors
                  .textSecondary
              }
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  // ==========================================================
  // MAP MODAL
  // ==========================================================

  const renderMapModal = () => {
    return (
      <Modal
        visible={showMapModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowMapModal(false);
          setSearchResult(null);
        }}
        statusBarTranslucent
      >
        <View
          style={styles.mapModalOverlay}
        >
          <View
            style={[
              styles.mapSheet,
              {
                backgroundColor:
                  themeColors.surface ||
                  '#FFFFFF',
              },
            ]}
          >
            <View
              style={styles.sheetHandle}
            />

            <View
              style={styles.mapHeader}
            >
              <View
                style={styles.mapHeaderLeft}
              >
                <View
                  style={[
                    styles.mapHeaderIcon,
                    {
                      backgroundColor: `${GREEN}18`,
                    },
                  ]}
                >
                  <Ionicons
                    name="location"
                    size={22}
                    color={GREEN}
                  />
                </View>

                <View
                  style={
                    styles.mapHeaderTextContainer
                  }
                >
                  <Text
                    style={[
                      styles.mapTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Votre position
                  </Text>

                  <Text
                    style={[
                      styles.mapSubtitle,
                      {
                        color:
                          themeColors
                            .textSecondary,
                      },
                    ]}
                  >
                    Déplacez la carte ou recherchez une adresse
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.closeMapButton,
                  {
                    backgroundColor:
                      themeColors.background,
                  },
                ]}
                onPress={() => {
                  setShowMapModal(false);
                  setSearchResult(null);
                }}
              >
                <Ionicons
                  name="close"
                  size={21}
                  color={
                    themeColors.text
                  }
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.mapSearchSection
              }
            >
              <View
                style={[
                  styles.mapSearchBox,
                  {
                    backgroundColor:
                      themeColors.background,
                    borderColor:
                      themeColors.border ||
                      '#E5E7EB',
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={
                    themeColors
                      .textSecondary
                  }
                />

                <TextInput
                  style={[
                    styles.mapSearchInput,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                  value={
                    addressSearchQuery
                  }
                  onChangeText={
                    setAddressSearchQuery
                  }
                  placeholder="Rechercher une adresse..."
                  placeholderTextColor={
                    themeColors
                      .textSecondary
                  }
                  returnKeyType="search"
                  onSubmitEditing={
                    handleLocationSearch
                  }
                  autoCorrect={false}
                />

                {addressSearchQuery.length >
                  0 && (
                  <TouchableOpacity
                    onPress={() =>
                      setAddressSearchQuery(
                        ''
                      )
                    }
                  >
                    <Ionicons
                      name="close-circle"
                      size={19}
                      color={
                        themeColors
                          .textSecondary
                      }
                    />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={
                  styles.searchActionButton
                }
                onPress={
                  handleLocationSearch
                }
                disabled={
                  isSearchingAddress
                }
                activeOpacity={0.8}
              >
                {isSearchingAddress ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                    size="small"
                  />
                ) : (
                  <Ionicons
                    name="search"
                    size={19}
                    color="#FFFFFF"
                  />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.currentLocationButton,
                {
                  backgroundColor: `${GREEN}12`,
                  borderColor: `${GREEN}35`,
                },
              ]}
              onPress={
                getCurrentLocation
              }
              disabled={
                isLoadingLocation
              }
              activeOpacity={0.8}
            >
              <View
                style={
                  styles.currentLocationIcon
                }
              >
                {isLoadingLocation ? (
                  <ActivityIndicator
                    size="small"
                    color={GREEN}
                  />
                ) : (
                  <Ionicons
                    name="navigate"
                    size={18}
                    color={GREEN}
                  />
                )}
              </View>

              <View
                style={{ flex: 1 }}
              >
                <Text
                  style={[
                    styles.currentLocationTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Utiliser ma position actuelle
                </Text>

                <Text
                  style={[
                    styles.currentLocationSubtitle,
                    {
                      color:
                        themeColors
                          .textSecondary,
                    },
                  ]}
                >
                  Localisation GPS de votre téléphone
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={GREEN}
              />
            </TouchableOpacity>

            <View
              style={styles.mapWrapper}
            >
              <MapViewWrapper
                ref={mapRef}
                style={styles.map}
                region={mapRegion}
                initialRegion={
                  mapRegion
                }
                markers={markers}
                selectionMarker={
                  selectionMarker
                }
                onMapPress={
                  handleMapPress
                }
                onSelectionDragEnd={
                  handleMapPress
                }
                showUserLocation
                trackUserLocation={
                  false
                }
                showMapTypeControl
                fitToMarkersOnLoad={
                  false
                }
                onMapReady={() =>
                  console.log(
                    'Map ready'
                  )
                }
              />

              {hasSelectedLocation && (
                <View
                  pointerEvents="none"
                  style={
                    styles.centerMarkerOverlay
                  }
                >
                  <View
                    style={
                      styles.markerShadow
                    }
                  />

                  <View
                    style={[
                      styles.greenMarker,
                      {
                        backgroundColor:
                          GREEN,
                      },
                    ]}
                  >
                    <Ionicons
                      name="location"
                      size={25}
                      color="#FFFFFF"
                    />
                  </View>
                </View>
              )}

              {isLoadingLocation && (
                <View
                  style={
                    styles.mapLoadingOverlay
                  }
                >
                  <View
                    style={[
                      styles.mapLoadingCard,
                      {
                        backgroundColor:
                          themeColors.surface,
                      },
                    ]}
                  >
                    <ActivityIndicator
                      size="small"
                      color={GREEN}
                    />

                    <Text
                      style={[
                        styles.mapLoadingText,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      Localisation...
                    </Text>
                  </View>
                </View>
              )}

              <View
                style={
                  styles.mapInstruction
                }
              >
                <Ionicons
                  name="hand-left-outline"
                  size={15}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.mapInstructionText
                  }
                >
                  Appuyez sur la carte pour choisir
                </Text>
              </View>
            </View>

            {hasSelectedLocation && (
              <View
                style={[
                  styles.selectedLocationCard,
                  {
                    backgroundColor:
                      themeColors.background,
                    borderColor: `${GREEN}40`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.selectedLocationIcon,
                    {
                      backgroundColor: `${GREEN}15`,
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={21}
                    color={GREEN}
                  />
                </View>

                <View
                  style={
                    styles.selectedLocationContent
                  }
                >
                  <Text
                    style={[
                      styles.selectedLocationLabel,
                      {
                        color:
                          themeColors
                            .textSecondary,
                      },
                    ]}
                  >
                    POSITION SÉLECTIONNÉE
                  </Text>

                  <Text
                    style={[
                      styles.selectedLocationAddress,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {selectedLocation.address ||
                      'Position sélectionnée sur la carte'}
                  </Text>

                  <Text
                    style={[
                      styles.selectedLocationCoords,
                      {
                        color:
                          themeColors
                            .textSecondary,
                      },
                    ]}
                  >
                    {Number(
                      selectedLocation.latitude
                    ).toFixed(6)}{' '}
                    •{' '}
                    {Number(
                      selectedLocation.longitude
                    ).toFixed(6)}
                  </Text>
                </View>
              </View>
            )}

            <View
              style={[
                styles.mapBottomActions,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.mapCancelButton,
                  {
                    backgroundColor:
                      themeColors.background,
                    borderColor:
                      themeColors.border ||
                      '#E5E7EB',
                  },
                ]}
                onPress={() => {
                  setShowMapModal(false);
                  setSearchResult(null);

                  showToast(
                    'info',
                    'Modification annulée',
                    'La position actuelle n’a pas été modifiée.'
                  );
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.mapCancelText,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mapConfirmButton,
                  !hasSelectedLocation &&
                    styles.mapConfirmButtonDisabled,
                ]}
                onPress={
                  validateLocation
                }
                disabled={
                  !hasSelectedLocation
                }
                activeOpacity={0.85}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={21}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.mapConfirmText
                  }
                >
                  Valider la position
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ==========================================================
  // MAIN RENDER
  // ==========================================================

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            themeColors.background,
        },
      ]}
    >
      <Header title="Mon profil" />

      <Animated.ScrollView
        style={{
          opacity: fadeAnim,
        }}
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* ======================================================
            PROFILE HERO
        ====================================================== */}

        <Animatable.View
          animation="fadeInDown"
          duration={550}
          style={styles.heroContainer}
        >
          <LinearGradient
            colors={[
              BLUE,
              colors.primaryLight ||
                '#1A4FB5',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View
              style={
                styles.heroDecorationOne
              }
            />

            <View
              style={
                styles.heroDecorationTwo
              }
            />

            <TouchableOpacity
              onPress={
                handleUploadPhoto
              }
              disabled={isUploading}
              activeOpacity={0.85}
              style={
                styles.avatarTouchable
              }
            >
              {user?.profile_image ? (
                <Image
                  key={`profile-${forceRefresh}`}
                  source={{
                    uri: user.profile_image,
                  }}
                  style={styles.avatar}
                />
              ) : (
                <View
                  style={
                    styles.avatarPlaceholder
                  }
                >
                  <Text
                    style={
                      styles.avatarText
                    }
                  >
                    {getInitials(
                      user?.fullname
                    )}
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.avatarCamera
                }
              >
                {isUploading ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name="camera"
                    size={16}
                    color="#FFFFFF"
                  />
                )}
              </View>
            </TouchableOpacity>

            <Text
              style={styles.heroName}
            >
              {user?.fullname ||
                'Utilisateur'}
            </Text>

            <View
              style={styles.emailBadge}
            >
              <Ionicons
                name="mail-outline"
                size={14}
                color="#FFFFFF"
              />

              <Text
                style={styles.heroEmail}
              >
                {user?.email || ''}
              </Text>
            </View>

            <View
              style={styles.statsRow}
            >
              {stats.map(
                (stat, index) => (
                  <React.Fragment
                    key={stat.label}
                  >
                    <View
                      style={
                        styles.statBox
                      }
                    >
                      <View
                        style={
                          styles.statIcon
                        }
                      >
                        <Ionicons
                          name={stat.icon}
                          size={15}
                          color="#FFFFFF"
                        />
                      </View>

                      <Text
                        style={
                          styles.statValue
                        }
                      >
                        {stat.value}
                      </Text>

                      <Text
                        style={
                          styles.statLabel
                        }
                      >
                        {stat.label}
                      </Text>
                    </View>

                    {index <
                      stats.length -
                        1 && (
                      <View
                        style={
                          styles.statSeparator
                        }
                      />
                    )}
                  </React.Fragment>
                )
              )}
            </View>
          </LinearGradient>
        </Animatable.View>

        {/* ======================================================
            PERSONAL INFORMATION
        ====================================================== */}

        <Animatable.View
          animation="fadeInUp"
          delay={100}
          duration={500}
          style={
            styles.sectionContainer
          }
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={styles.sectionHeader}
            >
              <View
                style={
                  styles.sectionHeaderLeft
                }
              >
                <View
                  style={[
                    styles.sectionIcon,
                    {
                      backgroundColor: `${BLUE}12`,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={BLUE}
                  />
                </View>

                <View>
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Informations personnelles
                  </Text>

                  <Text
                    style={[
                      styles.sectionSubtitle,
                      {
                        color:
                          themeColors
                            .textSecondary,
                      },
                    ]}
                  >
                    Gérez vos informations
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={
                  styles.editAction
                }
                onPress={() => {
                  setIsEditing(
                    !isEditing
                  );

                  showToast(
                    'info',
                    isEditing
                      ? 'Modification annulée'
                      : 'Mode modification',
                    isEditing
                      ? 'Vos modifications non enregistrées ont été annulées.'
                      : 'Vous pouvez maintenant modifier vos informations.'
                  );
                }}
              >
                <Ionicons
                  name={
                    isEditing
                      ? 'close-outline'
                      : 'create-outline'
                  }
                  size={17}
                  color={BLUE}
                />

                <Text
                  style={
                    styles.editActionText
                  }
                >
                  {isEditing
                    ? 'Annuler'
                    : 'Modifier'}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <View>
                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Nom complet
                  </Text>

                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor:
                          themeColors.background,
                        borderColor:
                          themeColors.border ||
                          '#E5E7EB',
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={19}
                      color={
                        themeColors
                          .textSecondary
                      }
                    />

                    <TextInput
                      style={[
                        styles.input,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                      value={
                        profileData.fullname
                      }
                      onChangeText={(
                        text
                      ) =>
                        setProfileData(
                          (
                            previous
                          ) => ({
                            ...previous,
                            fullname:
                              text,
                          })
                        )
                      }
                      placeholder="Votre nom complet"
                      placeholderTextColor={
                        themeColors
                          .textSecondary
                      }
                    />
                  </View>
                </View>

                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Adresse e-mail
                  </Text>

                  <View
                    style={[
                      styles.inputWrapper,
                      styles.disabledInput,
                      {
                        backgroundColor:
                          themeColors.background,
                        borderColor:
                          themeColors.border ||
                          '#E5E7EB',
                      },
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={19}
                      color={
                        themeColors
                          .textSecondary
                      }
                    />

                    <TextInput
                      style={[
                        styles.input,
                        {
                          color:
                            themeColors
                              .textSecondary,
                        },
                      ]}
                      value={
                        profileData.email
                      }
                      editable={false}
                    />

                    <Ionicons
                      name="lock-closed-outline"
                      size={15}
                      color={
                        themeColors
                          .textSecondary
                      }
                    />
                  </View>
                </View>

                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Téléphone
                  </Text>

                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor:
                          themeColors.background,
                        borderColor:
                          themeColors.border ||
                          '#E5E7EB',
                      },
                    ]}
                  >
                    <Ionicons
                      name="call-outline"
                      size={19}
                      color={
                        themeColors
                          .textSecondary
                      }
                    />

                    <TextInput
                      style={[
                        styles.input,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                      value={
                        profileData.phone
                      }
                      onChangeText={(
                        text
                      ) =>
                        setProfileData(
                          (
                            previous
                          ) => ({
                            ...previous,
                            phone: text,
                          })
                        )
                      }
                      keyboardType="phone-pad"
                      placeholder="Votre numéro"
                      placeholderTextColor={
                        themeColors
                          .textSecondary
                      }
                    />
                  </View>
                </View>

                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    À propos de moi
                  </Text>

                  <View
                    style={[
                      styles.bioWrapper,
                      {
                        backgroundColor:
                          themeColors.background,
                        borderColor:
                          themeColors.border ||
                          '#E5E7EB',
                      },
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.bioInput,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                      value={
                        profileData.bio
                      }
                      onChangeText={(
                        text
                      ) =>
                        setProfileData(
                          (
                            previous
                          ) => ({
                            ...previous,
                            bio: text,
                          })
                        )
                      }
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      placeholder="Présentez-vous en quelques mots..."
                      placeholderTextColor={
                        themeColors
                          .textSecondary
                      }
                    />
                  </View>
                </View>

                <View
                  style={styles.inputGroup}
                >
                  <View
                    style={
                      styles.locationLabelRow
                    }
                  >
                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      Adresse
                    </Text>

                    {hasLocation && (
                      <View
                        style={
                          styles.locationBadge
                        }
                      >
                        <View
                          style={
                            styles.locationDot
                          }
                        />

                        <Text
                          style={
                            styles.locationBadgeText
                          }
                        >
                          Définie
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.locationCard,
                      {
                        backgroundColor:
                          themeColors.background,
                        borderColor:
                          hasLocation
                            ? `${GREEN}45`
                            : themeColors.border ||
                              '#E5E7EB',
                      },
                    ]}
                    onPress={
                      openMapModal
                    }
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.locationCardIcon,
                        {
                          backgroundColor:
                            hasLocation
                              ? `${GREEN}15`
                              : `${BLUE}12`,
                        },
                      ]}
                    >
                      <Ionicons
                        name="location-outline"
                        size={22}
                        color={
                          hasLocation
                            ? GREEN
                            : BLUE
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.locationCardContent
                      }
                    >
                      <Text
                        style={[
                          styles.locationCardTitle,
                          {
                            color:
                              themeColors.text,
                          },
                        ]}
                      >
                        {hasLocation
                          ? 'Position enregistrée'
                          : 'Ajouter votre position'}
                      </Text>

                      <Text
                        style={[
                          styles.locationCardAddress,
                          {
                            color:
                              themeColors
                                .textSecondary,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {profileData.address ||
                          'Sélectionnez votre adresse sur la carte'}
                      </Text>

                      {hasLocation && (
                        <Text
                          style={[
                            styles.locationCardCoords,
                            {
                              color:
                                themeColors
                                  .textSecondary,
                            },
                          ]}
                        >
                          {Number(
                            profileData.latitude
                          ).toFixed(6)}{' '}
                          •{' '}
                          {Number(
                            profileData.longitude
                          ).toFixed(6)}
                        </Text>
                      )}
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={
                        themeColors
                          .textSecondary
                      }
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.openMapButton
                    }
                    onPress={
                      openMapModal
                    }
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[
                        BLUE,
                        colors.primaryLight ||
                          '#1A4FB5',
                      ]}
                      start={{
                        x: 0,
                        y: 0,
                      }}
                      end={{
                        x: 1,
                        y: 0,
                      }}
                      style={
                        styles.openMapGradient
                      }
                    >
                      <Ionicons
                        name="map-outline"
                        size={19}
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.openMapText
                        }
                      >
                        {hasLocation
                          ? 'Modifier ma position'
                          : 'Choisir sur la carte'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={
                    styles.saveButton
                  }
                  onPress={
                    handleUpdateProfile
                  }
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[
                      GREEN_DARK,
                      GREEN,
                    ]}
                    start={{
                      x: 0,
                      y: 0,
                    }}
                    end={{
                      x: 1,
                      y: 0,
                    }}
                    style={
                      styles.saveGradient
                    }
                  >
                    {isLoading ? (
                      <ActivityIndicator
                        color="#FFFFFF"
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={21}
                          color="#FFFFFF"
                        />

                        <Text
                          style={
                            styles.saveText
                          }
                        >
                          Enregistrer les modifications
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <ProfileInfoRow
                  icon="person-outline"
                  label="Nom complet"
                  value={
                    user?.fullname ||
                    'Non renseigné'
                  }
                  themeColors={
                    themeColors
                  }
                />

                <ProfileInfoRow
                  icon="mail-outline"
                  label="E-mail"
                  value={
                    user?.email ||
                    'Non renseigné'
                  }
                  themeColors={
                    themeColors
                  }
                />

                <ProfileInfoRow
                  icon="call-outline"
                  label="Téléphone"
                  value={
                    user?.phone ||
                    'Non renseigné'
                  }
                  themeColors={
                    themeColors
                  }
                />

                {user?.bio ? (
                  <ProfileInfoRow
                    icon="document-text-outline"
                    label="À propos"
                    value={
                      user.bio
                    }
                    themeColors={
                      themeColors
                    }
                  />
                ) : null}

                <ProfileInfoRow
                  icon="location-outline"
                  label="Adresse"
                  value={
                    user?.address ||
                    'Aucune position enregistrée'
                  }
                  themeColors={
                    themeColors
                  }
                  last
                />
              </View>
            )}
          </View>
        </Animatable.View>

        {/* ======================================================
            SETTINGS
        ====================================================== */}

        <Animatable.View
          animation="fadeInUp"
          delay={200}
          duration={500}
          style={
            styles.sectionContainer
          }
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={
                styles.simpleSectionHeader
              }
            >
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Préférences
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color:
                      themeColors
                        .textSecondary,
                  },
                ]}
              >
                Personnalisez votre expérience
              </Text>
            </View>

            {menuItems.map(
              (item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuItem,
                    index <
                      menuItems.length -
                        1 && {
                      borderBottomWidth: 1,
                      borderBottomColor:
                        themeColors.border ||
                        '#E5E7EB',
                    },
                  ]}
                  onPress={
                    item.onPress
                  }
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.menuIcon,
                      {
                        backgroundColor: `${BLUE}10`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={21}
                      color={BLUE}
                    />
                  </View>

                  <View
                    style={
                      styles.menuContent
                    }
                  >
                    <Text
                      style={[
                        styles.menuLabel,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>

                    <Text
                      style={[
                        styles.menuDescription,
                        {
                          color:
                            themeColors
                              .textSecondary,
                        },
                      ]}
                    >
                      {item.description}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={19}
                    color={
                      themeColors
                        .textSecondary
                    }
                  />
                </TouchableOpacity>
              )
            )}

            <View
              style={[
                styles.menuItem,
                {
                  paddingBottom: 4,
                },
              ]}
            >
              <View
                style={[
                  styles.menuIcon,
                  {
                    backgroundColor:
                      isDark
                        ? '#6366F115'
                        : '#F59E0B15',
                  },
                ]}
              >
                <Ionicons
                  name={
                    isDark
                      ? 'moon-outline'
                      : 'sunny-outline'
                  }
                  size={21}
                  color={
                    isDark
                      ? '#6366F1'
                      : ORANGE
                  }
                />
              </View>

              <View
                style={
                  styles.menuContent
                }
              >
                <Text
                  style={[
                    styles.menuLabel,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Mode d'affichage
                </Text>

                <Text
                  style={[
                    styles.menuDescription,
                    {
                      color:
                        themeColors
                          .textSecondary,
                    },
                  ]}
                >
                  {isDark
                    ? 'Mode sombre activé'
                    : 'Mode clair activé'}
                </Text>
              </View>

              <Switch
                value={isDark}
                onValueChange={() => {
                  toggleTheme();

                  showToast(
                    'success',
                    'Mode d’affichage',
                    isDark
                      ? 'Mode clair activé.'
                      : 'Mode sombre activé.'
                  );
                }}
                trackColor={{
                  false: '#D1D5DB',
                  true: BLUE,
                }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </Animatable.View>

        {/* ======================================================
            LOGOUT
        ====================================================== */}

        <Animatable.View
          animation="fadeInUp"
          delay={300}
          duration={500}
          style={
            styles.logoutSection
          }
        >
          <TouchableOpacity
            style={
              styles.logoutButton
            }
            onPress={() =>
              setShowLogoutModal(
                true
              )
            }
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[
                RED,
                '#C62828',
              ]}
              start={{
                x: 0,
                y: 0,
              }}
              end={{
                x: 1,
                y: 0,
              }}
              style={
                styles.logoutGradient
              }
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.logoutText
                }
              >
                Se déconnecter
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text
            style={[
              styles.versionText,
              {
                color:
                  themeColors
                    .textSecondary,
              },
            ]}
          >
            Mada Bien-être • Version 1.0.0
          </Text>
        </Animatable.View>
      </Animated.ScrollView>

      {/* ========================================================
          LOGOUT MODAL
      ======================================================== */}

      <Modal
        transparent
        visible={
          showLogoutModal
        }
        animationType="fade"
        onRequestClose={() =>
          setShowLogoutModal(
            false
          )
        }
      >
        <Pressable
          style={
            styles.modalOverlay
          }
          onPress={() =>
            setShowLogoutModal(
              false
            )
          }
        >
          <Pressable
            style={[
              styles.logoutModalCard,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
            onPress={() => {}}
          >
            <View
              style={[
                styles.logoutModalIcon,
                {
                  backgroundColor:
                    `${RED}12`,
                },
              ]}
            >
              <Ionicons
                name="log-out-outline"
                size={29}
                color={RED}
              />
            </View>

            <Text
              style={[
                styles.logoutModalTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Se déconnecter ?
            </Text>

            <Text
              style={[
                styles.logoutModalDescription,
                {
                  color:
                    themeColors
                      .textSecondary,
                },
              ]}
            >
              Êtes-vous sûr de vouloir vous
              déconnecter de votre compte ?
            </Text>

            <View
              style={
                styles.logoutModalActions
              }
            >
              <TouchableOpacity
                style={[
                  styles.logoutCancelButton,
                  {
                    backgroundColor:
                      themeColors.background,
                    borderColor:
                      themeColors.border ||
                      '#E5E7EB',
                  },
                ]}
                onPress={() => {
                  setShowLogoutModal(
                    false
                  );

                  showToast(
                    'info',
                    'Déconnexion annulée',
                    'Vous restez connecté à votre compte.'
                  );
                }}
              >
                <Text
                  style={[
                    styles.logoutCancelText,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.logoutConfirmButton
                }
                onPress={
                  handleLogout
                }
              >
                <Text
                  style={
                    styles.logoutConfirmText
                  }
                >
                  Se déconnecter
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ========================================================
          MAP MODAL
      ======================================================== */}

      {renderMapModal()}

      {/* ========================================================
          GLOBAL TOP CENTER TOAST
          IMPORTANT:
          Rendered AFTER modals so it stays above the interface.
      ======================================================== */}

      {renderToast()}
    </View>
  );
};

// ============================================================
// PROFILE INFO ROW
// ============================================================

const ProfileInfoRow = ({
  icon,
  label,
  value,
  themeColors,
  last,
}) => {
  return (
    <View
      style={[
        styles.profileInfoRow,
        !last && {
          borderBottomWidth: 1,
          borderBottomColor:
            themeColors.border ||
            '#E5E7EB',
        },
      ]}
    >
      <View
        style={[
          styles.infoRowIcon,
          {
            backgroundColor: `${BLUE}10`,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={BLUE}
        />
      </View>

      <View
        style={
          styles.infoRowContent
        }
      >
        <Text
          style={[
            styles.infoRowLabel,
            {
              color:
                themeColors
                  .textSecondary,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          style={[
            styles.infoRowValue,
            {
              color:
                themeColors.text,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  // ==========================================================
  // CONTAINER
  // ==========================================================

  container: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },

  // ==========================================================
  // TOAST
  // ==========================================================

  toastLayer: {
    position: 'absolute',
    top:
      Platform.OS === 'web'
        ? 18
        : 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 99999,
    elevation: 99999,
    pointerEvents: 'box-none',
  },

  toastContainer: {
    width:
      Platform.OS === 'web'
        ? 'min(460px, calc(100% - 32px))'
        : '88%',

    maxWidth: 460,
    minHeight: 66,

    borderWidth: 1,
    borderRadius: 18,

    paddingHorizontal: 12,
    paddingVertical: 10,

    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.16,
    shadowRadius: 14,

    elevation: 12,
  },

  toastIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  toastContent: {
    flex: 1,
    minWidth: 0,
  },

  toastTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,

    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  toastMessage: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,

    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  toastClose: {
    width: 28,
    height: 28,
    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 5,
  },

  // ==========================================================
  // HERO
  // ==========================================================

  heroContainer: {
    marginBottom: 16,
  },

  hero: {
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },

  heroDecorationOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor:
      'rgba(255,255,255,0.06)',
    right: -70,
    top: -80,
  },

  heroDecorationTwo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor:
      'rgba(255,255,255,0.05)',
    left: -70,
    bottom: -60,
  },

  avatarTouchable: {
    position: 'relative',
    marginBottom: 13,
  },

  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor:
      'rgba(255,255,255,0.85)',
  },

  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor:
      'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor:
      'rgba(255,255,255,0.75)',
  },

  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  avatarCamera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  heroName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },

  heroEmail: {
    color:
      'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '500',
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  statsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor:
      'rgba(255,255,255,0.16)',
    paddingTop: 16,
  },

  statBox: {
    flex: 1,
    alignItems: 'center',
  },

  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor:
      'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },

  statValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  statLabel: {
    color:
      'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
    fontFamily:
      typography?.fontFamily?.medium ||
      'System',
  },

  statSeparator: {
    width: 1,
    height: 42,
    backgroundColor:
      'rgba(255,255,255,0.14)',
  },

  // ==========================================================
  // CARDS
  // ==========================================================

  sectionContainer: {
    marginBottom: 16,
  },

  card: {
    borderRadius: 22,
    padding: 17,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,

    elevation: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  sectionSubtitle: {
    fontSize: 11,
    marginTop: 3,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  simpleSectionHeader: {
    marginBottom: 8,
  },

  editAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: `${BLUE}0D`,
  },

  editActionText: {
    color: BLUE,
    fontSize: 12,
    fontWeight: '700',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  // ==========================================================
  // INFO
  // ==========================================================

  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  infoRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  infoRowContent: {
    flex: 1,
  },

  infoRowLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
    fontFamily:
      typography?.fontFamily?.semiBold ||
      'System',
  },

  infoRowValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    fontFamily:
      typography?.fontFamily?.medium ||
      'System',
  },

  // ==========================================================
  // INPUTS
  // ==========================================================

  inputGroup: {
    marginBottom: 15,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  inputWrapper: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
  },

  disabledInput: {
    opacity: 0.72,
  },

  input: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 48,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  bioWrapper: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
  },

  bioInput: {
    minHeight: 95,
    fontSize: 14,
    paddingVertical: 12,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  // ==========================================================
  // LOCATION
  // ==========================================================

  locationLabelRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 7,
  },

  locationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GREEN,
  },

  locationBadgeText: {
    color: GREEN_DARK,
    fontSize: 10,
    fontWeight: '700',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  locationCard: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  locationCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  locationCardContent: {
    flex: 1,
    paddingRight: 8,
  },

  locationCardTitle: {
    fontSize: 13,
    fontWeight: '750',
    marginBottom: 3,
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  locationCardAddress: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  locationCardCoords: {
    fontSize: 9,
    marginTop: 3,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  openMapButton: {
    marginTop: 9,
    borderRadius: 13,
    overflow: 'hidden',
  },

  openMapGradient: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  openMapText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  // ==========================================================
  // SAVE
  // ==========================================================

  saveButton: {
    marginTop: 5,
    borderRadius: 14,
    overflow: 'hidden',
  },

  saveGradient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  saveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  // ==========================================================
  // MENU
  // ==========================================================

  menuItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },

  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  menuContent: {
    flex: 1,
  },

  menuLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  menuDescription: {
    fontSize: 10,
    marginTop: 3,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  // ==========================================================
  // LOGOUT
  // ==========================================================

  logoutSection: {
    marginTop: 10,
    alignItems: 'center',
    width: '100%',
  },

  logoutButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,

    shadowColor: RED,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  logoutGradient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },

  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  versionText: {
    fontSize: 10,
    marginTop: 13,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  // ==========================================================
  // LOGOUT MODAL
  // ==========================================================

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },

  logoutModalCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
  },

  logoutModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  logoutModalTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  logoutModalDescription: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 22,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  logoutModalActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },

  logoutCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutCancelText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  logoutConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  // ==========================================================
  // MAP MODAL
  // ==========================================================

  mapModalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.58)',
    justifyContent: 'flex-end',
  },

  mapSheet: {
    width: '100%',
    maxHeight: '94%',
    minHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom:
      Platform.OS === 'ios'
        ? 28
        : 15,
    overflow: 'hidden',
  },

  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    marginBottom: 12,
  },

  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginBottom: 12,
  },

  mapHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  mapHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  mapHeaderTextContainer: {
    flex: 1,
  },

  mapTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  mapSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  closeMapButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  mapSearchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 9,
  },

  mapSearchBox: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  mapSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingHorizontal: 9,
    height: 46,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  searchActionButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  currentLocationButton: {
    minHeight: 57,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    marginBottom: 10,
  },

  currentLocationIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  currentLocationTitle: {
    fontSize: 12,
    fontWeight: '750',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  currentLocationSubtitle: {
    fontSize: 9,
    marginTop: 2,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  mapWrapper: {
    height: 300,
    borderRadius: 19,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },

  map: {
    width: '100%',
    height: '100%',
  },

  centerMarkerOverlay: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -43,
    alignItems: 'center',
    justifyContent: 'center',
  },

  greenMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },

  markerShadow: {
    position: 'absolute',
    bottom: -8,
    width: 15,
    height: 7,
    borderRadius: 10,
    backgroundColor:
      'rgba(0,0,0,0.22)',
  },

  mapInstruction: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor:
      'rgba(0,0,0,0.58)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  mapInstructionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    fontFamily:
      typography?.fontFamily?.medium ||
      'System',
  },

  mapLoadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor:
      'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mapLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 13,
    elevation: 3,
  },

  mapLoadingText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  selectedLocationCard: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 15,
    marginTop: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  selectedLocationIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  selectedLocationContent: {
    flex: 1,
  },

  selectedLocationLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  selectedLocationAddress: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  selectedLocationCoords: {
    fontSize: 8,
    marginTop: 2,
    fontFamily:
      typography?.fontFamily?.regular ||
      'System',
  },

  mapBottomActions: {
    flexDirection: 'row',
    gap: 9,
    paddingTop: 11,
  },

  mapCancelButton: {
    flex: 0.8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mapCancelText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },

  mapConfirmButton: {
    flex: 1.5,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor:
      GREEN_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    elevation: 3,

    shadowColor: GREEN,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },

  mapConfirmButtonDisabled: {
    backgroundColor: '#A7F3D0',
    elevation: 0,
    shadowOpacity: 0,
  },

  mapConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily:
      typography?.fontFamily?.bold ||
      'System',
  },
});

export default ProfileScreen;