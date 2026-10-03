// src/screens/client/HistoryScreen.js

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '../../components/common/Header';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import bookingService from '../../services/bookingService';
import massageTypeService from '../../services/massageTypeService';
import therapistService from '../../services/therapistService';

import { typography } from '../../theme';
import {
  formatMadagascarDateFull,
  formatMadagascarDateTime,
  formatMadagascarTime,
  getMadagascarDateKey,
  getMadagascarTodayDate,
} from '../../utils/timeAgo';

// ============================================================
// PALETTE
// ============================================================

const COLORS = {
  primary: '#2E8B57',
  primaryDark: '#247447',
  primarySoft: '#EAF6EF',
  primaryTint: '#D6EEE0',

  white: '#FFFFFF',
  background: '#F4F7F5',
  card: '#FFFFFF',

  text: '#222B26',
  textSecondary: '#6B7A72',

  border: '#E4EAE6',

  red: '#D93636',
  redSoft: '#FDECEC',

  orange: '#E08E0B',
  orangeSoft: '#FDF3E2',
  price: '#E8590C',

  purple: '#7B61FF',
  purpleSoft: '#F1EDFE',

  blue: '#3B82F6',
  blueSoft: '#EFF6FF',
};

// ============================================================
// HELPERS
// ============================================================

const safeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const firstValidValue = (...values) => {
  for (const value of values) {
    const normalized = safeString(value);
    if (normalized) return normalized;
  }
  return '';
};

const getTherapistObject = (item) => {
  if (!item || typeof item !== 'object') return null;
  return (
    item.therapist ||
    item.therapist_user ||
    item.assigned_therapist ||
    item.assignedTherapist ||
    item.therapist_profile ||
    null
  );
};

const getTherapistName = (item, therapist) => {
  const firstName = firstValidValue(
    therapist?.first_name,
    therapist?.firstName,
    therapist?.prenom,
    item?.therapist_first_name,
    item?.therapistFirstName,
  );

  const lastName = firstValidValue(
    therapist?.last_name,
    therapist?.lastName,
    therapist?.nom,
    item?.therapist_last_name,
    item?.therapistLastName,
  );

  const composedName = `${firstName} ${lastName}`.trim();

  return firstValidValue(
    therapist?.full_name,
    therapist?.fullname,
    therapist?.fullName,
    therapist?.name,
    therapist?.display_name,
    therapist?.displayName,
    composedName,
    item?.therapist_name,
    item?.therapistName,
    item?.assigned_therapist_name,
    item?.assignedTherapistName,
  );
};

const getTherapistEmail = (item, therapist) =>
  firstValidValue(
    therapist?.email,
    therapist?.email_address,
    item?.therapist_email,
    item?.therapistEmail,
    item?.assigned_therapist_email,
    item?.assignedTherapistEmail,
  );

const getTherapistPhone = (item, therapist) =>
  firstValidValue(
    therapist?.phone,
    therapist?.phone_number,
    therapist?.telephone,
    therapist?.mobile,
    therapist?.mobile_phone,
    item?.therapist_phone,
    item?.therapistPhone,
    item?.therapist_phone_number,
    item?.assigned_therapist_phone,
    item?.assignedTherapistPhone,
  );

const getTherapistPhoto = (item, therapist) =>
  firstValidValue(
    therapist?.profile_image_url,
    therapist?.profileImageUrl,
    therapist?.avatar_url,
    therapist?.avatarUrl,
    therapist?.photo_url,
    therapist?.photoUrl,
    therapist?.image_url,
    therapist?.imageUrl,
    therapist?.avatar,
    therapist?.photo,
    item?.therapist_profile_image_url,
    item?.therapistProfileImageUrl,
    item?.therapist_avatar_url,
    item?.therapistAvatarUrl,
    item?.therapist_photo_url,
    item?.therapistPhotoUrl,
    item?.therapist_image_url,
    item?.therapistImageUrl,
  );

const getTherapistOnlineStatus = (item, therapist) => {
  const value =
    therapist?.is_online ??
    therapist?.isOnline ??
    therapist?.online ??
    therapist?.online_status ??
    therapist?.availability_status ??
    item?.therapist_is_online ??
    item?.therapistIsOnline ??
    item?.is_therapist_online ??
    item?.isTherapistOnline;

  if (typeof value === 'boolean') return value;

  const normalized = safeString(value).toLowerCase();

  return (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'online' ||
    normalized === 'en ligne' ||
    normalized === 'available' ||
    normalized === 'disponible'
  );
};

const getTherapistAssignedAt = (item, therapist) =>
  firstValidValue(
    item?.therapist_assigned_at,
    item?.therapistAssignedAt,
    item?.assigned_at,
    item?.assignedAt,
    therapist?.assigned_at,
    therapist?.assignedAt,
  );

const isPlaceholderTherapistName = (name) => {
  const normalized = safeString(name).toLowerCase();

  return (
    !normalized ||
    normalized === 'thérapeute' ||
    normalized === 'therapeute' ||
    normalized === 'thérapeute assigné' ||
    normalized === 'therapeute assigne' ||
    normalized === 'non assigné' ||
    normalized === 'non assigne'
  );
};

