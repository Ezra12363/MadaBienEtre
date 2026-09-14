// src/screens/client/BookingScreen.js

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
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Keyboard,
  Animated,
  InteractionManager,
  findNodeHandle,
  Easing,
  Image,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import DateTimePicker from '@react-native-community/datetimepicker';

import MapViewWrapper from '../../components/map/MapViewWrapper';
import {
  getAddressFromCoords,
  getAddressSuggestions,
  getPlaceDetails,
} from '../../services/geocoding';
import { DEFAULT_REGION } from '../../config/googleMaps';

import * as Location from 'expo-location';

import massageTypeService from '../../services/massageTypeService';
import { getMassageTypeIconMCI } from '../../constants/massageTypeIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// ✅ FIXÉ : la création de réservation utilisait un faux setTimeout()
// qui ne contactait jamais le backend. On branche maintenant sur le
// vrai contexte de réservation (POST /bookings côté API).
import { useBooking } from '../../context/BookingContext';

const { width } = Dimensions.get('window');

const IS_WEB = Platform.OS === 'web';

// ✅ Thème harmonisé avec HomeScreen.js (même vert PRIMARY partout)
const PRIMARY = colors.primary || '#168A55';
const PRIMARY_DARK = '#0B633C';

// Alias conservés pour ne pas casser les usages existants dans ce
// fichier (carte, marqueurs...) — pointent maintenant vers le thème.
const MAP_GREEN = PRIMARY;
const MAP_GREEN_DARK = PRIMARY_DARK;

const EMPTY_MASSAGE_TYPES = [];

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

// ============================================================
// DATE HELPERS
// ============================================================

const startOfLocalDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatLocalDate = (date) => {
  if (!date) return '';

  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value) => {
  if (!value) return new Date();

  const parts = value.split('-').map(Number);

  if (parts.length !== 3) {
    return new Date();
  }

  const [year, month, day] = parts;

  return new Date(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    0
  );
};

