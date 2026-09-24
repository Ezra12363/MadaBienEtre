// src/screens/client/HistoryScreen.js

import {
  useCallback,
  useEffect,
  useMemo,
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
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '../../components/common/Header';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import bookingService from '../../services/bookingService';
import massageTypeService from '../../services/massageTypeService';

import {
  typography,
} from '../../theme';

// ============================================================
// HELPERS
// ============================================================

const safeString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
};

const firstValidValue = (...values) => {
  for (const value of values) {
    const normalized = safeString(value);

    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const getTherapistObject = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

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

const getTherapistEmail = (item, therapist) => {
  return firstValidValue(
    therapist?.email,
    therapist?.email_address,
    item?.therapist_email,
    item?.therapistEmail,
    item?.assigned_therapist_email,
    item?.assignedTherapistEmail,
  );
};

const getTherapistPhone = (item, therapist) => {
  return firstValidValue(
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
};

const getTherapistPhoto = (item, therapist) => {
  return firstValidValue(
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
};

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

  if (typeof value === 'boolean') {
    return value;
  }

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

const getTherapistAssignedAt = (item, therapist) => {
  return firstValidValue(
    item?.therapist_assigned_at,
    item?.therapistAssignedAt,
    item?.assigned_at,
    item?.assignedAt,
    therapist?.assigned_at,
    therapist?.assignedAt,
  );
};

const normalizeTherapist = (item) => {
  const therapist = getTherapistObject(item);

  const id = firstValidValue(
    therapist?.id,
    therapist?.user_id,
    therapist?.userId,
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

  /*
   * Important :
   * Tsy atao hoe isAssigned = Boolean(name) fotsiny,
   * satria mety hiverina amin'ny backend ny texte "Thérapeute"
   * na dia mbola tsy misy thérapeute aza.
   */
  const normalizedName = name.toLowerCase();

  const isPlaceholderName =
    normalizedName === 'thérapeute' ||
    normalizedName === 'therapeute' ||
    normalizedName === 'thérapeute assigné' ||
    normalizedName === 'therapeute assigne' ||
    normalizedName === 'non assigné' ||
    normalizedName === 'non assigne';

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
    email,
    phone,
    photo,
    isOnline,
    assignedAt,
    isAssigned,
  };
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
  );

  const status = firstValidValue(
    booking.status,
    booking.booking_status,
    'pending',
  ).toLowerCase();

  const massageType = firstValidValue(
    booking.massage_type_name,
    booking.massageTypeName,
    booking.massage_type?.name,
    booking.massageType?.name,
    typeof booking.massageType === 'string'
      ? booking.massageType
      : '',
    typeof booking.massage_type === 'string'
      ? booking.massage_type
      : '',
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
    booking.final_price ??
    booking.finalPrice ??
    booking.agreed_price ??
    null;

  const clientPrice =
    booking.client_price_proposed ??
    booking.proposed_price ??
    booking.client_price ??
    booking.price ??
    null;

  const displayPrice =
    finalPrice !== null && finalPrice !== undefined
      ? finalPrice
      : clientPrice;

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
// FORMAT DATE ET HEURE
// ============================================================

const formatDate = (dateValue) => {
  if (!dateValue) {
    return 'Date non définie';
  }

  try {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateValue);
  }
};

const formatTime = (timeValue) => {
  if (!timeValue) {
    return 'Heure non définie';
  }

  const value = String(timeValue).trim();

  /*
   * Raha datetime ISO no tonga dia ampiasaina,
   * ohatra: 2026-09-10T14:30:00
   */
  if (
    value.includes('T') ||
    value.includes(' ')
  ) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  return value.slice(0, 5);
};

// ============================================================
// FORMAT DATE + HEURE (assignation thérapeute)
// ============================================================

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const datePart = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timePart = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${datePart} à ${timePart}`;
};

// ============================================================
// FORMAT PRIX
// ============================================================

const formatPrice = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return `${value} Ar`;
  }

  return `${number.toLocaleString('fr-FR')} Ar`;
};

// ============================================================
// FORMAT DURÉE
// ============================================================

const formatDuration = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

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
// APPARENCE PAR TYPE DE MASSAGE
//
// Utilisée pour la vignette et l'accent de couleur de chaque
// carte lorsque aucune photo n'est fournie par le backend.
// ============================================================

const MASSAGE_TYPE_VISUALS = [
  {
    match: /relax/i,
    icon: 'leaf',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  {
    match: /th[ée]rap/i,
    icon: 'medkit',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  {
    match: /sport/i,
    icon: 'barbell',
    color: '#EA580C',
    backgroundColor: '#FFEDD5',
  },
  {
    match: /pierre|stone/i,
    icon: 'flame',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
  },
  {
    match: /femme enceinte|prénatal|prenatal/i,
    icon: 'flower',
    color: '#DB2777',
    backgroundColor: '#FCE7F3',
  },
];

const getMassageTypeVisual = (massageType) => {
  const found = MASSAGE_TYPE_VISUALS.find((entry) =>
    entry.match.test(massageType || ''),
  );

  return (
    found || {
      icon: 'sparkles',
      color: '#16A34A',
      backgroundColor: '#DCFCE7',
    }
  );
};

// ============================================================
// STATUS
// ============================================================

const STATUS_CONFIG = {
  pending: {
    label: 'En attente',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    icon: 'time-outline',
  },

  negotiation: {
    label: 'Négociation',
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    icon: 'chatbubbles-outline',
  },

  negotiating: {
    label: 'Négociation',
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    icon: 'chatbubbles-outline',
  },

  confirmed: {
    label: 'Confirmée',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    icon: 'checkmark-circle-outline',
  },

  in_progress: {
    label: 'En cours',
    color: '#0891B2',
    backgroundColor: '#CFFAFE',
    icon: 'walk-outline',
  },

  completed: {
    label: 'Terminée',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    icon: 'checkmark-done-circle-outline',
  },

  cancelled: {
    label: 'Annulée',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    icon: 'close-circle-outline',
  },

  cancelled_by_client: {
    label: 'Annulée',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    icon: 'close-circle-outline',
  },

  cancelled_by_therapist: {
    label: 'Annulée',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    icon: 'close-circle-outline',
  },
};

const getStatusConfig = (status) => {
  return (
    STATUS_CONFIG[status] || {
      label: status || 'Inconnu',
      color: '#64748B',
      backgroundColor: '#F1F5F9',
      icon: 'help-circle-outline',
    }
  );
};

// ============================================================
// TOAST (remplace Alert.alert pour les notifications :
// fonctionne de façon identique sur mobile ET sur web)
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
// CONFIRM MODAL (remplace les Alert.alert à boutons multiples,
// qui ne déclenchent pas leurs callbacks sur react-native-web)
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
}) => {
  return (
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
          style={[
            styles.confirmCard,
            { backgroundColor: themeColors.card },
          ]}
          onPress={() => {}}
        >
          <View
            style={[
              styles.confirmIconWrap,
              {
                backgroundColor: destructive
                  ? '#FEE2E2'
                  : `${themeColors.primary}18`,
              },
            ]}
          >
            <Ionicons
              name={
                destructive
                  ? 'alert-circle'
                  : 'help-circle'
              }
              size={26}
              color={
                destructive ? '#DC2626' : themeColors.primary
              }
            />
          </View>

          <Text
            style={[
              styles.confirmTitle,
              { color: themeColors.text },
            ]}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.confirmMessage,
              { color: themeColors.textSecondary },
            ]}
          >
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
              <Text
                style={[
                  styles.confirmButtonGhostText,
                  { color: themeColors.text },
                ]}
              >
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              onPress={onConfirm}
              style={[
                styles.confirmButton,
                {
                  backgroundColor: destructive
                    ? '#DC2626'
                    : themeColors.primary,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ============================================================
// ACTION SHEET (menu ⋮ d'une réservation — remplace le
// Alert.alert à options multiples)
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
  // ⚠️ Android : la hauteur de la barre de navigation
  // gestuelle varie selon les téléphones. On l'ajoute au
  // padding bas du sheet pour que "Fermer" ne soit jamais
  // masqué ou coupé par cette barre.
  const insets = useSafeAreaInsets();

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
              backgroundColor: themeColors.card,
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
            {booking?.massageType || 'Réservation'}
          </Text>

          <Text
            style={[
              styles.actionSheetSubtitle,
              { color: themeColors.textSecondary },
            ]}
          >
            #{booking?.bookingId}
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onViewDetails}
            style={styles.actionSheetRow}
          >
            <View
              style={[
                styles.actionSheetIcon,
                { backgroundColor: `${themeColors.primary}15` },
              ]}
            >
              <Ionicons
                name="eye-outline"
                size={18}
                color={themeColors.primary}
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

          {canCancel && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onCancel}
              style={styles.actionSheetRow}
            >
              <View
                style={[
                  styles.actionSheetIcon,
                  { backgroundColor: '#FEE2E2' },
                ]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color="#DC2626"
                />
              </View>

              <Text
                style={[
                  styles.actionSheetRowText,
                  { color: '#DC2626' },
                ]}
              >
                Annuler la réservation
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
// CALENDAR FILTER MODAL
//
// Bottom sheet avec un mini calendrier mensuel qui permet de
// filtrer "Mes réservations" par date exacte. S'ouvre depuis le
// bouton calendrier du header (avant : ce bouton faisait
// exactement la même chose que le bouton "+", ce qui ne servait
// à rien).
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
  // JS: dimanche=0..samedi=6 -> on veut lundi en premier
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
  // ⚠️ Android : idem que pour l'ActionSheet, on ajoute la
  // hauteur réelle de la barre de navigation gestuelle au
  // padding bas pour que "Réinitialiser" / "Appliquer" restent
  // toujours visibles et cliquables au-dessus du menu système.
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
            Platform.OS === 'web' && styles.calendarSheetWeb,
            {
              backgroundColor: themeColors.card,
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
                    ? themeColors.primary
                    : themeColors.border,
                  backgroundColor: !endKey
                    ? `${themeColors.primary}10`
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
                  ? formatDate(range.start)
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
                      ? themeColors.primary
                      : themeColors.border,
                  backgroundColor:
                    !!range?.start && !endKey
                      ? `${themeColors.primary}10`
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
                  ? formatDate(range.end)
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
                      backgroundColor: `${themeColors.primary}18`,
                    },
                    isStart &&
                      !!endKey && {
                        backgroundColor: `${themeColors.primary}18`,
                        borderTopLeftRadius: 16,
                        borderBottomLeftRadius: 16,
                      },
                    isEnd &&
                      !!startKey && {
                        backgroundColor: `${themeColors.primary}18`,
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
                        backgroundColor: themeColors.primary,
                      },
                      !isEdge &&
                        isToday && {
                          borderWidth: 1.5,
                          borderColor: themeColors.primary,
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
                          backgroundColor:
                            themeColors.primary,
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
                    ? themeColors.primary
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
// THERAPIST COMPACT CARD
// ============================================================

const TherapistCompact = ({
  therapist,
  themeColors,
}) => {
  if (!therapist?.isAssigned) {
    return null;
  }

  const therapistName =
    therapist.name || 'Thérapeute assigné';

  const avatarLetter =
    therapistName
      .trim()
      .charAt(0)
      .toUpperCase() || 'T';

  const assignedAtLabel = formatDateTime(
    therapist.assignedAt,
  );

  return (
    <View
      style={[
        styles.therapistCompact,
        {
          backgroundColor: themeColors.background,
          borderColor: themeColors.border,
        },
      ]}
    >
      <View
        style={[
          styles.therapistAvatarWrapper,
          {
            borderColor: therapist.isOnline
              ? '#22C55E'
              : themeColors.border,
          },
        ]}
      >
        {therapist.photo ? (
          <Image
            source={{ uri: therapist.photo }}
            style={styles.therapistAvatar}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.therapistAvatarFallback,
              {
                backgroundColor: themeColors.primary,
              },
            ]}
          >
            <Text style={styles.therapistAvatarLetter}>
              {avatarLetter}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.onlineIndicator,
            {
              backgroundColor: therapist.isOnline
                ? '#22C55E'
                : '#94A3B8',
              borderColor: themeColors.background,
            },
          ]}
        />
      </View>

      <View style={styles.therapistCompactInfo}>
        <View style={styles.therapistNameLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.therapistName,
              {
                color: themeColors.text,
              },
            ]}
          >
            {therapistName}
          </Text>

          <View
            style={[
              styles.onlineBadge,
              {
                backgroundColor: therapist.isOnline
                  ? '#DCFCE7'
                  : themeColors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.onlineBadgeText,
                {
                  color: therapist.isOnline
                    ? '#15803D'
                    : themeColors.textSecondary,
                },
              ]}
            >
              {therapist.isOnline ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
        </View>

        <View style={styles.contactLine}>
          <Ionicons
            name="mail-outline"
            size={13}
            color={themeColors.textSecondary}
          />

          <Text
            numberOfLines={1}
            style={[
              styles.contactText,
              {
                color: themeColors.textSecondary,
              },
            ]}
          >
            {therapist.email || 'Email non renseigné'}
          </Text>
        </View>

        <View style={styles.contactLine}>
          <Ionicons
            name="call-outline"
            size={13}
            color={themeColors.textSecondary}
          />

          <Text
            numberOfLines={1}
            style={[
              styles.contactText,
              {
                color: themeColors.textSecondary,
              },
            ]}
          >
            {therapist.phone || 'Numéro non renseigné'}
          </Text>
        </View>

        {!!assignedAtLabel && (
          <View style={styles.contactLine}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={themeColors.textSecondary}
            />

            <Text
              numberOfLines={1}
              style={[
                styles.contactText,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              Assigné le {assignedAtLabel}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ============================================================
// FILTER BUTTON
// ============================================================

const FilterButton = ({
  label,
  value,
  activeFilter,
  onPress,
  themeColors,
}) => {
  const isActive = activeFilter === value;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.filterButton,
        {
          backgroundColor: isActive
            ? themeColors.primary
            : themeColors.card,
          borderColor: isActive
            ? themeColors.primary
            : themeColors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.filterButtonText,
          {
            color: isActive
              ? '#FFFFFF'
              : themeColors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ============================================================
// BOOKING CARD COMPACT
// ============================================================

const BookingCard = ({
  booking,
  index: _index,
  themeColors,
  onPress,
  onMenuPress,
}) => {
  const statusConfig = getStatusConfig(booking.status);
  const typeVisual = getMassageTypeVisual(booking.massageType);
  const formattedPrice = formatPrice(booking.displayPrice);
  const formattedDuration = formatDuration(booking.duration);

  const dateTimeLabel = `${formatDate(
    booking.scheduledDate,
  )} · ${formatTime(booking.scheduledTime)}${
    formattedDuration ? ` (${formattedDuration})` : ''
  }`;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(booking)}
      style={[
        styles.bookingCard,
        {
          backgroundColor: themeColors.card,
          borderColor: themeColors.border,
        },
      ]}
    >
      {/* LIGNE PRINCIPALE : VIGNETTE + TITRE + PRIX */}
      <View style={styles.cardTopRow}>
        <View
          style={[
            styles.thumbnailWrapper,
            {
              backgroundColor: typeVisual.backgroundColor,
            },
          ]}
        >
          {booking.imageUrl ? (
            <Image
              source={{ uri: booking.imageUrl }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailFallback}>
              <Ionicons
                name={typeVisual.icon}
                size={26}
                color={typeVisual.color}
              />
            </View>
          )}
        </View>

        <View style={styles.cardMiddleColumn}>
          <View
            style={[
              styles.miniStatusBadge,
              {
                backgroundColor: statusConfig.backgroundColor,
              },
            ]}
          >
            <Ionicons
              name={statusConfig.icon}
              size={11}
              color={statusConfig.color}
            />

            <Text
              numberOfLines={1}
              style={[
                styles.miniStatusText,
                {
                  color: statusConfig.color,
                },
              ]}
            >
              {statusConfig.label}
            </Text>
          </View>

          <Text
            numberOfLines={1}
            style={[
              styles.cardMainTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            {booking.massageType}
          </Text>

          <View style={styles.typeRow}>
            <Ionicons
              name={typeVisual.icon}
              size={12}
              color={typeVisual.color}
            />

            <Text
              numberOfLines={1}
              style={[
                styles.typeText,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              {booking.massageType}
            </Text>
          </View>
        </View>

        <View style={styles.cardRightColumn}>
          {!!formattedPrice && (
            <View
              style={[
                styles.priceBadge,
                {
                  backgroundColor: `${themeColors.primary}15`,
                },
              ]}
            >
              <Ionicons
                name="cash-outline"
                size={13}
                color={themeColors.primary}
              />

              <Text
                numberOfLines={1}
                style={[
                  styles.priceBadgeText,
                  {
                    color: themeColors.primary,
                  },
                ]}
              >
                {formattedPrice}
              </Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => onMenuPress?.(booking)}
            style={[
              styles.menuButton,
              {
                backgroundColor: `${themeColors.primary}12`,
              },
            ]}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={16}
              color={themeColors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* LIGNE DATE / HEURE + LIEU */}
      <View
        style={[
          styles.metaGroup,
          {
            borderTopColor: themeColors.border,
          },
        ]}
      >
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <View
              style={[
                styles.metaIconWrap,
                {
                  backgroundColor: '#DCFCE7',
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color="#16A34A"
              />
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.metaText,
                {
                  color: themeColors.text,
                },
              ]}
            >
              {dateTimeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <View
              style={[
                styles.metaIconWrap,
                {
                  backgroundColor: '#DBEAFE',
                },
              ]}
            >
              <Ionicons
                name="location-outline"
                size={13}
                color="#2563EB"
              />
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.metaText,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              {booking.address || 'Adresse non définie'}
            </Text>
          </View>
        </View>
      </View>

      {/* THERAPEUTE : AFFICHÉ UNIQUEMENT S'IL EST ASSIGNÉ */}
      <TherapistCompact
        therapist={booking.therapist}
        themeColors={themeColors}
      />

      {/* FOOTER */}
      <View
        style={[
          styles.cardFooter,
          {
            borderTopColor: themeColors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.detailsText,
            {
              color: themeColors.primary,
            },
          ]}
        >
          Voir les détails
        </Text>

        <View
          style={[
            styles.arrowCircle,
            {
              backgroundColor: `${themeColors.primary}15`,
            },
          ]}
        >
          <Ionicons
            name="arrow-forward"
            size={15}
            color={themeColors.primary}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================
// EMPTY STATE
// ============================================================

const EmptyState = ({
  activeFilter,
  onCreateBooking,
  themeColors,
}) => {
  const isFiltered = activeFilter !== 'all';

  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIconContainer,
          {
            backgroundColor: `${themeColors.primary}15`,
          },
        ]}
      >
        <Ionicons
          name={
            isFiltered
              ? 'filter-outline'
              : 'calendar-outline'
          }
          size={45}
          color={themeColors.primary}
        />
      </View>

      <Text
        style={[
          styles.emptyTitle,
          {
            color: themeColors.text,
          },
        ]}
      >
        {isFiltered
          ? 'Aucune réservation trouvée'
          : 'Aucune réservation'}
      </Text>

      <Text
        style={[
          styles.emptyDescription,
          {
            color: themeColors.textSecondary,
          },
        ]}
      >
        {isFiltered
          ? 'Aucune réservation ne correspond à ce filtre.'
          : 'Vous n’avez pas encore effectué de demande de massage.'}
      </Text>

      {!isFiltered && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCreateBooking}
          style={[
            styles.emptyActionButton,
            {
              backgroundColor: themeColors.primary,
            },
          ]}
        >
          <Ionicons
            name="add"
            size={19}
            color="#FFFFFF"
          />

          <Text style={styles.emptyActionButtonText}>
            Faire une demande
          </Text>
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

  const [bookings, setBookings] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filtre par période (bouton calendrier du header)
  // - draftRange : ce que l'utilisateur est en train de choisir
  //   dans la modale (pas encore appliqué à la liste)
  // - appliedRange : la période réellement utilisée pour filtrer
  //   "Mes réservations" (mise à jour uniquement au clic sur
  //   "Appliquer")
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [draftRange, setDraftRange] = useState({
    start: null,
    end: null,
  });
  const [appliedRange, setAppliedRange] = useState({
    start: null,
    end: null,
  });

  const [massageTypesById, setMassageTypesById] = useState({});
  const [massageTypesByName, setMassageTypesByName] = useState({});

  // ==========================================================
  // TYPES DE MASSAGE RÉELS (pour la photo de chaque carte)
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const types =
          await massageTypeService.getActiveMassageTypes();

        if (cancelled) {
          return;
        }

        const byId = {};
        const byName = {};

        (types || []).forEach((type) => {
          if (type?.id !== undefined && type?.id !== null) {
            byId[String(type.id)] = type;
          }

          if (type?.name) {
            byName[
              String(type.name).trim().toLowerCase()
            ] = type;
          }
        });

        setMassageTypesById(byId);
        setMassageTypesByName(byName);
      } catch (typesError) {
        console.log(
          'Erreur chargement types de massage:',
          typesError?.message,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const resolveBookingImage = useCallback(
    (booking) => {
      if (booking.imageUrl) {
        return booking.imageUrl;
      }

      const matchById =
        booking.massageTypeId !== undefined &&
        booking.massageTypeId !== null &&
        booking.massageTypeId !== ''
          ? massageTypesById[String(booking.massageTypeId)]
          : null;

      const matchByName = booking.massageType
        ? massageTypesByName[
            String(booking.massageType).trim().toLowerCase()
          ]
        : null;

      const match = matchById || matchByName;

      const rawPath = match?.image_url || match?.icon_url;

      if (!rawPath) {
        return null;
      }

      return massageTypeService.getMassageImageUrl(rawPath);
    },
    [massageTypesById, massageTypesByName],
  );

  const loadBookings = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError('');

        const response =
          await bookingService.getBookings();

        const responseData =
          response?.data ??
          response ??
          [];

        let bookingList = [];

        if (Array.isArray(responseData)) {
          bookingList = responseData;
        } else if (Array.isArray(responseData.items)) {
          bookingList = responseData.items;
        } else if (
          Array.isArray(responseData.bookings)
        ) {
          bookingList = responseData.bookings;
        } else if (Array.isArray(responseData.data)) {
          bookingList = responseData.data;
        }

        const normalizedBookings = bookingList.map(
          normalizeBooking,
        );

        setBookings(normalizedBookings);
      } catch (requestError) {
        console.error(
          'Erreur chargement réservations:',
          requestError,
        );

        setError(
          'Impossible de charger vos réservations.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
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

  const bookingDateSet = useMemo(() => {
    const set = new Set();

    bookings.forEach((booking) => {
      if (!booking.scheduledDate) {
        return;
      }

      const parsed = new Date(booking.scheduledDate);

      if (!Number.isNaN(parsed.getTime())) {
        set.add(toDateKey(parsed));
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
          return (
            booking.status === 'negotiation' ||
            booking.status === 'negotiating'
          );
        }

        return booking.status === activeFilter;
      });
    }

    if (appliedRange.start) {
      const startKey = toDateKey(appliedRange.start);
      // Si "Au" n'a jamais été choisi, on filtre uniquement le
      // jour de début (comportement d'un jour unique).
      const endKey = appliedRange.end
        ? toDateKey(appliedRange.end)
        : startKey;

      // Sécurité : si jamais les deux dates sont inversées.
      const [lowKey, highKey] =
        startKey <= endKey
          ? [startKey, endKey]
          : [endKey, startKey];

      result = result.filter((booking) => {
        if (!booking.scheduledDate) {
          return false;
        }

        const parsed = new Date(booking.scheduledDate);

        if (Number.isNaN(parsed.getTime())) {
          return false;
        }

        const key = toDateKey(parsed);

        return key >= lowKey && key <= highKey;
      });
    }

    return result;
  }, [bookings, activeFilter, appliedRange]);

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
        // Rien choisi encore, ou une période complète déjà en
        // place -> on recommence une nouvelle sélection.
        return { start: date, end: null };
      }

      // "Du" déjà choisi, on choisit "Au".
      if (toDateKey(date) < toDateKey(prev.start)) {
        // Jour touché avant le "Du" -> il devient le nouveau "Du".
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
  // MENU D'UNE RÉSERVATION (⋮)
  // ==========================================================

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
    if (menuTarget) {
      handleBookingPress(menuTarget);
    }

    setMenuTarget(null);
  }, [menuTarget, handleBookingPress]);

  const requestCancelBooking = useCallback(() => {
    setCancelTarget(menuTarget);
    setMenuTarget(null);
  }, [menuTarget]);

  const closeCancelModal = useCallback(() => {
    if (isCancelling) {
      return;
    }

    setCancelTarget(null);
  }, [isCancelling]);

  const performCancelBooking = useCallback(async () => {
    if (!cancelTarget || isCancelling) {
      return;
    }

    setIsCancelling(true);

    try {
      const result = await bookingService.cancelBooking(
        cancelTarget.bookingId,
        'Annulé par le client',
      );

      if (!result?.success) {
        throw new Error(
          result?.error ||
            "Impossible d'annuler la réservation.",
        );
      }

      setCancelTarget(null);
      showToast('Réservation annulée avec succès.', 'success');
      loadBookings(false);
    } catch (cancelError) {
      console.error(
        'Erreur annulation réservation:',
        cancelError,
      );

      showToast(
        cancelError?.message ||
          "Impossible d'annuler la réservation.",
        'error',
      );
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
    ({ item, index }) => {
      const resolvedImageUrl = resolveBookingImage(item);

      const bookingWithImage =
        resolvedImageUrl === item.imageUrl
          ? item
          : { ...item, imageUrl: resolvedImageUrl };

      return (
        <BookingCard
          booking={bookingWithImage}
          index={index}
          themeColors={themeColors}
          onPress={handleBookingPress}
          onMenuPress={handleMenuPress}
        />
      );
    },
    [
      themeColors,
      handleBookingPress,
      handleMenuPress,
      resolveBookingImage,
    ],
  );

  const keyExtractor = useCallback(
    (item, index) => {
      return String(item.bookingId || index);
    },
    [],
  );

  const filterOptions = [
    {
      label: 'Toutes',
      value: 'all',
    },
    {
      label: 'En attente',
      value: 'pending',
    },
    {
      label: 'Négociation',
      value: 'negotiation',
    },
    {
      label: 'Confirmées',
      value: 'confirmed',
    },
    {
      label: 'En cours',
      value: 'in_progress',
    },
    {
      label: 'Terminées',
      value: 'completed',
    },
    {
      label: 'Annulées',
      value: 'cancelled',
    },
  ];

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
        title="Mes réservations"
        showBack
      />

      <View style={styles.content}>
        {/* PAGE HEADER */}
        <View style={styles.pageHeader}>
          <View>
            <Text
              style={[
                styles.pageTitle,
                {
                  color: themeColors.text,
                },
              ]}
            >
              Historique
            </Text>

            <Text
              style={[
                styles.pageSubtitle,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              Consultez vos demandes de massage
            </Text>
          </View>

          <View style={styles.pageHeaderActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openCalendarModal}
              style={[
                styles.headerCalendarButton,
                {
                  backgroundColor: `${themeColors.primary}12`,
                  borderColor: `${themeColors.primary}35`,
                },
                !!appliedRange.start && styles.headerCalendarButtonActive,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Filtrer par période"
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={themeColors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleCreateBooking}
              style={[
                styles.newBookingButton,
                {
                  backgroundColor: themeColors.primary,
                },
              ]}
            >
            <Ionicons
              name="add"
              size={21}
              color="#FFFFFF"
            />
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
                onPress={() =>
                  setActiveFilter(item.value)
                }
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
                {
                  backgroundColor: `${themeColors.primary}15`,
                  borderColor: themeColors.primary,
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color={themeColors.primary}
              />

              <Text
                style={[
                  styles.dateFilterChipText,
                  { color: themeColors.primary },
                ]}
              >
                {appliedRange.end &&
                toDateKey(appliedRange.end) !==
                  toDateKey(appliedRange.start)
                  ? `${formatDate(appliedRange.start)} – ${formatDate(
                      appliedRange.end,
                    )}`
                  : formatDate(appliedRange.start)}
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={clearAppliedRange}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name="close-circle"
                  size={15}
                  color={themeColors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CONTENT */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={themeColors.primary}
            />

            <Text
              style={[
                styles.loadingText,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              Chargement de vos réservations...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={45}
              color="#DC2626"
            />

            <Text
              style={[
                styles.errorTitle,
                {
                  color: themeColors.text,
                },
              ]}
            >
              Une erreur est survenue
            </Text>

            <Text
              style={[
                styles.errorText,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              {error}
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => loadBookings(true)}
              style={[
                styles.retryButton,
                {
                  backgroundColor: themeColors.primary,
                },
              ]}
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.retryButtonText}>
                Réessayer
              </Text>
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
              filteredBookings.length === 0 &&
                styles.emptyListContent,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
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
    paddingHorizontal: 15,
  },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 11,
  },

  pageHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginLeft: 12,
  },

  pageTitle: {
    fontSize: 23,
    lineHeight: 29,
    fontFamily: typography.fontFamily.bold,
  },

  pageSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: typography.fontFamily.regular,
  },

  newBookingButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCalendarButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  headerCalendarButtonActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#168A55',
  },

  dateFilterChipRow: {
    flexDirection: 'row',
    marginBottom: 10,
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

  filtersWrapper: {
    marginBottom: 12,
  },

  filtersContent: {
    paddingRight: 10,
    gap: 7,
  },

  filterButton: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterButtonText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
  },

  listContent: {
    paddingTop: 3,
    paddingBottom: 28,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  // ==========================================================
  // COMPACT BOOKING CARD
  // ==========================================================

  bookingCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginBottom: 11,
    overflow: 'hidden',
  },

  // ==========================================================
  // TOP ROW : VIGNETTE + TITRE + PRIX
  // ==========================================================

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  thumbnailWrapper: {
    width: 58,
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  thumbnailImage: {
    width: '100%',
    height: '100%',
  },

  thumbnailFallback: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardMiddleColumn: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },

  miniStatusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 5,
  },

  miniStatusText: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: typography.fontFamily.bold,
  },

  cardMainTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontFamily: typography.fontFamily.bold,
  },

  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },

  typeText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: typography.fontFamily.regular,
  },

  cardRightColumn: {
    alignItems: 'flex-end',
  },

  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },

  priceBadgeText: {
    fontSize: 11.5,
    lineHeight: 14,
    fontFamily: typography.fontFamily.bold,
  },

  menuButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ==========================================================
  // META (DATE / HEURE + LIEU)
  // ==========================================================

  metaGroup: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  metaItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  metaIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  metaText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: typography.fontFamily.medium,
  },

  // ==========================================================
  // THERAPIST COMPACT
  // ==========================================================

  therapistCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },

  therapistAvatarWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.2,
    padding: 2,
    position: 'relative',
    marginRight: 11,
  },

  therapistAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },

  therapistAvatarFallback: {
    flex: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  therapistAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 21,
    fontFamily: typography.fontFamily.bold,
  },

  onlineIndicator: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  therapistCompactInfo: {
    flex: 1,
    minWidth: 0,
  },

  therapistNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  therapistName: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.bold,
  },

  onlineBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
  },

  onlineBadgeText: {
    fontSize: 9,
    lineHeight: 11,
    fontFamily: typography.fontFamily.medium,
  },

  contactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginTop: 3,
    gap: 5,
  },

  contactText: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    lineHeight: 13,
    fontFamily: typography.fontFamily.regular,
  },

  // ==========================================================
  // FOOTER
  // ==========================================================

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    gap: 6,
  },

  detailsText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
  },

  arrowCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ==========================================================
  // EMPTY STATE
  // ==========================================================

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 50,
  },

  emptyIconContainer: {
    width: 92,
    height: 92,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  emptyTitle: {
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
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
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  // ==========================================================
  // LOADING / ERROR
  // ==========================================================

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
    marginTop: 15,
    fontSize: 18,
    lineHeight: 24,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 13,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
  },

  // ==========================================================
  // TOAST
  // ==========================================================

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

  // ==========================================================
  // MODAL BACKDROP (commun ConfirmModal / ActionSheet)
  // ==========================================================

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,20,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  // ==========================================================
  // CONFIRM MODAL
  // ==========================================================

  confirmCard: {
    alignSelf: 'center',
    width: '88%',
    maxWidth: 380,
    marginBottom: 'auto',
    marginTop: 'auto',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
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
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: typography.fontFamily.bold,
  },

  // ==========================================================
  // ACTION SHEET
  // ==========================================================

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

  // ==========================================================
  // CALENDAR FILTER MODAL
  // ==========================================================

  calendarSheet: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    // paddingBottom réel calculé dans le composant (insets.bottom
    // + marge) pour tenir compte de la barre de navigation Android.
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