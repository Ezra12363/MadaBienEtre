// src/screens/therapist/CalendarScreen.js

import {
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
  Image,
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
// COLORS
// ============================================================

const PRIMARY_GREEN = colors.primary || '#168A55';
const _SECONDARY_GREEN = '#2E9B68';
const _LIGHT_GREEN = '#E8F6EF';

const _TEXT_DARK = '#17231D';
const _MUTED_TEXT = '#718078';

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
    booking?.client_full_name ??
    booking?.client?.fullname ??
    booking?.client?.full_name ??
    booking?.client?.name ??
    'Client'
  );
};

const getClientEmail = (booking) => {
  return (
    booking?.client_email ??
    booking?.client?.email ??
    booking?.user?.email ??
    booking?.customer_email ??
    'Email non renseigné'
  );
};

const getMassageDuration = (booking) => {
  const value =
    booking?.duration_minutes ??
    booking?.duration ??
    booking?.massage_duration ??
    booking?.massageDuration ??
    booking?.duration_min ??
    booking?.massage_type?.duration_minutes ??
    booking?.massage_type?.duration ??
    booking?.massage?.duration_minutes ??
    booking?.massage?.duration ??
    null;

  if (value === null || value === undefined || value === '') {
    return 'Durée non renseignée';
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? `${numericValue} min`
    : String(value);
};

const getClientPhoto = (booking) => {
  return (
    booking?.client_photo ??
    booking?.client_avatar ??
    booking?.client_image ??
    booking?.client?.photo_url ??
    booking?.client?.avatar_url ??
    booking?.client?.image_url ??
    booking?.client?.photo ??
    booking?.client?.avatar ??
    booking?.client?.image ??
    null
  );
};

const getMassageName = (booking) => {
  const massage = booking?.massage_type;

  if (typeof massage === 'object' && massage !== null) {
    return (
      massage?.name ??
      massage?.title ??
      massage?.label ??
      'Massage'
    );
  }

  return (
    booking?.massage_type_name ??
    booking?.massageTypeName ??
    booking?.massage_name ??
    booking?.massageName ??
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
    booking?.client?.address ??
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

  return Number.isFinite(number) ? number : 0;
};

const formatPrice = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 'Prix non défini';
  }

  return `${number.toLocaleString('fr-FR')} Ar`;
};

