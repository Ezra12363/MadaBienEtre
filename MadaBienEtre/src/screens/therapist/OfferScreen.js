// src/screens/therapist/OfferScreen.js
//
// Écran Détails + Négociation (thérapeute).
// - Texte compact, UI épurée.
// - Toutes les informations proviennent du backend.
// - Boutons placés DANS leur section contextuelle :
//     • Statut (si négociation) → Bouton "Négocier" en haut
//     • Rendez-vous  → Naviguer
//     • Service      → Négocier / Accepter prix client
//     • Client       → Message / Appeler
//     • Suivi        → Suivi en direct / SOS
//     • Faire offre  → Envoyer / Accepter

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import bookingService from '../../services/bookingService';
import offerService from '../../services/offerService';

import Header from '../../components/common/Header';
import { useTheme } from '../../context/ThemeContext';

// ============================================================
// COLORS
// ============================================================

const COLORS = {
  primary: '#2E8B57',
  primaryDark: '#247447',
  primarySoft: '#EAF6EF',
  primaryTint: '#D6EEE0',

  white: '#FFFFFF',
  text: '#222B26',
  textSecondary: '#6B7A72',

  border: '#E4EAE6',

  red: '#D93636',
  redSoft: '#FDECEC',

  orange: '#E08E0B',
  orangeSoft: '#FDF3E2',

  blue: '#3B82F6',
  blueSoft: '#EFF6FF',

  purple: '#7B61FF',
  purpleSoft: '#F1EDFE',

  green: '#22C55E',
  greenSoft: '#E7F7EC',
};

// ============================================================
// HELPERS
// ============================================================

const money = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0 Ar';
  return `${number.toLocaleString('fr-FR')} Ar`;
};

const dateText = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const dateShort = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const timeShort = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getRemaining = (expiresAt) => {
  if (!expiresAt) return 0;
  const expiration = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiration)) return 0;
  return Math.max(0, Math.floor((expiration - Date.now()) / 1000));
};

