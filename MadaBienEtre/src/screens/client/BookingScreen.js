// src/screens/client/BookingScreen.js

import {
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
  Modal,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import LockedTherapistCard from '../../components/client/LockedTherapistCard';
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

import {
  getMadagascarTodayDate,
  madagascarLocalToUtcIso,
} from '../../utils/timeAgo';

import { toastAdapters } from "../../utils/toast";

const { width } = Dimensions.get('window');

const IS_WEB = Platform.OS === 'web';

// ✅ Thème harmonisé avec HomeScreen.js (même vert PRIMARY partout)
const PRIMARY = colors.primary || '#2E8B57';
const PRIMARY_DARK = '#2E8B57';

// Alias conservés pour ne pas casser les usages existants dans ce
// fichier (carte, marqueurs...) — pointent maintenant vers le thème.
const MAP_GREEN = PRIMARY;
const MAP_GREEN_DARK = PRIMARY_DARK;

const EMPTY_MASSAGE_TYPES = [];

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

// ============================================================
// ✅ VALIDATION VISUELLE (menamena = rouge) + MASQUES DE SAISIE
// ============================================================

const ERROR_COLOR = '#DC2626';
const ERROR_BG_LIGHT = '#FEF2F2';
const ERROR_BG_DARK = '#3B1818';

const MIN_PRICE = 20000;
const MIN_ADDRESS_LENGTH = 5;
const MAX_ADDRESS_LENGTH = 200;
const MAX_INSTRUCTIONS_LENGTH = 500;

// Prix : chiffres uniquement (8 max), sans zéro inutile au début.
const maskPriceDigits = (value) =>
  String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/^0+(?=\d)/, '');

