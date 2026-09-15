// ============================================================
// src/screens/therapist/BookingDetailScreen.js
//
// VERSION THÉRAPEUTE - DETAIL RESERVATION
//
// Même forme / mêmes principes que la version client :
// 1. Card "Statut" en dégradé + description.
// 2. Card "Informations" : type de massage, date/heure prévues,
//    départ / fin réels du massage (affichés UNIQUEMENT s'ils
//    existent), adresse, prix.
// 3. Card "Client" : toujours affichée (un booking a toujours un
//    client), avec avatar, nom, téléphone, email — commentaire et
//    avis du client affichés UNIQUEMENT s'ils sont renseignés.
// 4. Card "Suivi" : timeline identique à la version client.
// 5. Actions : Voir l'adresse et naviguer, Continuer la
//   négociation, Suivi en direct + SOSButton (même composant
//   partagé que côté client), Message direct (Chat).
// 6. Le bouton "Ouvrir Google Maps" a été retiré : une seule
//    action de navigation ("Voir l'adresse et naviguer").
// ============================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';

import {
  colors,
  spacing,
  typography,
} from '../../theme';

import Header from '../../components/common/Header';
// ⚠️ SOSButton (composant partagé) retiré de cet écran : sa navigation
// interne pouvait renvoyer vers l'écran SOS du parcours CLIENT.
// Le bouton SOS de cet écran utilise désormais goToSOS(), une
// navigation explicite et isolée vers "TherapistSOS".

import bookingService from '../../services/bookingService';
import offerService from '../../services/offerService';

// ============================================================
// NORMALIZE STATUS
// ============================================================

const normalizeStatus = (status) => {
  const value = String(status || 'pending')
    .trim()
    .toLowerCase();

  if (
    value === 'negotiation' ||
    value === 'negotiating'
  ) {
    return 'negotiating';
  }

  if (value === 'accepted') {
    return 'confirmed';
  }

  if (value === 'started') {
    return 'in_progress';
  }

  return value;
};

// ============================================================
// STATUS INFO (texte du point de vue du thérapeute)
// ============================================================

const getStatusInfo = (status) => {
  const normalized = normalizeStatus(status);

  const map = {
    pending: {
      label: 'En attente',
      description:
        "Une demande de réservation est en attente. Vous pouvez faire une offre ou négocier le prix.",
      color: '#FFA726',
      icon: 'time-outline',
    },

    negotiating: {
      label: 'Négociation',
      description:
        'Vous êtes en négociation de prix avec le client.',
      color: '#2196F3',
      icon: 'chatbubble-ellipses-outline',
    },

    confirmed: {
      label: 'Confirmée',
      description: 'La réservation est confirmée avec le client.',
      color: '#4CAF50',
      icon: 'checkmark-circle-outline',
    },

    in_progress: {
      label: 'En cours',
      description: 'Le massage est actuellement en cours chez le client.',
      color: '#FF9800',
      icon: 'play-circle-outline',
    },

    completed: {
      label: 'Terminée',
      description: 'Cette prestation est terminée.',
      color: '#2E7D32',
      icon: 'checkmark-done-outline',
    },

    cancelled: {
      label: 'Annulée',
      description: 'Cette réservation a été annulée.',
      color: '#D32F2F',
      icon: 'close-circle-outline',
    },

    cancelled_by_client: {
      label: 'Annulée par le client',
      description: 'Le client a annulé cette réservation.',
      color: '#D32F2F',
      icon: 'close-circle-outline',
    },

    cancelled_by_therapist: {
      label: 'Annulée par vous',
      description: 'Vous avez annulé cette réservation.',
      color: '#D32F2F',
      icon: 'close-circle-outline',
    },

    expired: {
      label: 'Expirée',
      description: 'Cette demande a expiré.',
      color: '#6B7280',
      icon: 'alert-circle-outline',
    },
  };

  return map[normalized] || map.pending;
};

// ============================================================
// FORMAT PRICE
// ============================================================

const formatPrice = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return `${value} Ar`;
  }

  return `${number.toLocaleString('fr-FR')} Ar`;
};

// ============================================================
// PARSE DATE
// ============================================================

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return null;
  }

  const parsed = new Date(stringValue);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
};

