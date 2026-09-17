// ============================================================
// src/screens/therapist/BookingDetailScreen.js
//
// VERSION THÉRAPEUTE - DETAIL RESERVATION
//
// Fonctionnalités :
// 1. Card Statut avec dégradé.
// 2. Card Informations.
// 3. Card Client avec photo/avatar.
// 4. Menu trois points verticaux uniquement.
// 5. Card Suivi avec timeline.
// 6. Actions navigation, négociation, suivi, SOS et message.
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
  Modal,
  Pressable,
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

import bookingService from '../../services/bookingService';
import offerService from '../../services/offerService';

// ============================================================
// CONSTANTES
// ============================================================

const PRIMARY_COLOR = colors.primary || '#168A55';

const NEGOTIABLE_STATUSES = [
  'pending',
  'negotiating',
];

const TRACKABLE_STATUSES = [
  'confirmed',
  'in_progress',
];

const CONTACTABLE_STATUSES = [
  'confirmed',
  'in_progress',
  'completed',
];

// ============================================================
// NORMALISATION DU STATUT
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

  if (
    value === 'accepted' ||
    value === 'accept'
  ) {
    return 'confirmed';
  }

  if (
    value === 'started' ||
    value === 'in_progress' ||
    value === 'in-progress'
  ) {
    return 'in_progress';
  }

  if (
    value === 'done' ||
    value === 'finished'
  ) {
    return 'completed';
  }

  return value;
};

// ============================================================
// INFORMATIONS DU STATUT
// ============================================================

const getStatusInfo = (status) => {
  const normalized = normalizeStatus(status);

  const statusMap = {
    pending: {
      label: 'En attente',
      description:
        'Une demande de réservation est en attente. Vous pouvez faire une offre ou négocier le prix.',
      color: '#F59E0B',
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
      description:
        'La réservation est confirmée avec le client.',
      color: '#16A34A',
      icon: 'checkmark-circle-outline',
    },

    in_progress: {
      label: 'En cours',
      description:
        'Le massage est actuellement en cours chez le client.',
      color: '#F97316',
      icon: 'play-circle-outline',
    },

    completed: {
      label: 'Terminée',
      description:
        'Cette prestation est terminée.',
      color: '#2E7D32',
      icon: 'checkmark-done-outline',
    },

    cancelled: {
      label: 'Annulée',
      description:
        'Cette réservation a été annulée.',
      color: '#D32F2F',
      icon: 'close-circle-outline',
    },

    cancelled_by_client: {
      label: 'Annulée par le client',
      description:
        'Le client a annulé cette réservation.',
      color: '#D32F2F',
      icon: 'close-circle-outline',
    },

    cancelled_by_therapist: {
      label: 'Annulée par vous',
      description:
        'Vous avez annulé cette réservation.',
      color: '#D32F2F',
      icon: 'close-circle-outline',
    },

    expired: {
      label: 'Expirée',
      description:
        'Cette demande a expiré.',
      color: '#6B7280',
      icon: 'alert-circle-outline',
    },
  };

  return statusMap[normalized] || statusMap.pending;
};

// ============================================================
// FORMATAGE DU PRIX
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
// PARSING DES DATES
// ============================================================

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return null;
  }

  const parsed = new Date(stringValue);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

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

const formatTime = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const stringValue = String(value).trim();

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
// TEXTE SÉCURISÉ
// ============================================================

const safeText = (
  value,
  fallback = 'Non renseigné'
) => {
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
// NOTE / AVIS
// ============================================================

const ratingText = (value) => {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return null;
  }

  const rounded = Math.min(
    5,
    Math.max(0, Math.round(number))
  );

  const stars =
    '★★★★★'.slice(0, rounded) +
    '☆☆☆☆☆'.slice(0, 5 - rounded);

  return `${stars} (${number.toFixed(1)}/5)`;
};

// ============================================================
// ANIMATION D'APPARITION
// ============================================================

const FadeSlideIn = ({
  children,
  delay = 0,
}) => {
  const opacity = useRef(
    new Animated.Value(0)
  ).current;

  const translateY = useRef(
    new Animated.Value(18)
  ).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),

      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
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
// BOUTON ANIMÉ
// ============================================================

const AnimatedActionButton = ({
  children,
  onPress,
  style,
  disabled = false,
}) => {
  const scale = useRef(
    new Animated.Value(1)
  ).current;

  const animateIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const animateOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale }],
        },
        style,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={disabled}
        onPress={onPress}
        onPressIn={animateIn}
        onPressOut={animateOut}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================