const _formatDateLong = (dateString) => {
  if (!dateString) {
    return '';
  }

  try {
    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (_error) {
    return dateString;
  }
};

const formatShortDate = (dateString) => {
  if (!dateString) {
    return '';
  }

  try {
    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (_error) {
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
    color: '#F59E0B',
    background: '#FFF7E6',
  },

  negotiating: {
    label: 'Négociation',
    icon: 'swap-horizontal-outline',
    color: '#7C3AED',
    background: '#F1EAFE',
  },

  confirmed: {
    label: 'Confirmée',
    icon: 'checkmark-circle-outline',
    color: '#16A34A',
    background: '#E8F7EE',
  },

  in_progress: {
    label: 'En cours',
    icon: 'play-circle-outline',
    color: '#EA8A00',
    background: '#FFF2DE',
  },

  completed: {
    label: 'Terminée',
    icon: 'checkmark-done-circle-outline',
    color: '#15803D',
    background: '#E3F4E8',
  },

  cancelled: {
    label: 'Annulée',
    icon: 'close-circle-outline',
    color: '#DC2626',
    background: '#FDECEC',
  },

  cancelled_by_client: {
    label: 'Annulée par client',
    icon: 'close-circle-outline',
    color: '#DC2626',
    background: '#FDECEC',
  },

  cancelled_by_therapist: {
    label: 'Annulée par thérapeute',
    icon: 'close-circle-outline',
    color: '#DC2626',
    background: '#FDECEC',
  },

  expired: {
    label: 'Expirée',
    icon: 'alert-circle-outline',
    color: '#6B7280',
    background: '#F1F3F5',
  },
};

const getStatusConfig = (status) => {
  const normalized = normalizeStatus(status);

  return (
    STATUS_CONFIG[normalized] || {
      label: normalized || 'Inconnu',
      icon: 'help-circle-outline',
      color: '#777777',
      background: '#F1F3F5',
    }
  );
};

// ============================================================
// DATE HELPERS
// ============================================================

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTH_LABELS = [
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
];

const toDateKey = (date) => {
  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const buildMonthGrid = (viewDate) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  return cells;
};

// ============================================================
// TOAST
// ============================================================

const TOAST_CONFIG = {
  success: {
    icon: 'checkmark-circle',
    color: '#15803D',
    background: '#DCFCE7',
  },

  error: {
    icon: 'close-circle',
    color: '#B91C1C',
    background: '#FEE2E2',
  },

  info: {
    icon: 'information-circle',
    color: '#1D4ED8',
    background: '#DBEAFE',
  },
};

const Toast = ({ visible, type, message, onHide }) => {
  const translateY = useMemo(
    () => new Animated.Value(-90),
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
        toValue: -90,
        duration: 220,
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
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.toastCard,
          {
            backgroundColor: config.background,
          },
        ]}
      >
        <Ionicons
          name={config.icon}
          size={21}
          color={config.color}
        />

        <Text
          numberOfLines={2}
          style={[
            styles.toastText,
            {
              color: config.color,
            },
          ]}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

// ============================================================
// CALENDAR PANEL (PERMANENT — plus de modal)
// ------------------------------------------------------------
// Affiché en permanence dans la page, au-dessus de la liste
// des réservations. Chaque jour affiche :
//   - un badge avec le nombre de réservations de ce jour
//   - des points colorés selon les statuts présents ce jour
// Permet aussi la sélection d'une période (Du / Au).
// ============================================================

const CalendarPanel = ({
  themeColors,
  viewDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  range,
  onSelectDate,
  onResetRange,
  bookingsByDate,
  presentStatuses,
}) => {
  const cells = useMemo(
    () => buildMonthGrid(viewDate),
    [viewDate],
  );

  const todayKey = toDateKey(new Date());
  const startKey = range?.start ? toDateKey(range.start) : null;
  const endKey = range?.end ? toDateKey(range.end) : null;
  const hasRange = !!startKey;

  return (
    <View
      style={[
        styles.calendarPanelCard,
        {
          backgroundColor:
            themeColors.surface || themeColors.card,
          borderColor: themeColors.border,
        },
      ]}
    >
      {/* HEADER */}

      <View style={styles.calendarPanelHeaderRow}>
        <View style={styles.calendarPanelTitleRow}>
          <View
            style={[
              styles.calendarPanelIcon,
              {
                backgroundColor: `${PRIMARY_GREEN}18`,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={PRIMARY_GREEN}
            />
          </View>

          <Text
            style={[
              styles.calendarPanelTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            Calendrier
          </Text>
        </View>

        {hasRange && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onResetRange}
            hitSlop={{
              top: 8,
              bottom: 8,
              left: 8,
              right: 8,
            }}
          >
            <Text
              style={[
                styles.calendarClearLink,
                {
                  color: PRIMARY_GREEN,
                },
              ]}
            >
              Effacer
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* NAVIGATION MOIS */}

      <View style={styles.calendarHeaderRow}>
        <TouchableOpacity
          style={styles.monthArrowButton}
          onPress={onPrevMonth}
          hitSlop={{
            top: 8,
            bottom: 8,
            left: 8,
            right: 8,
          }}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={themeColors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onToday}
        >
          <Text
            style={[
              styles.calendarHeaderTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            {MONTH_LABELS[viewDate.getMonth()]}{' '}
            {viewDate.getFullYear()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.monthArrowButton}
          onPress={onNextMonth}
          hitSlop={{
            top: 8,
            bottom: 8,
            left: 8,
            right: 8,
          }}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={themeColors.text}
          />
        </TouchableOpacity>
      </View>

      {/* JOURS DE LA SEMAINE */}

      <View style={styles.calendarWeekRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={[
              styles.calendarWeekLabel,
              {
                color: themeColors.textSecondary,
              },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* GRILLE DES JOURS */}

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

          const dayBookings =
            bookingsByDate.get(key) || [];

          const count = dayBookings.length;

          const uniqueStatuses = [];

          dayBookings.forEach((booking) => {
            const status = normalizeStatus(
              booking?.status,
            );

            if (!uniqueStatuses.includes(status)) {
              uniqueStatuses.push(status);
            }
          });

          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.75}
              onPress={() => onSelectDate(cellDate)}
              style={[
                styles.calendarCell,
                isInRange && {
                  backgroundColor: `${PRIMARY_GREEN}18`,
                },
                isStart &&
                  !!endKey && {
                    backgroundColor: `${PRIMARY_GREEN}18`,
                    borderTopLeftRadius: 14,
                    borderBottomLeftRadius: 14,
                  },
                isEnd &&
                  !!startKey && {
                    backgroundColor: `${PRIMARY_GREEN}18`,
                    borderTopRightRadius: 14,
                    borderBottomRightRadius: 14,
                  },
              ]}
            >
              <View style={styles.calendarDayCircleWrap}>
                <View
                  style={[
                    styles.calendarDayCircle,
                    isEdge && {
                      backgroundColor: PRIMARY_GREEN,
                    },
                    !isEdge &&
                      isToday && {
                        borderWidth: 1.5,
                        borderColor: PRIMARY_GREEN,
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

                {count > 0 && (
                  <View
                    style={[
                      styles.calendarCountBadge,
                      {
                        borderColor:
                          themeColors.surface ||
                          themeColors.card,
                      },
                    ]}
                  >
                    <Text style={styles.calendarCountBadgeText}>
                      {count > 9 ? '9+' : count}
                    </Text>
                  </View>
                )}
              </View>

              {count > 0 ? (
                <View style={styles.calendarDotsRow}>
                  {uniqueStatuses.slice(0, 4).map((status) => (
                    <View
                      key={status}
                      style={[
                        styles.calendarStatusDot,
                        {
                          backgroundColor:
                            getStatusConfig(status).color,
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.calendarDotsRowPlaceholder} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* LEGENDE DYNAMIQUE (statuts réellement présents) */}

      {presentStatuses.length > 0 && (
        <View style={styles.calendarLegendWrapRow}>
          {presentStatuses.map((status) => {
            const config = getStatusConfig(status);

            return (
              <View
                key={status}
                style={styles.calendarLegendItem}
              >
                <View
                  style={[
                    styles.calendarLegendDotSmall,
                    {
                      backgroundColor: config.color,
                    },
                  ]}
                />

                <Text
                  numberOfLines={1}
                  style={[
                    styles.calendarLegendLabel,
                    {
                      color: themeColors.textSecondary,
                    },
                  ]}
                >
                  {config.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* INDICATION DE SELECTION */}

      <Text
        style={[
          styles.calendarSelectionHint,
          {
            color: themeColors.textSecondary,
          },
        ]}
      >
        {!range?.start
          ? 'Touchez un jour pour filtrer, ou deux jours pour une période.'
          : !range?.end
          ? 'Touchez un second jour pour définir la fin de la période.'
          : `Période : ${formatShortDate(startKey)} → ${formatShortDate(
              endKey,
            )}`}
      </Text>
    </View>
  );
};

// ============================================================
// BOOKING MENU SHEET
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
        style={styles.menuModalBackdrop}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.actionSheet,
            {
              backgroundColor:
                themeColors.card || themeColors.surface,
              paddingBottom:
                20 +
                (Platform.OS === 'android'
                  ? insets.bottom
                  : 0),
            },
          ]}
          onPress={() => {}}
        >
          <View style={styles.actionSheetHandle} />

          <View style={styles.menuClientHeader}>
            <View
              style={[
                styles.menuClientAvatar,
                {
                  backgroundColor: `${PRIMARY_GREEN}18`,
                },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={21}
                color={PRIMARY_GREEN}
              />
            </View>

            <View style={styles.menuClientInfo}>
              <Text
                numberOfLines={1}
                style={[
                  styles.actionSheetTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {booking
                  ? getClientName(booking)
                  : 'Réservation'}
              </Text>

              <Text
                style={[
                  styles.actionSheetSubtitle,
                  {
                    color: statusConfig.color,
                  },
                ]}
              >
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.menuBookingSummary,
              {
                backgroundColor: themeColors.background,
                borderColor: themeColors.border,
              },
            ]}
          >
            <View style={styles.menuSummaryItem}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={themeColors.textSecondary}
              />

              <Text
                style={[
                  styles.menuSummaryText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {getBookingDate(booking)
                  ? formatShortDate(getBookingDate(booking))
                  : 'Date inconnue'}
              </Text>
            </View>

            <View style={styles.menuSummaryItem}>
              <Ionicons
                name="time-outline"
                size={16}
                color={themeColors.textSecondary}
              />

              <Text
                style={[
                  styles.menuSummaryText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {getBookingTime(booking)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onViewDetails}
            style={styles.actionSheetRow}
          >
            <View
              style={[
                styles.actionSheetIcon,
                {
                  backgroundColor: `${PRIMARY_GREEN}15`,
                },
              ]}
            >
              <Ionicons
                name="eye-outline"
                size={19}
                color={PRIMARY_GREEN}
              />
            </View>

            <Text
              style={[
                styles.actionSheetRowText,
                {
                  color: themeColors.text,
                },
              ]}
            >
              Voir les détails
            </Text>

            <Ionicons
              name="chevron-forward"
              size={17}
              color={themeColors.textSecondary}
            />
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
                  {
                    backgroundColor: '#4CAF5018',
                  },
                ]}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={19}
                  color="#4CAF50"
                />
              </View>

              <Text
                style={[
                  styles.actionSheetRowText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Commencer le massage
              </Text>

              <Ionicons
                name="chevron-forward"
                size={17}
                color={themeColors.textSecondary}
              />
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
                  {
                    backgroundColor: '#2E7D3218',
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={19}
                  color="#2E7D32"
                />
              </View>

              <Text
                style={[
                  styles.actionSheetRowText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Terminer le massage
              </Text>

              <Ionicons
                name="chevron-forward"
                size={17}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={[
              styles.actionSheetCloseButton,
              {
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.actionSheetCloseText,
                {
                  color: themeColors.textSecondary,
                },
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
// LEGEND (résumé)
// ============================================================

const Legend = ({
  color,
  label,
  themeColors,
}) => {
  return (
    <View style={styles.legendItem}>
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
            color: themeColors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};


// ============================================================
// CONFIRMATION MODAL
// ============================================================
const ConfirmationModal = ({ visible, type, booking, themeColors, onCancel, onConfirm }) => {
  const isStart = type === 'start';
  const title = isStart ? 'Commencer le massage ?' : 'Terminer le massage ?';
  const message = isStart
    ? 'Voulez-vous commencer maintenant cette réservation ?'
    : 'Voulez-vous confirmer que le massage est terminé ?';
  const actionLabel = isStart ? 'Commencer' : 'Terminer';
  const actionColor = isStart ? PRIMARY_GREEN : '#2E7D32';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmationBackdrop}>
        <View style={[styles.confirmationCard, { backgroundColor: themeColors.card || themeColors.surface }]}>
          <View style={[styles.confirmationIcon, { backgroundColor: `${actionColor}18` }]}>
            <Ionicons
              name={isStart ? 'play-circle-outline' : 'checkmark-done-circle-outline'}
              size={34}
              color={actionColor}
            />
          </View>

          <Text style={[styles.confirmationTitle, { color: themeColors.text }]}>
            {title}
          </Text>

          <Text style={[styles.confirmationMessage, { color: themeColors.textSecondary }]}>
            {message}
          </Text>

          {!!booking && (
            <View style={[styles.confirmationBookingInfo, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
              <Text numberOfLines={1} style={[styles.confirmationClient, { color: themeColors.text }]}>
                {getClientName(booking)}
              </Text>
              <Text numberOfLines={1} style={[styles.confirmationDetails, { color: themeColors.textSecondary }]}>
                {getMassageName(booking)} · {getBookingDate(booking) ? formatShortDate(getBookingDate(booking)) : 'Date inconnue'} · {getBookingTime(booking)}
              </Text>
            </View>
          )}

          <View style={styles.confirmationActions}>
            <TouchableOpacity activeOpacity={0.8} onPress={onCancel} style={[styles.confirmationCancelButton, { borderColor: themeColors.border }]}>
              <Text style={[styles.confirmationCancelText, { color: themeColors.textSecondary }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={onConfirm} style={[styles.confirmationConfirmButton, { backgroundColor: actionColor }]}>
              <Ionicons name={isStart ? 'play' : 'checkmark'} size={16} color="#FFFFFF" />
              <Text style={styles.confirmationConfirmText}>{actionLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// MAIN SCREEN
// ============================================================

const CalendarScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  const fadeAnim = useRef(
    new Animated.Value(0),
  ).current;

  const [searchQuery, setSearchQuery] = useState('');

  // ----------------------------------------------------------
  // CALENDRIER PERMANENT : mois affiché + période sélectionnée
  // ----------------------------------------------------------

  const [viewDate, setViewDate] = useState(
    () => new Date(),
  );

  const [dateRange, setDateRange] = useState({
    start: null,
    end: null,
  });

  const [menuTarget, setMenuTarget] = useState(null);

  const [confirmation, setConfirmation] = useState({
    visible: false,
    type: 'start',
    booking: null,
  });

  const [toast, setToast] = useState({
    visible: false,
    type: 'success',
    message: '',
  });

  const showToast = useCallback(
    (message, type = 'success') => {
      setToast({
        visible: true,
        type,
        message,
      });
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToast((previous) => ({
      ...previous,
      visible: false,
    }));
  }, []);

  // ==========================================================
  // LOAD BOOKINGS
  // ==========================================================

  const loadBookings = useCallback(
    async ({ refreshing = false } = {}) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage('');

      try {
        const result =
          await bookingService.getBookings();

        if (!result?.success) {
          throw new Error(
            result?.error ||
              'Impossible de récupérer les réservations.',
          );
        }

        const realBookings = Array.isArray(result?.data)
          ? result.data
          : [];

        const validBookings = realBookings
          .filter(
            (booking) =>
              getBookingId(booking) !== null &&
              getBookingDate(booking),
          )
          .sort((a, b) => {
            const dateA = `${getBookingDate(a)} ${getBookingTime(a)}`;
            const dateB = `${getBookingDate(b)} ${getBookingTime(b)}`;

            return dateA.localeCompare(dateB);
          });

        setBookings(validBookings);
      } catch (error) {
        console.error(
          '[CALENDAR] Erreur de chargement :',
          error,
        );

        setBookings([]);

        setErrorMessage(
          error?.message ||
            'Impossible de charger les réservations.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadBookings();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [fadeAnim, loadBookings]);

  useFocusEffect(
    useCallback(() => {
      loadBookings({
        refreshing: false,
      });
    }, [loadBookings]),
  );

  // ==========================================================
  // RÉSERVATIONS GROUPÉES PAR JOUR (pour le calendrier)
  // ==========================================================

  const bookingsByDate = useMemo(() => {
    const map = new Map();

    bookings.forEach((booking) => {
      const date = getBookingDate(booking);

      if (!date) {
        return;
      }

      if (!map.has(date)) {
        map.set(date, []);
      }

      map.get(date).push(booking);
    });

    return map;
  }, [bookings]);

  // Statuts réellement présents (pour la légende dynamique)

  const presentStatuses = useMemo(() => {
    const set = new Set();

    bookings.forEach((booking) => {
      set.add(normalizeStatus(booking?.status));
    });

    return Array.from(set);
  }, [bookings]);

  // ==========================================================
  // FILTERED BOOKINGS
  // ==========================================================

  const filteredBookings = useMemo(() => {
    let result = bookings;

    const query = searchQuery.trim().toLowerCase();

    if (query) {
      result = result.filter((booking) => {
        const client = String(
          getClientName(booking),
        ).toLowerCase();

        const massage = String(
          getMassageName(booking),
        ).toLowerCase();

        const address = String(
          getAddress(booking),
        ).toLowerCase();

        const date = String(
          getBookingDate(booking) || '',
        ).toLowerCase();

        const time = String(
          getBookingTime(booking) || '',
        ).toLowerCase();

        return (
          client.includes(query) ||
          massage.includes(query) ||
          address.includes(query) ||
          date.includes(query) ||
          time.includes(query)
        );
      });
    }

    if (dateRange.start) {
      const startKey = toDateKey(dateRange.start);

      const endKey = dateRange.end
        ? toDateKey(dateRange.end)
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
  }, [bookings, searchQuery, dateRange]);

  // ==========================================================
  // CALENDRIER : NAVIGATION + SÉLECTION DE PÉRIODE
  // ==========================================================

  const handlePrevMonth = useCallback(() => {
    setViewDate((previous) =>
      new Date(
        previous.getFullYear(),
        previous.getMonth() - 1,
        1,
      ),
    );
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewDate((previous) =>
      new Date(
        previous.getFullYear(),
        previous.getMonth() + 1,
        1,
      ),
    );
  }, []);

  const handleGoToday = useCallback(() => {
    setViewDate(new Date());
  }, []);

  const handleSelectCalendarDate = useCallback(
    (date) => {
      setDateRange((previous) => {
        if (!previous.start || previous.end) {
          return {
            start: date,
            end: null,
          };
        }

        if (
          toDateKey(date) < toDateKey(previous.start)
        ) {
          return {
            start: date,
            end: null,
          };
        }

        return {
          start: previous.start,
          end: date,
        };
      });
    },
    [],
  );

  const handleResetDateRange = useCallback(() => {
    setDateRange({
      start: null,
      end: null,
    });
  }, []);

  const handleRefresh = useCallback(() => {
    loadBookings({
      refreshing: true,
    });
  }, [loadBookings]);

  // ==========================================================
  // OPEN BOOKING
  // ==========================================================

  const openBooking = useCallback(
    (booking, _skipConfirmation = false) => {
      const bookingId = getBookingId(booking);

      if (!bookingId) {
        Alert.alert(
          'Erreur',
          'Identifiant de réservation introuvable.',
        );

        return;
      }

      navigation.navigate('BookingDetail', {
        bookingId,
        booking,
      });
    },
    [navigation],
  );

  // ==========================================================
  // MENU ACTIONS
  // ==========================================================

  const handleMenuPress = useCallback((booking) => {
    setMenuTarget(booking);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuTarget(null);
  }, []);

  const handleViewDetailsFromMenu = useCallback(() => {
    const target = menuTarget;

    setMenuTarget(null);

    if (target) {
      openBooking(target);
    }
  }, [menuTarget, openBooking]);

  // ==========================================================
  // START MASSAGE
  // ==========================================================

  const handleStartMassage = useCallback(
    (booking, skipConfirmation = false) => {
      const bookingId = getBookingId(booking);

      if (!bookingId) {
        showToast(
          'Identifiant de réservation introuvable.',
          'error',
        );

        return;
      }

      const status = normalizeStatus(booking?.status);

      if (status !== 'confirmed') {
        showToast(
          `Cette réservation est actuellement "${getStatusConfig(status).label}".`,
          'error',
        );

        return;
      }

      const execute = async () => {
        try {
          setIsLoading(true);

          const result =
            await bookingService.startBooking(
              bookingId,
            );

          if (!result?.success) {
            throw new Error(
              result?.error ||
                'Impossible de démarrer le massage.',
            );
          }

          showToast(
            'La réservation est maintenant en cours.',
            'success',
          );

          await loadBookings();
        } catch (error) {
          showToast(
            error?.message ||
              'Impossible de démarrer le massage.',
            'error',
          );
        } finally {
          setIsLoading(false);
        }
      };

      if (!skipConfirmation) {
        setConfirmation({ visible: true, type: 'start', booking });
        return;
      }

      execute();
    },
    [loadBookings, showToast],
  );

  const handleStartFromMenu = useCallback(() => {
    const target = menuTarget;

    setMenuTarget(null);

    if (target) {
      handleStartMassage(target, true);
    }
  }, [handleStartMassage, menuTarget]);

  // ==========================================================
  // COMPLETE MASSAGE
  // ==========================================================

  const handleCompleteMassage = useCallback(
    (booking, skipConfirmation = false) => {
      const bookingId = getBookingId(booking);

      if (!bookingId) {
        showToast(
          'Identifiant de réservation introuvable.',
          'error',
        );

        return;
      }

      const status = normalizeStatus(booking?.status);

      if (status !== 'in_progress') {
        showToast(
          `Cette réservation est actuellement "${getStatusConfig(status).label}".`,
          'error',
        );

        return;
      }

      const execute = async () => {
        try {
          setIsLoading(true);

          const result =
            await bookingService.completeBooking(
              bookingId,
            );

          if (!result?.success) {
            throw new Error(
              result?.error ||
                'Impossible de terminer le massage.',
            );
          }

          showToast(
            'La réservation est maintenant terminée.',
            'success',
          );

          await loadBookings();
        } catch (error) {
          showToast(
            error?.message ||
              'Impossible de terminer le massage.',
            'error',
          );
        } finally {
          setIsLoading(false);
        }
      };

      if (!skipConfirmation) {
        setConfirmation({ visible: true, type: 'complete', booking });
        return;
      }

      execute();
    },
    [loadBookings, showToast],
  );

  const handleCompleteFromMenu = useCallback(() => {
    const target = menuTarget;

    setMenuTarget(null);

    if (target) {
      handleCompleteMassage(target, true);
    }
  }, [handleCompleteMassage, menuTarget]);

  // ==========================================================
  // BOOKING CARD
  // ==========================================================

  const renderBooking = useCallback(
    (booking, index) => {
      const bookingId = getBookingId(booking);
      const status = normalizeStatus(booking?.status);
      const statusConfig = getStatusConfig(status);

      const clientName = getClientName(booking);
      const clientEmail = getClientEmail(booking);
      const clientPhoto = getClientPhoto(booking);
      const massageName = getMassageName(booking);
      const massageDuration = getMassageDuration(booking);
      const time = getBookingTime(booking);
      const date = getBookingDate(booking);
      const address = getAddress(booking);
      const price = getPrice(booking);

      return (
        <Animatable.View
          key={String(bookingId)}
          animation="fadeInUp"
          delay={Math.min(index, 8) * 55}
          duration={420}
        >
          <View
            style={[
              styles.bookingItem,
              {
                backgroundColor:
                  themeColors.surface ||
                  themeColors.background,
                borderColor: themeColors.border,
              },
            ]}
          >
            <View
              style={[
                styles.bookingTopLine,
                {
                  backgroundColor: statusConfig.color,
                },
              ]}
            />

            <View style={styles.bookingContent}>
              <View
                style={[
                  styles.timeBox,
                  {
                    backgroundColor: statusConfig.background,
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={statusConfig.color}
                />

                <Text
                  style={[
                    styles.timeText,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {time}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.78}
                style={styles.bookingMain}
                onPress={() => openBooking(booking)}
              >
                <View style={styles.clientRow}>
                  <View
                    style={[
                      styles.clientAvatarFrame,
                      {
                        borderColor: `${PRIMARY_GREEN}55`,
                        backgroundColor:
                          themeColors.background,
                      },
                    ]}
                  >
                    {clientPhoto ? (
                      <Image
                        source={{ uri: clientPhoto }}
                        style={styles.clientPhoto}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={PRIMARY_GREEN}
                      />
                    )}
                  </View>

                  <View style={styles.clientTextBox}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.clientName,
                        {
                          color: themeColors.text,
                        },
                      ]}
                    >
                      {clientName}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.clientEmail,
                        {
                          color: themeColors.textSecondary,
                        },
                      ]}
                    >
                      {clientEmail}
                    </Text>

                    <View style={styles.massageInfoRow}>
                      <Ionicons
                        name="hand-left-outline"
                        size={12}
                        color={PRIMARY_GREEN}
                      />

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.massageName,
                          {
                            color: themeColors.textSecondary,
                          },
                        ]}
                      >
                        {massageName}
                      </Text>

                      <View style={styles.infoSeparator} />

                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={PRIMARY_GREEN}
                      />

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.massageDuration,
                          {
                            color: themeColors.textSecondary,
                          },
                        ]}
                      >
                        {massageDuration}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.bookingMetaGrid}>
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={themeColors.textSecondary}
                    />

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.detailText,
                        {
                          color: themeColors.textSecondary,
                        },
                      ]}
                    >
                      {date
                        ? formatShortDate(date)
                        : 'Date inconnue'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={themeColors.textSecondary}
                    />

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.detailText,
                        {
                          color: themeColors.textSecondary,
                        },
                      ]}
                    >
                      {address}
                    </Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <Ionicons
                    name="cash-outline"
                    size={14}
                    color={PRIMARY_GREEN}
                  />

                  <Text
                    style={[
                      styles.priceText,
                      {
                        color: PRIMARY_GREEN,
                      },
                    ]}
                  >
                    {formatPrice(price)}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.rightColumn}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        statusConfig.background,
                    },
                  ]}
                >
                  <Ionicons
                    name={statusConfig.icon}
                    size={13}
                    color={statusConfig.color}
                  />

                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: statusConfig.color,
                      },
                    ]}
                  >
                    {statusConfig.label}
                  </Text>
                </View>

                <View style={styles.menuButtonBottom}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    hitSlop={{
                      top: 10,
                      bottom: 10,
                      left: 10,
                      right: 10,
                    }}
                    onPress={() => handleMenuPress(booking)}
                    style={styles.menuButton}
                    accessibilityRole="button"
                    accessibilityLabel="Ouvrir le menu de la réservation"
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={19}
                      color={PRIMARY_GREEN}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Animatable.View>
      );
    },
    [
      handleMenuPress,
      openBooking,
      themeColors,
    ],
  );

  // ==========================================================
  // LOADING
  // ==========================================================

  if (isLoading && bookings.length === 0) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor: themeColors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={PRIMARY_GREEN}
          style={styles.loadingIndicator}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color: themeColors.textSecondary,
            },
          ]}
        >
          Chargement du calendrier...
        </Text>
      </View>
    );
  }

  const hasActiveFilters =
    !!searchQuery.trim() || !!dateRange.start;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.background,
        },
      ]}
    >
      <Header
        title="Calendrier"
        showBack
      />

      <View style={styles.pageIntro}>
        <View>
          <Text
            style={[
              styles.pageTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            Mes rendez-vous
          </Text>

          <Text
            style={[
              styles.pageSubtitle,
              {
                color: themeColors.textSecondary,
              },
            ]}
          >
            Retrouvez toutes vos réservations par date.
          </Text>
        </View>

        <View
          style={[
            styles.pageCountBadge,
            {
              backgroundColor: `${PRIMARY_GREEN}16`,
            },
          ]}
        >
          <Ionicons
            name="calendar-number-outline"
            size={16}
            color={PRIMARY_GREEN}
          />

          <Text
            style={[
              styles.pageCountText,
              {
                color: PRIMARY_GREEN,
              },
            ]}
          >
            {filteredBookings.length}
          </Text>
        </View>
      </View>

      {/* ======================================================
          SEARCH BAR
      ====================================================== */}

      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor:
                themeColors.surface ||
                themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={19}
            color={themeColors.textSecondary}
          />

          <TextInput
            style={[
              styles.searchInput,
              {
                color: themeColors.text,
              },
            ]}
            placeholder="Rechercher un client, un massage..."
            placeholderTextColor={
              themeColors.textSecondary
            }
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />

          {!!searchQuery && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSearchQuery('')}
              hitSlop={{
                top: 8,
                bottom: 8,
                left: 8,
                right: 8,
              }}
            >
              <Ionicons
                name="close-circle"
                size={19}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Animated.ScrollView
        style={[
          styles.scrollView,
          {
            opacity: fadeAnim,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY_GREEN}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* ==================================================
            ERROR
        ================================================== */}

        {!!errorMessage && (
          <Animatable.View
            animation="fadeIn"
            style={[
              styles.errorCard,
              {
                backgroundColor: '#D32F2F12',
                borderColor: '#D32F2F35',
              },
            ]}
          >
            <View style={styles.errorIconBox}>
              <Ionicons
                name="alert-circle-outline"
                size={23}
                color="#D32F2F"
              />
            </View>

            <View style={styles.errorContent}>
              <Text
                style={[
                  styles.errorTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Impossible de charger les données
              </Text>

              <Text
                style={[
                  styles.errorText,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                {errorMessage}
              </Text>

              <TouchableOpacity
                style={[
                  styles.retryButton,
                  {
                    borderColor: PRIMARY_GREEN,
                  },
                ]}
                onPress={() => loadBookings()}
              >
                <Ionicons
                  name="refresh-outline"
                  size={15}
                  color={PRIMARY_GREEN}
                />

                <Text
                  style={[
                    styles.retryText,
                    {
                      color: PRIMARY_GREEN,
                    },
                  ]}
                >
                  Réessayer
                </Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        )}

        {/* ==================================================
            CALENDRIER PERMANENT
        ================================================== */}

        <Animatable.View
          animation="fadeInDown"
          duration={500}
        >
          <CalendarPanel
            themeColors={themeColors}
            viewDate={viewDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleGoToday}
            range={dateRange}
            onSelectDate={handleSelectCalendarDate}
            onResetRange={handleResetDateRange}
            bookingsByDate={bookingsByDate}
            presentStatuses={presentStatuses}
          />
        </Animatable.View>

        {/* ==================================================
            BOOKINGS LIST
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
                    backgroundColor: `${PRIMARY_GREEN}12`,
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={36}
                  color={PRIMARY_GREEN}
                />
              </View>

              <Text
                style={[
                  styles.emptyStateTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Aucun résultat
              </Text>

              <Text
                style={[
                  styles.emptyStateText,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                {hasActiveFilters
                  ? 'Aucune réservation ne correspond à votre recherche ou à la période choisie.'
                  : "Il n'y a aucune réservation pour le moment."}
              </Text>

              {hasActiveFilters && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setSearchQuery('');
                    handleResetDateRange();
                  }}
                  style={[
                    styles.emptyResetButton,
                    {
                      borderColor: PRIMARY_GREEN,
                    },
                  ]}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={15}
                    color={PRIMARY_GREEN}
                  />

                  <Text
                    style={[
                      styles.emptyResetButtonText,
                      {
                        color: PRIMARY_GREEN,
                      },
                    ]}
                  >
                    Réinitialiser les filtres
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        {/* ==================================================
            NO BOOKINGS
        ================================================== */}

        {bookings.length === 0 &&
          !errorMessage && (
            <View
              style={[
                styles.globalEmptyCard,
                {
                  backgroundColor:
                    themeColors.surface ||
                    themeColors.card,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.globalEmptyIcon,
                  {
                    backgroundColor: `${PRIMARY_GREEN}12`,
                  },
                ]}
              >
                <Ionicons
                  name="calendar-clear-outline"
                  size={43}
                  color={PRIMARY_GREEN}
                />
              </View>

              <Text
                style={[
                  styles.globalEmptyTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Aucun rendez-vous
              </Text>

              <Text
                style={[
                  styles.globalEmptyText,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                Vous n'avez actuellement aucune
                réservation enregistrée.
              </Text>
            </View>
          )}
      </Animated.ScrollView>

      <BookingMenuSheet
        visible={!!menuTarget}
        booking={menuTarget}
        themeColors={themeColors}
        onClose={closeMenu}
        onViewDetails={handleViewDetailsFromMenu}
        onStart={handleStartFromMenu}
        onComplete={handleCompleteFromMenu}
      />

      <ConfirmationModal
        visible={confirmation.visible}
        type={confirmation.type}
        booking={confirmation.booking}
        themeColors={themeColors}
        onCancel={() => setConfirmation({ visible: false, type: 'start', booking: null })}
        onConfirm={() => {
          const target = confirmation.booking;
          const type = confirmation.type;
          setConfirmation({ visible: false, type: 'start', booking: null });
          if (type === 'start') {
            handleStartMassage(target, true);
          } else {
            handleCompleteMassage(target, true);
          }
        }}
      />

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

    // Sur le web, un simple "flex: 1" ne borne pas toujours la
    // hauteur jusqu'à la racine du document : sans hauteur
    // explicite, la page s'étire au lieu de défiler. On fixe
    // donc une hauteur de viewport et on laisse le ScrollView
    // (scrollView ci-dessous) gérer le défilement interne.
    ...Platform.select({
      web: {
        height: '100vh',
        overflow: 'hidden',
      },
      default: {},
    }),
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingIndicator: {
    marginTop: 18,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
  },

  scrollView: {
    flex: 1,

    ...Platform.select({
      web: {
        overflowY: 'auto',
        overflowX: 'hidden',
        // Permet le défilement avec la molette de la souris /
        // le trackpad sur le web.
        WebkitOverflowScrolling: 'touch',
      },
      default: {},
    }),
  },

  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  // ========================================================
  // PAGE INTRO
  // ========================================================

  pageIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 16,
    paddingBottom: 8,
  },

  pageTitle: {
    fontSize: 21,
    fontFamily: typography.fontFamily.bold,
  },

  pageSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
  },

  pageCountBadge: {
    minWidth: 42,
    height: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },

  pageCountText: {
    marginLeft: 4,
    fontSize: 11.5,
    fontFamily: typography.fontFamily.bold,
  },

  // ========================================================
  // SEARCH
  // ========================================================

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 6,
  },

  searchBarContainer: {
    flex: 1,
    minWidth: 0,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 1,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
    fontSize: 13,
    paddingVertical: 0,
    fontFamily: typography.fontFamily.regular,
  },

  // ========================================================
  // ERROR
  // ========================================================

  errorCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: spacing.md,
  },

  errorIconBox: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 7,
  },

  errorTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
  },

  errorText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontFamily: typography.fontFamily.regular,
  },

  retryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10,
  },

  retryText: {
    marginLeft: 5,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },

  // ========================================================
  // CALENDAR PANEL (PERMANENT)
  // ========================================================

  calendarPanelCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.055,
    shadowRadius: 8,
    elevation: 2,
  },

  calendarPanelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  calendarPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  calendarPanelIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  calendarPanelTitle: {
    fontSize: 14.5,
    fontFamily: typography.fontFamily.bold,
  },

  calendarClearLink: {
    fontSize: 12.5,
    fontFamily: typography.fontFamily.bold,
  },

  rangeFieldsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  rangeField: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginHorizontal: 6,
  },

  rangeFieldLabel: {
    fontSize: 9,
    fontFamily: typography.fontFamily.medium,
  },

  rangeFieldValue: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: typography.fontFamily.semiBold,
  },

  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  monthArrowButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6F4',
  },

  calendarHeaderTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    textTransform: 'capitalize',
  },

  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },

  calendarWeekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: typography.fontFamily.medium,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  calendarCell: {
    width: `${100 / 7}%`,
    minWidth: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
    paddingBottom: 2,
  },

  calendarDayCircleWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarDayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarDayText: {
    fontSize: 11.5,
    fontFamily: typography.fontFamily.medium,
  },

  calendarCountBadge: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_GREEN,
    borderWidth: 1.5,
  },

  calendarCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: typography.fontFamily.bold,
  },

  calendarDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 6,
  },

  calendarDotsRowPlaceholder: {
    marginTop: 4,
    minHeight: 6,
  },

  calendarStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginHorizontal: 1.5,
  },

  calendarLegendWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2EF',
  },

  calendarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    marginBottom: 6,
  },

  calendarLegendDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },

  calendarLegendLabel: {
    fontSize: 10.5,
    fontFamily: typography.fontFamily.regular,
  },

  calendarSelectionHint: {
    marginTop: 8,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },

  // ========================================================
  // SUMMARY
  // ========================================================

  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.055,
    shadowRadius: 8,
    elevation: 2,
  },

  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summaryTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },

  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  summaryTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
  },

  summarySubtitle: {
    marginTop: 3,
    fontSize: 9.5,
    fontFamily: typography.fontFamily.regular,
  },

  totalBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  totalBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
  },

  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2EF',
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 17,
    marginBottom: 4,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },

  legendText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
  },

  // ========================================================
  // BOOKING CARD
  // ========================================================

  bookingItem: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 17,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.045,
    shadowRadius: 7,
    elevation: 2,
  },

  bookingTopLine: {
    height: 3,
    width: '100%',
  },

  bookingContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 11,
  },

  timeBox: {
    width: 58,
    minHeight: 62,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  timeText: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: typography.fontFamily.bold,
  },

  bookingMain: {
    flex: 1,
    minWidth: 0,
  },

  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  clientAvatarFrame: {
    width: 43,
    height: 43,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },

  clientPhoto: {
    width: '100%',
    height: '100%',
  },

  clientTextBox: {
    flex: 1,
    minWidth: 0,
  },

  clientName: {
    fontSize: 13.5,
    fontFamily: typography.fontFamily.semiBold,
  },

  clientEmail: {
    fontSize: 10.5,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },

  massageInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginTop: 5,
  },

  infoSeparator: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#AAB7AF',
    marginHorizontal: 6,
  },

  massageDuration: {
    flexShrink: 1,
    marginLeft: 4,
    fontSize: 10.5,
    fontFamily: typography.fontFamily.regular,
  },

  massageName: {
    fontSize: 11.5,
    marginTop: 3,
    fontFamily: typography.fontFamily.regular,
  },

  bookingMetaGrid: {
    marginTop: 9,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginTop: 4,
  },

  detailText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 5,
    fontSize: 10.5,
    fontFamily: typography.fontFamily.regular,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },

  priceText: {
    marginLeft: 5,
    fontSize: 11.5,
    fontFamily: typography.fontFamily.semiBold,
  },

  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 62,
    marginLeft: 8,
  },

  menuButtonBottom: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginTop: 5,
  },

  statusBadge: {
    maxWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 9,
  },

  statusText: {
    flexShrink: 1,
    marginLeft: 4,
    fontSize: 9.5,
    fontFamily: typography.fontFamily.medium,
  },

  menuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // ========================================================
  // EMPTY STATES
  // ========================================================

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 44,
  },

  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyStateTitle: {
    marginTop: 14,
    fontSize: 15,
    fontFamily: typography.fontFamily.semiBold,
  },

  emptyStateText: {
    maxWidth: 360,
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },

  emptyResetButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },

  emptyResetButtonText: {
    marginLeft: 6,
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  globalEmptyCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 34,
    paddingHorizontal: 22,
    marginTop: spacing.md,
  },

  globalEmptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  globalEmptyTitle: {
    fontSize: 16,
    marginTop: 14,
    fontFamily: typography.fontFamily.semiBold,
  },

  globalEmptyText: {
    maxWidth: 320,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
    fontFamily: typography.fontFamily.regular,
  },

  // ========================================================
  // TOAST
  // ========================================================

  toastOverlay: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 14 : 58,
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
  },

  toastCard: {
    width: '100%',
    maxWidth: 540,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 8,
  },

  toastText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: typography.fontFamily.medium,
  },

  // ========================================================
  // MODALS (menu 3 points + confirmation)
  // ========================================================

  menuModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,20,0.48)',
    justifyContent: 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    paddingHorizontal: 0,
    paddingTop: 20,
    paddingBottom: 0,
  },

  actionSheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148,163,184,0.55)',
    marginBottom: 17,
  },

  confirmationBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 20, 15, 0.58)',
  },

  confirmationCard: {
    width: '100%',
    maxWidth: 410,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  confirmationIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  confirmationTitle: {
    fontSize: 19,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
  },

  confirmationMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },

  confirmationBookingInfo: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginTop: 16,
  },

  confirmationClient: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  confirmationDetails: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
  },

  confirmationActions: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 20,
  },

  confirmationCancelButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  confirmationCancelText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  confirmationConfirmButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  confirmationConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  // ========================================================
  // BOOKING MENU
  // ========================================================

  actionSheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? '100%' : undefined,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: Platform.OS === 'web' ? 28 : 18,
    paddingTop: 10,
    alignSelf: Platform.OS === 'web' ? 'center' : 'stretch',
  },

  menuClientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  menuClientAvatar: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  menuClientInfo: {
    flex: 1,
    minWidth: 0,
  },

  actionSheetTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
  },

  actionSheetSubtitle: {
    marginTop: 3,
    fontSize: 11.5,
    fontFamily: typography.fontFamily.semiBold,
  },

  menuBookingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },

  menuSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  menuSummaryText: {
    marginLeft: 6,
    fontSize: 11.5,
    fontFamily: typography.fontFamily.medium,
  },

  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EF',
  },

  actionSheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  actionSheetRowText: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: typography.fontFamily.medium,
  },

  actionSheetCloseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 45,
    borderWidth: 1,
    borderRadius: 13,
    marginTop: 15,
  },

  actionSheetCloseText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },
});

export default CalendarScreen;