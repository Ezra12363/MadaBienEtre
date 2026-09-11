// ============================================================
// MADA BIEN-ÊTRE
// THERAPIST - OFFERS / DEMANDES
//
// FIX COMPLET:
//
// 1. Affiche ny status Booking REHETRA (araka ny liste
//    "officiel" ampiasain'ny /admin/bookings-count) :
//    - pending                 => En attente
//    - negotiating             => Négociation
//    - confirmed               => Confirmée
//    - in_progress             => En cours
//    - completed               => Terminée
//    - cancelled_by_client     => Annulée (client)
//    - cancelled_by_therapist  => Annulée (moi)
//    - expired                 => Expirée
//
//    (+ variantes orthographe/anglais toleré: negociation,
//    accepted, confirme, cancelled, canceled, terminee, sns.
//    — jereo normalizeStatus() etsy ambany)
//
// 2. GET /bookings/available
// 3. GET /bookings
//    => permet de récupérer aussi les réservations confirmées,
//       en cours, terminées, annulées et expirées
//
// 4. ACCEPT:
//    GET  /offers/booking/{booking_id}
//    POST /offers/{offer_id}/accept
//
// 5. NEGOTIATION:
//    navigation vers NegotiationScreen
//
// 6. Après ACCEPT:
//    booking reste dans la liste avec status = confirmed
//
// 7. WEB:
//    tableau pleine largeur
//    header sticky
//
// 8. ANDROID:
//    cards responsive
//
// 9. UI:
//    - photo client carrée avec coins arrondis + bordure
//    - point vert en ligne sur la photo
//    - barre de recherche supprimée
//    - filtre par plage de dates "Du / Au" (sans titre/sous-titre)
//    - sélection des dates Web + Android/iOS
// ============================================================

import React, {
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
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import {
  useFocusEffect,
} from '@react-navigation/native';

import bookingService from '../../services/bookingService';
import offerService from '../../services/offerService';

// ============================================================
// ANDROID STATUS BAR
//
// Amin'ny Android, ny SafeAreaView irery dia tsy manisy
// "inset" eo amin'ny ambony (tsy tahaka ny iOS), ka ny header
// dia mety "hilentika" ao ambanin'ny status bar / icone
// batterie. Ampiasaina eto ny StatusBar.currentHeight mba
// hanomezana toerana marina ny header.
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
  primarySoft: '#EAF6EF',

  white: '#FFFFFF',
  black: '#202020',

  background: '#F5F6F5',
  card: '#FFFFFF',

  text: '#303030',
  textSecondary: '#777777',
  textLight: '#999999',

  border: '#E1E4E2',
  divider: '#D9D9D9',

  red: '#D93636',
  redSoft: '#FFF2F2',

  orange: '#F59E0B',
  orangeSoft: '#FFF7E5',

  blue: '#3B82F6',
  blueSoft: '#EFF6FF',

  avatar: '#E5F1E9',

  tableHeader: '#F7F9F8',
  hover: '#F2F8F4',
};

const AUTO_REFRESH_MS = 15000;

// ============================================================
// SCREEN HEADER (bouton retour + titre "Réservations" au
// centre) — tsy hilentika ao ambanin'ny status bar Android.
// ============================================================

function ScreenHeader({ title, onBack }) {
  return (
    <View
      style={[
        screenHeaderStyles.container,
        {
          paddingTop:
            ANDROID_STATUS_BAR_HEIGHT + 12,
        },
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.white}
        translucent={false}
      />

      <TouchableOpacity
        onPress={onBack}
        activeOpacity={0.75}
        hitSlop={{
          top: 10,
          bottom: 10,
          left: 10,
          right: 10,
        }}
        style={screenHeaderStyles.backButton}
      >
        <Ionicons
          name="arrow-back"
          size={22}
          color={COLORS.black}
        />
      </TouchableOpacity>

      <View style={screenHeaderStyles.titleWrap}>
        <Text
          style={screenHeaderStyles.titleText}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      {/* Espace fantôme à droite pour garder le titre
          parfaitement centré. */}
      <View style={screenHeaderStyles.rightSpace} />
    </View>
  );
}

const screenHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 14,
    backgroundColor: COLORS.white,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F3',
  },

  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: 0.3,
  },

  rightSpace: {
    width: 40,
    height: 40,
  },
});

// ============================================================
// TOAST (notification légère en haut de l'écran)
// ============================================================

