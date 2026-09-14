// ============================================================
// src/screens/client/NegotiationScreen.js
// ============================================================
//
// CLIENT - NEGOTIATION
//
// Version UX/UI améliorée
// - Boutons verts
// - Toast central sous le Header
// - Profil thérapeute carré
// - Nom / téléphone / email
// - Disponibilité En ligne / Hors ligne
// - Modales de confirmation Web + Android
// - API réelle offerService / bookingService
//
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
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

import {
  colors,
} from '../../theme';

import Header from '../../components/common/Header';
import offerService from '../../services/offerService';
import bookingService from '../../services/bookingService';
import therapistService from '../../services/therapistService';

// ============================================================
// CONSTANTS
// ============================================================

const GREEN = '#16A34A';
const GREEN_LIGHT = '#22C55E';
const GREEN_PALE = '#EAF8EF';
const GREEN_BORDER = '#BBE7C9';

const RED = '#DC2626';
const BLUE = '#2563EB';
const ORANGE = '#F59E0B';
const GRAY = '#6B7280';

// ============================================================
// HELPERS
// ============================================================

const normalizeStatus = (status) => {
  const value = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');

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

  if (value === 'pending') {
    return 'pending';
  }

  if (
    value === 'in_progress' ||
    value === 'inprogress'
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

  if (value === 'cancelled_by_client') {
    return 'cancelled_by_client';
  }

  if (value === 'cancelled_by_therapist') {
    return 'cancelled_by_therapist';
  }

  if (value === 'expired') {
    return 'expired';
  }

  return value || 'pending';
};

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

// ============================================================

const getOfferPrice = (offer) => {
  if (!offer) {
    return 0;
  }

  const value =
    offer.price_offered ??
    offer.priceOffered ??
    offer.price ??
    offer.counter_price ??
    offer.counterPrice ??
    0;

  const number = Number(
    String(value)
      .replace(/\s/g, '')
      .replace(',', '.')
  );

  return Number.isFinite(number)
    ? number
    : 0;
};

// ============================================================

const normalizeOfferType = (offer) => {
  if (!offer) {
    return '';
  }

  const value = String(
    offer.user_type ??
      offer.userType ??
      offer.sender_type ??
      offer.senderType ??
      offer.role ??
      offer.type ??
      ''
  )
    .trim()
    .toLowerCase();

  if (
    value === 'client' ||
    value === 'customer' ||
    value === 'customer_user' ||
    value === 'user'
  ) {
    return 'client';
  }

  if (
    value === 'therapist' ||
    value === 'therapeute' ||
    value === 'thérapeute' ||
    value === 'provider' ||
    value === 'professional'
  ) {
    return 'therapist';
  }

  return value;
};

// ============================================================

const getOfferStatus = (offer) => {
  return String(
    offer?.status ??
      offer?.offer_status ??
      ''
  )
    .trim()
    .toLowerCase();
};

// ============================================================

const isOfferClosed = (offer) => {
  const status = getOfferStatus(offer);

  return (
    status === 'accepted' ||
    status === 'rejected' ||
    status === 'cancelled' ||
    status === 'expired'
  );
};

// ============================================================

const isActiveOffer = (offer) => {
  if (!offer) {
    return false;
  }

  const status = getOfferStatus(offer);

  return (
    status === '' ||
    status === 'sent' ||
    status === 'pending' ||
    status === 'active' ||
    status === 'open'
  );
};

// ============================================================

const formatPrice = (price) => {
  const number = Number(
    String(price || 0)
      .replace(/\s/g, '')
      .replace(',', '.')
  );

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return '—';
  }

  return `${Math.round(number).toLocaleString(
    'fr-FR'
  )} Ar`;
};

// ============================================================

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

const getStatusInfo = (status) => {
  switch (normalizeStatus(status)) {
    case 'confirmed':
      return {
        label: 'Confirmée',
        icon: 'checkmark-circle',
        color: GREEN,
        background: GREEN_PALE,
      };

    case 'negotiating':
      return {
        label: 'En négociation',
        icon: 'chatbubbles-outline',
        color: BLUE,
        background: '#EAF2FF',
      };

    case 'pending':
      return {
        label: 'En attente',
        icon: 'time-outline',
        color: ORANGE,
        background: '#FFF5DD',
      };

    case 'in_progress':
      return {
        label: 'En cours',
        icon: 'play-circle-outline',
        color: '#7C3AED',
        background: '#F1EBFF',
      };

    case 'completed':
      return {
        label: 'Terminée',
        icon: 'checkmark-done-circle',
        color: GREEN,
        background: GREEN_PALE,
      };

    case 'cancelled_by_client':
      return {
        label: 'Annulée par vous',
        icon: 'close-circle-outline',
        color: RED,
        background: '#FDECEC',
      };

    case 'cancelled_by_therapist':
      return {
        label: 'Annulée par le thérapeute',
        icon: 'close-circle-outline',
        color: RED,
        background: '#FDECEC',
      };

    case 'expired':
      return {
        label: 'Expirée',
        icon: 'time-outline',
        color: GRAY,
        background: '#F2F3F5',
      };

    default:
      return {
        label: 'Statut inconnu',
        icon: 'help-circle-outline',
        color: GRAY,
        background: '#F2F3F5',
      };
  }
};

// ============================================================
// THERAPIST DATA HELPERS
// ============================================================

const getTherapistObject = (source) => {
  if (!source) {
    return null;
  }

  return (
    source.therapist ??
    source.therapeute ??
    source.provider ??
    source.professional ??
    source.user ??
    source.therapist_user ??
    null
  );
};

// ============================================================

const getTherapistNameFromData = (
  source,
  fallback = 'Thérapeute'
) => {
  const therapist =
    getTherapistObject(source);

  return (
    source?.therapist_name ??
    source?.therapistName ??
    source?.therapeute_name ??
    source?.therapeuteName ??
    therapist?.fullname ??
    therapist?.full_name ??
    therapist?.name ??
    therapist?.username ??
    source?.fullname ??
    source?.full_name ??
    source?.name ??
    fallback
  );
};

// ============================================================

const getTherapistPhoneFromData = (
  source
) => {
  const therapist =
    getTherapistObject(source);

  return (
    source?.therapist_phone ??
    source?.therapistPhone ??
    source?.therapeute_phone ??
    source?.therapeutePhone ??
    therapist?.phone ??
    therapist?.phone_number ??
    therapist?.telephone ??
    therapist?.mobile ??
    source?.phone ??
    source?.phone_number ??
    source?.telephone ??
    ''
  );
};

// ============================================================

const getTherapistEmailFromData = (
  source
) => {
  const therapist =
    getTherapistObject(source);

  return (
    source?.therapist_email ??
    source?.therapistEmail ??
    source?.therapeute_email ??
    source?.therapeuteEmail ??
    therapist?.email ??
    source?.email ??
    ''
  );
};

// ============================================================

const getTherapistAvatarFromData = (
  source
) => {
  const therapist =
    getTherapistObject(source);

  return (
    source?.therapist_avatar ??
    source?.therapistAvatar ??
    source?.therapist_photo ??
    source?.therapistPhoto ??
    source?.therapist_image ??
    source?.therapistImage ??
    source?.therapist_profile_image_url ??
    source?.therapistProfileImageUrl ??
    therapist?.avatar ??
    therapist?.avatar_url ??
    therapist?.avatarUrl ??
    therapist?.photo ??
    therapist?.photo_url ??
    therapist?.photoUrl ??
    therapist?.image ??
    therapist?.image_url ??
    therapist?.imageUrl ??
    // ✅ Nom de champ réellement utilisé par le backend
    // (voir therapistService / profil thérapeute) — c'était
    // manquant ici, ce qui faisait que la vraie photo de
    // profil n'était quasiment jamais trouvée.
    therapist?.profile_image_url ??
    therapist?.profileImageUrl ??
    ''
  );
};

// ============================================================