// PHOTO / AVATAR CLIENT
// ============================================================

const ClientAvatar = ({
  photoUrl,
  name,
  size = 86,
}) => {
  const [imageFailed, setImageFailed] =
    useState(false);

  const validPhoto =
    typeof photoUrl === 'string' &&
    photoUrl.trim().length > 0;

  const showImage =
    validPhoto && !imageFailed;

  const radius = Math.round(size * 0.22);

  const initial =
    String(name || 'C')
      .trim()
      .charAt(0)
      .toUpperCase() || 'C';

  return (
    <View
      style={[
        avatarStyles.wrapper,
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
          resizeMode="cover"
          onError={() => setImageFailed(true)}
          accessibilityLabel={`Photo de profil de ${
            name || 'client'
          }`}
          style={[
            avatarStyles.image,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
          ]}
        />
      ) : (
        <View
          style={[
            avatarStyles.fallback,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
          ]}
        >
          <Ionicons
            name="person-outline"
            size={size * 0.42}
            color={PRIMARY_COLOR}
          />

          <Text
            style={[
              avatarStyles.initial,
              { fontSize: size * 0.18 },
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  image: {
    backgroundColor: '#E8F5EE',
    borderWidth: 2,
    borderColor: '#FFFFFF',

    ...Platform.select({
      web: {
        boxShadow:
          '0 4px 12px rgba(0,0,0,0.15)',
      },
      default: {
        elevation: 4,
      },
    }),
  },

  fallback: {
    backgroundColor: '#E8F5EE',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',

    ...Platform.select({
      web: {
        boxShadow:
          '0 4px 12px rgba(0,0,0,0.12)',
      },
      default: {
        elevation: 4,
      },
    }),
  },

  initial: {
    color: PRIMARY_COLOR,
    fontWeight: '900',
    marginTop: 2,
  },
});

// ============================================================
// LIGNE INFORMATION PROFIL
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
          {
            backgroundColor: `${color}15`,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={17}
          color={color}
        />
      </View>

      <View style={styles.profileInfoContent}>
        <Text
          style={[
            styles.profileInfoLabel,
            {
              color: themeColors.textSecondary,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          numberOfLines={numberOfLines}
          style={[
            styles.profileInfoValue,
            {
              color: themeColors.text,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
};

// ============================================================
// SCREEN PRINCIPAL
// ============================================================

const BookingDetailScreen = ({
  route,
  navigation,
}) => {
  const { colors: themeColors } = useTheme();

  const initialBooking =
    route?.params?.booking || null;

  const bookingId =
    route?.params?.bookingId ??
    route?.params?.id ??
    initialBooking?.id ??
    initialBooking?.booking_id ??
    null;

  const [booking, setBooking] =
    useState(initialBooking);

  const [isLoading, setIsLoading] =
    useState(!initialBooking);

  const [loadError, setLoadError] =
    useState('');

  const [activeClientOffer, setActiveClientOffer] =
    useState(null);

  const [loadingOffer, setLoadingOffer] =
    useState(false);

  const [menuVisible, setMenuVisible] =
    useState(false);

  // ==========================================================
  // CHARGEMENT DE LA RÉSERVATION
  // ==========================================================

  const loadBookingDetails = useCallback(
    async () => {
      if (
        bookingId === undefined ||
        bookingId === null ||
        bookingId === ''
      ) {
        setLoadError(
          'Identifiant de réservation manquant.'
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError('');

      try {
        const cleanId = String(bookingId).trim();

        const result =
          await bookingService.getBooking(cleanId);

        if (!result?.success) {
          throw new Error(
            result?.error ||
              'Impossible de charger la réservation.'
          );
        }

        if (!result?.data) {
          throw new Error(
            'La réservation est introuvable.'
          );
        }

        setBooking(result.data);
      } catch (error) {
        console.error(
          'Erreur chargement détail réservation thérapeute :',
          error
        );

        setLoadError(
          error?.message ||
            'Impossible de charger les détails de la réservation.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [bookingId]
  );

  // ==========================================================
  // CHARGEMENT DE L'OFFRE CLIENT
  // ==========================================================

  const loadClientOffer = useCallback(
    async () => {
      if (!bookingId) {
        return;
      }

      setLoadingOffer(true);

      try {
        const result =
          await offerService.getActiveClientOffer(
            bookingId
          );

        setActiveClientOffer(
          result?.success ? result.data : null
        );
      } catch (error) {
        console.warn(
          'Aucune offre client active :',
          error
        );

        setActiveClientOffer(null);
      } finally {
        setLoadingOffer(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    loadBookingDetails();
  }, [loadBookingDetails]);

  useFocusEffect(
    useCallback(() => {
      loadBookingDetails();
      loadClientOffer();
    }, [
      loadBookingDetails,
      loadClientOffer,
    ])
  );

  // ==========================================================
  // DONNÉES DE LA RÉSERVATION
  // ==========================================================

  const currentBookingId =
    booking?.id ??
    booking?.booking_id ??
    bookingId;

  const currentStatus = normalizeStatus(
    booking?.status ??
      booking?.booking_status
  );

  const statusInfo =
    getStatusInfo(currentStatus);

  const massageType =
    booking?.massage_type_name ??
    booking?.massage_type?.name ??
    booking?.massage_type ??
    booking?.massage ??
    'Massage';

  const address =
    booking?.address ??
    booking?.client_location ??
    booking?.clientLocation ??
    booking?.location ??
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

  const actualStartTime =
    booking?.actual_start_time ??
    booking?.actualStartTime ??
    booking?.started_at ??
    booking?.startedAt ??
    null;

  const actualEndTime =
    booking?.actual_end_time ??
    booking?.actualEndTime ??
    booking?.completed_at ??
    booking?.completedAt ??
    null;

  const clientComment =
    booking?.client_comment ??
    booking?.comment ??
    booking?.review_comment ??
    booking?.special_instructions ??
    null;

  const clientRating = ratingText(
    booking?.rating ??
      booking?.client_rating ??
      booking?.review_rating
  );

  // ==========================================================
  // DONNÉES DU CLIENT
  // ==========================================================

  const clientId =
    booking?.client_id ??
    booking?.clientId ??
    booking?.client?.id ??
    null;

  const clientObject =
    booking?.client ??
    booking?.user ??
    booking?.customer ??
    null;

  const clientName =
    booking?.client_name ||
    booking?.client_fullname ||
    booking?.client_full_name ||
    clientObject?.fullname ||
    clientObject?.full_name ||
    clientObject?.name ||
    clientObject?.username ||
    'Client';

  const clientPhone =
    booking?.client_phone ||
    booking?.phone ||
    booking?.client?.phone ||
    clientObject?.phone ||
    clientObject?.telephone ||
    null;

  const clientEmail =
    booking?.client_email ||
    booking?.email ||
    booking?.client?.email ||
    clientObject?.email ||
    null;

  // Plusieurs formats possibles selon le backend.
  const clientPhoto =
    booking?.client_photo ||
    booking?.clientPhoto ||
    booking?.client_profile_image ||
    booking?.client_profile_photo ||
    booking?.client_avatar ||
    booking?.client?.profile_image ||
    booking?.client?.profile_photo ||
    booking?.client?.avatar ||
    booking?.client?.photo ||
    booking?.client?.image ||
    booking?.client?.picture ||
    clientObject?.profile_image ||
    clientObject?.profile_photo ||
    clientObject?.avatar ||
    clientObject?.photo ||
    clientObject?.image ||
    null;

  const hasClientInfo =
    Boolean(clientId) ||
    Boolean(clientName);

  // ==========================================================
  // PRIX
  // ==========================================================

  const clientPrice =
    booking?.client_price_proposed ??
    booking?.price ??
    booking?.proposed_price ??
    0;

  const therapistPrice =
    booking?.therapist_price ??
    booking?.therapist_initial_price ??
    null;

  const finalPrice =
    booking?.final_price ?? null;

  const displayPrice =
    finalPrice !== null &&
    finalPrice !== undefined
      ? finalPrice
      : clientPrice;

  // ==========================================================
  // TIMELINE
  // ==========================================================

  const timeline = [
    {
      key: 'pending',
      label: 'Demande reçue',
      icon: 'paper-plane-outline',
    },
    {
      key: 'negotiating',
      label: 'Négociation',
      icon: 'chatbubble-ellipses-outline',
    },
    {
      key: 'confirmed',
      label: 'Réservation confirmée',
      icon: 'checkmark-circle-outline',
    },
    {
      key: 'in_progress',
      label: 'Massage en cours',
      icon: 'play-circle-outline',
    },
    {
      key: 'completed',
      label: 'Massage terminé',
      icon: 'checkmark-done-outline',
    },
  ];

  const getTimelineIndex = () => {
    if (currentStatus === 'pending') {
      return 0;
    }

    if (currentStatus === 'negotiating') {
      return 1;
    }

    if (currentStatus === 'confirmed') {
      return 2;
    }

    if (currentStatus === 'in_progress') {
      return 3;
    }

    if (currentStatus === 'completed') {
      return 4;
    }

    return -1;
  };

  const currentTimelineIndex =
    getTimelineIndex();

  const canNegotiate =
    NEGOTIABLE_STATUSES.includes(
      currentStatus
    );

  const canTrack =
    TRACKABLE_STATUSES.includes(
      currentStatus
    );

  const canContact =
    CONTACTABLE_STATUSES.includes(
      currentStatus
    );

  // ==========================================================
  // ACTIONS
  // ==========================================================

  const openNavigation = () => {
    const latitude =
      booking?.client_latitude ??
      booking?.clientLatitude ??
      booking?.latitude ??
      booking?.client?.latitude ??
      null;

    const longitude =
      booking?.client_longitude ??
      booking?.clientLongitude ??
      booking?.longitude ??
      booking?.client?.longitude ??
      null;

    if (
      latitude === null ||
      latitude === undefined ||
      longitude === null ||
      longitude === undefined
    ) {
      Alert.alert(
        'Position indisponible',
        'Les coordonnées GPS du client ne sont pas disponibles.'
      );
      return;
    }

    // ✅ FIX : "Navigation" dia écran root ankehitriny (tsy ao
    // anaty stack "Demandes" intsony), ka navigate() mivantana
    // toy izao dia "bubble up" hatrany amin'ny root stack, ka:
    //  - tsy mamadika ny tab actif (mijanona amin'ny "Calendrier"),
    //  - ny "retour" dia miverina eto amin'ity BookingDetail ity.
    navigation.navigate('Navigation', {
      bookingId: currentBookingId,
      clientAddress: address,
      clientLatitude: Number(latitude),
      clientLongitude: Number(longitude),
    });
  };

  const goToNegotiation = () => {
    navigation.navigate('Demandes', {
      screen: 'Negotiation',
      params: {
        bookingId: currentBookingId,
        booking,
        currentPrice:
          booking?.final_price ??
          booking?.price ??
          booking?.client_price_proposed ??
          0,
        clientName,
      },
    });
  };

  const goToTracking = () => {
    // ✅ FIX : idem, "Tracking" dia écran root ankehitriny.
    navigation.navigate('Tracking', {
      bookingId: currentBookingId,
    });
  };

  const goToChat = () => {
    // ✅ FIX : "TherapistChat" dia écran root ankehitriny.
    navigation.navigate('TherapistChat', {
      bookingId: currentBookingId,
      clientId,
      clientName,
    });
  };

  const goToSOS = () => {
    // ✅ FIX : "TherapistSOS" dia écran root ankehitriny.
    navigation.navigate('TherapistSOS', {
      bookingId: currentBookingId,
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
      await Linking.openURL(
        `tel:${phoneNumber}`
      );
    } catch (error) {
      console.error(
        'Erreur appel client :',
        error
      );

      Alert.alert(
        'Erreur',
        "Impossible d'ouvrir l'application téléphone."
      );
    }
  };

  const openClientProfile = () => {
    setMenuVisible(false);

    navigation.navigate('ProfilClient', {
      clientId,
      client: clientObject,
      bookingId: currentBookingId,
    });
  };

  // ==========================================================
  // CHARGEMENT
  // ==========================================================

  if (isLoading && !booking) {
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
          title="Détails"
          showBack
        />

        <View style={styles.centerState}>
          <ActivityIndicator
            size="large"
            color={PRIMARY_COLOR}
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
            Chargement de la réservation...
          </Text>
        </View>
      </View>
    );
  }

  // ==========================================================
  // ERREUR
  // ==========================================================

  if (loadError || !booking) {
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
          title="Détails"
          showBack
        />

        <View style={styles.centerState}>
          <View
            style={[
              styles.errorIcon,
              {
                backgroundColor:
                  `${PRIMARY_COLOR}15`,
              },
            ]}
          >
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={PRIMARY_COLOR}
            />
          </View>

          <Text
            style={[
              styles.errorTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            Impossible de charger
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
            {loadError ||
              'Réservation introuvable.'}
          </Text>

          <AnimatedActionButton
            onPress={loadBookingDetails}
            style={styles.retryButton}
          >
            <View style={styles.retryButtonContent}>
              <Ionicons
                name="refresh"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={styles.retryButtonText}
              >
                Réessayer
              </Text>
            </View>
          </AnimatedActionButton>
        </View>
      </View>
    );
  }

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
        title="Détails de la réservation"
        showBack
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* ==================================================
            STATUT
        ================================================== */}

        <FadeSlideIn>
          <LinearGradient
            colors={[
              statusInfo.color,
              `${statusInfo.color}CC`,
            ]}
            style={styles.statusCard}
          >
            <View style={styles.statusIconContainer}>
              <Ionicons
                name={statusInfo.icon}
                size={30}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.statusContent}>
              <Text style={styles.statusSmall}>
                STATUT
              </Text>

              <Text style={styles.statusTitle}>
                {statusInfo.label}
              </Text>

              <Text
                style={styles.statusDescription}
              >
                {statusInfo.description}
              </Text>
            </View>
          </LinearGradient>
        </FadeSlideIn>

        {/* ==================================================
            INFORMATIONS
        ================================================== */}

        <FadeSlideIn delay={80}>
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  themeColors.surface,
                borderColor:
                  themeColors.border ||
                  '#E5E5E5',
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: themeColors.text,
                },
              ]}
            >
              Informations
            </Text>

            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor:
                      `${PRIMARY_COLOR}15`,
                  },
                ]}
              >
                <Ionicons
                  name="flower-outline"
                  size={20}
                  color={PRIMARY_COLOR}
                />
              </View>

              <View style={styles.infoContent}>
                <Text
                  style={[
                    styles.infoLabel,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Type de massage
                </Text>

                <Text
                  style={[
                    styles.infoValue,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {massageType}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor: '#2196F315',
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#2196F3"
                />
              </View>

              <View style={styles.infoContent}>
                <Text
                  style={[
                    styles.infoLabel,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Date prévue
                </Text>

                <Text
                  style={[
                    styles.infoValue,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {formatDate(scheduledDate)}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor: '#9C27B015',
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color="#9C27B0"
                />
              </View>

              <View style={styles.infoContent}>
                <Text
                  style={[
                    styles.infoLabel,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Heure prévue
                </Text>

                <Text
                  style={[
                    styles.infoValue,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {formatTime(scheduledTime)}
                </Text>
              </View>
            </View>

            {formatDateTime(actualStartTime) && (
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    {
                      backgroundColor: '#FF980015',
                    },
                  ]}
                >
                  <Ionicons
                    name="play-circle-outline"
                    size={20}
                    color="#FF9800"
                  />
                </View>

                <View style={styles.infoContent}>
                  <Text
                    style={[
                      styles.infoLabel,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Massage démarré à
                  </Text>

                  <Text
                    style={[
                      styles.infoValue,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {formatDateTime(
                      actualStartTime
                    )}
                  </Text>
                </View>
              </View>
            )}

            {formatDateTime(actualEndTime) && (
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    {
                      backgroundColor: '#2E7D3215',
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-done-outline"
                    size={20}
                    color="#2E7D32"
                  />
                </View>

                <View style={styles.infoContent}>
                  <Text
                    style={[
                      styles.infoLabel,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Massage terminé à
                  </Text>

                  <Text
                    style={[
                      styles.infoValue,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {formatDateTime(
                      actualEndTime
                    )}
                  </Text>
                </View>
              </View>
            )}

            {clientComment && (
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    {
                      backgroundColor: '#0EA5E915',
                    },
                  ]}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color="#0EA5E9"
                  />
                </View>

                <View style={styles.infoContent}>
                  <Text
                    style={[
                      styles.infoLabel,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Commentaire du client
                  </Text>

                  <Text
                    style={[
                      styles.infoValue,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {clientComment}
                  </Text>
                </View>
              </View>
            )}

            {clientRating && (
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    {
                      backgroundColor: '#F59E0B15',
                    },
                  ]}
                >
                  <Ionicons
                    name="star-outline"
                    size={20}
                    color="#F59E0B"
                  />
                </View>

                <View style={styles.infoContent}>
                  <Text
                    style={[
                      styles.infoLabel,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Avis du client
                  </Text>

                  <Text
                    style={[
                      styles.infoValue,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {clientRating}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor: '#4CAF5015',
                  },
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color="#4CAF50"
                />
              </View>

              <View style={styles.infoContent}>
                <Text
                  style={[
                    styles.infoLabel,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Adresse
                </Text>

                <Text
                  style={[
                    styles.infoValue,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {address}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.priceRow,
                {
                  borderTopColor:
                    themeColors.border ||
                    '#E5E5E5',
                },
              ]}
            >
              <View style={styles.priceLeft}>
                <Ionicons
                  name="cash-outline"
                  size={22}
                  color={PRIMARY_COLOR}
                />

                <Text
                  style={[
                    styles.priceLabel,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  Prix
                </Text>
              </View>

              <Text
                style={[
                  styles.priceValue,
                  {
                    color: PRIMARY_COLOR,
                  },
                ]}
              >
                {formatPrice(displayPrice)}
              </Text>
            </View>

            {therapistPrice !== null &&
              therapistPrice !== undefined && (
                <View style={styles.subPriceRow}>
                  <Text
                    style={[
                      styles.subPriceLabel,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Votre offre initiale
                  </Text>

                  <Text
                    style={[
                      styles.subPriceValue,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {formatPrice(therapistPrice)}
                  </Text>
                </View>
              )}

            {finalPrice !== null &&
              finalPrice !== undefined && (
                <View style={styles.subPriceRow}>
                  <Text
                    style={[
                      styles.subPriceLabel,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Prix final
                  </Text>

                  <Text
                    style={[
                      styles.finalPriceValue,
                      {
                        color: '#2E7D32',
                      },
                    ]}
                  >
                    {formatPrice(finalPrice)}
                  </Text>
                </View>
              )}

            {!loadingOffer &&
              activeClientOffer && (
                <View style={styles.offerBox}>
                  <Ionicons
                    name="pricetag-outline"
                    size={18}
                    color="#7C3AED"
                  />

                  <Text style={styles.offerText}>
                    Offre client active :{' '}
                    {formatPrice(
                      activeClientOffer.price_offered ??
                        activeClientOffer.price ??
                        activeClientOffer.amount
                    )}
                  </Text>
                </View>
              )}
          </View>
        </FadeSlideIn>

        {/* ==================================================
            CARD CLIENT
        ================================================== */}

        {hasClientInfo && (
          <FadeSlideIn delay={160}>
            <View
              style={[
                styles.card,
                styles.clientCard,
                {
                  backgroundColor:
                    themeColors.surface,
                  borderColor:
                    themeColors.border ||
                    '#E5E5E5',
                },
              ]}
            >
              <View style={styles.clientHeaderRow}>
                <View style={styles.clientTitleLeft}>
                  <View
                    style={[
                      styles.clientTitleIcon,
                      {
                        backgroundColor:
                          `${PRIMARY_COLOR}15`,
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-circle-outline"
                      size={22}
                      color={PRIMARY_COLOR}
                    />
                  </View>

                  <View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        styles.clientSectionTitle,
                        {
                          color: themeColors.text,
                        },
                      ]}
                    >
                      Client
                    </Text>

                    <Text
                      style={[
                        styles.clientHeaderSubtitle,
                        {
                          color:
                            themeColors.textSecondary,
                        },
                      ]}
                    >
                      Informations de cette réservation
                    </Text>
                  </View>
                </View>

                {/* MENU UNIQUEMENT TROIS POINTS VERTICAUX */}
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() =>
                    setMenuVisible(true)
                  }
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Actions du client"
                >
                  <Ionicons
                    name="ellipsis-vertical"
                    size={23}
                    color={themeColors.text}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.clientDivider,
                  {
                    backgroundColor:
                      themeColors.border ||
                      '#E5E5E5',
                  },
                ]}
              />

              <View style={styles.clientProfileRow}>
                <ClientAvatar
                  photoUrl={clientPhoto}
                  name={clientName}
                  size={86}
                />

                <View style={styles.clientMainDetails}>
                  <Text
                    style={[
                      styles.clientName,
                      {
                        color: themeColors.text,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {safeText(clientName, 'Client')}
                  </Text>

                  <Text
                    style={[
                      styles.clientRole,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Client de la réservation
                  </Text>
                </View>
              </View>

              <View style={styles.profileInfoGrid}>
                <ProfileInfoRow
                  icon="person-outline"
                  label="Nom et prénom"
                  value={safeText(
                    clientName,
                    'Non renseigné'
                  )}
                  color={PRIMARY_COLOR}
                  themeColors={themeColors}
                />

                <ProfileInfoRow
                  icon="call-outline"
                  label="Numéro de téléphone"
                  value={safeText(
                    clientPhone,
                    'Numéro non renseigné'
                  )}
                  color="#4CAF50"
                  themeColors={themeColors}
                />

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

              {canContact && (
                <View style={styles.clientActions}>
                  <AnimatedActionButton
                    onPress={goToChat}
                    style={styles.secondaryActionWrapper}
                  >
                    <View
                      style={[
                        styles.secondaryAction,
                        {
                          borderColor: PRIMARY_COLOR,
                        },
                      ]}
                    >
                      <Ionicons
                        name="chatbubble-outline"
                        size={19}
                        color={PRIMARY_COLOR}
                      />

                      <Text
                        style={[
                          styles.secondaryActionText,
                          {
                            color: PRIMARY_COLOR,
                          },
                        ]}
                      >
                        Message direct
                      </Text>
                    </View>
                  </AnimatedActionButton>

                  {!!clientPhone && (
                    <AnimatedActionButton
                      onPress={() =>
                        callClient(clientPhone)
                      }
                      style={styles.secondaryActionWrapper}
                    >
                      <View
                        style={[
                          styles.secondaryAction,
                          {
                            borderColor: PRIMARY_COLOR,
                          },
                        ]}
                      >
                        <Ionicons
                          name="call-outline"
                          size={19}
                          color={PRIMARY_COLOR}
                        />

                        <Text
                          style={[
                            styles.secondaryActionText,
                            {
                              color: PRIMARY_COLOR,
                            },
                          ]}
                        >
                          Appeler
                        </Text>
                      </View>
                    </AnimatedActionButton>
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
                backgroundColor:
                  themeColors.surface,
                borderColor:
                  themeColors.border ||
                  '#E5E5E5',
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: themeColors.text,
                },
              ]}
            >
              Suivi
            </Text>

            {timeline.map((step, index) => {
              const active =
                currentTimelineIndex >= index;

              const last =
                index === timeline.length - 1;

              return (
                <View
                  key={step.key}
                  style={styles.timelineRow}
                >
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.timelineCircle,
                        {
                          backgroundColor: active
                            ? PRIMARY_COLOR
                            : themeColors.border ||
                              '#D1D5DB',
                        },
                      ]}
                    >
                      <Ionicons
                        name={step.icon}
                        size={15}
                        color={
                          active
                            ? '#FFFFFF'
                            : themeColors.textSecondary
                        }
                      />
                    </View>

                    {!last && (
                      <View
                        style={[
                          styles.timelineLine,
                          {
                            backgroundColor:
                              currentTimelineIndex >
                              index
                                ? PRIMARY_COLOR
                                : themeColors.border ||
                                  '#D1D5DB',
                          },
                        ]}
                      />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.timelineText,
                      {
                        color: active
                          ? themeColors.text
                          : themeColors.textSecondary,
                      },
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
            <AnimatedActionButton
              onPress={openNavigation}
              style={styles.actionWrapper}
            >
              <View style={styles.primaryButton}>
                <Ionicons
                  name="navigate-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.primaryButtonText}
                >
                  Voir l'adresse et naviguer
                </Text>
              </View>
            </AnimatedActionButton>

            {canNegotiate && (
              <AnimatedActionButton
                onPress={goToNegotiation}
                style={styles.actionWrapper}
              >
                <View style={styles.primaryButton}>
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text
                    style={styles.primaryButtonText}
                  >
                    Continuer la négociation
                  </Text>
                </View>
              </AnimatedActionButton>
            )}

            {canTrack && (
              <>
                <AnimatedActionButton
                  onPress={goToTracking}
                  style={styles.actionWrapper}
                >
                  <View style={styles.primaryButton}>
                    <Ionicons
                      name="locate-outline"
                      size={20}
                      color="#FFFFFF"
                    />

                    <Text
                      style={styles.primaryButtonText}
                    >
                      Suivi en direct
                    </Text>
                  </View>
                </AnimatedActionButton>

                <AnimatedActionButton
                  onPress={goToSOS}
                  style={styles.actionWrapper}
                >
                  <View style={styles.sosButton}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={20}
                      color="#FFFFFF"
                    />

                    <Text
                      style={styles.sosButtonText}
                    >
                      SOS Urgence
                    </Text>
                  </View>
                </AnimatedActionButton>
              </>
            )}

            {(currentStatus === 'cancelled' ||
              currentStatus ===
                'cancelled_by_client' ||
              currentStatus ===
                'cancelled_by_therapist') && (
              <View
                style={[
                  styles.cancelledInfo,
                  {
                    backgroundColor: '#D32F2F10',
                    borderColor: '#D32F2F30',
                  },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={21}
                  color="#D32F2F"
                />

                <Text
                  style={[
                    styles.cancelledInfoText,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {statusInfo.description}
                </Text>
              </View>
            )}
          </View>
        </FadeSlideIn>

        <View style={styles.bookingIdContainer}>
          <Text
            style={[
              styles.bookingIdText,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
          >
            Réservation #{currentBookingId}
          </Text>
        </View>
      </ScrollView>

      {/* ======================================================
          MODAL MENU CLIENT
      ====================================================== */}

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMenuVisible(false)
        }
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() =>
            setMenuVisible(false)
          }
        >
          <Pressable
            style={[
              styles.menuCard,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <View style={styles.menuHeader}>
              <Text
                style={[
                  styles.menuTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Actions du client
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setMenuVisible(false)
                }
                style={styles.menuCloseButton}
              >
                <Ionicons
                  name="close"
                  size={21}
                  color={themeColors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.menuDivider,
                {
                  backgroundColor:
                    themeColors.border ||
                    '#E5E5E5',
                },
              ]}
            />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={openClientProfile}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.menuItemIcon,
                  {
                    backgroundColor:
                      `${PRIMARY_COLOR}15`,
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={19}
                  color={PRIMARY_COLOR}
                />
              </View>

              <Text
                style={[
                  styles.menuItemText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Voir le profil du client
              </Text>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: PRIMARY_COLOR,
  },

  retryButtonContent: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
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
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,

    ...Platform.select({
      web: {
        boxShadow:
          '0 3px 12px rgba(0,0,0,0.05)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },

  statusCard: {
    borderRadius: 20,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  statusIconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor:
      'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  statusContent: {
    flex: 1,
    minWidth: 0,
  },

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

  infoContent: {
    flex: 1,
    minWidth: 0,
  },

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

  priceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

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

  subPriceLabel: {
    fontSize: typography.fontSize.xs,
  },

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

  offerText: {
    color: '#6B21A8',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  // ==========================================================
  // CLIENT
  // ==========================================================

  clientCard: {
    paddingTop: spacing.md,
  },

  clientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  clientTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },

  clientTitleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  clientSectionTitle: {
    marginBottom: 2,
  },

  clientHeaderSubtitle: {
    fontSize: typography.fontSize.xs,
    lineHeight: 17,
  },

  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  clientDivider: {
    height: 1,
    width: '100%',
    marginVertical: spacing.md,
  },

  clientProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  clientMainDetails: {
    flex: 1,
    marginLeft: spacing.md,
    minWidth: 0,
  },

  clientName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    lineHeight: 25,
  },

  clientRole: {
    fontSize: typography.fontSize.xs,
    marginTop: 3,
  },

  profileInfoGrid: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },

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

  profileInfoContent: {
    flex: 1,
    minWidth: 0,
  },

  profileInfoLabel: {
    fontSize: 11,
    marginBottom: 2,
  },

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

  secondaryActionWrapper: {
    flexGrow: 1,
    flexBasis: '30%',
  },

  secondaryAction: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.3,
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

  timelineRow: {
    flexDirection: 'row',
    minHeight: 58,
  },

  timelineLeft: {
    width: 38,
    alignItems: 'center',
  },

  timelineCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },

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

  actionsContainer: {
    gap: spacing.sm,
  },

  actionWrapper: {
    width: '100%',
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: PRIMARY_COLOR,
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

  sosButton: {
    minHeight: 52,
    borderRadius: 26,
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
    borderRadius: 14,
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

  bookingIdText: {
    fontSize: typography.fontSize.xs,
  },

  // ==========================================================
  // MODAL MENU
  // ==========================================================

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  menuCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 20,
    padding: spacing.md,

    ...Platform.select({
      web: {
        boxShadow:
          '0 8px 30px rgba(0,0,0,0.20)',
      },
      default: {
        elevation: 8,
      },
    }),
  },

  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  menuTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },

  menuCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuDivider: {
    height: 1,
    marginVertical: spacing.md,
  },

  menuItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  menuItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuItemText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default BookingDetailScreen;