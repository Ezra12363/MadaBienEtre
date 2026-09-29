// ============================================================
// MADA BIEN-ÊTRE — THERAPIST
// CLIENT GROUP — PAGE DÉDIÉE
// ------------------------------------------------------------
// WEB : pleine largeur + pleine hauteur
// ANDROID : interface conservée en colonne
// + FILTRAGE PAR STATUT + FILTRAGE PAR DATE (CALENDRIER)
// ============================================================

import { useCallback, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
  StyleSheet,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import offerService from '../../services/offerService';
import Header from '../../components/common/Header';
import { useTheme } from '../../context/ThemeContext';

import {
  COLORS,
  Toast,
  ConfirmationModal,
  ClientAvatar,
  createStyles,
  normalizeArray,
  normalizeStatus,
  getStatusUI,
  getClientName,
  getPhone,
  getClientPhoto,
  getClientOnline,
  getRequestedAt,
  getExpiresAt,
  isOfferExpired,
  getMassageName,
  getPrice,
  getDuration,
  getDistance,
  getAddress,
  getLatitude,
  getLongitude,
  getRelativeTimeLabel,
  formatPrice,
  formatDateLong,
  formatTimeShort,
  getOfferId,
  isActiveClientOffer,
} from './OffersScreen';

// ============================================================
// LABELS STATUT (pour les pastilles de filtre)
// ============================================================

const STATUS_FILTER_LABELS = {
  all: 'Tous',
  pending: 'En attente',
  negotiating: 'Négociation',
  confirmed: 'Confirmée',
  completed: 'Terminée',
  cancelled: 'Annulée',
  rejected: 'Refusée',
};

const getStatusFilterLabel = status => {
  if (STATUS_FILTER_LABELS[status]) {
    return STATUS_FILTER_LABELS[status];
  }

  if (!status) {
    return 'Statut';
  }

  return (
    String(status).charAt(0).toUpperCase() +
    String(status).slice(1)
  );
};

// ============================================================
// HELPERS CALENDRIER
// ============================================================

const WEEKDAY_LABELS = [
  'Lu',
  'Ma',
  'Me',
  'Je',
  'Ve',
  'Sa',
  'Di',
];

const isSameDay = (dateA, dateB) => {
  if (!dateA || !dateB) {
    return false;
  }

  const a =
    dateA instanceof Date
      ? dateA
      : new Date(dateA);

  const b =
    dateB instanceof Date
      ? dateB
      : new Date(dateB);

  if (
    Number.isNaN(a.getTime()) ||
    Number.isNaN(b.getTime())
  ) {
    return false;
  }

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const dateKey = date =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const getMonthMatrix = (year, month) => {
  const firstDay = new Date(year, month, 1);

  // Lundi = 0 ... Dimanche = 6
  const startWeekday =
    (firstDay.getDay() + 6) % 7;

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const matrix = [];

  let day = 1 - startWeekday;

  while (day <= daysInMonth) {
    const week = [];

    for (let i = 0; i < 7; i++) {
      if (day < 1 || day > daysInMonth) {
        week.push(null);
      } else {
        week.push(
          new Date(year, month, day)
        );
      }

      day++;
    }

    matrix.push(week);
  }

  return matrix;
};

const formatMonthLabel = date =>
  date
    .toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
    .replace(/^./, c => c.toUpperCase());

const formatShortDate = date =>
  date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

// ============================================================
// ACTION STATE
// ============================================================

const computeActionState = booking => {
  const status = normalizeStatus(booking);

  const showNegotiation =
    status === 'pending' || status === 'negotiating';

  const hasClientOffer =
    !!booking?._activeClientOffer &&
    !!getOfferId(booking._activeClientOffer);

  const showAcceptReject =
    status === 'negotiating' && hasClientOffer;

  return {
    showNegotiation,
    showAcceptReject,
  };
};

// ============================================================
// SCREEN
// ============================================================

export default function ClientGroupScreen({
  navigation,
  route,
}) {
  const { colors, isDark } = useTheme();

  const baseStyles = useMemo(
    () => createStyles(colors, isDark),
    [colors, isDark]
  );

  const insets = useSafeAreaInsets();

  const isWeb = Platform.OS === 'web';

  const sheetBottomPadding =
    Math.max(
      insets.bottom,
      Platform.OS === 'android' ? 16 : 0
    ) + 18;

  const initialGroup =
    route?.params?.group ?? null;

  // ==========================================================
  // STATE
  // ==========================================================

  const [clientName] = useState(
    initialGroup?.name || 'Client'
  );

  const [bookings, setBookings] = useState(
    initialGroup?.bookings ?? []
  );

  const [refreshing, setRefreshing] =
    useState(false);

  const [busyId, setBusyId] =
    useState(null);

  const [hoveredId, setHoveredId] =
    useState(null);

  const [toast, setToast] =
    useState(null);

  const [confirmModal, setConfirmModal] =
    useState(null);

  const [actionSheetBooking, setActionSheetBooking] =
    useState(null);

  // ----------------------------------------------------------
  // FILTRES (STATUT + DATE)
  // ----------------------------------------------------------

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [selectedDate, setSelectedDate] =
    useState(null);

  const [showCalendarModal, setShowCalendarModal] =
    useState(false);

  const [calendarCursor, setCalendarCursor] =
    useState(() => new Date());

  const toastTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  // ==========================================================
  // WEB STYLES
  // ==========================================================

  const webStyles = useMemo(
    () =>
      StyleSheet.create({
        fullScreen: {
          flex: 1,
          width: '100%',
          minWidth: 0,
          minHeight: 0,
          alignSelf: 'stretch',
        },

        webPage: {
          flex: 1,
          width: '100%',
          minWidth: 0,
          minHeight: 0,
          alignSelf: 'stretch',
          backgroundColor:
            colors.background || '#F5F7F6',
        },

        webSubHeader: {
          width: '100%',
          minHeight: 46,
          paddingHorizontal: 28,
          paddingVertical: 12,
          alignSelf: 'stretch',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          borderBottomWidth: 1,
          borderBottomColor:
            colors.border || '#E5E7EB',
          backgroundColor:
            colors.card || '#FFFFFF',
        },

        webSubHeaderText: {
          fontSize: 14,
          fontWeight: '600',
          color:
            colors.text || '#1F2937',
          marginLeft: 8,
        },

        webListWrapper: {
          flex: 1,
          width: '100%',
          minWidth: 0,
          minHeight: 0,
          alignSelf: 'stretch',
          overflow: 'hidden',
        },

        webListContent: {
          width: '100%',
          minWidth: 0,
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 40,
          alignSelf: 'stretch',
        },

        webColumnWrapper: {
          width: '100%',
          minWidth: 0,
          alignSelf: 'stretch',
          justifyContent: 'space-between',
        },

        webCard: {
          flex: 1,
          minWidth: 0,
          width: 'auto',
          marginHorizontal: 8,
          marginBottom: 16,
        },

        webEmpty: {
          flex: 1,
          width: '100%',
          minHeight: 360,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 30,
        },
      }),
    [colors]
  );

  // ==========================================================
  // FILTER / CALENDAR STYLES
  // ==========================================================

  const filterStyles = useMemo(
    () =>
      StyleSheet.create({
        filtersBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor:
            colors.border || '#E5E7EB',
          backgroundColor:
            colors.card || '#FFFFFF',
        },

        webFiltersBar: {
          paddingHorizontal: 28,
        },

        statusScroll: {
          flex: 1,
        },

        statusScrollContent: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingRight: 8,
        },

        statusPill: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          borderWidth: 1,
          borderColor:
            colors.border || '#E5E7EB',
          backgroundColor:
            colors.background || '#F5F7F6',
          marginRight: 8,
        },

        statusPillActive: {
          backgroundColor: COLORS.primary,
          borderColor: COLORS.primary,
        },

        statusPillText: {
          fontSize: 12,
          fontWeight: '600',
          color:
            colors.textSecondary || '#6B7280',
        },

        statusPillTextActive: {
          color: COLORS.white,
        },

        dateButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.primary,
        },

        dateButtonActive: {
          backgroundColor: COLORS.primary,
        },

        dateButtonText: {
          fontSize: 12,
          fontWeight: '600',
          color: COLORS.primary,
          marginLeft: 6,
        },

        dateButtonTextActive: {
          color: COLORS.white,
        },

        resetButton: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            colors.background || '#F5F7F6',
          borderWidth: 1,
          borderColor:
            colors.border || '#E5E7EB',
          marginLeft: 4,
        },

        calendarOverlay: {
          flex: 1,
          backgroundColor:
            'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
        },

        calendarCard: {
          width: '100%',
          maxWidth: 360,
          borderRadius: 18,
          padding: 18,
          backgroundColor:
            colors.card || '#FFFFFF',
        },

        calendarHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        },

        calendarMonthLabel: {
          fontSize: 15,
          fontWeight: '700',
          color:
            colors.text || '#1F2937',
        },

        calendarNavButton: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            colors.background || '#F5F7F6',
        },

        calendarWeekRow: {
          flexDirection: 'row',
          marginBottom: 6,
        },

        calendarWeekdayCell: {
          flex: 1,
          alignItems: 'center',
        },

        calendarWeekdayText: {
          fontSize: 11,
          fontWeight: '700',
          color:
            colors.textSecondary || '#6B7280',
        },

        calendarDayCell: {
          flex: 1,
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
          margin: 2,
          borderRadius: 10,
        },

        calendarDayCellToday: {
          borderWidth: 1,
          borderColor: COLORS.primary,
        },

        calendarDayCellSelected: {
          backgroundColor: COLORS.primary,
        },

        calendarDayText: {
          fontSize: 13,
          color:
            colors.text || '#1F2937',
        },

        calendarDayTextSelected: {
          color: COLORS.white,
          fontWeight: '700',
        },

        calendarDot: {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: COLORS.primary,
          position: 'absolute',
          bottom: 4,
        },

        calendarDotSelected: {
          backgroundColor: COLORS.white,
        },

        calendarFooterRow: {
          flexDirection: 'row',
          marginTop: 14,
          gap: 10,
        },

        calendarFooterButton: {
          flex: 1,
          paddingVertical: 11,
          borderRadius: 12,
          alignItems: 'center',
        },

        calendarFooterButtonPrimary: {
          backgroundColor: COLORS.primary,
        },

        calendarFooterButtonSecondary: {
          backgroundColor:
            colors.background || '#F5F7F6',
          borderWidth: 1,
          borderColor:
            colors.border || '#E5E7EB',
        },

        calendarFooterButtonTextPrimary: {
          color: COLORS.white,
          fontWeight: '700',
          fontSize: 13,
        },

        calendarFooterButtonTextSecondary: {
          color:
            colors.text || '#1F2937',
          fontWeight: '600',
          fontSize: 13,
        },

        emptyResetButton: {
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: COLORS.primary,
        },

        emptyResetButtonText: {
          color: COLORS.primary,
          fontWeight: '700',
          fontSize: 13,
          marginLeft: 6,
        },
      }),
    [colors]
  );

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = useCallback(
    (type, message) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      setToast({
        type,
        message,
      });

      toastTimerRef.current = setTimeout(
        () => setToast(null),
        3000
      );
    },
    []
  );

  // ==========================================================
  // FERMETURE APRÈS ACTION
  // ==========================================================

  const closeAfterAction = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = setTimeout(() => {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      } else {
        navigation?.navigate?.('Offers');
      }
    }, 550);
  }, [navigation]);

  // ==========================================================
  // REFRESH
  // ==========================================================

  const refreshGroup = useCallback(
    async showSpinner => {
      if (showSpinner) {
        setRefreshing(true);
      }

      try {
        const enriched = await Promise.all(
          bookings.map(async booking => {
            const status =
              normalizeStatus(booking);

            if (
              status !== 'pending' &&
              status !== 'negotiating'
            ) {
              return booking;
            }

            try {
              const offersResult =
                await offerService.getOffersByBooking(
                  booking.id
                );

              const offers =
                normalizeArray(
                  offersResult?.data
                );

              const active =
                offers.filter(
                  isActiveClientOffer
                );

              return {
                ...booking,
                _activeClientOffer:
                  active.length
                    ? active[active.length - 1]
                    : null,
              };
            } catch (offerError) {
              console.warn(
                '⚠️ GROUP REFRESH ERROR:',
                booking.id,
                offerError
              );

              return booking;
            }
          })
        );

        setBookings(enriched);
      } finally {
        setRefreshing(false);
      }
    },
    [bookings]
  );

  const handleRefresh = useCallback(() => {
    refreshGroup(true);
  }, [refreshGroup]);

  // ==========================================================
  // ACTIVE CLIENT OFFER
  // ==========================================================

  const getActiveClientOffer =
    useCallback(async bookingId => {
      const result =
        await offerService.getOffersByBooking(
          bookingId
        );

      if (!result?.success) {
        throw new Error(
          result?.error ||
            'Impossible de récupérer les offres.'
        );
      }

      const offers =
        normalizeArray(result.data);

      const active =
        offers.filter(
          isActiveClientOffer
        );

      if (active.length === 0) {
        return null;
      }

      return active[active.length - 1];
    }, []);

  // ==========================================================
  // ACCEPT
  // ==========================================================

  const executeAccept =
    useCallback(
      async booking => {
        if (
          !booking?.id ||
          busyId !== null
        ) {
          return;
        }

        try {
          setBusyId(booking.id);

          const clientOffer =
            await getActiveClientOffer(
              booking.id
            );

          if (!clientOffer) {
            throw new Error(
              'Aucune offre active du client n’a été trouvée pour cette réservation.'
            );
          }

          const offerId =
            getOfferId(clientOffer);

          if (!offerId) {
            throw new Error(
              'Identifiant de l’offre client introuvable.'
            );
          }

          const result =
            await offerService.acceptOffer(
              offerId
            );

          if (!result?.success) {
            throw new Error(
              result?.error ||
                'Impossible d’accepter l’offre.'
            );
          }

          const returnedBooking =
            result?.data;

          setBookings(previous =>
            previous.map(item =>
              String(item.id) ===
              String(booking.id)
                ? {
                    ...item,
                    status: 'confirmed',
                    booking_status:
                      'confirmed',
                    final_price:
                      returnedBooking?.final_price ??
                      returnedBooking?.price ??
                      getPrice(booking),
                  }
                : item
            )
          );

          showToast(
            'success',
            'Offre acceptée. Réservation confirmée.'
          );

          closeAfterAction();
        } catch (actionError) {
          console.error(
            '❌ ACCEPT ERROR:',
            actionError
          );

          showToast(
            'error',
            actionError?.message ||
              'Impossible d’accepter l’offre.'
          );
        } finally {
          setBusyId(null);
        }
      },
      [
        busyId,
        getActiveClientOffer,
        showToast,
        closeAfterAction,
      ]
    );

  // ==========================================================
  // HANDLE ACCEPT
  // ==========================================================

  const handleAccept =
    useCallback(
      booking => {
        if (
          !booking?.id ||
          busyId !== null
        ) {
          return;
        }

        const actionState =
          computeActionState(
            booking
          );

        if (
          !actionState.showAcceptReject
        ) {
          showToast(
            'error',
            'Aucune offre active du client à accepter.'
          );
          return;
        }

        setConfirmModal({
          title: 'Accepter l’offre ?',

          message:
            `Accepter l’offre client de ${formatPrice(
              getPrice(
                booking?._activeClientOffer
              ) ||
                getPrice(booking)
            )} pour cette réservation ?`,

          confirmLabel: 'Accepter',

          destructive: false,

          onConfirm: () => {
            setConfirmModal(null);
            executeAccept(booking);
          },
        });
      },
      [
        busyId,
        executeAccept,
        showToast,
      ]
    );

  // ==========================================================
  // REJECT
  // ==========================================================

  const handleReject =
    useCallback(
      booking => {
        if (
          !booking?.id ||
          busyId !== null
        ) {
          return;
        }

        const actionState =
          computeActionState(
            booking
          );

        if (
          !actionState.showAcceptReject
        ) {
          showToast(
            'error',
            'Aucune offre active du client à refuser.'
          );
          return;
        }

        setConfirmModal({
          title: 'Refuser l’offre ?',

          message:
            `Refuser l’offre client de ${formatPrice(
              getPrice(booking)
            )} ? Cette action ne peut pas être annulée.`,

          confirmLabel: 'Refuser',

          destructive: true,

          onConfirm: async () => {
            setConfirmModal(null);

            try {
              setBusyId(booking.id);

              const clientOffer =
                await getActiveClientOffer(
                  booking.id
                );

              if (!clientOffer) {
                throw new Error(
                  'Aucune offre active du client trouvée.'
                );
              }

              const offerId =
                getOfferId(clientOffer);

              if (!offerId) {
                throw new Error(
                  'ID de l’offre introuvable.'
                );
              }

              const result =
                await offerService.rejectOffer(
                  offerId
                );

              if (!result?.success) {
                throw new Error(
                  result?.error ||
                    'Impossible de refuser l’offre.'
                );
              }

              setBookings(previous =>
                previous.map(item =>
                  String(item.id) ===
                  String(booking.id)
                    ? {
                        ...item,
                        _activeClientOffer:
                          null,
                        _activeTherapistOffer:
                          null,
                      }
                    : item
                )
              );

              showToast(
                'success',
                'Offre refusée.'
              );

              closeAfterAction();
            } catch (rejectError) {
              console.error(
                '❌ REJECT ERROR:',
                rejectError
              );

              showToast(
                'error',
                rejectError?.message ||
                  'Impossible de refuser l’offre.'
              );
            } finally {
              setBusyId(null);
            }
          },
        });
      },
      [
        busyId,
        getActiveClientOffer,
        showToast,
        closeAfterAction,
      ]
    );

  // ==========================================================
  // NEGOTIATION
  // ==========================================================

  const handleNegotiation =
    useCallback(
      booking => {
        if (!booking?.id) {
          Alert.alert(
            'Erreur',
            'Réservation invalide.'
          );
          return;
        }

        const status =
          normalizeStatus(booking);

        if (
          status !== 'pending' &&
          status !== 'negotiating'
        ) {
          Alert.alert(
            'Négociation fermée',
            'Cette réservation est déjà confirmée.'
          );
          return;
        }

        showToast(
          'success',
          'Ouverture de la négociation.'
        );

        navigation.navigate(
          'Negotiation',
          {
            bookingId: booking.id,
            currentPrice:
              getPrice(booking),
            clientName:
              getClientName(booking),
            booking,
            activeTab: 'Demandes',
          }
        );
      },
      [navigation, showToast]
    );

  // ==========================================================
  // CALL CLIENT
  // ==========================================================

  const handleCallClient =
    useCallback(booking => {
      const phone =
        getPhone(booking);

      if (!phone) {
        return;
      }

      Linking.openURL(
        `tel:${phone}`
      ).catch(() => {
        Alert.alert(
          'Erreur',
          "Impossible de lancer l'appel."
        );
      });
    }, []);

  // ==========================================================
  // DIRECTIONS
  // ==========================================================

  const handleOpenDirections =
    useCallback(booking => {
      const lat =
        getLatitude(booking);

      const lng =
        getLongitude(booking);

      const label =
        encodeURIComponent(
          getClientName(booking) ||
            'Client'
        );

      let url;

      if (
        lat !== null &&
        lng !== null
      ) {
        url = Platform.select({
          ios: `maps:0,0?q=${label}@${lat},${lng}`,

          android: `geo:0,0?q=${lat},${lng}(${label})`,

          default:
            `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        });
      } else {
        url =
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            getAddress(booking)
          )}`;
      }

      Linking.openURL(url).catch(
        () => {
          Alert.alert(
            'Erreur',
            "Impossible d'ouvrir l'itinéraire."
          );
        }
      );
    }, []);

  // ==========================================================
  // OPEN BOOKING
  // ==========================================================

  const openBooking =
    useCallback(
      booking => {
        if (!booking?.id) {
          Alert.alert(
            'Erreur',
            'Identifiant de réservation invalide.'
          );
          return;
        }

        navigation.navigate(
          'Offer',
          {
            bookingId: booking.id,
            booking,
          }
        );
      },
      [navigation]
    );

  // ==========================================================
  // FILTRES : OPTIONS DE STATUT DISPONIBLES
  // ==========================================================

  const statusOptions = useMemo(() => {
    const set = new Set();

    bookings.forEach(booking => {
      set.add(normalizeStatus(booking));
    });

    return ['all', ...Array.from(set)];
  }, [bookings]);

  // ==========================================================
  // FILTRES : DATES AYANT DES RÉSERVATIONS (pour points calendrier)
  // ==========================================================

  const bookingDatesSet = useMemo(() => {
    const set = new Set();

    bookings.forEach(booking => {
      const requestedAt = getRequestedAt(booking);

      if (!requestedAt) {
        return;
      }

      const parsed = new Date(requestedAt);

      if (Number.isNaN(parsed.getTime())) {
        return;
      }

      set.add(dateKey(parsed));
    });

    return set;
  }, [bookings]);

  // ==========================================================
  // FILTRES : LISTE FILTRÉE
  // ==========================================================

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      if (
        statusFilter !== 'all' &&
        normalizeStatus(booking) !== statusFilter
      ) {
        return false;
      }

      if (selectedDate) {
        const requestedAt =
          getRequestedAt(booking);

        if (!requestedAt) {
          return false;
        }

        const parsed = new Date(requestedAt);

        if (
          Number.isNaN(parsed.getTime()) ||
          !isSameDay(parsed, selectedDate)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [bookings, statusFilter, selectedDate]);

  const hasActiveFilters =
    statusFilter !== 'all' || !!selectedDate;

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setSelectedDate(null);
  }, []);

  // ==========================================================
  // CALENDRIER : NAVIGATION MOIS
  // ==========================================================

  const openCalendarModal = useCallback(() => {
    setCalendarCursor(
      selectedDate ? new Date(selectedDate) : new Date()
    );
    setShowCalendarModal(true);
  }, [selectedDate]);

  const handlePrevMonth = useCallback(() => {
    setCalendarCursor(prev =>
      new Date(
        prev.getFullYear(),
        prev.getMonth() - 1,
        1
      )
    );
  }, []);

  const handleNextMonth = useCallback(() => {
    setCalendarCursor(prev =>
      new Date(
        prev.getFullYear(),
        prev.getMonth() + 1,
        1
      )
    );
  }, []);

  const handleSelectCalendarDay = useCallback(day => {
    if (!day) {
      return;
    }

    setSelectedDate(day);
  }, []);

  const handleClearCalendarDate = useCallback(() => {
    setSelectedDate(null);
    setShowCalendarModal(false);
  }, []);

  const handleTodayShortcut = useCallback(() => {
    const today = new Date();
    setCalendarCursor(today);
    setSelectedDate(today);
    setShowCalendarModal(false);
  }, []);

  const calendarMatrix = useMemo(
    () =>
      getMonthMatrix(
        calendarCursor.getFullYear(),
        calendarCursor.getMonth()
      ),
    [calendarCursor]
  );

  // ==========================================================
  // BOOKING CARD
  // ==========================================================

  const renderBookingCard =
    useCallback(
      ({ item: booking }) => {
        const status =
          normalizeStatus(booking);

        const statusUI =
          getStatusUI(
            booking,
            isDark
          );

        const busy =
          busyId === booking.id;

        const price =
          getPrice(booking);

        const distance =
          getDistance(booking);

        const expiresAt =
          getExpiresAt(booking);

        const expired =
          isOfferExpired(booking);

        const showExpiry =
          !!expiresAt &&
          (
            status === 'pending' ||
            status === 'negotiating'
          );

        const actionState =
          computeActionState(
            booking
          );

        const requestedAt =
          getRequestedAt(booking);

        const relativeLabel =
          getRelativeTimeLabel(
            requestedAt
          );

        const publishedLabel =
          relativeLabel
            ? `Publié ${relativeLabel}`
            : '';

        const requestDateLabel =
          formatDateLong(
            requestedAt
          );

        const requestTimeLabel =
          requestedAt
            ? formatTimeShort(
                requestedAt
              )
            : '';

        return (
          <Pressable
            onPress={() =>
              openBooking(
                booking
              )
            }
            style={({ pressed }) => [
              baseStyles.card,

              isWeb &&
                webStyles.webCard,

              hoveredId ===
                booking.id &&
                baseStyles.cardHover,

              pressed &&
                baseStyles.cardPressed,
            ]}
            onHoverIn={() =>
              isWeb &&
              setHoveredId(
                booking.id
              )
            }
            onHoverOut={() =>
              isWeb &&
              setHoveredId(null)
            }
          >
            {/* ==================================================
                CARD TOP
            ================================================== */}

            <View
              style={
                baseStyles.cardTopRow
              }
            >
              <View
                style={
                  baseStyles.avatarColumn
                }
              >
                <ClientAvatar
                  photoUrl={getClientPhoto(
                    booking
                  )}
                  name={getClientName(
                    booking
                  )}
                  size={46}
                  isOnline={getClientOnline(
                    booking
                  )}
                />
              </View>

              <View
                style={
                  baseStyles.cardTopInfo
                }
              >
                <View
                  style={
                    baseStyles.cardNameRow
                  }
                >
                  <Text
                    style={
                      baseStyles.cardName
                    }
                    numberOfLines={1}
                  >
                    {getClientName(
                      booking
                    )}
                  </Text>

                  <View
                    style={[
                      baseStyles.cardStatusPill,
                      {
                        backgroundColor:
                          statusUI.background,
                      },
                    ]}
                  >
                    <View
                      style={[
                        baseStyles.cardStatusDot,
                        {
                          backgroundColor:
                            statusUI.dot,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        baseStyles.cardStatusText,
                        {
                          color:
                            statusUI.color,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {statusUI.label}
                    </Text>
                  </View>
                </View>

                <Text
                  style={
                    baseStyles.cardBookingId
                  }
                  numberOfLines={1}
                >
                  Réservation #{booking.id}
                </Text>

                <View
                  style={
                    baseStyles.cardSubRow
                  }
                >
                  <Ionicons
                    name="location-outline"
                    size={12}
                    color={
                      colors.textSecondary
                    }
                  />

                  <Text
                    style={
                      baseStyles.cardSubText
                    }
                    numberOfLines={1}
                  >
                    {getAddress(
                      booking
                    )}
                  </Text>
                </View>

                <View
                  style={
                    baseStyles.cardMetaRow
                  }
                >
                  <Text
                    style={
                      baseStyles.cardMetaText
                    }
                    numberOfLines={1}
                  >
                    {getMassageName(
                      booking
                    )}
                  </Text>

                  <View
                    style={
                      baseStyles.cardMetaDot
                    }
                  />

                  <Text
                    style={
                      baseStyles.cardMetaText
                    }
                    numberOfLines={1}
                  >
                    {getDuration(
                      booking
                    )}{' '}
                    min
                  </Text>
                </View>

                {publishedLabel ? (
                  <View
                    style={
                      baseStyles.cardPublishedRow
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={11}
                      color={
                        COLORS.primary
                      }
                    />

                    <Text
                      style={
                        baseStyles.cardPublishedText
                      }
                      numberOfLines={1}
                    >
                      {publishedLabel}
                    </Text>
                  </View>
                ) : null}

                {requestDateLabel ? (
                  <View
                    style={
                      baseStyles.cardDateRow
                    }
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={11}
                      color={
                        colors.textSecondary
                      }
                    />

                    <Text
                      style={
                        baseStyles.cardDateText
                      }
                      numberOfLines={1}
                    >
                      {requestDateLabel}

                      {requestTimeLabel
                        ? ` · ${requestTimeLabel}`
                        : ''}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={
                    baseStyles.cardBottomRow
                  }
                >
                  {distance !== null ? (
                    <View
                      style={
                        baseStyles.cardDistanceWrap
                      }
                    >
                      <Ionicons
                        name="navigate-outline"
                        size={11}
                        color={
                          COLORS.red
                        }
                      />

                      <Text
                        style={
                          baseStyles.cardDistanceText
                        }
                        numberOfLines={1}
                      >
                        {distance.toFixed(
                          1
                        )}{' '}
                        km
                      </Text>
                    </View>
                  ) : null}

                  <Text
                    style={
                      baseStyles.cardPrice
                    }
                    numberOfLines={1}
                  >
                    {formatPrice(
                      price
                    )}
                  </Text>
                </View>

                {showExpiry ? (
                  <View
                    style={
                      baseStyles.cardExpiryRow
                    }
                  >
                    <Ionicons
                      name={
                        expired
                          ? 'alert-circle-outline'
                          : 'hourglass-outline'
                      }
                      size={11}
                      color={
                        expired
                          ? COLORS.red
                          : COLORS.orange
                      }
                    />

                    <Text
                      style={[
                        baseStyles.cardExpiryText,
                        expired &&
                          baseStyles.cardExpiryTextUrgent,
                      ]}
                      numberOfLines={1}
                    >
                      {expired
                        ? 'Expirée le '
                        : 'Expire le '}

                      {formatDateLong(
                        expiresAt
                      )}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ==================================================
                ACTIONS
            ================================================== */}

            <View
              style={
                baseStyles.cardActionsBar
              }
            >
              <View
                style={
                  baseStyles.cardActionsLeft
                }
              >
                {getPhone(booking) ? (
                  <Pressable
                    style={
                      baseStyles.cardSmallAction
                    }
                    onPress={event => {
                      event?.stopPropagation?.();
                      handleCallClient(
                        booking
                      );
                    }}
                    hitSlop={6}
                  >
                    <Ionicons
                      name="call-outline"
                      size={13}
                      color={
                        COLORS.primary
                      }
                    />

                    <Text
                      style={
                        baseStyles.cardSmallActionText
                      }
                    >
                      Appeler
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={
                    baseStyles.cardSmallAction
                  }
                  onPress={event => {
                    event?.stopPropagation?.();
                    handleOpenDirections(
                      booking
                    );
                  }}
                  hitSlop={6}
                >
                  <Ionicons
                    name="navigate-outline"
                    size={13}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      baseStyles.cardSmallActionText
                    }
                  >
                    Itinéraire
                  </Text>
                </Pressable>

                {actionState.showAcceptReject ? (
                  <>
                    <Pressable
                      style={[
                        baseStyles.cardSmallAction,
                        busy &&
                          baseStyles.disabled,
                      ]}
                      disabled={busy}
                      onPress={event => {
                        event?.stopPropagation?.();
                        handleAccept(
                          booking
                        );
                      }}
                      hitSlop={6}
                    >
                      {busy ? (
                        <ActivityIndicator
                          size="small"
                          color={
                            COLORS.primary
                          }
                        />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark"
                            size={13}
                            color={
                              COLORS.primary
                            }
                          />

                          <Text
                            style={
                              baseStyles.cardSmallActionText
                            }
                          >
                            Accepter
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      style={[
                        baseStyles.cardSmallAction,
                        busy &&
                          baseStyles.disabled,
                      ]}
                      disabled={busy}
                      onPress={event => {
                        event?.stopPropagation?.();
                        handleReject(
                          booking
                        );
                      }}
                      hitSlop={6}
                    >
                      <Ionicons
                        name="close"
                        size={13}
                        color={
                          COLORS.red
                        }
                      />

                      <Text
                        style={[
                          baseStyles.cardSmallActionText,
                          {
                            color:
                              COLORS.red,
                          },
                        ]}
                      >
                        Refuser
                      </Text>
                    </Pressable>
                  </>
                ) : actionState.showNegotiation ? (
                  <Pressable
                    style={
                      baseStyles.cardSmallAction
                    }
                    onPress={event => {
                      event?.stopPropagation?.();
                      handleNegotiation(
                        booking
                      );
                    }}
                    hitSlop={6}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={13}
                      color={
                        COLORS.primary
                      }
                    />

                    <Text
                      style={
                        baseStyles.cardSmallActionText
                      }
                    >
                      Négocier
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                style={[
                  baseStyles.cardSmallAction,
                  baseStyles.cardSmallActionRight,
                ]}
                onPress={event => {
                  event?.stopPropagation?.();

                  setActionSheetBooking(
                    booking
                  );
                }}
                hitSlop={6}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={13}
                  color={
                    colors.textSecondary
                  }
                />

                <Text
                  style={[
                    baseStyles.cardSmallActionText,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  Plus
                </Text>
              </Pressable>
            </View>
          </Pressable>
        );
      },
      [
        busyId,
        hoveredId,
        isWeb,
        isDark,
        colors,
        baseStyles,
        webStyles,
        openBooking,
        handleAccept,
        handleReject,
        handleNegotiation,
        handleCallClient,
        handleOpenDirections,
      ]
    );

  // ==========================================================
  // ACTION SHEET
  // ==========================================================

  const renderActionsSheet =
    () => {
      if (!actionSheetBooking) {
        return null;
      }

      const booking =
        actionSheetBooking;

      const actionState =
        computeActionState(
          booking
        );

      const busy =
        busyId === booking.id;

      return (
        <Modal
          visible={
            !!actionSheetBooking
          }
          transparent
          animationType="slide"
          onRequestClose={() =>
            setActionSheetBooking(
              null
            )
          }
        >
          <View
            style={
              baseStyles.sheetOverlay
            }
          >
            <Pressable
              style={
                baseStyles.sheetBackdrop
              }
              onPress={() =>
                setActionSheetBooking(
                  null
                )
              }
            />

            <View
              style={[
                baseStyles.actionsSheet,
                {
                  paddingBottom:
                    sheetBottomPadding,
                },
              ]}
            >
              <View
                style={
                  baseStyles.sheetHandle
                }
              />

              <View
                style={
                  baseStyles.sheetHeaderRow
                }
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Text
                    style={
                      baseStyles.sheetTitle
                    }
                    numberOfLines={1}
                  >
                    {getClientName(
                      booking
                    )}
                  </Text>

                  <Text
                    style={
                      baseStyles.actionsSheetSubtitle
                    }
                  >
                    Réservation #
                    {booking.id}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    setActionSheetBooking(
                      null
                    )
                  }
                  hitSlop={8}
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color={
                      colors.textSecondary
                    }
                  />
                </Pressable>
              </View>

              <View
                style={
                  baseStyles.actionsSingleRow
                }
              >
                {actionState.showAcceptReject ? (
                  <Pressable
                    style={[
                      baseStyles.actionText,
                      busy &&
                        baseStyles.disabled,
                    ]}
                    disabled={busy}
                    onPress={() => {
                      setActionSheetBooking(
                        null
                      );
                      handleAccept(
                        booking
                      );
                    }}
                    hitSlop={6}
                  >
                    {busy ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          COLORS.primary
                        }
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={17}
                          color={
                            COLORS.primary
                          }
                        />

                        <Text
                          style={
                            baseStyles.actionTextLabel
                          }
                        >
                          Accepter
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : null}

                {actionState.showNegotiation ? (
                  <Pressable
                    style={
                      baseStyles.actionText
                    }
                    onPress={() => {
                      setActionSheetBooking(
                        null
                      );
                      handleNegotiation(
                        booking
                      );
                    }}
                    hitSlop={6}
                  >
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={17}
                      color={
                        COLORS.primary
                      }
                    />

                    <Text
                      style={
                        baseStyles.actionTextLabel
                      }
                    >
                      Négociation
                    </Text>
                  </Pressable>
                ) : null}

                {actionState.showAcceptReject ? (
                  <Pressable
                    style={[
                      baseStyles.actionText,
                      busy &&
                        baseStyles.disabled,
                    ]}
                    disabled={busy}
                    onPress={() => {
                      setActionSheetBooking(
                        null
                      );
                      handleReject(
                        booking
                      );
                    }}
                    hitSlop={6}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={17}
                      color={
                        COLORS.red
                      }
                    />

                    <Text
                      style={[
                        baseStyles.actionTextLabel,
                        {
                          color:
                            COLORS.red,
                        },
                      ]}
                    >
                      Refuser
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={
                    baseStyles.actionText
                  }
                  onPress={() => {
                    setActionSheetBooking(
                      null
                    );
                    openBooking(
                      booking
                    );
                  }}
                  hitSlop={6}
                >
                  <Ionicons
                    name="eye-outline"
                    size={17}
                    color={
                      colors.textSecondary
                    }
                  />

                  <Text
                    style={[
                      baseStyles.actionTextLabel,
                      {
                        color:
                          colors.textSecondary,
                      },
                    ]}
                  >
                    Détails
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      );
    };

  // ==========================================================
  // FILTRES : BARRE (STATUT + DATE)
  // ==========================================================

  const renderFiltersBar = () => (
    <View
      style={[
        filterStyles.filtersBar,
        isWeb && filterStyles.webFiltersBar,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={filterStyles.statusScroll}
        contentContainerStyle={
          filterStyles.statusScrollContent
        }
      >
        {statusOptions.map(status => {
          const active = statusFilter === status;

          return (
            <Pressable
              key={status}
              style={[
                filterStyles.statusPill,
                active &&
                  filterStyles.statusPillActive,
              ]}
              onPress={() =>
                setStatusFilter(status)
              }
              hitSlop={4}
            >
              <Text
                style={[
                  filterStyles.statusPillText,
                  active &&
                    filterStyles.statusPillTextActive,
                ]}
                numberOfLines={1}
              >
                {getStatusFilterLabel(status)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        style={[
          filterStyles.dateButton,
          selectedDate &&
            filterStyles.dateButtonActive,
        ]}
        onPress={openCalendarModal}
        hitSlop={4}
      >
        <Ionicons
          name="calendar-outline"
          size={14}
          color={
            selectedDate
              ? COLORS.white
              : COLORS.primary
          }
        />

        <Text
          style={[
            filterStyles.dateButtonText,
            selectedDate &&
              filterStyles.dateButtonTextActive,
          ]}
          numberOfLines={1}
        >
          {selectedDate
            ? formatShortDate(selectedDate)
            : 'Date'}
        </Text>
      </Pressable>

      {hasActiveFilters ? (
        <Pressable
          style={filterStyles.resetButton}
          onPress={resetFilters}
          hitSlop={6}
        >
          <Ionicons
            name="close"
            size={15}
            color={colors.textSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  );

  // ==========================================================
  // CALENDRIER : MODAL
  // ==========================================================

  const renderCalendarModal = () => {
    const today = new Date();

    return (
      <Modal
        visible={showCalendarModal}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowCalendarModal(false)
        }
      >
        <Pressable
          style={filterStyles.calendarOverlay}
          onPress={() =>
            setShowCalendarModal(false)
          }
        >
          <Pressable
            style={filterStyles.calendarCard}
            onPress={event =>
              event?.stopPropagation?.()
            }
          >
            <View
              style={
                filterStyles.calendarHeaderRow
              }
            >
              <Pressable
                style={
                  filterStyles.calendarNavButton
                }
                onPress={handlePrevMonth}
                hitSlop={6}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={colors.text}
                />
              </Pressable>

              <Text
                style={
                  filterStyles.calendarMonthLabel
                }
              >
                {formatMonthLabel(
                  calendarCursor
                )}
              </Text>

              <Pressable
                style={
                  filterStyles.calendarNavButton
                }
                onPress={handleNextMonth}
                hitSlop={6}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <View style={filterStyles.calendarWeekRow}>
              {WEEKDAY_LABELS.map(label => (
                <View
                  key={label}
                  style={
                    filterStyles.calendarWeekdayCell
                  }
                >
                  <Text
                    style={
                      filterStyles.calendarWeekdayText
                    }
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            {calendarMatrix.map((week, weekIndex) => (
              <View
                key={`week-${weekIndex}`}
                style={filterStyles.calendarWeekRow}
              >
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return (
                      <View
                        key={`empty-${weekIndex}-${dayIndex}`}
                        style={
                          filterStyles.calendarDayCell
                        }
                      />
                    );
                  }

                  const selected = isSameDay(
                    day,
                    selectedDate
                  );

                  const isToday = isSameDay(
                    day,
                    today
                  );

                  const hasEvents =
                    bookingDatesSet.has(
                      dateKey(day)
                    );

                  return (
                    <Pressable
                      key={dateKey(day)}
                      style={[
                        filterStyles.calendarDayCell,
                        isToday &&
                          !selected &&
                          filterStyles.calendarDayCellToday,
                        selected &&
                          filterStyles.calendarDayCellSelected,
                      ]}
                      onPress={() =>
                        handleSelectCalendarDay(
                          day
                        )
                      }
                      hitSlop={2}
                    >
                      <Text
                        style={[
                          filterStyles.calendarDayText,
                          selected &&
                            filterStyles.calendarDayTextSelected,
                        ]}
                      >
                        {day.getDate()}
                      </Text>

                      {hasEvents ? (
                        <View
                          style={[
                            filterStyles.calendarDot,
                            selected &&
                              filterStyles.calendarDotSelected,
                          ]}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <View style={filterStyles.calendarFooterRow}>
              <Pressable
                style={[
                  filterStyles.calendarFooterButton,
                  filterStyles.calendarFooterButtonSecondary,
                ]}
                onPress={handleClearCalendarDate}
              >
                <Text
                  style={
                    filterStyles.calendarFooterButtonTextSecondary
                  }
                >
                  Effacer
                </Text>
              </Pressable>

              <Pressable
                style={[
                  filterStyles.calendarFooterButton,
                  filterStyles.calendarFooterButtonSecondary,
                ]}
                onPress={handleTodayShortcut}
              >
                <Text
                  style={
                    filterStyles.calendarFooterButtonTextSecondary
                  }
                >
                  Aujourd'hui
                </Text>
              </Pressable>

              <Pressable
                style={[
                  filterStyles.calendarFooterButton,
                  filterStyles.calendarFooterButtonPrimary,
                ]}
                onPress={() =>
                  setShowCalendarModal(false)
                }
              >
                <Text
                  style={
                    filterStyles.calendarFooterButtonTextPrimary
                  }
                >
                  OK
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // ==========================================================
  // EMPTY
  // ==========================================================

  const renderEmpty =
    () => (
      <View
        style={[
          baseStyles.emptyContainer,
          isWeb &&
            webStyles.webEmpty,
        ]}
      >
        <View
          style={
            baseStyles.emptyIcon
          }
        >
          <Ionicons
            name={
              hasActiveFilters
                ? 'filter-outline'
                : 'file-tray-outline'
            }
            size={36}
            color={
              COLORS.primary
            }
          />
        </View>

        <Text
          style={
            baseStyles.emptyTitle
          }
        >
          {hasActiveFilters
            ? 'Aucun résultat'
            : 'Aucune demande'}
        </Text>

        <Text
          style={
            baseStyles.emptyText
          }
        >
          {hasActiveFilters
            ? 'Aucune réservation ne correspond à ces filtres.'
            : "Ce client n'a plus de demande à afficher ici."}
        </Text>

        {hasActiveFilters ? (
          <Pressable
            style={
              filterStyles.emptyResetButton
            }
            onPress={resetFilters}
          >
            <Ionicons
              name="refresh-outline"
              size={15}
              color={COLORS.primary}
            />

            <Text
              style={
                filterStyles.emptyResetButtonText
              }
            >
              Réinitialiser les filtres
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={
              baseStyles.emptyRefresh
            }
            onPress={
              handleRefresh
            }
          >
            <Ionicons
              name="refresh-outline"
              size={17}
              color={
                COLORS.white
              }
            />

            <Text
              style={
                baseStyles.emptyRefreshText
              }
            >
              Actualiser
            </Text>
          </Pressable>
        )}
      </View>
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <SafeAreaView
      style={[
        baseStyles.safeArea,
        isWeb &&
          webStyles.fullScreen,
      ]}
      edges={[
        'left',
        'right',
        'bottom',
      ]}
    >
      <View
        style={[
          baseStyles.screen,
          isWeb &&
            webStyles.webPage,
        ]}
      >
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />

        {/* ==================================================
            HEADER
        ================================================== */}

        <Header
          title={clientName}
          showBack
          onBackPress={() =>
            navigation.goBack()
          }
        />

        <Toast toast={toast} />

        <ConfirmationModal
          visible={
            !!confirmModal
          }
          title={
            confirmModal?.title
          }
          message={
            confirmModal?.message
          }
          confirmLabel={
            confirmModal?.confirmLabel
          }
          destructive={
            confirmModal?.destructive
          }
          onCancel={() =>
            setConfirmModal(
              null
            )
          }
          onConfirm={
            confirmModal?.onConfirm
          }
        />

        {renderActionsSheet()}
        {renderCalendarModal()}

        {/* ==================================================
            SUB HEADER
        ================================================== */}

        <View
          style={[
            baseStyles.groupPageSubHeader,

            isWeb &&
              webStyles.webSubHeader,
          ]}
        >
          <Ionicons
            name="albums-outline"
            size={14}
            color={
              COLORS.primary
            }
          />

          <Text
            style={[
              baseStyles.groupPageSubHeaderText,

              isWeb &&
                webStyles.webSubHeaderText,
            ]}
          >
            {filteredBookings.length}{' '}
            demande
            {filteredBookings.length >
            1
              ? 's'
              : ''}{' '}
            pour {clientName}
            {hasActiveFilters
              ? ` (sur ${bookings.length})`
              : ''}
          </Text>
        </View>

        {/* ==================================================
            FILTRES
        ================================================== */}

        {renderFiltersBar()}

        {/* ==================================================
            FULL SCREEN LIST
        ================================================== */}

        <View
          style={[
            baseStyles.webCardsContainer,

            isWeb &&
              webStyles.webListWrapper,
          ]}
        >
          <FlatList
            data={filteredBookings}
            keyExtractor={item =>
              String(item.id)
            }
            renderItem={
              renderBookingCard
            }
            ListEmptyComponent={
              renderEmpty
            }

            /*
             * WEB :
             * 2 cartes par ligne.
             *
             * ANDROID :
             * 1 carte par ligne.
             */
            numColumns={
              isWeb ? 2 : 1
            }

            columnWrapperStyle={
              isWeb &&
              filteredBookings.length > 0
                ? webStyles.webColumnWrapper
                : undefined
            }

            contentContainerStyle={
              filteredBookings.length ===
              0
                ? baseStyles.listEmptyContent
                : isWeb
                ? webStyles.webListContent
                : baseStyles.mobileList
            }

            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  handleRefresh
                }
                tintColor={
                  COLORS.primary
                }
              />
            }

            showsVerticalScrollIndicator={
              true
            }

            /*
             * Important sur Web :
             * permet à la liste de prendre toute
             * la hauteur disponible.
             */
            style={
              isWeb
                ? webStyles.fullScreen
                : undefined
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}