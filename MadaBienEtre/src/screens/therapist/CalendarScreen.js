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
  TextInput,
  Modal,
  Pressable,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';

import bookingService from '../../services/bookingService';

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
// DATE RANGE HELPERS
// (mini-calendrier "Du / Au" — même logique que sur
// src/screens/client/HistoryScreen.js)
// ============================================================

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildMonthGrid = (viewDate) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  // JS : dimanche=0..samedi=6 -> on veut lundi en premier
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  return cells;
};

// ============================================================
// TOAST (notifications d'action — remplace Alert.alert pour
// les simples notifications, fonctionne pareil sur web/Android)
// ============================================================

const TOAST_CONFIG = {
  success: {
    icon: 'checkmark-circle',
    color: '#16A34A',
    background: '#DCFCE7',
  },

  error: {
    icon: 'close-circle',
    color: '#DC2626',
    background: '#FEE2E2',
  },

  info: {
    icon: 'information-circle',
    color: '#2563EB',
    background: '#DBEAFE',
  },
};

const Toast = ({ visible, type, message, onHide }) => {
  const translateY = useMemo(
    () => new Animated.Value(-80),
    [],
  );

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: Platform.OS !== 'web',
      friction: 8,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -80,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        onHide?.();
      });
    }, 3200);

    return () => clearTimeout(timer);
  }, [visible, translateY, onHide]);

  if (!visible) {
    return null;
  }

  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastOverlay,
        { transform: [{ translateY }] },
      ]}
    >
      <View
        style={[
          styles.toastCard,
          { backgroundColor: config.background },
        ]}
      >
        <Ionicons
          name={config.icon}
          size={20}
          color={config.color}
        />

        <Text
          numberOfLines={2}
          style={[styles.toastText, { color: config.color }]}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

// ============================================================
// DATE RANGE MODAL
//
// Bottom sheet avec deux champs "Du"/"Au" + un mini calendrier
// mensuel pour filtrer la liste complète par période. Rien
// n'est appliqué tant que l'utilisateur n'appuie pas sur
// "Appliquer". Ouverte depuis l'icône calendrier à droite de la
// barre de recherche.
// ============================================================