// Identifiant du thérapeute, pour aller chercher son profil
// COMPLET et RÉEL en base via therapistService.getTherapist(id)
// (les objets "booking"/"offer" ne contiennent pas toujours
// toutes les infos, notamment la photo).
const getTherapistIdFromData = (
  source
) => {
  const therapist =
    getTherapistObject(source);

  return (
    source?.therapist_id ??
    source?.therapistId ??
    source?.assigned_therapist_id ??
    source?.assignedTherapistId ??
    therapist?.id ??
    therapist?.user_id ??
    therapist?.userId ??
    null
  );
};

// ============================================================

const getTherapistOnlineFromData = (
  source
) => {
  const therapist =
    getTherapistObject(source);

  const value =
    source?.therapist_online ??
    source?.therapistOnline ??
    source?.therapist_is_online ??
    source?.therapistIsOnline ??
    source?.is_online ??
    source?.isOnline ??
    therapist?.is_online ??
    therapist?.isOnline ??
    therapist?.online ??
    therapist?.online_status ??
    therapist?.availability_status ??
    null;

  if (typeof value === 'boolean') {
    return value;
  }

  if (
    typeof value === 'number'
  ) {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized =
      value.trim().toLowerCase();

    if (
      [
        'online',
        'en ligne',
        'available',
        'disponible',
        'true',
        '1',
        'active',
      ].includes(normalized)
    ) {
      return true;
    }

    if (
      [
        'offline',
        'hors ligne',
        'indisponible',
        'unavailable',
        'false',
        '0',
        'inactive',
      ].includes(normalized)
    ) {
      return false;
    }
  }

  return null;
};

// ============================================================
// COMPONENT
// ============================================================