const formatRemaining = (seconds) => {
  const total = Math.max(0, Number(seconds || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (days > 0) {
    return `${days}j ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const genderLabel = (value) => {
  const key = String(value || '').trim().toLowerCase();
  const labels = {
    male: 'Homme',
    homme: 'Homme',
    m: 'Homme',
    female: 'Femme',
    femme: 'Femme',
    f: 'Femme',
    any: 'Peu importe',
    indifferent: 'Peu importe',
    no_preference: 'Peu importe',
    '': 'Non précisé',
  };
  return labels[key] || 'Non précisé';
};

const statusLabel = (status) => {
  const value = String(status || '').toLowerCase();
  const labels = {
    sent: 'En attente',
    pending: 'En attente',
    accepted: 'Acceptée',
    rejected: 'Refusée',
    expired: 'Expirée',
    confirmed: 'Confirmée',
    negotiating: 'Négociation',
    completed: 'Terminée',
    cancelled: 'Annulée',
    cancelled_by_client: 'Annulée (client)',
    cancelled_by_therapist: 'Annulée (moi)',
    in_progress: 'En cours',
  };
  return labels[value] || status || 'Inconnu';
};

const statusColor = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'accepted' || value === 'confirmed' || value === 'completed') {
    return COLORS.primary;
  }
  if (
    value === 'rejected' ||
    value === 'expired' ||
    value.startsWith('cancelled')
  ) {
    return COLORS.red;
  }
  if (value === 'in_progress') return COLORS.purple;
  return COLORS.orange;
};

const statusIcon = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'pending' || value === 'sent') return 'time-outline';
  if (value === 'negotiating') return 'chatbubble-ellipses-outline';
  if (value === 'confirmed' || value === 'accepted')
    return 'checkmark-circle-outline';
  if (value === 'in_progress') return 'play-circle-outline';
  if (value === 'completed') return 'checkmark-done-outline';
  if (value.startsWith('cancelled')) return 'close-circle-outline';
  if (value === 'expired') return 'alert-circle-outline';
  return 'help-circle-outline';
};

const getOfferUserName = (offer) => {
  return (
    offer?.therapist?.fullname ||
    offer?.therapist?.name ||
    offer?.client?.fullname ||
    offer?.client?.name ||
    offer?.user?.fullname ||
    offer?.user?.name ||
    offer?.user_name ||
    offer?.therapist_name ||
    offer?.client_name ||
    'Utilisateur'
  );
};

// ============================================================
// NORMALISATION
// ============================================================

const NEGOTIABLE_STATUSES = ['pending', 'negotiating'];
const TRACKABLE_STATUSES = ['confirmed', 'in_progress'];
const CONTACTABLE_STATUSES = ['confirmed', 'in_progress', 'completed'];

// ============================================================
// MAIN SCREEN
// ============================================================

export default function OfferScreen({ route, navigation }) {
  const bookingId =
    route?.params?.bookingId ?? route?.params?.booking?.id;
  const initialBooking = route?.params?.booking ?? null;

  const [booking, setBooking] = useState(initialBooking);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [remainingTime, setRemainingTime] = useState(
    getRemaining(initialBooking?.expires_at)
  );
  const [toast, setToast] = useState(null);

  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 900;

  const styles = useMemo(
    () => createStyles(colors, isDark, screenWidth),
    [colors, isDark, screenWidth]
  );

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ==========================================================
  // MERGE BOOKING
  // ==========================================================

  const mergeBooking = (oldBooking, newBooking) => {
    if (!newBooking) return oldBooking;
    return {
      ...(oldBooking || {}),
      ...(newBooking || {}),
      client: {
        ...(oldBooking?.client || {}),
        ...(newBooking?.client || {}),
      },
      massage_type: {
        ...(oldBooking?.massage_type || {}),
        ...(newBooking?.massage_type || {}),
      },
      my_offer:
        newBooking?.my_offer ?? oldBooking?.my_offer ?? null,
    };
  };

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadData = useCallback(
    async (refresh = false) => {
      if (!bookingId) {
        showToast('error', 'Réservation introuvable.');
        setLoading(false);
        return;
      }

      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);

        const [bookingResult, offersResult] = await Promise.all([
          bookingService.getBooking(bookingId),
          offerService.getOffersByBooking(bookingId),
        ]);

        if (bookingResult?.success && bookingResult?.data) {
          setBooking((current) =>
            mergeBooking(current, bookingResult.data)
          );
        }

        if (offersResult?.success) {
          const offerData = Array.isArray(offersResult?.data)
            ? offersResult.data
            : [];
          setOffers(offerData);
        }

        if (!bookingResult?.success && !offersResult?.success) {
          showToast(
            'error',
            bookingResult?.error ||
              offersResult?.error ||
              'Erreur de chargement.'
          );
        }
      } catch (error) {
        console.error('❌ OfferScreen loadData:', error);
        showToast('error', error?.message || 'Erreur de chargement.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bookingId, showToast]
  );

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // ==========================================================
  // AUTO REFRESH + COUNTDOWN
  // ==========================================================

  useEffect(() => {
    const interval = setInterval(() => loadData(true), 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const update = () =>
      setRemainingTime(getRemaining(booking?.expires_at));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [booking?.expires_at]);

  // ==========================================================
  // DONNÉES DEPUIS LE BACKEND
  // ==========================================================

  const client = booking?.client || {};
  const massage = booking?.massage_type || {};

  const clientName =
    client?.fullname ||
    client?.name ||
    booking?.client_fullname ||
    booking?.client_name ||
    'Client';

  const clientPhone =
    client?.phone || booking?.client_phone || booking?.phone || null;

  const clientEmail =
    client?.email || booking?.client_email || booking?.email || null;

  const clientPhoto =
    client?.avatar_url ||
    client?.avatar ||
    client?.photo_url ||
    client?.photo ||
    booking?.client_photo ||
    null;

  const massageName =
    massage?.name || booking?.massage_type_name || 'Massage';

  const category =
    massage?.category ||
    booking?.massage_category ||
    booking?.category ||
    null;

  const clientPrice = Number(
    booking?.client_price_proposed ??
      booking?.proposed_price ??
      booking?.price ??
      0
  );

  const therapistPrice =
    booking?.therapist_initial_price ?? booking?.therapist_price ?? null;

  const finalPrice = booking?.final_price ?? null;

  const duration =
    booking?.scheduled_duration_minutes ??
    booking?.duration_minutes ??
    booking?.duration ??
    60;

  const distance = booking?.distance_km ?? booking?.distanceKm ?? null;
  const eta = booking?.eta_minutes ?? booking?.etaMinutes ?? null;

  const scheduledDate =
    booking?.scheduled_date ?? booking?.scheduledDate ?? null;

  const address =
    booking?.address ||
    booking?.client_location ||
    'Adresse non renseignée';

  const latitude =
    booking?.client_latitude ?? booking?.latitude ?? null;
  const longitude =
    booking?.client_longitude ?? booking?.longitude ?? null;

  const gender = booking?.preferred_gender ?? null;
  const genderDisplay = genderLabel(gender);

  const instructions = booking?.special_instructions || null;

  const createdAt = booking?.created_at ?? booking?.createdAt ?? null;
  const expiresAt = booking?.expires_at ?? booking?.expiresAt ?? null;

  const offersCount = Number(
    booking?.offers_count ?? booking?.offersCount ?? offers.length ?? 0
  );

  const myTherapistId =
    booking?.my_offer?.user_id ?? booking?.myOffer?.user_id ?? null;

  const myThreadOffers = useMemo(
    () =>
      offers.filter((offer) => {
        const type = String(offer?.user_type || '').toLowerCase();
        if (type === 'therapist') {
          return myTherapistId
            ? Number(offer?.user_id) === Number(myTherapistId)
            : true;
        }
        return true;
      }),
    [offers, myTherapistId]
  );

  const myOffer =
    myThreadOffers[0] ?? booking?.my_offer ?? booking?.myOffer ?? null;

  const hasMyOffer = Boolean(myOffer);

  const bookingStatus = String(booking?.status || 'pending').toLowerCase();
  const isExpired = remainingTime <= 0;

  const canNegotiate =
    !isExpired && NEGOTIABLE_STATUSES.includes(bookingStatus);
  const canTrack = TRACKABLE_STATUSES.includes(bookingStatus);
  const canContact = CONTACTABLE_STATUSES.includes(bookingStatus);

  // ✅ Nouveau : flag "en négociation" pour afficher le bouton en haut
  const isNegotiating = bookingStatus === 'negotiating';

  const statusInfo = useMemo(
    () => ({
      label: statusLabel(bookingStatus),
      color: statusColor(bookingStatus),
      icon: statusIcon(bookingStatus),
    }),
    [bookingStatus]
  );

  // ==========================================================
  // ACTIONS — SEND OFFER
  // ==========================================================

  const sendOffer = async () => {
    if (!canNegotiate) {
      showToast('error', 'Cette réservation n’est plus disponible.');
      return;
    }

    const numericPrice = Number(
      String(price).replace(/\s/g, '').replace(',', '.')
    );

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      showToast('error', 'Veuillez saisir un prix valide.');
      return;
    }

    try {
      setSubmitting(true);
      const result = await offerService.sendOffer(
        bookingId,
        numericPrice,
        message
      );

      if (!result?.success) {
        showToast('error', result?.error || 'Impossible d’envoyer l’offre.');
        return;
      }

      setPrice('');
      setMessage('');
      showToast('success', 'Votre offre a été envoyée.');
      await loadData(true);
    } catch (error) {
      showToast('error', error?.message || 'Erreur lors de l’envoi.');
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================
  // ACTIONS — ACCEPT CLIENT PRICE
  // ==========================================================

  const acceptClientPrice = () => {
    if (!canNegotiate) return;

    const execute = async () => {
      try {
        setSubmitting(true);
        const result = await offerService.acceptClientPrice(
          bookingId,
          clientPrice
        );

        if (!result?.success) {
          showToast(
            'error',
            result?.error || 'Impossible d’accepter le prix.'
          );
          return;
        }

        showToast('success', 'Prix client accepté.');
        await loadData(true);
      } catch (error) {
        showToast('error', error?.message || 'Erreur.');
      } finally {
        setSubmitting(false);
      }
    };

    if (Platform.OS === 'web') {
      execute();
      return;
    }

    Alert.alert(
      'Accepter le prix',
      `Accepter ${money(clientPrice)} pour cette réservation ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Accepter', onPress: execute },
      ]
    );
  };

  // ==========================================================
  // ACTIONS — COUNTER OFFER
  // ==========================================================

  const sendCounterOffer = (offer) => {
    if (!canNegotiate) return;

    const execute = async () => {
      const numericPrice = Number(
        String(price).replace(/\s/g, '').replace(',', '.')
      );

      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        showToast('error', 'Saisissez un montant valide.');
        return;
      }

      try {
        setSubmitting(true);
        const result = await offerService.counterOffer(
          offer?.id,
          numericPrice,
          message
        );

        if (!result?.success) {
          showToast(
            'error',
            result?.error || 'Impossible d’envoyer la contre-offre.'
          );
          return;
        }

        setPrice('');
        setMessage('');
        showToast('success', 'Contre-offre envoyée.');
        await loadData(true);
      } catch (error) {
        showToast('error', error?.message || 'Erreur.');
      } finally {
        setSubmitting(false);
      }
    };

    if (Platform.OS === 'web') {
      execute();
      return;
    }

    Alert.alert(
      'Contre-offre',
      `Envoyer ${money(Number(price || 0))} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', onPress: execute },
      ]
    );
  };

  // ==========================================================
  // RETOUR (header + bouton retour Android)
  // 1) écran précédent s'il existe (liste, groupe client…)
  // 2) sinon → l'écran d'où l'on vient (params.returnTo)
  // 3) sinon → écran des réservations ('Offers')
  // ==========================================================

  const handleBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return true;
    }

    const target = route?.params?.returnTo || 'Offers';
    try {
      navigation?.navigate?.(target);
    } catch (error) {
      console.warn('⚠️ OfferScreen retour impossible:', error?.message);
    }
    return true;
  }, [navigation, route?.params?.returnTo]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        handleBack
      );
      return () => subscription.remove();
    }, [handleBack])
  );

  // ==========================================================
  // ACTIONS — NAVIGATION VERS AUTRES ÉCRANS
  // ==========================================================

  const goToNavigation = () => {
    if (latitude === null || longitude === null) {
      Alert.alert(
        'Position indisponible',
        'Les coordonnées GPS du client ne sont pas disponibles.'
      );
      return;
    }
    navigation.navigate('Navigation', {
      bookingId: booking?.id ?? bookingId,
      clientAddress: address,
      clientLatitude: Number(latitude),
      clientLongitude: Number(longitude),
    });
  };

  const goToNegotiation = () => {
    if (!booking) return;
    navigation.navigate('Negotiation', {
      returnTo: 'Offer',
      bookingId: booking?.id ?? bookingId,
      booking,
      currentPrice: clientPrice,
      clientName,
    });
  };

  const goToTracking = () => {
    navigation.navigate('Tracking', {
      bookingId: booking?.id ?? bookingId,
    });
  };

  const goToChat = () => {
    navigation.navigate('TherapistChat', {
      bookingId: booking?.id ?? bookingId,
      clientId: client?.id ?? booking?.client_id ?? null,
      clientName,
    });
  };

  const goToSOS = () => {
    navigation.navigate('TherapistSOS', {
      bookingId: booking?.id ?? bookingId,
    });
  };

  const callClient = () => {
    if (!clientPhone) {
      Alert.alert('Numéro indisponible', 'Aucun numéro renseigné.');
      return;
    }
    Linking.openURL(`tel:${clientPhone}`).catch(() => {
      Alert.alert('Erreur', "Impossible d'ouvrir le téléphone.");
    });
  };

  // ==========================================================
  // RENDER OFFER
  // ==========================================================

  const renderOffer = (offer) => {
    const isTherapist =
      String(offer?.user_type || '').toLowerCase() === 'therapist';
    const status = String(offer?.status || 'pending').toLowerCase();
    const offerName = getOfferUserName(offer);
    const color = statusColor(status);

    return (
      <View
        key={String(offer?.id ?? Math.random())}
        style={[
          styles.offerCard,
          isTherapist ? styles.therapistOffer : styles.clientOffer,
        ]}
      >
        <View style={styles.offerHeader}>
          <View
            style={[
              styles.offerAvatar,
              {
                backgroundColor: isTherapist
                  ? isDark
                    ? '#132A1E'
                    : COLORS.primarySoft
                  : isDark
                  ? '#173824'
                  : COLORS.greenSoft,
              },
            ]}
          >
            <Ionicons
              name={isTherapist ? 'person' : 'person-outline'}
              size={16}
              color={isTherapist ? COLORS.primary : COLORS.green}
            />
          </View>

          <View style={styles.offerUser}>
            <Text style={styles.offerUserName} numberOfLines={1}>
              {offerName}
            </Text>
            <Text style={styles.offerRole}>
              {isTherapist ? 'Thérapeute' : 'Client'}
            </Text>
          </View>

          <View
            style={[styles.offerStatus, { backgroundColor: `${color}18` }]}
          >
            <Text style={[styles.offerStatusText, { color }]}>
              {statusLabel(status)}
            </Text>
          </View>
        </View>

        <View style={styles.offerPriceBox}>
          <Text style={styles.offerPriceLabel}>Prix proposé</Text>
          <Text style={styles.offerPrice}>
            {money(offer?.price_offered ?? offer?.price ?? 0)}
          </Text>
        </View>

        {offer?.message ? (
          <View style={styles.messageBox}>
            <Ionicons
              name="chatbox-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.offerMessage} numberOfLines={4}>
              {offer.message}
            </Text>
          </View>
        ) : null}

        <View style={styles.offerFooter}>
          <Text style={styles.offerDate}>
            {dateText(offer?.created_at)}
          </Text>
        </View>

        {canNegotiate && !isTherapist && status === 'sent' ? (
          <TouchableOpacity
            disabled={submitting}
            onPress={() => sendCounterOffer(offer)}
            style={[styles.counterButton, submitting && styles.disabled]}
            activeOpacity={0.85}
          >
            <Ionicons
              name="swap-horizontal"
              size={16}
              color={COLORS.primary}
            />
            <Text style={styles.counterButtonText}>Contre-offre</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading && !booking) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />
        <Header
          title="Détails"
          showBack
          onBackPress={handleBack}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
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
            color={COLORS.white}
          />
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      ) : null}

      <Header
        title="Détails et négociation"
        subtitle={`Réservation #${booking?.id || bookingId}`}
        showBack
        onBackPress={handleBack}
        rightComponent={
          <TouchableOpacity
            onPress={() => loadData(true)}
            disabled={refreshing}
            style={styles.refreshButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="refresh" size={19} color={COLORS.white} />
            )}
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={COLORS.primary}
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ==================================================
              STATUT
          ================================================== */}

          <LinearGradient
            colors={[statusInfo.color, `${statusInfo.color}CC`]}
            style={styles.statusCard}
          >
            <View style={styles.statusIconContainer}>
              <Ionicons name={statusInfo.icon} size={22} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.statusSmall}>STATUT</Text>
              <Text style={styles.statusTitle}>{statusInfo.label}</Text>
            </View>

            {expiresAt ? (
              <View style={styles.timerPill}>
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={isExpired ? COLORS.red : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.timerPillText,
                    isExpired && { color: COLORS.red },
                  ]}
                  numberOfLines={1}
                >
                  {isExpired ? 'Expiré' : formatRemaining(remainingTime)}
                </Text>
              </View>
            ) : null}
          </LinearGradient>

          {/* ==================================================
              GRID WEB : 2 colonnes
          ================================================== */}

          <View style={styles.webGrid}>
            {/* --------------------------------------------
                CLIENT + Actions Message/Appeler
            -------------------------------------------- */}
            <Section title="Client" style={styles.gridItem}>
              <View style={styles.profileHeader}>
                <View style={styles.profileAvatarFrame}>
                  {clientPhoto ? (
                    <Image
                      source={{ uri: clientPhoto }}
                      style={styles.profileAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons
                      name="person"
                      size={22}
                      color={COLORS.primary}
                    />
                  )}
                </View>

                <View style={styles.profileInfo}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {clientName}
                  </Text>
                  <Text style={styles.profileId} numberOfLines={1}>
                    Client #{booking?.client_id ?? client?.id ?? '-'}
                  </Text>
                </View>
              </View>

              <InfoRow
                icon="call-outline"
                label="Téléphone"
                value={clientPhone || 'Non renseigné'}
              />
              <InfoRow
                icon="mail-outline"
                label="Email"
                value={clientEmail || 'Non renseigné'}
              />

              {canContact ? (
                <View style={styles.inlineActionsRow}>
                  <TouchableOpacity
                    style={styles.inlineAction}
                    onPress={goToChat}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={15}
                      color={COLORS.primary}
                    />
                    <Text style={styles.inlineActionText}>Message</Text>
                  </TouchableOpacity>

                  {clientPhone ? (
                    <TouchableOpacity
                      style={styles.inlineAction}
                      onPress={callClient}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="call-outline"
                        size={15}
                        color={COLORS.primary}
                      />
                      <Text style={styles.inlineActionText}>Appeler</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </Section>

            {/* --------------------------------------------
                SERVICE + Actions Négocier
            -------------------------------------------- */}
            <Section title="Service demandé" style={styles.gridItem}>
              <View style={styles.serviceHeader}>
                <View style={styles.serviceIcon}>
                  <Ionicons
                    name="heart-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName} numberOfLines={1}>
                    {massageName}
                  </Text>
                  {category ? (
                    <Text
                      style={styles.serviceCategory}
                      numberOfLines={1}
                    >
                      Catégorie : {category}
                    </Text>
                  ) : null}
                </View>
              </View>

              <InfoRow
                icon="cash-outline"
                label="Prix proposé par le client"
                value={money(clientPrice)}
                valueStyle={styles.priceValue}
              />

              {therapistPrice !== null ? (
                <InfoRow
                  icon="person-outline"
                  label="Prix thérapeute"
                  value={money(therapistPrice)}
                />
              ) : null}

              {finalPrice !== null ? (
                <InfoRow
                  icon="checkmark-circle-outline"
                  label="Prix final"
                  value={money(finalPrice)}
                  valueStyle={styles.finalPrice}
                />
              ) : null}

              <InfoRow
                icon="time-outline"
                label="Durée"
                value={`${duration} minutes`}
              />

              {canNegotiate ? (
                <View style={styles.inlineActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.inlineAction,
                      styles.primaryNegotiationAction,
                      isNegotiating && styles.inlineActionNegotiation,
                    ]}
                    onPress={goToNegotiation}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={15}
                      color={isNegotiating ? COLORS.orange : COLORS.primary}
                    />
                    <Text
                      style={[
                        styles.inlineActionText,
                        isNegotiating && styles.inlineActionNegotiationText,
                      ]}
                    >
                      {isNegotiating ? 'Négociation' : 'Négocier'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Section>

            {/* --------------------------------------------
                RENDEZ-VOUS + Action Naviguer
            -------------------------------------------- */}
            <Section title="Rendez-vous" style={styles.gridItem}>
              <InfoRow
                icon="calendar-outline"
                label="Date prévue"
                value={dateShort(scheduledDate)}
              />
              <InfoRow
                icon="clock-outline"
                label="Heure prévue"
                value={timeShort(scheduledDate)}
              />
              <InfoRow
                icon="location-outline"
                label="Adresse"
                value={address}
              />
              <InfoRow
                icon="navigate-outline"
                label="Distance"
                value={
                  distance !== null && distance !== undefined
                    ? `${Number(distance).toFixed(1)} km`
                    : 'Non disponible'
                }
              />
              <InfoRow
                icon="car-outline"
                label="ETA approximatif"
                value={
                  eta !== null && eta !== undefined
                    ? `${eta} minutes`
                    : 'Non disponible'
                }
              />
              <InfoRow
                icon="male-female"
                label="Genre préféré"
                value={genderDisplay}
              />

              {latitude !== null && longitude !== null ? (
                <View style={styles.inlineActionsRow}>
                  <TouchableOpacity
                    style={styles.inlineAction}
                    onPress={goToNavigation}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="navigate-outline"
                      size={15}
                      color={COLORS.primary}
                    />
                    <Text style={styles.inlineActionText}>
                      Naviguer
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Section>

            {/* --------------------------------------------
                SUIVI + Actions Suivi / SOS
            -------------------------------------------- */}
            {canTrack ? (
              <Section title="Suivi" style={styles.gridItem}>
                <InfoRow
                  icon="information-circle-outline"
                  label="État"
                  value={statusInfo.label}
                  valueStyle={{
                    color: statusInfo.color,
                    fontWeight: '900',
                  }}
                />

                <InfoRow
                  icon="chatbubbles-outline"
                  label="Nombre d'offres"
                  value={String(offersCount)}
                />

                <View style={styles.inlineActionsRow}>
                  <TouchableOpacity
                    style={styles.inlineAction}
                    onPress={goToTracking}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="locate-outline"
                      size={15}
                      color={COLORS.primary}
                    />
                    <Text style={styles.inlineActionText}>
                      Suivi en direct
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.inlineAction, styles.inlineActionDanger]}
                    onPress={goToSOS}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={15}
                      color={COLORS.red}
                    />
                    <Text
                      style={[
                        styles.inlineActionText,
                        { color: COLORS.red },
                      ]}
                    >
                      SOS Urgence
                    </Text>
                  </TouchableOpacity>
                </View>
              </Section>
            ) : (
              <Section
                title="Informations système"
                style={styles.gridItem}
              >
                <InfoRow
                  icon="add-circle-outline"
                  label="Créée le"
                  value={dateText(createdAt)}
                />
                <InfoRow
                  icon="hourglass-outline"
                  label="Expire le"
                  value={dateText(expiresAt)}
                />
                <InfoRow
                  icon="chatbubbles-outline"
                  label="Nombre d'offres"
                  value={String(offersCount)}
                />
                <InfoRow
                  icon={
                    hasMyOffer
                      ? 'checkmark-circle-outline'
                      : 'close-circle-outline'
                  }
                  label="Mon offre"
                  value={hasMyOffer ? 'Déjà envoyée' : 'Aucune offre'}
                  valueStyle={
                    hasMyOffer
                      ? styles.successValue
                      : styles.mutedValue
                  }
                />
              </Section>
            )}
          </View>

          {/* ==================================================
              INSTRUCTIONS
          ================================================== */}

          {instructions ? (
            <Section title="Instructions spéciales">
              <View style={styles.instructions}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.instructionsText}>
                  {instructions}
                </Text>
              </View>
            </Section>
          ) : null}

          {/* ==================================================
              MON OFFRE ACTUELLE
          ================================================== */}

          {myOffer ? (
            <Section title="Mon offre actuelle">
              <View style={styles.myOfferCard}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.myOfferLabel}>
                    Montant proposé
                  </Text>
                  <Text style={styles.myOfferPrice}>
                    {money(
                      myOffer?.price_offered ?? myOffer?.price ?? 0
                    )}
                  </Text>
                </View>

                {myOffer?.status ? (
                  <View
                    style={[
                      styles.offerStatus,
                      {
                        backgroundColor: `${statusColor(
                          myOffer.status
                        )}18`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.offerStatusText,
                        { color: statusColor(myOffer.status) },
                      ]}
                    >
                      {statusLabel(myOffer.status)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {myOffer?.message ? (
                <Text style={styles.myOfferMessage}>
                  {myOffer.message}
                </Text>
              ) : null}
            </Section>
          ) : null}

          {/* ==================================================
              FAIRE UNE OFFRE
          ================================================== */}

          {canNegotiate ? (
            <Section title="Faire une offre">
              <Text style={styles.helper}>
                Proposez votre tarif ou acceptez directement le prix du
                client.
              </Text>

              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="Ex : 50000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                style={styles.input}
              />

              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Message au client (optionnel)"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={[styles.input, styles.messageInput]}
              />

              <View style={styles.offerButtonsRow}>
                <TouchableOpacity
                  disabled={submitting}
                  onPress={sendOffer}
                  style={[
                    styles.primaryButton,
                    submitting && styles.disabled,
                  ]}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons
                        name="send"
                        size={16}
                        color={COLORS.white}
                      />
                      <Text style={styles.primaryButtonText}>
                        Envoyer
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={submitting || clientPrice <= 0}
                  onPress={acceptClientPrice}
                  style={[
                    styles.acceptButton,
                    (submitting || clientPrice <= 0) && styles.disabled,
                  ]}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={COLORS.white}
                  />
                  <Text
                    style={styles.primaryButtonText}
                    numberOfLines={1}
                  >
                    Accepter {money(clientPrice)}
                  </Text>
                </TouchableOpacity>
              </View>
            </Section>
          ) : null}

          {/* ==================================================
              HISTORIQUE
          ================================================== */}

          <Section title="Historique de négociation">
            {isNegotiating ? (
              <TouchableOpacity
                style={styles.historyNegotiationButton}
                onPress={goToNegotiation}
                activeOpacity={0.85}
              >
                <View style={styles.historyNegotiationIcon}>
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={17}
                    color={COLORS.orange}
                  />
                </View>
                <View style={styles.historyNegotiationContent}>
                  <Text style={styles.historyNegotiationTitle}>
                    Négociation en cours
                  </Text>
                  <Text style={styles.historyNegotiationSubtitle}>
                    Ouvrir la négociation pour continuer l’échange
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward-outline"
                  size={18}
                  color={COLORS.orange}
                />
              </TouchableOpacity>
            ) : null}

            {offers.length === 0 ? (
              <View style={styles.noOffers}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={32}
                  color={colors.textSecondary}
                />
                <Text style={styles.noOffersTitle}>Aucune offre</Text>
                <Text style={styles.noOffersText}>
                  La négociation commencera lorsqu'une offre sera envoyée.
                </Text>
              </View>
            ) : (
              offers.map(renderOffer)
            )}
          </Section>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// SECTION
// ============================================================

function Section({ title, children, style }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, isDark),
    [colors, isDark]
  );

  return (
    <View style={[styles.section, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ============================================================
// INFO ROW
// ============================================================

function InfoRow({ icon, label, value, valueStyle }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, isDark),
    [colors, isDark]
  );

  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={14} color={COLORS.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueStyle]} numberOfLines={2}>
          {value === null || value === undefined || value === ''
            ? 'Non renseigné'
            : String(value)}
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const createStyles = (colors, isDark, screenWidth = 390) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },

    loadingText: {
      marginTop: 10,
      color: colors.textSecondary,
      fontSize: 12,
    },

    // --------------------------------------------------------
    // TOAST
    // --------------------------------------------------------

    toast: {
      position: 'absolute',
      zIndex: 1000,
      top: 12,
      left: 14,
      right: 14,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 12,
      elevation: 8,
      ...Platform.select({
        web: { boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
      }),
    },

    toastSuccess: { backgroundColor: COLORS.primary },
    toastError: { backgroundColor: COLORS.red },

    toastText: {
      flex: 1,
      marginLeft: 8,
      color: COLORS.white,
      fontWeight: '700',
      fontSize: 12.5,
    },

    refreshButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },

    // --------------------------------------------------------
    // CONTENT
    // --------------------------------------------------------

    content: {
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'center',
      paddingHorizontal: Platform.OS === 'web' ? (screenWidth >= 900 ? 24 : 16) : 12,
      paddingTop: Platform.OS === 'web' ? 18 : 12,
      paddingBottom: Platform.OS === 'web' ? 56 : 40,
    },

    webGrid: {
      flexDirection: screenWidth >= 900 ? 'row' : 'column',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'stretch',
    },

    gridItem: {
      width: screenWidth >= 900 ? '49.25%' : '100%',
    },

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    statusCard: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: screenWidth >= 900 ? 18 : 13,
      paddingVertical: screenWidth >= 900 ? 16 : 13,
      borderRadius: screenWidth >= 900 ? 20 : 16,
      marginBottom: 4,
      gap: 11,
      ...Platform.select({
        web: {
          boxShadow: '0 10px 30px rgba(46,139,87,0.16)',
        },
        default: {
          shadowColor: COLORS.primary,
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 3,
        },
      }),
    },

    statusIconContainer: {
      width: screenWidth >= 900 ? 46 : 40,
      height: screenWidth >= 900 ? 46 : 40,
      borderRadius: screenWidth >= 900 ? 23 : 20,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    statusSmall: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    statusTitle: {
      color: '#FFFFFF',
      fontSize: screenWidth >= 900 ? 16 : 14,
      fontWeight: '900',
      marginTop: 2,
    },

    timerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.22)',
      maxWidth: 140,
    },

    timerPillText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },

    // --------------------------------------------------------
    // SECTION
    // --------------------------------------------------------

    section: {
      marginTop: 12,
      padding: screenWidth >= 900 ? 18 : 14,
      backgroundColor: colors.surface,
      borderRadius: screenWidth >= 900 ? 18 : 15,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 8px 28px rgba(0,0,0,0.16)'
            : '0 8px 28px rgba(20,55,38,0.06)',
        },
        default: {
          shadowColor: '#183B2A',
          shadowOpacity: isDark ? 0.12 : 0.06,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 5 },
          elevation: 2,
        },
      }),
    },

    sectionTitle: {
      fontSize: screenWidth >= 900 ? 14 : 12.5,
      fontWeight: '900',
      color: colors.text,
      marginBottom: 12,
      letterSpacing: 0.1,
    },

    // --------------------------------------------------------
    // PROFILE
    // --------------------------------------------------------

    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      gap: 10,
    },

    profileAvatarFrame: {
      width: 52,
      height: 52,
      borderRadius: 16,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
    },

    profileAvatarImage: { width: '100%', height: '100%' },

    profileInfo: { flex: 1, minWidth: 0 },

    profileName: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.text,
    },

    profileId: {
      marginTop: 2,
      fontSize: 10.5,
      color: colors.textSecondary,
    },

    // --------------------------------------------------------
    // INFO ROW
    // --------------------------------------------------------

    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },

    infoIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
    },

    infoContent: { flex: 1, minWidth: 0 },

    infoLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },

    infoValue: {
      marginTop: 2,
      fontSize: 11.5,
      lineHeight: 16,
      fontWeight: '600',
      color: colors.text,
    },

    priceValue: {
      fontSize: 12.5,
      fontWeight: '900',
      color: COLORS.primary,
    },
    finalPrice: {
      fontSize: 12.5,
      fontWeight: '900',
      color: COLORS.primary,
    },
    successValue: { color: COLORS.primary, fontWeight: '800' },
    mutedValue: { color: colors.textSecondary },

    // --------------------------------------------------------
    // SERVICE
    // --------------------------------------------------------

    serviceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      gap: 10,
    },

    serviceIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
    },

    serviceInfo: { flex: 1, minWidth: 0 },

    serviceName: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.text,
    },

    serviceCategory: {
      marginTop: 2,
      fontSize: 10.5,
      color: colors.textSecondary,
    },

    // --------------------------------------------------------
    // INLINE ACTIONS (dans les sections)
    // --------------------------------------------------------

    inlineActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },

    inlineAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 38,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: isDark ? '#1E4030' : COLORS.primaryTint,
      backgroundColor: isDark ? '#132A1E' : COLORS.card,
    },

    inlineActionDanger: {
      borderColor: isDark ? '#5C2B2B' : '#F0CACA',
      backgroundColor: isDark ? '#3A1717' : COLORS.redSoft,
    },

    inlineActionText: {
      fontSize: 11.5,
      fontWeight: '800',
      color: COLORS.primary,
    },

    primaryNegotiationAction: {
      minHeight: 42,
      paddingHorizontal: 16,
      borderRadius: 12,
    },

    inlineActionNegotiation: {
      borderColor: isDark ? '#6B4A16' : '#F2D39A',
      backgroundColor: isDark ? '#3A2A12' : COLORS.orangeSoft,
    },

    inlineActionNegotiationText: {
      color: COLORS.orange,
    },

    // --------------------------------------------------------
    // INSTRUCTIONS
    // --------------------------------------------------------

    instructions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 10,
      borderRadius: 10,
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
      gap: 8,
    },

    instructionsText: {
      flex: 1,
      fontSize: 11.5,
      lineHeight: 17,
      color: colors.text,
    },

    // --------------------------------------------------------
    // MY OFFER
    // --------------------------------------------------------

    myOfferCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderRadius: 12,
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
      borderWidth: 1,
      borderColor: isDark ? '#1E4030' : COLORS.primaryTint,
      gap: 10,
    },

    myOfferLabel: {
      fontSize: 9.5,
      color: colors.textSecondary,
      fontWeight: '800',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },

    myOfferPrice: {
      marginTop: 3,
      fontSize: 16,
      fontWeight: '900',
      color: COLORS.primary,
    },

    myOfferMessage: {
      marginTop: 8,
      fontSize: 11.5,
      lineHeight: 17,
      color: colors.text,
    },

    // --------------------------------------------------------
    // INPUTS
    // --------------------------------------------------------

    helper: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
      marginBottom: 10,
    },

    input: {
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      backgroundColor: colors.input,
      color: colors.text,
      fontSize: 12.5,
      ...Platform.select({
        web: { outlineStyle: 'none' },
        default: {},
      }),
    },

    messageInput: { minHeight: 92 },

    offerButtonsRow: {
      flexDirection: screenWidth >= 520 ? 'row' : 'column',
      gap: 9,
      marginTop: 5,
    },

    primaryButton: {
      flex: screenWidth >= 520 ? 1 : 0,
      width: screenWidth >= 520 ? undefined : '100%',
      minHeight: 48,
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
      gap: 6,
      paddingHorizontal: 8,
    },

    acceptButton: {
      flex: screenWidth >= 520 ? 1 : 0,
      width: screenWidth >= 520 ? undefined : '100%',
      minHeight: 48,
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryDark,
      gap: 6,
      paddingHorizontal: 8,
    },

    primaryButtonText: {
      color: COLORS.white,
      fontSize: 12,
      fontWeight: '900',
    },

    disabled: { opacity: 0.55 },

    // --------------------------------------------------------
    // OFFERS
    // --------------------------------------------------------

    noOffers: {
      alignItems: 'center',
      paddingVertical: 18,
    },

    noOffersTitle: {
      marginTop: 7,
      fontSize: 12.5,
      fontWeight: '900',
      color: colors.text,
    },

    noOffersText: {
      marginTop: 4,
      textAlign: 'center',
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
      maxWidth: 260,
    },

    // Bouton affiché dans l’historique lorsque la demande est
    // toujours en cours de négociation.
    historyNegotiationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? '#6B4A16' : '#F2D39A',
      backgroundColor: isDark ? '#3A2A12' : COLORS.orangeSoft,
      gap: 9,
    },

    historyNegotiationIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#4A3517' : '#FFF7E8',
    },

    historyNegotiationContent: {
      flex: 1,
      minWidth: 0,
    },

    historyNegotiationTitle: {
      fontSize: 11.5,
      fontWeight: '900',
      color: COLORS.orange,
    },

    historyNegotiationSubtitle: {
      marginTop: 2,
      fontSize: 10,
      lineHeight: 14,
      color: colors.textSecondary,
    },

    offerCard: {
      padding: screenWidth >= 900 ? 14 : 12,
      marginBottom: 10,
      borderRadius: 14,
      borderWidth: 1,
      backgroundColor: colors.surface,
    },

    therapistOffer: {
      borderColor: isDark ? '#1E4030' : COLORS.primaryTint,
      backgroundColor: isDark ? '#132A1E' : '#F7FCF9',
    },

    clientOffer: {
      borderColor: isDark ? '#204028' : COLORS.greenSoft,
      backgroundColor: isDark ? '#132018' : '#FAFFFC',
    },

    offerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    offerAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },

    offerUser: { flex: 1, minWidth: 0 },

    offerUserName: {
      fontSize: 12,
      fontWeight: '900',
      color: colors.text,
    },

    offerRole: {
      marginTop: 1,
      fontSize: 10,
      color: colors.textSecondary,
    },

    offerStatus: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },

    offerStatusText: {
      fontSize: 9.5,
      fontWeight: '800',
    },

    offerPriceBox: {
      marginTop: 8,
      padding: 8,
      borderRadius: 9,
      backgroundColor: colors.surfaceLight,
    },

    offerPriceLabel: {
      fontSize: 9,
      color: colors.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },

    offerPrice: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '900',
      color: COLORS.primary,
    },

    messageBox: {
      flexDirection: 'row',
      marginTop: 8,
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.surfaceLight,
      gap: 6,
    },

    offerMessage: {
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
      color: colors.text,
    },

    offerFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },

    offerDate: {
      fontSize: 9.5,
      color: colors.textSecondary,
    },

    counterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      paddingVertical: 8,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: isDark ? '#1E4030' : COLORS.primaryTint,
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
      gap: 5,
    },

    counterButtonText: {
      color: COLORS.primary,
      fontSize: 11,
      fontWeight: '800',
    },
  });