const normalizeTherapist = (item) => {
  const therapist = getTherapistObject(item);

  const id = firstValidValue(
    therapist?.id,
    therapist?.user_id,
    therapist?.userId,
    therapist?.therapist_id,
    item?.therapist_id,
    item?.therapistId,
    item?.assigned_therapist_id,
    item?.assignedTherapistId,
  );

  const name = getTherapistName(item, therapist);
  const email = getTherapistEmail(item, therapist);
  const phone = getTherapistPhone(item, therapist);
  const photo = getTherapistPhoto(item, therapist);
  const isOnline = getTherapistOnlineStatus(item, therapist);
  const assignedAt = getTherapistAssignedAt(item, therapist);

  const isPlaceholderName = isPlaceholderTherapistName(name);

  const isAssigned = Boolean(
    id ||
      therapist?.id ||
      therapist?.user_id ||
      email ||
      phone ||
      (name && !isPlaceholderName),
  );

  return {
    id,
    name: name || 'Thérapeute assigné',
    hasName: Boolean(name && !isPlaceholderName),
    email,
    phone,
    photo,
    isOnline,
    assignedAt,
    isAssigned,
  };
};

const extractTherapistNameFromProfile = (payload) => {
  if (!payload || typeof payload !== 'object') return '';

  const user =
    payload.user ||
    payload.user_profile ||
    payload.userProfile ||
    payload.profile ||
    payload;

  const firstName = firstValidValue(
    user?.first_name,
    user?.firstName,
    user?.prenom,
    payload?.first_name,
    payload?.firstName,
  );

  const lastName = firstValidValue(
    user?.last_name,
    user?.lastName,
    user?.nom,
    payload?.last_name,
    payload?.lastName,
  );

  const composedName = `${firstName} ${lastName}`.trim();

  return firstValidValue(
    user?.full_name,
    user?.fullname,
    user?.fullName,
    user?.name,
    user?.display_name,
    user?.displayName,
    payload?.full_name,
    payload?.fullname,
    payload?.fullName,
    payload?.name,
    payload?.display_name,
    payload?.displayName,
    composedName,
  );
};

const normalizeBooking = (item, index) => {
  const booking = item || {};

  const bookingId =
    booking.id ??
    booking.booking_id ??
    booking.bookingId ??
    `booking-${index}`;

  const address = firstValidValue(
    booking.address,
    booking.client_address,
    booking.clientAddress,
    booking.location,
    booking.service_address,
    booking.serviceAddress,
    booking.destination_address,
    booking.destinationAddress,
  );

  const scheduledDate = firstValidValue(
    booking.scheduled_date,
    booking.scheduledDate,
    booking.booking_date,
    booking.bookingDate,
    booking.date,
    booking.appointment_date,
    booking.appointmentDate,
    booking.scheduled_at,
    booking.scheduledAt,
  );

  const scheduledTime = firstValidValue(
    booking.scheduled_time,
    booking.scheduledTime,
    booking.booking_time,
    booking.bookingTime,
    booking.time,
    booking.appointment_time,
    booking.appointmentTime,
    booking.scheduled_at,
    booking.scheduledAt,
    // Le backend renvoie date + heure dans scheduled_date (UTC) :
    // en dernier recours on en extrait l'heure (heure de Madagascar).
    booking.scheduled_date,
    booking.scheduledDate,
  );

  const status = firstValidValue(
    booking.status,
    booking.booking_status,
    'pending',
  ).toLowerCase();

  const massageType =
    firstValidValue(
      booking.massage_type_name,
      booking.massageTypeName,
      booking.massage_type?.name,
      booking.massageType?.name,
      typeof booking.massageType === 'string' ? booking.massageType : '',
      typeof booking.massage_type === 'string' ? booking.massage_type : '',
      booking.service_name,
      booking.serviceName,
      booking.service?.name,
    ) || 'Massage';

  const duration =
    booking.duration_minutes ??
    booking.durationMinutes ??
    booking.scheduled_duration_minutes ??
    booking.scheduledDurationMinutes ??
    booking.duration ??
    booking.service_duration ??
    booking.serviceDuration ??
    null;

  const finalPrice =
    booking.final_price ?? booking.finalPrice ?? booking.agreed_price ?? null;

  const clientPrice =
    booking.client_price_proposed ??
    booking.proposed_price ??
    booking.client_price ??
    booking.price ??
    null;

  const displayPrice =
    finalPrice !== null && finalPrice !== undefined ? finalPrice : clientPrice;

  const imageUrl = firstValidValue(
    booking.massage_type_image,
    booking.massageTypeImage,
    booking.massage_type?.image_url,
    booking.massageType?.image_url,
    booking.service_image,
    booking.serviceImage,
    booking.service?.image_url,
    booking.image_url,
    booking.imageUrl,
  );

  const massageTypeId = firstValidValue(
    booking.massage_type_id,
    booking.massageTypeId,
    booking.massage_type?.id,
    booking.massageType?.id,
  );

  return {
    ...booking,
    id: bookingId,
    bookingId,
    address,
    scheduledDate,
    scheduledTime,
    status,
    massageType,
    massageTypeId,
    duration,
    displayPrice,
    imageUrl,
    therapist: normalizeTherapist(booking),
  };
};

// ============================================================
// FORMATS
// ============================================================

// Les dates du backend sont en UTC (sans "Z") : elles sont toujours
// converties en heure de Madagascar (UTC+3), quel que soit le fuseau
// de l'appareil. Les objets Date (choisis dans le calendrier) restent
// affichés en local.
const formatDate = (dateValue) => {
  if (!dateValue) return 'Date non définie';

  try {
    if (dateValue instanceof Date) {
      if (Number.isNaN(dateValue.getTime())) return String(dateValue);

      return dateValue.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }

    return formatMadagascarDateFull(dateValue) || String(dateValue);
  } catch {
    return String(dateValue);
  }
};

const formatTime = (timeValue) => {
  if (!timeValue) return 'Heure non définie';

  const value = String(timeValue).trim();

  // Datetime complet (UTC) -> heure de Madagascar
  if (value.includes('T') || value.includes(' ')) {
    const time = formatMadagascarTime(value);
    if (time) return time;
  }

  // Heure seule ("14:30:00") -> "14:30"
  return value.slice(0, 5);
};