// ============================================================
// FORMAT DATE
// ============================================================

const formatDate = (value) => {
  if (!value) {
    return '—';
  }

  const date = parseDateValue(value);

  if (!date) {
    return String(value);
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

// ============================================================
// FORMAT TIME
// ============================================================

const formatTime = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return '—';
  }

  const simpleTimeMatch = stringValue.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (simpleTimeMatch) {
    const hour = simpleTimeMatch[1].padStart(2, '0');
    const minute = simpleTimeMatch[2];

    return `${hour}:${minute}`;
  }

  const date = parseDateValue(stringValue);

  if (!date) {
    return stringValue;
  }

  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================================
// FORMAT DATE + HEURE (départ réel / fin réelle du massage)
// ============================================================

const formatDateTime = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const date = parseDateValue(value);

  if (!date) {
    return null;
  }

  const datePart = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const timePart = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${datePart} à ${timePart}`;
};

// ============================================================
// SAFE TEXT
// ============================================================

const safeText = (value, fallback = 'Non renseigné') => {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return fallback;
  }

  return String(value);
};

// ============================================================
// AVIS / NOTE DU CLIENT
// ============================================================

const ratingText = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const rounded = Math.round(n);
  const stars =
    '★★★★★'.slice(0, rounded) + '☆☆☆☆☆'.slice(0, 5 - rounded);
  return `${stars} (${n.toFixed(1)}/5)`;
};

// ============================================================
// FADE SLIDE IN
// ============================================================

const FadeSlideIn = ({ children, delay = 0 }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: false,
      }),

      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: false,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity, translateY, delay]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
};

// ============================================================
// CLIENT AVATAR
// ============================================================

const ClientAvatar = ({ photoUrl, name, size = 82 }) => {
  const [failed, setFailed] = useState(false);

  const showImage = Boolean(photoUrl) && !failed;

  const dimension = {
    width: size,
    height: size,
    borderRadius: size * 0.24,
  };

  const initial =
    String(name || 'C').trim().charAt(0).toUpperCase() || 'C';

  return (
    <View style={avatarStyles.wrapper}>
      {showImage ? (
        <Image
          source={{ uri: photoUrl }}
          style={[avatarStyles.image, dimension]}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`Photo de profil de ${name || 'client'}`}
        />
      ) : (
        <View style={[avatarStyles.fallback, dimension]}>
          <Ionicons
            name="person-outline"
            size={size * 0.38}
            color={colors.primary}
          />

          <Text
            style={[
              avatarStyles.fallbackText,
              { fontSize: size * 0.2 },
            ]}
          >
            {initial}
          </Text>
        </View>
      )}
    </View>
  );
};

const avatarStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  image: {
    backgroundColor: `${colors.primary}15`,
    borderWidth: 2,
    borderColor: '#FFFFFF',

    ...Platform.select({
      web: { boxShadow: '0 3px 8px rgba(0,0,0,0.15)' },
      default: { elevation: 3 },
    }),
  },

  fallback: {
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    gap: 2,

    ...Platform.select({
      web: { boxShadow: '0 3px 8px rgba(0,0,0,0.15)' },
      default: { elevation: 3 },
    }),
  },

  fallbackText: {
    color: colors.primary,
    fontWeight: '900',
  },
});

// ============================================================
// PROFILE INFO ROW
// ============================================================

const ProfileInfoRow = ({
  icon,
  label,
  value,
  color,
  themeColors,
  numberOfLines = 2,
}) => {
  return (
    <View style={styles.profileInfoRow}>
      <View
        style={[
          styles.profileInfoIcon,
          { backgroundColor: `${color}15` },
        ]}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>

      <View style={styles.profileInfoContent}>
        <Text
          style={[
            styles.profileInfoLabel,
            { color: themeColors.textSecondary },
          ]}
        >
          {label}
        </Text>

        <Text
          numberOfLines={numberOfLines}
          style={[
            styles.profileInfoValue,
            { color: themeColors.text },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
};

// ============================================================
// STATUTS
// ============================================================

// Statuts pour lesquels on peut encore négocier.
const NEGOTIABLE_STATUSES = ['pending', 'negotiating'];

// Statuts pour lesquels le suivi en direct / SOS ont du sens.
const TRACKABLE_STATUSES = ['confirmed', 'in_progress'];

// Statuts pour lesquels les actions "Contacter" / "Appeler"
// le client sont pertinentes (client déjà confirmé).
const CONTACTABLE_STATUSES = ['confirmed', 'in_progress', 'completed'];

// ============================================================
// SCREEN
// ============================================================

const BookingDetailScreen = ({ route, navigation }) => {
  const { colors: themeColors } = useTheme();

  const initialBooking = route?.params?.booking || null;

  const bookingId =
    route?.params?.bookingId ??
    route?.params?.id ??
    initialBooking?.id ??
    initialBooking?.booking_id ??
    null;

  const [booking, setBooking] = useState(initialBooking);
  const [isLoading, setIsLoading] = useState(!initialBooking);
  const [loadError, setLoadError] = useState('');

  const [activeClientOffer, setActiveClientOffer] = useState(null);
  const [loadingOffer, setLoadingOffer] = useState(false);

  // ==========================================================
  // LOAD BOOKING DETAILS
  // ==========================================================

  const loadBookingDetails = useCallback(async () => {
    if (
      bookingId === undefined ||
      bookingId === null ||
      bookingId === ''
    ) {
      setLoadError('Identifiant de réservation manquant.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError('');

    try {
      const cleanId = String(bookingId).trim();

      const result = await bookingService.getBooking(cleanId);

      if (!result?.success) {
        throw new Error(
          result?.error || 'Impossible de charger la réservation.'
        );
      }

      if (!result?.data) {
        throw new Error('La réservation est introuvable.');
      }

      setBooking(result.data);
    } catch (error) {
      console.error(
        '❌ [THERAPIST BOOKING DETAIL] Error loading booking:',
        error
      );

      setLoadError(
        error?.message ||
          'Impossible de charger les détails de la réservation.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  const loadClientOffer = useCallback(async () => {
    if (!bookingId) return;

    setLoadingOffer(true);
    try {
      const result = await offerService.getActiveClientOffer(bookingId);
      setActiveClientOffer(result?.success ? result.data : null);
    } catch {
      setActiveClientOffer(null);
    } finally {
      setLoadingOffer(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBookingDetails();
  }, [loadBookingDetails]);

  useFocusEffect(
    useCallback(() => {
      loadBookingDetails();
      loadClientOffer();
    }, [loadBookingDetails, loadClientOffer])
  );

  // ==========================================================
  // ACTIONS
  // ==========================================================

  const openNavigation = () => {
    const latitude =
      booking?.client_latitude ??
      booking?.clientLatitude ??
      booking?.latitude ??
      null;

    const longitude =
      booking?.client_longitude ??
      booking?.clientLongitude ??
      booking?.longitude ??
      null;

    const address =
      booking?.address ||
      booking?.client_location ||
      booking?.clientLocation ||
      'Adresse non renseignée';

    if (latitude == null || longitude == null) {
      Alert.alert(
        'Position indisponible',
        'Les coordonnées GPS du client ne sont pas disponibles.'
      );
      return;
    }

    navigation.navigate('Demandes', {
      screen: 'Navigation',
      params: {
        bookingId,
        clientAddress: address,
        clientLatitude: Number(latitude),
        clientLongitude: Number(longitude),
      },
    });
  };

  const goToNegotiation = () => {
    // ✅ Le nom d'écran enregistré dans TherapistNavigator (RequestsStack)
    // est "Negotiation" (voir OffersScreen qui l'utilise déjà avec succès).
    // "TherapistNegotiation" n'existait dans aucun stack : le bouton
    // atterrissait donc sur le mauvais écran (retombait sur "Offers").
    navigation.navigate('Demandes', {
      screen: 'Negotiation',
      params: {
        bookingId,
        booking,
        currentPrice:
          booking?.final_price ??
          booking?.price ??
          booking?.client_price_proposed ??
          0,
        clientName:
          booking?.client_name ||
          booking?.client?.fullname ||
          'Client',
      },
    });
  };

  const goToTracking = () => {
    // ✅ Nom d'écran réel : "Tracking" (RequestsStack).
    navigation.navigate('Demandes', {
      screen: 'Tracking',
      params: { bookingId },
    });
  };

  const goToChat = () => {
    // ✅ "TherapistChat" est désormais bien enregistré dans
    // TherapistNavigator (RequestsStack), isolé du "Chat" client.
    navigation.navigate('Demandes', {
      screen: 'TherapistChat',
      params: {
        bookingId,
        clientId:
          booking?.client_id ?? booking?.clientId ?? booking?.client?.id ?? null,
        clientName:
          booking?.client_name ||
          booking?.client_fullname ||
          booking?.client?.fullname ||
          'Client',
      },
    });
  };

  const goToSOS = () => {
    // ✅ Route dédiée thérapeute "TherapistSOS", distincte de la
    // route "SOS" du parcours client, pour ne plus jamais retomber
    // sur le mauvais écran depuis BookingDetailScreen.
    navigation.navigate('Demandes', {
      screen: 'TherapistSOS',
      params: {
        bookingId: currentBookingId ?? bookingId,
      },
    });
  };

  const callClient = async (phoneNumber) => {
    if (!phoneNumber) {
      Alert.alert(
        'Numéro indisponible',
        'Aucun numéro de téléphone renseigné pour ce client.'
      );
      return;
    }

    try {
      await Linking.openURL(`tel:${phoneNumber}`);
    } catch (error) {
      console.error(
        '❌ [THERAPIST BOOKING DETAIL] Appel impossible:',
        error
      );
      Alert.alert('Erreur', "Impossible d'ouvrir l'application téléphone.");
    }
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (isLoading && !booking) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: themeColors.background },
        ]}
      >
        <Header title="Détails" showBack />

        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text
            style={[
              styles.loadingText,
              { color: themeColors.textSecondary },
            ]}
          >
            Chargement de la réservation...
          </Text>
        </View>
      </View>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (loadError || !booking) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: themeColors.background },
        ]}
      >
        <Header title="Détails" showBack />

        <View style={styles.centerState}>
          <View
            style={[
              styles.errorIcon,
              { backgroundColor: `${colors.primary}15` },
            ]}
          >
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={colors.primary}
            />
          </View>

          <Text
            style={[styles.errorTitle, { color: themeColors.text }]}
          >
            Impossible de charger
          </Text>

          <Text
            style={[
              styles.errorText,
              { color: themeColors.textSecondary },
            ]}
          >
            {loadError || 'Réservation introuvable.'}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadBookingDetails}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================================
  // BOOKING DATA
  // ==========================================================

  const currentStatus = normalizeStatus(
    booking?.status ?? booking?.booking_status
  );

  const statusInfo = getStatusInfo(currentStatus);

  const currentBookingId =
    booking?.id ?? booking?.booking_id ?? bookingId;

  const massageType =
    booking?.massage_type_name ??
    booking?.massage_type?.name ??
    booking?.massage ??
    'Massage';

  const address =
    booking?.address ??
    booking?.client_location ??
    booking?.clientLocation ??
    'Adresse non renseignée';

  const scheduledDate =
    booking?.scheduled_date ??
    booking?.scheduledDate ??
    booking?.scheduled_at ??
    booking?.scheduledAt;

  const scheduledTime =
    booking?.scheduled_time ??
    booking?.scheduledTime ??
    booking?.scheduled_at ??
    booking?.scheduledAt ??
    booking?.scheduled_date;

  // ✅ Départ / fin réels du massage, posés automatiquement côté
  // backend (voir PUT /bookings/start/{id} et /bookings/complete/{id}).
  // Ils ne sont affichés que lorsqu'ils sont renseignés.
  const actualStartTime =
    booking?.actual_start_time ?? booking?.actualStartTime ?? null;

  const actualEndTime =
    booking?.actual_end_time ?? booking?.actualEndTime ?? null;

  // ✅ Commentaire / avis laissés par le client (si le backend les
  // fournit un jour) : masqués tant qu'ils sont absents.
  const clientComment =
    booking?.client_comment ??
    booking?.comment ??
    booking?.review_comment ??
    booking?.special_instructions ??
    null;

  const clientRating = ratingText(
    booking?.rating ?? booking?.client_rating ?? booking?.review_rating
  );

  // ==========================================================
  // CLIENT DATA
  // ==========================================================

  const clientId =
    booking?.client_id ?? booking?.clientId ?? booking?.client?.id ?? null;

  const clientName =
    booking?.client_name ||
    booking?.client_fullname ||
    booking?.client?.fullname ||
    booking?.client?.full_name ||
    'Client';

  const clientPhone =
    booking?.client_phone ||
    booking?.phone ||
    booking?.client?.phone ||
    null;

  const clientEmail =
    booking?.client_email ||
    booking?.email ||
    booking?.client?.email ||
    null;

  const clientPhoto =
    booking?.client_photo ||
    booking?.clientPhoto ||
    booking?.client?.profile_image ||
    booking?.client?.photo ||
    null;

  // Un booking a toujours un client — cette vérification suit
  // simplement le même principe défensif que côté client
  // (card masquée si aucune donnée valide n'est présente).
  const hasClientInfo = Boolean(clientId) || Boolean(booking?.client_name);

  // ==========================================================
  // PRICES
  // ==========================================================

  const clientPrice =
    booking?.client_price_proposed ?? booking?.price ?? 0;

  const therapistPrice =
    booking?.therapist_price ?? booking?.therapist_initial_price ?? null;

  const finalPrice = booking?.final_price ?? null;

  const displayPrice =
    finalPrice !== null && finalPrice !== undefined
      ? finalPrice
      : clientPrice;

  // ==========================================================
  // TIMELINE
  // ==========================================================

  const timeline = [
    { key: 'pending', label: 'Demande reçue', icon: 'paper-plane-outline' },
    { key: 'negotiating', label: 'Négociation', icon: 'chatbubble-ellipses-outline' },
    { key: 'confirmed', label: 'Réservation confirmée', icon: 'checkmark-circle-outline' },
    { key: 'in_progress', label: 'Massage en cours', icon: 'play-circle-outline' },
    { key: 'completed', label: 'Massage terminé', icon: 'checkmark-done-outline' },
  ];

  const getTimelineIndex = () => {
    if (currentStatus === 'pending') return 0;
    if (currentStatus === 'negotiating') return 1;
    if (currentStatus === 'confirmed') return 2;
    if (currentStatus === 'in_progress') return 3;
    if (currentStatus === 'completed') return 4;
    return -1;
  };

  const currentTimelineIndex = getTimelineIndex();

  const canNegotiate = NEGOTIABLE_STATUSES.includes(currentStatus);
  const canTrack = TRACKABLE_STATUSES.includes(currentStatus);
  const canContact = CONTACTABLE_STATUSES.includes(currentStatus);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Header title="Détails de la réservation" showBack />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ==================================================
            STATUT
        ================================================== */}

        <FadeSlideIn>
          <LinearGradient
            colors={[statusInfo.color, `${statusInfo.color}CC`]}
            style={styles.statusCard}
          >
            <View style={styles.statusIconContainer}>
              <Ionicons name={statusInfo.icon} size={30} color="#FFFFFF" />
            </View>

            <View style={styles.statusContent}>
              <Text style={styles.statusSmall}>STATUT</Text>
              <Text style={styles.statusTitle}>{statusInfo.label}</Text>
              <Text style={styles.statusDescription}>
                {statusInfo.description}
              </Text>
            </View>
          </LinearGradient>
        </FadeSlideIn>

        {/* ==================================================
            INFORMATIONS DE LA RÉSERVATION
        ================================================== */}

        <FadeSlideIn delay={80}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border || '#E5E5E5',
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              Informations
            </Text>

            {/* Type de massage */}
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="flower-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                  Type de massage
                </Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>
                  {massageType}
                </Text>
              </View>
            </View>

            {/* Date prévue */}
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: '#2196F315' }]}>
                <Ionicons name="calendar-outline" size={20} color="#2196F3" />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                  Date prévue
                </Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>
                  {formatDate(scheduledDate)}
                </Text>
              </View>
            </View>

            {/* Heure prévue */}
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: '#9C27B015' }]}>
                <Ionicons name="time-outline" size={20} color="#9C27B0" />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                  Heure prévue
                </Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>
                  {formatTime(scheduledTime)}
                </Text>
              </View>
            </View>

            {/* Massage démarré à — visible uniquement si renseigné */}
            {formatDateTime(actualStartTime) && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: '#FF980015' }]}>
                  <Ionicons name="play-circle-outline" size={20} color="#FF9800" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                    Massage démarré à
                  </Text>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>
                    {formatDateTime(actualStartTime)}
                  </Text>
                </View>
              </View>
            )}

            {/* Massage terminé à — visible uniquement si renseigné */}
            {formatDateTime(actualEndTime) && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: '#2E7D3215' }]}>
                  <Ionicons name="checkmark-done-outline" size={20} color="#2E7D32" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                    Massage terminé à
                  </Text>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>
                    {formatDateTime(actualEndTime)}
                  </Text>
                </View>
              </View>
            )}

            {/* Commentaire du client — visible uniquement si renseigné */}
            {clientComment && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: '#0EA5E915' }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#0EA5E9" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                    Commentaire du client
                  </Text>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>
                    {clientComment}
                  </Text>
                </View>
              </View>
            )}

            {/* Avis du client — visible uniquement si renseigné */}
            {clientRating && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: '#F59E0B15' }]}>
                  <Ionicons name="star-outline" size={20} color="#F59E0B" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                    Avis du client
                  </Text>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>
                    {clientRating}
                  </Text>
                </View>
              </View>
            )}

            {/* Adresse */}
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: '#4CAF5015' }]}>
                <Ionicons name="location-outline" size={20} color="#4CAF50" />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                  Adresse
                </Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>
                  {address}
                </Text>
              </View>
            </View>

            {/* Prix */}
            <View
              style={[styles.priceRow, { borderTopColor: themeColors.border || '#E5E5E5' }]}
            >
              <View style={styles.priceLeft}>
                <Ionicons name="cash-outline" size={22} color={colors.primary} />
                <Text style={[styles.priceLabel, { color: themeColors.text }]}>Prix</Text>
              </View>
              <Text style={[styles.priceValue, { color: colors.primary }]}>
                {formatPrice(displayPrice)}
              </Text>
            </View>

            {therapistPrice !== null && therapistPrice !== undefined && (
              <View style={styles.subPriceRow}>
                <Text style={[styles.subPriceLabel, { color: themeColors.textSecondary }]}>
                  Votre offre initiale
                </Text>
                <Text style={[styles.subPriceValue, { color: themeColors.text }]}>
                  {formatPrice(therapistPrice)}
                </Text>
              </View>
            )}

            {finalPrice !== null && finalPrice !== undefined && (
              <View style={styles.subPriceRow}>
                <Text style={[styles.subPriceLabel, { color: themeColors.textSecondary }]}>
                  Prix final
                </Text>
                <Text style={[styles.finalPriceValue, { color: '#2E7D32' }]}>
                  {formatPrice(finalPrice)}
                </Text>
              </View>
            )}

            {!loadingOffer && activeClientOffer && (
              <View style={styles.offerBox}>
                <Ionicons name="pricetag-outline" size={18} color="#7C3AED" />
                <Text style={styles.offerText}>
                  Offre client active : {formatPrice(activeClientOffer.price_offered)}
                </Text>
              </View>
            )}
          </View>
        </FadeSlideIn>

        {/* ==================================================
            CLIENT

            IMPORTANT :
            Ce card n'est masqué que si aucune donnée client
            valide n'est présente (cas anormal).
        ================================================== */}

        {hasClientInfo && (
          <FadeSlideIn delay={160}>
            <View
              style={[
                styles.card,
                styles.clientCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border || '#E5E5E5',
                },
              ]}
            >
              <View style={styles.clientHeaderRow}>
                <View style={styles.clientTitleLeft}>
                  <View
                    style={[
                      styles.clientTitleIcon,
                      { backgroundColor: `${colors.primary}15` },
                    ]}
                  >
                    <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        styles.clientSectionTitle,
                        { color: themeColors.text },
                      ]}
                    >
                      Client
                    </Text>
                    <Text
                      style={[styles.clientHeaderSubtitle, { color: themeColors.textSecondary }]}
                    >
                      Informations pour cette réservation
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={[styles.clientDivider, { backgroundColor: themeColors.border || '#E5E5E5' }]}
              />

              {/* Profil principal */}
              <View style={styles.clientProfileRow}>
                <ClientAvatar photoUrl={clientPhoto} name={clientName} size={82} />

                <View style={styles.clientMainDetails}>
                  <Text style={[styles.clientName, { color: themeColors.text }]}>
                    {safeText(clientName, 'Client')}
                  </Text>
                  <Text style={[styles.clientRole, { color: themeColors.textSecondary }]}>
                    Client de la réservation
                  </Text>
                </View>
              </View>

              {/* Informations du client */}
              <View style={styles.profileInfoGrid}>
                <ProfileInfoRow
                  icon="person-outline"
                  label="Nom et prénom"
                  value={safeText(clientName, 'Non renseigné')}
                  color={colors.primary}
                  themeColors={themeColors}
                />

                <ProfileInfoRow
                  icon="call-outline"
                  label="Numéro de téléphone"
                  value={safeText(clientPhone, 'Numéro non renseigné')}
                  color="#4CAF50"
                  themeColors={themeColors}
                />

                {/* Email — visible uniquement si renseigné */}
                {clientEmail && (
                  <ProfileInfoRow
                    icon="mail-outline"
                    label="Email"
                    value={clientEmail}
                    color="#2196F3"
                    themeColors={themeColors}
                  />
                )}
              </View>

              {/* Actions client */}
              {canContact && (
                <View style={styles.clientActions}>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={goToChat}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble-outline" size={19} color={colors.primary} />
                    <Text style={[styles.secondaryActionText, { color: colors.primary }]}>
                      Message direct
                    </Text>
                  </TouchableOpacity>

                  {!!clientPhone && (
                    <TouchableOpacity
                      style={styles.secondaryAction}
                      onPress={() => callClient(clientPhone)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call-outline" size={19} color={colors.primary} />
                      <Text style={[styles.secondaryActionText, { color: colors.primary }]}>
                        Appeler
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </FadeSlideIn>
        )}

        {/* ==================================================
            TIMELINE
        ================================================== */}

        <FadeSlideIn delay={240}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border || '#E5E5E5',
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Suivi</Text>

            {timeline.map((step, index) => {
              const active = currentTimelineIndex >= index;
              const last = index === timeline.length - 1;

              return (
                <View key={step.key} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.timelineCircle,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : themeColors.border || '#DDD',
                        },
                      ]}
                    >
                      <Ionicons
                        name={step.icon}
                        size={15}
                        color={active ? '#FFFFFF' : themeColors.textSecondary}
                      />
                    </View>

                    {!last && (
                      <View
                        style={[
                          styles.timelineLine,
                          {
                            backgroundColor:
                              currentTimelineIndex > index
                                ? colors.primary
                                : themeColors.border || '#DDD',
                          },
                        ]}
                      />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.timelineText,
                      { color: active ? themeColors.text : themeColors.textSecondary },
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </FadeSlideIn>

        {/* ==================================================
            ACTIONS
        ================================================== */}

        <FadeSlideIn delay={320}>
          <View style={styles.actionsContainer}>
            {/* Navigation GPS — action toujours disponible.
                (Le bouton "Ouvrir Google Maps" a été retiré :
                une seule action de navigation suffit.) */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openNavigation}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Voir l'adresse et naviguer</Text>
            </TouchableOpacity>

            {canNegotiate && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={goToNegotiation}
                activeOpacity={0.85}
              >
                <Ionicons name="swap-horizontal-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Continuer la négociation</Text>
              </TouchableOpacity>
            )}

            {canTrack && (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={goToTracking}
                  activeOpacity={0.85}
                >
                  <Ionicons name="locate-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Suivi en direct</Text>
                </TouchableOpacity>

                <View style={styles.sosContainer}>
                  {/* ⚠️ Le composant partagé <SOSButton /> navigue en
                      interne vers une route "SOS" qui, selon le
                      contexte de navigation, pouvait pointer vers
                      l'écran SOS du parcours CLIENT. On utilise donc
                      ici une navigation explicite et isolée vers
                      "TherapistSOS" (voir goToSOS), tout en gardant
                      le même rendu visuel que les autres actions. */}
                  <TouchableOpacity
                    style={styles.sosButton}
                    onPress={goToSOS}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="alert-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.sosButtonText}>SOS Urgence</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {(currentStatus === 'cancelled' ||
              currentStatus === 'cancelled_by_client' ||
              currentStatus === 'cancelled_by_therapist') && (
              <View
                style={[
                  styles.cancelledInfo,
                  { backgroundColor: '#D32F2F10', borderColor: '#D32F2F30' },
                ]}
              >
                <Ionicons name="information-circle-outline" size={21} color="#D32F2F" />
                <Text style={[styles.cancelledInfoText, { color: themeColors.text }]}>
                  {statusInfo.description}
                </Text>
              </View>
            )}
          </View>
        </FadeSlideIn>

        {/* BOOKING ID */}
        <View style={styles.bookingIdContainer}>
          <Text style={[styles.bookingIdText, { color: themeColors.textSecondary }]}>
            Réservation #{currentBookingId}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  loadingText: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },

  errorIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    textAlign: 'center',
  },

  errorText: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  statusCard: {
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  statusIconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  statusContent: { flex: 1 },

  statusSmall: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 1,
    marginBottom: 3,
  },

  statusTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },

  statusDescription: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: typography.fontSize.xs,
    lineHeight: 17,
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.md,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  infoContent: { flex: 1, minWidth: 0 },

  infoLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: 2,
  },

  infoValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    lineHeight: 20,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: 1,
  },

  priceLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  priceLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },

  priceValue: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },

  subPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingLeft: 30,
  },

  subPriceLabel: { fontSize: typography.fontSize.xs },

  subPriceValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },

  finalPriceValue: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },

  offerBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: spacing.sm,
    backgroundColor: '#F3E8FF',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },

  offerText: { color: '#6B21A8', fontSize: 13, fontWeight: '700', flex: 1 },

  // ==========================================================
  // CLIENT CARD
  // ==========================================================

  clientCard: { paddingTop: spacing.md },

  clientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  clientTitleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },

  clientTitleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  clientSectionTitle: { marginBottom: 2 },

  clientHeaderSubtitle: {
    fontSize: typography.fontSize.xs,
    lineHeight: 17,
  },

  clientDivider: {
    height: 1,
    width: '100%',
    marginVertical: spacing.md,
  },

  clientProfileRow: { flexDirection: 'row', alignItems: 'center' },

  clientMainDetails: { flex: 1, marginLeft: spacing.md, minWidth: 0 },

  clientName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    lineHeight: 25,
  },

  clientRole: { fontSize: typography.fontSize.xs, marginTop: 3 },

  profileInfoGrid: { marginTop: spacing.lg, gap: spacing.sm },

  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },

  profileInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  profileInfoContent: { flex: 1, minWidth: 0 },

  profileInfoLabel: { fontSize: 11, marginBottom: 2 },

  profileInfoValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    lineHeight: 19,
  },

  clientActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  secondaryAction: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },

  secondaryActionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },

  // ==========================================================
  // TIMELINE
  // ==========================================================

  timelineRow: { flexDirection: 'row', minHeight: 58 },

  timelineLeft: { width: 38, alignItems: 'center' },

  timelineCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timelineLine: { width: 2, flex: 1, marginVertical: 2 },

  timelineText: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingTop: 6,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },

  // ==========================================================
  // ACTIONS
  // ==========================================================

  actionsContainer: { gap: spacing.sm },

  primaryButton: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
  },

  sosContainer: { alignItems: 'center', marginTop: spacing.xs },

  sosButton: {
    minHeight: 50,
    width: '100%',
    borderRadius: 13,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
  },

  sosButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 0.5,
  },

  cancelledInfo: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  cancelledInfoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 19,
  },

  bookingIdContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },

  bookingIdText: { fontSize: typography.fontSize.xs },
});

export default BookingDetailScreen;