const DateRangeModal = ({
  visible,
  range,
  bookingDateSet,
  themeColors,
  onClose,
  onSelectDate,
  onReset,
  onApply,
}) => {
  // ⚠️ Android : la hauteur de la barre de navigation gestuelle
  // varie selon les téléphones. On l'ajoute au padding bas du
  // sheet pour que "Appliquer" reste toujours visible/cliquable.
  const insets = useSafeAreaInsets();

  const [viewDate, setViewDate] = useState(
    () => range?.start || new Date(),
  );

  useEffect(() => {
    if (visible) {
      setViewDate(range?.start || new Date());
    }
  }, [visible, range?.start]);

  const cells = useMemo(
    () => buildMonthGrid(viewDate),
    [viewDate],
  );

  const goPrevMonth = useCallback(() => {
    setViewDate(
      (prev) =>
        new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  }, []);

  const goNextMonth = useCallback(() => {
    setViewDate(
      (prev) =>
        new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  }, []);

  const todayKey = toDateKey(new Date());
  const startKey = range?.start ? toDateKey(range.start) : null;
  const endKey = range?.end ? toDateKey(range.end) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // ⚠️ Android : sans ça, le bottom-sheet peut se retrouver
      // partiellement masqué/derrière la barre de statut ou la
      // barre de navigation système sur certains téléphones.
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.calendarSheet,
            {
              backgroundColor: themeColors.card ?? themeColors.surface,
              paddingBottom:
                20 +
                (Platform.OS === 'android' ? insets.bottom : 0),
            },
          ]}
          onPress={() => {}}
        >
          <View style={styles.actionSheetHandle} />

          <Text
            style={[
              styles.calendarModalTitle,
              { color: themeColors.text },
            ]}
          >
            Filtrer par période
          </Text>

          {/* ======================================================
              "DU" / "AU" — deux champs qui affichent la plage
              choisie, comme deux inputs de date. Le champ actif
              (celui qui va recevoir le prochain jour touché dans
              le calendrier) est mis en surbrillance.
              ====================================================== */}
          <View style={styles.rangeFieldsRow}>
            <View
              style={[
                styles.rangeField,
                {
                  borderColor: !endKey
                    ? colors.primary
                    : themeColors.border,
                  backgroundColor: !endKey
                    ? `${colors.primary}10`
                    : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.rangeFieldLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                Du
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.rangeFieldValue,
                  { color: themeColors.text },
                ]}
              >
                {range?.start
                  ? formatDateLong(toDateKey(range.start)).slice(0, 16)
                  : 'Choisir'}
              </Text>
            </View>

            <Ionicons
              name="arrow-forward"
              size={16}
              color={themeColors.textSecondary}
              style={styles.rangeFieldArrow}
            />

            <View
              style={[
                styles.rangeField,
                {
                  borderColor:
                    !!range?.start && !endKey
                      ? colors.primary
                      : themeColors.border,
                  backgroundColor:
                    !!range?.start && !endKey
                      ? `${colors.primary}10`
                      : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.rangeFieldLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                Au
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.rangeFieldValue,
                  { color: themeColors.text },
                ]}
              >
                {range?.end
                  ? formatDateLong(toDateKey(range.end)).slice(0, 16)
                  : 'Choisir'}
              </Text>
            </View>
          </View>

          <View style={styles.calendarHeaderRow}>
            <TouchableOpacity
              onPress={goPrevMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={themeColors.text}
              />
            </TouchableOpacity>

            <Text
              style={[
                styles.calendarHeaderTitle,
                { color: themeColors.text },
              ]}
            >
              {MONTH_LABELS[viewDate.getMonth()]}{' '}
              {viewDate.getFullYear()}
            </Text>

            <TouchableOpacity
              onPress={goNextMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={themeColors.text}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.calendarWeekRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text
                key={`${label}-${index}`}
                style={[
                  styles.calendarWeekLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {cells.map((cellDate, index) => {
              if (!cellDate) {
                return (
                  <View
                    key={`empty-${index}`}
                    style={styles.calendarCell}
                  />
                );
              }

              const key = toDateKey(cellDate);
              const isStart = key === startKey;
              const isEnd = key === endKey;
              const isEdge = isStart || isEnd;

              const isInRange =
                !!startKey &&
                !!endKey &&
                key > startKey &&
                key < endKey;

              const isToday = key === todayKey;
              const hasBooking = bookingDateSet?.has(key);

              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.calendarCell,
                    isInRange && {
                      backgroundColor: `${colors.primary}18`,
                    },
                    isStart &&
                      !!endKey && {
                        backgroundColor: `${colors.primary}18`,
                        borderTopLeftRadius: 16,
                        borderBottomLeftRadius: 16,
                      },
                    isEnd &&
                      !!startKey && {
                        backgroundColor: `${colors.primary}18`,
                        borderTopRightRadius: 16,
                        borderBottomRightRadius: 16,
                      },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => onSelectDate(cellDate)}
                >
                  <View
                    style={[
                      styles.calendarDayCircle,
                      isEdge && {
                        backgroundColor: colors.primary,
                      },
                      !isEdge &&
                        isToday && {
                          borderWidth: 1.5,
                          borderColor: colors.primary,
                        },
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        {
                          color: isEdge
                            ? '#FFFFFF'
                            : themeColors.text,
                        },
                      ]}
                    >
                      {cellDate.getDate()}
                    </Text>
                  </View>

                  {hasBooking && !isEdge && (
                    <View
                      style={[
                        styles.calendarDayDot,
                        {
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text
            style={[
              styles.calendarHint,
              { color: themeColors.textSecondary },
            ]}
          >
            {!range?.start
              ? 'Touchez un jour pour définir le début de la période.'
              : !range?.end
              ? 'Touchez un second jour pour définir la fin de la période.'
              : 'Période sélectionnée. Appuyez sur "Appliquer".'}
          </Text>

          <View style={styles.calendarActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onReset}
              style={[
                styles.confirmButton,
                styles.confirmButtonGhost,
                { borderColor: themeColors.border },
              ]}
            >
              <Text
                style={[
                  styles.confirmButtonGhostText,
                  { color: themeColors.text },
                ]}
              >
                Réinitialiser
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!range?.start}
              onPress={onApply}
              style={[
                styles.confirmButton,
                {
                  backgroundColor: range?.start
                    ? colors.primary
                    : themeColors.border,
                },
              ]}
            >
              <Text style={styles.confirmButtonText}>
                Appliquer
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ============================================================
// BOOKING MENU SHEET (menu ⋮ d'une réservation)
//
// Regroupe TOUTES les actions d'une réservation (Voir les
// détails, Commencer le massage, Terminer le massage) au lieu
// de boutons séparés éparpillés dans la carte.
// ============================================================

const BookingMenuSheet = ({
  visible,
  booking,
  themeColors,
  onClose,
  onViewDetails,
  onStart,
  onComplete,
}) => {
  const insets = useSafeAreaInsets();

  const status = normalizeStatus(booking?.status);
  const statusConfig = getStatusConfig(status);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.actionSheet,
            {
              backgroundColor: themeColors.card ?? themeColors.surface,
              paddingBottom:
                20 +
                (Platform.OS === 'android' ? insets.bottom : 0),
            },
          ]}
          onPress={() => {}}
        >
          <View style={styles.actionSheetHandle} />

          <Text
            numberOfLines={1}
            style={[
              styles.actionSheetTitle,
              { color: themeColors.text },
            ]}
          >
            {booking ? getClientName(booking) : 'Réservation'}
          </Text>

          <Text
            style={[
              styles.actionSheetSubtitle,
              { color: statusConfig.color },
            ]}
          >
            {statusConfig.label}
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onViewDetails}
            style={styles.actionSheetRow}
          >
            <View
              style={[
                styles.actionSheetIcon,
                { backgroundColor: `${colors.primary}15` },
              ]}
            >
              <Ionicons
                name="eye-outline"
                size={18}
                color={colors.primary}
              />
            </View>

            <Text
              style={[
                styles.actionSheetRowText,
                { color: themeColors.text },
              ]}
            >
              Voir les détails
            </Text>
          </TouchableOpacity>

          {status === 'confirmed' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onStart}
              style={styles.actionSheetRow}
            >
              <View
                style={[
                  styles.actionSheetIcon,
                  { backgroundColor: '#4CAF5018' },
                ]}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={18}
                  color="#4CAF50"
                />
              </View>

              <Text
                style={[
                  styles.actionSheetRowText,
                  { color: themeColors.text },
                ]}
              >
                Commencer le massage
              </Text>
            </TouchableOpacity>
          )}

          {status === 'in_progress' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onComplete}
              style={styles.actionSheetRow}
            >
              <View
                style={[
                  styles.actionSheetIcon,
                  { backgroundColor: '#2E7D3218' },
                ]}
              >
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={18}
                  color="#2E7D32"
                />
              </View>

              <Text
                style={[
                  styles.actionSheetRowText,
                  { color: themeColors.text },
                ]}
              >
                Terminer le massage
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={styles.actionSheetCloseButton}
          >
            <Text
              style={[
                styles.actionSheetCloseText,
                { color: themeColors.textSecondary },
              ]}
            >
              Fermer
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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

  const [errorMessage, setErrorMessage] =
    useState('');

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  // ==========================================================
  // RECHERCHE + FILTRE PAR PÉRIODE
  // ==========================================================

  const [searchQuery, setSearchQuery] = useState('');

  // - draftRange : ce que l'utilisateur est en train de choisir
  //   dans la modale (pas encore appliqué à la liste)
  // - appliedRange : la période réellement utilisée pour filtrer
  //   la liste (mise à jour uniquement au clic sur "Appliquer")
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [draftRange, setDraftRange] = useState({
    start: null,
    end: null,
  });
  const [appliedRange, setAppliedRange] = useState({
    start: null,
    end: null,
  });

  // ==========================================================
  // MENU ⋮ D'UNE RÉSERVATION
  // ==========================================================

  const [menuTarget, setMenuTarget] = useState(null);

  // ==========================================================
  // TOAST
  // ==========================================================

  const [toast, setToast] = useState({
    visible: false,
    type: 'success',
    message: '',
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ visible: true, type, message });
  }, []);

  const hideToast = useCallback(() => {
    setToast((previous) => ({ ...previous, visible: false }));
  }, []);

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
      } catch (error) {
        console.error(
          '❌ [CALENDAR] Erreur:',
          error
        );

        setBookings([]);

        setErrorMessage(
          error?.message ||
            'Impossible de charger les réservations.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
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
  // DATES AVEC AU MOINS UNE RÉSERVATION
  // (pour le petit point sous les jours du mini-calendrier)
  // ==========================================================

  const bookingDateSet = useMemo(() => {
    const set = new Set();

    bookings.forEach((booking) => {
      const date = getBookingDate(booking);

      if (date) {
        set.add(date);
      }
    });

    return set;
  }, [bookings]);

  // ==========================================================
  // LISTE FILTRÉE (recherche texte + période)
  // ==========================================================

  const filteredBookings = useMemo(() => {
    let result = bookings;

    const query = searchQuery.trim().toLowerCase();

    if (query) {
      result = result.filter((booking) => {
        const client = getClientName(booking).toLowerCase();
        const massage = getMassageName(booking).toLowerCase();
        const address = getAddress(booking).toLowerCase();

        return (
          client.includes(query) ||
          massage.includes(query) ||
          address.includes(query)
        );
      });
    }

    if (appliedRange.start) {
      const startKey = toDateKey(appliedRange.start);
      // Si "Au" n'a jamais été choisi, on filtre uniquement le
      // jour de début (comportement d'un jour unique).
      const endKey = appliedRange.end
        ? toDateKey(appliedRange.end)
        : startKey;

      const [lowKey, highKey] =
        startKey <= endKey
          ? [startKey, endKey]
          : [endKey, startKey];

      result = result.filter((booking) => {
        const key = getBookingDate(booking);

        if (!key) {
          return false;
        }

        return key >= lowKey && key <= highKey;
      });
    }

    return result;
  }, [bookings, searchQuery, appliedRange]);

  // ----------------------------------------------------------
  // Sélection dans le calendrier : le 1er jour touché devient
  // "Du", le 2ème "Au" (en s'ajustant automatiquement si
  // l'utilisateur touche un jour antérieur au "Du" déjà choisi).
  // Rien n'est appliqué à la liste tant que l'utilisateur n'a
  // pas appuyé sur "Appliquer".
  // ----------------------------------------------------------

  const handleSelectCalendarDate = useCallback((date) => {
    setDraftRange((prev) => {
      if (!prev.start || (prev.start && prev.end)) {
        return { start: date, end: null };
      }

      if (toDateKey(date) < toDateKey(prev.start)) {
        return { start: date, end: null };
      }

      return { start: prev.start, end: date };
    });
  }, []);

  const handleResetCalendarDate = useCallback(() => {
    setDraftRange({ start: null, end: null });
    setAppliedRange({ start: null, end: null });
    setCalendarVisible(false);
  }, []);

  const handleApplyCalendarDate = useCallback(() => {
    setAppliedRange(draftRange);
    setCalendarVisible(false);
  }, [draftRange]);

  const openCalendarModal = useCallback(() => {
    setDraftRange(appliedRange);
    setCalendarVisible(true);
  }, [appliedRange]);

  const closeCalendarModal = useCallback(() => {
    setCalendarVisible(false);
  }, []);

  const clearAppliedRange = useCallback(() => {
    setAppliedRange({ start: null, end: null });
    setDraftRange({ start: null, end: null });
  }, []);

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
  // MENU ⋮
  // ==========================================================

  const handleMenuPress = useCallback((booking) => {
    setMenuTarget(booking);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuTarget(null);
  }, []);

  const handleViewDetailsFromMenu = useCallback(() => {
    if (menuTarget) {
      openBooking(menuTarget);
    }

    setMenuTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuTarget]);

  // ==========================================================
  // START MASSAGE
  // ==========================================================

  const handleStartMassage = (
    booking
  ) => {
    const bookingId =
      getBookingId(booking);

    if (!bookingId) {
      showToast(
        'Identifiant de réservation introuvable.',
        'error'
      );

      return;
    }

    const status =
      normalizeStatus(
        booking?.status
      );

    if (status !== 'confirmed') {
      showToast(
        `Cette réservation est actuellement "${getStatusConfig(status).label}".`,
        'error'
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

        showToast(
          'La réservation est maintenant en cours.',
          'success'
        );

        await loadBookings();
      } catch (error) {
        console.error(
          '❌ [CALENDAR] startBooking:',
          error
        );

        showToast(
          error?.message ||
            'Impossible de démarrer le massage.',
          'error'
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

  const handleStartFromMenu = useCallback(() => {
    const target = menuTarget;
    setMenuTarget(null);

    if (target) {
      handleStartMassage(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuTarget]);

  // ==========================================================
  // COMPLETE MASSAGE
  // ==========================================================

  const handleCompleteMassage = (
    booking
  ) => {
    const bookingId =
      getBookingId(booking);

    if (!bookingId) {
      showToast(
        'Identifiant de réservation introuvable.',
        'error'
      );

      return;
    }

    const status =
      normalizeStatus(
        booking?.status
      );

    if (status !== 'in_progress') {
      showToast(
        `Cette réservation est actuellement "${getStatusConfig(status).label}".`,
        'error'
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

        showToast(
          'La réservation est maintenant terminée.',
          'success'
        );

        await loadBookings();
      } catch (error) {
        console.error(
          '❌ [CALENDAR] completeBooking:',
          error
        );

        showToast(
          error?.message ||
            'Impossible de terminer le massage.',
          'error'
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

  const handleCompleteFromMenu = useCallback(() => {
    const target = menuTarget;
    setMenuTarget(null);

    if (target) {
      handleCompleteMassage(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuTarget]);

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
        delay={Math.min(index, 8) * 60}
        duration={400}
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

            {/* ✅ Menu ⋮ (remplace le bouton "Détails" + les
                boutons d'action pleine largeur : toutes les
                actions de cette réservation vivent maintenant
                ici — fond blanc, points verts alignés
                verticalement. */}
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => handleMenuPress(booking)}
              style={styles.menuButton}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={17}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
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

  const hasActiveFilters =
    !!searchQuery.trim() || !!appliedRange.start;

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

      {/* ==================================================
          BARRE DE RECHERCHE + ICÔNE CALENDRIER
      ================================================== */}

      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={themeColors.textSecondary}
          />

          <TextInput
            style={[
              styles.searchInput,
              { color: themeColors.text },
            ]}
            placeholder="Rechercher un client, un massage..."
            placeholderTextColor={themeColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />

          {!!searchQuery && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={openCalendarModal}
          style={[
            styles.calendarIconButton,
            !!appliedRange.start &&
              styles.calendarIconButtonActive,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Filtrer par période"
        >
          <Ionicons
            name="calendar"
            size={19}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {!!appliedRange.start && (
        <View style={styles.dateFilterChipRow}>
          <View
            style={[
              styles.dateFilterChip,
              {
                backgroundColor: `${colors.primary}15`,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={colors.primary}
            />

            <Text
              style={[
                styles.dateFilterChipText,
                { color: colors.primary },
              ]}
            >
              {appliedRange.end &&
              toDateKey(appliedRange.end) !==
                toDateKey(appliedRange.start)
                ? `${toDateKey(appliedRange.start)} → ${toDateKey(
                    appliedRange.end,
                  )}`
                : toDateKey(appliedRange.start)}
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={clearAppliedRange}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="close"
                size={13}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

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
                  {filteredBookings.length}
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
            LISTE COMPLÈTE (filtrée par recherche + période)
        ================================================== */}

        {filteredBookings.length > 0 &&
          filteredBookings.map(renderBooking)}

        {filteredBookings.length === 0 &&
          bookings.length > 0 && (
            <View style={styles.emptyState}>
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
                  name="search-outline"
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
                Aucun résultat
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
                {hasActiveFilters
                  ? "Aucune réservation ne correspond à votre recherche ou à la période choisie."
                  : "Il n'y a aucune réservation pour le moment."}
              </Text>
            </View>
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

      {/* ==================================================
          MODALE DE FILTRE PAR PÉRIODE
      ================================================== */}

      <DateRangeModal
        visible={calendarVisible}
        range={draftRange}
        bookingDateSet={bookingDateSet}
        themeColors={themeColors}
        onClose={closeCalendarModal}
        onSelectDate={handleSelectCalendarDate}
        onReset={handleResetCalendarDate}
        onApply={handleApplyCalendarDate}
      />

      {/* ==================================================
          MENU ⋮ D'UNE RÉSERVATION
      ================================================== */}

      <BookingMenuSheet
        visible={!!menuTarget}
        booking={menuTarget}
        themeColors={themeColors}
        onClose={closeMenu}
        onViewDetails={handleViewDetailsFromMenu}
        onStart={handleStartFromMenu}
        onComplete={handleCompleteFromMenu}
      />

      {/* ==================================================
          TOAST — s'affiche sous le header, quel que soit
          l'endroit de l'écran où l'action a été lancée.
      ================================================== */}

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={hideToast}
      />
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
  // SEARCH + CALENDAR ICON
  // ========================================================

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },

  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },

  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: typography.fontFamily.regular,
    paddingVertical: 0,
  },

  calendarIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },

  calendarIconButtonActive: {
    backgroundColor: '#2E7D32',
  },

  dateFilterChipRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginTop: 8,
    marginBottom: 2,
  },

  dateFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },

  dateFilterChipText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
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
    justifyContent: 'space-between',
    marginLeft: 7,
    minHeight: 58,
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

  // ✅ Menu ⋮ : fond BLANC, points VERTS (colors.primary),
  // alignés verticalement, avec une fine bordure pour rester
  // visible même sur un fond clair.
  menuButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
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

  // ========================================================
  // TOAST
  // ========================================================

  toastOverlay: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 14 : 55,
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
  },

  toastCard: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },

  toastText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: typography.fontFamily.medium,
  },

  // ========================================================
  // MODAL BACKDROP (commun DateRangeModal / BookingMenuSheet)
  // ========================================================

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,20,0.45)',
    justifyContent: 'flex-end',
  },

  confirmButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmButtonGhost: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },

  confirmButtonGhostText: {
    fontSize: 13.5,
    fontFamily: typography.fontFamily.bold,
  },

  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: typography.fontFamily.bold,
  },

  // ========================================================
  // ACTION SHEET (menu ⋮)
  // ========================================================

  actionSheet: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    // paddingBottom réel calculé dans le composant (insets.bottom
    // + marge) pour tenir compte de la barre de navigation Android.
  },

  actionSheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148,163,184,0.5)',
    marginBottom: 14,
  },

  actionSheetTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
  },

  actionSheetSubtitle: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 11.5,
    fontFamily: typography.fontFamily.semiBold,
  },

  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },

  actionSheetIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionSheetRowText: {
    fontSize: 13.5,
    fontFamily: typography.fontFamily.medium,
  },

  actionSheetCloseButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },

  actionSheetCloseText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  // ========================================================
  // CALENDAR FILTER MODAL
  // ========================================================

  calendarSheet: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    // paddingBottom réel calculé dans le composant (insets.bottom
    // + marge) pour tenir compte de la barre de navigation Android.
  },

  calendarModalTitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    fontFamily: typography.fontFamily.bold,
  },

  rangeFieldsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },

  rangeField: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  rangeFieldLabel: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
  },

  rangeFieldValue: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: typography.fontFamily.semiBold,
  },

  rangeFieldArrow: {
    marginTop: 10,
  },

  calendarHint: {
    marginTop: 10,
    fontSize: 11.5,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },

  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 14,
    paddingHorizontal: 4,
  },

  calendarHeaderTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
  },

  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },

  calendarWeekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarDayText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
  },

  calendarDayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  calendarActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
});

export default CalendarScreen;