const formatDateToTime = (date) => {
  if (!date) return '09:00';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

const parseTimeToDate = (value) => {
  if (!value) {
    const d = new Date();

    d.setHours(9, 0, 0, 0);

    return d;
  }

  const [hours, minutes] = value.split(':').map(Number);

  const d = new Date();

  d.setHours(
    Number.isFinite(hours) ? hours : 9,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );

  return d;
};

const formatDate = (date) => {
  if (!date) return '';

  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatTime = (date) => {
  if (!date) return '';

  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================================
// WEB DATE INPUT
// ============================================================

const WebDateInput = ({
  value,
  min,
  onChange,
  themeColors,
}) => {
  if (!IS_WEB) return null;

  return (
    <View
      style={[
        styles.webInputWrapper,
        {
          backgroundColor: themeColors.surface,
          borderColor:
            themeColors.border || '#E0E0E0',
        },
      ]}
    >
      <Ionicons
        name="calendar-outline"
        size={20}
        color={colors.primary}
      />

      <input
        type="date"
        value={value}
        min={min}
        onChange={(event) => {
          const nextValue = event.target.value;

          if (nextValue) {
            onChange(nextValue);
          }
        }}
        style={{
          flex: 1,
          width: '100%',
          height: 46,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: themeColors.text,
          fontSize: 15,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      />
    </View>
  );
};

// ============================================================
// WEB TIME INPUT
// ============================================================

const WebTimeInput = ({
  value,
  onChange,
  themeColors,
}) => {
  if (!IS_WEB) return null;

  return (
    <View
      style={[
        styles.webInputWrapper,
        {
          backgroundColor: themeColors.surface,
          borderColor:
            themeColors.border || '#E0E0E0',
        },
      ]}
    >
      <Ionicons
        name="time-outline"
        size={20}
        color={colors.primary}
      />

      <input
        type="time"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;

          if (nextValue) {
            onChange(nextValue);
          }
        }}
        style={{
          flex: 1,
          width: '100%',
          height: 46,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: themeColors.text,
          fontSize: 15,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      />
    </View>
  );
};

// ============================================================
// IMAGE TYPE MASSAGE
// ✅ IMAGE PLUS GRANDE
// ============================================================

const TypeCardVisual = ({
  imageUrl,
  iconName,
  size = 64,
  tintColor,
}) => {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <MaterialCommunityIcons
        name={iconName || 'spa'}
        size={size * 0.68}
        color={tintColor}
      />
    );
  }

  // ✅ L'image remplit maintenant tout le badge (100% x 100%) au
  // lieu d'être une vignette arrondie plus petite flottant au
  // centre d'un badge rond : le conteneur parent ("typeIcon")
  // fait désormais lui-même office de masque (overflow: hidden),
  // donc l'image est toujours nette, bien cadrée et sans bord
  // visible de la couleur de fond derrière elle.
  return (
    <Image
      source={{ uri: imageUrl }}
      style={{
        width: '100%',
        height: '100%',
      }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
};

// ============================================================
// COMPONENT
// ============================================================

const BookingScreen = ({
  navigation,
  route,
}) => {
  const { therapist } = route.params || {};

  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const {
    token,
    user,
  } = useAuth();

  // ✅ NOUVEAU : createBooking envoie réellement la demande à l'API
  const { createBooking } = useBooking();

  // ============================================================
  // FORM STATES
  // ============================================================

  const [selectedType, setSelectedType] =
    useState(null);

  const [selectedDuration, setSelectedDuration] =
    useState(60);

  const [selectedDate, setSelectedDate] =
    useState(new Date());

  const [selectedTime, setSelectedTime] =
    useState(() => {
      const d = new Date();

      d.setHours(9, 0, 0, 0);

      return d;
    });

  const [address, setAddress] = useState('');

  const [priceProposed, setPriceProposed] =
    useState('');

  const [preferredGender, setPreferredGender] =
    useState('any');

  // ✅ NOUVEAU : instructions spéciales (champ optionnel supporté par
  // le backend — schemas/booking.py::BookingCreate.special_instructions)
  const [specialInstructions, setSpecialInstructions] =
    useState('');

  const [isLoading, setIsLoading] =
    useState(false);

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [showTimePicker, setShowTimePicker] =
    useState(false);

  // ✅ États de focus pour un rendu "premium" : le cadre de
  // l'input se met en évidence (bordure + ombre colorée) pendant
  // la saisie, comme sur les interfaces de paiement/réservation
  // internationales (Stripe, Airbnb, etc.).
  const [isPriceFocused, setIsPriceFocused] =
    useState(false);

  const [isInstructionsFocused, setIsInstructionsFocused] =
    useState(false);

  // ============================================================
  // MASSAGE TYPES
  // ============================================================

  const [massageTypes, setMassageTypes] =
    useState(EMPTY_MASSAGE_TYPES);

  const [massageTypesLoading, setMassageTypesLoading] =
    useState(true);

  // ============================================================
  // ✅ REF CAROUSEL TYPE MASSAGE
  // ============================================================

  const massageCarouselRef = useRef(null);

  // largeur approximative d'une carte + marge
  const MASSAGE_CARD_STEP = 185;

  const scrollMassageTypes = (direction) => {
    if (!IS_WEB) return;

    const offset =
      direction === 'right'
        ? MASSAGE_CARD_STEP
        : -MASSAGE_CARD_STEP;

    massageCarouselRef.current?.scrollTo({
      x: Math.max(0, offset),
      animated: true,
    });

    // Correction : utiliser scrollToOffset-like behavior
    // avec position mémorisée.
    setTimeout(() => {
      massageCarouselRef.current?.getScrollableNode?.();
    }, 0);
  };

  // position actuelle du carousel
  const massageScrollX = useRef(0);

  const handleMassageScroll = (event) => {
    massageScrollX.current =
      event.nativeEvent.contentOffset.x;
  };

  const handleMassageCarouselLeft = () => {
    if (!IS_WEB) return;

    const current =
      massageScrollX.current || 0;

    const next = Math.max(
      0,
      current - MASSAGE_CARD_STEP
    );

    massageScrollX.current = next;

    massageCarouselRef.current?.scrollTo({
      x: next,
      animated: true,
    });
  };

  const handleMassageCarouselRight = () => {
    if (!IS_WEB) return;

    const current =
      massageScrollX.current || 0;

    const next =
      current + MASSAGE_CARD_STEP;

    massageScrollX.current = next;

    massageCarouselRef.current?.scrollTo({
      x: next,
      animated: true,
    });
  };

  // ============================================================
  // LOAD MASSAGE TYPES
  // ============================================================

  useEffect(() => {
    let isMounted = true;

    const loadMassageTypes = async () => {
      try {
        setMassageTypesLoading(true);

        const data =
          await massageTypeService.getActiveMassageTypes();

        if (!isMounted) return;

        const mapped = data.map((item) => ({
          id: item.id,
          name: item.name,
          duration: item.duration_min ?? 60,
          price:
            item.recommended_price ??
            item.min_price ??
            0,
          category: item.category,
          icon: getMassageTypeIconMCI(
            item.category
          ),
          imageUrl:
            massageTypeService.getMassageImageUrl(
              item.icon_url ||
                item.image_url
            ),
        }));

        setMassageTypes(mapped);
      } catch (error) {
        console.error(
          '❌ Erreur chargement types de massage:',
          error
        );
      } finally {
        if (isMounted) {
          setMassageTypesLoading(false);
        }
      }
    };

    loadMassageTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  // ============================================================
  // MAP STATES
  // ============================================================

  const [showMapModal, setShowMapModal] =
    useState(false);

  const [selectedLocation, setSelectedLocation] =
    useState({
      latitude: null,
      longitude: null,
      address: '',
    });

  const [mapRegion, setMapRegion] =
    useState(DEFAULT_REGION);

  const [isSearchingLocation, setIsSearchingLocation] =
    useState(false);

  const [isLoadingAddress, setIsLoadingAddress] =
    useState(false);

  // ============================================================
  // MAP SEARCH BAR (Lot / adresse / ville — dynamique)
  // ============================================================

  const [mapSearchQuery, setMapSearchQuery] =
    useState('');

  const [mapSearchSuggestions, setMapSearchSuggestions] =
    useState([]);

  const [showMapSearchSuggestions, setShowMapSearchSuggestions] =
    useState(false);

  const [mapSearchLoading, setMapSearchLoading] =
    useState(false);

  const [mapSearchResolving, setMapSearchResolving] =
    useState(false);

  const mapSearchTimerRef = useRef(null);
  const mapSearchRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (mapSearchTimerRef.current) {
        clearTimeout(mapSearchTimerRef.current);
      }
    };
  }, []);

  // ============================================================
  // TOAST
  // ============================================================

  const [toast, setToast] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const toastTranslateY =
    useRef(new Animated.Value(-100)).current;

  const toastOpacity =
    useRef(new Animated.Value(0)).current;

  const toastTimerRef =
    useRef(null);

  const hideToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    Animated.parallel([
      Animated.timing(
        toastTranslateY,
        {
          toValue: -100,
          duration: 220,
          easing: Easing.out(
            Easing.cubic
          ),
          useNativeDriver: true,
        }
      ),
      Animated.timing(
        toastOpacity,
        {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }
      ),
    ]).start(() => {
      setToast((prev) => ({
        ...prev,
        visible: false,
      }));
    });
  };

  const showToast = (
    type = 'info',
    title = '',
    message = '',
    duration = 2800
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

    toastTranslateY.setValue(-100);
    toastOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(
        toastTranslateY,
        {
          toValue: 0,
          damping: 16,
          stiffness: 180,
          mass: 0.8,
          useNativeDriver: true,
        }
      ),
      Animated.timing(
        toastOpacity,
        {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }
      ),
    ]).start();

    toastTimerRef.current =
      setTimeout(() => {
        hideToast();
      }, duration);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(
          toastTimerRef.current
        );
      }
    };
  }, []);

  // ============================================================
  // TOAST CONFIG
  // ============================================================

  const getToastConfig = () => {
    // ✅ Palette alignée sur HomeScreen.js.
    switch (toast.type) {
      case 'success':
        return {
          icon: 'checkmark-circle',
          color: '#00A86B',
          background: isDark
            ? '#14271D'
            : '#FFFFFF',
        };

      case 'error':
        return {
          icon: 'close-circle',
          color: '#D9363E',
          background: isDark
            ? '#2B1717'
            : '#FFFFFF',
        };

      case 'warning':
        return {
          icon: 'warning',
          color: '#E89B22',
          background: isDark
            ? '#2B2416'
            : '#FFFFFF',
        };

      default:
        return {
          icon: 'information-circle',
          color: '#2584D8',
          background: isDark
            ? '#171F32'
            : '#FFFFFF',
        };
    }
  };

  // ============================================================
  // REFS
  // ============================================================

  const scrollViewRef = useRef(null);

  const addressInputRef = useRef(null);

  const priceInputRef = useRef(null);

  // Ref dédié au champ multiline "Instructions spéciales".
  // Il permet de demander au ScrollView Android de faire remonter
  // exactement ce champ au-dessus du clavier.
  const instructionsInputRef = useRef(null);

  const mapRef = useRef(null);

  // ============================================================
  // DERIVED
  // ============================================================

  const displayDate = useMemo(
    () => formatDate(selectedDate),
    [selectedDate]
  );

  const displayTime = useMemo(
    () => formatTime(selectedTime),
    [selectedTime]
  );

  const webDateValue = useMemo(
    () => formatLocalDate(selectedDate),
    [selectedDate]
  );

  const webTimeValue = useMemo(
    () => formatDateToTime(selectedTime),
    [selectedTime]
  );

  // ============================================================
  // KEYBOARD ANDROID — GESTION DU CHAMP ACTIF
  // ============================================================
  // IMPORTANT :
  // Aucun setState n'est effectué au focus. Cela évite un rerender
  // qui peut faire perdre le focus du TextInput Android.

  const scrollInputIntoView = (inputRef, extraOffset = 100) => {
    if (IS_WEB || !inputRef?.current) return;

    const node = findNodeHandle(inputRef.current);
    if (!node) return;

    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        try {
          scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
            node,
            extraOffset,
            true
          );
        } catch (error) {
          console.log('Keyboard scroll:', error?.message);
        }
      });
    });
  };

  const handlePriceFocus = () => {
    if (IS_WEB) return;
    setTimeout(() => {
      scrollInputIntoView(priceInputRef, 110);
    }, 250);
  };

  const handleInstructionsFocus = () => {
    if (IS_WEB) return;
    setTimeout(() => {
      scrollInputIntoView(instructionsInputRef, 140);
    }, 250);
  };

  // ============================================================
  // BASE PRICE
  // ============================================================

  // ============================================================

  const getBasePrice = () => {
    const type = massageTypes.find(
      (item) => item.id === selectedType
    );

    return type?.price || 35000;
  };

  // ============================================================
  // MAP ADDRESS
  // ============================================================

  const updateLocation = async (
    latitude,
    longitude
  ) => {
    setIsLoadingAddress(true);

    try {
      const addressResult =
        await getAddressFromCoords(
          latitude,
          longitude
        );

      const fullAddress =
        addressResult ||
        `${latitude.toFixed(
          6
        )}, ${longitude.toFixed(6)}`;

      setSelectedLocation({
        latitude,
        longitude,
        address: fullAddress,
      });

      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      });

      showToast(
        'success',
        'Position trouvée',
        'Votre position a été détectée avec succès.'
      );
    } catch (error) {
      console.log(
        '❌ Reverse geocoding error:',
        error
      );

      setSelectedLocation({
        latitude,
        longitude,
        address: `${latitude.toFixed(
          6
        )}, ${longitude.toFixed(6)}`,
      });

      showToast(
        'warning',
        'Position détectée',
        "L'adresse exacte n'a pas pu être récupérée."
      );
    } finally {
      setIsLoadingAddress(false);
    }
  };

  // ============================================================
  // CURRENT LOCATION
  // ============================================================

  const handleUseCurrentLocation = async () => {
    if (isSearchingLocation) return;

    setIsSearchingLocation(true);

    showToast(
      'info',
      'Localisation',
      'Recherche de votre position...'
    );

    try {
      if (IS_WEB) {
        if (!navigator.geolocation) {
          showToast(
            'error',
            'Géolocalisation indisponible',
            "Votre navigateur ne prend pas en charge la géolocalisation. Choisissez votre position sur la carte."
          );

          // On ouvre quand même la carte (région par défaut) pour que
          // l'utilisateur puisse choisir sa position manuellement.
          setMapRegion(DEFAULT_REGION);
          setShowMapModal(true);
          setIsSearchingLocation(false);

          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const {
              latitude,
              longitude,
            } = position.coords;

            await updateLocation(
              latitude,
              longitude
            );

            setShowMapModal(true);
            setIsSearchingLocation(false);
          },
          (error) => {
            console.log(
              'Geolocation error:',
              error
            );

            const isPermissionDenied =
              error?.code === 1;

            showToast(
              'error',
              'Position inaccessible',
              isPermissionDenied
                ? "Autorisez la géolocalisation dans votre navigateur puis réessayez, ou choisissez votre position sur la carte."
                : "Impossible de récupérer votre position. Choisissez-la sur la carte."
            );

            // ✅ FIXÉ : on n'abandonne plus l'utilisateur sur le seul
            // toast d'erreur — on ouvre la carte (région par défaut)
            // pour qu'il puisse sélectionner sa position manuellement.
            setMapRegion(DEFAULT_REGION);
            setShowMapModal(true);
            setIsSearchingLocation(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }
        );

        return;
      }

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        showToast(
          'error',
          'Permission refusée',
          "Veuillez autoriser l'accès à votre localisation dans les réglages de l'appareil, ou choisissez votre position sur la carte."
        );

        // ✅ On ouvre quand même la carte (région par défaut) pour que
        // l'utilisateur puisse sélectionner sa position manuellement.
        setMapRegion(DEFAULT_REGION);
        setShowMapModal(true);

        return;
      }

      const location =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const {
        latitude,
        longitude,
      } = location.coords;

      await updateLocation(
        latitude,
        longitude
      );

      setShowMapModal(true);
    } catch (error) {
      console.error(
        '❌ Current location:',
        error
      );

      showToast(
        'error',
        'Erreur de localisation',
        "Impossible d'obtenir votre position. Choisissez-la sur la carte."
      );

      // ✅ FIXÉ : même en cas d'échec, on ouvre la carte pour laisser
      // l'utilisateur choisir sa position manuellement.
      setMapRegion(DEFAULT_REGION);
      setShowMapModal(true);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // ============================================================
  // MAP PRESS
  // ============================================================

  const handleMapPress = async (
    coordinate
  ) => {
    if (!coordinate) return;

    const latitude =
      Number(coordinate.latitude);

    const longitude =
      Number(coordinate.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      showToast(
        'error',
        'Position invalide',
        'Impossible de sélectionner cette position.'
      );

      return;
    }

    await updateLocation(
      latitude,
      longitude
    );
  };

  // ============================================================
  // VALIDATE LOCATION
  // ============================================================

  const validateLocation = () => {
    const {
      latitude,
      longitude,
      address: selectedAddress,
    } = selectedLocation;

    if (
      latitude === null ||
      longitude === null
    ) {
      showToast(
        'warning',
        'Position manquante',
        'Veuillez sélectionner une position sur la carte.'
      );

      return;
    }

    setAddress(
      selectedAddress ||
        `${latitude.toFixed(
          6
        )}, ${longitude.toFixed(6)}`
    );

    setShowMapModal(false);

    showToast(
      'success',
      'Adresse sélectionnée',
      'La position du massage a été enregistrée.'
    );
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  // ✅ FIXÉ (BUG MAJEUR) : cette fonction se contentait d'un
  // `setTimeout()` et affichait un faux message de succès — AUCUNE
  // requête n'était jamais envoyée au backend. La réservation
  // n'existait donc jamais réellement en base, et aucun thérapeute
  // n'était notifié.
  //
  // Elle appelle maintenant `createBooking()` du BookingContext, qui
  // envoie un vrai POST /bookings (voir app/api/bookings.py côté
  // backend), avec toutes les validations nécessaires avant l'envoi :
  // type de massage, adresse, POSITION (latitude/longitude — sans
  // elles le backend ne peut notifier aucun thérapeute à proximité),
  // prix minimum, et date/heure dans le futur.
  const handleViewRequests = () => {
    navigation.navigate('History');
  };

  // ✅ NOUVEAU : réinitialise entièrement le formulaire de création de
  // demande. Appelée automatiquement une fois la demande envoyée et
  // enregistrée avec succès, pour que l'écran soit "propre" si le
  // client revient créer une nouvelle demande.
  const resetForm = () => {
    setSelectedType(null);
    setSelectedDuration(60);
    setSelectedDate(new Date());
    setSelectedTime(() => {
      const d = new Date();
      d.setHours(9, 0, 0, 0);
      return d;
    });
    setAddress('');
    setPriceProposed('');
    setPreferredGender('any');
    setSpecialInstructions('');
    setSelectedLocation({
      latitude: null,
      longitude: null,
      address: '',
    });
    setMapRegion(DEFAULT_REGION);
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      showToast(
        'warning',
        'Type de massage requis',
        'Veuillez sélectionner un type de massage.'
      );

      return;
    }

    if (!address.trim()) {
      showToast(
        'warning',
        'Adresse requise',
        'Veuillez entrer ou sélectionner votre adresse.'
      );

      return;
    }

    // ✅ FIXÉ : sans coordonnées GPS valides, le backend ne peut pas
    // calculer les thérapeutes à proximité (ST_DWithin) — la demande
    // partirait "dans le vide". On bloque donc l'envoi tant que la
    // position n'a pas été choisie sur la carte / via le GPS.
    const latitude = Number(selectedLocation.latitude);
    const longitude = Number(selectedLocation.longitude);

    if (
      selectedLocation.latitude == null ||
      selectedLocation.longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      showToast(
        'warning',
        'Position requise',
        'Veuillez sélectionner votre position sur la carte (bouton "Utiliser ma position actuelle" ou appui sur la carte).'
      );

      return;
    }

    const priceValue = parseInt(priceProposed, 10);

    if (
      !priceProposed ||
      Number.isNaN(priceValue) ||
      priceValue < 20000
    ) {
      showToast(
        'warning',
        'Prix invalide',
        'Le prix proposé doit être au minimum de 20 000 Ar.'
      );

      return;
    }

    // ✅ Combine la date et l'heure choisies en un seul datetime, et
    // vérifie qu'il est bien dans le futur (exigé par le backend :
    // "Scheduled date must be in the future").
    const scheduledDateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0,
      0
    );

    if (scheduledDateTime.getTime() <= Date.now()) {
      showToast(
        'warning',
        'Date invalide',
        "La date et l'heure du massage doivent être dans le futur."
      );

      return;
    }

    setIsLoading(true);

    showToast(
      'info',
      'Envoi en cours',
      'Votre demande est en train d’être envoyée...',
      4000
    );

    try {
      // ✅ FIXÉ (BUG DU 422 "massage_type_id: Field required") :
      // `selectedType` contient déjà directement l'ID du massage
      // (voir `setSelectedType(type.id)` dans le onPress de la
      // carte, et `getBasePrice()` qui compare `item.id ===
      // selectedType`). Ce n'est PAS un objet massage complet — donc
      // `selectedType.id` valait `undefined`, ce qui envoyait
      // `massage_type_id: undefined` au backend (silencieusement
      // supprimé par axios/JSON.stringify), d'où le 422 "Field
      // required". On envoie maintenant directement l'ID.
      //
      // Payload conforme à schemas/booking.py::BookingCreate
      const payload = {
        massage_type_id: selectedType,
        duration_minutes: selectedDuration,
        preferred_gender: preferredGender || 'any',
        address: address.trim(),
        latitude,
        longitude,
        scheduled_date: scheduledDateTime.toISOString(),
        client_price_proposed: priceValue,
        special_instructions:
          specialInstructions.trim() || null,
      };

      const result = await createBooking(payload);

      if (!result?.success) {
        showToast(
          'error',
          'Erreur',
          result?.error ||
            'Impossible de créer la réservation. Veuillez réessayer.'
        );

        return;
      }

      showToast(
        'success',
        'Demande envoyée',
        'Votre demande a été envoyée aux thérapeutes à proximité.',
        4000
      );

      // ✅ NOUVEAU : une fois la demande bien enregistrée côté backend,
      // on vide automatiquement tout le formulaire (type, durée, date,
      // heure, adresse, position, prix, instructions...) pour que la
      // prochaine demande reparte sur un écran neuf.
      resetForm();

      setTimeout(() => {
        navigation.navigate(
          'Réservations'
        );
      }, 1500);
    } catch (error) {
      console.error(
        'Submit error:',
        error
      );

      showToast(
        'error',
        'Erreur',
        error?.message ||
          'Une erreur est survenue lors de l’envoi de votre demande.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!showMapModal) {
      handleClearMapSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMapModal]);

  // ============================================================
  // MAP SEARCH BAR — recherche dynamique (Lot / adresse / ville)
  // ============================================================

  const fetchMapSearchSuggestions = async (text) => {
    const requestId = ++mapSearchRequestIdRef.current;
    setMapSearchLoading(true);

    try {
      const results = await getAddressSuggestions(text);

      // Ignore une réponse arrivée en retard (l'utilisateur a retapé
      // entre-temps) — évite qu'une vieille recherche écrase une plus
      // récente.
      if (requestId !== mapSearchRequestIdRef.current) return;

      setMapSearchSuggestions(results);
      setShowMapSearchSuggestions(results.length > 0);
    } catch (error) {
      console.warn(
        '⚠️ Erreur suggestions recherche carte:',
        error.message
      );
    } finally {
      if (requestId === mapSearchRequestIdRef.current) {
        setMapSearchLoading(false);
      }
    }
  };

  const handleMapSearchChange = (text) => {
    setMapSearchQuery(text);

    if (mapSearchTimerRef.current) {
      clearTimeout(mapSearchTimerRef.current);
    }

    const trimmed = text.trim();

    if (trimmed.length < 2) {
      setMapSearchSuggestions([]);
      setShowMapSearchSuggestions(false);
      setMapSearchLoading(false);
      return;
    }

    // Debounce : évite un appel réseau à chaque frappe, cherche
    // dynamiquement le Lot, la rue, la ville, sans devoir valider.
    mapSearchTimerRef.current = setTimeout(() => {
      fetchMapSearchSuggestions(trimmed);
    }, 350);
  };

  const handleClearMapSearch = () => {
    if (mapSearchTimerRef.current) {
      clearTimeout(mapSearchTimerRef.current);
    }

    setMapSearchQuery('');
    setMapSearchSuggestions([]);
    setShowMapSearchSuggestions(false);
    setMapSearchLoading(false);
  };

  const handleSelectMapSearchSuggestion = async (item) => {
    setShowMapSearchSuggestions(false);
    setMapSearchQuery(item.description || item.main_text || '');
    Keyboard.dismiss?.();

    setMapSearchResolving(true);

    try {
      let latitude = item.latitude;
      let longitude = item.longitude;

      // Les suggestions Google Places n'ont pas encore de coordonnées
      // — il faut d'abord résoudre les détails du lieu via son
      // place_id. Les suggestions OpenStreetMap (utiles pour les
      // "Lot") ont déjà latitude/longitude directement.
      if (
        (latitude == null || longitude == null) &&
        item.source === 'google' &&
        item.place_id
      ) {
        const details = await getPlaceDetails(item.place_id);
        if (details) {
          latitude = details.latitude;
          longitude = details.longitude;
        }
      }

      if (latitude == null || longitude == null) {
        showToast(
          'warning',
          'Position introuvable',
          'Impossible de localiser précisément ce résultat. Touchez la carte pour ajuster.'
        );
        return;
      }

      // Recentre la carte + place le marqueur, exactement comme un
      // appui direct sur la carte.
      await updateLocation(latitude, longitude);

      mapRef.current?.animateToRegion?.({
        latitude,
        longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      });
    } catch (error) {
      console.warn(
        '⚠️ Erreur sélection résultat carte:',
        error.message
      );

      showToast(
        'error',
        'Recherche impossible',
        'Impossible de localiser précisément ce résultat.'
      );
    } finally {
      setMapSearchResolving(false);
    }
  };

  // ============================================================
  // MAP MODAL
  // ============================================================

  const renderMapModal = () => {
    if (!showMapModal) return null;

    // ✅ FIXÉ (BUG LEHIBE) : le composant <Modal> de React Native ne
    // s'affiche pas de façon fiable sur le web (react-native-web) —
    // ce n'est pas un vrai "portal" attaché à document.body, donc
    // même avec visible={true} le contenu restait invisible. On le
    // remplace par un overlay plein écran "position: fixed" (web) /
    // "position: absolute" (natif) avec un zIndex très élevé, qui
    // fonctionne de façon identique sur Web, Android et iOS.
    return (
      <View style={styles.mapModalOverlay}>
        <View
          style={[
            styles.fullMapModal,
            {
              backgroundColor:
                themeColors.background,
            },
          ]}
        >
          <View
            style={[
              styles.mapHeader,
              {
                backgroundColor:
                  themeColors.surface,
                borderBottomColor:
                  themeColors.border ||
                  '#E5E7EB',
              },
            ]}
          >
            <View
              style={styles.mapHeaderLeft}
            >
              <View
                style={styles.mapHeaderIcon}
              >
                <Ionicons
                  name="location"
                  size={21}
                  color="#fff"
                />
              </View>

              <View>
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
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Déplacez le marqueur ou
                  touchez la carte
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

                showToast(
                  'info',
                  'Carte fermée',
                  'La sélection de position a été fermée.'
                );
              }}
            >
              <Ionicons
                name="close"
                size={22}
                color={themeColors.text}
              />
            </TouchableOpacity>
          </View>

          {/* ================================================== */}
          {/* MAP SEARCH BAR — Lot / adresse / ville (dynamique) */}
          {/* ================================================== */}

          <View style={styles.mapSearchBarWrapper}>
            <View
              style={[
                styles.mapSearchBar,
                {
                  backgroundColor:
                    themeColors.surface,
                  borderColor:
                    themeColors.border ||
                    '#E5E7EB',
                },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={
                  themeColors.textSecondary
                }
              />

              <TextInput
                style={[
                  styles.mapSearchInput,
                  {
                    color: themeColors.text,
                  },
                ]}
                placeholder="Rechercher un Lot, une adresse, une ville..."
                placeholderTextColor={
                  themeColors.textSecondary
                }
                value={mapSearchQuery}
                onChangeText={
                  handleMapSearchChange
                }
                onFocus={() => {
                  if (
                    mapSearchSuggestions.length >
                    0
                  ) {
                    setShowMapSearchSuggestions(
                      true
                    );
                  }
                }}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="sentences"
              />

              {mapSearchLoading ||
              mapSearchResolving ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />
              ) : (
                !!mapSearchQuery && (
                  <TouchableOpacity
                    onPress={
                      handleClearMapSearch
                    }
                    hitSlop={{
                      top: 8,
                      bottom: 8,
                      left: 8,
                      right: 8,
                    }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={
                        themeColors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                )
              )}
            </View>

            {showMapSearchSuggestions &&
              mapSearchSuggestions.length >
                0 && (
                <View
                  style={[
                    styles.mapSearchDropdown,
                    {
                      backgroundColor:
                        themeColors.surface,
                      borderColor:
                        themeColors.border ||
                        '#E5E7EB',
                    },
                  ]}
                >
                  <ScrollView
                    style={
                      styles.mapSearchDropdownScroll
                    }
                    keyboardShouldPersistTaps="handled"
                  >
                    {mapSearchSuggestions.map(
                      (item, index) => (
                        <TouchableOpacity
                          key={
                            item.id ||
                            item.place_id ||
                            `${item.description}-${index}`
                          }
                          style={[
                            styles.mapSearchSuggestionItem,
                            {
                              borderBottomColor:
                                themeColors.border ||
                                '#EEF1F5',
                            },
                          ]}
                          activeOpacity={0.7}
                          onPress={() =>
                            handleSelectMapSearchSuggestion(
                              item
                            )
                          }
                        >
                          <Ionicons
                            name={
                              item.lot ||
                              /\blot\b/i.test(
                                item.main_text ||
                                  item.description ||
                                  ''
                              )
                                ? 'business-outline'
                                : 'location-outline'
                            }
                            size={16}
                            color={
                              colors.primary
                            }
                          />

                          <View
                            style={
                              styles.mapSearchSuggestionTextWrapper
                            }
                          >
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.mapSearchSuggestionMain,
                                {
                                  color:
                                    themeColors.text,
                                },
                              ]}
                            >
                              {item.main_text ||
                                item.description}
                            </Text>

                            {!!item.secondary_text && (
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.mapSearchSuggestionSecondary,
                                  {
                                    color:
                                      themeColors.textSecondary,
                                  },
                                ]}
                              >
                                {
                                  item.secondary_text
                                }
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      )
                    )}
                  </ScrollView>
                </View>
              )}
          </View>

          <View
            style={styles.mapMainContainer}
          >
            <MapViewWrapper
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              region={mapRegion}
              selectionMarker={
                selectedLocation.latitude !==
                null
                  ? {
                      latitude:
                        selectedLocation.latitude,
                      longitude:
                        selectedLocation.longitude,
                    }
                  : null
              }
              onMapPress={handleMapPress}
              onSelectionDragEnd={
                handleMapPress
              }
              showUserLocation={true}
              trackUserLocation={false}
              showMapTypeControl={true}
              fitToMarkersOnLoad={false}
            />

            {isLoadingAddress && (
              <View
                style={
                  styles.mapLoadingBadge
                }
              >
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />

                <Text
                  style={
                    styles.mapLoadingText
                  }
                >
                  Recherche de
                  l'adresse...
                </Text>
              </View>
            )}

            <View
              style={[
                styles.markerInfo,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <View
                style={
                  styles.greenMarkerDot
                }
              />

              <Text
                style={[
                  styles.markerInfoText,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Position sélectionnée
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.mapBottomPanel,
              {
                backgroundColor:
                  themeColors.surface,
                borderTopColor:
                  themeColors.border ||
                  '#E5E7EB',
              },
            ]}
          >
            <View
              style={
                styles.addressTitleRow
              }
            >
              <Ionicons
                name="location"
                size={21}
                color={MAP_GREEN}
              />

              <Text
                style={[
                  styles.addressTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Adresse sélectionnée
              </Text>
            </View>

            <View
              style={[
                styles.selectedAddressBox,
                {
                  backgroundColor:
                    themeColors.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.selectedAddressText,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
                numberOfLines={3}
              >
                {selectedLocation.address ||
                  'Touchez la carte pour sélectionner votre position'}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.validateMapButton,
                {
                  backgroundColor:
                    MAP_GREEN,
                  opacity:
                    selectedLocation.latitude !==
                      null &&
                    selectedLocation.longitude !==
                      null
                      ? 1
                      : 0.5,
                },
              ]}
              onPress={validateLocation}
              disabled={
                selectedLocation.latitude ===
                  null ||
                selectedLocation.longitude ===
                  null
              }
            >
              <Ionicons
                name="checkmark-circle"
                size={23}
                color="#fff"
              />

              <Text
                style={
                  styles.validateMapButtonText
                }
              >
                Valider cette position
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.cancelMapButton
              }
              onPress={() => {
                setShowMapModal(false);

                showToast(
                  'info',
                  'Annulé',
                  'La sélection de position a été annulée.'
                );
              }}
            >
              <Text
                style={[
                  styles.cancelMapButtonText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ============================================================
  // DATE PICKER
  // ============================================================

  const renderDatePicker = () => {
    if (IS_WEB) {
      return (
        <WebDateInput
          value={webDateValue}
          min={formatLocalDate(
            startOfLocalDay()
          )}
          themeColors={themeColors}
          onChange={(value) => {
            const date =
              parseLocalDate(value);

            setSelectedDate(date);

            showToast(
              'success',
              'Date sélectionnée',
              `Rendez-vous prévu le ${formatDate(
                date
              )}.`
            );
          }}
        />
      );
    }

    return (
      <>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.dateTimeButton,
            {
              backgroundColor:
                themeColors.surface,
              borderColor:
                themeColors.border ||
                '#E0E0E0',
            },
          ]}
          onPress={() =>
            setShowDatePicker(true)
          }
        >
          <Ionicons
            name="calendar-outline"
            size={21}
            color={colors.primary}
          />

          <View
            style={styles.dateTextBlock}
          >
            <Text
              style={[
                styles.smallLabel,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              Date
            </Text>

            <Text
              style={[
                styles.dateTimeText,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              {displayDate}
            </Text>
          </View>

          <Ionicons
            name="chevron-down"
            size={17}
            color={
              themeColors.textSecondary
            }
          />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            minimumDate={startOfLocalDay()}
            onChange={(
              event,
              date
            ) => {
              setShowDatePicker(false);

              if (date) {
                setSelectedDate(date);

                showToast(
                  'success',
                  'Date sélectionnée',
                  `Rendez-vous prévu le ${formatDate(
                    date
                  )}.`
                );
              }
            }}
          />
        )}
      </>
    );
  };

  // ============================================================
  // TIME PICKER
  // ============================================================

  const renderTimePicker = () => {
    if (IS_WEB) {
      return (
        <WebTimeInput
          value={webTimeValue}
          themeColors={themeColors}
          onChange={(value) => {
            const time =
              parseTimeToDate(value);

            setSelectedTime(time);

            showToast(
              'success',
              'Heure sélectionnée',
              `Séance prévue à ${formatTime(
                time
              )}.`
            );
          }}
        />
      );
    }

    return (
      <>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.dateTimeButton,
            {
              backgroundColor:
                themeColors.surface,
              borderColor:
                themeColors.border ||
                '#E0E0E0',
            },
          ]}
          onPress={() =>
            setShowTimePicker(true)
          }
        >
          <Ionicons
            name="time-outline"
            size={21}
            color={colors.primary}
          />

          <View
            style={styles.dateTextBlock}
          >
            <Text
              style={[
                styles.smallLabel,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              Heure
            </Text>

            <Text
              style={[
                styles.dateTimeText,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              {displayTime}
            </Text>
          </View>

          <Ionicons
            name="chevron-down"
            size={17}
            color={
              themeColors.textSecondary
            }
          />
        </TouchableOpacity>

        {showTimePicker && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            is24Hour
            display="default"
            onChange={(
              event,
              time
            ) => {
              setShowTimePicker(false);

              if (time) {
                setSelectedTime(time);

                showToast(
                  'success',
                  'Heure sélectionnée',
                  `Séance prévue à ${formatTime(
                    time
                  )}.`
                );
              }
            }}
          />
        )}
      </>
    );
  };

  // ============================================================
  // TOAST CONFIG
  // ============================================================

  const toastConfig =
    getToastConfig();

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            themeColors.background,
        },
      ]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={PRIMARY_DARK}
      />

      <Header
        title="Nouvelle réservation"
        subtitle="Votre bien-être, notre priorité"
        showBack
        rightComponent={
          // ✅ Icône "liste" dans le header, à droite : accès direct
          // à toutes les réservations du client (même écran que le
          // bouton "Voir mes demandes" plus bas — deux chemins vers
          // la même liste, pratique quand le formulaire est long).
          <TouchableOpacity
            onPress={handleViewRequests}
            style={styles.headerListButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Voir toutes mes réservations"
          >
            <Ionicons name="list-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      {/* ====================================================== */}
      {/* TOAST */}
      {/* ====================================================== */}

      {toast.visible && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrapper,
            {
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
          <TouchableOpacity
            activeOpacity={0.96}
            onPress={hideToast}
            style={[
              styles.toast,
              {
                backgroundColor:
                  toastConfig.background,
                borderColor:
                  `${toastConfig.color}35`,
              },
            ]}
          >
            <View
              style={[
                styles.toastIconContainer,
                {
                  backgroundColor:
                    `${toastConfig.color}16`,
                },
              ]}
            >
              <Ionicons
                name={
                  toastConfig.icon
                }
                size={22}
                color={
                  toastConfig.color
                }
              />
            </View>

            <View
              style={styles.toastContent}
            >
              {!!toast.title && (
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
              )}

              {!!toast.message && (
                <Text
                  numberOfLines={2}
                  style={[
                    styles.toastMessage,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {toast.message}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={hideToast}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
              style={styles.toastClose}
            >
              <Ionicons
                name="close"
                size={17}
                color={
                  themeColors.textSecondary
                }
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={[
            styles.container,
            {
              backgroundColor:
                themeColors.background,
            },
          ]}
          contentContainerStyle={
            styles.contentContainer
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'android' ? 'on-drag' : 'interactive'
          }
          automaticallyAdjustKeyboardInsets={true}
          contentInsetAdjustmentBehavior="automatic"
          overScrollMode="always"
        >

          {/* ================================================= */}
          {/* MASSAGE TYPE */}
          {/* ================================================= */}

          <View style={styles.section}>

            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Type de massage
            </Text>

            {/* ================================================= */}
            {/* ✅ CAROUSEL WRAPPER */}
            {/* ================================================= */}

            <View
              style={
                styles.massageCarouselWrapper
              }
            >

              {/* ============================================= */}
              {/* LEFT BUTTON — WEB ONLY */}
              {/* ============================================= */}

              {IS_WEB &&
                massageTypes.length > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={
                      handleMassageCarouselLeft
                    }
                    style={[
                      styles.carouselButton,
                      styles.carouselButtonLeft,
                      {
                        backgroundColor:
                          themeColors.surface,
                        borderColor:
                          themeColors.border ||
                          '#E5E7EB',
                      },
                    ]}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={23}
                      color={
                        themeColors.text
                      }
                    />
                  </TouchableOpacity>
                )}

              {/* ============================================= */}
              {/* MASSAGE CARDS */}
              {/* ============================================= */}

              <ScrollView
                ref={massageCarouselRef}
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                keyboardShouldPersistTaps="always"
                onScroll={
                  handleMassageScroll
                }
                scrollEventThrottle={16}
                contentContainerStyle={[
                  styles.massageCarouselContent,
                  {
                    paddingLeft:
                      IS_WEB
                        ? 48
                        : 0,
                    paddingRight:
                      IS_WEB
                        ? 48
                        : spacing.md,
                  },
                ]}
              >
                {massageTypesLoading &&
                  massageTypes.length ===
                    0 && (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.primary
                      }
                      style={{
                        marginHorizontal:
                          spacing.md,
                      }}
                    />
                  )}

                {massageTypes.map(
                  (type) => {
                    const active =
                      selectedType ===
                      type.id;

                    return (
                      <TouchableOpacity
                        key={type.id}
                        activeOpacity={0.82}
                        style={[
                          styles.typeCard,
                          {
                            backgroundColor:
                              themeColors.surface,
                            borderColor:
                              active
                                ? colors.primary
                                : 'transparent',
                          },
                        ]}
                        onPress={() => {
                          setSelectedType(
                            type.id
                          );

                          showToast(
                            'success',
                            'Massage sélectionné',
                            type.name
                          );
                        }}
                      >

                        {/* ================================= */}
                        {/* IMAGE GRANDE */}
                        {/* ================================= */}

                        <View
                          style={[
                            styles.typeIcon,
                            {
                              backgroundColor:
                                active
                                  ? colors.primary
                                  : colors.primary +
                                    '18',
                            },
                          ]}
                        >
                          <TypeCardVisual
                            imageUrl={
                              type.imageUrl
                            }
                            iconName={
                              type.icon
                            }
                            size={68}
                            tintColor={
                              active
                                ? '#fff'
                                : colors.primary
                            }
                          />
                        </View>

                        <Text
                          style={[
                            styles.typeName,
                            {
                              color:
                                themeColors.text,
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {type.name}
                        </Text>

                        <Text
                          style={[
                            styles.typePrice,
                            {
                              color:
                                themeColors.textSecondary,
                            },
                          ]}
                        >
                          {type.price.toLocaleString(
                            'fr-FR'
                          )}{' '}
                          Ar
                        </Text>

                      </TouchableOpacity>
                    );
                  }
                )}
              </ScrollView>

              {/* ============================================= */}
              {/* RIGHT BUTTON — WEB ONLY */}
              {/* ============================================= */}

              {IS_WEB &&
                massageTypes.length > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={
                      handleMassageCarouselRight
                    }
                    style={[
                      styles.carouselButton,
                      styles.carouselButtonRight,
                      {
                        backgroundColor:
                          themeColors.surface,
                        borderColor:
                          themeColors.border ||
                          '#E5E7EB',
                      },
                    ]}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={23}
                      color={
                        themeColors.text
                      }
                    />
                  </TouchableOpacity>
                )}

            </View>
          </View>

          {/* ================================================= */}
          {/* DURATION */}
          {/* ================================================= */}

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Durée
            </Text>

            <View
              style={
                styles.durationContainer
              }
            >
              {DURATION_OPTIONS.map(
                (duration) => {
                  const active =
                    selectedDuration ===
                    duration;

                  return (
                    <TouchableOpacity
                      key={duration}
                      activeOpacity={0.8}
                      style={[
                        styles.durationButton,
                        {
                          backgroundColor:
                            active
                              ? colors.primary +
                                '12'
                              : themeColors.surface,
                          borderColor:
                            active
                              ? colors.primary
                              : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        setSelectedDuration(
                          duration
                        );

                        showToast(
                          'success',
                          'Durée sélectionnée',
                          `${duration} minutes`
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.durationText,
                          {
                            color:
                              active
                                ? colors.primary
                                : themeColors.text,
                          },
                        ]}
                      >
                        {duration} min
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>
          </View>

          {/* ================================================= */}
          {/* GENDER */}
          {/* ================================================= */}

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Préférence de sexe
            </Text>

            <View
              style={
                styles.genderContainer
              }
            >
              {[
                {
                  id: 'any',
                  label: 'Peu importe',
                  icon: 'people-outline',
                },
                {
                  id: 'male',
                  label: 'Homme',
                  icon: 'man-outline',
                },
                {
                  id: 'female',
                  label: 'Femme',
                  icon: 'woman-outline',
                },
              ].map((gender) => {
                const active =
                  preferredGender ===
                  gender.id;

                return (
                  <TouchableOpacity
                    key={gender.id}
                    activeOpacity={0.8}
                    style={[
                      styles.genderButton,
                      {
                        backgroundColor:
                          active
                            ? colors.primary +
                              '12'
                            : themeColors.surface,
                        borderColor:
                          active
                            ? colors.primary
                            : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setPreferredGender(
                        gender.id
                      );

                      showToast(
                        'success',
                        'Préférence enregistrée',
                        gender.label
                      );
                    }}
                  >
                    <Ionicons
                      name={
                        gender.icon
                      }
                      size={18}
                      color={
                        active
                          ? colors.primary
                          : themeColors.textSecondary
                      }
                    />

                    <Text
                      style={[
                        styles.genderText,
                        {
                          color:
                            active
                              ? colors.primary
                              : themeColors.text,
                        },
                      ]}
                    >
                      {gender.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ================================================= */}
          {/* DATE & TIME */}
          {/* ================================================= */}

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Date & Heure
            </Text>

            <View
              style={
                styles.dateTimeContainer
              }
            >
              {renderDatePicker()}
              {renderTimePicker()}
            </View>
          </View>

          {/* ================================================= */}
          {/* ADDRESS */}
          {/* ================================================= */}

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Adresse du massage
            </Text>

            <View
              style={[
                styles.addressContainer,
                {
                  backgroundColor:
                    themeColors.surface,
                  borderColor:
                    themeColors.border ||
                    '#E0E0E0',
                },
              ]}
            >
              <Ionicons
                name="location-outline"
                size={21}
                color={colors.primary}
              />

              <TextInput
                ref={addressInputRef}
                style={[
                  styles.addressInput,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
                placeholder="Entrez votre adresse"
                placeholderTextColor={
                  themeColors.textSecondary
                }
                value={address}
                onChangeText={
                  setAddress
                }
                multiline={false}
                numberOfLines={1}
                returnKeyType="next"
                blurOnSubmit={false}
                autoCorrect={false}
                autoCapitalize="sentences"
                textAlignVertical="center"
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              style={
                styles.locationButton
              }
              onPress={
                handleUseCurrentLocation
              }
              disabled={
                isSearchingLocation
              }
            >
              {isSearchingLocation ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.primary
                  }
                />
              ) : (
                <Ionicons
                  name="locate"
                  size={20}
                  color={
                    colors.primary
                  }
                />
              )}

              <Text
                style={
                  styles.locationButtonText
                }
              >
                {isSearchingLocation
                  ? 'Recherche de votre position...'
                  : 'Utiliser ma position actuelle'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ================================================= */}
          {/* PRICE */}
          {/* ================================================= */}

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    themeColors.text,
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
                  borderColor:
                    themeColors.border ||
                      '#E0E0E0',
                },

              ]}
            >
              <Text
                style={
                  styles.priceCurrency
                }
              >
                Ar
              </Text>

              <TextInput
                ref={priceInputRef}
                style={[
                  styles.priceInput,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
                placeholder="Ex : 35 000"
                placeholderTextColor={
                  themeColors.textSecondary
                }
                value={priceProposed}
                onChangeText={
                  setPriceProposed
                }
                onFocus={handlePriceFocus}
                onBlur={() => {}}
                keyboardType="numeric"
                inputMode="numeric"
                returnKeyType="done"
                blurOnSubmit={true}
                caretHidden={false}
                selectionColor={colors.primary}
                selectTextOnFocus={false}
              />
            </View>

            <Text
              style={[
                styles.priceHint,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              Prix minimum conseillé :{' '}
              {getBasePrice().toLocaleString(
                'fr-FR'
              )}{' '}
              Ar
            </Text>
          </View>

          {/* ================================================= */}
          {/* ✅ NOUVEAU : INSTRUCTIONS SPÉCIALES (optionnel) */}
          {/* ================================================= */}

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Instructions spéciales (optionnel)
            </Text>

            <View
              style={[
                styles.addressContainer,
                {
                  minHeight: 90,
                  alignItems: 'flex-start',
                  paddingVertical: spacing.sm,
                  backgroundColor:
                    themeColors.surface,
                  borderColor:
                    themeColors.border ||
                      '#E0E0E0',
                },

              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={21}
                color={colors.primary}
                style={{ marginTop: 2 }}
              />

              <TextInput
                ref={instructionsInputRef}
                style={[
                  styles.specialInstructionsInput,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
                placeholder="Ex : allergies, étage, code du portail, animal domestique..."
                placeholderTextColor={
                  themeColors.textSecondary
                }
                value={specialInstructions}
                onChangeText={
                  setSpecialInstructions
                }
                onFocus={handleInstructionsFocus}
                onBlur={() => {}}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* ================================================= */}
          {/* SUBMIT */}
          {/* ================================================= */}

          {/* ✅ Conteneur aligné avec exactement la même marge que les
              autres champs du formulaire (styles.section utilise
              paddingHorizontal: spacing.md) — les deux boutons
              commencent et finissent donc pile sous les champs
              au-dessus, sans déborder plus large qu'eux. */}
          <View style={styles.actionsSection}>
            <View style={styles.bookingActionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.submitButtonHalf,
                  styles.submitButtonShadow,
                  isLoading && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Soumettre ma demande"
              >
                <LinearGradient
                  colors={[
                    colors.primary,
                    colors.primaryLight || colors.primary,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitButton}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={20} color="#fff" />
                      <Text style={styles.submitButtonText}>
                        Soumettre ma demande
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.viewRequestsButton,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border || '#E0E0E0',
                  },
                ]}
                onPress={handleViewRequests}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Voir mes demandes"
              >
                <Ionicons name="list-outline" size={20} color={colors.primary} />
                <Text
                  style={[
                    styles.viewRequestsButtonText,
                    { color: themeColors.text },
                  ]}
                >
                  Voir mes demandes
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {renderMapModal()}
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // ✅ Bouton rond de l'icône "liste" dans le header (même style que
  // les boutons latéraux du header vert de HomeScreen).
  headerListButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },

  keyboardView: {
    flex: 1,
    minHeight: 0,
  },

  container: {
    flex: 1,
  },

  contentContainer: {
    paddingTop: spacing.sm,
    // Espace supplémentaire sous le dernier champ pour que le clavier
    // Android ne bloque jamais la zone active.
    paddingBottom: Platform.OS === 'android' ? 220 : 120,
  },

  // ==========================================================
  // TOAST
  // ==========================================================

  toastWrapper: {
    position: 'absolute',
    top:
      Platform.OS === 'android'
        ? 14
        : 10,
    left: 12,
    right: 12,
    zIndex: 99999,
    elevation: 999,
    alignItems: 'center',
  },

  toast: {
    width:
      Platform.OS === 'web'
        ? Math.min(
            width - 32,
            480
          )
        : '100%',

    minHeight: 66,

    borderRadius: 18,

    borderWidth: 1,

    paddingHorizontal: 12,

    paddingVertical: 10,

    flexDirection: 'row',

    alignItems: 'center',

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.16,

    shadowRadius: 16,

    elevation: 12,
  },

  toastIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  toastContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },

  toastTitle: {
    fontSize: 14,
    fontFamily:
      typography.fontFamily.semiBold,
    marginBottom: 2,
  },

  toastMessage: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily:
      typography.fontFamily.regular,
  },

  toastClose: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  // ==========================================================
  // SECTION
  // ==========================================================

  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },

  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontFamily:
      typography.fontFamily.semiBold,
    marginBottom: spacing.sm,
  },

  // ==========================================================
  // ✅ MASSAGE CAROUSEL
  // ==========================================================

  massageCarouselWrapper: {
    position: 'relative',
    width: '100%',
    minHeight: 184,
    justifyContent: 'center',
  },

  massageCarouselContent: {
    alignItems: 'stretch',
  },

  // ==========================================================
  // ✅ CAROUSEL BUTTON
  // Un seul à gauche + un seul à droite
  // ==========================================================

  carouselButton: {
    position: 'absolute',

    top: '50%',

    marginTop: -23,

    width: 46,

    height: 46,

    borderRadius: 23,

    borderWidth: 1,

    alignItems: 'center',

    justifyContent: 'center',

    zIndex: 50,

    elevation: 8,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 3,
    },

    shadowOpacity: 0.16,

    shadowRadius: 8,

    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },

  carouselButtonLeft: {
    left: 0,
  },

  carouselButtonRight: {
    right: 0,
  },

  // ==========================================================
  // ✅ TYPE CARD — PLUS GRANDE
  // ==========================================================

  typeCard: {
    width: 165,

    minHeight: 176,

    paddingVertical: 15,

    paddingHorizontal: 12,

    borderRadius: 20,

    marginRight: spacing.sm,

    alignItems: 'center',

    borderWidth: 2,

    justifyContent: 'center',

    overflow: 'hidden',

    // ✅ Légère ombre premium (carte qui "flotte" un peu),
    // cohérente avec les autres cartes de l'app.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,

    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },

  // ==========================================================
  // ✅ VIGNETTE TYPE DE MASSAGE — carré à bordures arrondies
  // (au lieu d'un cercle) pour un rendu net et cohérent avec le
  // reste de l'app, sans bord de couleur de fond visible autour
  // de l'image.
  // ==========================================================

  typeIcon: {
    width: 78,

    height: 78,

    borderRadius: 20,

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 10,

    overflow: 'hidden',
  },

  typeName: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.medium,

    textAlign: 'center',

    lineHeight: 19,

    minHeight: 38,

    width: '100%',
  },

  typePrice: {
    fontSize:
      typography.fontSize.xs,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 6,
  },

  // ==========================================================
  // DURATION
  // ==========================================================

  durationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  durationButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
  },

  durationText: {
    fontSize:
      typography.fontSize.sm,
    fontFamily:
      typography.fontFamily.medium,
  },

  // ==========================================================
  // GENDER
  // ==========================================================

  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  genderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
  },

  genderText: {
    fontSize:
      typography.fontSize.sm,
    fontFamily:
      typography.fontFamily.medium,
  },

  // ==========================================================
  // DATE / TIME
  // ==========================================================

  dateTimeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  webInputWrapper: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },

  dateTimeButton: {
    flex: 1,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 13,
    borderWidth: 1,
    gap: 10,
  },

  dateTextBlock: {
    flex: 1,
  },

  smallLabel: {
    fontSize: 11,
    marginBottom: 2,
  },

  dateTimeText: {
    fontSize:
      typography.fontSize.sm,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  // ==========================================================
  // ADDRESS
  // ==========================================================

  addressContainer: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    // ✅ Rayon aligné sur celui des boutons (16) pour une
    // cohérence visuelle "premium" sur toute l'interface.
    borderRadius: 16,
    borderWidth: 1.5,
    gap: spacing.sm,
  },

  addressInput: {
    flex: 1,
    height: 48,
    fontSize:
      typography.fontSize.md,
    fontFamily:
      typography.fontFamily.regular,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    outlineStyle: 'none',
  },

  // Champ "Instructions spéciales" séparé du champ adresse :
  // multiline stable sur Android et curseur placé correctement.
  specialInstructionsInput: {
    flex: 1,
    minHeight: 82,
    fontSize:
      typography.fontSize.md,
    lineHeight: 21,
    fontFamily:
      typography.fontFamily.regular,
    padding: 0,
    margin: 0,
    includeFontPadding: true,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  },

  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 7,
    paddingVertical: 5,
  },

  locationButtonText: {
    color: colors.primary,
    fontSize:
      typography.fontSize.sm,
    fontFamily:
      typography.fontFamily.medium,
  },

  // ==========================================================
  // PRICE
  // ==========================================================

  priceContainer: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
  },

  // ✅ Halo/ombre colorée affiché uniquement quand le champ est
  // actif — même codage visuel que "focus ring" sur les
  // interfaces de réservation/paiement standards.
  priceContainerFocused: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },

  priceCurrency: {
    fontSize:
      typography.fontSize.lg,
    fontFamily:
      typography.fontFamily.bold,
    color: colors.primary,
    marginRight: spacing.sm,
  },

  priceInput: {
    flex: 1,
    height: 52,
    minWidth: 0,
    fontSize:
      typography.fontSize.lg,
    fontFamily:
      typography.fontFamily.bold,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    outlineStyle: 'none',
  },

  priceHint: {
    fontSize:
      typography.fontSize.xs,
    fontFamily:
      typography.fontFamily.regular,
    marginTop: spacing.xs,
  },

  // ==========================================================
  // SUBMIT
  // ==========================================================

  // ✅ Même inset horizontal que "section" (paddingHorizontal:
  // spacing.md) : les boutons ne débordent plus jamais plus large que
  // les champs du formulaire au-dessus, quelle que soit la taille de
  // l'écran.
  actionsSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  bookingActionsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },

  submitButtonHalf: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    marginTop: 0,
  },

  // ✅ Ombre colorée "premium" du bouton principal, posée sur le
  // conteneur externe (pas sur le dégradé lui-même) afin qu'elle
  // reste bien visible sur toutes les plateformes.
  submitButtonShadow: {
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  viewRequestsButton: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    // ✅ Même gabarit que "submitButton" (hauteur, arrondi, espacement
    // icône/texte) pour que les deux boutons soient parfaitement
    // identiques visuellement, seule la couleur change.
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    // ✅ Ombre légère assortie à celle du bouton "Soumettre" (mais plus
    // discrète, cohérente avec une carte "secondaire") pour que les
    // deux boutons aient le même poids visuel — aucun des deux ne
    // "domine" l'autre.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  viewRequestsButtonText: {
    // ✅ Même taille de police que "submitButtonText" (fontSize.md)
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    textAlign: 'center',
    flexShrink: 1,
  },

  // ✅ Style du dégradé interne du bouton principal — plus de
  // couleur/ombre ici (déplacées sur les conteneurs parents), il
  // ne gère plus que la mise en page du contenu.
  submitButton: {
    minHeight: 56,
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.sm,
  },

  submitButtonDisabled: {
    opacity: 0.7,
  },

  submitButtonText: {
    color: '#fff',
    fontSize:
      typography.fontSize.md,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  // ==========================================================
  // MAP MODAL
  // ==========================================================

  // ✅ FIXÉ : overlay plein écran qui remplace <Modal>. "position:
  // fixed" sur le web (ignore le scroll de la page parente et
  // s'affiche vraiment au-dessus de tout), "absolute" sur natif.
  mapModalOverlay: {
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
  },

  fullMapModal: {
    flex: 1,
  },

  mapHeader: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 10,
  },

  mapHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },

  mapHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: MAP_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mapTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  mapSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },

  closeMapButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ============================================================
     MAP SEARCH BAR (Lot / adresse / ville)
  ============================================================ */

  mapSearchBarWrapper: {
    position: 'relative',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    zIndex: 20,
    elevation: 20,
  },

  mapSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  mapSearchInput: {
    flex: 1,
    fontSize: 14.5,
    padding: 0,
    minHeight: 46,
  },

  mapSearchDropdown: {
    position: 'absolute',
    top: '100%',
    left: spacing.md,
    right: spacing.md,
    marginTop: -4,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 30,
  },

  mapSearchDropdownScroll: {
    maxHeight: 260,
  },

  mapSearchSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },

  mapSearchSuggestionTextWrapper: {
    flex: 1,
  },

  mapSearchSuggestionMain: {
    fontSize: 13,
    fontWeight: '600',
  },

  mapSearchSuggestionSecondary: {
    fontSize: 11,
    marginTop: 1,
  },

  mapMainContainer: {
    flex: 1,
    position: 'relative',
    minHeight: 300,
  },

  map: {
    width: '100%',
    height: '100%',
  },

  mapLoadingBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },

  mapLoadingText: {
    color: '#333',
    fontSize: 13,
  },

  markerInfo: {
    position: 'absolute',
    top: 15,
    right: 15,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },

  greenMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: MAP_GREEN,
    borderWidth: 2,
    borderColor: '#fff',
  },

  markerInfoText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ==========================================================
  // MAP BOTTOM
  // ==========================================================

  mapBottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom:
      Platform.OS === 'ios'
        ? 25
        : 16,
    borderTopWidth: 1,
  },

  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },

  addressTitle: {
    fontSize: 14,
    fontWeight: '700',
  },

  selectedAddressBox: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    marginBottom: 12,
  },

  selectedAddressText: {
    fontSize: 13,
    lineHeight: 19,
  },

  validateMapButton: {
    height: 53,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: MAP_GREEN_DARK,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 7,
    elevation: 5,
  },

  validateMapButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  cancelMapButton: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  cancelMapButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default BookingScreen;