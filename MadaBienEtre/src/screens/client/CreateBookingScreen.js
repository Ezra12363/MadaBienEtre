// src/screens/client/CreateBookingScreen.js

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import AddressMapPickerModal from '../../components/map/AddressMapPickerModal';
import useLocationTracking from '../../hooks/useLocationTracking';

import massageTypeService from '../../services/massageTypeService';
import { getMassageTypeIconIonicons } from '../../constants/massageTypeIcons';
import {
  getAddressSuggestions,
  getPlaceDetails,
  reverseGeocode,
} from '../../services/geocoding';
import { GOOGLE_MAPS_API_KEY } from '../../config/googleMaps';

/* ============================================================
   ✅ CARTE GOOGLE MAPS (aperçu statique)
   Fonctionne sur Web ET natif (c'est juste une image).
   ============================================================ */

const getStaticMapPreviewUrl = (latitude, longitude) => {
  if (!GOOGLE_MAPS_API_KEY || latitude == null || longitude == null) return null;

  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: '16',
    size: '640x260',
    scale: '2',
    maptype: 'roadmap',
    markers: `color:0x0D2B7E|${latitude},${longitude}`,
    key: GOOGLE_MAPS_API_KEY,
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
};

/* ============================================================
   ✅ GÉOLOCALISATION NAVIGATEUR (Web)
   Isolée dans une Promise pour transformer chaque cas d'erreur
   du navigateur en un message clair, affiché via le toast de
   l'app (jamais une popup native bloquante).
   ============================================================ */

const requestBrowserLocation = () =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ code: 'UNSUPPORTED' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

/* ============================================================
   ✅ IMAGE RÉELLE D'UN TYPE DE MASSAGE (avec repli sur icône)
   ============================================================ */

