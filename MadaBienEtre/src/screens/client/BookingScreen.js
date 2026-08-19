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
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
  Modal,
  Dimensions,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import DateTimePicker from '@react-native-community/datetimepicker';

import MapViewWrapper from '../../components/map/MapViewWrapper';
import { getAddressFromCoords } from '../../services/geocoding';
import { DEFAULT_REGION } from '../../config/googleMaps';

import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

const IS_WEB = Platform.OS === 'web';

const MAP_GREEN = '#00C853';
const MAP_GREEN_DARK = '#009624';

// ============================================================
// MASSAGE TYPES
// ============================================================

const MASSAGE_TYPES = [
  {
    id: 1,
    name: 'Massage Relaxant',
    duration: 60,
    price: 35000,
  },
  {
    id: 2,
    name: 'Deep Tissue',
    duration: 60,
    price: 45000,
  },
  {
    id: 3,
    name: 'Shiatsu',
    duration: 60,
    price: 40000,
  },
  {
    id: 4,
    name: 'Réflexologie',
    duration: 45,
    price: 30000,
  },
  {
    id: 5,
    name: 'Massage Sportif',
    duration: 60,
    price: 45000,
  },
  {
    id: 6,
    name: 'Pierres Chaudes',
    duration: 75,
    price: 55000,
  },
];

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

  const month = String(
    d.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    d.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value) => {
  if (!value) return new Date();

  const parts = value
    .split('-')
    .map(Number);

  if (parts.length !== 3) {
    return new Date();
  }

  const [
    year,
    month,
    day,
  ] = parts;

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

  const hours = String(
    date.getHours()
  ).padStart(2, '0');

  const minutes = String(
    date.getMinutes()
  ).padStart(2, '0');

  return `${hours}:${minutes}`;
};

const parseTimeToDate = (value) => {
  if (!value) {
    const d = new Date();

    d.setHours(
      9,
      0,
      0,
      0
    );

    return d;
  }

  const [
    hours,
    minutes,
  ] = value
    .split(':')
    .map(Number);

  const d = new Date();

  d.setHours(
    Number.isFinite(hours)
      ? hours
      : 9,

    Number.isFinite(minutes)
      ? minutes
      : 0,

    0,
    0
  );

  return d;
};

