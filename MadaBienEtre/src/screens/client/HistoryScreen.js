// src/screens/client/HistoryScreen.js

import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import Header from '../../components/common/Header';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import bookingService from '../../services/bookingService';

import {
  colors,
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

  return {
    ...booking,
    id: bookingId,
    bookingId,
    address,
    scheduledDate,
    scheduledTime,
    status,
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
  index,
  themeColors,
  onPress,
}) => {
  const statusConfig = getStatusConfig(booking.status);

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
      {/* HEADER */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrapper}>
          <View
            style={[
              styles.calendarIcon,
              {
                backgroundColor: `${themeColors.primary}18`,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={themeColors.primary}
            />
          </View>

          <View style={styles.cardTitleTextWrapper}>
            <Text
              style={[
                styles.cardTitle,
                {
                  color: themeColors.text,
                },
              ]}
            >
              Ma réservation
            </Text>

            <Text
              style={[
                styles.cardReference,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              #{booking.bookingId}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusConfig.backgroundColor,
            },
          ]}
        >
          <Ionicons
            name={statusConfig.icon}
            size={12}
            color={statusConfig.color}
          />

          <Text
            numberOfLines={1}
            style={[
              styles.statusBadgeText,
              {
                color: statusConfig.color,
              },
            ]}
          >
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* INFORMATIONS PRINCIPALES */}
      <View
        style={[
          styles.informationPanel,
          {
            backgroundColor: themeColors.background,
            borderColor: themeColors.border,
          },
        ]}
      >
        {/* ADRESSE */}
        <View style={styles.addressRow}>
          <View
            style={[
              styles.addressIcon,
              {
                backgroundColor: '#DBEAFE',
              },
            ]}
          >
            <Ionicons
              name="location"
              size={17}
              color="#2563EB"
            />
          </View>

          <View style={styles.addressContent}>
            <Text
              style={[
                styles.infoLabel,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              Adresse
            </Text>

            <Text
              numberOfLines={2}
              style={[
                styles.addressValue,
                {
                  color: themeColors.text,
                },
              ]}
            >
              {booking.address || 'Adresse non définie'}
            </Text>
          </View>
        </View>

        {/* DATE ET HEURE */}
        <View style={styles.dateTimeRow}>
          <View style={styles.smallInfoBlock}>
            <View
              style={[
                styles.smallInfoIcon,
                {
                  backgroundColor: '#DCFCE7',
                },
              ]}
            >
              <Ionicons
                name="calendar"
                size={15}
                color="#16A34A"
              />
            </View>

            <View style={styles.smallInfoText}>
              <Text
                style={[
                  styles.infoLabel,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                Date prévue
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.smallInfoValue,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {formatDate(booking.scheduledDate)}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.verticalSeparator,
              {
                backgroundColor: themeColors.border,
              },
            ]}
          />

          <View style={styles.smallInfoBlock}>
            <View
              style={[
                styles.smallInfoIcon,
                {
                  backgroundColor: '#F3E8FF',
                },
              ]}
            >
              <Ionicons
                name="time"
                size={15}
                color="#9333EA"
              />
            </View>

            <View style={styles.smallInfoText}>
              <Text
                style={[
                  styles.infoLabel,
                  {
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                Heure prévue
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.smallInfoValue,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {formatTime(booking.scheduledTime)}
              </Text>
            </View>
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
  const { user } = useAuth();
  const { theme } = useTheme();

  const themeColors = useMemo(() => {
    const themeData = theme?.colors || theme || {};

    return {
      background:
        themeData.background ||
        colors.background ||
        '#F8FAFC',

      card:
        themeData.card ||
        colors.card ||
        '#FFFFFF',

      text:
        themeData.text ||
        colors.text ||
        '#111827',

      textSecondary:
        themeData.textSecondary ||
        themeData.secondaryText ||
        colors.textSecondary ||
        '#64748B',

      border:
        themeData.border ||
        colors.border ||
        '#E5E7EB',

      primary:
        themeData.primary ||
        colors.primary ||
        '#2563EB',
    };
  }, [theme]);

  const [bookings, setBookings] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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

  const filteredBookings = useMemo(() => {
    if (activeFilter === 'all') {
      return bookings;
    }

    return bookings.filter((booking) => {
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
  }, [bookings, activeFilter]);

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
    navigation.navigate('Booking');
  }, [navigation]);

  const renderBooking = useCallback(
    ({ item, index }) => {
      return (
        <BookingCard
          booking={item}
          index={index}
          themeColors={themeColors}
          onPress={handleBookingPress}
        />
      );
    },
    [themeColors, handleBookingPress],
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
        showBackButton={false}
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

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  cardTitleWrapper: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },

  calendarIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  cardTitleTextWrapper: {
    flex: 1,
    minWidth: 0,
  },

  cardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: typography.fontFamily.bold,
  },

  cardReference: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: typography.fontFamily.regular,
  },

  statusBadge: {
    maxWidth: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },

  statusBadgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: typography.fontFamily.bold,
  },

  // ==========================================================
  // INFORMATION PANEL
  // ==========================================================

  informationPanel: {
    marginTop: 11,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  addressIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  addressContent: {
    flex: 1,
    minWidth: 0,
  },

  infoLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: typography.fontFamily.medium,
  },

  addressValue: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.bold,
  },

  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  smallInfoBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },

  smallInfoIcon: {
    width: 29,
    height: 29,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },

  smallInfoText: {
    flex: 1,
    minWidth: 0,
  },

  smallInfoValue: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: typography.fontFamily.bold,
  },

  verticalSeparator: {
    width: 1,
    height: 29,
    marginHorizontal: 8,
  },

  // ==========================================================
  // THERAPIST COMPACT
  // ==========================================================

  therapistCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
    borderRadius: 13,
    borderWidth: 1,
  },

  therapistAvatarWrapper: {
    width: 43,
    height: 43,
    borderRadius: 13,
    borderWidth: 2,
    padding: 2,
    position: 'relative',
    marginRight: 9,
  },

  therapistAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },

  therapistAvatarFallback: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  therapistAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
  },

  onlineIndicator: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 13,
    height: 13,
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
});

export default HistoryScreen;