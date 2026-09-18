// src/screens/therapist/NegotiationScreen.js

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
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing } from '../../theme';

import Header from '../../components/common/Header';
import TherapistBottomMenu from '../../components/common/TherapistBottomMenu';

// ============================================================
// ANDROID STATUS BAR
//
// Amin'ny Android, ny SafeAreaView irery dia tsy manisy
// "inset" eo amin'ny ambony (contrairement amin'ny iOS),
// ka ny header dia mety "hilentika" ao ambanin'ny status
// bar / icone batterie. Ampiasaina eto ny StatusBar.currentHeight
// mba hanomezana toerana marina ny header.
// ============================================================

const ANDROID_STATUS_BAR_HEIGHT =
  Platform.OS === 'android'
    ? StatusBar.currentHeight || 24
    : 0;

// ============================================================
// (header remplacé par le composant commun `Header` — voir
// import ci-dessus)
// ============================================================

// ============================================================
// CLIENT AVATAR (photo de profil ou initiale)
// ============================================================

const ClientAvatar = ({
  photoUrl,
  name,
  size = 58,
}) => {
  const [failed, setFailed] = useState(false);

  const showImage = !!photoUrl && !failed;

  const dimensionStyle = {
    width: size,
    height: size,
    borderRadius: 12,
  };

  const initial = String(name || 'C')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <View style={[clientAvatarStyles.wrapper, dimensionStyle]}>
      {showImage ? (
        <Image
          source={{ uri: photoUrl }}
          style={[clientAvatarStyles.image, dimensionStyle]}
          onError={() => setFailed(true)}
          accessibilityLabel={`Photo de profil de ${name}`}
        />
      ) : (
        <View style={[clientAvatarStyles.fallback, dimensionStyle]}>
          <Text
            style={[
              clientAvatarStyles.fallbackText,
              { fontSize: size * 0.38 },
            ]}
          >
            {initial || 'C'}
          </Text>
        </View>
      )}

    </View>
  );
};

const clientAvatarStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    borderWidth: 2,
    borderColor: `${colors.primary}33`,
    backgroundColor: '#FFFFFF',
  },

  image: {
    backgroundColor: `${colors.primary}14`,
    borderWidth: 0,
  },

  fallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fallbackText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

});

