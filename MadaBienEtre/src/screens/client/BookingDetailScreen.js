// ============================================================
// src/screens/client/BookingDetailScreen.js
//
// VERSION CLIENT - DETAIL RESERVATION
//
// Fonctionnalités :
// 1. Affichage du statut de réservation.
// 2. Affichage uniquement des informations principales :
//    - Type de massage
//    - Date prévue
//    - Heure prévue
//    - Adresse
//    - Prix
// 3. Card thérapeute masquée si aucun thérapeute n'est assigné.
// 4. Card thérapeute affichée uniquement si un vrai therapist_id
//    ou un objet thérapeute valide est présent.
// 5. Chargement du profil complet du thérapeute assigné.
// 6. Compatible Android et Web.
// 7. Heure réelle récupérée depuis scheduled_time ou scheduled_date.
// ============================================================

import {
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
  Modal,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';

import {
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

import {
  colors,
  spacing,
  typography,
} from '../../theme';

import Header from '../../components/common/Header';
import SOSButton from '../../components/sos/SOSButton';

import bookingService from '../../services/bookingService';
import therapistService from '../../services/therapistService';

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

  if (
    value === 'confirm' ||
    value === 'confirmed'
  ) {
    return 'confirmed';
  }

  if (
    value === 'in_progress' ||
    value === 'in-progress' ||
    value === 'in progress'
  ) {
    return 'in_progress';
  }

  if (
    value === 'completed' ||
    value === 'complete'
  ) {
    return 'completed';
  }

  if (
    value === 'cancelled' ||
    value === 'canceled'
  ) {
    return 'cancelled';
  }

  if (
    value === 'cancelled_by_client' ||
    value === 'canceled_by_client'
  ) {
    return 'cancelled_by_client';
  }

  if (
    value === 'cancelled_by_therapist' ||
    value === 'canceled_by_therapist'
  ) {
    return 'cancelled_by_therapist';
  }

  return value;
};

// ============================================================
// STATUS INFO
// ============================================================

const getStatusInfo = (status) => {
  const normalized = normalizeStatus(status);

  const map = {
    pending: {
      label: 'En attente',
      description:
        "Votre demande a été envoyée. Nous attendons une offre d'un thérapeute.",
      color: '#FFA726',
      icon: 'time-outline',
    },

    negotiating: {
      label: 'Négociation',
      description:
        'Une offre de thérapeute est disponible. Vous pouvez consulter ou négocier le prix.',
      color: '#2196F3',
      icon: 'chatbubble-ellipses-outline',
    },

    confirmed: {
      label: 'Confirmée',
      description: 'Votre réservation est confirmée.',
      color: '#4CAF50',
      icon: 'checkmark-circle-outline',
    },

    in_progress: {
      label: 'En cours',
      description: 'Le massage est actuellement en cours.',
      color: '#FF9800',
      icon: 'play-circle-outline',
    },

    completed: {
      label: 'Terminée',
      description: 'Cette réservation est terminée.',
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
      label: 'Annulée par vous',
      description: 'Vous avez annulé cette réservation.',
      color: '#D32F2F',
      icon: 'close-circle-outline',
    },

    cancelled_by_therapist: {
      label: 'Annulée par le thérapeute',
      description: 'Le thérapeute a annulé cette réservation.',
      color: '#D32F2F',
      icon: 'close-circle-outline',
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
//
// Gestion des dates ISO et des dates simples.
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
//
// Priorité :
// 1. scheduled_time
// 2. time
// 3. booking_time
// 4. appointment_time
// 5. scheduled_at
// 6. scheduled_date
//
// Si le backend renvoie uniquement HH:mm, on le conserve.
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

  // Cas : "14:30" ou "14:30:00"
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
// FORMAT DATE + HEURE (utilisé pour les dates automatiques :
// therapist_assigned_at, actual_start_time, actual_end_time)
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
// FORMAT DURATION
// ============================================================

const _formatDuration = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return `${value}`;
  }

  if (number >= 60) {
    const hours = Math.floor(number / 60);
    const minutes = number % 60;

    if (minutes === 0) {
      return `${hours} h`;
    }

    return `${hours} h ${minutes} min`;
  }

  return `${number} min`;
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
// GET REAL ASSIGNED THERAPIST ID
//
// Important :
// On ne considère jamais "Thérapeute" comme une assignation.
// ============================================================

const getAssignedTherapistId = (booking) => {
  if (!booking) {
    return null;
  }

  const candidates = [
    booking.therapist_id,
    booking.assigned_therapist_id,
    booking.assignedTherapistId,
    booking.therapist?.id,
    booking.therapist?.therapist_id,
    booking.assigned_therapist?.id,
    booking.assigned_therapist?.therapist_id,
    booking.assignedTherapist?.id,
    booking.assignedTherapist?.therapist_id,
  ];

  const validId = candidates.find(
    (value) =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== '' &&
      String(value).trim() !== '0'
  );

  return validId ?? null;
};

// ============================================================
// GET THERAPIST FULL NAME
// ============================================================

const getTherapistFullName = (
  profile,
  bookingTherapist,
  booking
) => {
  const firstName =
    profile?.first_name ??
    profile?.firstname ??
    profile?.firstName ??
    bookingTherapist?.first_name ??
    bookingTherapist?.firstname ??
    bookingTherapist?.firstName ??
    '';

  const lastName =
    profile?.last_name ??
    profile?.lastname ??
    profile?.lastName ??
    bookingTherapist?.last_name ??
    bookingTherapist?.lastname ??
    bookingTherapist?.lastName ??
    '';

  const composedName =
    `${firstName} ${lastName}`.trim();

  if (composedName) {
    return composedName;
  }

  const possibleName =
    profile?.fullname ??
    profile?.full_name ??
    profile?.fullName ??
    profile?.name ??
    profile?.display_name ??
    bookingTherapist?.fullname ??
    bookingTherapist?.full_name ??
    bookingTherapist?.fullName ??
    bookingTherapist?.name ??
    bookingTherapist?.display_name ??
    booking?.therapist_name ??
    booking?.assigned_therapist_name ??
    '';

  if (
    possibleName &&
    String(possibleName).trim() !== 'Thérapeute'
  ) {
    return String(possibleName).trim();
  }

  return 'Thérapeute assigné';
};

// ============================================================
// ANIMATION
// ============================================================

const FadeSlideIn = ({
  children,
  delay = 0,
}) => {
  const opacity = useRef(
    new Animated.Value(0)
  ).current;

  const translateY = useRef(
    new Animated.Value(15)
  ).current;

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
// THERAPIST AVATAR
//
// Avatar carré avec bords arrondis.
// ============================================================

const TherapistAvatar = ({
  photoUrl,
  name,
  online,
  size = 82,
}) => {
  const [failed, setFailed] = useState(false);

  const showImage =
    Boolean(photoUrl) && !failed;

  const dimension = {
    width: size,
    height: size,
    borderRadius: size * 0.24,
  };

  const initial =
    String(name || 'T')
      .trim()
      .charAt(0)
      .toUpperCase() || 'T';

  return (
    <View style={avatarStyles.wrapper}>
      {showImage ? (
        <Image
          source={{ uri: photoUrl }}
          style={[
            avatarStyles.image,
            dimension,
          ]}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`Photo de profil de ${
            name || 'thérapeute'
          }`}
        />
      ) : (
        <View
          style={[
            avatarStyles.fallback,
            dimension,
          ]}
        >
          <Ionicons
            name="person-outline"
            size={size * 0.38}
            color={colors.primary}
          />

          {name &&
          name !== 'Thérapeute assigné' ? (
            <Text
              style={[
                avatarStyles.fallbackText,
                {
                  fontSize: size * 0.2,
                },
              ]}
            >
              {initial}
            </Text>
          ) : null}
        </View>
      )}

      <View
        style={[
          avatarStyles.onlineDot,
          {
            backgroundColor: online
              ? '#4CAF50'
              : '#9E9E9E',
          },
        ]}
      />
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
      web: {
        boxShadow:
          '0 3px 8px rgba(0,0,0,0.15)',
      },
      default: {
        elevation: 3,
      },
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
      web: {
        boxShadow:
          '0 3px 8px rgba(0,0,0,0.15)',
      },
      default: {
        elevation: 3,
      },
    }),
  },

  fallbackText: {
    color: colors.primary,
    fontWeight: '900',
  },

  onlineDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#FFFFFF',
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
          {
            backgroundColor: `${color}15`,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={16}
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
// SCREEN
// ============================================================

const BookingDetailScreen = ({
  route,
  navigation,
}) => {
  const { colors: themeColors } = useTheme();
  const { token } = useAuth();

  const bookingId =
    route?.params?.bookingId ??
    route?.params?.id;

  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [
    therapistProfile,
    setTherapistProfile,
  ] = useState(null);

  const [
    loadingTherapist,
    setLoadingTherapist,
  ] = useState(false);

  // ==========================================================
  // CERTIFICATE MODAL
  // ==========================================================

  const [
    certificateModalVisible,
    setCertificateModalVisible,
  ] = useState(false);

  const [
    certificateModalUrl,
    setCertificateModalUrl,
  ] = useState('');

  // ==========================================================
  // TOAST (notification centrée, alignée sous le header)
  // ==========================================================

  const [toast, setToast] = useState({
    visible: false,
    type: 'success',
    message: '',
  });

  const toastTimerRef = useRef(null);

  const showToast = useCallback(
    (message, type = 'success') => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      setToast({ visible: true, type, message });

      toastTimerRef.current = setTimeout(() => {
        setToast((previous) => ({
          ...previous,
          visible: false,
        }));
      }, 2800);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // ==========================================================
  // LOAD BOOKING DETAILS
  // ==========================================================

  const loadBookingDetails = useCallback(async () => {
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

    if (!token) {
      setLoadError(
        'Vous devez être connecté.'
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
        '❌ [CLIENT BOOKING DETAIL] Error loading booking:',
        error
      );

      setBooking(null);

      setLoadError(
        error?.message ||
          'Impossible de charger les détails de la réservation.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, token]);

  useEffect(() => {
    loadBookingDetails();
  }, [loadBookingDetails]);

  // ==========================================================
  // REAL ASSIGNED THERAPIST ID
  // ==========================================================

  const assignedTherapistId =
    getAssignedTherapistId(booking);

  // ==========================================================
  // LOAD ASSIGNED THERAPIST FULL PROFILE
  //
  // Le profil n'est chargé que si un vrai ID existe.
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    if (!assignedTherapistId) {
      setTherapistProfile(null);
      setLoadingTherapist(false);
      return undefined;
    }

    const loadTherapistProfile = async () => {
      setLoadingTherapist(true);

      try {
        const result =
          await therapistService.getTherapist(
            assignedTherapistId
          );

        if (cancelled) {
          return;
        }

        if (
          result?.success &&
          result?.data
        ) {
          setTherapistProfile(result.data);
        } else {
          setTherapistProfile(null);

          console.warn(
            '⚠️ [CLIENT BOOKING DETAIL] Profil thérapeute indisponible:',
            result?.error
          );
        }
      } catch (error) {
        if (!cancelled) {
          setTherapistProfile(null);

          console.warn(
            '⚠️ [CLIENT BOOKING DETAIL] Erreur chargement profil thérapeute:',
            error
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingTherapist(false);
        }
      }
    };

    loadTherapistProfile();

    return () => {
      cancelled = true;
    };
  }, [assignedTherapistId]);

  // ==========================================================
  // CANCEL BOOKING
  // ==========================================================

  const cancelBooking = async () => {
    if (!bookingId || isCancelling) {
      return;
    }

    setIsCancelling(true);

    try {
      const result =
        await bookingService.cancelBooking(
          bookingId,
          'Annulé par le client'
        );

      if (!result?.success) {
        throw new Error(
          result?.error ||
            "Impossible d'annuler la réservation."
        );
      }

      if (result?.data) {
        setBooking(result.data);
      } else {
        setBooking((previous) => ({
          ...(previous || {}),
          status: 'cancelled_by_client',
        }));
      }

      showToast('Réservation annulée avec succès.', 'success');
    } catch (error) {
      console.error(
        '❌ [CLIENT BOOKING DETAIL] Cancel:',
        error
      );

      const message =
        error?.message ||
        "Impossible d'annuler la réservation.";

      showToast(message, 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCancel = () => {
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        typeof window.confirm === 'function'
      ) {
        const confirmed =
          window.confirm(
            'Voulez-vous vraiment annuler cette réservation ?'
          );

        if (confirmed) {
          cancelBooking();
        }
      }

      return;
    }

    Alert.alert(
      'Annuler la réservation',
      'Voulez-vous vraiment annuler cette réservation ?',
      [
        {
          text: 'Non',
          style: 'cancel',
        },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: cancelBooking,
        },
      ]
    );
  };

  // ==========================================================
  // CONTACT THERAPIST
  // ==========================================================

  const handleContactTherapist = () => {
    if (
      !booking ||
      !assignedTherapistId
    ) {
      return;
    }

    navigation.navigate('Chat', {
      bookingId:
        booking.id ??
        booking.booking_id ??
        bookingId,

      therapistId: assignedTherapistId,
    });
  };

  // ==========================================================
  // CALL THERAPIST
  // ==========================================================

  const handleCallTherapist = async (
    phoneNumber
  ) => {
    if (!phoneNumber) {
      showToast(
        'Le numéro du thérapeute est indisponible.',
        'error'
      );

      return;
    }

    try {
      await Linking.openURL(
        `tel:${phoneNumber}`
      );
    } catch (error) {
      console.error(
        '❌ [CLIENT BOOKING DETAIL] Appel impossible:',
        error
      );

      showToast(
        "Impossible d'ouvrir l'application téléphone.",
        'error'
      );
    }
  };

  // ==========================================================
  // VOIR LE CERTIFICAT PROFESSIONNEL DU THÉRAPEUTE
  // ==========================================================

  const handleViewCertificate = (
    certificateUrl
  ) => {
    if (!certificateUrl) {
      showToast(
        'Le certificat professionnel de ce thérapeute n’est pas encore disponible.',
        'error'
      );

      return;
    }

    // Affiche le certificat directement dans une modale
    // (aperçu image, ou bouton "Ouvrir" pour les PDF), au lieu
    // de quitter l'application via Linking.openURL.
    setCertificateModalUrl(certificateUrl);
    setCertificateModalVisible(true);
  };

  const closeCertificateModal = useCallback(() => {
    setCertificateModalVisible(false);
  }, []);

  const isCertificateImage = /\.(png|jpe?g|webp|gif|heic|heif)(\?.*)?$/i.test(
    certificateModalUrl || ''
  );

  const handleOpenCertificateExternally = async () => {
    try {
      await Linking.openURL(certificateModalUrl);
    } catch (error) {
      console.error(
        '❌ [CLIENT BOOKING DETAIL] Certificat impossible à ouvrir:',
        error
      );

      showToast(
        "Impossible d'ouvrir le certificat pour le moment.",
        'error'
      );
    }
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (isLoading) {
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
                  `${colors.primary}15`,
              },
            ]}
          >
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={colors.primary}
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

          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadBookingDetails}
            activeOpacity={0.8}
          >
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
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================================
  // BOOKING DATA
  // ==========================================================

  const currentStatus = normalizeStatus(
    booking?.status ??
      booking?.booking_status
  );

  const statusInfo =
    getStatusInfo(currentStatus);

  const currentBookingId =
    booking?.id ??
    booking?.booking_id ??
    bookingId;

  const massageType =
    booking?.massage_type_name ??
    booking?.massageType?.name ??
    booking?.massageType ??
    booking?.massage_type?.name ??
    booking?.service_name ??
    booking?.service?.name ??
    'Massage';

  const _duration =
    booking?.duration_minutes ??
    booking?.scheduled_duration_minutes ??
    booking?.duration ??
    booking?.service_duration ??
    0;

  const address =
    booking?.address ??
    booking?.client_address ??
    booking?.client_location ??
    booking?.location ??
    booking?.destination_address ??
    'Adresse non renseignée';

  const scheduledDate =
    booking?.scheduled_date ??
    booking?.date ??
    booking?.booking_date ??
    booking?.appointment_date;

  const scheduledTime =
    booking?.scheduled_time ??
    booking?.time ??
    booking?.booking_time ??
    booking?.appointment_time ??
    booking?.scheduled_at ??
    booking?.scheduled_date;

  // ==========================================================
  // DATES AUTOMATIQUES DU CYCLE DE VIE (posées côté backend)
  //
  // therapist_assigned_at -> quand l'offre du thérapeute est
  //   acceptée (voir app/api/offers.py::accept_offer).
  // actual_start_time -> quand le thérapeute appuie sur
  //   "Démarrer le massage" (PUT /bookings/start/{id}).
  // actual_end_time -> quand le thérapeute appuie sur
  //   "Terminer le massage" (PUT /bookings/complete/{id}).
  //
  // Ces champs restent null tant que l'événement correspondant
  // ne s'est pas encore produit ; on ne les affiche donc que
  // lorsqu'ils sont renseignés.
  // ==========================================================

  const therapistAssignedAt =
    booking?.therapist_assigned_at ??
    booking?.therapistAssignedAt ??
    null;

  const actualStartTime =
    booking?.actual_start_time ??
    booking?.actualStartTime ??
    null;

  const actualEndTime =
    booking?.actual_end_time ??
    booking?.actualEndTime ??
    null;

  // ==========================================================
  // THERAPIST DATA
  // ==========================================================

  const therapistFromBooking =
    booking?.therapist ||
    booking?.assigned_therapist ||
    booking?.assignedTherapist ||
    {};

  const hasAssignedTherapist =
    Boolean(assignedTherapistId);

  const therapistName =
    getTherapistFullName(
      therapistProfile,
      therapistFromBooking,
      booking
    );

  const therapistEmail =
    therapistProfile?.email ??
    therapistProfile?.mail ??
    therapistFromBooking?.email ??
    therapistFromBooking?.mail ??
    booking?.therapist_email ??
    null;

  const therapistPhone =
    therapistProfile?.phone ??
    therapistProfile?.phone_number ??
    therapistProfile?.telephone ??
    therapistProfile?.mobile ??
    therapistFromBooking?.phone ??
    therapistFromBooking?.phone_number ??
    therapistFromBooking?.telephone ??
    therapistFromBooking?.mobile ??
    booking?.therapist_phone ??
    null;

  const therapistPhoto =
    therapistProfile?.profile_image_url ??
    therapistProfile?.profile_image ??
    therapistProfile?.profileImageUrl ??
    therapistProfile?.profileImage ??
    therapistProfile?.photo_url ??
    therapistProfile?.photoUrl ??
    therapistProfile?.avatar_url ??
    therapistProfile?.avatar ??
    therapistFromBooking?.profile_image_url ??
    therapistFromBooking?.profile_image ??
    therapistFromBooking?.profileImageUrl ??
    therapistFromBooking?.profileImage ??
    therapistFromBooking?.photo_url ??
    therapistFromBooking?.photoUrl ??
    therapistFromBooking?.photo ??
    booking?.therapist_photo ??
    null;

  const therapistOnline = Boolean(
    therapistProfile?.is_online ??
      therapistProfile?.isOnline ??
      therapistProfile?.online ??
      therapistFromBooking?.is_online ??
      therapistFromBooking?.isOnline ??
      therapistFromBooking?.online ??
      false
  );

  const therapistCertificateUrl =
    therapistProfile?.certificate_url ??
    therapistProfile?.certificate_pro_url ??
    therapistProfile?.professional_certificate_url ??
    therapistProfile?.certification_url ??
    therapistProfile?.certificateUrl ??
    therapistFromBooking?.certificate_url ??
    therapistFromBooking?.certificate_pro_url ??
    booking?.therapist_certificate_url ??
    null;

  // ==========================================================
  // PRICES
  // ==========================================================

  const clientPrice =
    booking?.client_price_proposed ??
    booking?.proposed_price ??
    booking?.client_price ??
    booking?.price ??
    0;

  const therapistPrice =
    booking?.therapist_initial_price ??
    booking?.therapist_price ??
    booking?.initial_price;

  const finalPrice =
    booking?.final_price ??
    booking?.finalPrice ??
    booking?.agreed_price;

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
      label: 'Demande envoyée',
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
            STATUS
        ================================================== */}

        <FadeSlideIn>
          <LinearGradient
            colors={[
              statusInfo.color,
              `${statusInfo.color}CC`,
            ]}
            style={styles.statusCard}
          >
            <View
              style={styles.statusIconContainer}
            >
              <Ionicons
                name={statusInfo.icon}
                size={30}
                color="#FFFFFF"
              />
            </View>

            <View
              style={styles.statusContent}
            >
              <Text
                style={styles.statusSmall}
              >
                STATUT
              </Text>

              <Text
                style={styles.statusTitle}
              >
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
            BOOKING INFORMATION
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

            {/* Type de massage */}
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor:
                      `${colors.primary}15`,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="spa-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>

              <View
                style={styles.infoContent}
              >
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

            {/* Date prévue */}
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor:
                      '#2196F315',
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#2196F3"
                />
              </View>

              <View
                style={styles.infoContent}
              >
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

            {/* Heure prévue */}
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor:
                      '#9C27B015',
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color="#9C27B0"
                />
              </View>

              <View
                style={styles.infoContent}
              >
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

            {/* Massage démarré à (automatique, dès que le thérapeute démarre) */}
            {formatDateTime(actualStartTime) && (
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    {
                      backgroundColor:
                        '#FF980015',
                    },
                  ]}
                >
                  <Ionicons
                    name="play-circle-outline"
                    size={20}
                    color="#FF9800"
                  />
                </View>

                <View
                  style={styles.infoContent}
                >
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
                    {formatDateTime(actualStartTime)}
                  </Text>
                </View>
              </View>
            )}

            {/* Massage terminé à (automatique, dès que le thérapeute termine) */}
            {formatDateTime(actualEndTime) && (
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    {
                      backgroundColor:
                        '#2E7D3215',
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-done-outline"
                    size={20}
                    color="#2E7D32"
                  />
                </View>

                <View
                  style={styles.infoContent}
                >
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
                    {formatDateTime(actualEndTime)}
                  </Text>
                </View>
              </View>
            )}

            {/* Adresse */}
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIcon,
                  {
                    backgroundColor:
                      '#4CAF5015',
                  },
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color="#4CAF50"
                />
              </View>

              <View
                style={styles.infoContent}
              >
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

            {/* Prix */}
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
                  color={colors.primary}
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
                    color: colors.primary,
                  },
                ]}
              >
                {formatPrice(displayPrice)}
              </Text>
            </View>

            {therapistPrice !== null &&
              therapistPrice !== undefined && (
                <View
                  style={styles.subPriceRow}
                >
                  <Text
                    style={[
                      styles.subPriceLabel,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Offre initiale du thérapeute
                  </Text>

                  <Text
                    style={[
                      styles.subPriceValue,
                      {
                        color: themeColors.text,
                      },
                    ]}
                  >
                    {formatPrice(
                      therapistPrice
                    )}
                  </Text>
                </View>
              )}

            {finalPrice !== null &&
              finalPrice !== undefined && (
                <View
                  style={styles.subPriceRow}
                >
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
          </View>
        </FadeSlideIn>

        {/* ==================================================
            THERAPEUTE ASSIGNE

            IMPORTANT :
            Ce card n'est rendu que si un vrai ID
            de thérapeute assigné existe.

            Si therapist_id est null :
            aucun card thérapeute ne sera affiché.
        ================================================== */}

        {hasAssignedTherapist && (
          <FadeSlideIn delay={160}>
            <View
              style={[
                styles.card,
                styles.therapistCard,
                {
                  backgroundColor:
                    themeColors.surface,
                  borderColor:
                    themeColors.border ||
                    '#E5E5E5',
                },
              ]}
            >
              {/* Titre */}
              <View
                style={styles.therapistHeaderRow}
              >
                <View
                  style={styles.therapistTitleLeft}
                >
                  <View
                    style={[
                      styles.therapistTitleIcon,
                      {
                        backgroundColor:
                          `${colors.primary}15`,
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-circle-outline"
                      size={22}
                      color={colors.primary}
                    />
                  </View>

                  <View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        styles.therapistSectionTitle,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      Thérapeute assigné
                    </Text>

                    <Text
                      style={[
                        styles.therapistHeaderSubtitle,
                        {
                          color:
                            themeColors.textSecondary,
                        },
                      ]}
                    >
                      Votre thérapeute pour cette réservation
                    </Text>
                  </View>
                </View>

                {loadingTherapist && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                  />
                )}
              </View>

              <View
                style={[
                  styles.therapistDivider,
                  {
                    backgroundColor:
                      themeColors.border ||
                      '#E5E5E5',
                  },
                ]}
              />

              {/* Profil principal */}
              <View
                style={styles.therapistProfileRow}
              >
                <TherapistAvatar
                  photoUrl={therapistPhoto}
                  name={therapistName}
                  online={therapistOnline}
                  size={82}
                />

                <View
                  style={styles.therapistMainDetails}
                >
                  <Text
                    style={[
                      styles.therapistName,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    {safeText(
                      therapistName,
                      'Thérapeute assigné'
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.therapistRole,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Thérapeute professionnel
                  </Text>

                  {/* Date d'assignation automatique du thérapeute
                      (posée par le backend dès que l'offre est
                      acceptée). Le statut en ligne/hors ligne est
                      déjà visible sur le cadre de la photo de
                      profil ci-dessus (petit point vert/gris) —
                      pas besoin de le répéter ici. */}
                  {formatDateTime(therapistAssignedAt) && (
                    <View
                      style={styles.assignedAtRow}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color={
                          themeColors.textSecondary
                        }
                      />

                      <Text
                        style={[
                          styles.assignedAtText,
                          {
                            color:
                              themeColors.textSecondary,
                          },
                        ]}
                      >
                        Assigné le{' '}
                        {formatDateTime(
                          therapistAssignedAt
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Informations du thérapeute */}
              <View
                style={styles.profileInfoGrid}
              >
                <ProfileInfoRow
                  icon="person-outline"
                  label="Nom et prénom"
                  value={safeText(
                    therapistName,
                    'Non renseigné'
                  )}
                  color={colors.primary}
                  themeColors={themeColors}
                />

                <ProfileInfoRow
                  icon="mail-outline"
                  label="Email"
                  value={safeText(
                    therapistEmail,
                    'Email non renseigné'
                  )}
                  color="#2196F3"
                  themeColors={themeColors}
                />

                <ProfileInfoRow
                  icon="call-outline"
                  label="Numéro de téléphone"
                  value={safeText(
                    therapistPhone,
                    'Numéro non renseigné'
                  )}
                  color="#4CAF50"
                  themeColors={themeColors}
                />
              </View>

              {/* Actions thérapeute */}
              {(currentStatus === 'confirmed' ||
                currentStatus === 'in_progress' ||
                currentStatus === 'completed') && (
                <View
                  style={styles.therapistActions}
                >
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={
                      handleContactTherapist
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={19}
                      color={colors.primary}
                    />

                    <Text
                      style={[
                        styles.secondaryActionText,
                        {
                          color:
                            colors.primary,
                        },
                      ]}
                    >
                      Contacter
                    </Text>
                  </TouchableOpacity>

                  {!!therapistPhone && (
                    <TouchableOpacity
                      style={styles.secondaryAction}
                      onPress={() =>
                        handleCallTherapist(
                          therapistPhone
                        )
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="call-outline"
                        size={19}
                        color={colors.primary}
                      />

                      <Text
                        style={[
                          styles.secondaryActionText,
                          {
                            color:
                              colors.primary,
                          },
                        ]}
                      >
                        Appeler
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() =>
                      handleViewCertificate(
                        therapistCertificateUrl
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="certificate-outline"
                      size={19}
                      color={colors.primary}
                    />

                    <Text
                      style={[
                        styles.secondaryActionText,
                        {
                          color:
                            colors.primary,
                        },
                      ]}
                    >
                      Certification
                    </Text>
                  </TouchableOpacity>
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
                  <View
                    style={styles.timelineLeft}
                  >
                    <View
                      style={[
                        styles.timelineCircle,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : themeColors.border ||
                              '#DDD',
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
                                ? colors.primary
                                : themeColors.border ||
                                  '#DDD',
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
          <View
            style={styles.actionsContainer}
          >
            {currentStatus === 'pending' && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() =>
                  navigation.navigate(
                    'Offers',
                    {
                      bookingId:
                        currentBookingId,
                    }
                  )
                }
                activeOpacity={0.85}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.primaryButtonText}
                >
                  Négocier
                </Text>
              </TouchableOpacity>
            )}

            {currentStatus === 'negotiating' && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() =>
                  navigation.navigate(
                    'Offers',
                    {
                      bookingId:
                        currentBookingId,
                    }
                  )
                }
                activeOpacity={0.85}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.primaryButtonText}
                >
                  Voir la négociation
                </Text>
              </TouchableOpacity>
            )}

            {(currentStatus === 'confirmed' ||
              currentStatus === 'in_progress') && (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() =>
                    navigation.navigate(
                      'Tracking',
                      {
                        bookingId:
                          currentBookingId,
                      }
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="navigate-outline"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text
                    style={styles.primaryButtonText}
                  >
                    Suivre le thérapeute
                  </Text>
                </TouchableOpacity>

                <View
                  style={styles.sosContainer}
                >
                  <SOSButton
                    bookingId={
                      currentBookingId
                    }
                  />
                </View>
              </>
            )}

            {currentStatus === 'completed' && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() =>
                  navigation.navigate(
                    'Rating',
                    {
                      bookingId:
                        currentBookingId,
                    }
                  )
                }
                activeOpacity={0.85}
              >
                <Ionicons
                  name="star-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.primaryButtonText}
                >
                  Évaluer le thérapeute
                </Text>
              </TouchableOpacity>
            )}

            {(currentStatus === 'pending' ||
              currentStatus === 'negotiating') && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isCancelling}
                activeOpacity={0.8}
              >
                {isCancelling ? (
                  <ActivityIndicator
                    size="small"
                    color="#D32F2F"
                  />
                ) : (
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color="#D32F2F"
                  />
                )}

                <Text
                  style={styles.cancelButtonText}
                >
                  {isCancelling
                    ? 'Annulation...'
                    : 'Annuler la réservation'}
                </Text>
              </TouchableOpacity>
            )}

            {(currentStatus === 'cancelled' ||
              currentStatus === 'cancelled_by_client' ||
              currentStatus ===
                'cancelled_by_therapist') && (
              <View
                style={[
                  styles.cancelledInfo,
                  {
                    backgroundColor:
                      '#D32F2F10',
                    borderColor:
                      '#D32F2F30',
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
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  {statusInfo.description}
                </Text>
              </View>
            )}
          </View>
        </FadeSlideIn>

        {/* BOOKING ID */}
        <View
          style={styles.bookingIdContainer}
        >
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

      {/* ==================================================
          TOAST — notification centrée, alignée sous le header
      ================================================== */}

      {toast.visible && (
        <View
          pointerEvents="none"
          style={styles.toastOverlay}
        >
          <View
            style={[
              styles.toastCard,
              {
                backgroundColor: themeColors.card,
                borderColor:
                  toast.type === 'error'
                    ? '#D32F2F40'
                    : `${colors.primary}40`,
              },
            ]}
          >
            <Ionicons
              name={
                toast.type === 'error'
                  ? 'alert-circle'
                  : 'checkmark-circle'
              }
              size={18}
              color={
                toast.type === 'error'
                  ? '#D32F2F'
                  : colors.primary
              }
            />

            <Text
              numberOfLines={2}
              style={[
                styles.toastText,
                { color: themeColors.text },
              ]}
            >
              {toast.message}
            </Text>
          </View>
        </View>
      )}

      {/* ==================================================
          CERTIFICAT — modale d'aperçu
      ================================================== */}

      <Modal
        visible={certificateModalVisible}
        transparent
        animationType="fade"
        // Android : sans ça, la modale peut être partiellement
        // masquée par la barre de statut sur certains téléphones.
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={closeCertificateModal}
      >
        <Pressable
          style={styles.certificateBackdrop}
          onPress={closeCertificateModal}
        >
          <Pressable
            style={[
              styles.certificateCard,
              { backgroundColor: themeColors.card },
            ]}
            onPress={() => {}}
          >
            <View style={styles.certificateHeaderRow}>
              <Text
                style={[
                  styles.certificateTitle,
                  { color: themeColors.text },
                ]}
              >
                Certificat professionnel
              </Text>

              <TouchableOpacity
                onPress={closeCertificateModal}
                hitSlop={{
                  top: 8,
                  bottom: 8,
                  left: 8,
                  right: 8,
                }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={themeColors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.certificateBody}
              contentContainerStyle={
                styles.certificateBodyContent
              }
            >
              {isCertificateImage ? (
                <Image
                  source={{ uri: certificateModalUrl }}
                  style={styles.certificateImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.certificateFileBox}>
                  <MaterialCommunityIcons
                    name="file-certificate-outline"
                    size={48}
                    color={colors.primary}
                  />

                  <Text
                    style={[
                      styles.certificateFileText,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    Ce document ne peut pas être prévisualisé
                    directement. Ouvrez-le pour le consulter.
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.certificateOpenButton}
              onPress={handleOpenCertificateExternally}
              activeOpacity={0.85}
            >
              <Ionicons
                name="open-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.certificateOpenButtonText}>
                Ouvrir le document complet
              </Text>
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    backgroundColor:
      'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  statusContent: {
    flex: 1,
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

  // ==========================================================
  // THERAPIST CARD
  // ==========================================================

  therapistCard: {
    paddingTop: spacing.md,
  },

  therapistHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  therapistTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  therapistTitleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  therapistSectionTitle: {
    marginBottom: 2,
  },

  therapistHeaderSubtitle: {
    fontSize: typography.fontSize.xs,
    lineHeight: 17,
  },

  therapistDivider: {
    height: 1,
    width: '100%',
    marginVertical: spacing.md,
  },

  therapistProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  therapistMainDetails: {
    flex: 1,
    marginLeft: spacing.md,
    minWidth: 0,
  },

  therapistName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    lineHeight: 25,
  },

  therapistRole: {
    fontSize: typography.fontSize.xs,
    marginTop: 3,
  },

  assignedAtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
  },

  assignedAtText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
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

  therapistActions: {
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

  cancelButton: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
  },

  cancelButtonText: {
    color: '#D32F2F',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },

  sosContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
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

  bookingIdText: {
    fontSize: typography.fontSize.xs,
  },

  // ==========================================================
  // TOAST — notification centrée, alignée sous le header
  // ==========================================================

  toastOverlay: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 66 : 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },

  toastCard: {
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  toastText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily.medium,
  },

  // ==========================================================
  // CERTIFICAT — modale
  // ==========================================================

  certificateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,20,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  certificateCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: 20,
    padding: 18,
    // S'assure que le contenu de la modale (image, bouton)
    // reste toujours visible en entier, sans être coupé, sur
    // web comme sur Android.
    overflow: 'hidden',
  },

  certificateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  certificateTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
  },

  certificateBody: {
    minHeight: 200,
    maxHeight: 420,
  },

  certificateBodyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  certificateImage: {
    width: '100%',
    height: 380,
    borderRadius: 12,
  },

  certificateFileBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 10,
    gap: 12,
  },

  certificateFileText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  certificateOpenButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: colors.primary,
  },

  certificateOpenButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: typography.fontFamily.bold,
  },
});

export default BookingDetailScreen;