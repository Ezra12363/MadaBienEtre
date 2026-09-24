// src/screens/therapist/OfferScreen.js

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import bookingService from '../../services/bookingService';
import offerService from '../../services/offerService';

import Header from '../../components/common/Header';

import { useTheme } from '../../context/ThemeContext';

// ============================================================
// COLORS (alignés avec OffersScreen)
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
  if (!value) return 'Non renseignée';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
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
    indifférent: 'Peu importe',
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
    cancelled_by_client: 'Annulée par le client',
    cancelled_by_therapist: 'Annulée par le thérapeute',
  };
  return labels[value] || status || 'Inconnu';
};

const statusColor = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'accepted' || value === 'confirmed' || value === 'completed') {
    return COLORS.primary;
  }
  if (value === 'rejected' || value === 'expired' || value === 'cancelled') {
    return COLORS.red;
  }
  return COLORS.orange;
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

  const styles = useMemo(
    () => createStyles(colors, isDark),
    [colors, isDark]
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
  // AUTO REFRESH
  // ==========================================================

  useEffect(() => {
    const interval = setInterval(() => loadData(true), 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ==========================================================
  // COUNTDOWN
  // ==========================================================

  useEffect(() => {
    const update = () => {
      setRemainingTime(getRemaining(booking?.expires_at));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [booking?.expires_at]);

  // ==========================================================
  // BOOKING DATA
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
    client?.phone ||
    booking?.client_phone ||
    booking?.phone ||
    'Non renseigné';

  const clientEmail =
    client?.email ||
    booking?.client_email ||
    booking?.email ||
    'Non renseigné';

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

  const distance =
    booking?.distance_km ?? booking?.distanceKm ?? null;

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

  const gender = booking?.preferred_gender ?? 'Non précisé';
  const genderDisplay = genderLabel(gender);

  const instructions = booking?.special_instructions || null;

  const createdAt = booking?.created_at ?? booking?.createdAt ?? null;
  const expiresAt = booking?.expires_at ?? booking?.expiresAt ?? null;

  const offersCount = Number(
    booking?.offers_count ??
      booking?.offersCount ??
      offers.length ??
      0
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
    myThreadOffers[0] ??
    booking?.my_offer ??
    booking?.myOffer ??
    null;

  const hasMyOffer = Boolean(myOffer);

  const bookingStatus = String(booking?.status || 'pending').toLowerCase();
  const isExpired = remainingTime <= 0;

  const canNegotiate =
    !isExpired &&
    ![
      'confirmed',
      'completed',
      'expired',
      'cancelled',
      'cancelled_by_client',
      'cancelled_by_therapist',
    ].includes(bookingStatus);

  // ==========================================================
  // SEND OFFER
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
  // ACCEPT CLIENT PRICE
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
          showToast('error', result?.error || 'Impossible d’accepter le prix.');
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
  // COUNTER OFFER
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
  // OFFER CARD
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
              size={20}
              color={isTherapist ? COLORS.primary : COLORS.green}
            />
          </View>

          <View style={styles.offerUser}>
            <Text style={styles.offerUserName}>{offerName}</Text>
            <Text style={styles.offerRole}>
              {isTherapist ? 'Thérapeute' : 'Client'}
            </Text>
          </View>

          <View
            style={[
              styles.offerStatus,
              { backgroundColor: `${color}18` },
            ]}
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
              size={17}
              color={colors.textSecondary}
            />
            <Text style={styles.offerMessage}>{offer.message}</Text>
          </View>
        ) : null}

        <View style={styles.offerFooter}>
          <Text style={styles.offerDate}>{dateText(offer?.created_at)}</Text>
          <Text style={[styles.offerStatusFooter, { color }]}>
            {statusLabel(status)}
          </Text>
        </View>

        {canNegotiate && !isTherapist && status === 'sent' ? (
          <TouchableOpacity
            disabled={submitting}
            onPress={() => sendCounterOffer(offer)}
            style={[
              styles.counterButton,
              submitting && styles.disabled,
            ]}
          >
            <Ionicons
              name="swap-horizontal"
              size={19}
              color={COLORS.primary}
            />
            <Text style={styles.counterButtonText}>
              Envoyer une contre-offre
            </Text>
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
          title="Détails et négociation"
          showBack
          onBackPress={() => navigation?.goBack?.()}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            Chargement de la réservation...
          </Text>
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
            toast.type === 'success' ? styles.toastSuccess : styles.toastError,
          ]}
        >
          <Ionicons
            name={
              toast.type === 'success'
                ? 'checkmark-circle'
                : 'alert-circle'
            }
            size={20}
            color={COLORS.white}
          />
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      ) : null}

      <Header
        title="Détails et négociation"
        subtitle={`Réservation #${booking?.id || bookingId}`}
        showBack
        onBackPress={() => navigation?.goBack?.()}
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
              <Ionicons name="refresh" size={21} color={COLORS.white} />
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

          {/* =================================================
              STATUS CARD
          ================================================= */}

          <View style={styles.statusCard}>
            <View style={styles.statusLeft}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: statusColor(bookingStatus),
                  },
                ]}
              />
              <View>
                <Text style={styles.statusLabel}>STATUT</Text>
                <Text
                  style={[
                    styles.statusValue,
                    { color: statusColor(bookingStatus) },
                  ]}
                >
                  {statusLabel(bookingStatus)}
                </Text>
              </View>
            </View>

            {expiresAt ? (
              <View
                style={[
                  styles.timerBox,
                  isExpired && styles.timerDanger,
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={19}
                  color={isExpired ? COLORS.red : COLORS.orange}
                />
                <View>
                  <Text style={styles.timerLabel}>Temps restant</Text>
                  <Text
                    style={[
                      styles.timer,
                      isExpired && styles.timerDangerText,
                    ]}
                  >
                    {isExpired
                      ? 'EXPIRÉ'
                      : formatRemaining(remainingTime)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* =================================================
              GRID WEB (2 colonnes)
          ================================================= */}

          <View style={styles.webGrid}>

            {/* CLIENT */}
            <Section title="Client" style={styles.gridItem}>
              <View style={styles.profileHeader}>
                <View style={styles.profileAvatarFrame}>
                  {client?.avatar_url ||
                  client?.avatar ||
                  client?.photo_url ||
                  client?.photo ||
                  client?.profile_photo_url ? (
                    <Image
                      source={{
                        uri:
                          client?.avatar_url ||
                          client?.avatar ||
                          client?.photo_url ||
                          client?.photo ||
                          client?.profile_photo_url,
                      }}
                      style={styles.profileAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons
                      name="person"
                      size={28}
                      color={COLORS.primary}
                    />
                  )}
                </View>

                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{clientName}</Text>
                  <Text style={styles.profileId}>
                    Client #{booking?.client_id ?? client?.id ?? '-'}
                  </Text>
                </View>
              </View>

              <InfoRow
                icon="call-outline"
                label="Téléphone"
                value={clientPhone}
              />
              <InfoRow
                icon="mail-outline"
                label="Email"
                value={clientEmail}
              />
            </Section>

            {/* SERVICE */}
            <Section title="Service demandé" style={styles.gridItem}>
              <View style={styles.serviceHeader}>
                <View style={styles.serviceIcon}>
                  <Ionicons
                    name="heart-outline"
                    size={25}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{massageName}</Text>
                  {category ? (
                    <Text style={styles.serviceCategory}>
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
            </Section>

            {/* RENDEZ-VOUS */}
            <Section title="Rendez-vous" style={styles.gridItem}>
              <InfoRow
                icon="calendar-outline"
                label="Date prévue"
                value={dateText(scheduledDate)}
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
                    ? `${Number(distance).toFixed(2)} km`
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
              <InfoRow
                icon="map-outline"
                label="GPS client"
                value={
                  latitude !== null && longitude !== null
                    ? `${latitude}, ${longitude}`
                    : 'Coordonnées non disponibles'
                }
              />
            </Section>

            {/* SYSTEM */}
            <Section title="Informations système" style={styles.gridItem}>
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
                  hasMyOffer ? styles.successValue : styles.mutedValue
                }
              />
            </Section>

          </View>
          {/* fin GRID WEB */}

          {/* =================================================
              INSTRUCTIONS
          ================================================= */}

          {instructions ? (
            <Section title="Instructions spéciales">
              <View style={styles.instructions}>
                <Ionicons
                  name="document-text-outline"
                  size={23}
                  color={COLORS.primary}
                />
                <Text style={styles.instructionsText}>{instructions}</Text>
              </View>
            </Section>
          ) : null}

          {/* =================================================
              MON OFFRE ACTUELLE
          ================================================= */}

          {myOffer ? (
            <Section title="Mon offre actuelle">
              <View style={styles.myOfferCard}>
                <View>
                  <Text style={styles.myOfferLabel}>Montant proposé</Text>
                  <Text style={styles.myOfferPrice}>
                    {money(myOffer?.price_offered ?? myOffer?.price ?? 0)}
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
                <Text style={styles.myOfferMessage}>{myOffer.message}</Text>
              ) : null}
            </Section>
          ) : null}

          {/* =================================================
              FAIRE UNE OFFRE
          ================================================= */}

          {canNegotiate ? (
            <Section title="Faire une offre">
              <Text style={styles.helper}>
                Proposez votre tarif au client ou acceptez directement son prix.
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
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.input, styles.messageInput]}
              />

              <TouchableOpacity
                disabled={submitting}
                onPress={sendOffer}
                style={[
                  styles.primaryButton,
                  submitting && styles.disabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons
                      name="send"
                      size={19}
                      color={COLORS.white}
                    />
                    <Text style={styles.primaryButtonText}>
                      Envoyer mon offre
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
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.primaryButtonText}>
                  Accepter {money(clientPrice)}
                </Text>
              </TouchableOpacity>
            </Section>
          ) : null}

          {/* =================================================
              HISTORIQUE
          ================================================= */}

          <Section title="Historique de négociation">
            {offers.length === 0 ? (
              <View style={styles.noOffers}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={42}
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

          <View style={{ height: 40 }} />
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
        <Ionicons name={icon} size={17} color={COLORS.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueStyle]}>
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

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },

    flex: {
      flex: 1,
    },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },

    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 13,
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
      padding: 14,
      borderRadius: 14,
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },

    toastSuccess: {
      backgroundColor: COLORS.primary,
    },

    toastError: {
      backgroundColor: COLORS.red,
    },

    toastText: {
      flex: 1,
      marginLeft: 9,
      color: COLORS.white,
      fontWeight: '700',
      fontSize: 13,
    },

    // --------------------------------------------------------
    // REFRESH BUTTON
    // --------------------------------------------------------

    refreshButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
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
      alignSelf: 'stretch',
      padding: Platform.OS === 'web' ? 24 : 14,
      paddingBottom: 50,
    },

    // --------------------------------------------------------
    // WEB GRID
    // --------------------------------------------------------

    webGrid: Platform.select({
      web: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
      },
      default: {},
    }),

    gridItem: Platform.select({
      web: {
        width: '49%',
      },
      default: {
        width: '100%',
      },
    }),

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },

    statusLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },

    statusDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 10,
    },

    statusLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '800',
      letterSpacing: 0.5,
    },

    statusValue: {
      marginTop: 3,
      fontSize: 16,
      fontWeight: '900',
    },

    timerBox: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: isDark ? '#332912' : COLORS.orangeSoft,
      gap: 8,
    },

    timerDanger: {
      backgroundColor: isDark ? '#3A1717' : COLORS.redSoft,
    },

    timerLabel: {
      fontSize: 9,
      color: colors.textSecondary,
      fontWeight: '700',
    },

    timer: {
      marginTop: 1,
      fontSize: 14,
      fontWeight: '900',
      color: COLORS.orange,
      letterSpacing: 0.4,
    },

    timerDangerText: {
      color: COLORS.red,
    },

    // --------------------------------------------------------
    // SECTION
    // --------------------------------------------------------

    section: {
      marginTop: 12,
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.03,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },

    sectionTitle: {
      fontSize: 13.5,
      fontWeight: '900',
      color: colors.text,
      marginBottom: 12,
      letterSpacing: 0.2,
    },

    // --------------------------------------------------------
    // PROFILE
    // --------------------------------------------------------

    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },

    profileAvatarFrame: {
      width: 64,
      height: 64,
      borderRadius: 16,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
    },

    profileAvatarImage: {
      width: '100%',
      height: '100%',
    },

    profileInfo: {
      marginLeft: 12,
      flex: 1,
    },

    profileName: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.text,
    },

    profileId: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSecondary,
    },

    // --------------------------------------------------------
    // INFO ROW
    // --------------------------------------------------------

    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    infoIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
      marginRight: 10,
    },

    infoContent: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      paddingTop: 1,
    },

    infoLabel: {
      fontSize: 9.5,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },

    infoValue: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '600',
      color: colors.text,
    },

    priceValue: {
      fontSize: 14,
      fontWeight: '900',
      color: COLORS.primary,
    },

    finalPrice: {
      fontSize: 14,
      fontWeight: '900',
      color: COLORS.primary,
    },

    successValue: {
      color: COLORS.primary,
      fontWeight: '800',
    },

    mutedValue: {
      color: colors.textSecondary,
    },

    // --------------------------------------------------------
    // SERVICE
    // --------------------------------------------------------

    serviceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },

    serviceIcon: {
      width: 52,
      height: 52,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
    },

    serviceInfo: {
      flex: 1,
      marginLeft: 12,
    },

    serviceName: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.text,
    },

    serviceCategory: {
      marginTop: 4,
      fontSize: 11,
      color: colors.textSecondary,
    },

    // --------------------------------------------------------
    // INSTRUCTIONS
    // --------------------------------------------------------

    instructions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 13,
      borderRadius: 13,
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
      gap: 10,
    },

    instructionsText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 19,
      color: colors.text,
    },

    // --------------------------------------------------------
    // MY OFFER
    // --------------------------------------------------------

    myOfferCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 14,
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
      borderWidth: 1,
      borderColor: isDark ? '#1E4030' : COLORS.primaryTint,
    },

    myOfferLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },

    myOfferPrice: {
      marginTop: 4,
      fontSize: 20,
      fontWeight: '900',
      color: COLORS.primary,
    },

    myOfferMessage: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 19,
      color: colors.text,
    },

    // --------------------------------------------------------
    // INPUT
    // --------------------------------------------------------

    helper: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: 12,
    },

    input: {
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.input,
      color: colors.text,
      fontSize: 13,
      ...Platform.select({
        web: { outlineStyle: 'none' },
        default: {},
      }),
    },

    messageInput: {
      minHeight: 100,
    },

    primaryButton: {
      minHeight: 50,
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
      marginTop: 4,
      gap: 8,
      shadowColor: COLORS.primary,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },

    acceptButton: {
      minHeight: 50,
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryDark,
      marginTop: 10,
      gap: 8,
    },

    primaryButtonText: {
      color: COLORS.white,
      fontSize: 13,
      fontWeight: '900',
    },

    disabled: {
      opacity: 0.55,
    },

    // --------------------------------------------------------
    // OFFERS
    // --------------------------------------------------------

    noOffers: {
      alignItems: 'center',
      paddingVertical: 25,
    },

    noOffersTitle: {
      marginTop: 9,
      fontSize: 14,
      fontWeight: '900',
      color: colors.text,
    },

    noOffersText: {
      marginTop: 5,
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      maxWidth: 280,
    },

    offerCard: {
      padding: 14,
      marginBottom: 11,
      borderRadius: 15,
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
    },

    offerAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },

    offerUser: {
      flex: 1,
      marginLeft: 10,
    },

    offerUserName: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.text,
    },

    offerRole: {
      marginTop: 2,
      fontSize: 10.5,
      color: colors.textSecondary,
    },

    offerStatus: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },

    offerStatusText: {
      fontSize: 10,
      fontWeight: '800',
    },

    offerPriceBox: {
      marginTop: 12,
      padding: 11,
      borderRadius: 11,
      backgroundColor: colors.surfaceLight,
    },

    offerPriceLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },

    offerPrice: {
      marginTop: 3,
      fontSize: 18,
      fontWeight: '900',
      color: COLORS.primary,
    },

    messageBox: {
      flexDirection: 'row',
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.surfaceLight,
      gap: 8,
    },

    offerMessage: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: colors.text,
    },

    offerFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
    },

    offerDate: {
      flex: 1,
      fontSize: 10.5,
      color: colors.textSecondary,
    },

    offerStatusFooter: {
      fontSize: 10.5,
      fontWeight: '800',
    },

    counterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 11,
      paddingVertical: 11,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: isDark ? '#1E4030' : COLORS.primaryTint,
      backgroundColor: isDark ? '#132A1E' : COLORS.primarySoft,
      gap: 7,
    },

    counterButtonText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '800',
    },
  });