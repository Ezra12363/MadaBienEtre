// ============================================================
// MADA BIEN-ÊTRE
// THERAPIST - OFFERS / DEMANDES
// ============================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { useFocusEffect } from '@react-navigation/native';

import bookingService from '../../services/bookingService';
import offerService from '../../services/offerService';

import Header from '../../components/common/Header';

import { useTheme } from '../../context/ThemeContext';

// ============================================================
// ANDROID STATUS BAR
// ============================================================

const ANDROID_STATUS_BAR_HEIGHT =
  Platform.OS === 'android'
    ? StatusBar.currentHeight || 24
    : 0;

// ============================================================
// COLORS
// ============================================================

const COLORS = {
  primary: '#2E8B57',
  primaryDark: '#247447',
  primaryDarker: '#1B5C36',
  primarySoft: '#EAF6EF',
  primaryTint: '#D6EEE0',

  white: '#FFFFFF',
  black: '#202020',

  background: '#F4F7F5',
  card: '#FFFFFF',

  text: '#222B26',
  textSecondary: '#6B7A72',
  textLight: '#FFFFFF',

  border: '#E4EAE6',
  borderStrong: '#D2DCD6',
  divider: '#EAF0EC',

  red: '#D93636',
  redSoft: '#FDECEC',

  orange: '#E08E0B',
  orangeSoft: '#FDF3E2',

  blue: '#3B82F6',
  blueSoft: '#EFF6FF',

  purple: '#7B61FF',
  purpleSoft: '#F1EDFE',

  green: '#22C55E',
  greenDark: '#16A34A',

  avatar: '#E5F1E9',

  tableHeader: '#F6FAF7',
  hover: '#F2F8F4',
};

const AUTO_REFRESH_MS = 15000;

// ============================================================
// TOAST
// ============================================================

function Toast({ toast }) {
  const { colors, isDark } = useTheme();

  const toastStyles = useMemo(
    () => createToastStyles(colors, isDark),
    [colors, isDark]
  );

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <View
      style={[
        toastStyles.container,
        isSuccess ? toastStyles.success : toastStyles.error,
      ]}
    >
      <Ionicons
        name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
        size={18}
        color={COLORS.white}
      />
      <Text style={toastStyles.text}>{toast.message}</Text>
    </View>
  );
}

const createToastStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: ANDROID_STATUS_BAR_HEIGHT + 78,
      left: 14,
      right: 14,
      zIndex: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      ...Platform.select({
        web: { boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
        default: { elevation: 8 },
      }),
    },
    success: { backgroundColor: COLORS.primary },
    error: { backgroundColor: COLORS.red },
    text: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.white,
    },
  });

// ============================================================
// CONFIRMATION MODAL
// ============================================================

function ConfirmationModal({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = 'Confirmer',
  destructive = false,
}) {
  const { colors, isDark } = useTheme();

  const confirmationStyles = useMemo(
    () => createConfirmationStyles(colors, isDark),
    [colors, isDark]
  );

  if (!visible) return null;

  return (
    <View style={confirmationStyles.overlay}>
      <Pressable style={confirmationStyles.backdrop} onPress={onCancel} />
      <View style={confirmationStyles.modal}>
        <View
          style={[
            confirmationStyles.iconCircle,
            destructive && {
              backgroundColor: isDark ? '#3A1717' : '#FFF0F0',
            },
          ]}
        >
          <Ionicons
            name={destructive ? 'warning-outline' : 'help-circle-outline'}
            size={26}
            color={destructive ? COLORS.red : COLORS.primary}
          />
        </View>
        <Text style={confirmationStyles.title}>{title}</Text>
        <Text style={confirmationStyles.message}>{message}</Text>
        <View style={confirmationStyles.buttons}>
          <Pressable
            style={confirmationStyles.cancelButton}
            onPress={onCancel}
          >
            <Text style={confirmationStyles.cancelText}>Annuler</Text>
          </Pressable>
          <Pressable
            style={[
              confirmationStyles.confirmButton,
              destructive && confirmationStyles.confirmDanger,
            ]}
            onPress={onConfirm}
          >
            <Text style={confirmationStyles.confirmText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createConfirmationStyles = (colors, isDark) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 5000,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 22,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modal: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 14,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: isDark ? '#173824' : '#EEF7F0',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
    },
    message: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    buttons: { flexDirection: 'row', gap: 10, marginTop: 22 },
    cancelButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmDanger: { backgroundColor: COLORS.red },
    cancelText: { color: colors.text, fontSize: 13, fontWeight: '800' },
    confirmText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  });

// ============================================================
// HELPERS
// ============================================================

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isEmptyBookingValue = value =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'number' && Number.isNaN(value));

const mergeClientObjects = (a, b) => {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;

  const merged = { ...a };
  Object.keys(b).forEach(key => {
    if (isEmptyBookingValue(merged[key]) && !isEmptyBookingValue(b[key])) {
      merged[key] = b[key];
    }
  });
  return merged;
};

const mergeBookingRecords = (base, extra) => {
  if (!base) return extra;
  if (!extra) return base;

  const merged = { ...base };
  Object.keys(extra).forEach(key => {
    if (key === 'client') return;
    if (isEmptyBookingValue(merged[key]) && !isEmptyBookingValue(extra[key])) {
      merged[key] = extra[key];
    }
  });

  const mergedClient = mergeClientObjects(base.client, extra.client);
  if (mergedClient) merged.client = mergedClient;

  return merged;
};

const normalizeArray = value => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.bookings)) return value.bookings;
  if (Array.isArray(value?.offers)) return value.offers;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data?.offers)) return value.data.offers;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
};

// ============================================================
// STATUS NORMALIZATION
// ============================================================

const normalizeStatus = booking => {
  const raw = String(
    booking?.status ?? booking?.booking_status ?? ''
  )
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    raw === 'pending' ||
    raw === 'waiting' ||
    raw === 'attente' ||
    raw === 'en_attente' ||
    raw === 'en attente'
  ) return 'pending';

  if (
    raw === 'negotiating' ||
    raw === 'negotiation' ||
    raw === 'negociation' ||
    raw === 'in_negotiation' ||
    raw === 'en_negociation' ||
    raw === 'en negotiation' ||
    raw === 'en negociation'
  ) return 'negotiating';

  if (
    raw === 'confirmed' ||
    raw === 'accepted' ||
    raw === 'confirm' ||
    raw === 'confirme' ||
    raw === 'acceptee' ||
    raw === 'accepted_by_client' ||
    raw === 'accepted_by_therapist'
  ) return 'confirmed';

  if (
    raw === 'in_progress' ||
    raw === 'inprogress' ||
    raw === 'en_cours' ||
    raw === 'en cours' ||
    raw === 'ongoing' ||
    raw === 'started'
  ) return 'in_progress';

  if (
    raw === 'completed' ||
    raw === 'complete' ||
    raw === 'terminee' ||
    raw === 'termine' ||
    raw === 'finished' ||
    raw === 'done'
  ) return 'completed';

  if (
    raw === 'cancelled_by_client' ||
    raw === 'canceled_by_client' ||
    raw === 'annulee_par_le_client' ||
    raw === 'annule_client'
  ) return 'cancelled_by_client';

  if (
    raw === 'cancelled_by_therapist' ||
    raw === 'canceled_by_therapist' ||
    raw === 'annulee_par_le_therapeute' ||
    raw === 'annule_therapeute'
  ) return 'cancelled_by_therapist';

  if (
    raw === 'cancelled' ||
    raw === 'canceled' ||
    raw === 'annulee' ||
    raw === 'annule'
  ) return 'cancelled_by_client';

  if (
    raw === 'expired' ||
    raw === 'expiree' ||
    raw === 'expire' ||
    raw === 'timeout'
  ) return 'expired';

  return raw || 'pending';
};

const isDisplayedBooking = () => true;

const isCancelledStatus = status =>
  status === 'cancelled_by_client' ||
  status === 'cancelled_by_therapist';

// ============================================================
// STATUS UI
// ============================================================