const NegotiationScreen = ({
  navigation,
  route,
}) => {
  const params = route?.params || {};

  const offerIdParam =
    params.offerId ??
    params.offer_id ??
    null;

  const bookingId =
    params.bookingId ??
    params.booking_id ??
    params.booking?.id ??
    params.booking?.booking_id ??
    null;

  const initialTherapistName =
    params.therapistName ??
    params.therapist_name ??
    params.booking?.therapist?.fullname ??
    params.booking?.therapist?.full_name ??
    params.booking?.therapist?.name ??
    'Thérapeute';

  const currentPriceParam =
    params.currentPrice ??
    params.current_price ??
    0;

  const bookingStatusParam =
    params.status ??
    params.bookingStatus ??
    params.booking_status ??
    params.booking?.status ??
    params.booking?.booking_status ??
    'pending';

  // ==========================================================
  // CONTEXT
  // ==========================================================

  const {
    colors: themeColors,
  } = useTheme();

  const { user } = useAuth();

  const {
    refreshUnreadCount,
  } = useNotifications();

  // ==========================================================
  // STATES
  // ==========================================================

  const [
    negotiationHistory,
    setNegotiationHistory,
  ] = useState([]);

  const [
    activeOffer,
    setActiveOffer,
  ] = useState(null);

  const [
    activeOfferId,
    setActiveOfferId,
  ] = useState(
    offerIdParam || null
  );

  const [
    bookingStatus,
    setBookingStatus,
  ] = useState(
    normalizeStatus(
      bookingStatusParam
    )
  );

  const [
    counterPrice,
    setCounterPrice,
  ] = useState('');

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    isLoadingHistory,
    setIsLoadingHistory,
  ] = useState(true);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    isAccepting,
    setIsAccepting,
  ] = useState(false);

  const [
    historyError,
    setHistoryError,
  ] = useState(null);

  const [
    selectedPrice,
    setSelectedPrice,
  ] = useState(null);

  // ==========================================================
  // THERAPIST PROFILE
  // ==========================================================

  const [
    therapistProfile,
    setTherapistProfile,
  ] = useState({
    name: initialTherapistName,
    phone: '',
    email: '',
    avatar: '',
    isOnline: null,
  });

  // Identifiant thérapeute déjà utilisé pour éviter de refaire
  // le même appel therapistService.getTherapist(id) en boucle.
  const fetchedTherapistIdRef = useRef(null);

  // ==========================================================
  // FETCH THERAPIST PROFILE (données réelles en base)
  // ==========================================================

  const fetchTherapistFullProfile = useCallback(
    async (id) => {
      if (!id) {
        return;
      }

      if (
        fetchedTherapistIdRef.current ===
        String(id)
      ) {
        return;
      }

      fetchedTherapistIdRef.current = String(id);

      try {
        const result =
          await therapistService.getTherapist(id);

        if (result?.success && result?.data) {
          updateTherapistProfile(result.data);
        }
      } catch (error) {
        console.log(
          'ℹ️ Impossible de récupérer le profil thérapeute:',
          error?.message
        );
      }
    },
    []
  );

  // ==========================================================
  // TOAST
  // ==========================================================

  const [
    toast,
    setToast,
  ] = useState({
    visible: false,
    message: '',
    type: 'success',
  });

  const toastAnim =
    useRef(
      new Animated.Value(0)
    ).current;

  const toastTimerRef =
    useRef(null);

  // ==========================================================
  // CONFIRM MODAL
  // ==========================================================

  const [
    confirmModal,
    setConfirmModal,
  ] = useState({
    visible: false,
    type: null,
    title: '',
    message: '',
  });

  // ==========================================================
  // ANIMATION
  // ==========================================================

  const fadeAnim =
    useRef(
      new Animated.Value(0)
    ).current;

  // ==========================================================
  // TOAST FUNCTIONS
  // ==========================================================

  const hideToast =
    useCallback(() => {
      if (
        toastTimerRef.current
      ) {
        clearTimeout(
          toastTimerRef.current
        );

        toastTimerRef.current =
          null;
      }

      Animated.timing(
        toastAnim,
        {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }
      ).start(() => {
        setToast(
          (previous) => ({
            ...previous,
            visible: false,
          })
        );
      });
    }, [toastAnim]);

  const showToast =
    useCallback(
      (
        messageText,
        type = 'success'
      ) => {
        if (
          toastTimerRef.current
        ) {
          clearTimeout(
            toastTimerRef.current
          );
        }

        setToast({
          visible: true,
          message:
            messageText,
          type,
        });

        Animated.timing(
          toastAnim,
          {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }
        ).start();

        toastTimerRef.current =
          setTimeout(() => {
            hideToast();
          }, 2600);
      },
      [
        hideToast,
        toastAnim,
      ]
    );

  useEffect(() => {
    return () => {
      if (
        toastTimerRef.current
      ) {
        clearTimeout(
          toastTimerRef.current
        );
      }
    };
  }, []);

  // ==========================================================
  // TOAST STYLE DATA
  // ==========================================================

  const toastInfo =
    useMemo(() => {
      switch (toast.type) {
        case 'error':
          return {
            icon: 'alert-circle-outline',
            color: RED,
            background: '#FDECEC',
          };

        case 'warning':
          return {
            icon: 'warning-outline',
            color: ORANGE,
            background: '#FFF5DD',
          };

        default:
          return {
            icon: 'checkmark-circle-outline',
            color: GREEN,
            background: GREEN_PALE,
          };
      }
    }, [toast.type]);

  // ==========================================================
  // DETERMINE OWNER
  // ==========================================================

  const isMine = useCallback(
    (offer) => {
      if (!offer) {
        return false;
      }

      if (
        user?.id !== undefined &&
        user?.id !== null
      ) {
        const offerUserId =
          offer.user_id ??
          offer.userId ??
          offer.client_id ??
          offer.clientId;

        if (
          offerUserId !== undefined &&
          offerUserId !== null
        ) {
          return (
            String(offerUserId) ===
            String(user.id)
          );
        }
      }

      const type =
        normalizeOfferType(
          offer
        );

      return type === 'client';
    },
    [user]
  );

  // ==========================================================
  // FIND THERAPIST OFFER
  // ==========================================================

  const findLatestTherapistOffer =
    useCallback(
      (offers) => {
        if (!Array.isArray(offers)) {
          return null;
        }

        if (offerIdParam) {
          const routeOffer =
            offers.find(
              (offer) =>
                String(
                  getOfferId(offer)
                ) ===
                String(offerIdParam)
            );

          if (
            routeOffer &&
            !isMine(routeOffer) &&
            !isOfferClosed(routeOffer)
          ) {
            return routeOffer;
          }
        }

        const therapistOffers =
          offers.filter(
            (offer) => {
              if (!offer) {
                return false;
              }

              if (
                isMine(offer)
              ) {
                return false;
              }

              if (
                normalizeOfferType(
                  offer
                ) === 'client'
              ) {
                return false;
              }

              if (
                isOfferClosed(
                  offer
                )
              ) {
                return false;
              }

              return true;
            }
          );

        if (
          therapistOffers.length === 0
        ) {
          return null;
        }

        return therapistOffers[
          therapistOffers.length - 1
        ];
      },
      [
        offerIdParam,
        isMine,
      ]
    );

  // ==========================================================
  // UPDATE THERAPIST PROFILE
  // ==========================================================

  const updateTherapistProfile =
    useCallback(
      (source) => {
        if (!source) {
          return;
        }

        setTherapistProfile(
          (previous) => ({
            name:
              getTherapistNameFromData(
                source,
                previous.name
              ) ||
              previous.name,

            phone:
              getTherapistPhoneFromData(
                source
              ) ||
              previous.phone,

            email:
              getTherapistEmailFromData(
                source
              ) ||
              previous.email,

            avatar:
              getTherapistAvatarFromData(
                source
              ) ||
              previous.avatar,

            isOnline:
              getTherapistOnlineFromData(
                source
              ) !== null
                ? getTherapistOnlineFromData(
                    source
                  )
                : previous.isOnline,
          })
        );
      },
      []
    );

  // ==========================================================
  // LOAD BOOKING STATUS
  // ==========================================================

  const loadBookingStatus =
    useCallback(
      async () => {
        if (!bookingId) {
          return;
        }

        try {
          const result =
            await bookingService.getBooking(
              bookingId
            );

          if (
            result?.success &&
            result?.data
          ) {
            const booking =
              result.data;

            const status =
              booking.status ??
              booking.booking_status;

            if (status) {
              setBookingStatus(
                normalizeStatus(status)
              );
            }

            updateTherapistProfile(
              booking
            );

            fetchTherapistFullProfile(
              getTherapistIdFromData(booking)
            );
          }
        } catch (error) {
          console.log(
            'ℹ️ Impossible de récupérer le booking:',
            error?.message
          );
        }
      },
      [
        bookingId,
        updateTherapistProfile,
        fetchTherapistFullProfile,
      ]
    );

  // ==========================================================
  // LOAD NEGOTIATION
  // ==========================================================

  const loadNegotiation =
    useCallback(
      async (
        showLoader = true
      ) => {
        if (!bookingId) {
          setHistoryError(
            'Identifiant de réservation manquant.'
          );

          setIsLoadingHistory(false);

          return;
        }

        try {
          if (showLoader) {
            setIsLoadingHistory(
              true
            );
          }

          setHistoryError(null);

          const [
            bookingResult,
            offersResult,
          ] = await Promise.all([
            bookingService
              .getBooking(
                bookingId
              )
              .catch((error) => {
                console.log(
                  'ℹ️ Booking fetch failed:',
                  error?.message
                );

                return null;
              }),

            offerService
              .getOffersByBooking(
                bookingId
              ),
          ]);

          // --------------------------------------------------
          // BOOKING
          // --------------------------------------------------

          if (
            bookingResult?.success &&
            bookingResult?.data
          ) {
            const booking =
              bookingResult.data;

            const serverStatus =
              booking.status ??
              booking.booking_status;

            if (serverStatus) {
              setBookingStatus(
                normalizeStatus(
                  serverStatus
                )
              );
            }

            updateTherapistProfile(
              booking
            );

            fetchTherapistFullProfile(
              getTherapistIdFromData(booking)
            );
          }

          // --------------------------------------------------
          // OFFERS
          // --------------------------------------------------

          if (
            !offersResult?.success
          ) {
            throw new Error(
              offersResult?.error ||
              'Impossible de charger les offres.'
            );
          }

          const offers =
            Array.isArray(
              offersResult.data
            )
              ? offersResult.data
              : [];

          setNegotiationHistory(
            offers
          );

          // --------------------------------------------------
          // Try therapist data from offers
          // --------------------------------------------------

          const therapistOfferForProfile =
            offers
              .slice()
              .reverse()
              .find(
                (offer) =>
                  normalizeOfferType(
                    offer
                  ) !== 'client'
              );

          if (
            therapistOfferForProfile
          ) {
            updateTherapistProfile(
              therapistOfferForProfile
            );

            updateTherapistProfile(
              therapistOfferForProfile.therapist
            );

            fetchTherapistFullProfile(
              getTherapistIdFromData(
                therapistOfferForProfile
              ) ??
                getTherapistIdFromData(
                  therapistOfferForProfile.therapist
                )
            );
          }

          // --------------------------------------------------
          // ACCEPTED
          // --------------------------------------------------

          const acceptedOffer =
            offers.find(
              (offer) =>
                getOfferStatus(
                  offer
                ) === 'accepted'
            );

          if (acceptedOffer) {
            setBookingStatus(
              'confirmed'
            );

            updateTherapistProfile(
              acceptedOffer
            );
          }

          // --------------------------------------------------
          // ACTIVE THERAPIST OFFER
          // --------------------------------------------------

          const therapistOffer =
            findLatestTherapistOffer(
              offers
            );

          if (therapistOffer) {
            const id =
              getOfferId(
                therapistOffer
              );

            setActiveOffer(
              therapistOffer
            );

            if (id) {
              setActiveOfferId(
                id
              );
            }

            updateTherapistProfile(
              therapistOffer
            );

            const price =
              getOfferPrice(
                therapistOffer
              );

            if (
              price > 0
            ) {
              setCounterPrice(
                (previous) =>
                  previous
                    ? previous
                    : String(
                        Math.round(
                          price
                        )
                      )
              );
            }
          } else {
            setActiveOffer(
              null
            );

            setActiveOfferId(
              null
            );

            if (
              offers.length > 0 &&
              !acceptedOffer
            ) {
              const lastOffer =
                offers[
                  offers.length - 1
                ];

              const lastPrice =
                getOfferPrice(
                  lastOffer
                );

              if (
                lastPrice > 0
              ) {
                setCounterPrice(
                  (previous) =>
                    previous
                      ? previous
                      : String(
                          Math.round(
                            lastPrice
                          )
                        )
                );
              }
            }
          }
        } catch (error) {
          console.error(
            '❌ [CLIENT NEGOTIATION] LOAD ERROR:',
            error
          );

          setHistoryError(
            error?.message ||
            'Impossible de charger la négociation.'
          );
        } finally {
          setIsLoadingHistory(
            false
          );
        }
      },
      [
        bookingId,
        findLatestTherapistOffer,
        updateTherapistProfile,
        fetchTherapistFullProfile,
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
        duration: 400,
        useNativeDriver: false,
      }
    ).start();

    loadNegotiation(
      true
    );
  }, [
    fadeAnim,
    loadNegotiation,
  ]);

  // ==========================================================
  // FOCUS REFRESH
  // ==========================================================

  useFocusEffect(
    useCallback(
      () => {
        loadNegotiation(
          false
        );
      },
      [
        loadNegotiation,
      ]
    )
  );

  // ==========================================================
  // CURRENT PRICE
  // ==========================================================

  const currentPrice =
    useMemo(() => {
      if (activeOffer) {
        return getOfferPrice(
          activeOffer
        );
      }

      const parameterPrice =
        Number(
          String(
            currentPriceParam || 0
          )
            .replace(/\s/g, '')
            .replace(',', '.')
        );

      if (
        Number.isFinite(
          parameterPrice
        ) &&
        parameterPrice > 0
      ) {
        return parameterPrice;
      }

      return 0;
    }, [
      activeOffer,
      currentPriceParam,
    ]);

  // ==========================================================
  // STATUS
  // ==========================================================

  const statusInfo =
    getStatusInfo(
      bookingStatus
    );

  const normalizedBookingStatus =
    normalizeStatus(
      bookingStatus
    );

  const isPending =
    normalizedBookingStatus ===
    'pending';

  const isNegotiating =
    normalizedBookingStatus ===
    'negotiating';

  const isConfirmed =
    normalizedBookingStatus ===
    'confirmed';

  const isClosedBooking =
    [
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'cancelled_by_client',
      'cancelled_by_therapist',
      'expired',
    ].includes(
      normalizedBookingStatus
    );

  // ==========================================================
  // ACTIVE OFFER
  // ==========================================================

  const activeOfferBelongsToTherapist =
    !!activeOffer &&
    !isMine(
      activeOffer
    );

  const canNegotiate =
    !isClosedBooking &&
    activeOfferBelongsToTherapist &&
    !!activeOfferId &&
    !isSubmitting &&
    !isAccepting;

  // ==========================================================
  // SUGGESTED PRICES
  // ==========================================================

  const suggestedPrices =
    currentPrice > 0
      ? [
          {
            label: '-15%',
            value: Math.max(
              10000,
              Math.round(
                currentPrice *
                  0.85
              )
            ),
          },
          {
            label: '-10%',
            value: Math.max(
              10000,
              Math.round(
                currentPrice *
                  0.9
              )
            ),
          },
          {
            label: '-5%',
            value: Math.max(
              10000,
              Math.round(
                currentPrice *
                  0.95
              )
            ),
          },
          {
            label: '+5%',
            value: Math.round(
              currentPrice *
                1.05
            ),
          },
        ]
      : [];

  // ==========================================================
  // PRICE DIFFERENCE
  // ==========================================================

  const getPriceDifference =
    (price) => {
      if (
        currentPrice <= 0
      ) {
        return '';
      }

      const diff =
        Number(price) -
        Number(currentPrice);

      if (
        diff === 0
      ) {
        return 'Même prix';
      }

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
  // SELECT PRICE
  // ==========================================================

  const selectSuggestedPrice =
    (value) => {
      setSelectedPrice(
        value
      );

      setCounterPrice(
        String(value)
      );

      showToast(
        `Prix sélectionné : ${formatPrice(value)}`,
        'success'
      );
    };

  // ==========================================================
  // VALIDATION
  // ==========================================================

  const numericCounterPrice =
    Number(
      String(
        counterPrice || 0
      )
        .replace(/\s/g, '')
        .replace(',', '.')
    );

  const hasValidCounterPrice =
    Number.isFinite(
      numericCounterPrice
    ) &&
    numericCounterPrice >=
      10000;

  // ==========================================================
  // EXECUTE ACCEPT
  // ==========================================================

  const executeAcceptOffer =
    async () => {
      if (
        isAccepting ||
        isSubmitting
      ) {
        return;
      }

      if (
        isClosedBooking
      ) {
        showToast(
          `La réservation est "${statusInfo.label}".`,
          'warning'
        );

        return;
      }

      const id =
        activeOfferId ||
        getOfferId(
          activeOffer
        );

      if (!id) {
        showToast(
          "Impossible d'identifier l'offre.",
          'error'
        );

        return;
      }

      if (
        activeOffer &&
        isMine(activeOffer)
      ) {
        showToast(
          "Vous ne pouvez pas accepter votre propre offre.",
          'error'
        );

        return;
      }

      try {
        setIsAccepting(
          true
        );

        const result =
          await offerService.acceptOffer(
            id
          );

        if (
          !result?.success
        ) {
          throw new Error(
            result?.error ||
            "Impossible d'accepter l'offre."
          );
        }

        setBookingStatus(
          'confirmed'
        );

        setActiveOffer(
          (previous) =>
            previous
              ? {
                  ...previous,
                  status:
                    'accepted',
                }
              : previous
        );

        await refreshUnreadCount?.();

        showToast(
          `Offre de ${formatPrice(
            currentPrice
          )} acceptée.`,
          'success'
        );

        setTimeout(() => {
          navigation.navigate(
            'Tracking',
            {
              bookingId,
            }
          );
        }, 850);
      } catch (error) {
        console.error(
          '❌ ACCEPT OFFER ERROR:',
          error
        );

        showToast(
          error?.message ||
          "Impossible d'accepter l'offre.",
          'error'
        );
      } finally {
        setIsAccepting(
          false
        );
      }
    };

  // ==========================================================
  // ACCEPT CONFIRMATION
  // ==========================================================

  const handleAcceptOffer =
    () => {
      if (
        !canNegotiate
      ) {
        return;
      }

      setConfirmModal({
        visible: true,
        type: 'accept',
        title: "Accepter l'offre",
        message:
          `Voulez-vous accepter l'offre de ${formatPrice(
            currentPrice
          )} ?`,
      });
    };

  // ==========================================================
  // EXECUTE COUNTER
  // ==========================================================

  const executeCounterOffer =
    async () => {
      if (
        isSubmitting ||
        isAccepting
      ) {
        return;
      }

      if (
        isClosedBooking
      ) {
        showToast(
          `La réservation est "${statusInfo.label}".`,
          'warning'
        );

        return;
      }

      const id =
        activeOfferId ||
        getOfferId(
          activeOffer
        );

      if (!id) {
        showToast(
          "Aucune offre active du thérapeute.",
          'error'
        );

        return;
      }

      if (
        !activeOffer ||
        isMine(activeOffer)
      ) {
        showToast(
          "Vous devez répondre à une offre du thérapeute.",
          'error'
        );

        return;
      }

      if (
        !hasValidCounterPrice
      ) {
        showToast(
          'Minimum : 10 000 Ar.',
          'warning'
        );

        return;
      }

      if (
        numericCounterPrice ===
        Number(currentPrice)
      ) {
        showToast(
          "Le prix est identique à l'offre actuelle.",
          'warning'
        );

        return;
      }

      try {
        setIsSubmitting(
          true
        );

        const result =
          await offerService.counterOffer(
            id,
            numericCounterPrice,
            message.trim()
          );

        if (
          !result?.success
        ) {
          throw new Error(
            result?.error ||
            'Impossible d’envoyer la contre-offre.'
          );
        }

        await refreshUnreadCount?.();

        setCounterPrice('');
        setMessage('');
        setSelectedPrice(null);

        await loadNegotiation(
          false
        );

        showToast(
          `Contre-offre de ${formatPrice(
            numericCounterPrice
          )} envoyée au thérapeute.`,
          'success'
        );
      } catch (error) {
        console.error(
          '❌ COUNTER OFFER ERROR:',
          error
        );

        showToast(
          error?.message ||
          'Impossible d’envoyer la contre-offre.',
          'error'
        );
      } finally {
        setIsSubmitting(
          false
        );
      }
    };

  // ==========================================================
  // COUNTER CONFIRMATION
  // ==========================================================

  const handleCounterOffer =
    () => {
      if (
        !canNegotiate
      ) {
        return;
      }

      if (
        !hasValidCounterPrice
      ) {
        showToast(
          'Veuillez saisir un prix supérieur ou égal à 10 000 Ar.',
          'warning'
        );

        return;
      }

      setConfirmModal({
        visible: true,
        type: 'counter',
        title: 'Envoyer la contre-offre',
        message:
          `Envoyer ${formatPrice(
            numericCounterPrice
          )} au thérapeute ?`,
      });
    };

  // ==========================================================
  // CONFIRM MODAL ACTION
  // ==========================================================

  const closeConfirmModal =
    () => {
      if (
        isAccepting ||
        isSubmitting
      ) {
        return;
      }

      setConfirmModal({
        visible: false,
        type: null,
        title: '',
        message: '',
      });
    };

  const confirmAction =
    async () => {
      const type =
        confirmModal.type;

      setConfirmModal({
        visible: false,
        type: null,
        title: '',
        message: '',
      });

      if (
        type === 'accept'
      ) {
        await executeAcceptOffer();
      }

      if (
        type === 'counter'
      ) {
        await executeCounterOffer();
      }
    };

  // ==========================================================
  // INVALID BOOKING
  // ==========================================================

  if (!bookingId) {
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
          title="Négociation"
          showBack
        />

        <View
          style={
            styles.centerContainer
          }
        >
          <View
            style={
              styles.centerIconBox
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={38}
              color={RED}
            />
          </View>

          <Text
            style={[
              styles.errorTitle,
              {
                color:
                  themeColors.text,
              },
            ]}
          >
            Réservation introuvable
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
      </View>
    );
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    isLoadingHistory &&
    negotiationHistory.length === 0
  ) {
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
          title="Négociation"
          showBack
        />

        <View
          style={
            styles.centerContainer
          }
        >
          <ActivityIndicator
            size="large"
            color={GREEN}
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
      </View>
    );
  }

  // ==========================================================
  // MAIN
  // ==========================================================

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor:
            themeColors.background,
        },
      ]}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <Header
        title="Négociation"
        showBack
      />

      {/* ======================================================
          TOAST CENTRAL SOUS HEADER
      ====================================================== */}

      {toast.visible && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrapper,
            {
              opacity:
                toastAnim,

              transform: [
                {
                  translateY:
                    toastAnim.interpolate({
                      inputRange: [
                        0,
                        1,
                      ],
                      outputRange: [
                        -12,
                        0,
                      ],
                    }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.toast,
              {
                backgroundColor:
                  themeColors.surface,
                borderColor:
                  toastInfo.color,
              },
            ]}
          >
            <View
              style={[
                styles.toastIcon,
                {
                  backgroundColor:
                    toastInfo.background,
                },
              ]}
            >
              <Ionicons
                name={
                  toastInfo.icon
                }
                size={19}
                color={
                  toastInfo.color
                }
              />
            </View>

            <Text
              style={[
                styles.toastText,
                {
                  color:
                    themeColors.text,
                },
              ]}
              numberOfLines={3}
            >
              {toast.message}
            </Text>

            <TouchableOpacity
              onPress={
                hideToast
              }
              style={
                styles.toastClose
              }
            >
              <Ionicons
                name="close"
                size={18}
                color={
                  themeColors.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <Animated.ScrollView
        style={[
          styles.scrollView,
          {
            opacity:
              fadeAnim,
          },
        ]}
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ====================================================
            THERAPIST PROFILE
        ==================================================== */}

        <Animatable.View
          animation="fadeInDown"
          duration={450}
        >
          <View
            style={[
              styles.therapistCard,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={
                styles.profileRow
              }
            >
              {/* PROFIL AVATAR ROND */}

              <View
                style={
                  styles.profileSquare
                }
              >
                {therapistProfile.avatar ? (
                  <Animated.Image
                    source={{
                      uri:
                        therapistProfile.avatar,
                    }}
                    style={
                      styles.profileImage
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.profilePlaceholder
                    }
                  >
                    <Ionicons
                      name="person"
                      size={30}
                      color={GREEN}
                    />
                  </View>
                )}

                {/* BADGE STATUT EN LIGNE (intégré au cadre) */}

                {typeof therapistProfile.isOnline ===
                  'boolean' && (
                  <View
                    style={[
                      styles.onlineDot,
                      {
                        backgroundColor:
                          therapistProfile.isOnline
                            ? GREEN
                            : RED,
                      },
                    ]}
                  />
                )}
              </View>

              <View
                style={
                  styles.profileInfo
                }
              >
                <Text
                  style={[
                    styles.profileLabel,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Thérapeute
                </Text>

                <Text
                  style={[
                    styles.profileName,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {
                    therapistProfile.name
                  }
                </Text>

                {/* TELEPHONE */}

                <View
                  style={
                    styles.contactRow
                  }
                >
                  <Ionicons
                    name="call-outline"
                    size={14}
                    color={
                      GREEN
                    }
                  />

                  <Text
                    style={[
                      styles.contactText,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {therapistProfile.phone ||
                      'Téléphone non renseigné'}
                  </Text>
                </View>

                {/* EMAIL */}

                <View
                  style={
                    styles.contactRow
                  }
                >
                  <Ionicons
                    name="mail-outline"
                    size={14}
                    color={
                      GREEN
                    }
                  />

                  <Text
                    style={[
                      styles.contactText,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {therapistProfile.email ||
                      'Email non renseigné'}
                  </Text>
                </View>

                {/* DISPONIBILITE (masqué si statut inconnu) */}

                {typeof therapistProfile.isOnline ===
                  'boolean' && (
                  <View
                    style={[
                      styles.onlineStatus,
                      {
                        backgroundColor:
                          therapistProfile.isOnline
                            ? GREEN_PALE
                            : '#FDECEC',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.onlineStatusDot,
                        {
                          backgroundColor:
                            therapistProfile.isOnline
                              ? GREEN
                              : RED,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.onlineStatusText,
                        {
                          color:
                            therapistProfile.isOnline
                              ? GREEN
                              : RED,
                        },
                      ]}
                    >
                      {therapistProfile.isOnline
                        ? 'En ligne'
                        : 'Hors ligne'}
                    </Text>
                  </View>
                )}
              </View>

              {/* BOOKING */}

              <View
                style={
                  styles.bookingInfo
                }
              >
                <Text
                  style={
                    styles.bookingNumber
                  }
                >
                  #{bookingId}
                </Text>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        statusInfo.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          statusInfo.color,
                      },
                    ]}
                  >
                    {
                      statusInfo.label
                    }
                  </Text>
                </View>
              </View>
            </View>

            {/* STATUS STEPS */}

            <View
              style={
                styles.statusSteps
              }
            >
              <View
                style={
                  styles.statusStep
                }
              >
                <View
                  style={[
                    styles.stepCircle,
                    {
                      backgroundColor:
                        isPending ||
                        isNegotiating ||
                        isConfirmed
                          ? GREEN
                          : '#D1D5DB',
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color="#FFFFFF"
                  />
                </View>

                <Text
                  style={[
                    styles.stepText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Demande
                </Text>
              </View>

              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor:
                      isNegotiating ||
                      isConfirmed
                        ? GREEN
                        : '#D1D5DB',
                  },
                ]}
              />

              <View
                style={
                  styles.statusStep
                }
              >
                <View
                  style={[
                    styles.stepCircle,
                    {
                      backgroundColor:
                        isNegotiating ||
                        isConfirmed
                          ? GREEN
                          : '#D1D5DB',
                    },
                  ]}
                >
                  <Ionicons
                    name="chatbubbles-outline"
                    size={13}
                    color="#FFFFFF"
                  />
                </View>

                <Text
                  style={[
                    styles.stepText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Négociation
                </Text>
              </View>

              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor:
                      isConfirmed
                        ? GREEN
                        : '#D1D5DB',
                  },
                ]}
              />

              <View
                style={
                  styles.statusStep
                }
              >
                <View
                  style={[
                    styles.stepCircle,
                    {
                      backgroundColor:
                        isConfirmed
                          ? GREEN
                          : '#D1D5DB',
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#FFFFFF"
                  />
                </View>

                <Text
                  style={[
                    styles.stepText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Confirmée
                </Text>
              </View>
            </View>
          </View>
        </Animatable.View>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {historyError ? (
          <View
            style={
              styles.errorBanner
            }
          >
            <View
              style={
                styles.errorIconBox
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={19}
                color={RED}
              />
            </View>

            <Text
              style={
                styles.errorBannerText
              }
            >
              {historyError}
            </Text>

            <TouchableOpacity
              onPress={() =>
                loadNegotiation(
                  true
                )
              }
              style={
                styles.retryButton
              }
            >
              <Text
                style={
                  styles.retryText
              }
              >
                Réessayer
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ====================================================
            PENDING
        ==================================================== */}

        {isPending &&
          !activeOffer &&
          negotiationHistory.length ===
            0 && (
            <Animatable.View
              animation="fadeInUp"
              duration={450}
            >
              <View
                style={[
                  styles.pendingCard,
                  {
                    backgroundColor:
                      themeColors.surface,
                  },
                ]}
              >
                <View
                  style={
                    styles.pendingIcon
                  }
                >
                  <Ionicons
                    name="time-outline"
                    size={31}
                    color={
                      ORANGE
                    }
                  />
                </View>

                <Text
                  style={[
                    styles.pendingTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  En attente d'une offre
                </Text>

                <Text
                  style={[
                    styles.pendingText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Le thérapeute doit encore
                  proposer un prix.
                </Text>
              </View>
            </Animatable.View>
          )}

        {/* ====================================================
            ACTIVE OFFER
        ==================================================== */}

        {activeOffer &&
          activeOfferBelongsToTherapist && (
            <Animatable.View
              animation="fadeInUp"
              delay={80}
              duration={500}
            >
              <View
                style={[
                  styles.offerCard,
                  {
                    backgroundColor:
                      themeColors.surface,
                  },
                ]}
              >
                <View
                  style={
                    styles.offerHeader
                  }
                >
                  <View>
                    <Text
                      style={[
                        styles.offerFrom,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      Offre du thérapeute
                    </Text>

                    <Text
                      style={[
                        styles.offerDate,
                        {
                          color:
                            themeColors.textSecondary,
                        },
                      ]}
                    >
                      {formatDate(
                        activeOffer.created_at ??
                          activeOffer.createdAt
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.currentBadge
                    }
                  >
                    <Text
                      style={
                        styles.currentBadgeText
                      }
                    >
                      Offre actuelle
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.bigPriceBox
                  }
                >
                  <Text
                    style={[
                      styles.bigPriceLabel,
                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    Prix proposé
                  </Text>

                  <Text
                    style={
                      styles.bigPrice
                    }
                  >
                    {formatPrice(
                      currentPrice
                    )}
                  </Text>
                </View>

                {activeOffer.message ? (
                  <View
                    style={[
                      styles.messageBox,
                      {
                        backgroundColor:
                          themeColors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.offerMessage,
                        {
                          color:
                            themeColors.text,
                        },
                      ]}
                    >
                      {activeOffer.message}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Animatable.View>
          )}

        {/* ====================================================
            WAITING
        ==================================================== */}

        {!isClosedBooking &&
          !activeOffer &&
          negotiationHistory.length >
            0 && (
            <View
              style={[
                styles.waitingCard,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={26}
                color={BLUE}
              />

              <View
                style={
                  styles.waitingContent
                }
              >
                <Text
                  style={[
                    styles.waitingTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  En attente du thérapeute
                </Text>

                <Text
                  style={[
                    styles.waitingText,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Votre dernière proposition a
                  été envoyée. Attendez la réponse
                  du thérapeute.
                </Text>
              </View>
            </View>
          )}

        {/* ====================================================
            ACTIONS
        ==================================================== */}

        {canNegotiate && (
          <Animatable.View
            animation="fadeInUp"
            delay={180}
            duration={500}
          >
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Que voulez-vous faire ?
            </Text>

            {/* ACCEPT */}

            <TouchableOpacity
              onPress={
                handleAcceptOffer
              }
              disabled={
                isAccepting ||
                isSubmitting
              }
              activeOpacity={0.86}
              style={[
                styles.greenButton,
                styles.acceptButton,
                (isAccepting ||
                  isSubmitting) &&
                  styles.disabledButton,
              ]}
            >
              {isAccepting ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#FFFFFF"
                  />

                  <View
                    style={
                      styles.actionTextBox
                    }
                  >
                    <Text
                      style={
                        styles.greenButtonTitle
                      }
                    >
                      Accepter l'offre
                    </Text>

                    <Text
                      style={
                        styles.greenButtonSubtitle
                      }
                    >
                      Confirmer{' '}
                      {formatPrice(
                        currentPrice
                      )}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="#FFFFFF"
                  />
                </>
              )}
            </TouchableOpacity>

            {/* COUNTER TITLE */}

            <View
              style={
                styles.counterTitleRow
              }
            >
              <View
                style={
                  styles.greenMiniIcon
                }
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={18}
                  color="#FFFFFF"
                />
              </View>

              <View>
                <Text
                  style={[
                    styles.counterTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Faire une contre-offre
                </Text>

                <Text
                  style={[
                    styles.counterSubtitle,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Proposez votre propre prix
                </Text>
              </View>
            </View>

            {/* SUGGESTIONS */}

            {suggestedPrices.length >
              0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.suggestionsContent
                }
              >
                {suggestedPrices.map(
                  (item) => {
                    const selected =
                      selectedPrice ===
                      item.value;

                    return (
                      <TouchableOpacity
                        key={
                          item.label
                        }
                        onPress={() =>
                          selectSuggestedPrice(
                            item.value
                          )
                        }
                        activeOpacity={0.82}
                        style={[
                          styles.suggestionCard,
                          {
                            backgroundColor:
                              selected
                                ? GREEN_PALE
                                : themeColors.surface,

                            borderColor:
                              selected
                                ? GREEN
                                : '#E5E7EB',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.suggestionLabel,
                            {
                              color:
                                selected
                                  ? GREEN
                                  : themeColors.textSecondary,
                            },
                          ]}
                        >
                          {item.label}
                        </Text>

                        <Text
                          style={[
                            styles.suggestionValue,
                            {
                              color:
                                selected
                                  ? GREEN
                                  : themeColors.text,
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
            )}

            {/* COUNTER FORM */}

            <View
              style={[
                styles.counterCard,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.formLabel,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Votre prix
              </Text>

              <View
                style={[
                  styles.priceInputContainer,
                  {
                    borderColor:
                      hasValidCounterPrice
                        ? GREEN
                        : '#D1D5DB',

                    backgroundColor:
                      themeColors.background,
                  },
                ]}
              >
                <Text
                  style={
                    styles.currency
                  }
                >
                  Ar
                </Text>

                <TextInput
                  value={
                    counterPrice
                  }
                  onChangeText={(
                    value
                  ) => {
                    const cleaned =
                      value.replace(
                        /[^0-9]/g,
                        ''
                      );

                    setCounterPrice(
                      cleaned
                    );

                    setSelectedPrice(
                      null
                    );
                  }}
                  keyboardType="numeric"
                  placeholder="Ex : 90 000"
                  placeholderTextColor={
                    themeColors.textSecondary
                  }
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

              <Text
                style={[
                  styles.formLabel,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Message
              </Text>

              <TextInput
                value={
                  message
                }
                onChangeText={
                  setMessage
                }
                placeholder="Message au thérapeute (optionnel)"
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
                      '#D1D5DB',

                    backgroundColor:
                      themeColors.background,
                  },
                ]}
              />

              <TouchableOpacity
                onPress={
                  handleCounterOffer
                }
                disabled={
                  !hasValidCounterPrice ||
                  isSubmitting ||
                  isAccepting
                }
                activeOpacity={0.85}
                style={[
                  styles.greenButton,
                  styles.counterButton,
                  (!hasValidCounterPrice ||
                    isSubmitting ||
                    isAccepting) &&
                    styles.disabledButton,
                ]}
              >
                {isSubmitting ? (
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
                        styles.greenButtonTitle
                      }
                    >
                      Envoyer la contre-offre
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* INFO */}

            <View
              style={
                styles.actionInfo
              }
            >
              <Text
                style={[
                  styles.actionInfoText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Le thérapeute recevra votre
                contre-offre et pourra l'accepter
                ou proposer un nouveau prix.
              </Text>
            </View>
          </Animatable.View>
        )}

        {/* ====================================================
            CLOSED
        ==================================================== */}

        {isClosedBooking &&
          !isConfirmed && (
            <View
              style={[
                styles.closedCard,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={28}
                color={
                  statusInfo.color
                }
              />

              <Text
                style={[
                  styles.closedTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Négociation fermée
              </Text>

              <Text
                style={[
                  styles.closedText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Cette réservation est actuellement
                « {statusInfo.label} ». Les actions
                de négociation ne sont plus disponibles.
              </Text>
            </View>
          )}

        {/* ====================================================
            CONFIRMED
        ==================================================== */}

        {isConfirmed && (
          <Animatable.View
            animation="zoomIn"
            duration={500}
          >
            <View
              style={[
                styles.confirmedCard,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
            >
              <View
                style={
                  styles.confirmedIcon
                }
              >
                <Ionicons
                  name="checkmark"
                  size={39}
                  color={
                    GREEN
                  }
                />
              </View>

              <Text
                style={[
                  styles.confirmedTitle,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Réservation confirmée
              </Text>

              <Text
                style={[
                  styles.confirmedText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                L'offre a été acceptée. Votre
                réservation est maintenant confirmée.
              </Text>

              <TouchableOpacity
                onPress={() => {
                  showToast(
                    'Ouverture du suivi de la réservation.',
                    'success'
                  );

                  setTimeout(() => {
                    navigation.navigate(
                      'Tracking',
                      {
                        bookingId,
                      }
                    );
                  }, 400);
                }}
                activeOpacity={0.85}
                style={
                  styles.greenButton
                }
              >
                <Ionicons
                  name="navigate-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.greenButtonTitle
                  }
                >
                  Suivre la réservation
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={19}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          </Animatable.View>
        )}

        {/* ====================================================
            HISTORY
        ==================================================== */}

        <Animatable.View
          animation="fadeInUp"
          delay={350}
          duration={500}
        >
          <View
            style={
              styles.historyHeader
            }
          >
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color:
                      themeColors.text,
                    marginTop: 0,
                    marginBottom: 2,
                  },
                ]}
              >
                Historique des échanges
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
              onPress={() => {
                loadNegotiation(
                  true
                );

                showToast(
                  'Négociation actualisée.',
                  'success'
                );
              }}
              disabled={
                isLoadingHistory
              }
              style={
                styles.refreshButton
              }
            >
              {isLoadingHistory ? (
                <ActivityIndicator
                  size="small"
                  color={
                    GREEN
                  }
                />
              ) : (
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={
                    GREEN
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
                size={37}
                color={
                  themeColors.textSecondary
                }
              />

              <Text
                style={[
                  styles.emptyTitle,
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
                  styles.emptyText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Les offres apparaîtront ici dès
                qu'une proposition sera créée.
              </Text>
            </View>
          ) : (
            negotiationHistory
              .slice()
              .reverse()
              .map(
                (
                  offer,
                  index
                ) => {
                  const mine =
                    isMine(
                      offer
                    );

                  const price =
                    getOfferPrice(
                      offer
                    );

                  const status =
                    getOfferStatus(
                      offer
                    );

                  const id =
                    getOfferId(
                      offer
                    );

                  const active =
                    isActiveOffer(
                      offer
                    );

                  const accepted =
                    status ===
                    'accepted';

                  const rejected =
                    status ===
                    'rejected';

                  return (
                    <View
                      key={
                        String(
                          id ??
                            index
                        )
                      }
                      style={[
                        styles.historyItem,
                        {
                          backgroundColor:
                            themeColors.surface,

                          borderLeftColor:
                            mine
                              ? '#D74444'
                              : GREEN,
                        },
                      ]}
                    >
                      <View
                        style={
                          styles.historyTop
                        }
                      >
                        <Text
                          style={[
                            styles.personBadgeText,
                            {
                              color:
                                mine
                                  ? '#D74444'
                                  : GREEN,
                            },
                          ]}
                        >
                          {mine
                            ? 'Vous'
                            : 'Thérapeute'}
                        </Text>

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
                            offer.created_at ??
                              offer.createdAt
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
                                  GREEN,
                              },
                            ]}
                          >
                            {formatPrice(
                              price
                            )}
                          </Text>

                          {id ? (
                            <Text
                              style={[
                                styles.historyOfferId,
                                {
                                  color:
                                    themeColors.textSecondary,
                                },
                              ]}
                            >
                              Offre #{id}
                            </Text>
                          ) : null}
                        </View>

                        <View
                          style={[
                            styles.historyStatus,
                            {
                              backgroundColor:
                                accepted
                                  ? GREEN_PALE
                                  : rejected
                                  ? '#FDECEC'
                                  : active
                                  ? '#EAF8EF'
                                  : '#F2F3F5',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.historyStatusText,
                              {
                                color:
                                  accepted
                                    ? GREEN
                                    : rejected
                                    ? RED
                                    : active
                                    ? GREEN
                                    : GRAY,
                              },
                            ]}
                          >
                            {accepted
                              ? 'Acceptée'
                              : rejected
                              ? 'Refusée'
                              : active
                              ? 'Active'
                              : status ||
                                '—'}
                          </Text>
                        </View>
                      </View>

                      {offer.message ? (
                        <View
                          style={
                            styles.historyMessageBox
                          }
                        >
                          <Text
                            style={[
                              styles.historyMessage,
                              {
                                color:
                                  themeColors.textSecondary,
                              },
                            ]}
                          >
                            {offer.message}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                }
              )
          )}
        </Animatable.View>

        {/* ====================================================
            TIP
        ==================================================== */}

        {currentPrice > 0 &&
          !isConfirmed && (
            <Animatable.View
              animation="fadeInUp"
              delay={550}
              duration={500}
            >
              <View
                style={[
                  styles.tipCard,
                  {
                    backgroundColor:
                      GREEN_PALE,
                  },
                ]}
              >
                <View
                  style={
                    styles.tipIcon
                  }
                >
                  <Ionicons
                    name="bulb-outline"
                    size={20}
                    color={
                      GREEN
                    }
                  />
                </View>

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
                          GREEN,
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
                    Une contre-offre proche du prix
                    proposé augmente généralement
                    les chances d'accord.
                  </Text>
                </View>
              </View>
            </Animatable.View>
          )}

        <View
          style={{
            height: 35,
          }}
        />
      </Animated.ScrollView>

      {/* ======================================================
          CONFIRMATION MODAL
      ====================================================== */}

      <Modal
        visible={
          confirmModal.visible
        }
        transparent
        animationType="fade"
        onRequestClose={
          closeConfirmModal
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <Animatable.View
            animation="zoomIn"
            duration={220}
            style={[
              styles.modalCard,
              {
                backgroundColor:
                  themeColors.surface,
              },
            ]}
          >
            <View
              style={
                styles.modalIcon
              }
            >
              <Ionicons
                name={
                  confirmModal.type ===
                  'accept'
                    ? 'checkmark-circle-outline'
                    : 'swap-horizontal-outline'
                }
                size={32}
                color={
                  GREEN
                }
              />
            </View>

            <Text
              style={[
                styles.modalTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              {confirmModal.title}
            </Text>

            <Text
              style={[
                styles.modalMessage,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              {confirmModal.message}
            </Text>

            <View
              style={
                styles.modalButtons
              }
            >
              <TouchableOpacity
                onPress={
                  closeConfirmModal
                }
                disabled={
                  isAccepting ||
                  isSubmitting
                }
                style={
                  styles.cancelModalButton
                }
              >
                <Text
                  style={
                    styles.cancelModalText
                  }
                >
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={
                  confirmAction
                }
                disabled={
                  isAccepting ||
                  isSubmitting
                }
                style={
                  styles.confirmModalButton
                }
              >
                {isAccepting ||
                isSubmitting ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.confirmModalText
                    }
                  >
                    {confirmModal.type ===
                    'accept'
                      ? 'Accepter'
                      : 'Envoyer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 30,
  },

  // ==========================================================
  // TOAST
  // ==========================================================

  toastWrapper: {
    position: 'absolute',
    top:
      Platform.OS === 'web'
        ? 62
        : 76,
    left: 18,
    right: 18,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
  },

  toast: {
    width: '100%',
    maxWidth: 560,
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },

  toastIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  toastText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },

  toastClose: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },

  // ==========================================================
  // THERAPIST PROFILE
  // ==========================================================

  therapistCard: {
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 16,
    padding: 13,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  profileSquare: {
    width: 68,
    height: 68,
    // ✅ Carré avec bordures légèrement arrondies (demande
    // explicite), au lieu d'un cercle plein (borderRadius
    // égal à la moitié de la largeur).
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GREEN_BORDER,
    backgroundColor: GREEN_PALE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },

  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },

  profilePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN_PALE,
  },

  onlineDot: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 8,
    right: 0,
    bottom: 1,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },

  profileInfo: {
    flex: 1,
    marginLeft: 11,
    minWidth: 0,
  },

  profileLabel: {
    fontSize: 9,
    fontWeight: '600',
  },

  profileName: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 1,
    marginBottom: 5,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    minWidth: 0,
  },

  contactText: {
    flex: 1,
    fontSize: 9,
    marginLeft: 6,
  },

  onlineStatus: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginTop: 6,
  },

  onlineStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },

  onlineStatusText: {
    fontSize: 8,
    fontWeight: '800',
  },

  bookingInfo: {
    alignItems: 'flex-end',
    marginLeft: 7,
  },

  bookingNumber: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '900',
  },

  statusBadge: {
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
  },

  statusBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },

  // ==========================================================
  // STATUS STEPS
  // ==========================================================

  statusSteps: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusStep: {
    alignItems: 'center',
    flex: 1,
  },

  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepText: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },

  stepLine: {
    height: 2,
    flex: 0.45,
    marginBottom: 17,
  },

  // ==========================================================
  // ERROR
  // ==========================================================

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 7,
  },

  errorIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorBannerText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 10,
    lineHeight: 15,
  },

  retryButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },

  retryText: {
    color: RED,
    fontSize: 9,
    fontWeight: '800',
  },

  // ==========================================================
  // PENDING
  // ==========================================================

  pendingCard: {
    borderRadius: 16,
    padding: 21,
    alignItems: 'center',
    elevation: 2,
  },

  pendingIcon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#FFF5DD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pendingTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 11,
  },

  pendingText: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 5,
    maxWidth: 470,
  },

  // ==========================================================
  // OFFER
  // ==========================================================

  offerCard: {
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },

  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  offerFrom: {
    fontSize: 13,
    fontWeight: '900',
  },

  offerDate: {
    fontSize: 9,
    marginTop: 2,
  },

  currentBadge: {
    backgroundColor: GREEN,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },

  currentBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },

  bigPriceBox: {
    alignItems: 'center',
    paddingVertical: 15,
  },

  bigPriceLabel: {
    fontSize: 10,
    fontWeight: '600',
  },

  bigPrice: {
    fontSize: 29,
    fontWeight: '900',
    color: GREEN,
    marginTop: 2,
  },

  messageBox: {
    borderRadius: 10,
    padding: 10,
  },

  offerMessage: {
    fontSize: 11,
    lineHeight: 17,
  },

  // ==========================================================
  // WAITING
  // ==========================================================

  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
    elevation: 1,
  },

  waitingContent: {
    flex: 1,
    marginLeft: 9,
  },

  waitingTitle: {
    fontSize: 13,
    fontWeight: '900',
  },

  waitingText: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  // ==========================================================
  // SECTION
  // ==========================================================

  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 15,
    marginBottom: 8,
  },

  // ==========================================================
  // GREEN BUTTONS
  // ==========================================================

  greenButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    gap: 8,
    elevation: 3,
    shadowColor: GREEN,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },

  acceptButton: {
    minHeight: 67,
    justifyContent: 'flex-start',
    marginBottom: 14,
  },

  greenButtonTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  greenButtonSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9,
    marginTop: 2,
  },

  actionTextBox: {
    flex: 1,
  },

  disabledButton: {
    opacity: 0.55,
    elevation: 0,
  },

  // ==========================================================
  // COUNTER
  // ==========================================================

  counterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 8,
  },

  greenMiniIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  counterTitle: {
    fontSize: 14,
    fontWeight: '900',
  },

  counterSubtitle: {
    fontSize: 9,
    marginTop: 2,
  },

  // ==========================================================
  // SUGGESTIONS
  // ==========================================================

  suggestionsContent: {
    paddingBottom: 10,
  },

  suggestionCard: {
    width: 105,
    minHeight: 80,
    borderRadius: 11,
    borderWidth: 1.5,
    marginRight: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },

  suggestionLabel: {
    fontSize: 10,
    fontWeight: '800',
  },

  suggestionValue: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },

  suggestionDiff: {
    fontSize: 8,
    marginTop: 2,
  },

  // ==========================================================
  // FORM
  // ==========================================================

  counterCard: {
    borderRadius: 16,
    padding: 14,
    marginTop: 3,
    elevation: 2,
  },

  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },

  priceInputContainer: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
  },

  currency: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '900',
    marginRight: 9,
  },

  priceInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    paddingVertical: 8,
  },

  minimumText: {
    fontSize: 9,
    marginTop: 4,
    marginBottom: 10,
  },

  messageInput: {
    minHeight: 84,
    maxHeight: 125,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 11,
    marginBottom: 12,
  },

  counterButton: {
    minHeight: 51,
  },

  actionInfo: {
    paddingHorizontal: 12,
    marginTop: 8,
  },

  actionInfoText: {
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
  },

  // ==========================================================
  // CLOSED
  // ==========================================================

  closedCard: {
    borderRadius: 15,
    padding: 19,
    marginTop: 13,
    alignItems: 'center',
    elevation: 2,
  },

  closedTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
  },

  closedText: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 5,
  },

  // ==========================================================
  // CONFIRMED
  // ==========================================================

  confirmedCard: {
    borderRadius: 17,
    padding: 21,
    marginTop: 13,
    alignItems: 'center',
    elevation: 3,
  },

  confirmedIcon: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GREEN_BORDER,
    backgroundColor: GREEN_PALE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmedTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 11,
  },

  confirmedText: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 5,
    maxWidth: 420,
    marginBottom: 13,
  },

  // ==========================================================
  // HISTORY
  // ==========================================================

  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 6,
  },

  historySubtitle: {
    fontSize: 9,
    marginTop: 1,
  },

  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: GREEN_PALE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyHistory: {
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    elevation: 1,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
  },

  emptyText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 4,
  },

  historyItem: {
    borderLeftWidth: 4,
    borderRadius: 13,
    padding: 11,
    marginTop: 9,
    elevation: 1,
  },

  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  personBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },

  historyDate: {
    fontSize: 8,
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

  historyStatus: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
  },

  historyStatusText: {
    fontSize: 8,
    fontWeight: '800',
  },

  historyMessageBox: {
    marginTop: 8,
  },

  historyMessage: {
    fontSize: 10,
    lineHeight: 15,
    fontStyle: 'italic',
  },

  // ==========================================================
  // TIP
  // ==========================================================

  tipCard: {
    flexDirection: 'row',
    borderRadius: 13,
    padding: 12,
    marginTop: 14,
  },

  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tipContent: {
    flex: 1,
    marginLeft: 8,
  },

  tipTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },

  tipText: {
    fontSize: 9,
    lineHeight: 15,
  },

  // ==========================================================
  // MODAL
  // ==========================================================

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  modalCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },

  modalIcon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: GREEN_PALE,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 12,
  },

  modalMessage: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 350,
  },

  modalButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
  },

  cancelModalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  cancelModalText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '800',
  },

  confirmModalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 11,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmModalText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  // ==========================================================
  // CENTER
  // ==========================================================

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  centerIconBox: {
    width: 65,
    height: 65,
    borderRadius: 14,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 12,
  },

  errorTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },

  errorText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 5,
  },
});

export default NegotiationScreen;