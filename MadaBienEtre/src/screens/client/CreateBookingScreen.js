// src/screens/client/CreateBookingScreen.js

import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import AddressMapPickerModal from '../../components/map/AddressMapPickerModal';
import useLocationTracking from '../../hooks/useLocationTracking';

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
     TOAST STATES
     ============================================================ */

  const [toast, setToast] = useState({
    visible: false,
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
    isTracking,
    isLocating,
    errorMsg: trackingError,
    permissionGranted,
  } = useLocationTracking({ enabled: true });

  /* ============================================================
     MASSAGE TYPES
     ============================================================ */

  const massageTypes = [
    {
      id: 1,
      name: 'Massage Relaxant',
      icon: 'spa',
    },
    {
      id: 2,
      name: 'Deep Tissue',
      icon: 'bone',
    },
    {
      id: 3,
      name: 'Shiatsu',
      icon: 'finger-print',
    },
  ];

  /* ============================================================
     TOAST FUNCTION
     ============================================================ */

  const showToast = (
    message,
    type = 'info',
    duration = 2600
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
            message: '',
            type: 'info',
          });
        }
      });
    }, duration);
  };

  /* ============================================================
     CLEANUP TOAST TIMER
     ============================================================ */

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
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

  const handleUseCurrentLocation = () => {
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
        'Localisation refusée. Choisissez votre position sur la carte.',
        'warning',
        3500
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

  const handleAddressChange = (text) => {
    setAddress(text);

    // Si l'utilisateur modifie manuellement
    // l'adresse, les anciennes coordonnées ne sont
    // plus considérées comme fiables.
    setSelectedCoords(null);
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
          pointerEvents="none"
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

            <Text
              style={[
                styles.toastText,
                {
                  color: themeColors.text,
                },
              ]}
              numberOfLines={3}
            >
              {toast.message}
            </Text>
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

          <View style={styles.typesContainer}>
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
                    <Ionicons
                      name={type.icon}
                      size={30}
                      color={
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
          </View>

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
              multiline
            />
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
              {isLocating && !liveLocation ? (
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

  toastText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily.medium,
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
  },

  typeCard: {
    flex: 1,
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