const getStatusUI = (booking, isDark = false) => {
  const status = normalizeStatus(booking);

  switch (status) {
    case 'pending':
      return {
        key: 'pending',
        label: 'En attente',
        color: COLORS.primary,
        background: isDark ? '#132A1E' : COLORS.primarySoft,
        dot: COLORS.primary,
        icon: 'time-outline',
      };
    case 'negotiating':
      return {
        key: 'negotiating',
        label: 'Négociation',
        color: isDark ? '#F5A623' : '#B26A00',
        background: isDark ? '#332912' : COLORS.orangeSoft,
        dot: COLORS.orange,
        icon: 'chatbubbles-outline',
      };
    case 'confirmed':
      return {
        key: 'confirmed',
        label: 'Confirmée',
        color: COLORS.primary,
        background: isDark ? '#132A1E' : COLORS.primarySoft,
        dot: COLORS.primary,
        icon: 'checkmark-circle-outline',
      };
    case 'in_progress':
      return {
        key: 'in_progress',
        label: 'En cours',
        color: isDark ? '#B8A6FF' : '#5B3DE0',
        background: isDark ? '#241B3D' : COLORS.purpleSoft,
        dot: COLORS.purple,
        icon: 'walk-outline',
      };
    case 'completed':
      return {
        key: 'completed',
        label: 'Terminée',
        color: isDark ? '#7FD989' : '#2E7D32',
        background: isDark ? '#173821' : '#E7F3E8',
        dot: isDark ? '#7FD989' : '#2E7D32',
        icon: 'checkmark-done-outline',
      };
    case 'cancelled_by_client':
      return {
        key: 'cancelled_by_client',
        label: 'Annulée (client)',
        color: COLORS.red,
        background: isDark ? '#3A1717' : COLORS.redSoft,
        dot: COLORS.red,
        icon: 'close-circle-outline',
      };
    case 'cancelled_by_therapist':
      return {
        key: 'cancelled_by_therapist',
        label: 'Annulée (moi)',
        color: COLORS.red,
        background: isDark ? '#3A1717' : COLORS.redSoft,
        dot: COLORS.red,
        icon: 'close-circle-outline',
      };
    case 'expired':
      return {
        key: 'expired',
        label: 'Expirée',
        color: isDark ? '#B0B0B0' : COLORS.textSecondary,
        background: isDark ? '#2A2A2A' : '#EFEFEF',
        dot: isDark ? '#B0B0B0' : COLORS.textSecondary,
        icon: 'hourglass-outline',
      };
    default:
      return {
        key: 'pending',
        label: 'En attente',
        color: COLORS.primary,
        background: isDark ? '#132A1E' : COLORS.primarySoft,
        dot: COLORS.primary,
        icon: 'time-outline',
      };
  }
};

// ============================================================
// BOOKING DATA
// ============================================================

const getClientName = booking =>
  booking?.client_name ??
  booking?.client_fullname ??
  booking?.client?.fullname ??
  booking?.client?.full_name ??
  booking?.client?.name ??
  'Client';

const getPhone = booking =>
  booking?.client_phone ??
  booking?.phone ??
  booking?.client?.phone ??
  '';

const getEmail = booking =>
  booking?.client_email ??
  booking?.email ??
  booking?.client?.email ??
  '';

const getClientPhoto = booking =>
  booking?.client_photo ??
  booking?.clientPhoto ??
  booking?.client_profile_image ??
  booking?.client?.profile_image ??
  booking?.client?.photo ??
  booking?.client?.avatar ??
  null;

const getRequestedAt = booking =>
  booking?.created_at ?? booking?.createdAt ?? null;

const getExpiresAt = booking =>
  booking?.expires_at ?? booking?.expiresAt ?? null;

const isOfferExpired = booking => {
  const value = getExpiresAt(booking);
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
};

const getMassageName = booking =>
  booking?.massage_type_name ??
  booking?.massageTypeName ??
  booking?.massage_type?.name ??
  booking?.massage_type?.title ??
  booking?.massageType?.name ??
  'Massage';

const getCategory = booking =>
  booking?.massage_category ??
  booking?.category ??
  booking?.massage_type?.category ??
  '';

const getPrice = booking =>
  safeNumber(
    booking?.price_offered ??
      booking?.price ??
      booking?.counter_price ??
      booking?.final_price ??
      booking?.client_price_proposed ??
      booking?.clientPriceProposed ??
      booking?.proposed_price ??
      booking?.proposedPrice ??
      0
  );

const getDuration = booking =>
  safeNumber(
    booking?.scheduled_duration_minutes ??
      booking?.scheduledDurationMinutes ??
      booking?.duration_minutes ??
      booking?.durationMinutes ??
      booking?.duration ??
      60,
    60
  );