const formatDateTime = (value) => {
  if (!value) return '';

  return formatMadagascarDateTime(value) || String(value);
};

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);
  if (Number.isNaN(number)) return `${value} Ar`;

  return `${number.toLocaleString('fr-FR')} Ar`;
};

const formatDuration = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);
  if (Number.isNaN(number)) return String(value);

  if (number >= 60) {
    const hours = Math.floor(number / 60);
    const minutes = number % 60;

    return minutes > 0
      ? `${hours}h ${String(minutes).padStart(2, '0')}`
      : `${hours}h 00`;
  }

  return `${number} min`;
};

// ============================================================
// VISUELS PAR TYPE DE MASSAGE (fallback miniature)
// ============================================================

const MASSAGE_TYPE_VISUALS = [
  { match: /relax/i, icon: 'leaf', color: COLORS.primary, backgroundColor: COLORS.primarySoft },
  { match: /th[ée]rap/i, icon: 'medkit', color: '#2563EB', backgroundColor: COLORS.blueSoft },
  { match: /sport/i, icon: 'barbell', color: '#EA580C', backgroundColor: '#FFEDD5' },
  { match: /pierre|stone/i, icon: 'flame', color: '#B45309', backgroundColor: '#FEF3C7' },
  { match: /femme enceinte|prénatal|prenatal/i, icon: 'flower', color: '#DB2777', backgroundColor: '#FCE7F3' },
];

const getMassageTypeVisual = (massageType) => {
  const found = MASSAGE_TYPE_VISUALS.find((entry) =>
    entry.match.test(massageType || ''),
  );

  return (
    found || {
      icon: 'sparkles',
      color: COLORS.primary,
      backgroundColor: COLORS.primarySoft,
    }
  );
};

// ============================================================
// STATUS CONFIG
// ============================================================

const CANCELLED_STYLE = {
  label: 'Annulée',
  color: COLORS.red,
  backgroundColor: COLORS.redSoft,
};

const NEGOTIATION_STYLE = {
  label: 'Négociation',
  color: '#5B3DE0',
  backgroundColor: COLORS.purpleSoft,
};

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: '#B26A00', backgroundColor: COLORS.orangeSoft },
  negotiation: NEGOTIATION_STYLE,
  negotiating: NEGOTIATION_STYLE,
  confirmed: { label: 'Confirmée', color: COLORS.primary, backgroundColor: COLORS.primarySoft },
  in_progress: { label: 'En cours', color: '#5B3DE0', backgroundColor: COLORS.purpleSoft },
  completed: { label: 'Terminée', color: COLORS.primary, backgroundColor: COLORS.primarySoft },
  cancelled: CANCELLED_STYLE,
  cancelled_by_client: CANCELLED_STYLE,
  cancelled_by_therapist: CANCELLED_STYLE,
};

const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || {
    label: status || 'Inconnu',
    color: COLORS.textSecondary,
    backgroundColor: '#F1F5F9',
  };

// ============================================================
// TOAST
// ============================================================

const TOAST_CONFIG = {
  success: { icon: 'checkmark-circle', color: COLORS.primary, background: COLORS.primarySoft },
  error: { icon: 'close-circle', color: COLORS.red, background: COLORS.redSoft },
  info: { icon: 'information-circle', color: '#4F46E5', background: '#E0E7FF' },
};