// 35000 -> "35 000" (affichage uniquement)
const formatThousands = (digits) =>
  String(digits ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// Adresse : lettres (accents inclus), chiffres, espaces et ponctuation
// courante d'une adresse (, . - ' / # ( ) °). Pas de < > { } ; $ % etc.
const maskAddress = (value) =>
  String(value ?? '')
    .replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ\s,.'’\-/#()°]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, MAX_ADDRESS_LENGTH);

// Instructions : on retire seulement les caractères dangereux / de contrôle.
const maskInstructions = (value) =>
  String(value ?? '')
    .replace(/[<>{}\\]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, MAX_INSTRUCTIONS_LENGTH);

// Petit bloc rouge affiché SOUS un champ en erreur.
const FieldError = ({ message }) => {
  if (!message) return null;

  return (
    <View style={styles.fieldErrorRow}>
      <Ionicons
        name="alert-circle"
        size={15}
        color={ERROR_COLOR}
        style={{ marginTop: 1 }}
      />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  );
};

// ============================================================
// DATE HELPERS
// ============================================================

// ⏰ HEURE DE MADAGASCAR (UTC+3)
// Les sélecteurs date/heure servent de simples conteneurs de
// "jour" et "heure" saisis par le client : on les interprète
// TOUJOURS comme une heure de Madagascar, quel que soit le fuseau
// de l'appareil (voir madagascarLocalToUtcIso à l'envoi).
// "Aujourd'hui" = le jour actuel à Madagascar.
const startOfLocalDay = (date = getMadagascarTodayDate()) => {
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
  if (!value) return getMadagascarTodayDate();

  const parts = value.split('-').map(Number);

  if (parts.length !== 3) {
    return getMadagascarTodayDate();
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
// ✅ APERÇU DE LA CARTE GPS (Android / iOS / web)
// Image Google Maps statique : centrée sur la position choisie, ou
// sur la région par défaut tant qu'aucune position n'est confirmée.
// ============================================================

// Vraie carte Google Maps (MapViewWrapper : API JS sur le web,
// react-native-maps sur Android / iOS), affichée en lecture seule :
// les touchers sont captés par le bouton parent qui ouvre la carte.
const MapPreview = ({ latitude, longitude, hasPosition }) => {
  const lat = hasPosition ? Number(latitude) : DEFAULT_REGION.latitude;
  const lng = hasPosition ? Number(longitude) : DEFAULT_REGION.longitude;

  const region = useMemo(
    () => ({
      latitude: lat,
      longitude: lng,
      latitudeDelta: hasPosition ? 0.006 : 0.09,
      longitudeDelta: hasPosition ? 0.006 : 0.04,
    }),
    [lat, lng, hasPosition]
  );

  return (
    <View style={styles.mapPreviewWrap}>
      <View style={styles.mapPreviewMap} pointerEvents="none">
        <MapViewWrapper
          style={styles.mapPreviewMap}
          initialRegion={region}
          region={region}
          selectionMarker={
            hasPosition ? { latitude: lat, longitude: lng } : null
          }
          showUserLocation={false}
          trackUserLocation={false}
          showMapTypeControl={false}
          gestureHandling="none"
          fitToMarkersOnLoad={false}
        />
      </View>

      {!hasPosition ? (
        <View style={styles.mapPreviewPin} pointerEvents="none">
          <Ionicons name="location" size={40} color={colors.primary} />
        </View>
      ) : null}

      <View style={styles.mapPreviewPill} pointerEvents="none">
        <Ionicons
          name={hasPosition ? 'create-outline' : 'hand-left-outline'}
          size={14}
          color="#FFFFFF"
        />
        <Text style={styles.mapPreviewPillText}>
          {hasPosition
            ? 'Modifier sur la carte'
            : 'Touchez pour choisir sur la carte'}
        </Text>
      </View>
    </View>
  );
};

// ============================================================
// IMAGE TYPE MASSAGE
// ✅ IMAGE PLUS GRANDE
// ============================================================

// Pastilles colorées des types de massage (cycle de 6 teintes).
const TYPE_TONES = [
  { bg: '#F7CBBE', fg: '#C2563A' },
  { bg: '#BFD8F4', fg: '#2F6DB5' },
  { bg: '#FBD69A', fg: '#B7791F' },
  { bg: '#D9D0F4', fg: '#6B52B3' },
  { bg: '#C3E8D2', fg: '#2E8B57' },
  { bg: '#F6C9DE', fg: '#B03A78' },
];

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
  // Thérapeute choisi (bouton « Réserver » d'une carte thérapeute) :
  // la demande est verrouillée sur lui et on enchaîne sur la négociation.
  const {
    therapist: lockedTherapist,
    therapistId: lockedTherapistIdParam,
  } = route?.params || {};

  const lockedTherapistId = (() => {
    const raw =
      lockedTherapist?.therapist_id ??
      lockedTherapist?.id ??
      lockedTherapistIdParam;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const {
    token: _token,
    user: _user,
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
    useState(() => getMadagascarTodayDate());

  // Raccourcis de date « Aujourd'hui / Demain / Autre date ».
  const [forceOtherDate, setForceOtherDate] =
    useState(false);

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

  // ✅ Validation visuelle : un champ n'est affiché en rouge qu'après
  // que le client l'a touché, ou après un clic sur « Soumettre ».
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitError, setSubmitError] = useState('');

  // ✅ Message de confirmation (modal) une fois la demande enregistrée
  const [successInfo, setSuccessInfo] = useState(null);

  // Position verticale de chaque section (pour remonter sur l'erreur)
  const sectionY = useRef({});

  const touch = (field) =>
    setTouched((prev) =>
      prev[field] ? prev : { ...prev, [field]: true }
    );

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [showTimePicker, setShowTimePicker] =
    useState(false);

  // ✅ États de focus pour un rendu "premium" : le cadre de
  // l'input se met en évidence (bordure + ombre colorée) pendant
  // la saisie, comme sur les interfaces de paiement/réservation
  // internationales (Stripe, Airbnb, etc.).
  const [_isPriceFocused, _setIsPriceFocused] =
    useState(false);

  const [_isInstructionsFocused, _setIsInstructionsFocused] =
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

  const _scrollMassageTypes = (direction) => {
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

  const showToast = toastAdapters.typeTitleMsg;

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
  // ✅ ERREURS DU FORMULAIRE
  // ============================================================

  const hasLocation =
    selectedLocation.latitude != null &&
    selectedLocation.longitude != null &&
    Number.isFinite(Number(selectedLocation.latitude)) &&
    Number.isFinite(Number(selectedLocation.longitude));

  const scheduledIsoPreview = madagascarLocalToUtcIso(
    formatLocalDate(selectedDate),
    formatDateToTime(selectedTime)
  );

  const priceNumber = parseInt(priceProposed, 10);

  const errors = {
    type: selectedType ? '' : 'Veuillez sélectionner un type de massage.',

    address: !address.trim()
      ? 'Veuillez entrer votre adresse.'
      : address.trim().length < MIN_ADDRESS_LENGTH
      ? `Adresse trop courte (${MIN_ADDRESS_LENGTH} caractères minimum).`
      : '',

    location: hasLocation
      ? ''
      : 'Position non confirmée : touchez l’icône de localisation ou choisissez votre position sur la carte.',

    schedule: !scheduledIsoPreview
      ? 'Date ou heure invalide.'
      : new Date(scheduledIsoPreview).getTime() <= Date.now()
      ? "La date et l'heure du massage doivent être dans le futur."
      : '',

    price:
      !priceProposed || Number.isNaN(priceNumber)
        ? 'Veuillez proposer un prix.'
        : priceNumber < MIN_PRICE
        ? `Le prix minimum est de ${formatThousands(MIN_PRICE)} Ar.`
        : '',
  };

  const isVisible = (key) => submitted || !!touched[key];

  const typeErrorShown = isVisible('type') ? errors.type : '';
  const addressErrorShown = isVisible('address') ? errors.address : '';
  const locationErrorShown =
    isVisible('address') && !errors.address ? errors.location : '';
  const scheduleErrorShown = isVisible('schedule') ? errors.schedule : '';
  const priceErrorShown = isVisible('price') ? errors.price : '';

  const errBg = isDark ? ERROR_BG_DARK : ERROR_BG_LIGHT;

  // Couleurs des champs date / heure (rouge si erreur)
  const dtColors = scheduleErrorShown
    ? { ...themeColors, surface: errBg, border: ERROR_COLOR }
    : themeColors;

  // Masques de saisie
  const handleAddressChange = (text) => {
    setAddress(maskAddress(text));
    touch('address');
  };

  const handlePriceChange = (text) => {
    setPriceProposed(maskPriceDigits(text));
    touch('price');
  };

  const handleInstructionsChange = (text) => {
    setSpecialInstructions(maskInstructions(text));
  };

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

  // ✅ Boutons du message de confirmation
  const handleSuccessContinue = () => {
    const info = successInfo;
    setSuccessInfo(null);

    if (!info) return;

    // Thérapeute choisi -> on continue sur la négociation de CETTE demande
    if (info.locked && info.bookingId) {
      navigation.navigate('Negotiation', {
        bookingId: info.bookingId,
        booking: info.booking,
        therapist: lockedTherapist,
      });
      return;
    }

    // ✅ FIXÉ : « Réservations » est le NOM DE L'ONGLET qui contient cet
    // écran (BookingStack) -> navigate('Réservations') ne faisait que
    // rester sur le formulaire. On ouvre la vraie liste « History »,
    // comme le bouton « Voir mes demandes » / l'icône liste du header.
    navigation.navigate('History');
  };

  const handleSuccessNewRequest = () => {
    setSuccessInfo(null);

    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // ✅ NOUVEAU : réinitialise entièrement le formulaire de création de
  // demande. Appelée automatiquement une fois la demande envoyée et
  // enregistrée avec succès, pour que l'écran soit "propre" si le
  // client revient créer une nouvelle demande.
  const resetForm = () => {
    setSelectedType(null);
    setSelectedDuration(60);
    setSelectedDate(getMadagascarTodayDate());
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
    setSubmitted(false);
    setTouched({});
    setSubmitError('');
  };

  const handleSubmit = async () => {
    if (isLoading) return;

    // Affiche en rouge tous les champs invalides
    setSubmitted(true);
    setSubmitError('');

    const firstErrorKey = ['type', 'address', 'location', 'schedule', 'price']
      .find((key) => errors[key]);

    if (firstErrorKey) {
      showToast(
        'warning',
        'Formulaire incomplet',
        errors[firstErrorKey]
      );

      const y =
        sectionY.current[
          firstErrorKey === 'location' ? 'address' : firstErrorKey
        ];

      if (y != null) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - 12),
          animated: true,
        });
      }

      return;
    }

    const latitude = Number(selectedLocation.latitude);
    const longitude = Number(selectedLocation.longitude);
    const priceValue = parseInt(priceProposed, 10);

    // Date + heure saisies en HEURE DE MADAGASCAR (UTC+3) -> instant UTC
    const scheduledIso = scheduledIsoPreview;

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
        scheduled_date: scheduledIso,
        client_price_proposed: priceValue,
        special_instructions:
          specialInstructions.trim() || null,
        // Demande directe : verrouillée sur le thérapeute choisi.
        ...(lockedTherapistId
          ? { therapist_id: lockedTherapistId }
          : {}),
      };

      const result = await createBooking(payload);

      if (!result?.success) {
        const failMsg =
          result?.error ||
          'Impossible de créer la réservation. Veuillez réessayer.';

        setSubmitError(failMsg);
        showToast('error', 'Erreur', failMsg);

        return;
      }

      const therapistLabel =
        lockedTherapist?.fullname || lockedTherapist?.name || 'le thérapeute choisi';

      const createdBookingId =
        result?.data?.id ??
        result?.data?.booking_id ??
        null;

      // Récapitulatif capturé AVANT la remise à zéro du formulaire
      const recap = {
        massage:
          massageTypes.find((item) => item.id === selectedType)?.name || '',
        date: displayDate,
        time: displayTime,
        address: address.trim(),
        price: formatThousands(String(priceValue)),
        duration: selectedDuration,
      };

      showToast(
        'success',
        'Demande envoyée',
        lockedTherapistId
          ? `Votre demande a été envoyée à ${therapistLabel}. Place à la négociation.`
          : 'Votre demande a été envoyée aux thérapeutes à proximité.',
        4000
      );

      // Formulaire remis à zéro : écran neuf pour la prochaine demande.
      resetForm();

      // ✅ Message de confirmation visible sur web ET mobile
      // (les toasts ne s'affichent que sur le web).
      setSuccessInfo({
        locked: !!lockedTherapistId,
        therapistLabel,
        bookingId: createdBookingId,
        booking: result?.data,
        recap,
      });
    } catch (error) {
      console.error(
        'Submit error:',
        error
      );

      const catchMsg =
        error?.message ||
        'Une erreur est survenue lors de l’envoi de votre demande.';

      setSubmitError(catchMsg);
      showToast('error', 'Erreur', catchMsg);
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
          {/* ✅ Entête identique aux autres pages (barre verte + retour) */}
          <Header
            title="Votre position"
            subtitle="Déplacez le marqueur ou touchez la carte"
            showBack
            onBackPress={() => {
              setShowMapModal(false);

              showToast(
                'info',
                'Carte fermée',
                'La sélection de position a été fermée.'
              );
            }}
          />

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
          themeColors={dtColors}
          onChange={(value) => {
            const date =
              parseLocalDate(value);

            setSelectedDate(date);
            touch('schedule');

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
                dtColors.surface,
              borderColor:
                dtColors.border ||
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
                    dtColors.textSecondary,
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
                    dtColors.text,
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
              dtColors.textSecondary
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
            touch('schedule');

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
          themeColors={dtColors}
          onChange={(value) => {
            const time =
              parseTimeToDate(value);

            setSelectedTime(time);
            touch('schedule');

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
                dtColors.surface,
              borderColor:
                dtColors.border ||
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
                    dtColors.textSecondary,
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
                    dtColors.text,
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
              dtColors.textSecondary
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
            touch('schedule');

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
          {/* THÉRAPEUTE CHOISI (demande verrouillée) */}
          {/* ================================================= */}

          {lockedTherapistId ? (
            // Même marge latérale que les autres sections du formulaire.
            <View style={styles.section}>
              <LockedTherapistCard
                therapist={
                  lockedTherapist || {
                    therapist_id: lockedTherapistId,
                  }
                }
              />
            </View>
          ) : null}

          {/* ================================================= */}
          {/* MASSAGE TYPE */}
          {/* ================================================= */}

          <View
            style={styles.section}
            onLayout={(e) => {
              sectionY.current.type = e.nativeEvent.layout.y;
            }}
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
              Type de massage
            </Text>

            {IS_WEB ? (
              <>
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
                          styles.typeCardWeb,
                          {
                            backgroundColor:
                              themeColors.surface,
                            borderColor:
                              active
                                ? colors.primary
                                : typeErrorShown
                                ? ERROR_COLOR
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
                            styles.typeIconWeb,
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
                            styles.typeNameWeb,
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
                            styles.typePriceWeb,
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
              </>
            ) : (
              <>
            {/* ================================================= */}
            {/* GRILLE DES TYPES DE MASSAGE (web + Android + iOS) */}
            {/* ================================================= */}

            {massageTypesLoading &&
              massageTypes.length === 0 && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginVertical: spacing.md }}
                />
              )}

            {/* ✅ Android / iOS : UNE seule ligne, défilement horizontal */}
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.typeRow}
            >
              {massageTypes.map((type, index) => {
                const active = selectedType === type.id;
                const tone =
                  TYPE_TONES[index % TYPE_TONES.length];

                return (
                  <TouchableOpacity
                    key={type.id}
                    activeOpacity={0.82}
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor:
                          themeColors.surface,
                        borderColor: active
                          ? colors.primary
                          : typeErrorShown
                          ? ERROR_COLOR
                          : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setSelectedType(type.id);

                      showToast(
                        'success',
                        'Massage sélectionné',
                        type.name
                      );
                    }}
                  >
                    {active ? (
                      <View style={styles.typeCheck}>
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color="#FFFFFF"
                        />
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.typeIcon,
                        { backgroundColor: tone.bg },
                      ]}
                    >
                      <TypeCardVisual
                        imageUrl={type.imageUrl}
                        iconName={type.icon}
                        size={78}
                        tintColor={tone.fg}
                      />
                    </View>

                    <Text
                      style={[
                        styles.typeName,
                        { color: themeColors.text },
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
                      {type.price.toLocaleString('fr-FR')} Ar
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
              </>
            )}

            <FieldError message={typeErrorShown} />
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
              Préférence du thérapeute
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

          <View
            style={styles.section}
            onLayout={(e) => {
              sectionY.current.schedule = e.nativeEvent.layout.y;
            }}
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
              Date et heure
            </Text>

            <View style={styles.quickRow}>
              {[
                { id: 'today', label: "Aujourd'hui", days: 0 },
                { id: 'tomorrow', label: 'Demain', days: 1 },
                { id: 'other', label: 'Autre date', days: null },
              ].map((opt) => {
                const todayDate = getMadagascarTodayDate();
                const sameDay = (d1, d2) =>
                  d1.getFullYear() === d2.getFullYear() &&
                  d1.getMonth() === d2.getMonth() &&
                  d1.getDate() === d2.getDate();
                const tomorrowDate = new Date(todayDate);
                tomorrowDate.setDate(tomorrowDate.getDate() + 1);

                const isToday = sameDay(selectedDate, todayDate);
                const isTomorrow = sameDay(selectedDate, tomorrowDate);

                const active =
                  opt.id === 'today'
                    ? isToday && !forceOtherDate
                    : opt.id === 'tomorrow'
                    ? isTomorrow && !forceOtherDate
                    : forceOtherDate || (!isToday && !isTomorrow);

                return (
                  <TouchableOpacity
                    key={opt.id}
                    activeOpacity={0.8}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? colors.primary + '12'
                          : themeColors.surface,
                        borderColor: active
                          ? colors.primary
                          : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      touch('schedule');
                      if (opt.days === null) {
                        setForceOtherDate(true);
                        return;
                      }
                      setForceOtherDate(false);
                      const d = new Date(todayDate);
                      d.setDate(d.getDate() + opt.days);
                      setSelectedDate(d);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: active
                            ? colors.primary
                            : themeColors.text,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={
                styles.dateTimeContainer
              }
            >
              {renderDatePicker()}
              {renderTimePicker()}
            </View>

            <FieldError message={scheduleErrorShown} />
          </View>

          {/* ================================================= */}
          {/* ADDRESS */}
          {/* ================================================= */}

          <View
            style={styles.section}
            onLayout={(e) => {
              sectionY.current.address = e.nativeEvent.layout.y;
            }}
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
              Adresse du massage
            </Text>

            <View
              style={[
                styles.addressContainer,
                {
                  backgroundColor: addressErrorShown
                    ? errBg
                    : themeColors.surface,
                  borderColor: addressErrorShown
                    ? ERROR_COLOR
                    : themeColors.border || '#E0E0E0',
                },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={colors.primary}
              />

              <TextInput
                ref={addressInputRef}
                style={[
                  styles.addressInput,
                  { color: themeColors.text },
                ]}
                placeholder="Rechercher un lot, une adresse, une ville"
                placeholderTextColor={themeColors.textSecondary}
                value={address}
                onChangeText={handleAddressChange}
                onBlur={() => touch('address')}
                maxLength={MAX_ADDRESS_LENGTH}
                multiline={false}
                numberOfLines={1}
                returnKeyType="next"
                blurOnSubmit={false}
                autoCorrect={false}
                autoCapitalize="sentences"
                textAlignVertical="center"
              />

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleUseCurrentLocation}
                disabled={isSearchingLocation}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Utiliser ma position actuelle"
              >
                {isSearchingLocation ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                  />
                ) : (
                  <Ionicons
                    name="locate-outline"
                    size={22}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.mapPickBox,
                styles.mapPickBoxWithMap,
                locationErrorShown && {
                  borderColor: ERROR_COLOR,
                  backgroundColor: errBg,
                },
              ]}
              onPress={() => {
                if (selectedLocation?.latitude == null) {
                  setMapRegion(DEFAULT_REGION);
                }
                setShowMapModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Choisir sur la carte"
            >
              <MapPreview
                latitude={selectedLocation?.latitude}
                longitude={selectedLocation?.longitude}
                hasPosition={hasLocation}
              />
            </TouchableOpacity>

            <FieldError message={addressErrorShown} />
            <FieldError message={locationErrorShown} />
          </View>

          {/* ================================================= */}
          {/* PRICE */}
          {/* ================================================= */}

          <View
            style={styles.section}
            onLayout={(e) => {
              sectionY.current.price = e.nativeEvent.layout.y;
            }}
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
              Prix proposé
            </Text>

            <View
              style={[
                styles.priceContainer,
                {
                  backgroundColor: priceErrorShown
                    ? errBg
                    : themeColors.surface,
                  borderColor: priceErrorShown
                    ? ERROR_COLOR
                    : themeColors.border ||
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
                value={formatThousands(priceProposed)}
                onChangeText={handlePriceChange}
                onFocus={handlePriceFocus}
                onBlur={() => touch('price')}
                maxLength={11}
                keyboardType="numeric"
                inputMode="numeric"
                returnKeyType="done"
                blurOnSubmit={true}
                caretHidden={false}
                selectionColor={colors.primary}
                selectTextOnFocus={false}
              />
            </View>

            <View style={styles.quickRow}>
              {(() => {
                const base = getBasePrice();
                const current =
                  parseInt(priceProposed, 10) || base;
                const plus10 =
                  Math.round((current * 1.1) / 500) * 500;
                const rounded =
                  Math.ceil((base * 1.1) / 5000) * 5000;
                const fmt = (n) =>
                  Number(n).toLocaleString('fr-FR');

                return [
                  {
                    id: 'base',
                    label: `${fmt(base)} conseillé`,
                    value: base,
                  },
                  { id: 'plus', label: '+10%', value: plus10 },
                  {
                    id: 'round',
                    label: fmt(rounded === base ? base + 5000 : rounded),
                    value: rounded === base ? base + 5000 : rounded,
                  },
                ].map((chip) => (
                  <TouchableOpacity
                    key={chip.id}
                    activeOpacity={0.8}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: themeColors.surface,
                        borderColor:
                          String(chip.value) === String(priceProposed)
                            ? colors.primary
                            : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      touch('price');
                      setPriceProposed(
                        maskPriceDigits(String(chip.value))
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: themeColors.text },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                ));
              })()}
            </View>

            <Text
              style={[
                styles.priceHint,
                { color: themeColors.textSecondary },
              ]}
            >
              Minimum accepté : 20 000 Ar
            </Text>

            <FieldError message={priceErrorShown} />
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
                placeholder="Allergies, étage, code du portail..."
                placeholderTextColor={
                  themeColors.textSecondary
                }
                value={specialInstructions}
                onChangeText={handleInstructionsChange}
                onFocus={handleInstructionsFocus}
                onBlur={() => {}}
                multiline
                numberOfLines={3}
                maxLength={MAX_INSTRUCTIONS_LENGTH}
                textAlignVertical="top"
              />
            </View>

            <Text
              style={[
                styles.counterText,
                { color: themeColors.textSecondary },
              ]}
            >
              {specialInstructions.length}/{MAX_INSTRUCTIONS_LENGTH}
            </Text>
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
            <FieldError message={submitError} />

            {submitted &&
            (errors.type ||
              errors.address ||
              errors.location ||
              errors.schedule ||
              errors.price) ? (
              <FieldError message="Certains champs sont à corriger (en rouge) avant d’envoyer votre demande." />
            ) : null}

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

      {/* ====================================================== */}
      {/* ✅ MESSAGE DE CONFIRMATION — demande envoyée */}
      {/* ====================================================== */}

      <Modal
        visible={!!successInfo}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessNewRequest}
      >
        <View style={styles.successOverlay}>
          <View
            style={[
              styles.successCard,
              { backgroundColor: themeColors.surface },
            ]}
          >
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={38} color="#FFFFFF" />
            </View>

            <Text
              style={[styles.successTitle, { color: themeColors.text }]}
            >
              Demande envoyée avec succès !
            </Text>

            <Text
              style={[
                styles.successMessage,
                { color: themeColors.textSecondary },
              ]}
            >
              {successInfo?.locked
                ? `Votre demande a bien été envoyée à ${successInfo?.therapistLabel}. Vous pouvez maintenant négocier le prix.`
                : 'Votre demande a bien été enregistrée et envoyée aux thérapeutes à proximité. Vous serez notifié dès qu’un thérapeute vous répond.'}
            </Text>

            {successInfo?.recap ? (
              <View
                style={[
                  styles.successRecap,
                  { backgroundColor: colors.primary + '10' },
                ]}
              >
                {[
                  ['Massage', successInfo.recap.massage],
                  ['Durée', `${successInfo.recap.duration} min`],
                  [
                    'Rendez-vous',
                    `${successInfo.recap.date} à ${successInfo.recap.time}`,
                  ],
                  ['Adresse', successInfo.recap.address],
                  ['Prix proposé', `${successInfo.recap.price} Ar`],
                ].map(([label, value]) => (
                  <View key={label} style={styles.successRecapRow}>
                    <Text
                      style={[
                        styles.successRecapLabel,
                        { color: themeColors.textSecondary },
                      ]}
                    >
                      {label}
                    </Text>

                    <Text
                      style={[
                        styles.successRecapValue,
                        { color: themeColors.text },
                      ]}
                      numberOfLines={2}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.successPrimaryButton}
              onPress={handleSuccessContinue}
              accessibilityRole="button"
            >
              <Text style={styles.successPrimaryText}>
                {successInfo?.locked
                  ? 'Continuer vers la négociation'
                  : 'Voir mes demandes'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.successSecondaryButton}
              onPress={handleSuccessNewRequest}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.successSecondaryText,
                  { color: themeColors.textSecondary },
                ]}
              >
                Faire une nouvelle demande
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'transparent',
    borderWidth: 0,

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
  // SECTION
  // ==========================================================

  typeCardWeb: {
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

  typeIconWeb: {
    width: 78,

    height: 78,

    borderRadius: 20,

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 10,

    overflow: 'hidden',
  },

  typeNameWeb: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.medium,

    textAlign: 'center',

    lineHeight: 19,

    minHeight: 38,

    width: '100%',
  },

  typePriceWeb: {
    fontSize:
      typography.fontSize.xs,

    fontFamily:
      typography.fontFamily.regular,

    marginTop: 6,
  },

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Android / iOS : une seule ligne défilante (marge haute pour la pastille ✓)
  typeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 6,
    paddingRight: spacing.md,
  },

  typeCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },

  chipText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
  },

  mapPickBox: {
    marginTop: 8,
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },

  mapPickBoxWithMap: {
    minHeight: 150,
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },

  mapPreviewWrap: {
    width: '100%',
    height: 150,
  },

  mapPreviewMap: {
    width: '100%',
    height: '100%',
  },

  mapPreviewPin: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 38,
  },

  mapPreviewPill: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(46,139,87,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  mapPreviewPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontFamily: typography.fontFamily.medium,
  },

  mapPickText: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },

  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: 8,
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
    ...Platform.select({
      web: {
        flexBasis: 130,
        flexGrow: 1,
        maxWidth: 190,
        cursor: 'pointer',
        userSelect: 'none',
      },
      default: { width: 128 },
    }),
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
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
    marginBottom: 8,
    overflow: 'hidden',
  },

  typeName: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
    lineHeight: 16,
    minHeight: 32,
    width: '100%',
  },

  typePrice: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
  },

  // ==========================================================
  // DURATION
  // ==========================================================

  durationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  durationButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
  },

  durationText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
  },

  // ==========================================================
  // GENDER
  // ==========================================================

  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  genderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
  },

  genderText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
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
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
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
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
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
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
    marginRight: 8,
  },

  priceInput: {
    flex: 1,
    height: 46,
    minWidth: 0,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
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
  // ==========================================================
  // ✅ ERREURS DE CHAMPS (rouge)
  // ==========================================================

  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 2,
  },

  fieldErrorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: ERROR_COLOR,
    fontFamily: typography.fontFamily.medium,
  },

  counterText: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    fontFamily: typography.fontFamily.regular,
  },

  // ==========================================================
  // ✅ MESSAGE DE CONFIRMATION
  // ==========================================================

  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },

  successCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },

  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  successTitle: {
    fontSize: 18,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
  },

  successMessage: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: typography.fontFamily.regular,
  },

  successRecap: {
    width: '100%',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    gap: 8,
  },

  successRecapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  successRecapLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
  },

  successRecapValue: {
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
    fontFamily: typography.fontFamily.semiBold,
  },

  successPrimaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  successPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
  },

  successSecondaryButton: {
    paddingVertical: 12,
    marginTop: 4,
  },

  successSecondaryText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
  },

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
  }
});

export default BookingScreen;