const getDistance = booking => {
  const value =
    booking?.distance_km ?? booking?.distanceKm ?? booking?.distance;
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getEta = booking => {
  const value =
    booking?.eta_minutes ?? booking?.etaMinutes ?? booking?.eta;
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getAddress = booking =>
  booking?.address ??
  booking?.client_location ??
  booking?.clientLocation ??
  booking?.location ??
  'Adresse non renseignée';

const getScheduledDate = booking =>
  booking?.scheduled_date ??
  booking?.scheduledDate ??
  booking?.booking_date ??
  booking?.bookingDate ??
  booking?.date ??
  booking?.scheduled_at ??
  booking?.scheduledAt ??
  null;

// ============================================================
// FORMAT
// ============================================================

const formatPrice = value => {
  const number = safeNumber(value);
  return `${number.toLocaleString('fr-FR')} Ar`;
};

const formatDate = value => {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
};

const formatDateOnly = value => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateOnlyKey = value => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return formatDateOnly(value);
};

const formatDateLabel = value => {
  const key = getDateOnlyKey(value);
  if (!key) return 'Choisir une date';
  const parts = key.split('-').map(Number);
  if (parts.length !== 3) return 'Choisir une date';
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getInitial = name => {
  const value = String(name || 'C').trim();
  return value.charAt(0).toUpperCase() || 'C';
};

// ============================================================
// OFFER HELPERS
// ============================================================

const getOfferId = offer =>
  offer?.id ?? offer?.offer_id ?? offer?.offerId ?? null;

const getOfferType = offer => {
  const raw = String(
    offer?.user_type ??
      offer?.userType ??
      offer?.sender_type ??
      offer?.senderType ??
      offer?.role ??
      offer?.offer_type ??
      ''
  )
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    raw === 'therapist' ||
    raw === 'therapeute' ||
    raw === 'provider' ||
    raw === 'professional'
  ) return 'therapist';
  if (raw === 'client' || raw === 'customer') return 'client';
  return raw;
};

const getOfferStatus = offer =>
  String(offer?.status ?? '').trim().toLowerCase();

const isClientOffer = offer => getOfferType(offer) === 'client';

const ACTIVE_OFFER_STATUSES = new Set([
  'sent',
  'pending',
  'active',
  'negotiating',
]);

const isActiveClientOffer = offer =>
  isClientOffer(offer) && ACTIVE_OFFER_STATUSES.has(getOfferStatus(offer));

const isActiveTherapistOffer = offer =>
  getOfferType(offer) === 'therapist' &&
  ACTIVE_OFFER_STATUSES.has(getOfferStatus(offer));

const getOfferSortValue = offer => {
  const created = offer?.created_at ?? offer?.createdAt;
  const time = created ? new Date(created).getTime() : NaN;
  if (Number.isFinite(time)) return time;
  const id = Number(getOfferId(offer));
  return Number.isFinite(id) ? id : 0;
};

const getLatestActiveOffer = (offers, predicate) => {
  if (!Array.isArray(offers)) return null;
  const active = offers
    .filter(predicate)
    .slice()
    .sort((a, b) => getOfferSortValue(a) - getOfferSortValue(b));
  return active.length ? active[active.length - 1] : null;
};

// ============================================================
// TAB BUTTON
// ============================================================

function TabButton({ label, count, active, onPress }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
      <View style={[styles.tabCount, active && styles.tabCountActive]}>
        <Text
          style={[
            styles.tabCountText,
            active && styles.tabCountTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

// ============================================================
// CLIENT AVATAR
// ============================================================

function getClientOnline(booking) {
  const value =
    booking?.client_is_online ??
    booking?.clientIsOnline ??
    booking?.is_client_online ??
    booking?.isClientOnline ??
    booking?.client?.is_online ??
    booking?.client?.isOnline ??
    false;

  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'online'].includes(value.trim().toLowerCase());
  }
  return value === true || value === 1;
}

function ClientAvatar({ photoUrl, name, size = 52, isOnline = false }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [failed, setFailed] = useState(false);
  const showImage = !!photoUrl && !failed;
  const radius = Math.max(10, Math.round(size * 0.24));

  return (
    <View
      style={[
        styles.avatarFrame,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: photoUrl }}
          style={[
            styles.avatarImage,
            { width: size, height: size, borderRadius: radius },
          ]}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`Photo de profil de ${name}`}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
            {getInitial(name)}
          </Text>
        </View>
      )}

      {isOnline ? (
        <View style={styles.onlineIndicator}>
          <View style={styles.onlineIndicatorInner} />
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function OffersScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isMobile = !isWeb || width < 850;

  const insets = useSafeAreaInsets();
  const sheetBottomPadding =
    Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + 18;

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showDateModal, setShowDateModal] = useState(false);
  const [actionSheetBooking, setActionSheetBooking] = useState(null);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // ==========================================================
  // LOAD BOOKINGS
  // ==========================================================

  const loadBookings = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError('');

      let available = [];
      try {
        const availableResult = await bookingService.getAvailableBookings({
          limit: 100,
          ignore_distance: true,
        });
        if (availableResult?.success) {
          available = normalizeArray(availableResult.data);
        }
      } catch (availableError) {
        console.warn('⚠️ AVAILABLE ERROR:', availableError);
      }

      let allBookings = [];
      try {
        const allResult = await bookingService.getBookings({});
        if (allResult?.success) {
          allBookings = normalizeArray(allResult.data);
        }
      } catch (allError) {
        console.warn('⚠️ ALL BOOKINGS ERROR:', allError);
      }

      const mergedMap = new Map();
      [...available, ...allBookings].forEach(booking => {
        const id =
          booking?.id ?? booking?.booking_id ?? booking?.bookingId;
        if (id === null || id === undefined) return;
        const key = String(id);
        const existing = mergedMap.get(key);
        mergedMap.set(key, mergeBookingRecords(existing, booking));
      });

      const merged = Array.from(mergedMap.values())
        .filter(isDisplayedBooking)
        .sort((a, b) => {
          const da = new Date(
            getScheduledDate(a) || a?.created_at || 0
          ).getTime();
          const db = new Date(
            getScheduledDate(b) || b?.created_at || 0
          ).getTime();
          return db - da;
        });

      const enriched = await Promise.all(
        merged.map(async booking => {
          const status = normalizeStatus(booking);
          if (status !== 'pending' && status !== 'negotiating') {
            return {
              ...booking,
              _offersLoaded: true,
              _activeClientOffer: null,
              _activeTherapistOffer: null,
            };
          }

          try {
            const offersResult = await offerService.getOffersByBooking(
              booking.id
            );
            const offers = normalizeArray(offersResult?.data);
            return {
              ...booking,
              _offersLoaded: !!offersResult?.success,
              _activeClientOffer: getLatestActiveOffer(
                offers,
                isActiveClientOffer
              ),
              _activeTherapistOffer: getLatestActiveOffer(
                offers,
                isActiveTherapistOffer
              ),
            };
          } catch (offerError) {
            console.warn('⚠️ OFFERS VISIBILITY ERROR:', booking.id, offerError);
            return {
              ...booking,
              _offersLoaded: false,
              _activeClientOffer: null,
              _activeTherapistOffer: null,
            };
          }
        })
      );

      setBookings(enriched);

      if (
        enriched.length === 0 &&
        available.length === 0 &&
        allBookings.length === 0
      ) {
        setError('Aucune réservation disponible.');
      }
    } catch (loadError) {
      console.error('❌ LOAD ERROR:', loadError);
      setError(
        loadError?.message || 'Impossible de charger les réservations.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBookings(true);
    }, [loadBookings])
  );

  useEffect(() => {
    const interval = setInterval(() => loadBookings(false), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadBookings]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadBookings(false);
  }, [loadBookings]);

  const showToast = useCallback((type, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ==========================================================
  // COUNTS
  // ==========================================================

  const counts = useMemo(() => {
    return {
      all: bookings.length,
      pending: bookings.filter(
        item => normalizeStatus(item) === 'pending'
      ).length,
      negotiating: bookings.filter(
        item => normalizeStatus(item) === 'negotiating'
      ).length,
      confirmed: bookings.filter(
        item => normalizeStatus(item) === 'confirmed'
      ).length,
      in_progress: bookings.filter(
        item => normalizeStatus(item) === 'in_progress'
      ).length,
      completed: bookings.filter(
        item => normalizeStatus(item) === 'completed'
      ).length,
      cancelled: bookings.filter(item =>
        isCancelledStatus(normalizeStatus(item))
      ).length,
      expired: bookings.filter(
        item => normalizeStatus(item) === 'expired'
      ).length,
    };
  }, [bookings]);

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredBookings = useMemo(() => {
    const fromKey = dateFrom ? formatDateOnly(dateFrom) : null;
    const toKey = dateTo ? formatDateOnly(dateTo) : null;

    return bookings.filter(booking => {
      const status = normalizeStatus(booking);

      if (activeTab === 'pending' && status !== 'pending') return false;
      if (activeTab === 'negotiating' && status !== 'negotiating')
        return false;
      if (activeTab === 'confirmed' && status !== 'confirmed') return false;
      if (activeTab === 'in_progress' && status !== 'in_progress')
        return false;
      if (activeTab === 'completed' && status !== 'completed') return false;
      if (activeTab === 'cancelled' && !isCancelledStatus(status))
        return false;
      if (activeTab === 'expired' && status !== 'expired') return false;

      if (fromKey || toKey) {
        const bookingDateKey = getDateOnlyKey(getScheduledDate(booking));
        if (!bookingDateKey) return false;
        if (fromKey && bookingDateKey < fromKey) return false;
        if (toKey && bookingDateKey > toKey) return false;
      }

      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const haystack = [
          getClientName(booking),
          getPhone(booking),
          getEmail(booking),
          getAddress(booking),
          booking?.id != null ? `#${booking.id}` : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [activeTab, bookings, dateFrom, dateTo, searchQuery]);

  // ==========================================================
  // OPEN BOOKING
  // ==========================================================

  const openBooking = useCallback(
    booking => {
      if (!booking?.id) {
        Alert.alert('Erreur', 'Identifiant de réservation invalide.');
        return;
      }
      navigation.navigate('Offer', { bookingId: booking.id, booking });
    },
    [navigation]
  );

  // ==========================================================
  // NEGOTIATION
  // ==========================================================

  const handleNegotiation = useCallback(
    booking => {
      if (!booking?.id) {
        Alert.alert('Erreur', 'Réservation invalide.');
        return;
      }

      const status = normalizeStatus(booking);

      if (status !== 'pending' && status !== 'negotiating') {
        Alert.alert(
          'Négociation fermée',
          'Cette réservation est déjà confirmée.'
        );
        return;
      }

      showToast('success', 'Ouverture de la négociation.');
      navigation.navigate('Negotiation', {
        bookingId: booking.id,
        currentPrice: getPrice(booking),
        clientName: getClientName(booking),
        booking,
        activeTab: 'Demandes',
      });
    },
    [navigation, showToast]
  );

  // ==========================================================
  // GET CLIENT OFFER
  // ==========================================================

  const getActiveClientOffer = useCallback(async bookingId => {
    const result = await offerService.getOffersByBooking(bookingId);

    if (!result?.success) {
      throw new Error(
        result?.error || 'Impossible de récupérer les offres.'
      );
    }

    const offers = normalizeArray(result.data);
    const active = offers.filter(isActiveClientOffer);

    if (active.length === 0) return null;
    return active[active.length - 1];
  }, []);

  // ==========================================================
  // ACCEPT
  // ==========================================================

  const executeAccept = useCallback(
    async booking => {
      if (!booking?.id) return;
      if (busyId !== null) return;

      const status = normalizeStatus(booking);
      if (status !== 'negotiating') {
        showToast(
          'error',
          'Cette réservation n’a pas d’offre client active à accepter.'
        );
        return;
      }

      const cachedClientOffer = booking?._activeClientOffer;
      if (!cachedClientOffer || !getOfferId(cachedClientOffer)) {
        showToast('error', 'Aucune offre active du client à accepter.');
        return;
      }

      try {
        setBusyId(booking.id);

        const clientOffer = await getActiveClientOffer(booking.id);
        if (!clientOffer) {
          throw new Error(
            'Aucune offre active du client n’a été trouvée pour cette réservation.'
          );
        }

        const offerId = getOfferId(clientOffer);
        if (!offerId) {
          throw new Error('Identifiant de l’offre client introuvable.');
        }

        const result = await offerService.acceptOffer(offerId);
        if (!result?.success) {
          throw new Error(result?.error || 'Impossible d’accepter l’offre.');
        }

        const returnedBooking = result?.data;

        setBookings(previous =>
          previous.map(item => {
            if (String(item.id) !== String(booking.id)) return item;
            return {
              ...item,
              status: 'confirmed',
              booking_status: 'confirmed',
              final_price:
                returnedBooking?.final_price ??
                returnedBooking?.price ??
                getPrice(booking),
            };
          })
        );

        showToast('success', 'Offre acceptée. Réservation confirmée.');
        await loadBookings(false);
      } catch (actionError) {
        console.error('❌ ACCEPT ERROR:', actionError);
        showToast(
          'error',
          actionError?.message || 'Impossible d’accepter l’offre.'
        );
      } finally {
        setBusyId(null);
      }
    },
    [busyId, getActiveClientOffer, loadBookings, showToast]
  );

  // ==========================================================
  // ACTION STATE
  // ==========================================================

  const getActionState = useCallback(booking => {
    const status = normalizeStatus(booking);
    const showNegotiation =
      status === 'pending' || status === 'negotiating';

    const hasClientOffer =
      !!booking?._activeClientOffer && !!getOfferId(booking._activeClientOffer);

    const showAcceptReject = status === 'negotiating' && hasClientOffer;

    return { showNegotiation, showAcceptReject };
  }, []);

  // ==========================================================
  // ACCEPT WITH CONFIRMATION
  // ==========================================================

  const handleAccept = useCallback(
    booking => {
      if (!booking?.id || busyId !== null) return;

      const actionState = getActionState(booking);
      if (!actionState.showAcceptReject) {
        showToast('error', 'Aucune offre active du client à accepter.');
        return;
      }

      setConfirmModal({
        title: 'Accepter l’offre ?',
        message: `Accepter l’offre client de ${formatPrice(
          getPrice(booking?._activeClientOffer) || getPrice(booking)
        )} pour cette réservation ?`,
        confirmLabel: 'Accepter',
        destructive: false,
        onConfirm: () => {
          setConfirmModal(null);
          executeAccept(booking);
        },
      });
    },
    [busyId, executeAccept, getActionState, showToast]
  );

  // ==========================================================
  // REJECT
  // ==========================================================

  const handleReject = useCallback(
    booking => {
      if (!booking?.id || busyId !== null) return;

      const actionState = getActionState(booking);
      if (!actionState.showAcceptReject) {
        showToast('error', 'Aucune offre active du client à refuser.');
        return;
      }

      setConfirmModal({
        title: 'Refuser l’offre ?',
        message: `Refuser l’offre client de ${formatPrice(
          getPrice(booking)
        )} ? Cette action ne peut pas être annulée.`,
        confirmLabel: 'Refuser',
        destructive: true,
        onConfirm: async () => {
          setConfirmModal(null);
          try {
            setBusyId(booking.id);
            const clientOffer = await getActiveClientOffer(booking.id);
            if (!clientOffer) {
              throw new Error('Aucune offre active du client trouvée.');
            }
            const offerId = getOfferId(clientOffer);
            if (!offerId) {
              throw new Error('ID de l’offre introuvable.');
            }
            const result = await offerService.rejectOffer(offerId);
            if (!result?.success) {
              throw new Error(result?.error || 'Impossible de refuser l’offre.');
            }
            setBookings(previous =>
              previous.map(item =>
                String(item.id) === String(booking.id)
                  ? {
                      ...item,
                      _activeClientOffer: null,
                      _activeTherapistOffer: null,
                    }
                  : item
              )
            );
            showToast('success', 'Offre refusée.');
            await loadBookings(false);
          } catch (rejectError) {
            console.error('❌ REJECT ERROR:', rejectError);
            showToast(
              'error',
              rejectError?.message || 'Impossible de refuser l’offre.'
            );
          } finally {
            setBusyId(null);
          }
        },
      });
    },
    [busyId, getActiveClientOffer, getActionState, loadBookings, showToast]
  );

  // ==========================================================
  // MOBILE CARD
  // ==========================================================

  const renderMobileCard = useCallback(
    ({ item }) => {
      const booking = item;
      const status = normalizeStatus(booking);
      const statusUI = getStatusUI(booking, isDark);
      const confirmed = status === 'confirmed';
      const busy = busyId === booking.id;

      const price = getPrice(booking);
      const distance = getDistance(booking);
      const eta = getEta(booking);
      const date = getScheduledDate(booking);
      const expiresAt = getExpiresAt(booking);
      const expired = isOfferExpired(booking);

      const showExpiry =
        !!expiresAt && (status === 'pending' || status === 'negotiating');

      const actionState = getActionState(booking);
      const hasActions =
        actionState.showNegotiation || actionState.showAcceptReject;

      return (
        <View
          style={[
            styles.mobileCard,
            hoveredId === booking.id && styles.cardHover,
          ]}
          onMouseEnter={() => isWeb && setHoveredId(booking.id)}
          onMouseLeave={() => isWeb && setHoveredId(null)}
        >
          {/* HEADER */}
          <View style={styles.mobileHeader}>
            <ClientAvatar
              photoUrl={getClientPhoto(booking)}
              name={getClientName(booking)}
              size={46}
              isOnline={getClientOnline(booking)}
            />

            <View style={styles.clientInfo}>
              <View style={styles.clientNameRow}>
                <Text style={styles.clientName} numberOfLines={1}>
                  {getClientName(booking)}
                </Text>
              </View>

              <Text style={styles.metaLine} numberOfLines={1}>
                #{booking.id}
                {getPhone(booking) ? `  ·  ${getPhone(booking)}` : ''}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusUI.background },
              ]}
            >
              <Ionicons
                name={statusUI.icon}
                size={11}
                color={statusUI.color}
              />
              <Text
                style={[styles.statusText, { color: statusUI.color }]}
                numberOfLines={1}
              >
                {statusUI.label}
              </Text>
            </View>

            <Pressable
              style={styles.kebabButton}
              onPress={event => {
                event?.stopPropagation?.();
                setActionSheetBooking(booking);
              }}
              disabled={busy}
              hitSlop={10}
              android_ripple={{
                color: '#ECECEC',
                borderless: true,
                radius: 20,
              }}
              accessibilityRole="button"
              accessibilityLabel="Voir les actions"
            >
              {busy ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons
                  name="ellipsis-vertical"
                  size={20}
                  color={colors.textSecondary}
                />
              )}
            </Pressable>
          </View>

          {/* INFO ROW */}
          <View style={styles.compactInfoRow}>
            <View style={styles.compactInfoItem}>
              <Ionicons name="body-outline" size={13} color={COLORS.primary} />
              <Text style={styles.compactInfoText} numberOfLines={1}>
                {getMassageName(booking)}
              </Text>
            </View>

            <View style={styles.compactInfoDivider} />

            <View style={styles.compactInfoItem}>
              <Ionicons name="time-outline" size={13} color={COLORS.primary} />
              <Text style={styles.compactInfoText} numberOfLines={1}>
                {getDuration(booking)} min
              </Text>
            </View>

            {distance !== null ? (
              <>
                <View style={styles.compactInfoDivider} />
                <View style={styles.compactInfoItem}>
                  <Ionicons
                    name="navigate-outline"
                    size={13}
                    color={COLORS.primary}
                  />
                  <Text style={styles.compactInfoText} numberOfLines={1}>
                    {distance.toFixed(1)} km
                    {eta !== null ? ` · ${Math.round(eta)} min` : ''}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {/* ADDRESS */}
          <View style={styles.addressRow}>
            <Ionicons
              name="location-outline"
              size={14}
              color={COLORS.primary}
            />
            <Text style={styles.address} numberOfLines={1}>
              {getAddress(booking)}
            </Text>
          </View>

          {showExpiry ? (
            <View style={styles.expiryRow}>
              <Ionicons
                name={expired ? 'alert-circle-outline' : 'hourglass-outline'}
                size={13}
                color={expired ? COLORS.red : COLORS.orange}
              />
              <Text
                style={[
                  styles.expiryLine,
                  expired && styles.expiryLineUrgent,
                ]}
                numberOfLines={1}
              >
                {expired ? 'Expirée le ' : 'Expire le '}
                {formatDate(expiresAt)}
              </Text>
            </View>
          ) : null}

          {/* FOOTER */}
          <View style={styles.footerRow}>
            <View style={styles.footerDateBlock}>
              {date ? (
                <View style={styles.dateRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={13}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.dateText} numberOfLines={1}>
                    {formatDate(date)}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.price}>{formatPrice(price)}</Text>
            </View>

            {hasActions ? (
              <View style={styles.actionHint}>
                <Ionicons
                  name="flash-outline"
                  size={12}
                  color={COLORS.primary}
                />
                <Text style={styles.actionHintText}>Action requise</Text>
              </View>
            ) : confirmed ? (
              <View style={styles.confirmedBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={COLORS.primary}
                />
                <Text style={styles.confirmedText}>Confirmée</Text>
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [busyId, hoveredId, isWeb, isDark, getActionState, colors]
  );

  // ==========================================================
  // WEB HEADER
  // ==========================================================

  const renderWebHeader = () => (
    <View style={styles.tableHeader}>
      <View style={styles.colClient}>
        <Text style={styles.tableHeaderText}>CLIENT</Text>
      </View>
      <View style={styles.colContact}>
        <Text style={styles.tableHeaderText}>CONTACT</Text>
      </View>
      <View style={styles.colMassage}>
        <Text style={styles.tableHeaderText}>PRESTATION</Text>
      </View>
      <View style={styles.colTravel}>
        <Text style={styles.tableHeaderText}>DISTANCE</Text>
      </View>
      <View style={styles.colDuration}>
        <Text style={styles.tableHeaderText}>DURÉE</Text>
      </View>
      <View style={styles.colAddress}>
        <Text style={styles.tableHeaderText}>ADRESSE</Text>
      </View>
      <View style={styles.colDates}>
        <Text style={styles.tableHeaderText}>DEMANDE / EXPIRATION</Text>
      </View>
      <View style={styles.colPrice}>
        <Text style={styles.tableHeaderText}>PRIX</Text>
      </View>
      <View style={styles.colStatus}>
        <Text style={styles.tableHeaderText}>STATUT</Text>
      </View>
      <View style={styles.colActions}>
        <Text style={styles.tableHeaderText}>ACTIONS</Text>
      </View>
    </View>
  );

  // ==========================================================
  // WEB ROW
  // ==========================================================

  const renderWebRow = useCallback(
    ({ item }) => {
      const booking = item;
      const status = normalizeStatus(booking);
      const statusUI = getStatusUI(booking, isDark);
      const busy = busyId === booking.id;

      const actionState = getActionState(booking);
      const showNegotiation = actionState.showNegotiation;
      const showAcceptReject = actionState.showAcceptReject;

      const distance = getDistance(booking);
      const requestedAt = getRequestedAt(booking);
      const expiresAt = getExpiresAt(booking);
      const expired = isOfferExpired(booking);

      return (
        <Pressable
          onPress={() => openBooking(booking)}
          onHoverIn={() => setHoveredId(booking.id)}
          onHoverOut={() => setHoveredId(null)}
          style={[
            styles.tableRow,
            hoveredId === booking.id && styles.tableRowHover,
          ]}
        >
          <View style={styles.colClient}>
            <View style={styles.webClient}>
              <ClientAvatar
                photoUrl={getClientPhoto(booking)}
                name={getClientName(booking)}
                size={38}
                isOnline={getClientOnline(booking)}
              />
              <View style={styles.webClientInfo}>
                <Text style={styles.webClientName} numberOfLines={1}>
                  {getClientName(booking)}
                </Text>
                <Text style={styles.webBookingId}>#{booking.id}</Text>
              </View>
            </View>
          </View>

          <View style={styles.colContact}>
            {getPhone(booking) ? (
              <View style={styles.webContactLine}>
                <Ionicons
                  name="call-outline"
                  size={11}
                  color={colors.textSecondary}
                />
                <Text style={styles.tableSubText} numberOfLines={1}>
                  {getPhone(booking)}
                </Text>
              </View>
            ) : null}
            {getEmail(booking) ? (
              <View style={styles.webContactLine}>
                <Ionicons
                  name="mail-outline"
                  size={11}
                  color={colors.textSecondary}
                />
                <Text style={styles.tableSubText} numberOfLines={1}>
                  {getEmail(booking)}
                </Text>
              </View>
            ) : null}
            {!getPhone(booking) && !getEmail(booking) ? (
              <Text style={styles.tableSubText}>—</Text>
            ) : null}
          </View>

          <View style={styles.colMassage}>
            <Text style={styles.tableMainText} numberOfLines={1}>
              {getMassageName(booking)}
            </Text>
            {getCategory(booking) ? (
              <Text style={styles.tableSubText}>{getCategory(booking)}</Text>
            ) : null}
          </View>

          <View style={styles.colTravel}>
            <Text style={styles.tableMainText}>
              {distance !== null ? `${distance.toFixed(1)} km` : '—'}
            </Text>
          </View>

          <View style={styles.colDuration}>
            <Text style={styles.tableMainText}>
              {getDuration(booking)} min
            </Text>
          </View>

          <View style={styles.colAddress}>
            <View style={styles.webAddress}>
              <Ionicons
                name="location-outline"
                size={14}
                color={COLORS.primary}
              />
              <Text style={styles.tableAddress} numberOfLines={2}>
                {getAddress(booking)}
              </Text>
            </View>
          </View>

          <View style={styles.colDates}>
            {requestedAt ? (
              <View style={styles.webContactLine}>
                <Ionicons
                  name="paper-plane-outline"
                  size={11}
                  color={colors.textSecondary}
                />
                <Text style={styles.tableSubText} numberOfLines={1}>
                  {formatDate(requestedAt)}
                </Text>
              </View>
            ) : null}
            {expiresAt ? (
              <View style={styles.webContactLine}>
                <Ionicons
                  name="hourglass-outline"
                  size={11}
                  color={expired ? COLORS.red : COLORS.orange}
                />
                <Text
                  style={[
                    styles.tableSubText,
                    expired && { color: COLORS.red, fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {formatDate(expiresAt)}
                </Text>
              </View>
            ) : null}
            {!requestedAt && !expiresAt ? (
              <Text style={styles.tableSubText}>—</Text>
            ) : null}
          </View>

          <View style={styles.colPrice}>
            <Text style={styles.tablePrice}>
              {formatPrice(getPrice(booking))}
            </Text>
          </View>

          <View style={styles.colStatus}>
            <View
              style={[
                styles.tableStatus,
                { backgroundColor: statusUI.background },
              ]}
            >
              <Ionicons
                name={statusUI.icon}
                size={13}
                color={statusUI.color}
              />
              <Text
                style={[styles.tableStatusText, { color: statusUI.color }]}
              >
                {statusUI.label}
              </Text>
            </View>
          </View>

          <View style={styles.colActions}>
            <Pressable
              style={[
                styles.tableToggle,
                (showNegotiation || showAcceptReject)
                  ? styles.tableToggleActive
                  : {
                      backgroundColor: statusUI.background,
                      borderColor: statusUI.background,
                    },
                busy && styles.disabled,
              ]}
              onPress={event => {
                event?.stopPropagation?.();
                setActionSheetBooking(booking);
              }}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons
                  name={
                    showNegotiation || showAcceptReject
                      ? 'options-outline'
                      : statusUI.icon
                  }
                  size={17}
                  color={
                    showNegotiation || showAcceptReject
                      ? COLORS.primary
                      : statusUI.color
                  }
                />
              )}
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [
      busyId,
      hoveredId,
      openBooking,
      isDark,
      colors,
      getActionState,
    ]
  );

  // ==========================================================
  // TOP (search + dates + tabs)
  // ==========================================================

  const renderTop = () => (
    <View style={styles.topContainer}>
      <View style={[styles.searchRow, isWeb && styles.searchRowWeb]}>
        <View style={styles.searchInputWrap}>
          <Ionicons
            name="search-outline"
            size={17}
            color={colors.textSecondary}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un client, une adresse..."
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
          ) : null}
        </View>

        {isWeb ? (
          <View style={styles.webInlineDateRow}>
            <View style={styles.webInlineDateWrap}>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={COLORS.primary}
              />
              <Text style={styles.webInlineDateLabel}>Du</Text>
              <input
                type="date"
                value={dateFrom ? formatDateOnly(dateFrom) : ''}
                max={dateTo ? formatDateOnly(dateTo) : undefined}
                onChange={event => {
                  const value = event.target.value;
                  if (!value) {
                    setDateFrom(null);
                    return;
                  }
                  const parts = value.split('-').map(Number);
                  const selected = new Date(
                    parts[0],
                    parts[1] - 1,
                    parts[2]
                  );
                  setDateFrom(selected);
                  if (
                    dateTo &&
                    formatDateOnly(selected) > formatDateOnly(dateTo)
                  ) {
                    setDateTo(selected);
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 38,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: colors.text,
                  fontSize: 12,
                }}
              />
            </View>

            <View style={styles.webInlineDateWrap}>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={COLORS.primary}
              />
              <Text style={styles.webInlineDateLabel}>Au</Text>
              <input
                type="date"
                value={dateTo ? formatDateOnly(dateTo) : ''}
                min={dateFrom ? formatDateOnly(dateFrom) : undefined}
                onChange={event => {
                  const value = event.target.value;
                  if (!value) {
                    setDateTo(null);
                    return;
                  }
                  const parts = value.split('-').map(Number);
                  const selected = new Date(
                    parts[0],
                    parts[1] - 1,
                    parts[2]
                  );
                  setDateTo(selected);
                  if (dateFrom && selected.getTime() < dateFrom.getTime()) {
                    setDateFrom(selected);
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 38,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: colors.text,
                  fontSize: 12,
                }}
              />
            </View>

            {dateFrom || dateTo ? (
              <Pressable
                onPress={() => {
                  setDateFrom(null);
                  setDateTo(null);
                }}
                hitSlop={8}
                style={styles.webInlineDateClear}
                accessibilityRole="button"
                accessibilityLabel="Effacer le filtre de dates"
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => setShowDateModal(true)}
            style={[
              styles.calendarFilterButton,
              (dateFrom || dateTo) && styles.calendarFilterButtonActive,
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={19}
              color={
                dateFrom || dateTo ? COLORS.white : COLORS.primary
              }
            />
            {dateFrom || dateTo ? (
              <View style={styles.calendarFilterDot} />
            ) : null}
          </Pressable>
        )}
      </View>

      {!isWeb && (dateFrom || dateTo) ? (
        <Pressable
          style={styles.dateFilterSummary}
          onPress={() => setShowDateModal(true)}
        >
          <Ionicons name="funnel-outline" size={14} color={COLORS.primary} />
          <Text style={styles.dateFilterSummaryText}>
            {dateFrom ? formatDateLabel(dateFrom) : 'Toutes les dates'}
            {'  →  '}
            {dateTo ? formatDateLabel(dateTo) : 'Toutes les dates'}
          </Text>
          <Pressable
            onPress={() => {
              setDateFrom(null);
              setDateTo(null);
            }}
            hitSlop={8}
          >
            <Ionicons
              name="close-circle-outline"
              size={16}
              color={COLORS.red}
            />
          </Pressable>
        </Pressable>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        <TabButton
          label="Toutes"
          count={counts.all}
          active={activeTab === 'all'}
          onPress={() => setActiveTab('all')}
        />
        <TabButton
          label="En attente"
          count={counts.pending}
          active={activeTab === 'pending'}
          onPress={() => setActiveTab('pending')}
        />
        <TabButton
          label="Négociation"
          count={counts.negotiating}
          active={activeTab === 'negotiating'}
          onPress={() => setActiveTab('negotiating')}
        />
        <TabButton
          label="Confirmées"
          count={counts.confirmed}
          active={activeTab === 'confirmed'}
          onPress={() => setActiveTab('confirmed')}
        />
        <TabButton
          label="En cours"
          count={counts.in_progress}
          active={activeTab === 'in_progress'}
          onPress={() => setActiveTab('in_progress')}
        />
        <TabButton
          label="Terminées"
          count={counts.completed}
          active={activeTab === 'completed'}
          onPress={() => setActiveTab('completed')}
        />
        <TabButton
          label="Annulées"
          count={counts.cancelled}
          active={activeTab === 'cancelled'}
          onPress={() => setActiveTab('cancelled')}
        />
        <TabButton
          label="Expirées"
          count={counts.expired}
          active={activeTab === 'expired'}
          onPress={() => setActiveTab('expired')}
        />
      </ScrollView>
    </View>
  );

  // ==========================================================
  // DATE MODAL
  // ==========================================================

  const renderDateModal = () => (
    <Modal
      visible={showDateModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowDateModal(false)}
    >
      <View style={styles.sheetOverlay}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowDateModal(false)}
        />
        <View
          style={[styles.dateSheet, { paddingBottom: sheetBottomPadding }]}
        >
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Filtrer par date</Text>
            <Pressable
              onPress={() => setShowDateModal(false)}
              hitSlop={8}
            >
              <Ionicons
                name="close"
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <View style={styles.dateFieldsRow}>
            <View style={styles.dateFieldWrap}>
              <Text style={styles.dateFieldLabel}>Du</Text>
              {isWeb ? (
                <View style={styles.webDateInputWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                  <input
                    type="date"
                    value={dateFrom ? formatDateOnly(dateFrom) : ''}
                    max={dateTo ? formatDateOnly(dateTo) : undefined}
                    onChange={event => {
                      const value = event.target.value;
                      if (!value) {
                        setDateFrom(null);
                        return;
                      }
                      const parts = value.split('-').map(Number);
                      const selected = new Date(
                        parts[0],
                        parts[1] - 1,
                        parts[2]
                      );
                      setDateFrom(selected);
                      if (
                        dateTo &&
                        formatDateOnly(selected) > formatDateOnly(dateTo)
                      ) {
                        setDateTo(selected);
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 40,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: colors.text,
                      fontSize: 13,
                    }}
                  />
                </View>
              ) : (
                <>
                  <Pressable
                    style={styles.nativeDateButton}
                    onPress={() => {
                      setShowToPicker(false);
                      setShowFromPicker(true);
                    }}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text
                      style={[
                        styles.nativeDateText,
                        !dateFrom && styles.nativeDatePlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {formatDateLabel(dateFrom)}
                    </Text>
                  </Pressable>

                  {showFromPicker ? (
                    <DateTimePicker
                      value={dateFrom || new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowFromPicker(false);
                        if (event?.type === 'dismissed') return;
                        if (selectedDate) {
                          setDateFrom(selectedDate);
                          if (
                            dateTo &&
                            selectedDate.getTime() > dateTo.getTime()
                          ) {
                            setDateTo(selectedDate);
                          }
                        }
                      }}
                    />
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.dateArrow}>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={colors.textSecondary}
              />
            </View>

            <View style={styles.dateFieldWrap}>
              <Text style={styles.dateFieldLabel}>Au</Text>
              {isWeb ? (
                <View style={styles.webDateInputWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                  <input
                    type="date"
                    value={dateTo ? formatDateOnly(dateTo) : ''}
                    min={dateFrom ? formatDateOnly(dateFrom) : undefined}
                    onChange={event => {
                      const value = event.target.value;
                      if (!value) {
                        setDateTo(null);
                        return;
                      }
                      const parts = value.split('-').map(Number);
                      const selected = new Date(
                        parts[0],
                        parts[1] - 1,
                        parts[2]
                      );
                      setDateTo(selected);
                      if (
                        dateFrom &&
                        selected.getTime() < dateFrom.getTime()
                      ) {
                        setDateFrom(selected);
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 40,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: colors.text,
                      fontSize: 13,
                    }}
                  />
                </View>
              ) : (
                <>
                  <Pressable
                    style={styles.nativeDateButton}
                    onPress={() => {
                      setShowFromPicker(false);
                      setShowToPicker(true);
                    }}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text
                      style={[
                        styles.nativeDateText,
                        !dateTo && styles.nativeDatePlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {formatDateLabel(dateTo)}
                    </Text>
                  </Pressable>

                  {showToPicker ? (
                    <DateTimePicker
                      value={dateTo || dateFrom || new Date()}
                      mode="date"
                      display="default"
                      minimumDate={dateFrom || undefined}
                      onChange={(event, selectedDate) => {
                        setShowToPicker(false);
                        if (event?.type === 'dismissed') return;
                        if (selectedDate) {
                          setDateTo(selectedDate);
                          if (
                            dateFrom &&
                            selectedDate.getTime() < dateFrom.getTime()
                          ) {
                            setDateFrom(selectedDate);
                          }
                        }
                      }}
                    />
                  ) : null}
                </>
              )}
            </View>
          </View>

          <View style={styles.dateSheetButtonsRow}>
            <Pressable
              style={styles.dateSheetClearButton}
              onPress={() => {
                setDateFrom(null);
                setDateTo(null);
                setShowFromPicker(false);
                setShowToPicker(false);
              }}
            >
              <Ionicons
                name="close-circle-outline"
                size={16}
                color={COLORS.red}
              />
              <Text style={styles.dateSheetClearText}>Effacer</Text>
            </Pressable>

            <Pressable
              style={styles.dateSheetApplyButton}
              onPress={() => setShowDateModal(false)}
            >
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
              <Text style={styles.dateSheetApplyText}>Appliquer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ==========================================================
  // ACTIONS SHEET
  // ==========================================================

  const renderActionsSheet = () => {
    if (!actionSheetBooking) return null;

    const booking = actionSheetBooking;
    const statusUI = getStatusUI(booking, isDark);
    const actionState = getActionState(booking);
    const busy = busyId === booking.id;
    const hasActions =
      actionState.showNegotiation || actionState.showAcceptReject;

    return (
      <Modal
        visible={!!actionSheetBooking}
        transparent
        animationType="slide"
        onRequestClose={() => setActionSheetBooking(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setActionSheetBooking(null)}
          />
          <View
            style={[styles.actionsSheet, { paddingBottom: sheetBottomPadding }]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {getClientName(booking)}
                </Text>
                <Text style={styles.actionsSheetSubtitle}>
                  Réservation #{booking.id}
                </Text>
              </View>
              <Pressable
                onPress={() => setActionSheetBooking(null)}
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {hasActions ? (
              <View style={styles.actionsRow}>
                {actionState.showAcceptReject && (
                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.acceptButton,
                      busy && styles.disabled,
                    ]}
                    disabled={busy}
                    onPress={() => {
                      setActionSheetBooking(null);
                      handleAccept(booking);
                    }}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={COLORS.white}
                        />
                        <Text style={styles.acceptButtonText}>Accepter</Text>
                      </>
                    )}
                  </Pressable>
                )}

                {actionState.showNegotiation && (
                  <Pressable
                    style={[styles.actionButton, styles.negotiationButton]}
                    onPress={() => {
                      setActionSheetBooking(null);
                      handleNegotiation(booking);
                    }}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.negotiationText}>Négociation</Text>
                  </Pressable>
                )}

                {actionState.showAcceptReject && (
                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.rejectButton,
                      busy && styles.disabled,
                    ]}
                    disabled={busy}
                    onPress={() => {
                      setActionSheetBooking(null);
                      handleReject(booking);
                    }}
                  >
                    <Ionicons name="close" size={18} color={COLORS.red} />
                    <Text style={styles.rejectText}>Refuser</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View
                style={[
                  styles.confirmedRow,
                  { backgroundColor: statusUI.background },
                ]}
              >
                <Ionicons
                  name={statusUI.icon}
                  size={18}
                  color={statusUI.color}
                />
                <Text
                  style={[
                    styles.confirmedRowText,
                    { color: statusUI.color },
                  ]}
                >
                  {statusUI.label}
                </Text>
              </View>
            )}

            <Pressable
              style={styles.actionsSheetDetail}
              onPress={() => {
                setActionSheetBooking(null);
                openBooking(booking);
              }}
            >
              <Ionicons
                name="eye-outline"
                size={15}
                color={colors.textSecondary}
              />
              <Text style={styles.actionsSheetDetailText}>
                Voir les détails
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  };

  // ==========================================================
  // EMPTY / ERROR
  // ==========================================================

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name="file-tray-outline"
          size={36}
          color={COLORS.primary}
        />
      </View>
      <Text style={styles.emptyTitle}>Aucune réservation</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'pending'
          ? 'Aucune demande en attente.'
          : activeTab === 'negotiating'
          ? 'Aucune négociation en cours.'
          : activeTab === 'confirmed'
          ? 'Aucune réservation confirmée.'
          : activeTab === 'in_progress'
          ? 'Aucune réservation en cours.'
          : activeTab === 'completed'
          ? 'Aucune réservation terminée.'
          : activeTab === 'cancelled'
          ? 'Aucune réservation annulée.'
          : activeTab === 'expired'
          ? 'Aucune réservation expirée.'
          : 'Aucune réservation disponible.'}
      </Text>
      <Pressable style={styles.emptyRefresh} onPress={handleRefresh}>
        <Ionicons name="refresh-outline" size={17} color={COLORS.white} />
        <Text style={styles.emptyRefreshText}>Actualiser</Text>
      </Pressable>
    </View>
  );

  const renderError = () => {
    if (!error) return null;
    return (
      <View style={styles.errorBox}>
        <Ionicons name="warning-outline" size={20} color={COLORS.red} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => loadBookings(true)}>
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  };

  // ==========================================================
  // RENDER — WEB
  // ==========================================================

  if (isWeb && !isMobile) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={['left', 'right', 'bottom']}
      >
        <View style={styles.screen}>
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle="light-content"
          />

          <Header
            title="Réservation"
            showBack
            onBackPress={() => navigation.goBack()}
          />

          <Toast toast={toast} />

          <ConfirmationModal
            visible={!!confirmModal}
            title={confirmModal?.title}
            message={confirmModal?.message}
            confirmLabel={confirmModal?.confirmLabel}
            destructive={confirmModal?.destructive}
            onCancel={() => setConfirmModal(null)}
            onConfirm={confirmModal?.onConfirm}
          />

          {renderDateModal()}
          {renderActionsSheet()}

          <View style={styles.webContentWrap}>
            {renderTop()}
            {renderError()}

            <View style={styles.webTableContainer}>
              {renderWebHeader()}

              {loading && bookings.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Chargement...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredBookings}
                  keyExtractor={item => String(item.id)}
                  renderItem={renderWebRow}
                  ListEmptyComponent={renderEmpty}
                  contentContainerStyle={
                    filteredBookings.length === 0
                      ? styles.listEmptyContent
                      : undefined
                  }
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={handleRefresh}
                      tintColor={COLORS.primary}
                    />
                  }
                  showsVerticalScrollIndicator
                />
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // RENDER — MOBILE
  // ==========================================================

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.screen}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />

        <Header
          title="Réservation"
          showBack
          onBackPress={() => navigation.goBack()}
        />

        <Toast toast={toast} />

        <ConfirmationModal
          visible={!!confirmModal}
          title={confirmModal?.title}
          message={confirmModal?.message}
          confirmLabel={confirmModal?.confirmLabel}
          destructive={confirmModal?.destructive}
          onCancel={() => setConfirmModal(null)}
          onConfirm={confirmModal?.onConfirm}
        />

        {renderDateModal()}
        {renderActionsSheet()}
        {renderTop()}
        {renderError()}

        {loading && bookings.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredBookings}
            keyExtractor={item => String(item.id)}
            renderItem={renderMobileCard}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={
              filteredBookings.length === 0
                ? styles.listEmptyContent
                : styles.mobileList
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const createStyles = (colors, isDark) => {
  const primarySoft = isDark ? '#132A1E' : COLORS.primarySoft;
  const redSoft = isDark ? '#3A1717' : COLORS.redSoft;
  const avatarBg = isDark ? '#16301F' : COLORS.avatar;
  const hoverBg = isDark ? '#16301F' : COLORS.hover;
  const tableHeaderBg = isDark ? colors.surfaceLight : COLORS.tableHeader;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },

    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    webContentWrap: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 0,
      gap: 0,
    },

    // ========================================================
    // TOP
    // ========================================================

    topContainer: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      ...Platform.select({
        web: {
          borderWidth: 0,
          borderBottomWidth: 1,
          borderColor: colors.border,
          borderRadius: 0,
          paddingHorizontal: 20,
          paddingVertical: 14,
        },
        default: {},
      }),
    },

    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },

    searchRowWeb: {
      flexWrap: 'wrap',
      rowGap: 8,
    },

    webInlineDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },

    webInlineDateWrap: {
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    webInlineDateLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
    },

    webInlineDateClear: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },

    searchInputWrap: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      ...Platform.select({
        web: { minWidth: 220 },
        default: {},
      }),
    },

    searchInput: {
      flex: 1,
      minWidth: 0,
      height: 42,
      fontSize: 13,
      color: colors.text,
      ...Platform.select({
        web: { outlineStyle: 'none' },
        default: {},
      }),
    },

    calendarFilterButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },

    calendarFilterButtonActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },

    calendarFilterDot: {
      position: 'absolute',
      top: 7,
      right: 7,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.white,
      borderWidth: 1,
      borderColor: COLORS.primary,
    },

    dateFilterSummary: {
      marginBottom: 10,
      minHeight: 34,
      paddingHorizontal: 10,
      borderRadius: 9,
      backgroundColor: primarySoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    dateFilterSummaryText: {
      flex: 1,
      fontSize: 9,
      fontWeight: '700',
      color: COLORS.primaryDark,
    },

    // ========================================================
    // BOTTOM SHEETS
    // ========================================================

    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },

    sheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },

    sheetHandle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      marginBottom: 14,
    },

    sheetHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },

    sheetTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.text,
    },

    dateSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 24,
    },

    dateSheetButtonsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
    },

    dateSheetClearButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: redSoft,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },

    dateSheetClearText: {
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.red,
    },

    dateSheetApplyButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: COLORS.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },

    dateSheetApplyText: {
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.white,
    },

    actionsSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 28,
    },

    actionsSheetSubtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
    },

    actionsSheetDetail: {
      marginTop: 14,
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceLight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },

    actionsSheetDetailText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },

    // ========================================================
    // KEBAB / TOGGLE
    // ========================================================

    kebabButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      marginLeft: 6,
      flexShrink: 0,
      borderWidth: 0,
    },

    tableToggle: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: primarySoft,
    },

    tableToggleActive: {
      backgroundColor: primarySoft,
      borderColor: COLORS.primary,
    },

    // ========================================================
    // DATE FIELDS
    // ========================================================

    dateFieldsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      width: '100%',
    },

    dateFieldWrap: {
      flex: 1,
      minWidth: 0,
    },

    dateFieldLabel: {
      marginBottom: 6,
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
    },

    webDateInputWrap: {
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      overflow: 'hidden',
    },

    nativeDateButton: {
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },

    nativeDateText: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },

    nativeDatePlaceholder: {
      color: colors.textSecondary,
      fontWeight: '600',
    },

    dateArrow: {
      width: 30,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 12,
    },

    // ========================================================
    // TABS
    // ========================================================

    tabsContent: {
      gap: 8,
      paddingVertical: 2,
      paddingRight: 6,
    },

    tab: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },

    tabActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },

    tabText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },

    tabTextActive: {
      color: COLORS.white,
    },

    tabCount: {
      minWidth: 22,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },

    tabCountActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },

    tabCountText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
    },

    tabCountTextActive: {
      color: COLORS.white,
    },

    // ========================================================
    // ERROR / LOADING / EMPTY
    // ========================================================

    errorBox: {
      marginHorizontal: 18,
      marginTop: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#5C2B2B' : '#F1C4C4',
      backgroundColor: redSoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    errorText: {
      flex: 1,
      fontSize: 12,
      color: COLORS.red,
    },

    retryText: {
      fontSize: 12,
      fontWeight: '800',
      color: COLORS.primary,
    },

    loadingContainer: {
      flex: 1,
      minHeight: 250,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },

    loadingText: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    listEmptyContent: {
      flexGrow: 1,
    },

    emptyContainer: {
      flex: 1,
      minHeight: 260,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 25,
    },

    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },

    emptyTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 6,
    },

    emptyText: {
      fontSize: 12.5,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 340,
      lineHeight: 18,
    },

    emptyRefresh: {
      marginTop: 16,
      minHeight: 42,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: COLORS.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },

    emptyRefreshText: {
      color: COLORS.white,
      fontSize: 12.5,
      fontWeight: '700',
    },

    // ========================================================
    // MOBILE CARD
    // ========================================================

    mobileList: {
      padding: 14,
      paddingBottom: 32,
    },

    mobileCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 13,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    cardHover: {
      borderColor: COLORS.primary,
      backgroundColor: hoverBg,
    },

    mobileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },

    avatarFrame: {
      position: 'relative',
      flexShrink: 0,
      marginRight: 11,
      backgroundColor: avatarBg,
      borderWidth: 2,
      borderColor: colors.card,
      overflow: 'visible',
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
    },

    avatar: {
      width: '100%',
      height: '100%',
      backgroundColor: avatarBg,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },

    avatarText: {
      fontWeight: '800',
      color: COLORS.primary,
    },

    avatarImage: {
      backgroundColor: avatarBg,
    },

    clientInfo: {
      flex: 1,
      minWidth: 0,
    },

    clientNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },

    clientName: {
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '800',
      color: colors.text,
      flexShrink: 1,
    },

    metaLine: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSecondary,
    },

    expiryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: isDark ? '#332912' : COLORS.orangeSoft,
      alignSelf: 'flex-start',
    },

    expiryLine: {
      fontSize: 10.5,
      fontWeight: '700',
      color: COLORS.orange,
    },

    expiryLineUrgent: {
      color: COLORS.red,
    },

    webContactLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 2,
    },

    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      flexShrink: 0,
      marginRight: 4,
    },

    statusText: {
      fontSize: 9.5,
      fontWeight: '800',
    },

    compactInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 7,
      marginBottom: 8,
    },

    compactInfoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
      minWidth: 0,
    },

    compactInfoDivider: {
      width: 1,
      height: 11,
      backgroundColor: colors.border,
    },

    compactInfoText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },

    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 9,
      borderRadius: 10,
      backgroundColor: isDark ? '#1B2A22' : '#F6FAF7',
      marginBottom: 8,
    },

    address: {
      flex: 1,
      fontSize: 11.5,
      lineHeight: 15,
      color: colors.textSecondary,
    },

    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    dateText: {
      fontSize: 11,
      color: colors.textSecondary,
    },

    footerRow: {
      paddingTop: 9,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },

    footerDateBlock: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },

    price: {
      fontSize: 17,
      fontWeight: '900',
      color: COLORS.primary,
      letterSpacing: -0.2,
    },

    confirmedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: primarySoft,
      flexShrink: 0,
    },

    confirmedText: {
      fontSize: 10.5,
      fontWeight: '800',
      color: COLORS.primary,
    },

    actionHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: primarySoft,
      flexShrink: 0,
    },

    actionHintText: {
      fontSize: 10,
      fontWeight: '800',
      color: COLORS.primary,
    },

    // ========================================================
    // ACTIONS (bottom sheet)
    // ========================================================

    actionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    actionButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      borderWidth: 1,
    },

    acceptButton: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },

    acceptButtonText: {
      color: COLORS.white,
      fontSize: 12.5,
      fontWeight: '800',
    },

    negotiationButton: {
      backgroundColor: primarySoft,
      borderColor: COLORS.primary,
    },

    negotiationText: {
      color: COLORS.primary,
      fontSize: 12.5,
      fontWeight: '800',
    },

    rejectButton: {
      backgroundColor: redSoft,
      borderColor: isDark ? '#5C2B2B' : '#F0CACA',
    },

    rejectText: {
      color: COLORS.red,
      fontSize: 12.5,
      fontWeight: '800',
    },

    confirmedRow: {
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: primarySoft,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },

    confirmedRowText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: COLORS.primary,
    },

    disabled: {
      opacity: 0.55,
    },

    pressed: {
      opacity: 0.75,
    },

    // ========================================================
    // WEB TABLE
    // ========================================================

    webTableContainer: {
      flex: 1,
      width: '100%',
      backgroundColor: colors.card,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          borderRadius: 0,
          borderWidth: 0,
          borderTopWidth: 1,
          borderColor: colors.border,
        },
        default: {},
      }),
    },

    tableHeader: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: tableHeaderBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: 'sticky',
      top: 0,
      zIndex: 10,
    },

    tableHeaderText: {
      fontSize: 9.5,
      fontWeight: '900',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },

    tableRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    tableRowHover: {
      backgroundColor: hoverBg,
    },

    colClient: {
      width: '15%',
      paddingHorizontal: 12,
    },

    colContact: {
      width: '12%',
      paddingHorizontal: 8,
    },

    colMassage: {
      width: '10%',
      paddingHorizontal: 8,
    },

    colTravel: {
      width: '6%',
      paddingHorizontal: 6,
    },

    colDuration: {
      width: '6%',
      paddingHorizontal: 6,
    },

    colAddress: {
      width: '13%',
      paddingHorizontal: 8,
    },

    colDates: {
      width: '13%',
      paddingHorizontal: 8,
    },

    colPrice: {
      width: '8%',
      paddingHorizontal: 6,
    },

    colStatus: {
      width: '8%',
      paddingHorizontal: 6,
    },

    colActions: {
      width: '9%',
      paddingHorizontal: 6,
    },

    webClient: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    onlineIndicator: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 5,
    },

    onlineIndicatorInner: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: COLORS.green,
      borderWidth: 1,
      borderColor: COLORS.greenDark,
    },

    webClientInfo: {
      flex: 1,
      minWidth: 0,
    },

    webClientName: {
      fontSize: 11.5,
      fontWeight: '800',
      color: colors.text,
    },

    webBookingId: {
      fontSize: 9.5,
      color: colors.textSecondary,
      marginTop: 2,
    },

    tableMainText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.text,
    },

    tableSubText: {
      fontSize: 9.5,
      color: colors.textSecondary,
      marginTop: 2,
    },

    webAddress: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 4,
    },

    tableAddress: {
      flex: 1,
      fontSize: 9.5,
      lineHeight: 13,
      color: colors.textSecondary,
    },

    tablePrice: {
      fontSize: 11.5,
      fontWeight: '900',
      color: COLORS.primary,
    },

    tableStatus: {
      minHeight: 28,
      paddingHorizontal: 8,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      alignSelf: 'flex-start',
    },

    tableStatusText: {
      fontSize: 9.5,
      fontWeight: '800',
    },
  });
};