function Toast({ toast }) {
  if (!toast) {
    return null;
  }

  return (
    <View
      style={[
        toastStyles.container,
        toast.type === 'success'
          ? toastStyles.success
          : toastStyles.error,
      ]}
    >
      <Ionicons
        name={
          toast.type === 'success'
            ? 'checkmark-circle'
            : 'alert-circle'
        }
        size={18}
        color={COLORS.white}
      />

      <Text style={toastStyles.text}>
        {toast.message}
      </Text>
    </View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top:
      ANDROID_STATUS_BAR_HEIGHT + 78,
    left: 14,
    right: 14,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,

    ...Platform.select({
      web: {
        boxShadow:
          '0 6px 20px rgba(0,0,0,0.18)',
      },
      default: {
        elevation: 6,
      },
    }),
  },

  success: {
    backgroundColor: '#2E8B57',
  },

  error: {
    backgroundColor: COLORS.red,
  },

  text: {
    flex: 1,
    fontSize: 12,
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
  if (!visible) return null;

  return (
    <View style={confirmationStyles.overlay}>
      <Pressable style={confirmationStyles.backdrop} onPress={onCancel} />
      <View style={confirmationStyles.modal}>
        <View style={[
          confirmationStyles.iconCircle,
          destructive && { backgroundColor: '#FFF0F0' },
        ]}>
          <Ionicons
            name={destructive ? 'warning-outline' : 'help-circle-outline'}
            size={25}
            color={destructive ? COLORS.red : COLORS.primary}
          />
        </View>
        <Text style={confirmationStyles.title}>{title}</Text>
        <Text style={confirmationStyles.message}>{message}</Text>
        <View style={confirmationStyles.buttons}>
          <Pressable style={confirmationStyles.cancelButton} onPress={onCancel}>
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

const confirmationStyles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 5000, alignItems: 'center', justifyContent: 'center', padding: 22,
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  modal: {
    width: '100%', maxWidth: 430, backgroundColor: COLORS.white,
    borderRadius: 18, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EEF7F0', alignItems: 'center',
    justifyContent: 'center', alignSelf: 'center', marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.black, textAlign: 'center' },
  message: { marginTop: 8, fontSize: 13, lineHeight: 20, color: '#555555', textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelButton: {
    flex: 1, minHeight: 46, borderRadius: 11, backgroundColor: '#F1F2F1',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmButton: {
    flex: 1, minHeight: 46, borderRadius: 11, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmDanger: { backgroundColor: COLORS.red },
  cancelText: { color: '#333333', fontSize: 12, fontWeight: '800' },
  confirmText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
});

// ============================================================
// HELPERS
// ============================================================

const safeNumber = (
  value,
  fallback = 0
) => {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
};

// ============================================================
// ARRAY NORMALIZER
// ============================================================

// ============================================================
// MERGE BOOKING RECORDS
//
// Rehefa misy booking iray tafiditra ao amin'ny endpoint roa
// (ex: "/bookings/available" sy "/bookings"), dia ampiharina
// eto ny "fill the gaps" fa tsy "last write wins" tsotra —
// ny angona banga (null / undefined / '') amin'ny iray dia
// solohana amin'ny hafa raha misy sy feno izy io, mba tsy
// hisy contact/distance very tsy nahy noho ny fandaharana
// ny endpoint iray mialoha ny iray hafa.
// ============================================================

const isEmptyBookingValue = value =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'number' &&
    Number.isNaN(value));

const mergeClientObjects = (a, b) => {
  if (!a && !b) {
    return undefined;
  }

  if (!a) {
    return b;
  }

  if (!b) {
    return a;
  }

  const merged = { ...a };

  Object.keys(b).forEach(key => {
    if (
      isEmptyBookingValue(
        merged[key]
      ) &&
      !isEmptyBookingValue(b[key])
    ) {
      merged[key] = b[key];
    }
  });

  return merged;
};

const mergeBookingRecords = (base, extra) => {
  if (!base) {
    return extra;
  }

  if (!extra) {
    return base;
  }

  const merged = { ...base };

  Object.keys(extra).forEach(key => {
    if (key === 'client') {
      return;
    }

    if (
      isEmptyBookingValue(
        merged[key]
      ) &&
      !isEmptyBookingValue(extra[key])
    ) {
      merged[key] = extra[key];
    }
  });

  const mergedClient =
    mergeClientObjects(
      base.client,
      extra.client
    );

  if (mergedClient) {
    merged.client = mergedClient;
  }

  return merged;
};

const normalizeArray = value => {
  if (Array.isArray(value)) return value;

  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.bookings)) return value.bookings;
  if (Array.isArray(value?.offers)) return value.offers;
  if (Array.isArray(value?.results)) return value.results;

  if (Array.isArray(value?.data?.offers)) {
    return value.data.offers;
  }

  if (Array.isArray(value?.data?.items)) {
    return value.data.items;
  }

  return [];
};

// ============================================================
// STATUS NORMALIZATION
// ============================================================
//
// Important:
// Ny backend mety mampiasa:
//
// pending
// negotiating
// negotiation
// negociation
// in_negotiation
// confirmed
// accepted
// confirme
//
// Eto dia ataontsika status UI iray ihany.
// ============================================================

const normalizeStatus = booking => {
  const raw = String(
    booking?.status ??
    booking?.booking_status ??
    ''
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
  ) {
    return 'pending';
  }

  if (
    raw === 'negotiating' ||
    raw === 'negotiation' ||
    raw === 'negociation' ||
    raw === 'in_negotiation' ||
    raw === 'en_negociation' ||
    raw === 'en negotiation' ||
    raw === 'en negociation'
  ) {
    return 'negotiating';
  }

  if (
    raw === 'confirmed' ||
    raw === 'accepted' ||
    raw === 'confirm' ||
    raw === 'confirme' ||
    raw === 'acceptee' ||
    raw === 'accepted_by_client' ||
    raw === 'accepted_by_therapist'
  ) {
    return 'confirmed';
  }

  if (
    raw === 'in_progress' ||
    raw === 'inprogress' ||
    raw === 'en_cours' ||
    raw === 'en cours' ||
    raw === 'ongoing' ||
    raw === 'started'
  ) {
    return 'in_progress';
  }

  if (
    raw === 'completed' ||
    raw === 'complete' ||
    raw === 'terminee' ||
    raw === 'termine' ||
    raw === 'finished' ||
    raw === 'done'
  ) {
    return 'completed';
  }

  if (
    raw === 'cancelled_by_client' ||
    raw === 'canceled_by_client' ||
    raw === 'annulee_par_le_client' ||
    raw === 'annule_client'
  ) {
    return 'cancelled_by_client';
  }

  if (
    raw === 'cancelled_by_therapist' ||
    raw === 'canceled_by_therapist' ||
    raw === 'annulee_par_le_therapeute' ||
    raw === 'annule_therapeute'
  ) {
    return 'cancelled_by_therapist';
  }

  if (
    raw === 'cancelled' ||
    raw === 'canceled' ||
    raw === 'annulee' ||
    raw === 'annule'
  ) {
    return 'cancelled_by_client';
  }

  if (
    raw === 'expired' ||
    raw === 'expiree' ||
    raw === 'expire' ||
    raw === 'timeout'
  ) {
    return 'expired';
  }

  return raw || 'pending';
};

// ============================================================
// DISPLAYED STATUS
//
// Ny mpampiasa dia mangataka fa ny status REHETRA misy ao
// amin'ny données (pending, negotiating, confirmed,
// in_progress, completed, cancelled_by_client,
// cancelled_by_therapist, expired) dia tokony haseho ao
// anaty tableau/cards, ka tsy misy sivana intsony eto.
// ============================================================

const ALL_STATUS_KEYS = [
  'pending',
  'negotiating',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled_by_client',
  'cancelled_by_therapist',
  'expired',
];

const isDisplayedBooking = () => true;

const isCancelledStatus = status =>
  status === 'cancelled_by_client' ||
  status === 'cancelled_by_therapist';

// ============================================================
// STATUS UI
// ============================================================

const getStatusUI = booking => {
  const status =
    normalizeStatus(booking);

  switch (status) {
    case 'pending':
      return {
        key: 'pending',
        label: 'En attente',
        color: COLORS.primary,
        background: COLORS.primarySoft,
        dot: COLORS.primary,
        icon: 'time-outline',
      };

    case 'negotiating':
      return {
        key: 'negotiating',
        label: 'Négociation',
        color: '#B26A00',
        background: COLORS.orangeSoft,
        dot: COLORS.orange,
        icon: 'chatbubbles-outline',
      };

    case 'confirmed':
      return {
        key: 'confirmed',
        label: 'Confirmée',
        color: COLORS.primary,
        background: COLORS.primarySoft,
        dot: COLORS.primary,
        icon: 'checkmark-circle-outline',
      };

    case 'in_progress':
      return {
        key: 'in_progress',
        label: 'En cours',
        color: '#5B3DE0',
        background: '#EEEAFB',
        dot: '#7B61FF',
        icon: 'walk-outline',
      };

    case 'completed':
      return {
        key: 'completed',
        label: 'Terminée',
        color: '#2E7D32',
        background: '#E7F3E8',
        dot: '#2E7D32',
        icon: 'checkmark-done-outline',
      };

    case 'cancelled_by_client':
      return {
        key: 'cancelled_by_client',
        label: 'Annulée (client)',
        color: COLORS.red,
        background: COLORS.redSoft,
        dot: COLORS.red,
        icon: 'close-circle-outline',
      };

    case 'cancelled_by_therapist':
      return {
        key: 'cancelled_by_therapist',
        label: 'Annulée (moi)',
        color: COLORS.red,
        background: COLORS.redSoft,
        dot: COLORS.red,
        icon: 'close-circle-outline',
      };

    case 'expired':
      return {
        key: 'expired',
        label: 'Expirée',
        color: COLORS.textSecondary,
        background: '#EFEFEF',
        dot: COLORS.textLight,
        icon: 'hourglass-outline',
      };

    default:
      return {
        key: 'pending',
        label: 'En attente',
        color: COLORS.primary,
        background: COLORS.primarySoft,
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

// ============================================================
// DEMANDE CLIENT / EXPIRATION
// ============================================================

const getRequestedAt = booking =>
  booking?.created_at ??
  booking?.createdAt ??
  null;

const getExpiresAt = booking =>
  booking?.expires_at ??
  booking?.expiresAt ??
  null;

const isOfferExpired = booking => {
  const value = getExpiresAt(booking);

  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

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
    booking?.distance_km ??
    booking?.distanceKm ??
    booking?.distance;

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const getEta = booking => {
  const value =
    booking?.eta_minutes ??
    booking?.etaMinutes ??
    booking?.eta;

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
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

const getScheduledTime = booking =>
  booking?.scheduled_time ??
  booking?.scheduledTime ??
  booking?.time ??
  null;

// ============================================================
// FORMAT PRICE
// ============================================================

const formatPrice = value => {
  const number = safeNumber(value);

  return `${number.toLocaleString(
    'fr-FR'
  )} Ar`;
};

// ============================================================
// FORMAT DATE
// ============================================================

const formatDate = value => {
  if (!value) {
    return '';
  }

  try {
    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return date.toLocaleString(
      'fr-FR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  } catch {
    return String(value);
  }
};

// ============================================================
// INITIAL
// ============================================================

const formatDateOnly = value => {
  if (!value) return '';

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');
  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getDateOnlyKey = value => {
  if (!value) return '';

  // Le backend renvoie généralement un ISO.
  // On conserve la partie date pour éviter les décalages
  // de fuseau lors du filtrage.
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    return value.slice(0, 10);
  }

  return formatDateOnly(value);
};

const formatDateLabel = value => {
  const key = getDateOnlyKey(value);

  if (!key) {
    return 'Choisir une date';
  }

  const parts = key
    .split('-')
    .map(Number);

  if (parts.length !== 3) {
    return 'Choisir une date';
  }

  const date = new Date(
    parts[0],
    parts[1] - 1,
    parts[2]
  );

  return date.toLocaleDateString(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  );
};

const getInitial = name => {
  const value = String(
    name || 'C'
  ).trim();

  return (
    value.charAt(0).toUpperCase() ||
    'C'
  );
};

// ============================================================
// OFFER HELPERS
// ============================================================

const getOfferId = offer =>
  offer?.id ??
  offer?.offer_id ??
  offer?.offerId ??
  null;

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
  ) {
    return 'therapist';
  }

  if (raw === 'client' || raw === 'customer') {
    return 'client';
  }

  return raw;
};

const getOfferStatus = offer =>
  String(
    offer?.status ?? ''
  )
    .trim()
    .toLowerCase();

const isClientOffer = offer =>
  getOfferType(offer) === 'client';

const ACTIVE_OFFER_STATUSES = new Set([
  'sent',
  'pending',
  'active',
  'negotiating',
]);

const isActiveClientOffer = offer =>
  isClientOffer(offer) &&
  ACTIVE_OFFER_STATUSES.has(getOfferStatus(offer));

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
    .sort(
      (a, b) =>
        getOfferSortValue(a) - getOfferSortValue(b)
    );

  return active.length
    ? active[active.length - 1]
    : null;
};

// ============================================================
// TAB
// ============================================================

function TabButton({
  label,
  count,
  active,
  onPress,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.tabText,
          active &&
            styles.tabTextActive,
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.tabCount,
          active &&
            styles.tabCountActive,
        ]}
      >
        <Text
          style={[
            styles.tabCountText,
            active &&
              styles.tabCountTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

// ============================================================
// CLIENT AVATAR (photo de profil ou initiale)
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
    return ['true', '1', 'yes', 'online'].includes(
      value.trim().toLowerCase()
    );
  }

  return value === true || value === 1;
}

function ClientAvatar({
  photoUrl,
  name,
  size = 52,
  isOnline = false,
}) {
  const [failed, setFailed] = useState(false);

  const showImage = !!photoUrl && !failed;

  const radius = Math.max(10, Math.round(size * 0.2));

  return (
    <View
      style={[
        styles.avatarFrame,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: photoUrl }}
          style={[
            styles.avatarImage,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
          ]}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`Photo de profil de ${name}`}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              {
                fontSize: size * 0.38,
              },
            ]}
          >
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
// MAIN
// ============================================================

export default function OffersScreen({
  navigation,
}) {
  const { width } =
    useWindowDimensions();

  const isWeb =
    Platform.OS === 'web';

  const isMobile =
    !isWeb || width < 850;

  const [bookings, setBookings] =
    useState([]);

  const [activeTab, setActiveTab] =
    useState('all');

  // Filtrage par plage de dates (date de la réservation)
  const [dateFrom, setDateFrom] =
    useState(null);

  const [dateTo, setDateTo] =
    useState(null);

  const [showFromPicker, setShowFromPicker] =
    useState(false);

  const [showToPicker, setShowToPicker] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [busyId, setBusyId] =
    useState(null);

  const [hoveredId, setHoveredId] =
    useState(null);

  const [confirmModal, setConfirmModal] = useState(null);

  // ==========================================================
  // LOAD BOOKINGS
  // ==========================================================
  //
  // IMPORTANT:
  //
  // Tsy /bookings/available irery intsony.
  //
  // /bookings/available
  // +
  // /bookings
  //
  // no ampiasaina mba tsy hanjavona rehefa confirmed.
  // ==========================================================

  const loadBookings =
    useCallback(
      async (
        showLoader = true
      ) => {
        try {
          if (showLoader) {
            setLoading(true);
          }

          setError('');

          console.log(
            '================================================'
          );

          console.log(
            '📥 [OFFERS SCREEN] CHARGEMENT DES BOOKINGS'
          );

          console.log(
            '================================================'
          );

          // --------------------------------------------------
          // 1. AVAILABLE BOOKINGS
          // --------------------------------------------------

          let available = [];

          try {
            const availableResult =
              await bookingService.getAvailableBookings(
                {
                  limit: 100,
                  ignore_distance: true,
                }
              );

            if (
              availableResult?.success
            ) {
              available =
                normalizeArray(
                  availableResult.data
                );
            }

            console.log(
              '📦 AVAILABLE:',
              available.length
            );
          } catch (availableError) {
            console.warn(
              '⚠️ AVAILABLE ERROR:',
              availableError
            );
          }

          // --------------------------------------------------
          // 2. ALL / THERAPIST BOOKINGS
          //
          // Io no ahafahana mahazo:
          // confirmed
          // negotiating
          // pending
          // --------------------------------------------------

          let allBookings = [];

          try {
            const allResult =
              await bookingService.getBookings(
                {}
              );

            if (
              allResult?.success
            ) {
              allBookings =
                normalizeArray(
                  allResult.data
                );
            }

            console.log(
              '📦 ALL BOOKINGS:',
              allBookings.length
            );
          } catch (allError) {
            console.warn(
              '⚠️ ALL BOOKINGS ERROR:',
              allError
            );
          }

          // --------------------------------------------------
          // 3. MERGE
          //
          // FIX: Ny Map.set() teo aloha dia "last write wins"
          // tsotra — raha ohatra ka misy booking iray tafiditra
          // ao amin'ny roa tonta (available + allBookings), dia
          // ny version farany (allBookings) irery no jerena, na
          // dia mety tsy feno (téléphone, email, distance) aza
          // izy noho ny antony ara-backend samihafa. Eto dia
          // ampiasaina ny "mergeBookingRecords" mba tsy hisy
          // angona very (contact, distance, sns.) — soloina
          // ihany ny field banga amin'ny iray, raha misy sy
          // feno ilay io amin'ny hafa.
          // --------------------------------------------------

          const mergedMap =
            new Map();

          [
            ...available,
            ...allBookings,
          ].forEach(booking => {
            const id =
              booking?.id ??
              booking?.booking_id ??
              booking?.bookingId;

            if (
              id === null ||
              id === undefined
            ) {
              return;
            }

            const key = String(id);

            const existing =
              mergedMap.get(key);

            mergedMap.set(
              key,
              mergeBookingRecords(
                existing,
                booking
              )
            );
          });

          // --------------------------------------------------
          // 4. FILTER ONLY REQUESTED STATUS
          // --------------------------------------------------

          const merged =
            Array.from(
              mergedMap.values()
            )
              .filter(
                isDisplayedBooking
              )
              .sort(
                (a, b) => {
                  const da =
                    new Date(
                      getScheduledDate(a) ||
                      a?.created_at ||
                      0
                    ).getTime();

                  const db =
                    new Date(
                      getScheduledDate(b) ||
                      b?.created_at ||
                      0
                    ).getTime();

                  return db - da;
                }
              );

          console.log(
            '📊 FINAL BOOKINGS:',
            merged.length
          );

          console.log(
            '📊 STATUS:',
            merged.map(
              item => ({
                id: item?.id,
                status:
                  normalizeStatus(item),
              })
            )
          );

          // --------------------------------------------------
          // 5. LOAD ACTIVE OFFERS FOR BUTTON VISIBILITY
          // --------------------------------------------------
          // La visibilité des boutons dépend de l'offre réellement
          // active, pas seulement du statut du booking.
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
                const offersResult =
                  await offerService.getOffersByBooking(booking.id);

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
                console.warn(
                  '⚠️ OFFERS VISIBILITY ERROR:',
                  booking.id,
                  offerError
                );

                // Sécurité : si les offres ne peuvent pas être
                // vérifiées, on n'affiche pas Accept/Refuser.
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
            setError(
              'Aucune réservation disponible.'
            );
          }
        } catch (loadError) {
          console.error(
            '❌ [OFFERS SCREEN] LOAD ERROR:',
            loadError
          );

          setError(
            loadError?.message ||
            'Impossible de charger les réservations.'
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  // ==========================================================
  // FOCUS
  // ==========================================================

  useFocusEffect(
    useCallback(() => {
      loadBookings(true);
    }, [loadBookings])
  );

  // ==========================================================
  // AUTO REFRESH
  // ==========================================================

  useEffect(() => {
    const interval =
      setInterval(() => {
        loadBookings(false);
      }, AUTO_REFRESH_MS);

    return () =>
      clearInterval(interval);
  }, [loadBookings]);

  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh =
    useCallback(() => {
      setRefreshing(true);
      loadBookings(false);
    }, [loadBookings]);

  // ==========================================================
  // TOAST
  // ==========================================================

  const [toast, setToast] =
    useState(null);

  const toastTimerRef = useRef(null);

  const showToast =
    useCallback(
      (type, message) => {
        if (toastTimerRef.current) {
          clearTimeout(
            toastTimerRef.current
          );
        }

        setToast({ type, message });

        toastTimerRef.current =
          setTimeout(() => {
            setToast(null);
          }, 3000);
      },
      []
    );

  // ==========================================================
  // COUNTS
  // ==========================================================

  const counts =
    useMemo(() => {
      return {
        all: bookings.length,

        pending:
          bookings.filter(
            item =>
              normalizeStatus(
                item
              ) === 'pending'
          ).length,

        negotiating:
          bookings.filter(
            item =>
              normalizeStatus(
                item
              ) === 'negotiating'
          ).length,

        confirmed:
          bookings.filter(
            item =>
              normalizeStatus(
                item
              ) === 'confirmed'
          ).length,

        in_progress:
          bookings.filter(
            item =>
              normalizeStatus(
                item
              ) === 'in_progress'
          ).length,

        completed:
          bookings.filter(
            item =>
              normalizeStatus(
                item
              ) === 'completed'
          ).length,

        cancelled:
          bookings.filter(item =>
            isCancelledStatus(
              normalizeStatus(item)
            )
          ).length,

        expired:
          bookings.filter(
            item =>
              normalizeStatus(
                item
              ) === 'expired'
          ).length,
      };
    }, [bookings]);

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredBookings =
    useMemo(() => {
      const fromKey = dateFrom
        ? formatDateOnly(dateFrom)
        : null;

      const toKey = dateTo
        ? formatDateOnly(dateTo)
        : null;

      return bookings.filter(
        booking => {
          const status =
            normalizeStatus(booking);

          // --------------------------
          // TAB
          // --------------------------

          if (
            activeTab === 'pending' &&
            status !== 'pending'
          ) {
            return false;
          }

          if (
            activeTab === 'negotiating' &&
            status !== 'negotiating'
          ) {
            return false;
          }

          if (
            activeTab === 'confirmed' &&
            status !== 'confirmed'
          ) {
            return false;
          }

          if (
            activeTab === 'in_progress' &&
            status !== 'in_progress'
          ) {
            return false;
          }

          if (
            activeTab === 'completed' &&
            status !== 'completed'
          ) {
            return false;
          }

          if (
            activeTab === 'cancelled' &&
            !isCancelledStatus(status)
          ) {
            return false;
          }

          if (
            activeTab === 'expired' &&
            status !== 'expired'
          ) {
            return false;
          }

          // --------------------------
          // PLAGE DE DATES
          // --------------------------

          if (fromKey || toKey) {
            const bookingDateKey =
              getDateOnlyKey(
                getScheduledDate(booking)
              );

            // Une réservation sans date n'entre
            // pas dans une plage de dates sélectionnée.
            if (!bookingDateKey) {
              return false;
            }

            if (
              fromKey &&
              bookingDateKey < fromKey
            ) {
              return false;
            }

            if (
              toKey &&
              bookingDateKey > toKey
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      activeTab,
      bookings,
      dateFrom,
      dateTo,
    ]);


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
            bookingId:
              booking.id,
            booking,
          }
        );
      },
      [navigation]
    );

  // ==========================================================
  // NEGOTIATION
  // ==========================================================
  //
  // pending + negotiating ihany.
  // confirmed => tsy azo atao intsony.
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
          normalizeStatus(
            booking
          );

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

        console.log(
          '➡️ [NEGOTIATION]',
          booking.id
        );

        showToast('success', 'Ouverture de la négociation.');
        navigation.navigate(
          'Negotiation',
          {
            bookingId:
              booking.id,

            currentPrice:
              getPrice(booking),

            clientName:
              getClientName(
                booking
              ),

            booking,
          }
        );
      },
      [navigation]
    );

  // ==========================================================
  // GET CLIENT OFFER
  // ==========================================================

  const getActiveClientOffer =
    useCallback(
      async bookingId => {
        const result =
          await offerService.getOffersByBooking(
            bookingId
          );

        console.log(
          '📦 [OFFERS] GET BOOKING OFFERS:',
          result
        );

        if (
          !result?.success
        ) {
          throw new Error(
            result?.error ||
            'Impossible de récupérer les offres.'
          );
        }

        const offers =
          normalizeArray(
            result.data
          );

        const active =
          offers.filter(
            isActiveClientOffer
          );

        console.log(
          '👤 CLIENT OFFERS:',
          active
        );

        if (
          active.length === 0
        ) {
          return null;
        }

        // dernière offre client active
        return active[
          active.length - 1
        ];
      },
      []
    );

  // ==========================================================
  // ACCEPT
  // ==========================================================
  //
  // EXACT FLOW:
  //
  // GET /offers/booking/{booking_id}
  //
  // puis:
  //
  // POST /offers/{offer_id}/accept
  //
  // ==========================================================

  const executeAccept =
    useCallback(
      async booking => {
        if (
          !booking?.id
        ) {
          return;
        }

        if (
          busyId !== null
        ) {
          return;
        }

        const status =
          normalizeStatus(
            booking
          );

        if (status !== 'negotiating') {
          showToast(
            'error',
            'Cette réservation n’a pas d’offre client active à accepter.'
          );
          return;
        }

        const cachedClientOffer =
          booking?._activeClientOffer;

        if (
          !cachedClientOffer ||
          !getOfferId(cachedClientOffer)
        ) {
          showToast(
            'error',
            'Aucune offre active du client à accepter.'
          );
          return;
        }

        try {
          setBusyId(
            booking.id
          );

          console.log(
            '================================================'
          );

          console.log(
            '📤 ACCEPT CLIENT OFFER'
          );

          console.log(
            'BOOKING ID:',
            booking.id
          );

          console.log(
            'BOOKING STATUS:',
            status
          );

          console.log(
            '================================================'
          );

          // --------------------------------------------------
          // STEP 1
          // GET /offers/booking/{booking_id}
          // --------------------------------------------------

          const clientOffer =
            await getActiveClientOffer(
              booking.id
            );

          if (
            !clientOffer
          ) {
            throw new Error(
              'Aucune offre active du client n’a été trouvée pour cette réservation.'
            );
          }

          const offerId =
            getOfferId(
              clientOffer
            );

          if (
            !offerId
          ) {
            throw new Error(
              'Identifiant de l’offre client introuvable.'
            );
          }

          console.log(
            '👤 CLIENT OFFER ID:',
            offerId
          );

          console.log(
            '➡️ POST:',
            `/offers/${offerId}/accept`
          );

          // --------------------------------------------------
          // STEP 2
          // POST /offers/{offer_id}/accept
          // --------------------------------------------------

          const result =
            await offerService.acceptOffer(
              offerId
            );

          console.log(
            '📦 ACCEPT RESULT:',
            result
          );

          if (
            !result?.success
          ) {
            throw new Error(
              result?.error ||
              'Impossible d’accepter l’offre.'
            );
          }

          // --------------------------------------------------
          // IMPORTANT:
          // Aza fafana eto ilay booking.
          //
          // Taloha:
          // previous.filter(...)
          //
          // Izany no nahatonga azy tsy hita.
          //
          // Eto dia avadika confirmed.
          // --------------------------------------------------

          const returnedBooking =
            result?.data;

          setBookings(
            previous =>
              previous.map(
                item => {
                  if (
                    String(
                      item.id
                    ) !==
                    String(
                      booking.id
                    )
                  ) {
                    return item;
                  }

                  return {
                    ...item,

                    status:
                      'confirmed',

                    booking_status:
                      'confirmed',

                    final_price:
                      returnedBooking?.final_price ??
                      returnedBooking?.price ??
                      getPrice(
                        booking
                      ),
                  };
                }
              )
          );

          showToast(
            'success',
            'Offre acceptée. Réservation confirmée.'
          );

          // --------------------------------------------------
          // Reload backend
          // --------------------------------------------------

          await loadBookings(
            false
          );
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
        loadBookings,
        showToast,
      ]
    );

  // ==========================================================
  // ACCEPT WITH CONFIRMATION
  // ==========================================================

  const handleAccept =
    useCallback(
      booking => {
        if (!booking?.id || busyId !== null) return;

        const status = normalizeStatus(booking);
        const actionState = getActionState(booking);

        if (!actionState.showAcceptReject) {
          showToast(
            'error',
            'Aucune offre active du client à accepter.'
          );
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
      [busyId, executeAccept, showToast]
    );

  // ==========================================================
  // REJECT
  // ==========================================================

  const handleReject =
    useCallback(
      booking => {
        if (!booking?.id || busyId !== null) return;

        const actionState = getActionState(booking);

        if (!actionState.showAcceptReject) {
          showToast(
            'error',
            'Aucune offre active du client à refuser.'
          );
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

              const clientOffer =
                await getActiveClientOffer(booking.id);

              if (!clientOffer) {
                throw new Error(
                  'Aucune offre active du client trouvée.'
                );
              }

              const offerId = getOfferId(clientOffer);

              if (!offerId) {
                throw new Error('ID de l’offre introuvable.');
              }

              const result =
                await offerService.rejectOffer(offerId);

              if (!result?.success) {
                throw new Error(
                  result?.error ||
                  'Impossible de refuser l’offre.'
                );
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
                rejectError?.message ||
                'Impossible de refuser l’offre.'
              );
            } finally {
              setBusyId(null);
            }
          },
        });
      },
      [busyId, getActiveClientOffer, loadBookings, showToast]
    );

  // ==========================================================
  // ACTION VISIBILITY
  // ==========================================================

  const getActionState = booking => {
    const status = normalizeStatus(booking);

    const showNegotiation =
      status === 'pending' ||
      status === 'negotiating';

    // Flux exact:
    // pending + aucune offre      => Negotiation seulement
    // negotiating + therapist    => Negotiation seulement
    // negotiating + client       => Accept + Negotiation + Refuser
    const hasClientOffer =
      !!booking?._activeClientOffer &&
      !!getOfferId(booking._activeClientOffer);

    const showAcceptReject =
      status === 'negotiating' &&
      hasClientOffer;

    return {
      showNegotiation,
      showAcceptReject,
    };
  };

  // ==========================================================
  // MOBILE CARD
  // ==========================================================

  const renderMobileCard =
    useCallback(
      ({ item }) => {
        const booking =
          item;

        const status =
          normalizeStatus(
            booking
          );

        const statusUI =
          getStatusUI(
            booking
          );

        const confirmed =
          status ===
          'confirmed';

        const busy =
          busyId ===
          booking.id;

        const price =
          getPrice(
            booking
          );

        const distance =
          getDistance(
            booking
          );

        const eta =
          getEta(
            booking
          );

        const date =
          getScheduledDate(
            booking
          );

        const requestedAt =
          getRequestedAt(
            booking
          );

        const expiresAt =
          getExpiresAt(
            booking
          );

        const expired =
          isOfferExpired(
            booking
          );

        const actionState =
          getActionState(booking);

        const showNegotiation =
          actionState.showNegotiation;

        const showAcceptReject =
          actionState.showAcceptReject;

        return (
          <View
            style={[
              styles.mobileCard,
              hoveredId ===
                booking.id &&
                styles.cardHover,
            ]}
            onMouseEnter={() =>
              isWeb && setHoveredId(booking.id)
            }
            onMouseLeave={() =>
              isWeb && setHoveredId(null)
            }
          >
            {/* HEADER */}

            <View
              style={
                styles.mobileHeader
              }
            >
              <ClientAvatar
                photoUrl={getClientPhoto(
                  booking
                )}
                name={getClientName(
                  booking
                )}
                size={58}
                isOnline={getClientOnline(
                  booking
                )}
              />

              <View
                style={
                  styles.clientInfo
                }
              >
                <View
                  style={
                    styles.clientNameRow
                  }
                >
                  <Text
                    style={
                      styles.clientName
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {getClientName(
                      booking
                    )}
                  </Text>

                  <View
                    style={[
                      styles.presenceBadge,
                      getClientOnline(
                        booking
                      )
                        ? styles.presenceBadgeOnline
                        : styles.presenceBadgeOffline,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presenceBadgeText,
                        getClientOnline(
                          booking
                        )
                          ? styles.presenceBadgeTextOnline
                          : styles.presenceBadgeTextOffline,
                      ]}
                    >
                      {getClientOnline(
                        booking
                      )
                        ? 'En ligne'
                        : 'Hors ligne'}
                    </Text>
                  </View>
                </View>

                <Text
                  style={
                    styles.bookingId
                  }
                >
                  Réservation #
                  {booking.id}
                </Text>

                {getPhone(
                  booking
                ) ? (
                  <View
                    style={
                      styles.contactLine
                    }
                  >
                    <Ionicons
                      name="call-outline"
                      size={11}
                      color={
                        COLORS.textSecondary
                      }
                    />

                    <Text
                      style={
                        styles.phone
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {getPhone(
                        booking
                      )}
                    </Text>
                  </View>
                ) : null}

                {getEmail(
                  booking
                ) ? (
                  <View
                    style={
                      styles.contactLine
                    }
                  >
                    <Ionicons
                      name="mail-outline"
                      size={11}
                      color={
                        COLORS.textSecondary
                      }
                    />

                    <Text
                      style={
                        styles.phone
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {getEmail(
                        booking
                      )}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      statusUI.background,
                  },
                ]}
              >
                <Ionicons
                  name={
                    statusUI.icon
                  }
                  size={14}
                  color={
                    statusUI.color
                  }
                />

                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        statusUI.color,
                    },
                  ]}
                >
                  {
                    statusUI.label
                  }
                </Text>
              </View>
            </View>

            {/* MASSAGE */}

            <View
              style={
                styles.infoRow
              }
            >
              <View
                style={
                  styles.iconCircle
                }
              >
                <Ionicons
                  name="body-outline"
                  size={16}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.infoContent
                }
              >
                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Massage
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                  numberOfLines={
                    1
                  }
                >
                  {getMassageName(
                    booking
                  )}

                  {getCategory(
                    booking
                  )
                    ? ` · ${getCategory(
                        booking
                      )}`
                    : ''}
                </Text>
              </View>
            </View>

            {/* DURATION */}

            <View
              style={
                styles.infoRow
              }
            >
              <View
                style={
                  styles.iconCircle
                }
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.infoContent
                }
              >
                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Durée
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {getDuration(
                    booking
                  )}{' '}
                  min
                </Text>
              </View>
            </View>

            {/* DISTANCE */}

            {distance !==
            null ? (
              <View
                style={
                  styles.infoRow
                }
              >
                <View
                  style={
                    styles.iconCircle
                  }
                >
                  <Ionicons
                    name="navigate-outline"
                    size={16}
                    color={
                      COLORS.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.infoContent
                  }
                >
                  <Text
                    style={
                      styles.infoLabel
                    }
                  >
                    Distance
                  </Text>

                  <Text
                    style={
                      styles.infoValue
                    }
                  >
                    {distance.toFixed(
                      1
                    )}{' '}
                    km
                    {eta !==
                    null
                      ? ` · ${Math.round(
                          eta
                        )} min`
                      : ''}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ADDRESS */}

            <View
              style={
                styles.addressRow
              }
            >
              <Ionicons
                name="location-outline"
                size={17}
                color={
                  COLORS.primary
                }
              />

              <Text
                style={
                  styles.address
                }
                numberOfLines={
                  2
                }
              >
                {getAddress(
                  booking
                )}
              </Text>
            </View>

            {/* DATE */}

            {date ? (
              <View
                style={
                  styles.dateRow
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={
                    COLORS.textSecondary
                  }
                />

                <Text
                  style={
                    styles.dateText
                  }
                >
                  {formatDate(
                    date
                  )}
                </Text>
              </View>
            ) : null}

            {/* DEMANDE CLIENT / EXPIRATION */}

            <View
              style={
                styles.timelineBox
              }
            >
              {requestedAt ? (
                <View
                  style={
                    styles.dateRow
                  }
                >
                  <Ionicons
                    name="paper-plane-outline"
                    size={14}
                    color={
                      COLORS.textSecondary
                    }
                  />

                  <Text
                    style={
                      styles.dateText
                    }
                  >
                    Demande envoyée le{' '}
                    {formatDate(
                      requestedAt
                    )}
                  </Text>
                </View>
              ) : null}

              {expiresAt ? (
                <View
                  style={
                    styles.dateRow
                  }
                >
                  <Ionicons
                    name="hourglass-outline"
                    size={14}
                    color={
                      expired
                        ? COLORS.red
                        : COLORS.orange
                    }
                  />

                  <Text
                    style={[
                      styles.dateText,
                      expired && {
                        color:
                          COLORS.red,
                        fontWeight:
                          '700',
                      },
                    ]}
                  >
                    {expired
                      ? 'Demande expirée le '
                      : 'Expire le '}
                    {formatDate(
                      expiresAt
                    )}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* PRICE */}

            <View
              style={
                styles.priceSection
              }
            >
              <View>
                <Text
                  style={
                    styles.priceLabel
                  }
                >
                  Prix proposé
                </Text>

                <Text
                  style={
                    styles.price
                  }
                >
                  {formatPrice(
                    price
                  )}
                </Text>
              </View>

              {confirmed ? (
                <View
                  style={
                    styles.confirmedBadge
                  }
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.confirmedText
                    }
                  >
                    Confirmée
                  </Text>
                </View>
              ) : null}
            </View>

            {/* DETAIL */}
            <Pressable
              style={styles.detailButton}
              onPress={() => openBooking(booking)}
              android_ripple={{ color: '#DCEFE3' }}
            >
              <Ionicons
                name="eye-outline"
                size={15}
                color={COLORS.textSecondary}
              />
              <Text style={styles.detailButtonText}>
                Voir les détails
              </Text>
            </Pressable>

            {/* ACTIONS */}

            {(showNegotiation || showAcceptReject) ? (
              <View
                style={
                  styles.actionsRow
                }
              >
                {/* ACCEPT */}
                {showAcceptReject && (
                <Pressable
                  style={[
                    styles.actionButton,
                    styles.acceptButton,
                    busy &&
                      styles.disabled,
                  ]}
                  onPress={event => {
                    event?.stopPropagation?.();

                    handleAccept(
                      booking
                    );
                  }}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        COLORS.white
                      }
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={
                          COLORS.white
                        }
                      />

                      <Text
                        style={
                          styles.acceptButtonText
                        }
                      >
                        Accepter
                      </Text>
                    </>
                  )}
                </Pressable>
                )}

                {/* NEGOTIATION */}
                {showNegotiation && (
                <Pressable
                  style={[
                    styles.actionButton,
                    styles.negotiationButton,
                  ]}
                  onPress={event => {
                    event?.stopPropagation?.();

                    handleNegotiation(
                      booking
                    );
                  }}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={18}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.negotiationText
                    }
                  >
                    Négociation
                  </Text>
                </Pressable>
                )}

                {/* REJECT */}
                {showAcceptReject && (
                <Pressable
                  style={[
                    styles.actionButton,
                    styles.rejectButton,
                    busy &&
                      styles.disabled,
                  ]}
                  onPress={event => {
                    event?.stopPropagation?.();

                    handleReject(
                      booking
                    );
                  }}
                  disabled={busy}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={
                      COLORS.red
                    }
                  />

                  <Text
                    style={
                      styles.rejectText
                    }
                  >
                    Refuser
                  </Text>
                </Pressable>
                )}
              </View>
            ) : (
              <View
                style={[
                  styles.confirmedRow,
                  {
                    backgroundColor:
                      statusUI.background,
                  },
                ]}
              >
                <Ionicons
                  name={
                    statusUI.icon
                  }
                  size={18}
                  color={
                    statusUI.color
                  }
                />

                <Text
                  style={[
                    styles.confirmedRowText,
                    {
                      color:
                        statusUI.color,
                    },
                  ]}
                >
                  {statusUI.label}
                </Text>
              </View>
            )}
          </View>
        );
      },
      [
        busyId,
        handleAccept,
        handleNegotiation,
        handleReject,
        hoveredId,
      ]
    );

  // ==========================================================
  // WEB HEADER
  // ==========================================================

  const renderWebHeader =
    () => (
      <View
        style={
          styles.tableHeader
        }
      >
        <View
          style={
            styles.colClient
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            CLIENT
          </Text>
        </View>

        <View
          style={
            styles.colContact
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            CONTACT
          </Text>
        </View>

        <View
          style={
            styles.colMassage
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            PRESTATION
          </Text>
        </View>

        <View
          style={
            styles.colTravel
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            DISTANCE
          </Text>
        </View>

        <View
          style={
            styles.colDuration
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            DURÉE
          </Text>
        </View>

        <View
          style={
            styles.colAddress
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            ADRESSE
          </Text>
        </View>

        <View
          style={
            styles.colDates
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            DEMANDE / EXPIRATION
          </Text>
        </View>

        <View
          style={
            styles.colPrice
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            PRIX
          </Text>
        </View>

        <View
          style={
            styles.colStatus
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            STATUT
          </Text>
        </View>

        <View
          style={
            styles.colActions
          }
        >
          <Text
            style={
              styles.tableHeaderText
            }
          >
            ACTIONS
          </Text>
        </View>
      </View>
    );

  // ==========================================================
  // WEB ROW
  // ==========================================================

  const renderWebRow =
    useCallback(
      ({ item }) => {
        const booking =
          item;

        const status =
          normalizeStatus(
            booking
          );

        const statusUI =
          getStatusUI(
            booking
          );

        const confirmed =
          status ===
          'confirmed';

        const busy =
          busyId ===
          booking.id;

        const actionState =
          getActionState(booking);

        const showNegotiation =
          actionState.showNegotiation;

        const showAcceptReject =
          actionState.showAcceptReject;

        const distance =
          getDistance(
            booking
          );

        const requestedAt =
          getRequestedAt(
            booking
          );

        const expiresAt =
          getExpiresAt(
            booking
          );

        const expired =
          isOfferExpired(
            booking
          );

        return (
          <Pressable
            onPress={() =>
              openBooking(
                booking
              )
            }
            onHoverIn={() =>
              setHoveredId(
                booking.id
              )
            }
            onHoverOut={() =>
              setHoveredId(
                null
              )
            }
            style={[
              styles.tableRow,
              hoveredId ===
                booking.id &&
                styles.tableRowHover,
            ]}
          >
            {/* CLIENT */}

            <View
              style={
                styles.colClient
              }
            >
              <View
                style={
                  styles.webClient
                }
              >
                <ClientAvatar
                  photoUrl={getClientPhoto(
                    booking
                  )}
                  name={getClientName(
                    booking
                  )}
                  size={38}
                  isOnline={getClientOnline(
                    booking
                  )}
                />

                <View
                  style={
                    styles.webClientInfo
                  }
                >
                  <Text
                    style={
                      styles.webClientName
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {getClientName(
                      booking
                    )}
                  </Text>

                  <Text
                    style={
                      styles.webBookingId
                    }
                  >
                    #
                    {booking.id}
                  </Text>
                </View>
              </View>
            </View>

            {/* CONTACT */}

            <View
              style={
                styles.colContact
              }
            >
              {getPhone(
                booking
              ) ? (
                <View
                  style={
                    styles.webContactLine
                  }
                >
                  <Ionicons
                    name="call-outline"
                    size={11}
                    color={
                      COLORS.textSecondary
                    }
                  />

                  <Text
                    style={
                      styles.tableSubText
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {getPhone(
                      booking
                    )}
                  </Text>
                </View>
              ) : null}

              {getEmail(
                booking
              ) ? (
                <View
                  style={
                    styles.webContactLine
                  }
                >
                  <Ionicons
                    name="mail-outline"
                    size={11}
                    color={
                      COLORS.textSecondary
                    }
                  />

                  <Text
                    style={
                      styles.tableSubText
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {getEmail(
                      booking
                    )}
                  </Text>
                </View>
              ) : null}

              {!getPhone(
                booking
              ) &&
              !getEmail(
                booking
              ) ? (
                <Text
                  style={
                    styles.tableSubText
                  }
                >
                  —
                </Text>
              ) : null}
            </View>

            {/* MASSAGE */}

            <View
              style={
                styles.colMassage
              }
            >
              <Text
                style={
                  styles.tableMainText
                }
                numberOfLines={
                  1
                }
              >
                {getMassageName(
                  booking
                )}
              </Text>

              {getCategory(
                booking
              ) ? (
                <Text
                  style={
                    styles.tableSubText
                  }
                >
                  {getCategory(
                    booking
                  )}
                </Text>
              ) : null}
            </View>

            {/* DISTANCE */}

            <View
              style={
                styles.colTravel
              }
            >
              <Text
                style={
                  styles.tableMainText
                }
              >
                {distance !==
                null
                  ? `${distance.toFixed(
                      1
                    )} km`
                  : '—'}
              </Text>
            </View>

            {/* DURATION */}

            <View
              style={
                styles.colDuration
              }
            >
              <Text
                style={
                  styles.tableMainText
                }
              >
                {getDuration(
                  booking
                )}{' '}
                min
              </Text>
            </View>

            {/* ADDRESS */}

            <View
              style={
                styles.colAddress
              }
            >
              <View
                style={
                  styles.webAddress
                }
              >
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={
                    COLORS.primary
                  }
                />

                <Text
                  style={
                    styles.tableAddress
                  }
                  numberOfLines={
                    2
                  }
                >
                  {getAddress(
                    booking
                  )}
                </Text>
              </View>
            </View>

            {/* DEMANDE CLIENT / EXPIRATION */}

            <View
              style={
                styles.colDates
              }
            >
              {requestedAt ? (
                <View
                  style={
                    styles.webContactLine
                  }
                >
                  <Ionicons
                    name="paper-plane-outline"
                    size={11}
                    color={
                      COLORS.textSecondary
                    }
                  />

                  <Text
                    style={
                      styles.tableSubText
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {formatDate(
                      requestedAt
                    )}
                  </Text>
                </View>
              ) : null}

              {expiresAt ? (
                <View
                  style={
                    styles.webContactLine
                  }
                >
                  <Ionicons
                    name="hourglass-outline"
                    size={11}
                    color={
                      expired
                        ? COLORS.red
                        : COLORS.orange
                    }
                  />

                  <Text
                    style={[
                      styles.tableSubText,
                      expired && {
                        color:
                          COLORS.red,
                        fontWeight:
                          '700',
                      },
                    ]}
                    numberOfLines={
                      1
                    }
                  >
                    {formatDate(
                      expiresAt
                    )}
                  </Text>
                </View>
              ) : null}

              {!requestedAt &&
              !expiresAt ? (
                <Text
                  style={
                    styles.tableSubText
                  }
                >
                  —
                </Text>
              ) : null}
            </View>

            {/* PRICE */}

            <View
              style={
                styles.colPrice
              }
            >
              <Text
                style={
                  styles.tablePrice
                }
              >
                {formatPrice(
                  getPrice(
                    booking
                  )
                )}
              </Text>
            </View>

            {/* STATUS */}

            <View
              style={
                styles.colStatus
              }
            >
              <View
                style={[
                  styles.tableStatus,
                  {
                    backgroundColor:
                      statusUI.background,
                  },
                ]}
              >
                <Ionicons
                  name={
                    statusUI.icon
                  }
                  size={13}
                  color={
                    statusUI.color
                  }
                />

                <Text
                  style={[
                    styles.tableStatusText,
                    {
                      color:
                        statusUI.color,
                    },
                  ]}
                >
                  {
                    statusUI.label
                  }
                </Text>
              </View>
            </View>

            {/* ACTIONS */}

            <View
              style={
                styles.colActions
              }
            >
              {(showNegotiation || showAcceptReject) ? (
                <View
                  style={
                    styles.tableActions
                  }
                >
                  {/* ACCEPT */}
                  {showAcceptReject && (
                  <Pressable
                    style={[
                      styles.tableAction,
                      styles.tableAccept,
                      busy &&
                        styles.disabled,
                    ]}
                    onPress={event => {
                      event?.stopPropagation?.();

                      handleAccept(
                        booking
                      );
                    }}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          COLORS.white
                        }
                      />
                    ) : (
                      <Ionicons
                        name="checkmark"
                        size={17}
                        color={
                          COLORS.white
                        }
                      />
                    )}
                  </Pressable>
                  )}

                  {/* NEGOTIATION */}
                  {showNegotiation && (
                  <Pressable
                    style={[
                      styles.tableAction,
                      styles.tableNegotiation,
                    ]}
                    onPress={event => {
                      event?.stopPropagation?.();

                      handleNegotiation(
                        booking
                      );
                    }}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={17}
                      color={
                        COLORS.primary
                      }
                    />
                  </Pressable>
                  )}

                  {/* REJECT */}
                  {showAcceptReject && (
                  <Pressable
                    style={[
                      styles.tableAction,
                      styles.tableReject,
                      busy &&
                        styles.disabled,
                    ]}
                    onPress={event => {
                      event?.stopPropagation?.();

                      handleReject(
                        booking
                      );
                    }}
                    disabled={busy}
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color={
                        COLORS.red
                      }
                    />
                  </Pressable>
                  )}
                </View>
              ) : (
                <View
                  style={
                    styles.doneWeb
                  }
                >
                  <Ionicons
                    name={
                      statusUI.icon
                    }
                    size={16}
                    color={
                      statusUI.color
                    }
                  />

                  <Text
                    style={[
                      styles.doneWebText,
                      {
                        color:
                          statusUI.color,
                      },
                    ]}
                  >
                    {statusUI.label}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      },
      [
        busyId,
        handleAccept,
        handleNegotiation,
        handleReject,
        hoveredId,
        openBooking,
      ]
    );

  // ==========================================================
  // HEADER
  // ==========================================================

  const renderTop =
    () => (
      <View
        style={
          styles.topContainer
        }
      >
        {/* FILTRE PAR PLAGE DE DATES (sans titre/sous-titre) */}

        <View style={styles.dateFilterSection}>
          {(dateFrom || dateTo) ? (
            <View style={styles.dateFilterHeader}>
              <Pressable
                onPress={() => {
                  setDateFrom(null);
                  setDateTo(null);
                  setShowFromPicker(false);
                  setShowToPicker(false);
                }}
                style={styles.clearDateButton}
                hitSlop={8}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={COLORS.red}
                />
                <Text style={styles.clearDateText}>
                  Effacer
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.dateFieldsRow}>
            {/* DATE DEBUT */}
            <View style={styles.dateFieldWrap}>
              <Text style={styles.dateFieldLabel}>
                Du
              </Text>

              {isWeb ? (
                <View style={styles.webDateInputWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                  <input
                    type="date"
                    value={
                      dateFrom
                        ? formatDateOnly(dateFrom)
                        : ''
                    }
                    max={
                      dateTo
                        ? formatDateOnly(dateTo)
                        : undefined
                    }
                    onChange={event => {
                      const value =
                        event.target.value;

                      if (!value) {
                        setDateFrom(null);
                        return;
                      }

                      const parts =
                        value
                          .split('-')
                          .map(Number);

                      const selected =
                        new Date(
                          parts[0],
                          parts[1] - 1,
                          parts[2]
                        );

                      setDateFrom(selected);

                      if (
                        dateTo &&
                        formatDateOnly(selected) >
                          formatDateOnly(dateTo)
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
                      color: COLORS.text,
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
                        !dateFrom &&
                          styles.nativeDatePlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {formatDateLabel(dateFrom)}
                    </Text>
                  </Pressable>

                  {showFromPicker ? (
                    <DateTimePicker
                      value={
                        dateFrom ||
                        new Date()
                      }
                      mode="date"
                      display="default"
                      onChange={(
                        event,
                        selectedDate
                      ) => {
                        setShowFromPicker(false);

                        if (
                          event?.type ===
                          'dismissed'
                        ) {
                          return;
                        }

                        if (
                          selectedDate
                        ) {
                          setDateFrom(
                            selectedDate
                          );

                          if (
                            dateTo &&
                            selectedDate.getTime() >
                              dateTo.getTime()
                          ) {
                            setDateTo(
                              selectedDate
                            );
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
                color={COLORS.textLight}
              />
            </View>

            {/* DATE FIN */}
            <View style={styles.dateFieldWrap}>
              <Text style={styles.dateFieldLabel}>
                Au
              </Text>

              {isWeb ? (
                <View style={styles.webDateInputWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                  <input
                    type="date"
                    value={
                      dateTo
                        ? formatDateOnly(dateTo)
                        : ''
                    }
                    min={
                      dateFrom
                        ? formatDateOnly(dateFrom)
                        : undefined
                    }
                    onChange={event => {
                      const value =
                        event.target.value;

                      if (!value) {
                        setDateTo(null);
                        return;
                      }

                      const parts =
                        value
                          .split('-')
                          .map(Number);

                      const selected =
                        new Date(
                          parts[0],
                          parts[1] - 1,
                          parts[2]
                        );

                      setDateTo(selected);

                      if (
                        dateFrom &&
                        selected.getTime() <
                          dateFrom.getTime()
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
                      color: COLORS.text,
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
                        !dateTo &&
                          styles.nativeDatePlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {formatDateLabel(dateTo)}
                    </Text>
                  </Pressable>

                  {showToPicker ? (
                    <DateTimePicker
                      value={
                        dateTo ||
                        dateFrom ||
                        new Date()
                      }
                      mode="date"
                      display="default"
                      minimumDate={
                        dateFrom ||
                        undefined
                      }
                      onChange={(
                        event,
                        selectedDate
                      ) => {
                        setShowToPicker(false);

                        if (
                          event?.type ===
                          'dismissed'
                        ) {
                          return;
                        }

                        if (
                          selectedDate
                        ) {
                          setDateTo(
                            selectedDate
                          );

                          if (
                            dateFrom &&
                            selectedDate.getTime() <
                              dateFrom.getTime()
                          ) {
                            setDateFrom(
                              selectedDate
                            );
                          }
                        }
                      }}
                    />
                  ) : null}
                </>
              )}
            </View>
          </View>

          {(dateFrom || dateTo) ? (
            <View style={styles.dateFilterSummary}>
              <Ionicons
                name="funnel-outline"
                size={14}
                color={COLORS.primary}
              />
              <Text style={styles.dateFilterSummaryText}>
                {dateFrom
                  ? formatDateLabel(dateFrom)
                  : 'Toutes les dates'}
                {'  →  '}
                {dateTo
                  ? formatDateLabel(dateTo)
                  : 'Toutes les dates'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* TABS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.tabsContent
          }
        >
          <TabButton
            label="Toutes"
            count={
              counts.all
            }
            active={
              activeTab ===
              'all'
            }
            onPress={() =>
              setActiveTab(
                'all'
              )
            }
          />

          <TabButton
            label="En attente"
            count={
              counts.pending
            }
            active={
              activeTab ===
              'pending'
            }
            onPress={() =>
              setActiveTab(
                'pending'
              )
            }
          />

          <TabButton
            label="Négociation"
            count={
              counts.negotiating
            }
            active={
              activeTab ===
              'negotiating'
            }
            onPress={() =>
              setActiveTab(
                'negotiating'
              )
            }
          />

          <TabButton
            label="Confirmées"
            count={
              counts.confirmed
            }
            active={
              activeTab ===
              'confirmed'
            }
            onPress={() =>
              setActiveTab(
                'confirmed'
              )
            }
          />

          <TabButton
            label="En cours"
            count={
              counts.in_progress
            }
            active={
              activeTab ===
              'in_progress'
            }
            onPress={() =>
              setActiveTab(
                'in_progress'
              )
            }
          />

          <TabButton
            label="Terminées"
            count={
              counts.completed
            }
            active={
              activeTab ===
              'completed'
            }
            onPress={() =>
              setActiveTab(
                'completed'
              )
            }
          />

          <TabButton
            label="Annulées"
            count={
              counts.cancelled
            }
            active={
              activeTab ===
              'cancelled'
            }
            onPress={() =>
              setActiveTab(
                'cancelled'
              )
            }
          />

          <TabButton
            label="Expirées"
            count={
              counts.expired
            }
            active={
              activeTab ===
              'expired'
            }
            onPress={() =>
              setActiveTab(
                'expired'
              )
            }
          />
        </ScrollView>
      </View>
    );

  // ==========================================================
  // EMPTY
  // ==========================================================

  const renderEmpty =
    () => (
      <View
        style={
          styles.emptyContainer
        }
      >
        <View
          style={
            styles.emptyIcon
          }
        >
          <Ionicons
            name="file-tray-outline"
            size={35}
            color={
              COLORS.primary
            }
          />
        </View>

        <Text
          style={
            styles.emptyTitle
          }
        >
          Aucune réservation
        </Text>

        <Text
          style={
            styles.emptyText
          }
        >
          {activeTab ===
                'pending'
              ? 'Aucune demande en attente.'
              : activeTab ===
                  'negotiating'
                ? 'Aucune négociation en cours.'
                : activeTab ===
                    'confirmed'
                  ? 'Aucune réservation confirmée.'
                  : activeTab ===
                      'in_progress'
                    ? 'Aucune réservation en cours.'
                    : activeTab ===
                        'completed'
                      ? 'Aucune réservation terminée.'
                      : activeTab ===
                          'cancelled'
                        ? 'Aucune réservation annulée.'
                        : activeTab ===
                            'expired'
                          ? 'Aucune réservation expirée.'
                          : 'Aucune réservation disponible.'}
        </Text>

        <Pressable
          style={
            styles.emptyRefresh
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
              styles.emptyRefreshText
            }
          >
            Actualiser
          </Text>
        </Pressable>
      </View>
    );

  // ==========================================================
  // ERROR
  // ==========================================================

  const renderError =
    () => {
      if (!error) {
        return null;
      }

      return (
        <View
          style={
            styles.errorBox
          }
        >
          <Ionicons
            name="warning-outline"
            size={20}
            color={
              COLORS.red
            }
          />

          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>

          <Pressable
            onPress={() =>
              loadBookings(
                true
              )
            }
          >
            <Text
              style={
                styles.retryText
              }
            >
              Réessayer
            </Text>
          </Pressable>
        </View>
      );
    };

  // ==========================================================
  // WEB
  // ==========================================================

  if (
    isWeb &&
    !isMobile
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.screen
          }
        >
          <ScreenHeader
            title="Réservations"
            onBack={() =>
              navigation.goBack()
            }
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

          {renderTop()}

          {renderError()}

          <View
            style={
              styles.webTableContainer
            }
          >
            {renderWebHeader()}

            {loading &&
            bookings.length ===
              0 ? (
              <View
                style={
                  styles.loadingContainer
                }
              >
                <ActivityIndicator
                  size="large"
                  color={
                    COLORS.primary
                  }
                />

                <Text
                  style={
                    styles.loadingText
                  }
                >
                  Chargement...
                </Text>
              </View>
            ) : (
              <FlatList
                data={
                  filteredBookings
                }
                keyExtractor={
                  item =>
                    String(
                      item.id
                    )
                }
                renderItem={
                  renderWebRow
                }
                ListEmptyComponent={
                  renderEmpty
                }
                contentContainerStyle={
                  filteredBookings.length ===
                  0
                    ? styles.listEmptyContent
                    : undefined
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
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // MOBILE
  // ==========================================================

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.screen
        }
      >
        <ScreenHeader
          title="Réservations"
          onBack={() =>
            navigation.goBack()
          }
        />

        <Toast toast={toast} />

        {renderTop()}

        {renderError()}

        {loading &&
        bookings.length ===
          0 ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
              size="large"
              color={
                COLORS.primary
              }
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Chargement...
            </Text>
          </View>
        ) : (
          <FlatList
            data={
              filteredBookings
            }
            keyExtractor={
              item =>
                String(
                  item.id
                )
            }
            renderItem={
              renderMobileCard
            }
            ListEmptyComponent={
              renderEmpty
            }
            contentContainerStyle={
              filteredBookings.length ===
              0
                ? styles.listEmptyContent
                : styles.mobileList
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
              false
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    screen: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    // ========================================================
    // TOP
    // ========================================================

    topContainer: {
      backgroundColor:
        COLORS.white,
      borderBottomWidth: 1,
      borderBottomColor:
        COLORS.border,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 8,
    },

    titleRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 6,
    },

    title: {
      fontSize: 18,
      fontWeight: '900',
      color: COLORS.black,
      letterSpacing: -0.2,
    },

    subtitle: {
      marginTop: 2,
      fontSize: 13,
      color: COLORS.textSecondary,
    },

    refreshButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.primarySoft,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    // ========================================================
    // DATE FILTER
    // ========================================================

    dateFilterSection: {
      width: '100%',
      marginBottom: 10,
      padding: 11,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.white,
    },

    dateFilterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 9,
    },

    dateFilterTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },

    dateFilterIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: COLORS.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },

    dateFilterTitle: {
      fontSize: 12,
      fontWeight: '900',
      color: COLORS.black,
    },

    dateFilterSubtitle: {
      marginTop: 1,
      fontSize: 9,
      color: COLORS.textSecondary,
    },

    clearDateButton: {
      minHeight: 30,
      paddingHorizontal: 8,
      borderRadius: 9,
      backgroundColor: COLORS.redSoft,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },

    clearDateText: {
      fontSize: 9,
      fontWeight: '800',
      color: COLORS.red,
    },

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
      marginBottom: 4,
      fontSize: 9,
      fontWeight: '800',
      color: COLORS.textSecondary,
    },

    webDateInputWrap: {
      minHeight: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.background,
      paddingHorizontal: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      overflow: 'hidden',
    },

    nativeDateButton: {
      minHeight: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.background,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },

    nativeDateText: {
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      fontWeight: '700',
      color: COLORS.text,
    },

    nativeDatePlaceholder: {
      color: COLORS.textLight,
      fontWeight: '600',
    },

    dateArrow: {
      width: 30,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 11,
    },

    dateFilterSummary: {
      marginTop: 8,
      minHeight: 30,
      paddingHorizontal: 9,
      borderRadius: 9,
      backgroundColor: COLORS.primarySoft,
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
    // TABS
    // ========================================================

    tabsContent: {
      gap: 8,
      paddingVertical: 2,
    },

    tab: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.white,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
    },

    tabActive: {
      backgroundColor:
        COLORS.primary,
      borderColor:
        COLORS.primary,
    },

    tabText: {
      fontSize: 12,
      fontWeight: '700',
      color:
        COLORS.textSecondary,
    },

    tabTextActive: {
      color:
        COLORS.white,
    },

    tabCount: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.background,
    },

    tabCountActive: {
      backgroundColor:
        COLORS.white,
    },

    tabCountText: {
      fontSize: 10,
      fontWeight: '800',
      color:
        COLORS.textSecondary,
    },

    tabCountTextActive: {
      color:
        COLORS.primary,
    },

    // ========================================================
    // ERROR
    // ========================================================

    errorBox: {
      marginHorizontal: 18,
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        '#F1C4C4',
      backgroundColor:
        COLORS.redSoft,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    errorText: {
      flex: 1,
      fontSize: 12,
      color:
        COLORS.red,
    },

    retryText: {
      fontSize: 12,
      fontWeight: '800',
      color:
        COLORS.primary,
    },

    // ========================================================
    // LOADING
    // ========================================================

    loadingContainer: {
      flex: 1,
      minHeight: 250,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 10,
    },

    loadingText: {
      fontSize: 13,
      color:
        COLORS.textSecondary,
    },

    // ========================================================
    // EMPTY
    // ========================================================

    listEmptyContent: {
      flexGrow: 1,
    },

    emptyContainer: {
      flex: 1,
      minHeight: 260,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 25,
    },

    emptyIcon: {
      width: 65,
      height: 65,
      borderRadius: 33,
      backgroundColor:
        COLORS.primarySoft,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 12,
    },

    emptyTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.black,
      marginBottom: 5,
    },

    emptyText: {
      fontSize: 12,
      color:
        COLORS.textSecondary,
      textAlign: 'center',
      maxWidth: 350,
    },

    emptyRefresh: {
      marginTop: 15,
      minHeight: 38,
      paddingHorizontal: 15,
      borderRadius: 9,
      backgroundColor:
        COLORS.primary,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
    },

    emptyRefreshText: {
      color:
        COLORS.white,
      fontSize: 12,
      fontWeight: '700',
    },

    // ========================================================
    // MOBILE
    // ========================================================

    mobileList: {
      padding: 12,
      paddingBottom: 30,
    },

    mobileCard: {
      width: '100%',
      backgroundColor:
        COLORS.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        '#E7EAE8',
      padding: 13,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 5,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      elevation: 2,
    },

    cardHover: {
      borderColor:
        COLORS.primary,
      backgroundColor:
        COLORS.hover,
    },

    mobileHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor:
        '#F0F2F1',
    },

    avatarFrame: {
      position: 'relative',
      flexShrink: 0,
      marginRight: 11,
      backgroundColor: COLORS.avatar,
      borderWidth: 2,
      borderColor: COLORS.white,
      overflow: 'visible',
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.10,
      shadowRadius: 5,
      shadowOffset: {
        width: 0,
        height: 2,
      },
    },

    avatar: {
      width: '100%',
      height: '100%',
      backgroundColor: COLORS.avatar,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },

    avatarText: {
      fontSize: 16,
      fontWeight: '800',
      color:
        COLORS.primary,
    },

    avatarImage: {
      backgroundColor: COLORS.avatar,
    },

    onlineIndicator: {
      position: 'absolute',
      right: -5,
      bottom: -5,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },

    onlineIndicatorInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#22C55E',
      borderWidth: 1,
      borderColor: '#16A34A',
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
      color: COLORS.black,
      flexShrink: 1,
    },

    presenceBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },

    presenceBadgeOnline: {
      backgroundColor: COLORS.blueSoft,
    },

    presenceBadgeOffline: {
      backgroundColor: COLORS.background,
    },

    presenceBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },

    presenceBadgeTextOnline: {
      color: COLORS.blue,
    },

    presenceBadgeTextOffline: {
      color: COLORS.textLight,
    },

    bookingId: {
      marginTop: 2,
      fontSize: 10,
      color:
        COLORS.textLight,
    },

    phone: {
      marginTop: 1,
      fontSize: 10,
      color:
        COLORS.textSecondary,
      flexShrink: 1,
    },

    contactLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },

    webContactLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 2,
    },

    timelineBox: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor:
        COLORS.divider,
      gap: 4,
    },

    statusBadge: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 12,
    },

    statusText: {
      fontSize: 10,
      fontWeight: '800',
    },

    infoRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 7,
      minHeight: 34,
    },

    iconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor:
        COLORS.primarySoft,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 9,
    },

    infoContent: {
      flex: 1,
    },

    infoLabel: {
      fontSize: 9,
      color:
        COLORS.textLight,
      marginBottom: 1,
    },

    infoValue: {
      fontSize: 12,
      fontWeight: '700',
      color:
        COLORS.text,
    },

    addressRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap: 6,
      paddingVertical: 7,
      borderTopWidth: 1,
      borderTopColor:
        COLORS.divider,
    },

    address: {
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
      color:
        COLORS.textSecondary,
    },

    dateRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      marginTop: 3,
    },

    dateText: {
      fontSize: 10,
      color:
        COLORS.textSecondary,
    },

    priceSection: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor:
        COLORS.divider,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    priceLabel: {
      fontSize: 9,
      color:
        COLORS.textLight,
    },

    price: {
      marginTop: 2,
      fontSize: 19,
      fontWeight: '900',
      color:
        COLORS.primary,
    },

    confirmedBadge: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor:
        COLORS.primarySoft,
    },

    confirmedText: {
      fontSize: 10,
      fontWeight: '800',
      color:
        COLORS.primary,
    },

    detailButton: {
      marginTop: 9,
      minHeight: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: '#FAFBFA',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },

    detailButtonText: {
      fontSize: 10,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },

    actionsRow: {
      flexDirection:
        'row',
      gap: 7,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#F0F2F1',
    },

    actionButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
      flexDirection:
        'row',
      gap: 5,
      borderWidth: 1,
    },

    acceptButton: {
      backgroundColor:
        COLORS.primary,
      borderColor:
        COLORS.primary,
    },

    acceptButtonText: {
      color:
        COLORS.white,
      fontSize: 11,
      fontWeight: '800',
    },

    negotiationButton: {
      backgroundColor:
        COLORS.primarySoft,
      borderColor:
        COLORS.primary,
    },

    negotiationText: {
      color:
        COLORS.primary,
      fontSize: 11,
      fontWeight: '800',
    },

    rejectButton: {
      backgroundColor:
        COLORS.redSoft,
      borderColor:
        '#F0CACA',
    },

    rejectText: {
      color:
        COLORS.red,
      fontSize: 11,
      fontWeight: '800',
    },

    confirmedRow: {
      marginTop: 12,
      paddingVertical: 9,
      borderRadius: 9,
      backgroundColor:
        COLORS.primarySoft,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 6,
    },

    confirmedRowText: {
      fontSize: 11,
      fontWeight: '800',
      color:
        COLORS.primary,
    },

    disabled: {
      opacity: 0.55,
    },

    // ========================================================
    // WEB TABLE
    // ========================================================

    webTableContainer: {
      flex: 1,
      width: '100%',
      backgroundColor:
        COLORS.white,
      overflow: 'hidden',
    },

    tableHeader: {
      minHeight: 44,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.tableHeader,
      borderBottomWidth: 1,
      borderBottomColor:
        COLORS.border,

      // React Native Web
      position: 'sticky',
      top: 0,
      zIndex: 10,
    },

    tableHeaderText: {
      fontSize: 9,
      fontWeight: '900',
      color:
        COLORS.textSecondary,
      letterSpacing: 0.4,
    },

    tableRow: {
      minHeight: 66,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.white,
      borderBottomWidth: 1,
      borderBottomColor:
        COLORS.divider,
    },

    tableRowHover: {
      backgroundColor:
        COLORS.hover,
    },

    colClient: {
      width: '15%',
      paddingHorizontal: 10,
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
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    onlineIndicator: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 5,
    },

    onlineIndicatorInner: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: '#22C55E',
      borderWidth: 1,
      borderColor: '#16A34A',
    },

    smallAvatar: {
      width: 34,
      height: 34,
      borderRadius: 7,
      backgroundColor:
        COLORS.avatar,
      borderWidth: 1,
      borderColor: COLORS.white,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 7,
    },

    smallAvatarText: {
      fontSize: 13,
      fontWeight: '800',
      color:
        COLORS.primary,
    },

    webClientInfo: {
      flex: 1,
      minWidth: 0,
    },

    webClientName: {
      fontSize: 11,
      fontWeight: '800',
      color:
        COLORS.black,
    },

    webBookingId: {
      fontSize: 9,
      color:
        COLORS.textLight,
      marginTop: 2,
    },

    tableMainText: {
      fontSize: 10,
      fontWeight: '700',
      color:
        COLORS.text,
    },

    tableSubText: {
      fontSize: 9,
      color:
        COLORS.textLight,
      marginTop: 2,
    },

    webAddress: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap: 4,
    },

    tableAddress: {
      flex: 1,
      fontSize: 9,
      lineHeight: 13,
      color:
        COLORS.textSecondary,
    },

    tablePrice: {
      fontSize: 11,
      fontWeight: '900',
      color:
        COLORS.primary,
    },

    tableStatus: {
      minHeight: 26,
      paddingHorizontal: 7,
      borderRadius: 13,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
      alignSelf:
        'flex-start',
    },

    tableStatusText: {
      fontSize: 9,
      fontWeight: '800',
    },

    tableActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
    },

    tableAction: {
      width: 30,
      height: 30,
      borderRadius: 7,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
    },

    tableAccept: {
      backgroundColor:
        COLORS.primary,
      borderColor:
        COLORS.primary,
    },

    tableNegotiation: {
      backgroundColor:
        COLORS.primarySoft,
      borderColor:
        COLORS.primary,
    },

    tableReject: {
      backgroundColor:
        COLORS.redSoft,
      borderColor:
        '#F0CACA',
    },

    doneWeb: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
    },

    doneWebText: {
      fontSize: 9,
      fontWeight: '800',
      color:
        COLORS.primary,
    },

    pressed: {
      opacity: 0.75,
    },
  });