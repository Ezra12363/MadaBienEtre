// src/screens/therapist/CalendarScreen.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import {
  Calendar,
  LocaleConfig,
} from 'react-native-calendars';

import * as Animatable from 'react-native-animatable';

import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';

import bookingService from '../../services/bookingService';

// ============================================================
// CALENDAR - FR
// ============================================================

LocaleConfig.locales.fr = {
  monthNames: [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ],

  monthNamesShort: [
    'Janv.',
    'Févr.',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juil.',
    'Août',
    'Sept.',
    'Oct.',
    'Nov.',
    'Déc.',
  ],

  dayNames: [
    'Dimanche',
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
  ],

  dayNamesShort: [
    'Dim.',
    'Lun.',
    'Mar.',
    'Mer.',
    'Jeu.',
    'Ven.',
    'Sam.',
  ],
};

LocaleConfig.defaultLocale = 'fr';

// ============================================================
// HELPERS
// ============================================================

const normalizeStatus = (status) => {
  return String(status || 'pending')
    .trim()
    .toLowerCase();
};

const getBookingId = (booking) => {
  return (
    booking?.id ??
    booking?.booking_id ??
    booking?.bookingId ??
    null
  );
};

const getBookingDate = (booking) => {
  const value =
    booking?.scheduled_date ??
    booking?.scheduledDate ??
    booking?.date ??
    booking?.booking_date ??
    booking?.bookingDate ??
    booking?.scheduled_at ??
    booking?.scheduledAt ??
    null;

  if (!value) {
    return null;
  }

  // Exemple :
  // 2026-09-06T14:30:00
  // 2026-09-06
  const stringValue = String(value);

  return stringValue.includes('T')
    ? stringValue.split('T')[0]
    : stringValue.substring(0, 10);
};

const getBookingTime = (booking) => {
  const directTime =
    booking?.scheduled_time ??
    booking?.scheduledTime ??
    booking?.time ??
    null;

  if (directTime) {
    return String(directTime).slice(0, 5);
  }

  const dateTime =
    booking?.scheduled_date ??
    booking?.scheduledDate ??
    booking?.scheduled_at ??
    booking?.scheduledAt ??
    null;

  if (!dateTime) {
    return '--:--';
  }

  const value = String(dateTime);

  if (value.includes('T')) {
    const timePart = value.split('T')[1];

    if (timePart) {
      return timePart.substring(0, 5);
    }
  }

  return '--:--';
};

const getClientName = (booking) => {
  return (
    booking?.client_name ??
    booking?.client_fullname ??
    booking?.client?.fullname ??
    booking?.client?.full_name ??
    booking?.client?.name ??
    booking?.client_name ??
    'Client'
  );
};

const getMassageName = (booking) => {
  return (
    booking?.massage_type_name ??
    booking?.massageTypeName ??
    booking?.massage_type?.name ??
    booking?.massage_type?.title ??
    booking?.massage_type?.label ??
    booking?.massage ??
    'Massage'
  );
};

const getAddress = (booking) => {
  return (
    booking?.address ??
    booking?.client_location ??
    booking?.clientLocation ??
    booking?.location ??
    'Adresse non renseignée'
  );
};

const getPrice = (booking) => {
  const value =
    booking?.final_price ??
    booking?.finalPrice ??
    booking?.therapist_price ??
    booking?.therapistPrice ??
    booking?.client_price_proposed ??
    booking?.proposed_price ??
    booking?.price ??
    0;

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const formatPrice = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 'Prix non défini';
  }

  return `${number.toLocaleString('fr-FR')} Ar`;
};