const Toast = ({ visible, type, message, onHide }) => {
  const translateY = useMemo(() => new Animated.Value(-80), []);

  useEffect(() => {
    if (!visible) return undefined;

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

  if (!visible) return null;

  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.toastOverlay, { transform: [{ translateY }] }]}
    >
      <View style={[styles.toastCard, { backgroundColor: config.background }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
        <Text numberOfLines={2} style={[styles.toastText, { color: config.color }]}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

// ============================================================
// CONFIRM MODAL
// ============================================================

const ConfirmModal = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  loading = false,
  themeColors,
  onCancel,
  onConfirm,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    statusBarTranslucent={Platform.OS === 'android'}
    onRequestClose={onCancel}
  >
    <Pressable
      style={styles.modalBackdrop}
      onPress={loading ? undefined : onCancel}
    >
      <Pressable
        style={[styles.confirmCard, { backgroundColor: themeColors.card }]}
        onPress={() => {}}
      >
        <View
          style={[
            styles.confirmIconWrap,
            { backgroundColor: destructive ? COLORS.redSoft : COLORS.primarySoft },
          ]}
        >
          <Ionicons
            name={destructive ? 'alert-circle' : 'help-circle'}
            size={26}
            color={destructive ? COLORS.red : COLORS.primary}
          />
        </View>

        <Text style={[styles.confirmTitle, { color: themeColors.text }]}>
          {title}
        </Text>

        <Text style={[styles.confirmMessage, { color: themeColors.textSecondary }]}>
          {message}
        </Text>

        <View style={styles.confirmActions}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={loading}
            onPress={onCancel}
            style={[
              styles.confirmButton,
              styles.confirmButtonGhost,
              { borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.confirmButtonGhostText, { color: themeColors.text }]}>
              {cancelLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={loading}
            onPress={onConfirm}
            style={[
              styles.confirmButton,
              { backgroundColor: destructive ? COLORS.red : COLORS.primary },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

// ============================================================
// BOOKING ACTION SHEET
// ============================================================

const BookingActionSheet = ({
  visible,
  booking,
  canCancel,
  themeColors,
  onClose,
  onViewDetails,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.actionSheet,
            {
              backgroundColor: themeColors.card,
              paddingBottom: 20 + (Platform.OS === 'android' ? insets.bottom : 0),
            },
          ]}
          onPress={() => {}}
        >
          <View style={styles.actionSheetHandle} />

          <Text numberOfLines={1} style={[styles.actionSheetTitle, { color: themeColors.text }]}>
            {booking?.massageType || 'Réservation'}
          </Text>

          <Text style={[styles.actionSheetSubtitle, { color: themeColors.textSecondary }]}>
            #{booking?.bookingId}
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onViewDetails}
            style={styles.actionSheetRow}
          >
            <View style={[styles.actionSheetIcon, { backgroundColor: COLORS.primarySoft }]}>
              <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={[styles.actionSheetRowText, { color: themeColors.text }]}>
              Voir les détails
            </Text>
          </TouchableOpacity>

          {canCancel && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onCancel}
              style={styles.actionSheetRow}
            >
              <View style={[styles.actionSheetIcon, { backgroundColor: COLORS.redSoft }]}>
                <Ionicons name="close-circle-outline" size={18} color={COLORS.red} />
              </View>
              <Text style={[styles.actionSheetRowText, { color: COLORS.red }]}>
                Annuler la réservation
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={styles.actionSheetCloseButton}
          >
            <Text style={[styles.actionSheetCloseText, { color: themeColors.textSecondary }]}>
              Fermer
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ============================================================
// CALENDAR FILTER MODAL
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

const CalendarFilterModal = ({
  visible,
  range,
  bookingDateSet,
  themeColors,
  onClose,
  onSelectDate,
  onReset,
  onApply,
}) => {
  const insets = useSafeAreaInsets();

  const [viewDate, setViewDate] = useState(
    () => range?.start || getMadagascarTodayDate()
  );

  useEffect(() => {
    if (visible) {
      setViewDate(range?.start || getMadagascarTodayDate());
    }
  }, [visible, range?.start]);

  const cells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const goPrevMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goNextMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  // "Aujourd'hui" = le jour actuel à Madagascar (et non celui de l'appareil)
  const todayKey = toDateKey(getMadagascarTodayDate());
  const startKey = range?.start ? toDateKey(range.start) : null;
  const endKey = range?.end ? toDateKey(range.end) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.calendarSheet,
            Platform.OS === 'web' && styles.calendarSheetWeb,
            {
              backgroundColor: themeColors.card,
              paddingBottom: 20 + (Platform.OS === 'android' ? insets.bottom : 0),
            },
          ]}
          onPress={() => {}}
        >
          <View style={styles.actionSheetHandle} />

          <Text style={[styles.calendarModalTitle, { color: themeColors.text }]}>
            Filtrer par période
          </Text>

          <View style={styles.rangeFieldsRow}>
            <View
              style={[
                styles.rangeField,
                {
                  borderColor: !endKey ? COLORS.primary : themeColors.border,
                  backgroundColor: !endKey ? COLORS.primarySoft : 'transparent',
                },
              ]}
            >
              <Text style={[styles.rangeFieldLabel, { color: themeColors.textSecondary }]}>
                Du
              </Text>
              <Text numberOfLines={1} style={[styles.rangeFieldValue, { color: themeColors.text }]}>
                {range?.start ? formatDate(range.start) : 'Choisir'}
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
                  borderColor: !!range?.start && !endKey ? COLORS.primary : themeColors.border,
                  backgroundColor: !!range?.start && !endKey ? COLORS.primarySoft : 'transparent',
                },
              ]}
            >
              <Text style={[styles.rangeFieldLabel, { color: themeColors.textSecondary }]}>
                Au
              </Text>
              <Text numberOfLines={1} style={[styles.rangeFieldValue, { color: themeColors.text }]}>
                {range?.end ? formatDate(range.end) : 'Choisir'}
              </Text>
            </View>
          </View>

          <View style={styles.calendarHeaderRow}>
            <TouchableOpacity
              onPress={goPrevMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={20} color={themeColors.text} />
            </TouchableOpacity>

            <Text style={[styles.calendarHeaderTitle, { color: themeColors.text }]}>
              {MONTH_LABELS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </Text>

            <TouchableOpacity
              onPress={goNextMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={20} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.calendarWeekRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text
                key={`${label}-${index}`}
                style={[styles.calendarWeekLabel, { color: themeColors.textSecondary }]}
              >
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {cells.map((cellDate, index) => {
              if (!cellDate) {
                return <View key={`empty-${index}`} style={styles.calendarCell} />;
              }

              const key = toDateKey(cellDate);
              const isStart = key === startKey;
              const isEnd = key === endKey;
              const isEdge = isStart || isEnd;
              const isInRange = !!startKey && !!endKey && key > startKey && key < endKey;
              const isToday = key === todayKey;
              const hasBooking = bookingDateSet?.has(key);

              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.calendarCell,
                    isInRange && { backgroundColor: COLORS.primarySoft },
                    isStart &&
                      !!endKey && {
                        backgroundColor: COLORS.primarySoft,
                        borderTopLeftRadius: 16,
                        borderBottomLeftRadius: 16,
                      },
                    isEnd &&
                      !!startKey && {
                        backgroundColor: COLORS.primarySoft,
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
                      isEdge && { backgroundColor: COLORS.primary },
                      !isEdge &&
                        isToday && { borderWidth: 1.5, borderColor: COLORS.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        { color: isEdge ? COLORS.white : themeColors.text },
                      ]}
                    >
                      {cellDate.getDate()}
                    </Text>
                  </View>

                  {hasBooking && !isEdge && (
                    <View style={[styles.calendarDayDot, { backgroundColor: COLORS.primary }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.calendarHint, { color: themeColors.textSecondary }]}>
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
              <Text style={[styles.confirmButtonGhostText, { color: themeColors.text }]}>
                Réinitialiser
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!range?.start}
              onPress={onApply}
              style={[
                styles.confirmButton,
                { backgroundColor: range?.start ? COLORS.primary : themeColors.border },
              ]}
            >
              <Text style={styles.confirmButtonText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ============================================================
// FILTER BUTTON
// ============================================================

const FilterButton = ({ label, value, activeFilter, onPress, themeColors }) => {
  const isActive = activeFilter === value;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.filterButton,
        {
          backgroundColor: isActive ? COLORS.primary : themeColors.card,
          borderColor: isActive ? COLORS.primary : themeColors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.filterButtonText,
          { color: isActive ? COLORS.white : themeColors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ============================================================
// BOOKING CARD (structure "annonce" : photo | infos | tags)
// ============================================================

const Tag = ({ label, themeColors }) => (
  <View style={[styles.tag, { backgroundColor: themeColors.tagBackground || '#F1F5F3' }]}>
    <Text numberOfLines={1} style={[styles.tagText, { color: themeColors.textSecondary }]}>
      {label}
    </Text>
  </View>
);

const BookingCard = ({ booking, themeColors, onPress, onMenuPress }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const statusConfig = getStatusConfig(booking.status);
  const typeVisual = getMassageTypeVisual(booking.massageType);
  const formattedPrice = formatPrice(booking.displayPrice);
  const formattedDuration = formatDuration(booking.duration);

  const therapist = booking.therapist;
  const showTherapist = !!therapist?.isAssigned;
  const therapistInitial = (therapist?.name || 'T').trim().charAt(0).toUpperCase();
  const assignedAtLabel = formatDateTime(therapist?.assignedAt);

  // Date + heure PRÉVUES du massage (heure de Madagascar)
  const scheduledLabel = booking.scheduledDate
    ? `Prévu le ${formatDate(booking.scheduledDate)}${
        booking.scheduledTime ? ` à ${formatTime(booking.scheduledTime)}` : ''
      }`
    : booking.scheduledTime
      ? `Prévu à ${formatTime(booking.scheduledTime)}`
      : null;

  const tags = [
    scheduledLabel,
    formattedDuration,
    // Date + heure d'assignation du thérapeute (heure de Madagascar)
    assignedAtLabel ? `Assigné le ${assignedAtLabel}` : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(booking)}
      style={[
        styles.bookingCard,
        { backgroundColor: themeColors.card, borderColor: themeColors.border },
      ]}
    >
      <View style={styles.cardTopRow}>
        {/* PHOTO */}
        <View
          style={[
            styles.thumbnailWrapper,
            isWide && styles.thumbnailWrapperWide,
            { backgroundColor: typeVisual.backgroundColor },
          ]}
        >
          {booking.imageUrl ? (
            <Image
              source={{ uri: booking.imageUrl }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name={typeVisual.icon} size={30} color={typeVisual.color} />
          )}
        </View>

        {/* INFOS */}
        <View style={styles.cardInfoColumn}>
          <View style={styles.titleRow}>
            <Text
              numberOfLines={2}
              style={[
                styles.cardMainTitle,
                isWide && styles.cardMainTitleWide,
                { color: themeColors.text },
              ]}
            >
              {booking.massageType}
            </Text>

            <View style={[styles.statusPill, { backgroundColor: statusConfig.backgroundColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text numberOfLines={1} style={[styles.statusPillText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={13} color={themeColors.textSecondary} />
            <Text
              numberOfLines={1}
              style={[styles.addressText, { color: themeColors.textSecondary }]}
            >
              {booking.address || 'Adresse non définie'}
            </Text>
          </View>

          {showTherapist && (
            <View style={styles.therapistRow}>
              <View style={styles.therapistAvatar}>
                <Text style={styles.therapistAvatarText}>{therapistInitial}</Text>
              </View>
              <Text
                numberOfLines={1}
                style={[styles.therapistName, { color: themeColors.text }]}
              >
                {therapist.name}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>Thérapeute</Text>
              </View>
            </View>
          )}

          <View style={styles.priceRow}>
            <View style={styles.priceBox}>
              <Text numberOfLines={1} style={styles.priceText}>
                {formattedPrice || 'Prix à définir'}
              </Text>
              {!!formattedPrice && (
                <Text style={[styles.priceUnit, { color: themeColors.textSecondary }]}>
                  /séance
                </Text>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onMenuPress?.(booking)}
              style={styles.menuButton}
            >
              <Ionicons name="ellipsis-vertical" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* TAGS */}
      {tags.length > 0 && (
        <View style={styles.tagsWrap}>
          {tags.map((label, index) => (
            <Tag key={`${label}-${index}`} label={label} themeColors={themeColors} />
          ))}
        </View>
      )}

    </TouchableOpacity>
  );
};

// ============================================================
// EMPTY STATE
// ============================================================

const EmptyState = ({ activeFilter, onCreateBooking, themeColors }) => {
  const isFiltered = activeFilter !== 'all';

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: COLORS.primarySoft }]}>
        <Ionicons
          name={isFiltered ? 'filter-outline' : 'calendar-outline'}
          size={40}
          color={COLORS.primary}
        />
      </View>

      <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
        {isFiltered ? 'Aucune réservation trouvée' : 'Aucune réservation'}
      </Text>

      <Text style={[styles.emptyDescription, { color: themeColors.textSecondary }]}>
        {isFiltered
          ? 'Aucune réservation ne correspond à ce filtre.'
          : 'Vous n’avez pas encore effectué de demande de massage.'}
      </Text>

      {!isFiltered && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCreateBooking}
          style={[styles.emptyActionButton, { backgroundColor: COLORS.primary }]}
        >
          <Ionicons name="add" size={19} color={COLORS.white} />
          <Text style={styles.emptyActionButtonText}>Faire une demande</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================
// MAIN SCREEN
// ============================================================

const HistoryScreen = ({ navigation }) => {
  const { user: _user } = useAuth();
  const { colors: themeColors } = useTheme();

  const therapistNameCacheRef = useRef(new Map());

  const [bookings, setBookings] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [draftRange, setDraftRange] = useState({ start: null, end: null });
  const [appliedRange, setAppliedRange] = useState({ start: null, end: null });

  const [massageTypesById, setMassageTypesById] = useState({});
  const [massageTypesByName, setMassageTypesByName] = useState({});

  // ---------- TYPES DE MASSAGE ----------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const types = await massageTypeService.getActiveMassageTypes();
        if (cancelled) return;

        const byId = {};
        const byName = {};

        (types || []).forEach((type) => {
          if (type?.id !== undefined && type?.id !== null) {
            byId[String(type.id)] = type;
          }
          if (type?.name) {
            byName[String(type.name).trim().toLowerCase()] = type;
          }
        });

        setMassageTypesById(byId);
        setMassageTypesByName(byName);
      } catch (typesError) {
        console.log('Erreur chargement types de massage:', typesError?.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const resolveBookingImage = useCallback(
    (booking) => {
      if (booking.imageUrl) return booking.imageUrl;

      const matchById =
        booking.massageTypeId !== undefined &&
        booking.massageTypeId !== null &&
        booking.massageTypeId !== ''
          ? massageTypesById[String(booking.massageTypeId)]
          : null;

      const matchByName = booking.massageType
        ? massageTypesByName[String(booking.massageType).trim().toLowerCase()]
        : null;

      const match = matchById || matchByName;
      const rawPath = match?.image_url || match?.icon_url;

      if (!rawPath) return null;

      return massageTypeService.getMassageImageUrl(rawPath);
    },
    [massageTypesById, massageTypesByName],
  );

  // ---------- ENRICHISSEMENT THÉRAPEUTE ----------

  const enrichTherapistNames = useCallback(async (bookingList) => {
    const idsToFetch = [];
    const seen = new Set();

    bookingList.forEach((booking) => {
      const therapist = booking.therapist;

      if (
        therapist?.isAssigned &&
        therapist?.id &&
        !therapist?.hasName &&
        !therapistNameCacheRef.current.has(therapist.id) &&
        !seen.has(therapist.id)
      ) {
        seen.add(therapist.id);
        idsToFetch.push(therapist.id);
      }
    });

    if (idsToFetch.length === 0) return bookingList;

    await Promise.all(
      idsToFetch.map(async (therapistId) => {
        try {
          const result = await therapistService.getTherapist(therapistId);

          if (result?.success) {
            const resolvedName = extractTherapistNameFromProfile(result.data);
            if (resolvedName) {
              therapistNameCacheRef.current.set(therapistId, resolvedName);
            }
          }
        } catch (fetchError) {
          console.error('Erreur chargement nom thérapeute:', fetchError);
        }
      }),
    );

    if (therapistNameCacheRef.current.size === 0) return bookingList;

    let hasChanges = false;

    const enrichedList = bookingList.map((booking) => {
      const therapist = booking.therapist;
      const cachedName = therapist?.id
        ? therapistNameCacheRef.current.get(therapist.id)
        : null;

      if (therapist?.isAssigned && !therapist?.hasName && cachedName) {
        hasChanges = true;
        return {
          ...booking,
          therapist: { ...therapist, name: cachedName, hasName: true },
        };
      }

      return booking;
    });

    return hasChanges ? enrichedList : bookingList;
  }, []);

  // ---------- LOAD BOOKINGS ----------

  const loadBookings = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);
        setError('');

        const response = await bookingService.getBookings();
        const responseData = response?.data ?? response ?? [];

        let bookingList = [];

        if (Array.isArray(responseData)) {
          bookingList = responseData;
        } else if (Array.isArray(responseData.items)) {
          bookingList = responseData.items;
        } else if (Array.isArray(responseData.bookings)) {
          bookingList = responseData.bookings;
        } else if (Array.isArray(responseData.data)) {
          bookingList = responseData.data;
        }

        const normalizedBookings = bookingList.map(normalizeBooking);
        setBookings(normalizedBookings);

        const enrichedBookings = await enrichTherapistNames(normalizedBookings);
        if (enrichedBookings !== normalizedBookings) {
          setBookings(enrichedBookings);
        }
      } catch (requestError) {
        console.error('Erreur chargement réservations:', requestError);
        setError('Impossible de charger vos réservations.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enrichTherapistNames],
  );

  useFocusEffect(
    useCallback(() => {
      loadBookings(true);
    }, [loadBookings]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBookings(false);
  }, [loadBookings]);

  // ---------- FILTRES ----------

  const bookingDateSet = useMemo(() => {
    const set = new Set();

    bookings.forEach((booking) => {
      if (!booking.scheduledDate) return;
      // Jour selon l'heure de Madagascar
      const key = getMadagascarDateKey(booking.scheduledDate);
      if (key) {
        set.add(key);
      }
    });

    return set;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    let result = bookings;

    if (activeFilter !== 'all') {
      result = result.filter((booking) => {
        if (activeFilter === 'cancelled') {
          return (
            booking.status === 'cancelled' ||
            booking.status === 'cancelled_by_client' ||
            booking.status === 'cancelled_by_therapist'
          );
        }

        if (activeFilter === 'negotiation') {
          return booking.status === 'negotiation' || booking.status === 'negotiating';
        }

        return booking.status === activeFilter;
      });
    }

    if (appliedRange.start) {
      const startKey = toDateKey(appliedRange.start);
      const endKey = appliedRange.end ? toDateKey(appliedRange.end) : startKey;

      const [lowKey, highKey] =
        startKey <= endKey ? [startKey, endKey] : [endKey, startKey];

      result = result.filter((booking) => {
        if (!booking.scheduledDate) return false;

        // Jour selon l'heure de Madagascar
        const key = getMadagascarDateKey(booking.scheduledDate);
        if (!key) return false;

        return key >= lowKey && key <= highKey;
      });
    }

    return result;
  }, [bookings, activeFilter, appliedRange]);

  // ---------- CALENDAR HANDLERS ----------

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

  // ---------- ACTIONS ----------

  const handleBookingPress = useCallback(
    (booking) => {
      navigation.navigate('BookingDetail', {
        bookingId: booking.bookingId,
        booking,
      });
    },
    [navigation],
  );

  const handleCreateBooking = useCallback(() => {
    navigation.navigate('CreateBooking');
  }, [navigation]);

  // ---------- TOAST ----------

  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ visible: true, type, message });
  }, []);

  const hideToast = useCallback(() => {
    setToast((previous) => ({ ...previous, visible: false }));
  }, []);

  // ---------- MENU / CANCEL ----------

  const [menuTarget, setMenuTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleMenuPress = useCallback((booking) => {
    setMenuTarget(booking);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuTarget(null);
  }, []);

  const handleViewDetailsFromMenu = useCallback(() => {
    if (menuTarget) handleBookingPress(menuTarget);
    setMenuTarget(null);
  }, [menuTarget, handleBookingPress]);

  const requestCancelBooking = useCallback(() => {
    setCancelTarget(menuTarget);
    setMenuTarget(null);
  }, [menuTarget]);

  const closeCancelModal = useCallback(() => {
    if (isCancelling) return;
    setCancelTarget(null);
  }, [isCancelling]);

  const performCancelBooking = useCallback(async () => {
    if (!cancelTarget || isCancelling) return;

    setIsCancelling(true);

    try {
      const result = await bookingService.cancelBooking(
        cancelTarget.bookingId,
        'Annulé par le client',
      );

      if (!result?.success) {
        throw new Error(result?.error || "Impossible d'annuler la réservation.");
      }

      setCancelTarget(null);
      showToast('Réservation annulée avec succès.', 'success');
      loadBookings(false);
    } catch (cancelError) {
      console.error('Erreur annulation réservation:', cancelError);
      showToast(cancelError?.message || "Impossible d'annuler la réservation.", 'error');
    } finally {
      setIsCancelling(false);
    }
  }, [cancelTarget, isCancelling, loadBookings, showToast]);

  const menuCanCancel = Boolean(
    menuTarget &&
      (menuTarget.status === 'pending' ||
        menuTarget.status === 'negotiation' ||
        menuTarget.status === 'negotiating'),
  );

  const renderBooking = useCallback(
    ({ item }) => {
      const resolvedImageUrl = resolveBookingImage(item);

      const bookingWithImage =
        resolvedImageUrl === item.imageUrl
          ? item
          : { ...item, imageUrl: resolvedImageUrl };

      return (
        <BookingCard
          booking={bookingWithImage}
          themeColors={themeColors}
          onPress={handleBookingPress}
          onMenuPress={handleMenuPress}
        />
      );
    },
    [themeColors, handleBookingPress, handleMenuPress, resolveBookingImage],
  );

  const keyExtractor = useCallback(
    (item, index) => String(item.bookingId || index),
    [],
  );

  const filterOptions = [
    { label: 'Toutes', value: 'all' },
    { label: 'En attente', value: 'pending' },
    { label: 'Négociation', value: 'negotiation' },
    { label: 'Confirmées', value: 'confirmed' },
    { label: 'En cours', value: 'in_progress' },
    { label: 'Terminées', value: 'completed' },
    { label: 'Annulées', value: 'cancelled' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Mes réservations" showBack />

      <View style={styles.content}>
        {/* PAGE HEADER COMPACT */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>
            Historique
            <Text style={[styles.pageCount, { color: themeColors.textSecondary }]}>
              {`  ${filteredBookings.length}`}
            </Text>
          </Text>

          <View style={styles.pageHeaderActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openCalendarModal}
              style={[
                styles.headerCalendarButton,
                { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primaryTint },
                !!appliedRange.start && styles.headerCalendarButtonActive,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Filtrer par période"
            >
              <Ionicons
                name="calendar-outline"
                size={17}
                color={appliedRange.start ? COLORS.white : COLORS.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleCreateBooking}
              style={[styles.newBookingButton, { backgroundColor: COLORS.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Nouvelle réservation"
            >
              <Ionicons name="add" size={19} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* FILTERS */}
        <View style={styles.filtersWrapper}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filterOptions}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.filtersContent}
            renderItem={({ item }) => (
              <FilterButton
                label={item.label}
                value={item.value}
                activeFilter={activeFilter}
                onPress={() => setActiveFilter(item.value)}
                themeColors={themeColors}
              />
            )}
          />
        </View>

        {!!appliedRange.start && (
          <View style={styles.dateFilterChipRow}>
            <View
              style={[
                styles.dateFilterChip,
                { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
              ]}
            >
              <Text style={[styles.dateFilterChipText, { color: COLORS.primary }]}>
                {appliedRange.end &&
                toDateKey(appliedRange.end) !== toDateKey(appliedRange.start)
                  ? `${formatDate(appliedRange.start)} – ${formatDate(appliedRange.end)}`
                  : formatDate(appliedRange.start)}
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={clearAppliedRange}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close-circle" size={15} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CONTENT */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Chargement de vos réservations...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline-outline" size={42} color={COLORS.red} />

            <Text style={[styles.errorTitle, { color: themeColors.text }]}>
              Une erreur est survenue
            </Text>

            <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
              {error}
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => loadBookings(true)}
              style={[styles.retryButton, { backgroundColor: COLORS.primary }]}
            >
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredBookings}
            keyExtractor={keyExtractor}
            renderItem={renderBooking}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              filteredBookings.length === 0 && styles.emptyListContent,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                activeFilter={activeFilter}
                onCreateBooking={handleCreateBooking}
                themeColors={themeColors}
              />
            }
          />
        )}
      </View>

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={hideToast}
      />

      <BookingActionSheet
        visible={!!menuTarget}
        booking={menuTarget}
        canCancel={menuCanCancel}
        themeColors={themeColors}
        onClose={closeMenu}
        onViewDetails={handleViewDetailsFromMenu}
        onCancel={requestCancelBooking}
      />

      <ConfirmModal
        visible={!!cancelTarget}
        title="Annuler la réservation"
        message="Voulez-vous vraiment annuler cette réservation ?"
        confirmLabel="Oui, annuler"
        cancelLabel="Non"
        destructive
        loading={isCancelling}
        themeColors={themeColors}
        onCancel={closeCancelModal}
        onConfirm={performCancelBooking}
      />

      <CalendarFilterModal
        visible={calendarVisible}
        range={draftRange}
        bookingDateSet={bookingDateSet}
        themeColors={themeColors}
        onClose={closeCalendarModal}
        onSelectDate={handleSelectCalendarDate}
        onReset={handleResetCalendarDate}
        onApply={handleApplyCalendarDate}
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

  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: Platform.OS === 'web' ? 20 : 12,
  },

  // ---------- PAGE HEADER (compact) ----------

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 8,
  },

  pageTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: typography.fontFamily.bold,
  },

  pageCount: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },

  pageHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  newBookingButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCalendarButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  headerCalendarButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  dateFilterChipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  dateFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },

  dateFilterChipText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },

  filtersWrapper: {
    marginBottom: 10,
  },

  filtersContent: {
    paddingRight: 10,
    gap: 6,
  },

  filterButton: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterButtonText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
  },

  listContent: {
    paddingTop: 2,
    paddingBottom: 28,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  // ---------- BOOKING CARD ----------

  bookingCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: Platform.OS === 'web' ? 14 : 10,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },

  thumbnailWrapper: {
    width: 78,
    height: 104,
    alignSelf: 'flex-start',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  thumbnailWrapperWide: {
    width: 96,
    height: 128,
    alignSelf: 'flex-start',
    borderRadius: 14,
  },

  thumbnailImage: {
    width: '100%',
    height: '100%',
  },

  cardInfoColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },

  cardMainTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: typography.fontFamily.bold,
  },

  cardMainTitleWide: {
    fontSize: 16,
    lineHeight: 21,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    flexShrink: 0,
  },

  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  statusPillText: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: typography.fontFamily.bold,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },

  addressText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: typography.fontFamily.regular,
  },

  therapistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },

  therapistAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5B6470',
    alignItems: 'center',
    justifyContent: 'center',
  },

  therapistAvatarText: {
    color: COLORS.white,
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
  },

  therapistName: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
  },

  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.purpleSoft,
  },

  roleBadgeText: {
    fontSize: 9.5,
    color: '#5B3DE0',
    fontFamily: typography.fontFamily.bold,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  priceBox: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },

  priceText: {
    fontSize: 16,
    lineHeight: 20,
    color: COLORS.price,
    fontFamily: typography.fontFamily.bold,
  },

  priceUnit: {
    fontSize: 10.5,
    fontFamily: typography.fontFamily.regular,
  },

  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },

  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },

  tagText: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: typography.fontFamily.medium,
  },

  // ---------- EMPTY / LOADING / ERROR ----------

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 50,
  },

  emptyIconContainer: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  emptyTitle: {
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 23,
    fontFamily: typography.fontFamily.bold,
  },

  emptyDescription: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    fontFamily: typography.fontFamily.regular,
  },

  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 13,
  },

  emptyActionButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
  },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingBottom: 80,
  },

  errorTitle: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 23,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
  },

  errorText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },

  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 13,
  },

  retryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  // ---------- TOAST ----------

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

  // ---------- MODALS ----------

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,20,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  confirmCard: {
    alignSelf: 'center',
    width: '88%',
    maxWidth: 380,
    marginBottom: 'auto',
    marginTop: 'auto',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },

  confirmIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  confirmTitle: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
  },

  confirmMessage: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },

  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
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
    color: COLORS.white,
    fontSize: 13.5,
    fontFamily: typography.fontFamily.bold,
  },

  actionSheet: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
  },

  actionSheetTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
  },

  actionSheetSubtitle: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 11.5,
    fontFamily: typography.fontFamily.regular,
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

  actionSheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148,163,184,0.5)',
    marginBottom: 14,
  },

  // ---------- CALENDAR ----------

  calendarSheet: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
  },

  calendarSheetWeb: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 18,
  },

  calendarModalTitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    fontFamily: typography.fontFamily.bold,
  },

  rangeFieldsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    width: '100%',
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
    width: '100%',
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
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },

  calendarCell: {
    flex: 1,
    minWidth: `${100 / 7}%`,
    height: 48,
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

export default HistoryScreen;