const formatDate = (date) => {
  if (!date) return '';

  return date.toLocaleDateString(
    'fr-FR',
    {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
};

const formatTime = (date) => {
  if (!date) return '';

  return date.toLocaleTimeString(
    'fr-FR',
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  );
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
          backgroundColor:
            themeColors.surface,

          borderColor:
            themeColors.border ||
            '#E0E0E0',
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
          const value =
            event.target.value;

          if (value) {
            onChange(value);
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
          backgroundColor:
            themeColors.surface,

          borderColor:
            themeColors.border ||
            '#E0E0E0',
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
          const value =
            event.target.value;

          if (value) {
            onChange(value);
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
// COMPONENT
// ============================================================

const BookingScreen = ({
  navigation,
  route,
}) => {
  const { therapist } =
    route.params || {};

  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const {
    token,
    user,
  } = useAuth();

  // ============================================================
  // FORM STATES
  // ============================================================

  const [
    selectedType,
    setSelectedType,
  ] = useState(null);

  const [
    selectedDuration,
    setSelectedDuration,
  ] = useState(60);

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(new Date());

  const [
    selectedTime,
    setSelectedTime,
  ] = useState(() => {
    const d = new Date();

    d.setHours(
      9,
      0,
      0,
      0
    );

    return d;
  });

  const [
    address,
    setAddress,
  ] = useState('');

  const [
    priceProposed,
    setPriceProposed,
  ] = useState('');

  const [
    preferredGender,
    setPreferredGender,
  ] = useState('any');

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    showDatePicker,
    setShowDatePicker,
  ] = useState(false);

  const [
    showTimePicker,
    setShowTimePicker,
  ] = useState(false);

  // ============================================================
  // MAP STATES
  // ============================================================

  const [
    showMapModal,
    setShowMapModal,
  ] = useState(false);

  const [
    selectedLocation,
    setSelectedLocation,
  ] = useState({
    latitude: null,
    longitude: null,
    address: '',
  });

  const [
    mapRegion,
    setMapRegion,
  ] = useState(DEFAULT_REGION);

  const [
    isSearchingLocation,
    setIsSearchingLocation,
  ] = useState(false);

  const [
    isLoadingAddress,
    setIsLoadingAddress,
  ] = useState(false);

  // ============================================================
  // TOAST STATE
  // ============================================================

  const [
    toast,
    setToast,
  ] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const toastTranslateY =
    useRef(
      new Animated.Value(-100)
    ).current;

  const toastOpacity =
    useRef(
      new Animated.Value(0)
    ).current;

  const toastTimerRef =
    useRef(null);

  // ============================================================
  // TOAST FUNCTION
  // ============================================================

  const hideToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(
        toastTimerRef.current
      );
    }

    Animated.parallel([
      Animated.timing(
        toastTranslateY,
        {
          toValue: -100,
          duration: 220,
          easing:
            Easing.out(
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
      clearTimeout(
        toastTimerRef.current
      );
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
      if (
        toastTimerRef.current
      ) {
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
    switch (toast.type) {
      case 'success':
        return {
          icon: 'checkmark-circle',
          color: '#00C853',
          background:
            isDark
              ? '#14271D'
              : '#FFFFFF',
        };

      case 'error':
        return {
          icon: 'close-circle',
          color: '#E53935',
          background:
            isDark
              ? '#2B1717'
              : '#FFFFFF',
        };

      case 'warning':
        return {
          icon: 'warning',
          color: '#FF9800',
          background:
            isDark
              ? '#2B2416'
              : '#FFFFFF',
        };

      default:
        return {
          icon: 'information-circle',
          color: colors.primary,
          background:
            isDark
              ? '#171F32'
              : '#FFFFFF',
        };
    }
  };

  // ============================================================
  // REFS
  // ============================================================

  const scrollViewRef =
    useRef(null);

  const addressInputRef =
    useRef(null);

  const priceInputRef =
    useRef(null);

  const mapRef =
    useRef(null);

  // ============================================================
  // DERIVED VALUES
  // ============================================================

  const displayDate = useMemo(
    () =>
      formatDate(
        selectedDate
      ),
    [selectedDate]
  );

  const displayTime = useMemo(
    () =>
      formatTime(
        selectedTime
      ),
    [selectedTime]
  );

  const webDateValue =
    useMemo(
      () =>
        formatLocalDate(
          selectedDate
        ),
      [selectedDate]
    );

  const webTimeValue =
    useMemo(
      () =>
        formatDateToTime(
          selectedTime
        ),
      [selectedTime]
    );

  // ============================================================
  // KEYBOARD
  // ============================================================

  useEffect(() => {
    if (IS_WEB) return;

    const listener =
      Keyboard.addListener(
        'keyboardDidShow',
        () => {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd(
              {
                animated: true,
              }
            );
          }, 150);
        }
      );

    return () => {
      listener.remove();
    };
  }, []);

  // ============================================================
  // BASE PRICE
  // ============================================================

  const getBasePrice = () => {
    const type =
      MASSAGE_TYPES.find(
        (item) =>
          item.id === selectedType
      );

    return (
      type?.price || 35000
    );
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
        )}, ${longitude.toFixed(
          6
        )}`;

      setSelectedLocation({
        latitude,
        longitude,
        address:
          fullAddress,
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
        )}, ${longitude.toFixed(
          6
        )}`,
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

  const handleUseCurrentLocation =
    async () => {
      if (
        isSearchingLocation
      ) {
        return;
      }

      setIsSearchingLocation(
        true
      );

      showToast(
        'info',
        'Localisation',
        'Recherche de votre position...'
      );

      try {
        // --------------------------------------------------------
        // WEB
        // --------------------------------------------------------

        if (IS_WEB) {
          if (
            !navigator.geolocation
          ) {
            showToast(
              'error',
              'Géolocalisation indisponible',
              "Votre navigateur ne prend pas en charge la géolocalisation."
            );

            return;
          }

          navigator.geolocation.getCurrentPosition(
            async (
              position
            ) => {
              const {
                latitude,
                longitude,
              } =
                position.coords;

              await updateLocation(
                latitude,
                longitude
              );

              setShowMapModal(
                true
              );

              setIsSearchingLocation(
                false
              );
            },
            (error) => {
              console.log(
                'Geolocation error:',
                error
              );

              showToast(
                'error',
                'Position inaccessible',
                "Autorisez la géolocalisation dans votre navigateur puis réessayez."
              );

              setIsSearchingLocation(
                false
              );
            },
            {
              enableHighAccuracy:
                true,
              timeout: 15000,
              maximumAge: 0,
            }
          );

          return;
        }

        // --------------------------------------------------------
        // IOS / ANDROID
        // --------------------------------------------------------

        const {
          status,
        } =
          await Location.requestForegroundPermissionsAsync();

        if (
          status !==
          'granted'
        ) {
          showToast(
            'error',
            'Permission refusée',
            "Veuillez autoriser l'accès à votre localisation."
          );

          return;
        }

        const location =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy
                  .High,
            }
          );

        const {
          latitude,
          longitude,
        } =
          location.coords;

        await updateLocation(
          latitude,
          longitude
        );

        setShowMapModal(
          true
        );
      } catch (error) {
        console.error(
          '❌ Current location:',
          error
        );

        showToast(
          'error',
          'Erreur de localisation',
          "Impossible d'obtenir votre position."
        );
      } finally {
        setIsSearchingLocation(
          false
        );
      }
    };

  // ============================================================
  // MAP PRESS
  // ============================================================

  const handleMapPress =
    async (
      coordinate
    ) => {
      if (!coordinate) {
        return;
      }

      const latitude =
        Number(
          coordinate.latitude
        );

      const longitude =
        Number(
          coordinate.longitude
        );

      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        )
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
  // VALIDATE MAP LOCATION
  // ============================================================

  const validateLocation =
    () => {
      const {
        latitude,
        longitude,
        address:
          selectedAddress,
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
          )}, ${longitude.toFixed(
            6
          )}`
      );

      setShowMapModal(
        false
      );

      showToast(
        'success',
        'Adresse sélectionnée',
        'La position du massage a été enregistrée.'
      );
    };

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit =
    async () => {
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

      if (
        !priceProposed ||
        parseInt(
          priceProposed,
          10
        ) < 20000
      ) {
        showToast(
          'warning',
          'Prix invalide',
          'Le prix proposé doit être au minimum de 20 000 Ar.'
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
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              1200
            )
        );

        showToast(
          'success',
          'Demande envoyée',
          'Votre demande a été envoyée aux thérapeutes à proximité.',
          4000
        );

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
          'Une erreur est survenue lors de l’envoi de votre demande.'
        );
      } finally {
        setIsLoading(false);
      }
    };

  // ============================================================
  // MAP MODAL
  // ============================================================

  const renderMapModal =
    () => {
      if (!showMapModal) {
        return null;
      }

      return (
        <Modal
          visible={
            showMapModal
          }
          transparent={false}
          animationType="slide"
          onRequestClose={() =>
            setShowMapModal(
              false
            )
          }
        >
          <View
            style={[
              styles.fullMapModal,
              {
                backgroundColor:
                  themeColors.background,
              },
            ]}
          >
            {/* HEADER */}

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
                style={
                  styles.mapHeaderLeft
                }
              >
                <View
                  style={
                    styles.mapHeaderIcon
                  }
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
                    Déplacez le marqueur ou touchez la carte
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
                  setShowMapModal(
                    false
                  );

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
                  color={
                    themeColors.text
                  }
                />
              </TouchableOpacity>
            </View>

            {/* MAP */}

            <View
              style={
                styles.mapMainContainer
              }
            >
              <MapViewWrapper
                ref={mapRef}
                style={styles.map}
                initialRegion={
                  mapRegion
                }
                region={
                  mapRegion
                }
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
                onMapPress={
                  handleMapPress
                }
                onSelectionDragEnd={
                  handleMapPress
                }
                showUserLocation={
                  true
                }
                trackUserLocation={
                  false
                }
                showMapTypeControl={
                  true
                }
                fitToMarkersOnLoad={
                  false
                }
              />

              {/* CENTER INDICATOR */}

              {isLoadingAddress && (
                <View
                  style={
                    styles.mapLoadingBadge
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.primary
                    }
                  />

                  <Text
                    style={
                      styles.mapLoadingText
                    }
                  >
                    Recherche de l'adresse...
                  </Text>
                </View>
              )}

              {/* GREEN MARKER LEGEND */}

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

            {/* BOTTOM PANEL */}

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

              {/* VALIDATE */}

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
                onPress={
                  validateLocation
                }
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
                  setShowMapModal(
                    false
                  );

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
        </Modal>
      );
    };

  // ============================================================
  // DATE PICKER
  // ============================================================

  const renderDatePicker =
    () => {
      if (IS_WEB) {
        return (
          <WebDateInput
            value={
              webDateValue
            }
            min={formatLocalDate(
              startOfLocalDay()
            )}
            themeColors={
              themeColors
            }
            onChange={(
              value
            ) => {
              const date =
                parseLocalDate(
                  value
                );

              setSelectedDate(
                date
              );

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
              setShowDatePicker(
                true
              )
            }
          >
            <Ionicons
              name="calendar-outline"
              size={21}
              color={
                colors.primary
              }
            />

            <View
              style={
                styles.dateTextBlock
              }
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
              value={
                selectedDate
              }
              mode="date"
              display="default"
              minimumDate={startOfLocalDay()}
              onChange={(
                event,
                date
              ) => {
                setShowDatePicker(
                  false
                );

                if (date) {
                  setSelectedDate(
                    date
                  );

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

  const renderTimePicker =
    () => {
      if (IS_WEB) {
        return (
          <WebTimeInput
            value={
              webTimeValue
            }
            themeColors={
              themeColors
            }
            onChange={(
              value
            ) => {
              const time =
                parseTimeToDate(
                  value
                );

              setSelectedTime(
                time
              );

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
              setShowTimePicker(
                true
              )
            }
          >
            <Ionicons
              name="time-outline"
              size={21}
              color={
                colors.primary
              }
            />

            <View
              style={
                styles.dateTextBlock
              }
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
              value={
                selectedTime
              }
              mode="time"
              is24Hour
              display="default"
              onChange={(
                event,
                time
              ) => {
                setShowTimePicker(
                  false
                );

                if (time) {
                  setSelectedTime(
                    time
                  );

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

  const toastConfig =
    getToastConfig();

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
        barStyle={
          isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={
          themeColors.background
        }
      />

      <Header
        title="Nouvelle réservation"
        showBack
      />

      {/* ====================================================== */}
      {/* GLOBAL TOAST */}
      {/* ====================================================== */}

      {toast.visible && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrapper,
            {
              opacity:
                toastOpacity,

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
              style={
                styles.toastContent
              }
            >
              {!!toast.title && (
                <Text
                  numberOfLines={
                    1
                  }
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
                  numberOfLines={
                    2
                  }
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
              onPress={
                hideToast
              }
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
              style={
                styles.toastClose
              }
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
        style={
          styles.keyboardView
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
        keyboardVerticalOffset={
          Platform.OS ===
          'ios'
            ? 100
            : 0
        }
      >
        <ScrollView
          ref={
            scrollViewRef
          }
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
          keyboardShouldPersistTaps="always"
          automaticallyAdjustKeyboardInsets={
            true
          }
        >
          {/* ================================================= */}
          {/* MASSAGE TYPE */}
          {/* ================================================= */}

          <View
            style={styles.section}
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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{
                paddingRight:
                  spacing.md,
              }}
            >
              {MASSAGE_TYPES.map(
                (type) => {
                  const active =
                    selectedType ===
                    type.id;

                  return (
                    <TouchableOpacity
                      key={
                        type.id
                      }
                      activeOpacity={
                        0.8
                      }
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
                        <Ionicons
                          name="sparkles"
                          size={23}
                          color={
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
                        numberOfLines={
                          2
                        }
                      >
                        {
                          type.name
                        }
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
          </View>

          {/* ================================================= */}
          {/* DURATION */}
          {/* ================================================= */}

          <View
            style={styles.section}
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
                      key={
                        duration
                      }
                      activeOpacity={
                        0.8
                      }
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
                        {
                          duration
                        }{' '}
                        min
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

          <View
            style={styles.section}
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
                  label:
                    'Peu importe',
                  icon:
                    'people-outline',
                },
                {
                  id: 'male',
                  label:
                    'Homme',
                  icon:
                    'man-outline',
                },
                {
                  id: 'female',
                  label:
                    'Femme',
                  icon:
                    'woman-outline',
                },
              ].map(
                (gender) => {
                  const active =
                    preferredGender ===
                    gender.id;

                  return (
                    <TouchableOpacity
                      key={
                        gender.id
                      }
                      activeOpacity={
                        0.8
                      }
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
                        {
                          gender.label
                        }
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>
          </View>

          {/* ================================================= */}
          {/* DATE & TIME */}
          {/* ================================================= */}

          <View
            style={styles.section}
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

          <View
            style={styles.section}
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
                color={
                  colors.primary
                }
              />

              <TextInput
                ref={
                  addressInputRef
                }
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
                multiline={
                  false
                }
                numberOfLines={
                  1
                }
                returnKeyType="next"
                blurOnSubmit={
                  false
                }
                autoCorrect={
                  false
                }
                autoCapitalize="sentences"
                textAlignVertical="center"
              />
            </View>

            <TouchableOpacity
              activeOpacity={
                0.8
              }
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

          <View
            style={styles.section}
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
                ref={
                  priceInputRef
                }
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
                value={
                  priceProposed
                }
                onChangeText={
                  setPriceProposed
                }
                keyboardType="numeric"
                returnKeyType="done"
                blurOnSubmit={
                  false
                }
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
          {/* SUBMIT */}
          {/* ================================================= */}

          <TouchableOpacity
            activeOpacity={
              0.85
            }
            style={[
              styles.submitButton,
              isLoading &&
                styles.submitButtonDisabled,
            ]}
            onPress={
              handleSubmit
            }
            disabled={
              isLoading
            }
          >
            {isLoading ? (
              <ActivityIndicator
                color="#fff"
              />
            ) : (
              <>
                <Ionicons
                  name="send"
                  size={20}
                  color="#fff"
                />

                <Text
                  style={
                    styles.submitButtonText
                  }
                >
                  Soumettre ma demande
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {renderMapModal()}
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    keyboardView: {
      flex: 1,
    },

    container: {
      flex: 1,
    },

    contentContainer: {
      paddingTop: spacing.sm,
      paddingBottom: 120,
    },

    // ========================================================
    // TOAST
    // ========================================================

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

    section: {
      paddingHorizontal:
        spacing.md,
      marginBottom:
        spacing.lg,
    },

    sectionTitle: {
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.semiBold,
      marginBottom:
        spacing.sm,
    },

    // ========================================================
    // MASSAGE
    // ========================================================

    typeCard: {
      width: 145,
      minHeight: 150,

      padding:
        spacing.md,

      borderRadius: 18,

      marginRight:
        spacing.sm,

      alignItems: 'center',

      borderWidth: 2,

      justifyContent:
        'center',
    },

    typeIcon: {
      width: 52,
      height: 52,

      borderRadius: 26,

      alignItems: 'center',
      justifyContent: 'center',

      marginBottom:
        spacing.sm,
    },

    typeName: {
      fontSize:
        typography.fontSize.sm,

      fontFamily:
        typography.fontFamily.medium,

      textAlign: 'center',

      lineHeight: 19,
    },

    typePrice: {
      fontSize:
        typography.fontSize.xs,

      fontFamily:
        typography.fontFamily.regular,

      marginTop: 5,
    },

    // ========================================================
    // DURATION
    // ========================================================

    durationContainer: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: spacing.sm,
    },

    durationButton: {
      paddingHorizontal:
        spacing.md,

      paddingVertical:
        spacing.sm,

      borderRadius: 12,

      borderWidth: 1,
    },

    durationText: {
      fontSize:
        typography.fontSize.sm,

      fontFamily:
        typography.fontFamily.medium,
    },

    // ========================================================
    // GENDER
    // ========================================================

    genderContainer: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: spacing.sm,
    },

    genderButton: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 6,

      paddingHorizontal:
        spacing.md,

      paddingVertical:
        spacing.sm,

      borderRadius: 12,

      borderWidth: 1,
    },

    genderText: {
      fontSize:
        typography.fontSize.sm,

      fontFamily:
        typography.fontFamily.medium,
    },

    // ========================================================
    // DATE / TIME
    // ========================================================

    dateTimeContainer: {
      flexDirection:
        'row',

      gap: spacing.sm,
    },

    webInputWrapper: {
      flex: 1,

      minWidth: 0,

      height: 48,

      borderRadius: 13,

      borderWidth: 1,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal: 12,

      gap: 8,
    },

    dateTimeButton: {
      flex: 1,

      minHeight: 62,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        spacing.md,

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

    // ========================================================
    // ADDRESS
    // ========================================================

    addressContainer: {
      minHeight: 54,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        spacing.md,

      borderRadius: 13,

      borderWidth: 1,

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

      outlineStyle:
        'none',
    },

    locationButton: {
      flexDirection:
        'row',

      alignItems:
        'center',

      marginTop: 10,

      gap: 7,

      paddingVertical: 5,
    },

    locationButtonText: {
      color:
        colors.primary,

      fontSize:
        typography.fontSize.sm,

      fontFamily:
        typography.fontFamily.medium,
    },

    // ========================================================
    // PRICE
    // ========================================================

    priceContainer: {
      height: 58,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        spacing.md,

      borderRadius: 13,

      borderWidth: 1,
    },

    priceCurrency: {
      fontSize:
        typography.fontSize.lg,

      fontFamily:
        typography.fontFamily.bold,

      color:
        colors.primary,

      marginRight:
        spacing.sm,
    },

    priceInput: {
      flex: 1,

      height: 50,

      fontSize:
        typography.fontSize.lg,

      fontFamily:
        typography.fontFamily.bold,

      padding: 0,

      outlineStyle:
        'none',
    },

    priceHint: {
      fontSize:
        typography.fontSize.xs,

      fontFamily:
        typography.fontFamily.regular,

      marginTop:
        spacing.xs,
    },

    // ========================================================
    // SUBMIT
    // ========================================================

    submitButton: {
      minHeight: 56,

      backgroundColor:
        colors.primary,

      borderRadius: 16,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexDirection:
        'row',

      gap: 10,

      marginHorizontal:
        spacing.md,

      marginTop:
        spacing.md,

      marginBottom:
        spacing.xl,

      shadowColor:
        colors.primary,

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity: 0.25,

      shadowRadius: 8,

      elevation: 5,
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

    // ========================================================
    // MAP MODAL
    // ========================================================

    fullMapModal: {
      flex: 1,
    },

    mapHeader: {
      minHeight: 76,

      paddingHorizontal: 16,
      paddingVertical: 12,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderBottomWidth: 1,

      zIndex: 10,
    },

    mapHeaderLeft: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flex: 1,

      gap: 10,
    },

    mapHeaderIcon: {
      width: 42,
      height: 42,

      borderRadius: 21,

      backgroundColor:
        MAP_GREEN,

      alignItems:
        'center',

      justifyContent:
        'center',
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

      alignItems:
        'center',

      justifyContent:
        'center',
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

      backgroundColor:
        '#fff',

      borderRadius: 12,

      paddingHorizontal: 13,
      paddingVertical: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 8,

      elevation: 5,

      shadowColor:
        '#000',

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

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 7,

      elevation: 4,

      shadowColor:
        '#000',

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

      backgroundColor:
        MAP_GREEN,

      borderWidth: 2,

      borderColor:
        '#fff',
    },

    markerInfoText: {
      fontSize: 12,
      fontWeight: '600',
    },

    // ========================================================
    // MAP BOTTOM
    // ========================================================

    mapBottomPanel: {
      paddingHorizontal: 16,

      paddingTop: 15,

      paddingBottom:
        Platform.OS ===
        'ios'
          ? 25
          : 16,

      borderTopWidth: 1,
    },

    addressTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

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

      justifyContent:
        'center',

      marginBottom: 12,
    },

    selectedAddressText: {
      fontSize: 13,
      lineHeight: 19,
    },

    validateMapButton: {
      height: 53,

      borderRadius: 15,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexDirection:
        'row',

      gap: 8,

      shadowColor:
        MAP_GREEN_DARK,

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

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop: 4,
    },

    cancelMapButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
  });

export default BookingScreen;