const TypeVisual = ({ imageUrl, iconName, size = 30, tintColor }) => {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <Ionicons name={iconName} size={size} color={tintColor} />
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={{
        width: size * 1.4,
        height: size * 1.4,
        borderRadius: (size * 1.4) / 4,
      }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
};

/* ============================================================
   CREATE BOOKING SCREEN
   ============================================================ */

const CreateBookingScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();

  /* ============================================================
     FORM STATES
     ============================================================ */

  const [selectedType, setSelectedType] = useState(null);
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');

  // Coordonnées liées à l'adresse choisie
  const [selectedCoords, setSelectedCoords] = useState(null);

  // Map modal
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapInitialCoordinate, setMapInitialCoordinate] = useState(null);

  /* ============================================================
     AUTOCOMPLETE ADRESSE
     ============================================================ */

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsTimer = useRef(null);
  const suggestionsRequestId = useRef(0);

  // Géolocalisation Web (navigateur)
  const [locatingWeb, setLocatingWeb] = useState(false);

  /* ============================================================
     TOAST STATES
     ============================================================ */

  const [toast, setToast] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;
  const toastTimer = useRef(null);

  /* ============================================================
     GPS TRACKING
     ============================================================ */

  const {
    location: liveLocation,
    isTracking: _isTracking,
    isLocating,
    errorMsg: trackingError,
    permissionGranted,
  } = useLocationTracking({ enabled: true });

  /* ============================================================
     ✅ MASSAGE TYPES RÉELS (PostgreSQL)
     ============================================================ */

  const [massageTypes, setMassageTypes] = useState([]);
  const [massageTypesLoading, setMassageTypesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadMassageTypes = async () => {
      try {
        setMassageTypesLoading(true);

        const data = await massageTypeService.getActiveMassageTypes();

        if (!isMounted) return;

        const mapped = data.map((item) => ({
          id: item.id,
          name: item.name,
          icon: getMassageTypeIconIonicons(item.category),
          category: item.category,
          imageUrl: massageTypeService.getMassageImageUrl(
            item.icon_url || item.image_url
          ),
        }));

        setMassageTypes(mapped);
      } catch (error) {
        console.error('❌ Erreur chargement types de massage:', error);
      } finally {
        if (isMounted) setMassageTypesLoading(false);
      }
    };

    loadMassageTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  /* ============================================================
     TOAST FUNCTION
     ============================================================ */

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: -20,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setToast({
          visible: false,
          title: '',
          message: '',
          type: 'info',
        });
      }
    });
  };

  const showToast = (
    message,
    type = 'info',
    duration = 2600,
    title = ''
  ) => {
    // Annule l'ancien timer
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }

    // Réinitialisation
    toastOpacity.stopAnimation();
    toastTranslateY.stopAnimation();

    toastOpacity.setValue(0);
    toastTranslateY.setValue(-20);

    setToast({
      visible: true,
      title,
      message,
      type,
    });

    // Entrée du toast
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(toastTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();

    // Disparition automatique
    toastTimer.current = setTimeout(() => {
      dismissToast();
    }, duration);
  };

  const handleCloseToast = () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    dismissToast();
  };

  /* ============================================================
     CLEANUP TOAST TIMER
     ============================================================ */

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
      if (suggestionsTimer.current) {
        clearTimeout(suggestionsTimer.current);
      }
    };
  }, []);

  /* ============================================================
     TOAST ICON
     ============================================================ */

  const getToastIcon = () => {
    switch (toast.type) {
      case 'success':
        return 'checkmark-circle';

      case 'error':
        return 'close-circle';

      case 'warning':
        return 'warning';

      case 'location':
        return 'location';

      case 'map':
        return 'map';

      default:
        return 'information-circle';
    }
  };

  /* ============================================================
     TOAST COLOR
     ============================================================ */

  const getToastColor = () => {
    switch (toast.type) {
      case 'success':
        return '#00C853';

      case 'error':
        return '#E53935';

      case 'warning':
        return '#F59E0B';

      case 'location':
        return '#1A4FB5';

      case 'map':
        return '#0D2B7E';

      default:
        return '#1A4FB5';
    }
  };

  /* ============================================================
     SELECT MASSAGE
     ============================================================ */

  const handleSelectMassage = (type) => {
    setSelectedType(type.id);

    showToast(
      `${type.name} sélectionné`,
      'success'
    );
  };

  /* ============================================================
     USE CURRENT LOCATION
     ============================================================ */

  const handleUseCurrentLocation = async () => {
    /* ----------------------------------------------------------
       WEB : géolocalisation directe du navigateur.
       Toute erreur (permission refusée, indisponible, timeout)
       est traduite en toast — jamais de popup navigateur brute.
       ---------------------------------------------------------- */
    if (Platform.OS === 'web') {
      if (locatingWeb) return;

      setLocatingWeb(true);
      showToast('Recherche de votre position...', 'location');

      try {
        const coords = await requestBrowserLocation();

        setSelectedCoords(coords);
        setMapInitialCoordinate(coords);

        // Remplit automatiquement le champ adresse avec le reverse geocoding
        try {
          const result = await reverseGeocode(coords.latitude, coords.longitude);
          if (result?.display_name) {
            setAddress(result.display_name);
          }
        } catch (geoErr) {
          console.warn('⚠️ Reverse geocoding échoué:', geoErr?.message);
        }

        showToast('Position actuelle utilisée avec succès', 'success');
      } catch (err) {
        const code = err?.code;

        if (code === 1 || code === 'PERMISSION_DENIED') {
          showToast(
            'Autorisez la géolocalisation dans votre navigateur puis réessayez.',
            'error',
            4000,
            'Position inaccessible'
          );
        } else if (code === 'UNSUPPORTED') {
          showToast(
            'Votre navigateur ne supporte pas la géolocalisation. Choisissez votre position sur la carte.',
            'error',
            4000,
            'Position inaccessible'
          );
        } else if (code === 3 || code === 'TIMEOUT') {
          showToast(
            'La recherche de votre position a pris trop de temps. Réessayez ou choisissez sur la carte.',
            'warning',
            4000,
            'Délai dépassé'
          );
        } else {
          showToast(
            'Impossible de récupérer votre position. Choisissez-la sur la carte.',
            'error',
            4000,
            'Position inaccessible'
          );
        }

        // On propose la carte en secours
        setMapInitialCoordinate(null);
        setShowMapPicker(true);
      } finally {
        setLocatingWeb(false);
      }

      return;
    }

    /* ----------------------------------------------------------
       NATIF (iOS / Android) : logique existante via le hook +
       la modale de sélection sur carte.
       ---------------------------------------------------------- */
    if (liveLocation) {
      setMapInitialCoordinate({
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
      });

      showToast(
        'Votre position actuelle est disponible',
        'location'
      );
    } else {
      setMapInitialCoordinate(null);

      showToast(
        isLocating
          ? 'Recherche de votre position...'
          : 'Ouverture de la carte...',
        'location'
      );
    }

    // Ouvre toujours la carte
    setShowMapPicker(true);

    // Si permission refusée
    if (permissionGranted === false) {
      showToast(
        'Autorisez la géolocalisation dans les réglages de votre appareil puis réessayez.',
        'error',
        4000,
        'Position inaccessible'
      );
    }
  };

  /* ============================================================
     OPEN MAP PICKER
     ============================================================ */

  const handleOpenMapPicker = () => {
    setMapInitialCoordinate(null);
    setShowMapPicker(true);

    showToast(
      'Choisissez votre position sur la carte',
      'map'
    );
  };

  /* ============================================================
     MAP CONFIRM
     ============================================================ */

  const handleMapConfirm = ({
    address: pickedAddress,
    latitude,
    longitude,
  }) => {
    setAddress(pickedAddress);

    setSelectedCoords({
      latitude,
      longitude,
    });

    setShowMapPicker(false);

    showToast(
      'Adresse et position confirmées',
      'success'
    );
  };

  /* ============================================================
     ADDRESS CHANGE
     ============================================================ */

  const fetchSuggestions = async (text) => {
    const requestId = ++suggestionsRequestId.current;
    setSuggestionsLoading(true);

    try {
      const results = await getAddressSuggestions(text);

      // Ignore une réponse arrivée en retard (l'utilisateur a retapé entre-temps)
      if (requestId !== suggestionsRequestId.current) return;

      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.warn('⚠️ Erreur suggestions adresse:', error.message);
    } finally {
      if (requestId === suggestionsRequestId.current) {
        setSuggestionsLoading(false);
      }
    }
  };

  const handleAddressChange = (text) => {
    setAddress(text);

    // Si l'utilisateur modifie manuellement
    // l'adresse, les anciennes coordonnées ne sont
    // plus considérées comme fiables.
    setSelectedCoords(null);

    if (suggestionsTimer.current) {
      clearTimeout(suggestionsTimer.current);
    }

    const trimmed = text.trim();

    if (trimmed.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce : évite un appel réseau à chaque frappe
    suggestionsTimer.current = setTimeout(() => {
      fetchSuggestions(trimmed);
    }, 400);
  };

  /* ============================================================
     SELECT SUGGESTION
     ============================================================ */

  const handleSelectSuggestion = async (item) => {
    setShowSuggestions(false);
    setAddress(item.description || item.main_text || address);
    Keyboard.dismiss?.();

    try {
      let coords = null;
      let finalAddress = item.description;

      if (item.source === 'google' && item.place_id) {
        const details = await getPlaceDetails(item.place_id);
        if (details) {
          coords = { latitude: details.latitude, longitude: details.longitude };
          finalAddress = details.display_name || item.description;
        }
      } else if (item.latitude != null && item.longitude != null) {
        coords = { latitude: item.latitude, longitude: item.longitude };
      }

      setAddress(finalAddress);

      if (coords) {
        setSelectedCoords(coords);
        setMapInitialCoordinate(coords);
        showToast('Adresse sélectionnée', 'success');
      } else {
        showToast(
          'Adresse enregistrée, mais position exacte introuvable. Ajustez-la sur la carte si besoin.',
          'warning',
          3500
        );
      }
    } catch (error) {
      console.warn('⚠️ Erreur sélection adresse:', error.message);
      showToast(
        'Impossible de localiser précisément cette adresse.',
        'error',
        3500,
        'Localisation imprécise'
      );
    }
  };

  /* ============================================================
     PRICE CHANGE
     ============================================================ */

  const handlePriceChange = (text) => {
    // Autorise uniquement les chiffres
    const numericValue = text.replace(/[^0-9]/g, '');

    setPrice(numericValue);
  };

  /* ============================================================
     SUBMIT BOOKING
     ============================================================ */

  const handleSubmit = () => {
    /* ----------------------------------------------------------
       VALIDATION TYPE
       ---------------------------------------------------------- */

    if (!selectedType) {
      showToast(
        'Veuillez sélectionner un type de massage',
        'error',
        3000
      );
      return;
    }

    /* ----------------------------------------------------------
       VALIDATION ADRESSE
       ---------------------------------------------------------- */

    if (!address.trim()) {
      showToast(
        'Veuillez entrer votre adresse',
        'error',
        3000
      );
      return;
    }

    /* ----------------------------------------------------------
       VALIDATION PRIX
       ---------------------------------------------------------- */

    if (!price.trim()) {
      showToast(
        'Veuillez proposer un prix',
        'error',
        3000
      );
      return;
    }

    /* ----------------------------------------------------------
       BOOKING DATA
       ---------------------------------------------------------- */

    const bookingData = {
      massageType: selectedType,
      address: address.trim(),
      proposedPrice: Number(price),
      latitude: selectedCoords?.latitude ?? null,
      longitude: selectedCoords?.longitude ?? null,
    };

    console.log('Booking data:', bookingData);

    /* ----------------------------------------------------------
       SUCCESS TOAST
       ---------------------------------------------------------- */

    showToast(
      'Votre demande a été envoyée aux thérapeutes',
      'success',
      3000
    );

    /* ----------------------------------------------------------
       NAVIGATION
       ---------------------------------------------------------- */

    setTimeout(() => {
      navigation.navigate('Réservations');
    }, 900);
  };

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: themeColors.background,
        },
      ]}
    >
      {/* ========================================================
          HEADER
      ======================================================== */}

      <Header
        title="Nouvelle réservation"
        showBack
      />

      {/* ========================================================
          TOAST
          Centre haut de l'écran
      ======================================================== */}

      {toast.visible && (
        <View
          pointerEvents="box-none"
          style={styles.toastWrapper}
        >
          <Animated.View
            style={[
              styles.toast,
              {
                opacity: toastOpacity,
                transform: [
                  {
                    translateY: toastTranslateY,
                  },
                ],
                borderColor: getToastColor(),
              },
            ]}
          >
            <View
              style={[
                styles.toastIconContainer,
                {
                  backgroundColor:
                    getToastColor() + '18',
                },
              ]}
            >
              <Ionicons
                name={getToastIcon()}
                size={20}
                color={getToastColor()}
              />
            </View>

            <View style={styles.toastTextWrapper}>
              {!!toast.title && (
                <Text
                  style={[
                    styles.toastTitle,
                    { color: themeColors.text },
                  ]}
                  numberOfLines={2}
                >
                  {toast.title}
                </Text>
              )}

              <Text
                style={[
                  styles.toastText,
                  {
                    color: toast.title
                      ? themeColors.textSecondary
                      : themeColors.text,
                  },
                ]}
                numberOfLines={3}
              >
                {toast.message}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleCloseToast}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.toastCloseButton}
            >
              <Ionicons
                name="close"
                size={16}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* ========================================================
          KEYBOARD
      ======================================================== */}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ====================================================
              TYPE DE MASSAGE
          ==================================================== */}

          <Text
            style={[
              styles.sectionTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            Type de massage
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typesContainer}
          >
            {massageTypesLoading && massageTypes.length === 0 && (
              <ActivityIndicator
                size="small"
                color={themeColors.primary}
              />
            )}

            {massageTypes.map((type) => {
              const isSelected =
                selectedType === type.id;

              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    {
                      backgroundColor:
                        themeColors.surface,
                    },
                    isSelected &&
                      styles.typeCardActive,
                  ]}
                  onPress={() =>
                    handleSelectMassage(type)
                  }
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.typeIconContainer,
                      isSelected && {
                        backgroundColor:
                          colors.primary + '14',
                      },
                    ]}
                  >
                    <TypeVisual
                      imageUrl={type.imageUrl}
                      iconName={type.icon}
                      size={30}
                      tintColor={
                        isSelected
                          ? colors.primary
                          : themeColors.textSecondary
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.typeName,
                      {
                        color: themeColors.text,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {type.name}
                  </Text>

                  {isSelected && (
                    <View
                      style={styles.selectedCheck}
                    >
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color="#fff"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ====================================================
              ADRESSE
          ==================================================== */}

          <Text
            style={[
              styles.sectionTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            Adresse
          </Text>

          <View style={styles.addressWrapper}>
            <View
              style={[
                styles.addressContainer,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <Ionicons
                name="location-outline"
                size={21}
                color={themeColors.textSecondary}
              />

              <TextInput
                style={[
                  styles.addressInput,
                  {
                    color: themeColors.text,
                  },
                ]}
                placeholder="Entrez votre adresse"
                placeholderTextColor={
                  themeColors.textSecondary
                }
                value={address}
                onChangeText={handleAddressChange}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  // Laisse le temps au onPress de la suggestion
                  // de se déclencher avant de fermer le dropdown.
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                multiline
              />

              {suggestionsLoading && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </View>

            {/* SUGGESTIONS D'ADRESSE */}

            {showSuggestions && suggestions.length > 0 && (
              <View
                style={[
                  styles.suggestionsDropdown,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border ?? '#E5E7EB',
                  },
                ]}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  style={styles.suggestionsScroll}
                  nestedScrollEnabled
                >
                  {suggestions.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.suggestionItem}
                      activeOpacity={0.7}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color={colors.primary}
                      />

                      <View style={styles.suggestionTextWrapper}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.suggestionMainText,
                            { color: themeColors.text },
                          ]}
                        >
                          {item.main_text}
                        </Text>

                        {!!item.secondary_text && (
                          <Text
                            numberOfLines={1}
                            style={styles.suggestionSecondaryText}
                          >
                            {item.secondary_text}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* ====================================================
              ACTIONS ADRESSE
          ==================================================== */}

          <View
            style={styles.addressActionsRow}
          >
            {/* GPS */}

            <TouchableOpacity
              style={[
                styles.addressActionButton,
                {
                  backgroundColor:
                    colors.primary + '12',
                },
              ]}
              onPress={
                handleUseCurrentLocation
              }
              activeOpacity={0.8}
            >
              {(locatingWeb || (isLocating && !liveLocation)) ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />
              ) : (
                <Ionicons
                  name="locate"
                  size={18}
                  color={colors.primary}
                />
              )}

              <Text
                style={[
                  styles.addressActionText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                Utiliser ma position actuelle
              </Text>
            </TouchableOpacity>

            {/* MAP */}

            <TouchableOpacity
              style={[
                styles.addressActionButton,
                {
                  backgroundColor:
                    themeColors.surface,
                  borderWidth: 1,
                  borderColor:
                    themeColors.border ??
                    '#E5E7EB',
                },
              ]}
              onPress={
                handleOpenMapPicker
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="map-outline"
                size={18}
                color={themeColors.text}
              />

              <Text
                style={[
                  styles.addressActionText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Choisir sur la carte
              </Text>
            </TouchableOpacity>
          </View>

          {/* ====================================================
              TRACKING ERROR
          ==================================================== */}

          {!liveLocation &&
            trackingError && (
              <View
                style={styles.errorInfo}
              >
                <Ionicons
                  name="warning-outline"
                  size={15}
                  color="#EF4444"
                />

                <Text
                  style={styles.trackingErrorText}
                >
                  {trackingError}
                </Text>
              </View>
            )}

          {/* ====================================================
              COORDINATES CONFIRMATION
          ==================================================== */}

          {selectedCoords && (
            <View
              style={[
                styles.coordsConfirm,
                {
                  backgroundColor:
                    colors.primary + '0A',
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={17}
                color={colors.primary}
              />

              <View style={styles.coordsTextWrapper}>
                <Text
                  style={[
                    styles.coordsConfirmTitle,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  Position confirmée
                </Text>

                <Text
                  style={styles.coordsConfirmText}
                >
                  {selectedCoords.latitude.toFixed(
                    5
                  )}
                  {'  •  '}
                  {selectedCoords.longitude.toFixed(
                    5
                  )}
                </Text>
              </View>
            </View>
          )}

          {/* ====================================================
              APERÇU CARTE GOOGLE MAPS
          ==================================================== */}

          {selectedCoords && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleOpenMapPicker}
              style={styles.mapPreviewContainer}
            >
              {getStaticMapPreviewUrl(
                selectedCoords.latitude,
                selectedCoords.longitude
              ) ? (
                <Image
                  source={{
                    uri: getStaticMapPreviewUrl(
                      selectedCoords.latitude,
                      selectedCoords.longitude
                    ),
                  }}
                  style={styles.mapPreviewImage}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.mapPreviewPlaceholder,
                    { backgroundColor: themeColors.surface },
                  ]}
                >
                  <Ionicons
                    name="map-outline"
                    size={22}
                    color={themeColors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.mapPreviewPlaceholderText,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    Clé Google Maps manquante — aperçu indisponible
                  </Text>
                </View>
              )}

              <View style={styles.mapPreviewOverlay}>
                <Ionicons name="expand-outline" size={13} color="#fff" />
                <Text style={styles.mapPreviewOverlayText}>
                  Modifier sur la carte
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ====================================================
              PRIX
          ==================================================== */}

          <Text
            style={[
              styles.sectionTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            Prix proposé
          </Text>

          <View
            style={[
              styles.priceContainer,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <Text style={styles.currency}>
              Ar
            </Text>

            <TextInput
              style={[
                styles.priceInput,
                {
                  color: themeColors.text,
                },
              ]}
              placeholder="Prix proposé"
              placeholderTextColor={
                themeColors.textSecondary
              }
              value={price}
              onChangeText={
                handlePriceChange
              }
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          {/* ====================================================
              SUBMIT
          ==================================================== */}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            activeOpacity={0.85}
          >
            <Ionicons
              name="paper-plane-outline"
              size={19}
              color="#fff"
            />

            <Text
              style={styles.submitButtonText}
            >
              Soumettre ma demande
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ========================================================
          MAP MODAL
      ======================================================== */}

      <AddressMapPickerModal
        visible={showMapPicker}
        onClose={() => {
          setShowMapPicker(false);

          showToast(
            'Sélection de position annulée',
            'info'
          );
        }}
        onConfirm={handleMapConfirm}
        initialCoordinate={
          mapInitialCoordinate
        }
      />
    </SafeAreaView>
  );
};

/* ==============================================================
   STYLES
   ============================================================== */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    padding: spacing.md,
    paddingBottom: 110,
  },

  /* ============================================================
     TOAST
  ============================================================ */

  toastWrapper: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 18 : 12,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  toast: {
    minHeight: 54,
    maxWidth: 440,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',

    // Ombre Android
    elevation: 12,

    // Ombre iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.16,
    shadowRadius: 14,

    // Ombre Web
    ...(Platform.OS === 'web'
      ? {
          boxShadow:
            '0px 6px 22px rgba(0,0,0,0.15)',
        }
      : {}),
  },

  toastIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  toastTextWrapper: {
    flex: 1,
  },

  toastTitle: {
    fontSize: 13.5,
    lineHeight: 17,
    marginBottom: 2,
    fontFamily: typography.fontFamily.bold,
  },

  toastText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: typography.fontFamily.medium,
  },

  toastCloseButton: {
    marginLeft: 8,
    padding: 2,
  },

  /* ============================================================
     SECTION
  ============================================================ */

  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontFamily:
      typography.fontFamily.semiBold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  /* ============================================================
     MASSAGE TYPES
  ============================================================ */

  typesContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },

  typeCard: {
    width: 108,
    minHeight: 116,
    padding: spacing.sm,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },

  typeCardActive: {
    borderColor: colors.primary,
  },

  typeIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  typeName: {
    fontSize: typography.fontSize.sm,
    fontFamily:
      typography.fontFamily.medium,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  selectedCheck: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ============================================================
     ADDRESS
  ============================================================ */

  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: 14,
    gap: spacing.sm,
  },

  addressInput: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontFamily:
      typography.fontFamily.regular,
    padding: 0,
    minHeight: 42,
    textAlignVertical: 'top',
  },

  /* ============================================================
     ADDRESS AUTOCOMPLETE
  ============================================================ */

  addressWrapper: {
    position: 'relative',
    zIndex: 20,
  },

  suggestionsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 30,
  },

  suggestionsScroll: {
    maxHeight: 240,
  },

  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
  },

  suggestionTextWrapper: {
    flex: 1,
  },

  suggestionMainText: {
    fontSize: 12.5,
    fontFamily: typography.fontFamily.semiBold,
  },

  suggestionSecondaryText: {
    fontSize: 10.5,
    color: '#9AA3AF',
    marginTop: 1,
    fontFamily: typography.fontFamily.regular,
  },

  /* ============================================================
     MAP PREVIEW
  ============================================================ */

  mapPreviewContainer: {
    marginTop: spacing.sm,
    borderRadius: 16,
    overflow: 'hidden',
    height: 150,
    position: 'relative',
  },

  mapPreviewImage: {
    width: '100%',
    height: '100%',
  },

  mapPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
  },

  mapPreviewPlaceholderText: {
    fontSize: 11,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },

  mapPreviewOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(13,43,126,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  mapPreviewOverlayText: {
    color: '#fff',
    fontSize: 10.5,
    fontFamily: typography.fontFamily.semiBold,
  },

  /* ============================================================
     ADDRESS ACTIONS
  ============================================================ */

  addressActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  addressActionButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },

  addressActionText: {
    fontSize: 12,
    fontFamily:
      typography.fontFamily.medium,
    textAlign: 'center',
  },

  /* ============================================================
     ERROR
  ============================================================ */

  errorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: 4,
  },

  trackingErrorText: {
    flex: 1,
    fontSize: 11,
    color: '#EF4444',
    fontFamily:
      typography.fontFamily.regular,
  },

  /* ============================================================
     COORDINATES
  ============================================================ */

  coordsConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: spacing.sm,
    padding: 10,
    borderRadius: 12,
  },

  coordsTextWrapper: {
    flex: 1,
  },

  coordsConfirmTitle: {
    fontSize: 12,
    fontFamily:
      typography.fontFamily.semiBold,
    marginBottom: 2,
  },

  coordsConfirmText: {
    fontSize: 10,
    color: colors.primary,
    fontFamily:
      typography.fontFamily.regular,
  },

  /* ============================================================
     PRICE
  ============================================================ */

  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 14,
  },

  currency: {
    fontSize: typography.fontSize.lg,
    fontFamily:
      typography.fontFamily.bold,
    color: colors.primary,
    marginRight: spacing.sm,
  },

  priceInput: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontFamily:
      typography.fontFamily.bold,
    padding: 0,
  },

  /* ============================================================
     SUBMIT BUTTON
  ============================================================ */

  submitButton: {
    backgroundColor: colors.primary,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xl,

    elevation: 5,

    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },

  submitButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily:
      typography.fontFamily.semiBold,
  },
});

export default CreateBookingScreen;