import offerService from '../../services/offerService';
import bookingService from '../../services/bookingService';

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
            color={destructive ? '#D93636' : colors.primary}
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
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 5000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  modal: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${colors.primary}14`,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 12,
  },
  title: {
    fontSize: 18, fontWeight: '900', color: '#111111', textAlign: 'center',
  },
  message: {
    marginTop: 8, fontSize: 13, lineHeight: 20,
    color: '#555555', textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row', gap: 10, marginTop: 20,
  },
  cancelButton: {
    flex: 1, minHeight: 46, borderRadius: 11,
    backgroundColor: '#F1F2F1',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmButton: {
    flex: 1, minHeight: 46, borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmDanger: { backgroundColor: '#D93636' },
  cancelText: { color: '#333333', fontSize: 12, fontWeight: '800' },
  confirmText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});

// ============================================================
// HELPERS
// ============================================================

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(',', '.');

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : fallback;
};

const formatPrice = (value) => {
  const number = Math.round(toNumber(value));

  return `${number.toLocaleString('fr-FR')} Ar`;
};

const formatDate = (date) => {
  if (!date) {
    return '';
  }

  try {
    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
      return String(date);
    }

    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(date);
  }
};

// ============================================================
// OFFER HELPERS
// ============================================================

const getOfferId = (offer) => {
  if (!offer) {
    return null;
  }

  return (
    offer.id ??
    offer.offer_id ??
    offer.offerId ??
    null
  );
};

const getOfferPrice = (offer) => {
  if (!offer) {
    return 0;
  }

  return toNumber(
    offer.price_offered ??
      offer.priceOffered ??
      offer.price ??
      offer.counter_price ??
      offer.counterPrice ??
      0
  );
};

const normalizeOfferType = (offer) => {
  if (!offer) {
    return '';
  }

  const raw = String(
    offer.user_type ??
      offer.userType ??
      offer.sender_type ??
      offer.senderType ??
      offer.role ??
      ''
  )
    .trim()
    .toLowerCase();

  if (
    raw === 'client' ||
    raw === 'customer' ||
    raw === 'user' ||
    raw === 'customer_user'
  ) {
    return 'client';
  }

  if (
    raw === 'therapist' ||
    raw === 'therapeute' ||
    raw === 'thérapeute' ||
    raw === 'provider' ||
    raw === 'professional'
  ) {
    return 'therapist';
  }

  return raw;
};

const getOfferStatus = (offer) => {
  if (!offer) {
    return '';
  }

  return String(
    offer.status ??
      offer.offer_status ??
      ''
  )
    .trim()
    .toLowerCase();
};

const isActiveOffer = (offer) => {
  const status = getOfferStatus(offer);

  return (
    status === 'sent' ||
    status === 'pending' ||
    status === 'active'
  );
};

const extractErrorMessage = (result) => {
  if (!result) {
    return 'Une erreur est survenue.';
  }

  if (typeof result.error === 'string') {
    return result.error;
  }

  if (result.error?.message) {
    return result.error.message;
  }

  if (result.error?.data?.message) {
    return result.error.data.message;
  }

  if (result.data?.message) {
    return result.data.message;
  }

  if (result.message) {
    return result.message;
  }

  return 'Une erreur est survenue.';
};

const isApprovalError = (message) => {
  const text = String(message || '').toLowerCase();

  return (
    text.includes('pas encore approuvé') ||
    text.includes('pas approuvé') ||
    text.includes('non approuvé') ||
    text.includes('not approved') ||
    text.includes('therapist account') ||
    text.includes('compte thérapeute')
  );
};

// ============================================================
// BOOKING STATUS HELPERS
//
// Ireto avokoa ny "status" / "booking_status" hita ao
// amin'ny base de données :
//
//   pending                 -> mbola tsy nisy offre
//   negotiating             -> misy negociation mandeha
//   confirmed               -> nisy offre neken'ny roa tonta
//   in_progress             -> service efa nanomboka
//   completed               -> vita ny service
//   cancelled_by_client     -> nofoanan'ny client
//   cancelled_by_therapist  -> nofoanan'ny thérapeute
//   expired                 -> lany fotoana (tsy voavaly)
//
// Ny negociation (bouton Accepter / Envoyer) dia tokony
// mandeha (== "clickable") RAHA ARY IHANY raha mbola
// "pending" na "negotiating" ny booking. Amin'ny status
// hafa rehetra (confirmed, in_progress, completed,
// cancelled_*, expired) dia efa VITA/TAPAKA ny negociation
// ka tsy tokony azo tsindriana intsony ireo bouton ireo.
// ============================================================

const NEGOTIABLE_BOOKING_STATUSES = [
  'pending',
  'negotiating',
];

const BOOKING_STATUS_LABELS = {
  pending: 'En attente',
  negotiating: 'En négociation',
  confirmed: 'Confirmée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled_by_client: 'Annulée par le client',
  cancelled_by_therapist: 'Annulée par le thérapeute',
  expired: 'Expirée',
};

const BOOKING_STATUS_COLORS = {
  pending: '#F5B642',
  negotiating: '#2D9CDB',
  confirmed: colors.primary,
  in_progress: '#7B61FF',
  completed: colors.primary,
  cancelled_by_client: '#E53935',
  cancelled_by_therapist: '#E53935',
  expired: '#9E9E9E',
};

const normalizeBookingStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase();

const getBookingStatusLabel = (status) => {
  const key = normalizeBookingStatus(status);

  return (
    BOOKING_STATUS_LABELS[key] ||
    (key ? key : 'Statut inconnu')
  );
};

const getBookingStatusColor = (status) => {
  const key = normalizeBookingStatus(status);

  return (
    BOOKING_STATUS_COLORS[key] ||
    '#9E9E9E'
  );
};

const isNegotiableBookingStatus = (status) => {
  const key = normalizeBookingStatus(status);

  return NEGOTIABLE_BOOKING_STATUSES.includes(key);
};

// ============================================================
// SCREEN
// ============================================================

const NegotiationScreen = ({
  navigation,
  route,
}) => {
  const params = route?.params || {};

  // ✅ FIX : "Negotiation" dia écran root izao (ivelan'ny
  // Tab.Navigator), ka tsy miseho ho azy intsony ny tab bar —
  // TherapistBottomMenu manokana no mampiseho azy eto, mijoro
  // eo amin'ilay tab niaingana (Calendrier na Demandes).
  const activeTab = params.activeTab || 'Demandes';

  // ==========================================================
  // BOOKING
  // ==========================================================

  const bookingId =
    params.bookingId ??
    params.booking_id ??
    params.booking?.id ??
    params.booking?.booking_id ??
    null;

  const clientName =
    params.clientName ??
    params.client_name ??
    params.booking?.client?.fullname ??
    params.booking?.client?.full_name ??
    params.booking?.client?.name ??
    params.booking?.client_fullname ??
    params.booking?.client_name ??
    'Client';

  const clientPhoto =
    params.clientPhoto ??
    params.client_photo ??
    params.booking?.client?.profile_image ??
    params.booking?.client?.photo ??
    params.booking?.client?.avatar ??
    params.booking?.client_photo ??
    params.booking?.client_profile_image ??
    null;

  // ==========================================================
  // CLIENT CONTACT + ONLINE STATUS
  // ==========================================================

  const clientPhone =
    params.clientPhone ??
    params.client_phone ??
    params.booking?.client?.phone ??
    params.booking?.client?.phone_number ??
    params.booking?.client?.telephone ??
    params.booking?.client_phone ??
    params.booking?.client_phone_number ??
    'Non renseigné';

  const clientEmail =
    params.clientEmail ??
    params.client_email ??
    params.booking?.client?.email ??
    params.booking?.client_email ??
    'Non renseigné';

  const clientOnlineValue =
    params.clientOnline ??
    params.client_online ??
    params.isClientOnline ??
    params.is_client_online ??
    params.booking?.client?.is_online ??
    params.booking?.client?.isOnline ??
    params.booking?.client?.online ??
    params.booking?.client?.online_status ??
    params.booking?.client?.presence ??
    false;

  const isClientOnline =
    clientOnlineValue === true ||
    clientOnlineValue === 1 ||
    String(clientOnlineValue).toLowerCase() === 'true' ||
    String(clientOnlineValue).toLowerCase() === 'online' ||
    String(clientOnlineValue).toLowerCase() === 'en ligne' ||
    String(clientOnlineValue).toLowerCase() === 'connected' ||
    String(clientOnlineValue).toLowerCase() === 'connecté';

  // ==========================================================
  // INITIAL CLIENT OFFER
  // ==========================================================

  const initialClientOffer =
    params.clientOffer ??
    params.client_offer ??
    null;

  const initialClientOfferId =
    params.clientOfferId ??
    params.client_offer_id ??
    params.offerId ??
    initialClientOffer?.id ??
    initialClientOffer?.offer_id ??
    null;

  const initialPrice = toNumber(
    params.currentPrice ??
      params.current_price ??
      initialClientOffer?.price_offered ??
      initialClientOffer?.price ??
      params.booking?.client_price_proposed ??
      params.booking?.client_price ??
      params.booking?.proposed_price ??
      params.booking?.price ??
      0
  );

  // ==========================================================
  // INITIAL BOOKING STATUS
  // ==========================================================

  const initialBookingStatus =
    params.bookingStatus ??
    params.booking_status ??
    params.booking?.status ??
    'pending';

  // ==========================================================
  // THEME
  // ==========================================================

  const { colors: themeColors } = useTheme();

  // ==========================================================
  // IMPORTANT STATES
  //
  // clientOfferId = ID utilisé pour /counter
  // therapistOfferId = nouvelle offre créée par thérapeute
  // ==========================================================

  const [
    bookingStatus,
    setBookingStatus,
  ] = useState(initialBookingStatus);

  const [
    clientOfferId,
    setClientOfferId,
  ] = useState(initialClientOfferId);

  const [
    therapistOfferId,
    setTherapistOfferId,
  ] = useState(null);

  const [
    currentPrice,
    setCurrentPrice,
  ] = useState(initialPrice);

  const [
    counterPrice,
    setCounterPrice,
  ] = useState(
    initialPrice > 0
      ? String(Math.round(initialPrice))
      : ''
  );

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    negotiationHistory,
    setNegotiationHistory,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    accepting,
    setAccepting,
  ] = useState(false);

  const [
    selectedPrice,
    setSelectedPrice,
  ] = useState(null);

  const [
    rejecting,
    setRejecting,
  ] = useState(false);

  const [
    toast,
    setToast,
  ] = useState(null);

  const [confirmModal, setConfirmModal] = useState(null);

  const toastTimerRef =
    useRef(null);

  const showToast = useCallback(
    (type, text) => {
      if (toastTimerRef.current) {
        clearTimeout(
          toastTimerRef.current
        );
      }

      setToast({ type, text });

      toastTimerRef.current =
        setTimeout(() => {
          setToast(null);
        }, 3000);
    },
    []
  );

  const fadeAnim =
    useRef(new Animated.Value(0)).current;

  // ==========================================================
  // FIND ACTIVE CLIENT OFFER
  // ==========================================================

  const findActiveClientOffer = useCallback(
    (offers) => {
      if (!Array.isArray(offers)) {
        return null;
      }

      const clientOffers = offers.filter(
        (offer) =>
          normalizeOfferType(offer) === 'client'
      );

      if (!clientOffers.length) {
        return null;
      }

      // Priorité à sent
      const sent = clientOffers.find(
        (offer) =>
          getOfferStatus(offer) === 'sent'
      );

      if (sent) {
        return sent;
      }

      // Ensuite pending/active
      const active = clientOffers.find(
        (offer) =>
          isActiveOffer(offer)
      );

      return active || null;
    },
    []
  );

  // ==========================================================
  // FIND ACTIVE THERAPIST OFFER
  // ==========================================================

  const findActiveTherapistOffer =
    useCallback(
      (offers) => {
        if (!Array.isArray(offers)) {
          return null;
        }

        const therapistOffers =
          offers.filter(
            (offer) =>
              normalizeOfferType(offer) ===
              'therapist'
          );

        if (!therapistOffers.length) {
          return null;
        }

        return (
          therapistOffers.find(
            (offer) =>
              getOfferStatus(offer) ===
              'sent'
          ) ||
          therapistOffers.find(
            (offer) =>
              isActiveOffer(offer)
          ) ||
          null
        );
      },
      []
    );

  // ==========================================================
  // LOAD HISTORY
  // ==========================================================

  const loadHistory = useCallback(
    async (showLoader = true) => {
      if (!bookingId) {
        setLoading(false);
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        console.log(
          '================================================'
        );

        console.log(
          '📥 [NEGOTIATION] LOAD HISTORY'
        );

        console.log(
          'BOOKING ID:',
          bookingId
        );

        // ====================================================
        // BOOKING STATUS
        //
        // Alaina ao amin'ny backend ny status marina
        // an'ilay booking (pending / negotiating /
        // confirmed / in_progress / completed /
        // cancelled_by_client / cancelled_by_therapist /
        // expired) mba hahafahana mamaha na mandrara
        // ireo bouton Accepter/Envoyer araka izay tena
        // status misy azy.
        // ====================================================

        try {
          const bookingResult =
            await bookingService.getBooking(
              bookingId
            );

          if (
            bookingResult?.success &&
            bookingResult?.data?.status
          ) {
            console.log(
              '📦 [NEGOTIATION] BOOKING STATUS:',
              bookingResult.data.status
            );

            setBookingStatus(
              bookingResult.data.status
            );
          }
        } catch (statusError) {
          console.error(
            '❌ [NEGOTIATION] BOOKING STATUS ERROR:',
            statusError
          );
        }

        const result =
          await offerService.getOffersByBooking(
            bookingId
          );

        console.log(
          '📦 [NEGOTIATION] HISTORY RESULT:',
          result
        );

        if (!result?.success) {
          throw new Error(
            extractErrorMessage(result)
          );
        }

        const data = Array.isArray(
          result.data
        )
          ? result.data
          : [];

        setNegotiationHistory(data);

        // Reset active IDs before recalculating the current turn.
        // This prevents a previous offer ID from keeping buttons
        // clickable after the offer has been accepted/rejected.
        setClientOfferId(null);
        setTherapistOfferId(null);

        // ====================================================
        // CLIENT ACTIVE OFFER
        // ====================================================

        const activeClientOffer =
          findActiveClientOffer(data);

        if (activeClientOffer) {
          const id =
            getOfferId(
              activeClientOffer
            );

          const price =
            getOfferPrice(
              activeClientOffer
            );

          console.log(
            '👤 ACTIVE CLIENT OFFER:',
            {
              id,
              price,
            }
          );

          if (id !== null && id !== undefined) {
            setClientOfferId(id);
          }
          setTherapistOfferId(null);

          if (price > 0) {
            setCurrentPrice(price);

            // Si le champ est vide, on remet
            // le prix client.
            setCounterPrice(
              (previous) =>
                previous
                  ? previous
                  : String(
                      Math.round(price)
                    )
            );
          }

          return;
        }

        // ====================================================
        // NO CLIENT ACTIVE OFFER
        // ====================================================

        console.log(
          'ℹ️ Aucun client offer active.'
        );

        const activeTherapistOffer =
          findActiveTherapistOffer(data);

        if (activeTherapistOffer) {
          const therapistId =
            getOfferId(
              activeTherapistOffer
            );

          const therapistPrice =
            getOfferPrice(
              activeTherapistOffer
            );

          console.log(
            '🧑‍⚕️ ACTIVE THERAPIST OFFER:',
            {
              therapistId,
              therapistPrice,
            }
          );

          if (
            therapistId !== null &&
            therapistId !== undefined
          ) {
            setTherapistOfferId(
              therapistId
            );
          }
          setClientOfferId(null);

          if (therapistPrice > 0) {
            setCurrentPrice(
              therapistPrice
            );
          }
        }
      } catch (error) {
        console.error(
          '❌ [NEGOTIATION] LOAD ERROR:',
          error
        );

        Alert.alert(
          'Erreur',
          error?.message ||
            'Impossible de charger la négociation.'
        );
      } finally {
        setLoading(false);
      }
    },
    [
      bookingId,
      findActiveClientOffer,
      findActiveTherapistOffer,
    ]
  );

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    Animated.timing(
      fadeAnim,
      {
        toValue: 1,
        duration: 350,
        useNativeDriver:
          Platform.OS !== 'web',
      }
    ).start();

    loadHistory(true);
  }, [
    fadeAnim,
    loadHistory,
  ]);

  // ==========================================================
  // REFRESH ON FOCUS
  // ==========================================================

  useEffect(() => {
    const unsubscribe =
      navigation.addListener(
        'focus',
        () => {
          loadHistory(false);
        }
      );

    return unsubscribe;
  }, [
    navigation,
    loadHistory,
  ]);

  // ==========================================================
  // SUGGESTIONS
  // ==========================================================

  const suggestedPrices =
    useMemo(() => {
      if (currentPrice <= 0) {
        return [];
      }

      return [
        {
          label: '-5%',
          value: Math.max(
            10000,
            Math.round(
              currentPrice * 0.95
            )
          ),
        },
        {
          label: '+5%',
          value: Math.round(
            currentPrice * 1.05
          ),
        },
        {
          label: '+10%',
          value: Math.round(
            currentPrice * 1.1
          ),
        },
        {
          label: '+15%',
          value: Math.round(
            currentPrice * 1.15
          ),
        },
      ];
    }, [
      currentPrice,
    ]);

  // ==========================================================
  // SELECT PRICE
  // ==========================================================

  const selectSuggestedPrice = (value) => {
    setSelectedPrice(value);
    setCounterPrice(
      String(value)
    );
    showToast('success', `Prix ${formatPrice(value)} sélectionné.`);
  };

  // ==========================================================
  // DIFFERENCE
  // ==========================================================

  const getPriceDifference = (
    price
  ) => {
    if (currentPrice <= 0) {
      return '';
    }

    const diff =
      Number(price) -
      Number(currentPrice);

    const sign =
      diff > 0
        ? '+'
        : '';

    return `${sign}${Math.round(
      diff
    ).toLocaleString(
      'fr-FR'
    )} Ar`;
  };

  // ==========================================================
  // SEND OFFER / COUNTER OFFER
  //
  // THERAPIST
  //
  // Misy toe-javatra roa mety hitranga rehefa tsindrian'ny
  // thérapeute ny bouton "Envoyer" :
  //
  //  1) MBOLA TSY MISY NEGOCIATION MIHITSY (booking vao
  //     "pending", tsy mbola nisy Negotiation record) ->
  //     ny prix voalohan'ny client dia eo amin'ny booking
  //     mihitsy (client_price_proposed), TSY offre. Amin'io
  //     toe-javatra io dia POST /offers/create no ilaina
  //     (offerService.sendOffer), fa TSY /offers/{id}/counter,
  //     satria tsy misy offre azo "countrarina".
  //
  //  2) MISY OFFRE CLIENT MIANDRY VALINY (clientOfferId
  //     existe) -> eto vao POST /offers/{CLIENT_OFFER_ID}/counter
  //     (offerService.counterOffer) no ilaina.
  //
  // Raha efa misy OFFRE THÉRAPEUTE MANDEHA (therapistOfferId,
  // "sent") ka mbola tsy namaly ny client, dia tokony tsy
  // azo alefa intsony ny "Envoyer" (miandry ny client).
  // ==========================================================

  const executeSendOffer =
    async () => {
      if (submitting || accepting) {
        return;
      }

      // ------------------------------------------------------
      // BOOKING STATUS
      // ------------------------------------------------------

      if (!isNegotiableBookingStatus(bookingStatus)) {
        showToast(
          'error',
          `Négociation fermée : ${getBookingStatusLabel(bookingStatus)}.`
        );
        return;
      }

      // ------------------------------------------------------
      // BOOKING
      // ------------------------------------------------------

      if (!bookingId) {
        showToast('error', 'Identifiant de réservation manquant.');
        return;
      }

      const hasActiveClientOffer =
        clientOfferId !== null &&
        clientOfferId !== undefined &&
        clientOfferId !== '';

      const hasActiveTherapistOffer =
        therapistOfferId !== null &&
        therapistOfferId !== undefined &&
        therapistOfferId !== '';

      // ------------------------------------------------------
      // ATTENTE DU CLIENT
      //
      // Efa misy offre thérapeute mandeha ary mbola tsy
      // namaly ny client -> aza avela handefa hafa.
      // ------------------------------------------------------

      if (
        !hasActiveClientOffer &&
        hasActiveTherapistOffer
      ) {
        showToast('error', 'Votre proposition a déjà été envoyée. Attendez la réponse du client.');
        return;
      }

      // ------------------------------------------------------
      // PRICE
      // ------------------------------------------------------

      const numericPrice =
        toNumber(
          counterPrice
        );

      if (
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice <= 0
      ) {
        showToast('error', 'Veuillez saisir un prix valide.');
        return;
      }

      // ------------------------------------------------------
      // MINIMUM
      // ------------------------------------------------------

      if (numericPrice < 10000) {
        showToast('error', 'Le prix minimum est de 10 000 Ar.');
        return;
      }

      try {
        setSubmitting(true);

        console.log(
          '================================================'
        );

        console.log(
          '📤 [NEGOTIATION] SEND OFFER'
        );

        console.log(
          'BOOKING:',
          bookingId
        );

        console.log(
          'MODE:',
          hasActiveClientOffer
            ? 'COUNTER (client offer id: ' +
                clientOfferId +
                ')'
            : 'CREATE (première offre thérapeute)'
        );

        console.log(
          'PRICE:',
          numericPrice
        );

        console.log(
          'MESSAGE:',
          message
        );

        console.log(
          '================================================'
        );

        // IMPORTANT :
        // - S'il existe une offre CLIENT active -> /counter
        // - Sinon -> /create (première offre du thérapeute)
        const result =
          hasActiveClientOffer
            ? await offerService.counterOffer(
                clientOfferId,
                numericPrice,
                message
              )
            : await offerService.sendOffer(
                bookingId,
                numericPrice,
                message
              );

        console.log(
          '📦 [NEGOTIATION] SEND RESULT:',
          result
        );

        if (!result?.success) {
          const errorMessage =
            extractErrorMessage(
              result
            );

          // --------------------------------------------------
          // APPROVAL ERROR
          // --------------------------------------------------

          if (
            isApprovalError(
              errorMessage
            )
          ) {
            showToast('error', 'Votre compte thérapeute n’est pas encore approuvé.');

            return;
          }

          throw new Error(
            errorMessage
          );
        }

        // ====================================================
        // NEW THERAPIST OFFER
        // ====================================================

        const newOffer =
          result.data || {};

        const newTherapistOfferId =
          getOfferId(
            newOffer
          );

        console.log(
          '✅ NEW THERAPIST OFFER ID:',
          newTherapistOfferId
        );

        if (
          newTherapistOfferId !==
            null &&
          newTherapistOfferId !==
            undefined
        ) {
          setTherapistOfferId(
            newTherapistOfferId
          );
        }

        // IMPORTANT :
        // Ne PAS faire :
        //
        // setClientOfferId(newTherapistOfferId)
        //
        // car /counter nécessite l'offre CLIENT.

        // La contre-offre du thérapeute ferme l'offre
        // client précédente : on la retire localement en
        // attendant le rechargement complet ci-dessous.
        setClientOfferId(null);

        setCurrentPrice(
          numericPrice
        );

        setCounterPrice('');

        setMessage('');

        setSelectedPrice(null);

        // ====================================================
        // RELOAD
        // ====================================================

        await loadHistory(false);

        // ====================================================
        // SUCCESS
        // ====================================================

        showToast(
          'success',
          `${hasActiveClientOffer ? 'Contre-proposition envoyée' : 'Proposition envoyée'} : ${formatPrice(numericPrice)}.`
        );
      } catch (error) {
        console.error(
          '❌ [NEGOTIATION] SEND ERROR:',
          error
        );

        const errorMessage =
          error?.message ||
          'Impossible d’envoyer la proposition.';

        if (
          isApprovalError(
            errorMessage
          )
        ) {
          showToast('error', 'Votre compte thérapeute doit être approuvé avant de pouvoir envoyer une proposition.');
        } else {
          showToast('error', errorMessage);
        }
      } finally {
        setSubmitting(false);
      }
    };

  const handleSubmitCounter = () => {
    if (submitting || accepting || rejecting) return;

    if (!isNegotiableBookingStatus(bookingStatus)) {
      showToast('error', `Négociation fermée : ${getBookingStatusLabel(bookingStatus)}.`);
      return;
    }

    if (!bookingId) {
      showToast('error', 'Identifiant de réservation manquant.');
      return;
    }

    const hasActiveClientOfferNow =
      clientOfferId !== null && clientOfferId !== undefined && clientOfferId !== '';
    const hasActiveTherapistOfferNow =
      therapistOfferId !== null && therapistOfferId !== undefined && therapistOfferId !== '';

    if (!hasActiveClientOfferNow && hasActiveTherapistOfferNow) {
      showToast('error', 'Votre proposition a déjà été envoyée. Attendez la réponse du client.');
      return;
    }

    const numericPrice = toNumber(counterPrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 10000) {
      showToast('error', 'Veuillez saisir un prix valide d’au moins 10 000 Ar.');
      return;
    }

    setConfirmModal({
      title: hasActiveClientOfferNow
        ? 'Envoyer la contre-proposition ?'
        : 'Envoyer la proposition ?',
      message: `${hasActiveClientOfferNow ? 'Envoyer votre contre-proposition' : 'Envoyer votre proposition'} de ${formatPrice(numericPrice)} au client ?`,
      confirmLabel: 'Envoyer',
      destructive: false,
      onConfirm: () => {
        setConfirmModal(null);
        executeSendOffer();
      },
    });
  };

  // ==========================================================
  // ACCEPT CLIENT PRICE
  //
  // THERAPIST
  // ->
  // CREATE OFFER AT SAME PRICE
  // ==========================================================

  // ==========================================================
  // ACCEPT CLIENT OFFER
  //
  // IMPORTANT:
  // Le thérapeute accepte l'OFFRE CLIENT directement.
  //
  // POST /offers/{offer_id}/accept
  //
  // offerId = clientOfferId
  //
  // Ne plus utiliser bookingService.completeBooking() ici :
  // l'acceptation doit passer par offerService.acceptOffer().
  // ==========================================================

  const executeAccept =
    async () => {
      if (accepting || submitting) {
        return;
      }

      if (!isNegotiableBookingStatus(bookingStatus)) {
        showToast('error', `Négociation fermée : ${getBookingStatusLabel(bookingStatus)}.`);
        return;
      }

      const hasActiveClientOfferNow =
        clientOfferId !== null &&
        clientOfferId !== undefined &&
        clientOfferId !== '';

      const hasActiveTherapistOfferNow =
        therapistOfferId !== null &&
        therapistOfferId !== undefined &&
        therapistOfferId !== '';

      if (
        !hasActiveClientOfferNow &&
        hasActiveTherapistOfferNow
      ) {
        showToast('error', 'Votre proposition a déjà été envoyée. Attendez la réponse du client.');
        return;
      }

      if (!hasActiveClientOfferNow) {
        showToast('error', 'Aucune offre active du client n’est disponible.');
        return;
      }

      if (!bookingId) {
        showToast('error', 'Identifiant de réservation manquant.');
        return;
      }

      if (
        !currentPrice ||
        currentPrice <= 0
      ) {
        showToast('error', 'Le prix de l’offre client est invalide.');
        return;
      }

      try {
        setAccepting(true);

        console.log(
          '================================================'
        );

        console.log(
          '📤 [NEGOTIATION] ACCEPT CLIENT OFFER'
        );

        console.log(
          'BOOKING:',
          bookingId
        );

        console.log(
          'CLIENT OFFER ID:',
          clientOfferId
        );

        console.log(
          'PRICE:',
          currentPrice
        );

        console.log(
          'ENDPOINT:',
          `/offers/${clientOfferId}/accept`
        );

        console.log(
          '================================================'
        );

        // IMPORTANT:
        // Le thérapeute accepte l'offre CLIENT par:
        //
        // POST /offers/{offer_id}/accept
        //
        // et non plus par:
        // PUT /bookings/complete/{booking_id}
        const result =
          await offerService.acceptOffer(
            clientOfferId
          );

        console.log(
          '📦 [NEGOTIATION] ACCEPT OFFER RESULT:',
          result
        );

        if (!result?.success) {
          const errorMessage =
            extractErrorMessage(result);

          if (
            isApprovalError(
              errorMessage
            )
          ) {
            showToast(
              'error',
              'Votre compte thérapeute n’est pas encore approuvé.'
            );
            return;
          }

          throw new Error(
            errorMessage
          );
        }

        setBookingStatus(
          'confirmed'
        );

        setClientOfferId(null);
        setTherapistOfferId(null);

        showToast(
          'success',
          `Offre acceptée (${formatPrice(
            currentPrice
          )}). Réservation confirmée.`
        );

        // Recharge les offres avant de revenir afin de garder
        // l'état local cohérent avec le backend.
        await loadHistory(false);

        setTimeout(() => {
          navigation.goBack();
        }, 900);
      } catch (error) {
        console.error(
          '❌ [NEGOTIATION] ACCEPT OFFER ERROR:',
          error
        );

        const errorMessage =
          error?.message ||
          'Impossible d’accepter l’offre.';

        if (
          isApprovalError(
            errorMessage
          )
        ) {
          showToast(
            'error',
            'Votre compte thérapeute doit être approuvé avant de pouvoir accepter cette offre.'
          );
        } else {
          showToast(
            'error',
            errorMessage
          );
        }
      } finally {
        setAccepting(false);
      }
    };

  // ==========================================================
  // ACCEPT CONFIRMATION
  // ==========================================================

  const handleAccept = () => {
    if (!canAccept || accepting || submitting) return;

    setConfirmModal({
      title: 'Accepter l’offre ?',
      message: `Accepter l’offre client de ${formatPrice(currentPrice)} pour cette réservation ?`,
      confirmLabel: 'Accepter',
      destructive: false,
      onConfirm: () => {
        setConfirmModal(null);
        executeAccept();
      },
    });
  };

  // ==========================================================
  // BUTTON STATES
  // ==========================================================

  const hasClientOffer =
    clientOfferId !== null &&
    clientOfferId !== undefined &&
    clientOfferId !== '';

  const hasActiveTherapistOffer =
    therapistOfferId !== null &&
    therapistOfferId !== undefined &&
    therapistOfferId !== '';

  const numericCounterPrice =
    toNumber(
      counterPrice
    );

  const hasValidCounterPrice =
    Number.isFinite(
      numericCounterPrice
    ) &&
    numericCounterPrice >= 10000;

  // ==========================================================
  // NEGOTIATION LOCK
  //
  // "pending" sy "negotiating" ihany no status mbola azo
  // anaovana negociation. Ny status hafa (confirmed,
  // in_progress, completed, cancelled_by_client,
  // cancelled_by_therapist, expired) dia midika hoe VITA
  // na TAPAKA ny booking ka tsy azo tsindriana intsony ny
  // bouton Accepter/Envoyer.
  // ==========================================================

  const isNegotiable =
    isNegotiableBookingStatus(
      bookingStatus
    );

  // ==========================================================
  // WAITING FOR CLIENT
  //
  // Efa nisy offre thérapeute nalefa ("sent") fa mbola
  // tsy namaly ny client -> aza avela handefa hafa
  // mandra-pahatongan'ny valin'ny client (na accepté na
  // countré).
  // ==========================================================

  const isWaitingForClient =
    hasActiveTherapistOffer &&
    !hasClientOffer;

  // ==========================================================
  // ENVOYER
  //
  // Azo tsindriana ("clickable") ny bouton "Envoyer" raha :
  //  - mbola azo atao ny negociation (isNegotiable), SADY
  //  - tsy miandry valin'ny client (!isWaitingForClient), SADY
  //  - misy prix marina voasoratra (hasValidCounterPrice)
  //
  // Amin'io toe-javatra io dia:
  //  - raha misy offre CLIENT active (hasClientOffer) ->
  //    contre-offre (/offers/{id}/counter)
  //  - raha tsy misy offre mihitsy (booking vao "pending") ->
  //    offre voalohany (/offers/create)
  // ==========================================================

  const canSend =
    isNegotiable &&
    !isWaitingForClient &&
    hasValidCounterPrice &&
    !submitting &&
    !accepting;

  const canAccept =
    isNegotiable &&
    hasClientOffer &&
    !accepting &&
    !submitting &&
    !rejecting;

  // ==========================================================
  // REJECT
  //
  // Refuse l'offre CLIENT active en cours de négociation.
  //
  // POST /offers/{offer_id}/reject
  // ==========================================================

  const canReject =
    isNegotiable &&
    hasClientOffer &&
    !accepting &&
    !submitting &&
    !rejecting;

  const executeReject =
    async () => {
      if (!hasClientOffer) {
        showToast(
          'error',
          'Aucune offre du client à refuser pour le moment.'
        );
        return;
      }

      try {
        setRejecting(true);

        const result =
          await offerService.rejectOffer(
            clientOfferId
          );

        if (!result?.success) {
          throw new Error(
            result?.error ||
            'Impossible de rejeter l’offre.'
          );
        }

        showToast(
          'success',
          'L’offre du client a été refusée.'
        );

        setTimeout(() => {
          navigation.goBack();
        }, 900);
      } catch (error) {
        console.error(
          '❌ [NEGOTIATION] REJECT ERROR:',
          error
        );

        showToast(
          'error',
          error?.message ||
          'Impossible de rejeter l’offre.'
        );
      } finally {
        setRejecting(false);
      }
    };

  const handleReject = () => {
    if (!canReject || rejecting) return;

    setConfirmModal({
      title: 'Refuser l’offre ?',
      message: `Refuser l’offre client de ${formatPrice(currentPrice)} ? Cette action ne peut pas être annulée.`,
      confirmLabel: 'Refuser',
      destructive: true,
      onConfirm: () => {
        setConfirmModal(null);
        executeReject();
      },
    });
  };

  // ==========================================================
  // INVALID BOOKING
  // ==========================================================

  if (!bookingId) {
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
        <Header
          title="Réservation"          showBack
          onBackPress={() => navigation.goBack()}
        />

        <View
          style={styles.centerContainer}
        >
          <Ionicons
            name="alert-circle-outline"
            size={52}
            color={colors.primary}
          />

          <Text
            style={[
              styles.errorTitle,
              {
                color:
                  themeColors.text,
              },
            ]}
          >
            Réservation invalide
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
            L'identifiant de la réservation
            est manquant.
          </Text>
        </View>

        <TherapistBottomMenu navigation={navigation} activeTab={activeTab} />
      </SafeAreaView>
    );
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
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
        <Header
          title="Réservation"          showBack
          onBackPress={() => navigation.goBack()}
        />

        <View
          style={styles.centerContainer}
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
            Chargement de la négociation...
          </Text>
        </View>

        <TherapistBottomMenu navigation={navigation} activeTab={activeTab} />
      </SafeAreaView>
    );
  }

  // ==========================================================
  // MAIN
  // ==========================================================

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
      <Header
        title="Négociation"
showBack
        onBackPress={() => navigation.goBack()}
      />

      {toast ? (
        <View
          style={[
            styles.toast,
            toast.type === 'success'
              ? styles.toastSuccess
              : styles.toastError,
          ]}
        >
          <Ionicons
            name={
              toast.type === 'success'
                ? 'checkmark-circle'
                : 'alert-circle'
            }
            size={18}
            color="#FFFFFF"
          />

          <Text style={styles.toastText}>
            {toast.text}
          </Text>
        </View>
      ) : null}

      <ConfirmationModal
        visible={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmLabel={confirmModal?.confirmLabel}
        destructive={confirmModal?.destructive}
        onCancel={() => setConfirmModal(null)}
        onConfirm={confirmModal?.onConfirm}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <Animated.ScrollView
          style={[
            styles.scrollView,
            {
              opacity: fadeAnim,
            },
          ]}
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ==================================================
              CLIENT
          ================================================== */}

          <View
            style={[
              styles.headerCard,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <ClientAvatar
              photoUrl={clientPhoto}
              name={clientName}
              size={58}
            />

            <View
              style={styles.headerInfo}
            >
              <Text
                style={[
                  styles.headerTitle,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                Client
              </Text>

              <Text
                style={[
                  styles.clientName,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {clientName}
              </Text>

              <View style={styles.clientContactRow}>
                <Ionicons
                  name="call-outline"
                  size={12}
                  color={themeColors.textSecondary}
                />
                <Text
                  style={[
                    styles.clientContactText,
                    { color: themeColors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {clientPhone}
                </Text>

                <Ionicons
                  name="mail-outline"
                  size={12}
                  color={themeColors.textSecondary}
                  style={styles.contactEmailIcon}
                />
                <Text
                  style={[
                    styles.clientContactText,
                    { color: themeColors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {clientEmail}
                </Text>
              </View>

              <View style={styles.onlineStatusRow}>
                <View
                  style={[
                    styles.onlineStatusDot,
                    { backgroundColor: isClientOnline ? '#22C55E' : '#9CA3AF' },
                  ]}
                />
                <Text
                  style={[
                    styles.onlineStatusText,
                    { color: isClientOnline ? '#16A34A' : themeColors.textSecondary },
                  ]}
                >
                  {isClientOnline ? 'En ligne' : 'Hors ligne'}
                </Text>
              </View>
            </View>

            <View
              style={{
                alignItems: 'flex-end',
              }}
            >
              <View
                style={styles.bookingBadge}
              >
                <Text
                  style={
                    styles.bookingBadgeText
                  }
                >
                  #{bookingId}
                </Text>
              </View>

              <View
                style={[
                  styles.bookingBadge,
                  {
                    marginTop: 5,
                    backgroundColor:
                      `${getBookingStatusColor(
                        bookingStatus
                      )}22`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bookingBadgeText,
                    {
                      color:
                        getBookingStatusColor(
                          bookingStatus
                        ),
                    },
                  ]}
                >
                  {getBookingStatusLabel(
                    bookingStatus
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* ==================================================
              CURRENT PRICE
          ================================================== */}

          <View
            style={[
              styles.currentPriceCard,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View>
              <Text
                style={[
                  styles.smallLabel,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Prix actuel
              </Text>

              <Text
                style={[
                  styles.currentPrice,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                {formatPrice(
                  currentPrice
                )}
              </Text>
            </View>

            <View
              style={styles.offerIdsContainer}
            >
              <View
                style={styles.offerIdBox}
              >
                <Ionicons
                  name="person-outline"
                  size={15}
                  color={colors.primary}
                />

                <Text
                  style={[
                    styles.offerIdText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Client #{clientOfferId || '-'}
                </Text>
              </View>

              {therapistOfferId ? (
                <View
                  style={[
                    styles.offerIdBox,
                    {
                      marginTop: 3,
                    },
                  ]}
                >
                  <Ionicons
                    name="medical-outline"
                    size={15}
                    color={colors.primary}
                  />

                  <Text
                    style={[
                      styles.offerIdText,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Vous #{therapistOfferId}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ==================================================
              SUGGESTIONS
          ================================================== */}

          {suggestedPrices.length > 0 && (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Suggestions
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
              >
                {suggestedPrices.map(
                  (item) => {
                    const active =
                      selectedPrice ===
                      item.value;

                    return (
                      <TouchableOpacity
                        key={
                          item.label
                        }
                        activeOpacity={0.8}
                        onPress={() =>
                          selectSuggestedPrice(
                            item.value
                          )
                        }
                        style={[
                          styles.suggestionCard,
                          {
                            backgroundColor:
                              themeColors.surface,

                            borderColor:
                              active
                                ? colors.primary
                                : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.suggestionLabel,
                            {
                              color:
                                active
                                  ? colors.primary
                                  : themeColors.text,
                            },
                          ]}
                        >
                          {item.label}
                        </Text>

                        <Text
                          style={[
                            styles.suggestionPrice,
                            {
                              color:
                                colors.primary,
                            },
                          ]}
                        >
                          {formatPrice(
                            item.value
                          )}
                        </Text>

                        <Text
                          style={[
                            styles.suggestionDiff,
                            {
                              color:
                                themeColors.textSecondary,
                            },
                          ]}
                        >
                          {getPriceDifference(
                            item.value
                          )}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </ScrollView>
            </>
          )}

          {/* ==================================================
              FORM
          ================================================== */}

          <View
            style={[
              styles.formCard,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={styles.formHeader}
            >
              <View
                style={styles.formIcon}
              >
                <Ionicons
                  name="swap-horizontal"
                  size={21}
                  color="#FFFFFF"
                />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={[
                    styles.formTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  {hasClientOffer
                    ? 'Votre contre-proposition'
                    : 'Votre proposition'}
                </Text>

                <Text
                  style={[
                    styles.formSubtitle,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {hasClientOffer
                    ? 'Proposez un nouveau prix au client'
                    : 'Proposez un prix pour cette réservation'}
                </Text>
              </View>
            </View>

            {/* ==================================================
                CLIENT OFFER WARNING
            ================================================== */}

            {!isNegotiable ? (
              <View
                style={[
                  styles.warningBox,
                  {
                    backgroundColor:
                      '#FDECEA',
                    borderColor:
                      getBookingStatusColor(
                        bookingStatus
                      ),
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={getBookingStatusColor(
                    bookingStatus
                  )}
                />

                <Text
                  style={[
                    styles.warningText,
                    {
                      color:
                        '#7A1F1F',
                    },
                  ]}
                >
                  Cette réservation est au statut «{' '}
                  {getBookingStatusLabel(
                    bookingStatus
                  )}
                  {' '}». La négociation est fermée : impossible
                  d'accepter ou d'envoyer une proposition.
                </Text>
              </View>
            ) : isWaitingForClient ? (
              <View
                style={[
                  styles.warningBox,
                  {
                    backgroundColor:
                      '#E8F2FF',
                    borderColor:
                      '#2D9CDB',
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color="#2D9CDB"
                />

                <Text
                  style={[
                    styles.warningText,
                    {
                      color:
                        '#1B5E8A',
                    },
                  ]}
                >
                  Votre proposition de {formatPrice(currentPrice)}{' '}
                  a été envoyée. En attente de la réponse du
                  client.
                </Text>
              </View>
            ) : (
              !hasClientOffer && (
                <View
                  style={[
                    styles.warningBox,
                    {
                      backgroundColor:
                        '#FFF4E5',
                      borderColor:
                        '#F5B642',
                    },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color="#C57A00"
                  />

                  <Text
                    style={[
                      styles.warningText,
                      {
                        color:
                          '#8A5A00',
                      },
                    ]}
                  >
                    Le client demande {formatPrice(currentPrice)}.
                    Envoyez votre première proposition ou
                    acceptez directement ce prix.
                  </Text>
                </View>
              )
            )}

            {/* ==================================================
                PRICE
            ================================================== */}

            <Text
              style={[
                styles.inputLabel,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Nouveau prix
            </Text>

            <View
              style={[
                styles.priceInputContainer,
                {
                  borderColor:
                    hasValidCounterPrice
                      ? colors.primary
                      : themeColors.border ||
                        '#E0E0E0',

                  backgroundColor:
                    themeColors.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.currency,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                Ar
              </Text>

              <TextInput
                value={counterPrice}
                onChangeText={(value) => {
                  // Autoriser uniquement chiffres et espace
                  const cleaned =
                    value.replace(
                      /[^\d\s]/g,
                      ''
                    );

                  setCounterPrice(
                    cleaned
                  );

                  setSelectedPrice(
                    null
                  );
                }}
                placeholder="Ex: 50 000"
                placeholderTextColor={
                  themeColors.textSecondary
                }
                keyboardType="numeric"
                returnKeyType="done"
                style={[
                  styles.priceInput,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              />
            </View>

            <Text
              style={[
                styles.minimumText,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              Minimum : 10 000 Ar
            </Text>

            {/* ==================================================
                MESSAGE
            ================================================== */}

            <Text
              style={[
                styles.inputLabel,
                {
                  color:
                    themeColors.text,
                  marginTop: 10,
                },
              ]}
            >
              Message
            </Text>

            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Ajoutez un message au client..."
              placeholderTextColor={
                themeColors.textSecondary
              }
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
              style={[
                styles.messageInput,
                {
                  color:
                    themeColors.text,

                  borderColor:
                    themeColors.border ||
                    '#E0E0E0',

                  backgroundColor:
                    themeColors.background,
                },
              ]}
            />

            {/* ==================================================
                ACTIONS
            ================================================== */}

            <View
              style={styles.actionRow}
            >
              {/* ==================================================
                  ACCEPT
              ================================================== */}
              {canAccept && (
              <Pressable
                onPress={handleAccept}
                disabled={!canAccept}
                style={[
                  styles.actionButton,
                  !canAccept &&
                    styles.disabledButton,
                ]}
              >
                <LinearGradient
                  colors={
                    canAccept
                      ? [
                          colors.primary,
                          `${colors.primary}CC`,
                        ]
                      : [
                          '#AFAFAF',
                          '#C5C5C5',
                        ]
                  }
                  style={
                    styles.actionGradient
                  }
                >
                  {accepting ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.actionText
                        }
                      >
                        Accepter
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
              )}

              {/* ==================================================
                  SEND
              ================================================== */}
              {canSend && (
              <Pressable
                onPress={handleSubmitCounter}
                disabled={!canSend}
                style={[
                  styles.actionButton,
                  !canSend &&
                    styles.disabledButton,
                ]}
              >
                <LinearGradient
                  colors={
                    canSend
                      ? [
                          colors.primary,
                          colors.primaryLight ||
                            colors.primary,
                        ]
                      : [
                          '#AFAFAF',
                          '#C5C5C5',
                        ]
                  }
                  style={
                    styles.actionGradient
                  }
                >
                  {submitting ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="send-outline"
                        size={19}
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.actionText
                        }
                      >
                        Envoyer
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
              )}

              {/* ==================================================
                  REJECT
              ================================================== */}
              {canReject && (
              <Pressable
                onPress={handleReject}
                disabled={!canReject}
                style={[
                  styles.actionButton,
                  !canReject &&
                    styles.disabledButton,
                ]}
              >
                <LinearGradient
                  colors={
                    canReject
                      ? [
                          '#E53935',
                          '#EF5350',
                        ]
                      : [
                          '#AFAFAF',
                          '#C5C5C5',
                        ]
                  }
                  style={
                    styles.actionGradient
                  }
                >
                  {rejecting ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="close-circle-outline"
                        size={20}
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.actionText
                        }
                      >
                        Refuser
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
              )}
            </View>

            {/* ==================================================
                BUTTON DEBUG INFO
            ================================================== */}

            <View
              style={styles.buttonInfo}
            >
              <Ionicons
                name={
                  canSend
                    ? 'checkmark-circle'
                    : !isNegotiable
                    ? 'lock-closed-outline'
                    : isWaitingForClient
                    ? 'time-outline'
                    : 'information-circle-outline'
                }
                size={14}
                color={
                  canSend
                    ? colors.primary
                    : themeColors.textSecondary
                }
              />

              <Text
                style={[
                  styles.buttonInfoText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                {!isNegotiable
                  ? `Négociation fermée (statut : ${getBookingStatusLabel(
                      bookingStatus
                    )})`
                  : isWaitingForClient
                  ? 'En attente de la réponse du client'
                  : canSend
                  ? hasClientOffer
                    ? 'Prêt à envoyer votre contre-proposition'
                    : 'Prêt à envoyer votre première proposition'
                  : !hasValidCounterPrice
                  ? 'Saisissez un prix supérieur ou égal à 10 000 Ar'
                  : 'Veuillez patienter...'}
              </Text>
            </View>
          </View>

          {/* ==================================================
              HISTORY
          ================================================== */}

          <View
            style={styles.historySection}
          >
            <View
              style={styles.historyHeader}
            >
              <View>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Historique de négociation
                </Text>

                <Text
                  style={[
                    styles.historySubtitle,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Toutes les propositions
                </Text>
              </View>

              <TouchableOpacity
                onPress={async () => {
                  if (loading) return;
                  await loadHistory(false);
                  showToast('success', 'Négociation actualisée.');
                }}
                disabled={loading}
                style={
                  styles.refreshButton
                }
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.primary
                    }
                  />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={19}
                    color={
                      colors.primary
                    }
                  />
                )}
              </TouchableOpacity>
            </View>

            {negotiationHistory.length ===
            0 ? (
              <View
                style={[
                  styles.emptyHistory,
                  {
                    backgroundColor:
                      themeColors.surface,
                  },
                ]}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={38}
                  color={
                    themeColors.textSecondary
                  }
                />

                <Text
                  style={[
                    styles.emptyHistoryTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Aucune proposition
                </Text>

                <Text
                  style={[
                    styles.emptyHistoryText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  L'historique apparaîtra ici.
                </Text>
              </View>
            ) : (
              negotiationHistory.map(
                (
                  item,
                  index
                ) => {
                  const type =
                    normalizeOfferType(
                      item
                    );

                  const status =
                    getOfferStatus(
                      item
                    );

                  const price =
                    getOfferPrice(
                      item
                    );

                  const isClient =
                    type === 'client';

                  const isActive =
                    isActiveOffer(
                      item
                    );

                  const itemId =
                    getOfferId(
                      item
                    );

                  return (
                    <View
                      key={String(
                        itemId ??
                          index
                      )}
                      style={[
                        styles.historyItem,
                        {
                          backgroundColor:
                            themeColors.surface,

                          borderLeftColor:
                            isClient
                              ? '#D74444'
                              : colors.primary,
                        },
                      ]}
                    >
                      <View
                        style={
                          styles.historyTop
                        }
                      >
                        <View
                          style={[
                            styles.userBadge,
                            {
                              backgroundColor:
                                isClient
                                  ? '#FFF0F0'
                                  : `${colors.primary}14`,
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              isClient
                                ? 'person-outline'
                                : 'medical-outline'
                            }
                            size={15}
                            color={
                              isClient
                                ? '#D74444'
                                : colors.primary
                            }
                          />

                          <Text
                            style={[
                              styles.userBadgeText,
                              {
                                color:
                                  isClient
                                    ? '#D74444'
                                    : colors.primary,
                              },
                            ]}
                          >
                            {isClient
                              ? 'Client'
                              : 'Vous'}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.historyDate,
                            {
                              color:
                                themeColors.textSecondary,
                            },
                          ]}
                        >
                          {formatDate(
                            item?.created_at ??
                              item?.createdAt
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.historyMiddle
                        }
                      >
                        <View>
                          <Text
                            style={[
                              styles.historyPrice,
                              {
                                color:
                                  colors.primary,
                              },
                            ]}
                          >
                            {formatPrice(
                              price
                            )}
                          </Text>

                          {itemId ? (
                            <Text
                              style={[
                                styles.historyOfferId,
                                {
                                  color:
                                    themeColors.textSecondary,
                                },
                              ]}
                            >
                              Offre #{itemId}
                            </Text>
                          ) : null}
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor:
                                isActive
                                  ? `${colors.primary}14`
                                  : '#F2F2F2',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              {
                                color:
                                  isActive
                                    ? colors.primary
                                    : themeColors.textSecondary,
                              },
                            ]}
                          >
                            {isActive
                              ? 'Active'
                              : status ||
                                '—'}
                          </Text>
                        </View>
                      </View>

                      {item?.message ? (
                        <Text
                          style={[
                            styles.historyMessage,
                            {
                              color:
                                themeColors.textSecondary,
                            },
                          ]}
                        >
                          "{item.message}"
                        </Text>
                      ) : null}
                    </View>
                  );
                }
              )
            )}
          </View>

          {/* ==================================================
              TIP
          ================================================== */}

          <View
            style={[
              styles.tipCard,
              {
                backgroundColor:
                  colors.primary +
                  '12',
              },
            ]}
          >
            <Ionicons
              name="bulb-outline"
              size={24}
              color={
                colors.primary
              }
            />

            <View
              style={
                styles.tipContent
              }
            >
              <Text
                style={[
                  styles.tipTitle,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                Conseil
              </Text>

              <Text
                style={[
                  styles.tipText,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Une proposition proche du prix
                actuel augmente généralement
                les chances d'accord.
              </Text>
            </View>
          </View>

          <View
            style={{
              height: spacing.xl,
            }}
          />
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <TherapistBottomMenu navigation={navigation} activeTab={activeTab} />
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

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      paddingHorizontal: 14,
      paddingBottom: 30,
    },

    headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      marginTop: 8,
      borderRadius: 16,
      elevation: 2,
      shadowOpacity: 0.06,
      shadowRadius: 5,
      shadowOffset: {
        width: 0,
        height: 2,
      },
    },

    clientIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerInfo: {
      flex: 1,
      marginLeft: 11,
    },

    clientContactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      minWidth: 0,
    },

    clientContactText: {
      fontSize: 9,
      fontWeight: '500',
      flexShrink: 1,
      marginLeft: 4,
    },

    contactEmailIcon: {
      marginLeft: 8,
    },

    onlineStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },

    onlineStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: 5,
    },

    onlineStatusText: {
      fontSize: 9,
      fontWeight: '700',
    },

    headerTitle: {
      fontSize: 12,
      fontWeight: '600',
    },

    clientName: {
      fontSize: 18,
      fontWeight: '800',
      marginTop: 1,
    },

    bookingBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor:
        `${colors.primary}14`,
    },

    bookingBadgeText: {
      color:
        colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },

    currentPriceCard: {
      marginTop: 12,
      padding: 15,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      elevation: 2,
    },

    smallLabel: {
      fontSize: 11,
      fontWeight: '600',
    },

    currentPrice: {
      fontSize: 24,
      fontWeight: '900',
      marginTop: 2,
    },

    offerIdsContainer: {
      alignItems: 'flex-end',
    },

    offerIdBox: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    offerIdText: {
      fontSize: 9,
      fontWeight: '600',
      marginLeft: 4,
    },

    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      marginTop: 16,
      marginBottom: 3,
    },

    suggestionCard: {
      width: 105,
      minHeight: 90,
      borderRadius: 13,
      borderWidth: 2,
      padding: 10,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 1,
    },

    suggestionLabel: {
      fontSize: 12,
      fontWeight: '700',
    },

    suggestionPrice: {
      fontSize: 13,
      fontWeight: '900',
      marginTop: 4,
    },

    suggestionDiff: {
      fontSize: 9,
      marginTop: 3,
    },

    formCard: {
      marginTop: 14,
      borderRadius: 17,
      padding: 15,
      elevation: 2,
    },

    formHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },

    formIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor:
        colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },

    formTitle: {
      fontSize: 15,
      fontWeight: '800',
    },

    formSubtitle: {
      fontSize: 10,
      marginTop: 2,
    },

    warningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      marginBottom: 13,
    },

    warningText: {
      flex: 1,
      fontSize: 10,
      lineHeight: 15,
      marginLeft: 7,
    },

    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 6,
    },

    priceInputContainer: {
      minHeight: 50,
      borderRadius: 11,
      borderWidth: 1.5,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
      marginBottom: 4,
    },

    currency: {
      fontSize: 14,
      fontWeight: '900',
      marginRight: 10,
    },

    priceInput: {
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
      paddingVertical: 9,
    },

    minimumText: {
      fontSize: 9,
      marginBottom: 5,
    },

    messageInput: {
      minHeight: 88,
      maxHeight: 130,
      borderRadius: 11,
      borderWidth: 1,
      padding: 11,
      fontSize: 12,
      marginBottom: 14,
    },

    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
    },

    actionButton: {
      flexGrow: 1,
      flexBasis: 100,
      minHeight: 49,
      borderRadius: 11,
      overflow: 'hidden',
      elevation: 3,
    },

    actionGradient: {
      flex: 1,
      minHeight: 49,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 10,
    },

    actionText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },

    disabledButton: {
      opacity: 0.65,
      elevation: 0,
    },

    buttonInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 9,
      minHeight: 20,
    },

    buttonInfoText: {
      fontSize: 9,
      marginLeft: 5,
      textAlign: 'center',
    },

    historySection: {
      marginTop: 5,
    },

    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    historySubtitle: {
      fontSize: 10,
      marginTop: 1,
    },

    refreshButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        `${colors.primary}14`,
    },

    historyItem: {
      borderRadius: 14,
      borderLeftWidth: 4,
      padding: 13,
      marginTop: 9,
      elevation: 1,
    },

    historyTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    userBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
    },

    userBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      marginLeft: 4,
    },

    historyDate: {
      fontSize: 9,
    },

    historyMiddle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },

    historyPrice: {
      fontSize: 18,
      fontWeight: '900',
    },

    historyOfferId: {
      fontSize: 8,
      marginTop: 1,
    },

    statusBadge: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 7,
    },

    statusText: {
      fontSize: 9,
      fontWeight: '700',
    },

    historyMessage: {
      fontSize: 11,
      fontStyle: 'italic',
      marginTop: 7,
      lineHeight: 17,
    },

    tipCard: {
      marginTop: 14,
      borderRadius: 14,
      padding: 13,
      flexDirection: 'row',
    },

    tipContent: {
      flex: 1,
      marginLeft: 9,
    },

    tipTitle: {
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 3,
    },

    tipText: {
      fontSize: 10,
      lineHeight: 16,
    },

    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
    },

    loadingText: {
      marginTop: 10,
      fontSize: 12,
    },

    errorTitle: {
      marginTop: 12,
      fontSize: 17,
      fontWeight: '800',
    },

    errorText: {
      marginTop: 5,
      fontSize: 12,
      textAlign: 'center',
    },

    emptyHistory: {
      borderRadius: 14,
      padding: 25,
      alignItems: 'center',
      marginTop: 9,
    },

    emptyHistoryTitle: {
      marginTop: 8,
      fontSize: 14,
      fontWeight: '800',
    },

    emptyHistoryText: {
      marginTop: 3,
      fontSize: 10,
    },

    // ==========================================================
    // TOAST
    // ==========================================================

    toast: {
      position: 'absolute',
      top: ANDROID_STATUS_BAR_HEIGHT + 8,
      left: 18,
      right: 18,
      zIndex: 9999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,

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

    toastSuccess: {
      backgroundColor: colors.primary,
    },

    toastError: {
      backgroundColor: '#E53935',
    },

    toastText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

export default NegotiationScreen;