const formatDateLong = (dateString) => {
  if (!dateString) {
    return '';
  }

  try {
    const date = new Date(
      `${dateString}T00:00:00`
    );

    return date.toLocaleDateString(
      'fr-FR',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  } catch (error) {
    return dateString;
  }
};

// ============================================================
// STATUS
// ============================================================

const STATUS_CONFIG = {
  pending: {
    label: 'En attente',
    icon: 'time-outline',
    color: '#FFA726',
  },

  negotiating: {
    label: 'Négociation',
    icon: 'swap-horizontal-outline',
    color: '#7E57C2',
  },

  confirmed: {
    label: 'Confirmée',
    icon: 'checkmark-circle-outline',
    color: '#4CAF50',
  },

  in_progress: {
    label: 'En cours',
    icon: 'play-circle-outline',
    color: '#FF9800',
  },

  completed: {
    label: 'Terminée',
    icon: 'checkmark-done-circle-outline',
    color: '#2E7D32',
  },

  cancelled: {
    label: 'Annulée',
    icon: 'close-circle-outline',
    color: '#D32F2F',
  },

  cancelled_by_client: {
    label: 'Annulée par client',
    icon: 'close-circle-outline',
    color: '#D32F2F',
  },

  cancelled_by_therapist: {
    label: 'Annulée par thérapeute',
    icon: 'close-circle-outline',
    color: '#D32F2F',
  },

  expired: {
    label: 'Expirée',
    icon: 'alert-circle-outline',
    color: '#757575',
  },
};

const getStatusConfig = (status) => {
  const normalized = normalizeStatus(status);

  return (
    STATUS_CONFIG[normalized] ||
    {
      label: normalized || 'Inconnu',
      icon: 'help-circle-outline',
      color: '#777',
    }
  );
};

// ============================================================
// MAIN
// ============================================================

const CalendarScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } =
    useTheme();

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [bookings, setBookings] =
    useState([]);

  const [selectedDate, setSelectedDate] =
    useState(null);

  const [selectedBookings, setSelectedBookings] =
    useState([]);

  const [errorMessage, setErrorMessage] =
    useState('');

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  // ==========================================================
  // LOAD REAL DATA FROM BACKEND
  // ==========================================================

  const loadBookings = useCallback(
    async ({
      refreshing = false,
    } = {}) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage('');

      try {
        console.log(
          '📥 [CALENDAR] Chargement des réservations depuis le backend...'
        );

        /*
         * IMPORTANT :
         *
         * On n'utilise plus :
         *
         * axios.get(`${API_URL}/bookings`)
         *
         * On utilise bookingService.getBookings()
         *
         * api.js gère alors le token / base URL.
         */

        const result =
          await bookingService.getBookings();

        console.log(
          '📦 [CALENDAR] Backend result:',
          result
        );

        if (!result?.success) {
          throw new Error(
            result?.error ||
              'Impossible de récupérer les réservations.'
          );
        }

        const realBookings =
          Array.isArray(result?.data)
            ? result.data
            : [];

        /*
         * Les données ici viennent directement
         * du backend et sont déjà normalisées
         * par bookingService.normalizeBooking().
         */

        const validBookings =
          realBookings
            .filter(
              (booking) =>
                getBookingId(booking) !== null &&
                getBookingDate(booking)
            )
            .sort((a, b) => {
              const dateA =
                `${getBookingDate(a)} ${getBookingTime(a)}`;

              const dateB =
                `${getBookingDate(b)} ${getBookingTime(b)}`;

              return dateA.localeCompare(dateB);
            });

        console.log(
          `✅ [CALENDAR] ${validBookings.length} réservation(s) réelle(s) reçue(s)`
        );

        setBookings(validBookings);

        // Si une date est déjà sélectionnée,
        // on recharge ses réservations.
        if (selectedDate) {
          const dayBookings =
            validBookings.filter(
              (booking) =>
                getBookingDate(booking) ===
                selectedDate
            );

          setSelectedBookings(dayBookings);
        }
      } catch (error) {
        console.error(
          '❌ [CALENDAR] Erreur:',
          error
        );

        setBookings([]);

        setSelectedBookings([]);

        setErrorMessage(
          error?.message ||
            'Impossible de charger les réservations.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedDate]
  );

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadBookings();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,

      // IMPORTANT pour Web :
      // useNativeDriver n'est pas supporté sur Web.
      useNativeDriver:
        Platform.OS !== 'web',
    }).start();
  }, []);

  // ==========================================================
  // RELOAD WHEN SCREEN GETS FOCUS
  // ==========================================================

  useFocusEffect(
    useCallback(() => {
      loadBookings({
        refreshing: false,
      });
    }, [loadBookings])
  );

  // ==========================================================
  // MARKED DATES
  // ==========================================================

  const markedDates = useMemo(() => {
    const marked = {};

    bookings.forEach((booking) => {
      const date =
        getBookingDate(booking);

      if (!date) {
        return;
      }

      const status =
        normalizeStatus(
          booking?.status
        );

      const statusConfig =
        getStatusConfig(status);

      if (!marked[date]) {
        marked[date] = {
          dots: [],
          selected: false,
        };
      }

      marked[date].dots.push({
        key: `${getBookingId(
          booking
        )}-${status}`,
        color: statusConfig.color,
      });
    });

    // Maximum 3 dots par date
    Object.keys(marked).forEach(
      (date) => {
        marked[date].dots =
          marked[date].dots.slice(
            0,
            3
          );
      }
    );

    // Date sélectionnée
    if (selectedDate) {
      if (!marked[selectedDate]) {
        marked[selectedDate] = {
          dots: [],
        };
      }

      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor:
          colors.primary,
      };
    }

    return marked;
  }, [bookings, selectedDate]);

  // ==========================================================
  // DAY PRESS
  // ==========================================================

  const onDayPress = (day) => {
    const date =
      day?.dateString;

    if (!date) {
      return;
    }

    setSelectedDate(date);

    const dayBookings =
      bookings.filter(
        (booking) =>
          getBookingDate(booking) ===
          date
      );

    setSelectedBookings(
      dayBookings
    );
  };

  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh = () => {
    loadBookings({
      refreshing: true,
    });
  };

  // ==========================================================
  // NAVIGATE BOOKING DETAIL
  // ==========================================================

  const openBooking = (booking) => {
    const bookingId =
      getBookingId(booking);

    if (!bookingId) {
      Alert.alert(
        'Erreur',
        'Identifiant de réservation introuvable.'
      );

      return;
    }

    navigation.navigate(
      'BookingDetail',
      {
        bookingId,
        booking,
      }
    );
  };

  // ==========================================================
  // START MASSAGE
  // ==========================================================

  const handleStartMassage = (
    booking
  ) => {
    const bookingId =
      getBookingId(booking);

    if (!bookingId) {
      Alert.alert(
        'Erreur',
        'Identifiant de réservation introuvable.'
      );

      return;
    }

    const status =
      normalizeStatus(
        booking?.status
      );

    if (status !== 'confirmed') {
      Alert.alert(
        'Action impossible',
        `Cette réservation est actuellement "${getStatusConfig(status).label}".`
      );

      return;
    }

    const execute = async () => {
      try {
        setIsLoading(true);

        console.log(
          `▶️ [CALENDAR] Démarrage du massage #${bookingId}`
        );

        /*
         * BACKEND RÉEL :
         *
         * PUT /bookings/start/{booking_id}
         *
         * via bookingService.startBooking()
         */

        const result =
          await bookingService.startBooking(
            bookingId
          );

        if (!result?.success) {
          throw new Error(
            result?.error ||
              'Impossible de démarrer le massage.'
          );
        }

        console.log(
          '✅ [CALENDAR] Massage démarré:',
          result?.data
        );

        Alert.alert(
          'Massage démarré',
          'La réservation est maintenant en cours.'
        );

        await loadBookings();
      } catch (error) {
        console.error(
          '❌ [CALENDAR] startBooking:',
          error
        );

        Alert.alert(
          'Erreur',
          error?.message ||
            'Impossible de démarrer le massage.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        window.confirm(
          'Voulez-vous commencer le massage ?'
        );

      if (confirmed) {
        execute();
      }

      return;
    }

    Alert.alert(
      'Commencer le massage',
      'Voulez-vous commencer le massage maintenant ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Commencer',
          onPress: execute,
        },
      ]
    );
  };

  // ==========================================================
  // COMPLETE MASSAGE
  // ==========================================================

  const handleCompleteMassage = (
    booking
  ) => {
    const bookingId =
      getBookingId(booking);

    if (!bookingId) {
      Alert.alert(
        'Erreur',
        'Identifiant de réservation introuvable.'
      );

      return;
    }

    const status =
      normalizeStatus(
        booking?.status
      );

    if (status !== 'in_progress') {
      Alert.alert(
        'Action impossible',
        `Cette réservation est actuellement "${getStatusConfig(status).label}".`
      );

      return;
    }

    const execute = async () => {
      try {
        setIsLoading(true);

        console.log(
          `✓ [CALENDAR] Fin du massage #${bookingId}`
        );

        /*
         * BACKEND RÉEL :
         *
         * PUT /bookings/complete/{booking_id}
         *
         * via bookingService.completeBooking()
         */

        const result =
          await bookingService.completeBooking(
            bookingId
          );

        if (!result?.success) {
          throw new Error(
            result?.error ||
              'Impossible de terminer le massage.'
          );
        }

        console.log(
          '✅ [CALENDAR] Massage terminé:',
          result?.data
        );

        Alert.alert(
          'Massage terminé',
          'La réservation est maintenant terminée.'
        );

        await loadBookings();
      } catch (error) {
        console.error(
          '❌ [CALENDAR] completeBooking:',
          error
        );

        Alert.alert(
          'Erreur',
          error?.message ||
            'Impossible de terminer le massage.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        window.confirm(
          'Voulez-vous terminer le massage ?'
        );

      if (confirmed) {
        execute();
      }

      return;
    }

    Alert.alert(
      'Terminer le massage',
      'Voulez-vous confirmer que le massage est terminé ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Terminer',
          style: 'default',
          onPress: execute,
        },
      ]
    );
  };

  // ==========================================================
  // BOOKING CARD
  // ==========================================================

  const renderBooking = (
    booking,
    index
  ) => {
    const bookingId =
      getBookingId(booking);

    const status =
      normalizeStatus(
        booking?.status
      );

    const statusConfig =
      getStatusConfig(status);

    const clientName =
      getClientName(booking);

    const massageName =
      getMassageName(booking);

    const time =
      getBookingTime(booking);

    const address =
      getAddress(booking);

    const price =
      getPrice(booking);

    return (
      <Animatable.View
        key={String(bookingId)}
        animation="fadeInUp"
        delay={index * 80}
        duration={450}
      >
        <View
          style={[
            styles.bookingItem,
            {
              backgroundColor:
                themeColors.background,
              borderColor:
                themeColors.border,
            },
          ]}
        >
          {/* TIME */}
          <View
            style={[
              styles.timeBox,
              {
                backgroundColor:
                  `${statusConfig.color}18`,
              },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={
                statusConfig.color
              }
            />

            <Text
              style={[
                styles.timeText,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              {time}
            </Text>
          </View>

          {/* MAIN INFO */}
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.bookingMain}
            onPress={() =>
              openBooking(booking)
            }
          >
            <View
              style={
                styles.clientRow
              }
            >
              <View
                style={[
                  styles.clientAvatar,
                  {
                    backgroundColor:
                      colors.primary +
                      '18',
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={
                    colors.primary
                  }
                />
              </View>

              <View
                style={
                  styles.clientTextBox
                }
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.clientName,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  {clientName}
                </Text>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.massageName,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {massageName}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.detailRow
              }
            >
              <Ionicons
                name="location-outline"
                size={14}
                color={
                  themeColors.textSecondary
                }
              />

              <Text
                numberOfLines={1}
                style={[
                  styles.detailText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                {address}
              </Text>
            </View>

            <View
              style={
                styles.priceRow
              }
            >
              <Ionicons
                name="cash-outline"
                size={14}
                color={
                  themeColors.textSecondary
                }
              />

              <Text
                style={[
                  styles.priceText,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                {formatPrice(price)}
              </Text>
            </View>
          </TouchableOpacity>

          {/* RIGHT SIDE */}
          <View
            style={
              styles.rightColumn
            }
          >
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    `${statusConfig.color}18`,
                },
              ]}
            >
              <Ionicons
                name={
                  statusConfig.icon
                }
                size={13}
                color={
                  statusConfig.color
                }
              />

              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      statusConfig.color,
                  },
                ]}
              >
                {statusConfig.label}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.detailsButton,
                {
                  borderColor:
                    colors.primary,
                },
              ]}
              onPress={() =>
                openBooking(booking)
              }
            >
              <Ionicons
                name="eye-outline"
                size={16}
                color={
                  colors.primary
                }
              />

              <Text
                style={[
                  styles.detailsButtonText,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                Détails
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ==================================================
            CONFIRMED → START
        ================================================== */}

        {status === 'confirmed' && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  '#4CAF50',
              },
            ]}
            onPress={() =>
              handleStartMassage(
                booking
              )
            }
          >
            <Ionicons
              name="play-circle-outline"
              size={20}
              color="#fff"
            />

            <Text
              style={
                styles.actionButtonText
              }
            >
              Commencer le massage
            </Text>
          </TouchableOpacity>
        )}

        {/* ==================================================
            IN_PROGRESS → COMPLETE
        ================================================== */}

        {status === 'in_progress' && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  '#2E7D32',
              },
            ]}
            onPress={() =>
              handleCompleteMassage(
                booking
              )
            }
          >
            <Ionicons
              name="checkmark-done-circle-outline"
              size={20}
              color="#fff"
            />

            <Text
              style={
                styles.actionButtonText
              }
            >
              Terminer le massage
            </Text>
          </TouchableOpacity>
        )}

        {/* ==================================================
            COMPLETED
        ================================================== */}

        {status === 'completed' && (
          <View
            style={[
              styles.completedInfo,
              {
                backgroundColor:
                  '#2E7D3212',
                borderColor:
                  '#2E7D3230',
              },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#2E7D32"
            />

            <Text
              style={[
                styles.completedInfoText,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Massage terminé
            </Text>
          </View>
        )}
      </Animatable.View>
    );
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (isLoading && bookings.length === 0) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color:
                themeColors.textSecondary,
            },
          ]}
        >
          Chargement du calendrier...
        </Text>
      </View>
    );
  }

  // ==========================================================
  // RENDER
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
      <Header
        title="Calendrier"
        showBack
      />

      <Animated.ScrollView
        style={[
          styles.scrollView,
          {
            opacity: fadeAnim,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              isRefreshing
            }
            onRefresh={
              handleRefresh
            }
            tintColor={
              colors.primary
            }
          />
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* ==================================================
            ERROR
        ================================================== */}

        {errorMessage ? (
          <Animatable.View
            animation="fadeIn"
            style={[
              styles.errorCard,
              {
                backgroundColor:
                  '#D32F2F12',
                borderColor:
                  '#D32F2F35',
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color="#D32F2F"
            />

            <View
              style={
                styles.errorContent
              }
            >
              <Text
                style={[
                  styles.errorTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Impossible de charger les données
              </Text>

              <Text
                style={[
                  styles.errorText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                {errorMessage}
              </Text>

              <TouchableOpacity
                style={[
                  styles.retryButton,
                  {
                    borderColor:
                      colors.primary,
                  },
                ]}
                onPress={() =>
                  loadBookings()
                }
              >
                <Text
                  style={[
                    styles.retryText,
                    {
                      color:
                        colors.primary,
                    },
                  ]}
                >
                  Réessayer
                </Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        ) : null}

        {/* ==================================================
            SUMMARY
        ================================================== */}

        <Animatable.View
          animation="fadeInDown"
          duration={500}
        >
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={
                styles.summaryHeader
              }
            >
              <View>
                <Text
                  style={[
                    styles.summaryTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Mes réservations
                </Text>

                <Text
                  style={[
                    styles.summarySubtitle,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Données réelles du serveur
                </Text>
              </View>

              <View
                style={[
                  styles.totalBadge,
                  {
                    backgroundColor:
                      colors.primary +
                      '18',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.totalBadgeText,
                    {
                      color:
                        colors.primary,
                    },
                  ]}
                >
                  {bookings.length}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.legendRow
              }
            >
              <Legend
                color="#4CAF50"
                label="Confirmée"
                themeColors={
                  themeColors
                }
              />

              <Legend
                color="#FF9800"
                label="En cours"
                themeColors={
                  themeColors
                }
              />

              <Legend
                color="#2E7D32"
                label="Terminée"
                themeColors={
                  themeColors
                }
              />
            </View>
          </View>
        </Animatable.View>

        {/* ==================================================
            CALENDAR
        ================================================== */}

        <Animatable.View
          animation="fadeInDown"
          duration={600}
        >
          <View
            style={[
              styles.calendarCard,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <Calendar
              onDayPress={
                onDayPress
              }
              markedDates={
                markedDates
              }
              markingType="multi-dot"
              enableSwipeMonths
              theme={{
                backgroundColor:
                  themeColors.surface,

                calendarBackground:
                  themeColors.surface,

                textSectionTitleColor:
                  themeColors.textSecondary,

                selectedDayBackgroundColor:
                  colors.primary,

                selectedDayTextColor:
                  '#fff',

                todayTextColor:
                  colors.primary,

                dayTextColor:
                  themeColors.text,

                textDisabledColor:
                  themeColors.textSecondary,

                dotColor:
                  colors.primary,

                selectedDotColor:
                  '#fff',

                arrowColor:
                  colors.primary,

                monthTextColor:
                  themeColors.text,

                textDayFontFamily:
                  typography.fontFamily
                    .regular,

                textMonthFontFamily:
                  typography.fontFamily
                    .bold,

                textDayHeaderFontFamily:
                  typography.fontFamily
                    .medium,

                textDayFontSize: 14,

                textMonthFontSize: 16,

                textDayHeaderFontSize: 12,
              }}
            />
          </View>
        </Animatable.View>

        {/* ==================================================
            SELECTED DAY
        ================================================== */}

        {selectedDate && (
          <Animatable.View
            animation="fadeInUp"
            delay={100}
            duration={500}
          >
            <View
              style={[
                styles.bookingsCard,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <View
                style={
                  styles.bookingsHeader
                }
              >
                <View
                  style={
                    styles.dateTitleBox
                  }
                >
                  <Text
                    style={[
                      styles.bookingsTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Réservations
                  </Text>

                  <Text
                    style={[
                      styles.selectedDateText,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    {formatDateLong(
                      selectedDate
                    )}
                  </Text>
                </View>

                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor:
                        colors.primary +
                        '18',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countBadgeText,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    {
                      selectedBookings.length
                    }
                  </Text>
                </View>
              </View>

              {/* BOOKINGS */}
              {selectedBookings.length >
              0 ? (
                selectedBookings.map(
                  renderBooking
                )
              ) : (
                <View
                  style={
                    styles.emptyState
                  }
                >
                  <View
                    style={[
                      styles.emptyIcon,
                      {
                        backgroundColor:
                          themeColors.background,
                      },
                    ]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={38}
                      color={
                        themeColors.textSecondary
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.emptyStateTitle,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Aucune réservation
                  </Text>

                  <Text
                    style={[
                      styles.emptyStateText,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Il n'y a aucune réservation
                    pour cette date.
                  </Text>
                </View>
              )}
            </View>
          </Animatable.View>
        )}

        {/* ==================================================
            NO DATE SELECTED
        ================================================== */}

        {!selectedDate && (
          <Animatable.View
            animation="fadeInUp"
            delay={150}
            duration={500}
          >
            <View
              style={[
                styles.instructionCard,
                {
                  backgroundColor:
                    themeColors.surface,
                  borderColor:
                    themeColors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.instructionIcon,
                  {
                    backgroundColor:
                      colors.primary +
                      '18',
                  },
                ]}
              >
                <Ionicons
                  name="hand-left-outline"
                  size={26}
                  color={
                    colors.primary
                  }
                />
              </View>

              <View
                style={
                  styles.instructionContent
                }
              >
                <Text
                  style={[
                    styles.instructionTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Sélectionnez une date
                </Text>

                <Text
                  style={[
                    styles.instructionText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Touchez une date dans le
                  calendrier pour afficher les
                  réservations.
                </Text>
              </View>
            </View>
          </Animatable.View>
        )}

        {/* ==================================================
            NO BOOKINGS AT ALL
        ================================================== */}

        {bookings.length === 0 &&
          !errorMessage && (
            <View
              style={[
                styles.globalEmptyCard,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <Ionicons
                name="calendar-clear-outline"
                size={50}
                color={
                  themeColors.textSecondary
                }
              />

              <Text
                style={[
                  styles.globalEmptyTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Aucun rendez-vous
              </Text>

              <Text
                style={[
                  styles.globalEmptyText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Vous n'avez actuellement aucune
                réservation enregistrée.
              </Text>
            </View>
          )}
      </Animated.ScrollView>
    </View>
  );
};

// ============================================================
// LEGEND COMPONENT
// ============================================================

const Legend = ({
  color,
  label,
  themeColors,
}) => {
  return (
    <View
      style={styles.legendItem}
    >
      <View
        style={[
          styles.legendDot,
          {
            backgroundColor: color,
          },
        ]}
      />

      <Text
        style={[
          styles.legendText,
          {
            color:
              themeColors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily:
      typography.fontFamily.regular,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  // ========================================================
  // ERROR
  // ========================================================

  errorCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.md,
  },

  errorContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  errorTitle: {
    fontSize: 14,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  errorText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontFamily:
      typography.fontFamily.regular,
  },

  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10,
  },

  retryText: {
    fontSize: 12,
    fontFamily:
      typography.fontFamily.medium,
  },

  // ========================================================
  // SUMMARY
  // ========================================================

  summaryCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summaryTitle: {
    fontSize:
      typography.fontSize.lg,
    fontFamily:
      typography.fontFamily.bold,
  },

  summarySubtitle: {
    marginTop: 3,
    fontSize:
      typography.fontSize.xs,
    fontFamily:
      typography.fontFamily.regular,
  },

  totalBadge: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalBadgeText: {
    fontSize: 16,
    fontFamily:
      typography.fontFamily.bold,
  },

  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 5,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },

  legendText: {
    fontSize: 11,
    fontFamily:
      typography.fontFamily.regular,
  },

  // ========================================================
  // CALENDAR
  // ========================================================

  calendarCard: {
    borderRadius: 16,
    padding: spacing.sm,
    marginBottom: spacing.md,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // ========================================================
  // BOOKINGS
  // ========================================================

  bookingsCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  bookingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },

  dateTitleBox: {
    flex: 1,
    paddingRight: spacing.sm,
  },

  bookingsTitle: {
    fontSize:
      typography.fontSize.lg,
    fontFamily:
      typography.fontFamily.bold,
  },

  selectedDateText: {
    marginTop: 4,
    fontSize:
      typography.fontSize.sm,
    fontFamily:
      typography.fontFamily.medium,
    textTransform: 'capitalize',
  },

  countBadge: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countBadgeText: {
    fontSize: 13,
    fontFamily:
      typography.fontFamily.bold,
  },

  // ========================================================
  // BOOKING ITEM
  // ========================================================

  bookingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 13,
    padding: 10,
    marginBottom: 8,
  },

  timeBox: {
    width: 58,
    minHeight: 58,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  timeText: {
    fontSize: 12,
    fontFamily:
      typography.fontFamily.bold,
    marginTop: 3,
  },

  bookingMain: {
    flex: 1,
    minWidth: 0,
  },

  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  clientAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  clientTextBox: {
    flex: 1,
    minWidth: 0,
  },

  clientName: {
    fontSize: 13,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  massageName: {
    fontSize: 11,
    marginTop: 2,
    fontFamily:
      typography.fontFamily.regular,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },

  detailText: {
    flex: 1,
    marginLeft: 4,
    fontSize: 10,
    fontFamily:
      typography.fontFamily.regular,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  priceText: {
    marginLeft: 4,
    fontSize: 11,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  rightColumn: {
    alignItems: 'flex-end',
    marginLeft: 7,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
  },

  statusText: {
    marginLeft: 3,
    fontSize: 9,
    fontFamily:
      typography.fontFamily.medium,
  },

  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginTop: 7,
  },

  detailsButtonText: {
    marginLeft: 3,
    fontSize: 9,
    fontFamily:
      typography.fontFamily.medium,
  },

  // ========================================================
  // ACTION BUTTONS
  // ========================================================

  actionButton: {
    minHeight: 44,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
    marginBottom: 10,
    paddingHorizontal: 14,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily:
      typography.fontFamily.semiBold,
    marginLeft: 7,
  },

  completedInfo: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
    marginBottom: 10,
  },

  completedInfoText: {
    fontSize: 12,
    fontFamily:
      typography.fontFamily.medium,
    marginLeft: 7,
  },

  // ========================================================
  // EMPTY
  // ========================================================

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyStateTitle: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  emptyStateText: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    fontFamily:
      typography.fontFamily.regular,
  },

  // ========================================================
  // INSTRUCTION
  // ========================================================

  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  instructionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  instructionContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  instructionTitle: {
    fontSize: 14,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  instructionText: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
    fontFamily:
      typography.fontFamily.regular,
  },

  // ========================================================
  // GLOBAL EMPTY
  // ========================================================

  globalEmptyCard: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },

  globalEmptyTitle: {
    fontSize: 16,
    marginTop: spacing.sm,
    fontFamily:
      typography.fontFamily.semiBold,
  },

  globalEmptyText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 5,
    fontFamily:
      typography.fontFamily.regular,
  },
});

export default CalendarScreen;