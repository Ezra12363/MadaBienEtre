// src/screens/therapist/NotificationScreen.js

/**
 * ============================================================
 * THERAPIST - NOTIFICATION SCREEN
 * ============================================================
 *
 * Fonctionnalités :
 *
 * 1. Chargement réel depuis notificationService
 * 2. Tri : plus récente -> plus ancienne
 * 3. Durée dynamique
 * 4. Notification cliquable
 * 5. Navigation Offre / Négociation / Booking
 * 6. Marquage automatique comme lu
 * 7. Le texte reste visible après lecture
 * 8. Suppression individuelle
 * 9. Modal de confirmation avant suppression
 * 10. Toast central après chaque action
 * 11. Tout marquer comme lu
 * 12. Filtres
 * 13. Badge NON LUE
 * 14. Pull-to-refresh
 * 15. Android / Web
 * 16. Dark mode
 * 17. Mise à jour de la durée toutes les secondes
 * ============================================================
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

import { colors, spacing, typography } from '../../theme';

import Header from '../../components/common/Header';

import notificationService from '../../services/notificationService';


/* ============================================================
   HELPERS
============================================================ */

/**
 * Convertit plusieurs formats possibles de date
 * en timestamp.
 */
const getNotificationTimestamp = (notification) => {
  const rawDate =
    notification?.created_at ??
    notification?.createdAt ??
    notification?.date ??
    notification?.timestamp ??
    notification?.sent_at ??
    notification?.sentAt ??
    notification?.notification_date ??
    notification?.notificationDate ??
    null;

  if (!rawDate) {
    return 0;
  }

  if (typeof rawDate === 'number') {
    if (rawDate < 10000000000) {
      return rawDate * 1000;
    }

    return rawDate;
  }

  const timestamp = new Date(rawDate).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
};


/**
 * Retourne l'identifiant réel.
 */
const getNotificationId = (notification) => {
  return (
    notification?.id ??
    notification?.notification_id ??
    notification?.notificationId ??
    null
  );
};


/**
 * Vérifie si une notification est lue.
 */
const isNotificationRead = (notification) => {
  if (!notification) {
    return true;
  }

  if (typeof notification.is_read === 'boolean') {
    return notification.is_read;
  }

  if (typeof notification.isRead === 'boolean') {
    return notification.isRead;
  }

  if (typeof notification.read === 'boolean') {
    return notification.read;
  }

  if (notification.read_at) {
    return true;
  }

  if (notification.readAt) {
    return true;
  }

  return false;
};


/**
 * Normalise une valeur.
 */
const safeText = (value, fallback = '') => {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  return String(value);
};


/**
 * Récupère les données supplémentaires.
 */
const getNotificationData = (notification) => {
  const rawData =
    notification?.data ??
    notification?.metadata ??
    notification?.payload ??
    {};

  if (
    rawData &&
    typeof rawData === 'object'
  ) {
    return rawData;
  }

  if (
    typeof rawData === 'string'
  ) {
    try {
      const parsed = JSON.parse(rawData);

      if (
        parsed &&
        typeof parsed === 'object'
      ) {
        return parsed;
      }
    } catch (error) {
      return {};
    }
  }

  return {};
};


/**
 * Catégorie.
 */
const resolveCategory = (type) => {
  const value = String(type || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');

  if (
    value.includes('offer') ||
    value.includes('negotiation') ||
    value.includes('negociation') ||
    value.includes('counter')
  ) {
    return 'offer';
  }

  if (
    value.includes('sos') ||
    value.includes('emergency') ||
    value.includes('urgence')
  ) {
    return 'sos';
  }

  if (
    value.includes('payment') ||
    value.includes('paiement') ||
    value.includes('earning') ||
    value.includes('withdraw')
  ) {
    return 'payment';
  }

  if (
    value.includes('booking') ||
    value.includes('reservation') ||
    value.includes('réservation')
  ) {
    return 'booking';
  }

  return 'system';
};


/**
 * Libellés lisibles par catégorie (utilisés dans le menu d'options
 * et pour le message de confirmation de désactivation).
 */
const CATEGORY_LABELS = {
  booking: 'Réservations',
  offer: 'Négociations',
  payment: 'Paiements',
  system: 'Système',
  sos: 'Alertes SOS',
};


/**
 * ============================================================
 * TYPE D'ACTION
 * ============================================================
 */
const resolveNotificationAction = (notification) => {
  const type = String(
    notification?.type ||
    notification?.notification_type ||
    notification?.notificationType ||
    ''
  )
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  const title = String(
    notification?.title || ''
  )
    .toLowerCase()
    .trim();

  const message = String(
    notification?.message ||
    notification?.body ||
    notification?.description ||
    ''
  )
    .toLowerCase()
    .trim();

  const combined = `${type} ${title} ${message}`;


  /* ----------------------------------------------------------
     NEGOTIATION
  ---------------------------------------------------------- */

  if (
    type.includes('counter_offer') ||
    type.includes('counteroffer') ||
    type.includes('counter') ||
    type.includes('negotiation') ||
    type.includes('negociation') ||
    combined.includes('négociation') ||
    combined.includes('negociation') ||
    combined.includes('negotiation')
  ) {
    return 'negotiation';
  }


  /* ----------------------------------------------------------
     OFFER
  ---------------------------------------------------------- */

  if (
    type === 'offer' ||
    type === 'new_offer' ||
    type === 'newoffer' ||
    type.includes('offer_created') ||
    type.includes('new_offer')
  ) {
    return 'offer';
  }


  if (
    type.includes('offer') &&
    !type.includes('counter')
  ) {
    return 'offer';
  }


  /* ----------------------------------------------------------
     BOOKING
  ---------------------------------------------------------- */

  if (
    type.includes('booking') ||
    type.includes('reservation') ||
    type.includes('réservation')
  ) {
    return 'booking';
  }


  return 'none';
};


/**
 * Booking ID.
 */
const getBookingIdFromNotification = (
  notification
) => {
  const data =
    getNotificationData(notification);

  return (
    notification?.booking_id ??
    notification?.bookingId ??
    notification?.id_booking ??
    notification?.idBooking ??
    data?.booking_id ??
    data?.bookingId ??
    data?.id_booking ??
    data?.idBooking ??
    data?.booking?.id ??
    data?.booking?.booking_id ??
    null
  );
};


/**
 * Offer ID.
 */
const getOfferIdFromNotification = (
  notification
) => {
  const data =
    getNotificationData(notification);

  return (
    notification?.offer_id ??
    notification?.offerId ??
    notification?.id_offer ??
    notification?.idOffer ??
    data?.offer_id ??
    data?.offerId ??
    data?.id_offer ??
    data?.idOffer ??
    data?.offer?.id ??
    data?.offer?.offer_id ??
    null
  );
};


/**
 * ============================================================
 * FORMAT DATE RELATIVE
 * ============================================================
 */
const formatTimeAgo = (date) => {
  const created = getNotificationTimestamp({
    created_at: date,
  });

  if (!created) {
    return '';
  }

  const now = Date.now();

  let diff = now - created;

  if (diff < 0) {
    diff = 0;
  }

  const seconds = Math.floor(
    diff / 1000
  );

  if (seconds < 10) {
    return "À l'instant";
  }

  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  const remainingMinutes =
    minutes % 60;

  if (hours < 24) {
    if (remainingMinutes > 0) {
      return `${hours} h ${remainingMinutes}`;
    }

    return `${hours} h`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days} j`;
  }

  const weeks = Math.floor(
    days / 7
  );

  if (weeks < 5) {
    return `${weeks} sem`;
  }

  const months = Math.floor(
    days / 30
  );

  if (months < 12) {
    return `${months} mois`;
  }

  const years = Math.floor(
    days / 365
  );

  return `${years} an${
    years > 1 ? 's' : ''
  }`;
};


/* ============================================================
   COMPONENT
============================================================ */

const NotificationScreen = ({
  navigation,
}) => {

  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const insets =
    useSafeAreaInsets();


  const {
    unreadCount,
    markAsRead,
    markAllAsRead,
    refreshUnreadCount,
  } = useNotifications();


  /* ==========================================================
     STATE
  ========================================================== */

  const [
    notifications,
    setNotifications,
  ] = useState([]);


  const [
    isLoading,
    setIsLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    selectedFilter,
    setSelectedFilter,
  ] = useState('all');


  const [
    deletingId,
    setDeletingId,
  ] = useState(null);


  const [
    readingId,
    setReadingId,
  ] = useState(null);


  const [
    currentTime,
    setCurrentTime,
  ] = useState(Date.now());


  /* ==========================================================
     DELETE MODAL
  ========================================================== */

  const [
    deleteModalVisible,
    setDeleteModalVisible,
  ] = useState(false);


  const [
    notificationToDelete,
    setNotificationToDelete,
  ] = useState(null);


  const [
    deleteModalLoading,
    setDeleteModalLoading,
  ] = useState(false);


  /* ==========================================================
     OPTIONS BOTTOM SHEET (⋮ sur chaque notification)
  ========================================================== */

  const [
    optionsVisible,
    setOptionsVisible,
  ] = useState(false);


  const [
    notificationForOptions,
    setNotificationForOptions,
  ] = useState(null);


  const [
    disablingTypeLoading,
    setDisablingTypeLoading,
  ] = useState(false);


  /* ==========================================================
     TOAST
  ========================================================== */

  const [
    toast,
    setToast,
  ] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });


  const toastOpacity =
    useRef(
      new Animated.Value(0)
    ).current;


  const toastTranslateY =
    useRef(
      new Animated.Value(-30)
    ).current;


  const toastTimerRef =
    useRef(null);


  /* ==========================================================
     MODAL ANIMATION
  ========================================================== */

  const modalScale =
    useRef(
      new Animated.Value(0.85)
    ).current;


  const modalOpacity =
    useRef(
      new Animated.Value(0)
    ).current;


  /* ==========================================================
     OPTIONS SHEET ANIMATION
  ========================================================== */

  const sheetTranslateY =
    useRef(
      new Animated.Value(400)
    ).current;


  const sheetBackdropOpacity =
    useRef(
      new Animated.Value(0)
    ).current;


  /* ==========================================================
     LIST ANIMATION
  ========================================================== */

  const fadeAnim =
    useRef(
      new Animated.Value(0)
    ).current;


  /* ==========================================================
     FILTERS
  ========================================================== */

  const filters = useMemo(
    () => [
      {
        id: 'all',
        label: 'Toutes',
        icon: 'notifications-outline',
      },

      {
        id: 'booking',
        label: 'Réservations',
        icon: 'calendar-outline',
      },

      {
        id: 'offer',
        label: 'Négociations',
        icon: 'pricetag-outline',
      },

      {
        id: 'payment',
        label: 'Paiements',
        icon: 'card-outline',
      },

      {
        id: 'system',
        label: 'Système',
        icon: 'information-circle-outline',
      },
    ],
    []
  );


  /* ==========================================================
     TOAST CENTRAL
  ========================================================== */

  const hideToast =
    useCallback(() => {

      Animated.parallel([
        Animated.timing(
          toastOpacity,
          {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          toastTranslateY,
          {
            toValue: -20,
            duration: 180,
            useNativeDriver: true,
          }
        ),
      ]).start(() => {

        setToast(
          (previous) => ({
            ...previous,
            visible: false,
          })
        );

      });

    }, [
      toastOpacity,
      toastTranslateY,
    ]);


  const showToast =
    useCallback(
      ({
        type = 'success',
        title = '',
        message = '',
        duration = 2600,
      }) => {

        if (
          toastTimerRef.current
        ) {
          clearTimeout(
            toastTimerRef.current
          );
        }


        setToast({
          visible: true,
          type,
          title,
          message,
        });


        toastOpacity.setValue(0);
        toastTranslateY.setValue(-30);


        Animated.parallel([
          Animated.timing(
            toastOpacity,
            {
              toValue: 1,
              duration: 250,
              useNativeDriver: true,
            }
          ),

          Animated.spring(
            toastTranslateY,
            {
              toValue: 0,
              friction: 7,
              tension: 55,
              useNativeDriver: true,
            }
          ),
        ]).start();


        toastTimerRef.current =
          setTimeout(() => {
            hideToast();
          }, duration);

      },
      [
        hideToast,
        toastOpacity,
        toastTranslateY,
      ]
    );


  /* ==========================================================
     CLEAN TOAST TIMER
  ========================================================== */

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


  /* ==========================================================
     OPEN DELETE MODAL
  ========================================================== */

  const openDeleteModal =
    useCallback(
      (notification) => {

        setNotificationToDelete(
          notification
        );

        setDeleteModalVisible(
          true
        );

        setDeleteModalLoading(
          false
        );


        modalOpacity.setValue(0);
        modalScale.setValue(0.85);


        Animated.parallel([
          Animated.timing(
            modalOpacity,
            {
              toValue: 1,
              duration: 220,
              useNativeDriver: true,
            }
          ),

          Animated.spring(
            modalScale,
            {
              toValue: 1,
              friction: 7,
              tension: 65,
              useNativeDriver: true,
            }
          ),
        ]).start();

      },
      [
        modalOpacity,
        modalScale,
      ]
    );


  /* ==========================================================
     CLOSE DELETE MODAL
  ========================================================== */

  const closeDeleteModal =
    useCallback(() => {

      if (
        deleteModalLoading
      ) {
        return;
      }


      Animated.parallel([
        Animated.timing(
          modalOpacity,
          {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          modalScale,
          {
            toValue: 0.85,
            duration: 160,
            useNativeDriver: true,
          }
        ),
      ]).start(() => {

        setDeleteModalVisible(
          false
        );

        setNotificationToDelete(
          null
        );

      });

    }, [
      deleteModalLoading,
      modalOpacity,
      modalScale,
    ]);


  /* ==========================================================
     OPEN OPTIONS SHEET (⋮)
  ========================================================== */

  const openOptionsSheet =
    useCallback(
      (notification) => {

        setNotificationForOptions(
          notification
        );

        setOptionsVisible(
          true
        );

        sheetTranslateY.setValue(400);
        sheetBackdropOpacity.setValue(0);

        Animated.parallel([
          Animated.timing(
            sheetBackdropOpacity,
            {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }
          ),

          Animated.spring(
            sheetTranslateY,
            {
              toValue: 0,
              friction: 9,
              tension: 70,
              useNativeDriver: true,
            }
          ),
        ]).start();

      },
      [
        sheetBackdropOpacity,
        sheetTranslateY,
      ]
    );


  /* ==========================================================
     CLOSE OPTIONS SHEET
  ========================================================== */

  const closeOptionsSheet =
    useCallback(
      (callback) => {

        Animated.parallel([
          Animated.timing(
            sheetBackdropOpacity,
            {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            sheetTranslateY,
            {
              toValue: 400,
              duration: 200,
              useNativeDriver: true,
            }
          ),
        ]).start(() => {

          setOptionsVisible(
            false
          );

          setNotificationForOptions(
            null
          );

          if (
            typeof callback ===
            'function'
          ) {
            callback();
          }

        });

      },
      [
        sheetBackdropOpacity,
        sheetTranslateY,
      ]
    );


  /* ==========================================================
     TIMER DURÉE
  ========================================================== */

  useFocusEffect(
    useCallback(() => {

      setCurrentTime(
        Date.now()
      );

      const interval =
        setInterval(() => {

          setCurrentTime(
            Date.now()
          );

        }, 1000);


      return () => {
        clearInterval(
          interval
        );
      };

    }, [])
  );


  /* ==========================================================
     LOAD NOTIFICATIONS
  ========================================================== */

  const loadNotifications =
    useCallback(async () => {

      setIsLoading(true);

      try {

        const result =
          await notificationService
            .getNotifications();


        if (!result?.success) {

          console.warn(
            '⚠️ [Notifications] Impossible de charger:',
            result?.error
          );

          setNotifications([]);

          return;
        }


        const data =
          result?.data;


        let list = [];


        if (Array.isArray(data)) {
          list = data;
        }

        else if (
          Array.isArray(
            data?.notifications
          )
        ) {
          list =
            data.notifications;
        }

        else if (
          Array.isArray(
            data?.items
          )
        ) {
          list =
            data.items;
        }

        else if (
          Array.isArray(
            data?.results
          )
        ) {
          list =
            data.results;
        }


        const normalized =
          list.map(
            (item, index) => {

              const notificationId =
                getNotificationId(
                  item
                );


              const createdAt =
                item?.created_at ??
                item?.createdAt ??
                item?.date ??
                item?.timestamp ??
                item?.sent_at ??
                item?.sentAt ??
                item?.notification_date ??
                item?.notificationDate ??
                null;


              return {
                ...item,

                id:
                  notificationId ??
                  `notification-${index}`,

                is_read:
                  isNotificationRead(
                    item
                  ),

                created_at:
                  createdAt,
              };

            }
          );


        normalized.sort(
          (a, b) =>
            getNotificationTimestamp(
              b
            ) -
            getNotificationTimestamp(
              a
            )
        );


        setNotifications(
          normalized
        );

      } catch (error) {

        console.error(
          '❌ [Notifications] Error loading notifications:',
          error
        );

        setNotifications([]);

      } finally {

        setIsLoading(false);
      }

    }, []);


  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {

    loadNotifications();


    Animated.timing(
      fadeAnim,
      {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }
    ).start();

  }, [
    loadNotifications,
    fadeAnim,
  ]);


  /* ==========================================================
     RELOAD ON FOCUS
  ========================================================== */

  useFocusEffect(
    useCallback(() => {

      loadNotifications();


      if (
        typeof refreshUnreadCount ===
        'function'
      ) {

        refreshUnreadCount();

      }


      return undefined;

    }, [
      loadNotifications,
      refreshUnreadCount,
    ])
  );


  /* ==========================================================
     REFRESH
  ========================================================== */

  const onRefresh =
    useCallback(async () => {

      setRefreshing(true);

      try {

        await loadNotifications();

        if (
          typeof refreshUnreadCount ===
          'function'
        ) {

          await refreshUnreadCount();

        }

      } finally {

        setRefreshing(false);
      }

    }, [
      loadNotifications,
      refreshUnreadCount,
    ]);


  /* ==========================================================
     UPDATE READ LOCALLY
  ========================================================== */

  const updateNotificationAsRead =
    useCallback(
      (notificationId) => {

        setNotifications(
          (previous) =>
            previous.map(
              (item) => {

                const itemId =
                  getNotificationId(
                    item
                  );


                if (
                  String(itemId) ===
                  String(notificationId)
                ) {

                  return {
                    ...item,

                    is_read: true,
                    isRead: true,
                    read: true,

                    read_at:
                      item.read_at ??
                      new Date().toISOString(),
                  };

                }


                return item;

              }
            )
        );

      },
      []
    );


  /* ==========================================================
     NAVIGATION
  ========================================================== */

  const navigateFromNotification =
    useCallback(
      (notification) => {

        const action =
          resolveNotificationAction(
            notification
          );


        const bookingId =
          getBookingIdFromNotification(
            notification
          );


        const offerId =
          getOfferIdFromNotification(
            notification
          );


        console.log(
          '🔔 [THERAPIST NOTIFICATION]',
          {
            action,
            bookingId,
            offerId,
            type:
              notification?.type,
          }
        );


        /* ------------------------------------------------------
           NEGOTIATION
        ------------------------------------------------------ */

        if (
          action ===
          'negotiation'
        ) {

          /* Negotiation est un écran ROOT (hors Tab.Navigator,
             voir TherapistNavigator.js) depuis la correction du
             bug de changement d'onglet — on ne le cible donc
             plus via le stack imbriqué "Demandes". */
          navigation.navigate(
            'Negotiation',
            {
              bookingId,
              offerId,
              notification,
            }
          );

          return;
        }


        /* ------------------------------------------------------
           OFFER
        ------------------------------------------------------ */

        if (
          action ===
          'offer'
        ) {

          navigation.navigate(
            'Demandes',
            {
              screen:
                'Offer',

              params: {
                bookingId,
                offerId,
                notification,
              },
            }
          );

          return;
        }


        /* ------------------------------------------------------
           BOOKING — et repli pour TOUT type de notification liée
           à une réservation (paiement, système, SOS, type non
           reconnu, etc.)
           ------------------------------------------------------
           Dès qu'un bookingId est identifiable dans la
           notification, on ouvre directement la page
           src/screens/therapist/BookingDetailScreen.js (écran
           "BookingDetail" du stack "Calendrier"), même si le
           "type" de la notification n'a pas été reconnu comme
           'negotiation' ou 'offer' ci-dessus.
        ------------------------------------------------------ */

        if (bookingId) {

          navigation.navigate(
            'Calendrier',
            {
              screen:
                'BookingDetail',

              params: {
                bookingId,
              },
            }
          );

          return;
        }


        /* ------------------------------------------------------
           AUCUNE RÉSERVATION IDENTIFIABLE
           ------------------------------------------------------
           Ancien comportement : rien ne se passait (silencieux)
           pour les notifications 'system' / 'payment' / 'sos' ou
           tout type non reconnu ne portant pas de bookingId.
           On informe désormais la personne au lieu de laisser
           le bouton sembler ne rien faire.
        ------------------------------------------------------ */

        console.warn(
          '⚠️ Notification sans bookingId exploitable :',
          notification
        );

        showToast({
          type: 'info',
          title: 'Notification',
          message:
            "Cette notification n'est liée à aucune réservation à ouvrir.",
        });

      },
      [
        navigation,
        showToast,
      ]
    );


  /* ==========================================================
     PRESS NOTIFICATION
  ========================================================== */

  const handleNotificationPress =
    useCallback(
      async (notification) => {

        const notificationId =
          getNotificationId(
            notification
          );


        if (!notificationId) {

          navigateFromNotification(
            notification
          );

          return;
        }


        setReadingId(
          notificationId
        );


        try {

          const alreadyRead =
            isNotificationRead(
              notification
            );


          /* ----------------------------------------------------
             MARK AS READ
          ---------------------------------------------------- */

          if (!alreadyRead) {

            try {

              if (
                typeof markAsRead ===
                'function'
              ) {

                await markAsRead(
                  notificationId
                );

              }

            } catch (error) {

              console.warn(
                '⚠️ Impossible de marquer la notification comme lue:',
                error
              );

            }


            updateNotificationAsRead(
              notificationId
            );


            if (
              typeof refreshUnreadCount ===
              'function'
            ) {

              await refreshUnreadCount();

            }


            showToast({
              type: 'success',
              title: 'Notification lue',
              message:
                'La notification a été marquée comme lue.',
            });

          }


          navigateFromNotification(
            notification
          );

        } finally {

          setReadingId(
            null
          );

        }

      },
      [
        markAsRead,
        navigateFromNotification,
        refreshUnreadCount,
        showToast,
        updateNotificationAsRead,
      ]
    );


  /* ==========================================================
     DELETE
  ========================================================== */

  const performDeleteNotification =
    useCallback(
      async (notification) => {

        const notificationId =
          getNotificationId(
            notification
          );


        if (!notificationId) {

          showToast({
            type: 'error',
            title: 'Suppression impossible',
            message:
              'Cette notification ne possède pas d’identifiant valide.',
          });

          return;
        }


        setDeletingId(
          notificationId
        );

        setDeleteModalLoading(
          true
        );


        try {

          let result = null;


          /* ----------------------------------------------------
             DELETE NOTIFICATION
          ---------------------------------------------------- */

          if (
            typeof notificationService
              .deleteNotification ===
            'function'
          ) {

            result =
              await notificationService
                .deleteNotification(
                  notificationId
                );

          }

          else if (
            typeof notificationService
              .removeNotification ===
            'function'
          ) {

            result =
              await notificationService
                .removeNotification(
                  notificationId
                );

          }

          else if (
            typeof notificationService
              .delete ===
            'function'
          ) {

            result =
              await notificationService
                .delete(
                  notificationId
                );

          }

          else if (
            typeof notificationService
              .remove ===
            'function'
          ) {

            result =
              await notificationService
                .remove(
                  notificationId
                );

          }

          else {

            console.warn(
              '⚠️ Aucun endpoint de suppression disponible dans notificationService.js'
            );


            setDeleteModalLoading(
              false
            );

            closeDeleteModal();


            showToast({
              type: 'warning',
              title: 'Suppression indisponible',
              message:
                'La suppression des notifications n’est pas disponible dans le service actuel.',
              duration: 3200,
            });


            return;
          }


          /* ----------------------------------------------------
             VERIFY RESPONSE
          ---------------------------------------------------- */

          const success =
            result?.success === true ||
            (
              typeof result?.status ===
                'number' &&
              result.status >= 200 &&
              result.status < 300
            );


          if (!success) {

            throw new Error(
              result?.error ||
              'Suppression impossible'
            );

          }


          /* ----------------------------------------------------
             UPDATE UI
          ---------------------------------------------------- */

          setNotifications(
            (previous) =>
              previous.filter(
                (item) =>
                  String(
                    getNotificationId(
                      item
                    )
                  ) !==
                  String(
                    notificationId
                  )
              )
          );


          if (
            typeof refreshUnreadCount ===
            'function'
          ) {

            await refreshUnreadCount();

          }


          setDeleteModalLoading(
            false
          );


          closeDeleteModal();


          /* ----------------------------------------------------
             SUCCESS TOAST
          ---------------------------------------------------- */

          showToast({
            type: 'success',
            title: 'Notification supprimée',
            message:
              'La notification a été supprimée avec succès.',
          });


        } catch (error) {

          console.error(
            '❌ [Notifications] Suppression impossible:',
            error
          );


          setDeleteModalLoading(
            false
          );


          closeDeleteModal();


          showToast({
            type: 'error',
            title: 'Erreur',
            message:
              'Impossible de supprimer cette notification.',
            duration: 3200,
          });

        } finally {

          setDeletingId(
            null
          );

        }

      },
      [
        closeDeleteModal,
        refreshUnreadCount,
        showToast,
      ]
    );


  /* ==========================================================
     HANDLE OPEN OPTIONS (⋮ sur une notification)
  ========================================================== */

  const handleOpenNotificationOptions =
    useCallback(
      (notification) => {

        openOptionsSheet(
          notification
        );

      },
      [
        openOptionsSheet,
      ]
    );


  /* ==========================================================
     SHEET ACTION : SUPPRIMER
     (ferme le sheet puis ouvre la modale de confirmation
     existante)
  ========================================================== */

  const handleSheetDeletePress =
    useCallback(
      () => {

        const target =
          notificationForOptions;

        closeOptionsSheet(
          () => {

            if (target) {
              openDeleteModal(
                target
              );
            }

          }
        );

      },
      [
        closeOptionsSheet,
        notificationForOptions,
        openDeleteModal,
      ]
    );


  /* ==========================================================
     SHEET ACTION : DÉSACTIVER LA NOTIFICATION
     Désactive les notifications de ce type (catégorie) via
     les préférences du compte.
  ========================================================== */

  const handleSheetDisablePress =
    useCallback(
      async () => {

        const target =
          notificationForOptions;

        if (!target) {
          closeOptionsSheet();
          return;
        }

        const category =
          resolveCategory(
            target?.type ||
            target?.notification_type
          );

        const categoryLabel =
          CATEGORY_LABELS[
            category
          ] || 'ce type';

        setDisablingTypeLoading(
          true
        );

        try {

          const result =
            await notificationService.updatePreferences(
              {
                [`${category}_enabled`]: false,
              }
            );

          if (
            result?.success
          ) {

            showToast({
              type: 'success',
              title: 'Notifications désactivées',
              message: `Vous ne recevrez plus de notifications « ${categoryLabel} ».`,
            });

          } else {

            showToast({
              type: 'error',
              title: 'Erreur',
              message:
                result?.error ||
                'Impossible de désactiver ces notifications.',
            });

          }

        } catch (error) {

          showToast({
            type: 'error',
            title: 'Erreur',
            message:
              error?.message ||
              'Impossible de désactiver ces notifications.',
          });

        } finally {

          setDisablingTypeLoading(
            false
          );

          closeOptionsSheet();

        }

      },
      [
        closeOptionsSheet,
        notificationForOptions,
        showToast,
      ]
    );


  /* ==========================================================
     MARK ALL READ
  ========================================================== */

  const handleMarkAllRead =
    useCallback(
      async () => {

        if (
          !notifications.length
        ) {

          showToast({
            type: 'warning',
            title: 'Notifications',
            message:
              'Aucune notification à marquer comme lue.',
          });

          return;
        }


        try {

          if (
            typeof markAllAsRead ===
            'function'
          ) {

            await markAllAsRead();

          }


          /* ----------------------------------------------------
             KEEP ALL NOTIFICATIONS
          ---------------------------------------------------- */

          setNotifications(
            (previous) =>
              previous.map(
                (item) => ({
                  ...item,

                  is_read:
                    true,

                  isRead:
                    true,

                  read:
                    true,
                })
              )
          );


          if (
            typeof refreshUnreadCount ===
            'function'
          ) {

            await refreshUnreadCount();

          }


          showToast({
            type: 'success',
            title: 'Notifications mises à jour',
            message:
              'Toutes les notifications sont maintenant lues.',
          });


        } catch (error) {

          console.error(
            '❌ Mark all read:',
            error
          );


          showToast({
            type: 'error',
            title: 'Erreur',
            message:
              'Impossible de marquer toutes les notifications comme lues.',
            duration: 3200,
          });

        }

      },
      [
        markAllAsRead,
        notifications.length,
        refreshUnreadCount,
        showToast,
      ]
    );


  /* ==========================================================
     ICON
  ========================================================== */

  const getIcon =
    useCallback(
      (type) => {

        const category =
          resolveCategory(
            type
          );


        const map = {

          booking:
            'calendar-outline',

          offer:
            'pricetag-outline',

          payment:
            'card-outline',

          system:
            'information-circle-outline',

          sos:
            'alert-circle-outline',

        };


        return (
          map[category] ||
          'notifications-outline'
        );

      },
      []
    );


  /* ==========================================================
     COLOR
  ========================================================== */

  const getColor =
    useCallback(
      (type) => {

        const category =
          resolveCategory(
            type
          );


        const map = {

          booking:
            '#4CAF50',

          offer:
            '#FF9800',

          payment:
            '#2196F3',

          system:
            '#757575',

          sos:
            '#D32F2F',

        };


        return (
          map[category] ||
          '#757575'
        );

      },
      []
    );


  /* ==========================================================
     FILTER + SORT
  ========================================================== */

  const filteredNotifications =
    useMemo(() => {

      const result =
        notifications.filter(
          (item) => {

            if (
              selectedFilter ===
              'all'
            ) {

              return true;

            }


            return (
              resolveCategory(
                item?.type ||
                item?.notification_type
              ) ===
              selectedFilter
            );

          }
        );


      result.sort(
        (a, b) =>
          getNotificationTimestamp(
            b
          ) -
          getNotificationTimestamp(
            a
          )
      );


      return result;

    }, [
      notifications,
      selectedFilter,
      currentTime,
    ]);


  /* ==========================================================
     RENDER NOTIFICATION
  ========================================================== */

  const renderNotification =
    useCallback(
      ({ item, index }) => {

        const notificationId =
          getNotificationId(
            item
          );


        const read =
          isNotificationRead(
            item
          );


        const icon =
          getIcon(
            item?.type ||
            item?.notification_type
          );


        const color =
          getColor(
            item?.type ||
            item?.notification_type
          );


        const action =
          resolveNotificationAction(
            item
          );


        const time =
          formatTimeAgo(
            item?.created_at
          );


        const isDeleting =
          String(deletingId) ===
          String(notificationId);


        const isReading =
          String(readingId) ===
          String(notificationId);


        const title =
          safeText(
            item?.title,
            'Notification'
          );


        const body =
          safeText(
            item?.body ||
            item?.message ||
            item?.description,
            ''
          );


        return (
          <Animatable.View
            animation="fadeInUp"
            duration={350}
            delay={Math.min(
              index * 40,
              300
            )}
            style={
              styles.animationWrapper
            }
          >

            <View
              style={[
                styles.notificationCard,

                {
                  backgroundColor:
                    themeColors.surface,

                  borderColor:
                    isDark
                      ? 'rgba(255,255,255,0.06)'
                      : '#ECECEC',
                },

                !read && {
                  borderLeftColor:
                    colors.primary,

                  borderLeftWidth: 4,
                },
              ]}
            >

              {/* ==================================================
                  ICON
              ================================================== */}

              <TouchableOpacity
                style={
                  styles.iconTouchable
                }
                activeOpacity={0.8}
                onPress={() =>
                  handleNotificationPress(
                    item
                  )
                }
                disabled={
                  isReading ||
                  isDeleting
                }
              >

                <View
                  style={[
                    styles.notificationIcon,
                    {
                      backgroundColor:
                        `${color}18`,
                    },
                  ]}
                >

                  <Ionicons
                    name={icon}
                    size={23}
                    color={color}
                  />

                </View>

              </TouchableOpacity>


              {/* ==================================================
                  CONTENT
              ================================================== */}

              <TouchableOpacity
                style={
                  styles.notificationContent
                }
                activeOpacity={0.75}
                onPress={() =>
                  handleNotificationPress(
                    item
                  )
                }
                disabled={
                  isReading ||
                  isDeleting
                }
              >

                {/* HEADER */}

                <View
                  style={
                    styles.notificationHeader
                  }
                >

                  <View
                    style={
                      styles.titleContainer
                    }
                  >

                    <Text
                      numberOfLines={2}
                      style={[
                        styles.notificationTitle,

                        {
                          color:
                            themeColors.text,
                        },

                        !read &&
                          styles.unreadTitle,
                      ]}
                    >
                      {title}
                    </Text>


                    {/* NON LUE */}

                    {!read && (
                      <View
                        style={[
                          styles.newBadge,

                          {
                            backgroundColor:
                              `${colors.primary}18`,
                          },
                        ]}
                      >

                        <View
                          style={[
                            styles.newBadgeDot,

                            {
                              backgroundColor:
                                colors.primary,
                            },
                          ]}
                        />


                        <Text
                          style={[
                            styles.newBadgeText,

                            {
                              color:
                                colors.primary,
                            },
                          ]}
                        >
                          NON LUE
                        </Text>

                      </View>
                    )}

                  </View>


                  {/* TIME */}

                  <Text
                    style={[
                      styles.notificationTime,

                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    {time}
                  </Text>

                </View>


                {/* BODY */}

                {!!body && (
                  <Text
                    style={[
                      styles.notificationBody,

                      {
                        color:
                          themeColors.textSecondary,
                      },
                    ]}
                  >
                    {body}
                  </Text>
                )}


                {/* NEGOTIATION */}

                {action ===
                  'negotiation' && (
                  <View
                    style={[
                      styles.actionHint,

                      {
                        backgroundColor:
                          `${color}10`,
                      },
                    ]}
                  >

                    <Ionicons
                      name="swap-horizontal-outline"
                      size={15}
                      color={color}
                    />

                    <Text
                      style={[
                        styles.actionHintText,
                        {
                          color:
                            color,
                        },
                      ]}
                    >
                      Ouvrir la négociation
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={15}
                      color={color}
                    />

                  </View>
                )}


                {/* OFFER */}

                {action ===
                  'offer' && (
                  <View
                    style={[
                      styles.actionHint,

                      {
                        backgroundColor:
                          `${color}10`,
                      },
                    ]}
                  >

                    <Ionicons
                      name="pricetag-outline"
                      size={15}
                      color={color}
                    />

                    <Text
                      style={[
                        styles.actionHintText,
                        {
                          color:
                            color,
                        },
                      ]}
                    >
                      Voir l'offre
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={15}
                      color={color}
                    />

                  </View>
                )}


                {/* BOOKING */}

                {action ===
                  'booking' && (
                  <View
                    style={[
                      styles.actionHint,

                      {
                        backgroundColor:
                          `${color}10`,
                      },
                    ]}
                  >

                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color={color}
                    />

                    <Text
                      style={[
                        styles.actionHintText,
                        {
                          color:
                            color,
                        },
                      ]}
                    >
                      Voir la réservation
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={15}
                      color={color}
                    />

                  </View>
                )}

              </TouchableOpacity>


              {/* ==================================================
                  OPTIONS BUTTON (⋮)
              ================================================== */}

              <TouchableOpacity
                style={
                  styles.optionsButton
                }
                onPress={() =>
                  handleOpenNotificationOptions(
                    item
                  )
                }
                activeOpacity={0.5}
                hitSlop={{
                  top: 8,
                  bottom: 8,
                  left: 8,
                  right: 8,
                }}
                disabled={
                  isDeleting ||
                  isReading
                }
              >

                {isDeleting ? (

                  <ActivityIndicator
                    size="small"
                    color="#D32F2F"
                  />

                ) : (

                  <Ionicons
                    name="ellipsis-vertical"
                    size={18}
                    color={
                      isDark
                        ? '#C7CBD1'
                        : '#5B6472'
                    }
                  />

                )}

              </TouchableOpacity>


              {/* READING INDICATOR */}

              {isReading && (
                <View
                  style={
                    styles.readingOverlay
                  }
                >

                  <ActivityIndicator
                    size="small"
                    color={
                      colors.primary
                    }
                  />

                </View>
              )}

            </View>

          </Animatable.View>
        );

      },
      [
        colors.primary,
        deletingId,
        getColor,
        getIcon,
        handleOpenNotificationOptions,
        handleNotificationPress,
        isDark,
        readingId,
        themeColors.surface,
        themeColors.text,
        themeColors.textSecondary,
      ]
    );


  /* ==========================================================
     EMPTY STATE
  ========================================================== */

  const renderEmptyState =
    useCallback(() => {

      const filterLabel =
        filters.find(
          (item) =>
            item.id ===
            selectedFilter
        )?.label ||
        'notifications';


      return (
        <View
          style={
            styles.emptyState
          }
        >

          <View
            style={[
              styles.emptyIconContainer,

              {
                backgroundColor:
                  `${colors.primary}12`,
              },
            ]}
          >

            <Ionicons
              name={
                selectedFilter ===
                'all'
                  ? 'notifications-off-outline'
                  : 'filter-outline'
              }
              size={52}
              color={
                colors.primary
              }
            />

          </View>


          <Text
            style={[
              styles.emptyStateTitle,

              {
                color:
                  themeColors.text,
              },
            ]}
          >
            Aucune notification
          </Text>


          <Text
            style={[
              styles.emptyStateText,

              {
                color:
                  themeColors.textSecondary,
              },
            ]}
          >
            {selectedFilter ===
            'all'
              ? 'Vous serez informé des nouvelles activités ici.'
              : `Aucune notification dans « ${filterLabel} ».`}
          </Text>

        </View>
      );

    }, [
      colors.primary,
      filters,
      selectedFilter,
      themeColors.text,
      themeColors.textSecondary,
    ]);


  /* ==========================================================
     LOADING
  ========================================================== */

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
          title="Notifications"
          showBack
        />


        <View
          style={
            styles.loadingContainer
          }
        >

          <View
            style={[
              styles.loadingIconContainer,

              {
                backgroundColor:
                  `${colors.primary}12`,
              },
            ]}
          >

            <Ionicons
              name="notifications-outline"
              size={38}
              color={
                colors.primary
              }
            />

          </View>


          <ActivityIndicator
            size="large"
            color={
              colors.primary
            }
            style={
              styles.loader
            }
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
            Chargement des notifications...
          </Text>

        </View>

      </View>
    );
  }


  /* ==========================================================
     TOAST COLORS / ICON
  ========================================================== */

  const getToastConfig = () => {

    switch (toast.type) {

      case 'error':
        return {
          icon: 'close-circle',
          iconColor: '#D32F2F',
          background:
            isDark
              ? '#35191B'
              : '#FFFFFF',
          accent: '#D32F2F',
        };


      case 'warning':
        return {
          icon: 'warning',
          iconColor: '#F57C00',
          background:
            isDark
              ? '#352815'
              : '#FFFFFF',
          accent: '#F57C00',
        };


      case 'info':
        return {
          icon: 'information-circle',
          iconColor: '#1976D2',
          background:
            isDark
              ? '#172B3D'
              : '#FFFFFF',
          accent: '#1976D2',
        };


      default:
        return {
          icon: 'checkmark-circle',
          iconColor: '#2E7D32',
          background:
            isDark
              ? '#172D20'
              : '#FFFFFF',
          accent: '#2E7D32',
        };

    }

  };


  const toastConfig =
    getToastConfig();


  /* ==========================================================
     MAIN
  ========================================================== */

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

      {/* ========================================================
          HEADER
      ======================================================== */}

      <Header
        title="Notifications"
        showBack

        rightComponent={
          unreadCount > 0 ? (

            <TouchableOpacity
              onPress={
                handleMarkAllRead
              }
              style={[
                styles.markAllButton,

                {
                  backgroundColor:
                    `${colors.primary}12`,

                  borderColor:
                    `${colors.primary}25`,
                },
              ]}
              activeOpacity={0.75}
            >

              <Ionicons
                name="checkmark-done-outline"
                size={17}
                color={
                  colors.primary
                }
              />


              <Text
                style={[
                  styles.markAllText,

                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                Tout lire
              </Text>

            </TouchableOpacity>

          ) : null
        }
      />


      {/* ========================================================
          SUMMARY
      ======================================================== */}

      <View
        style={[
          styles.summaryContainer,

          {
            backgroundColor:
              themeColors.surface,

            borderBottomColor:
              isDark
                ? 'rgba(255,255,255,0.06)'
                : '#ECECEC',
          },
        ]}
      >

        <View
          style={
            styles.summaryLeft
          }
        >

          <View
            style={[
              styles.summaryIcon,

              {
                backgroundColor:
                  `${colors.primary}12`,
              },
            ]}
          >

            <Ionicons
              name="notifications"
              size={19}
              color={
                colors.primary
              }
            />

          </View>


          <View>

            <Text
              style={[
                styles.summaryTitle,

                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Vos notifications
            </Text>


            <Text
              style={[
                styles.summarySubtitle,

                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              {notifications.length}{' '}
              notification
              {notifications.length !==
              1
                ? 's'
                : ''}
            </Text>

          </View>

        </View>


        {unreadCount > 0 && (

          <View
            style={[
              styles.unreadCountBadge,

              {
                backgroundColor:
                  colors.primary,
              },
            ]}
          >

            <Text
              style={
                styles.unreadCountText
              }
            >
              {unreadCount}
            </Text>


            <Text
              style={
                styles.unreadCountLabel
              }
            >
              non lue
              {unreadCount > 1
                ? 's'
                : ''}
            </Text>

          </View>

        )}

      </View>


      {/* ========================================================
          FILTERS
      ======================================================== */}

      <View
        style={[
          styles.filtersContainer,

          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filtersContent
          }
        >

          {filters.map(
            (filter) => {

              const active =
                selectedFilter ===
                filter.id;


              return (
                <TouchableOpacity
                  key={
                    filter.id
                  }

                  style={[
                    styles.filterButton,

                    {
                      backgroundColor:
                        active
                          ? colors.primary
                          : themeColors.surface,

                      borderColor:
                        active
                          ? colors.primary
                          : isDark
                            ? 'rgba(255,255,255,0.08)'
                            : '#E4E4E4',
                    },
                  ]}

                  onPress={() =>
                    setSelectedFilter(
                      filter.id
                    )
                  }

                  activeOpacity={0.75}
                >

                  <Ionicons
                    name={
                      filter.icon
                    }
                    size={16}
                    color={
                      active
                        ? '#FFFFFF'
                        : themeColors.textSecondary
                    }
                  />


                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.filterText,

                      {
                        color:
                          active
                            ? '#FFFFFF'
                            : themeColors.text,
                      },
                    ]}
                  >
                    {filter.label}
                  </Text>

                </TouchableOpacity>
              );

            }
          )}

        </ScrollView>

      </View>


      {/* ========================================================
          LIST
      ======================================================== */}

      <Animated.View
        style={[
          styles.listContainer,

          {
            opacity:
              fadeAnim,
          },
        ]}
      >

        {filteredNotifications.length >
        0 ? (

          <FlatList
            data={
              filteredNotifications
            }

            renderItem={
              renderNotification
            }

            keyExtractor={(
              item,
              index
            ) =>
              String(
                getNotificationId(
                  item
                ) ??
                  `notification-${index}`
              )
            }

            contentContainerStyle={
              styles.listContent
            }

            showsVerticalScrollIndicator={
              false
            }

            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }

                onRefresh={
                  onRefresh
                }

                colors={[
                  colors.primary,
                ]}

                tintColor={
                  colors.primary
                }
              />
            }

            ListHeaderComponent={
              <View
                style={
                  styles.listHeader
                }
              >

                <View
                  style={
                    styles.listHeaderLine
                  }
                />


                <Text
                  style={[
                    styles.listHeaderText,

                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Plus récentes
                </Text>


                <View
                  style={
                    styles.listHeaderLine
                  }
                />

              </View>
            }


            ListFooterComponent={
              <View
                style={
                  styles.listFooter
                }
              >

                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={
                    themeColors.textSecondary
                  }
                />


                <Text
                  style={[
                    styles.listFooterText,

                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  Fin des notifications
                </Text>

              </View>
            }
          />

        ) : (

          <ScrollView
            contentContainerStyle={
              styles.emptyScrollContent
            }

            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }

                onRefresh={
                  onRefresh
                }

                colors={[
                  colors.primary,
                ]}

                tintColor={
                  colors.primary
                }
              />
            }

            showsVerticalScrollIndicator={
              false
            }
          >

            {renderEmptyState()}

          </ScrollView>

        )}

      </Animated.View>


      {/* ========================================================
          NOTIFICATION OPTIONS BOTTOM SHEET (⋮)
      ======================================================== */}

      <Modal
        visible={
          optionsVisible
        }
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() =>
          closeOptionsSheet()
        }
      >

        <Animated.View
          style={[
            styles.sheetOverlay,

            {
              opacity:
                sheetBackdropOpacity,
            },
          ]}
        >

          <TouchableOpacity
            style={
              StyleSheet.absoluteFill
            }
            activeOpacity={1}
            onPress={() =>
              closeOptionsSheet()
            }
          />

        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,

            {
              backgroundColor:
                themeColors.surface,

              paddingBottom:
                Math.max(
                  insets.bottom,
                  16
                ) + 14,

              transform: [
                {
                  translateY:
                    sheetTranslateY,
                },
              ],
            },
          ]}
        >

          <View
            style={[
              styles.sheetHandle,

              {
                backgroundColor:
                  isDark
                    ? 'rgba(255,255,255,0.18)'
                    : '#DEDEE2',
              },
            ]}
          />


          {/* NOTIFICATION PREVIEW */}

          {notificationForOptions && (
            <View
              style={
                styles.sheetPreview
              }
            >

              <View
                style={[
                  styles.sheetPreviewIcon,

                  {
                    backgroundColor: `${getColor(
                      notificationForOptions?.type ||
                      notificationForOptions?.notification_type
                    )}18`,
                  },
                ]}
              >

                <Ionicons
                  name={getIcon(
                    notificationForOptions?.type ||
                    notificationForOptions?.notification_type
                  )}
                  size={20}
                  color={getColor(
                    notificationForOptions?.type ||
                    notificationForOptions?.notification_type
                  )}
                />

              </View>

              <Text
                numberOfLines={2}
                style={[
                  styles.sheetPreviewText,

                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                {safeText(
                  notificationForOptions?.title,
                  'Notification'
                )}
              </Text>

            </View>
          )}


          <View
            style={[
              styles.sheetDivider,

              {
                backgroundColor:
                  isDark
                    ? 'rgba(255,255,255,0.08)'
                    : '#ECECEC',
              },
            ]}
          />


          {/* OPTION : SUPPRIMER */}

          <TouchableOpacity
            style={
              styles.sheetOption
            }
            activeOpacity={0.7}
            onPress={
              handleSheetDeletePress
            }
          >

            <View
              style={[
                styles.sheetOptionIcon,

                {
                  backgroundColor:
                    isDark
                      ? 'rgba(211,47,47,0.14)'
                      : '#FFF1F1',
                },
              ]}
            >

              <Ionicons
                name="trash-outline"
                size={19}
                color="#D32F2F"
              />

            </View>

            <View
              style={
                styles.sheetOptionTextWrap
              }
            >

              <Text
                style={[
                  styles.sheetOptionTitle,

                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Supprimer la notification
              </Text>

              <Text
                style={[
                  styles.sheetOptionSubtitle,

                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Elle sera définitivement supprimée
              </Text>

            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                themeColors.textSecondary
              }
            />

          </TouchableOpacity>


          {/* OPTION : DÉSACTIVER */}

          <TouchableOpacity
            style={
              styles.sheetOption
            }
            activeOpacity={0.7}
            onPress={
              handleSheetDisablePress
            }
            disabled={
              disablingTypeLoading
            }
          >

            <View
              style={[
                styles.sheetOptionIcon,

                {
                  backgroundColor:
                    isDark
                      ? 'rgba(117,117,117,0.18)'
                      : '#F0F1F3',
                },
              ]}
            >

              {disablingTypeLoading ? (

                <ActivityIndicator
                  size="small"
                  color="#757575"
                />

              ) : (

                <Ionicons
                  name="notifications-off-outline"
                  size={19}
                  color="#757575"
                />

              )}

            </View>

            <View
              style={
                styles.sheetOptionTextWrap
              }
            >

              <Text
                style={[
                  styles.sheetOptionTitle,

                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                Désactiver la notification
              </Text>

              <Text
                style={[
                  styles.sheetOptionSubtitle,

                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Vous ne recevrez plus ce type de notification
              </Text>

            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                themeColors.textSecondary
              }
            />

          </TouchableOpacity>


          {/* ANNULER */}

          <TouchableOpacity
            style={[
              styles.sheetCancelButton,

              {
                backgroundColor:
                  isDark
                    ? 'rgba(255,255,255,0.06)'
                    : '#F2F2F2',
              },
            ]}
            activeOpacity={0.75}
            onPress={() =>
              closeOptionsSheet()
            }
          >

            <Text
              style={[
                styles.sheetCancelText,

                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Annuler
            </Text>

          </TouchableOpacity>

        </Animated.View>

      </Modal>


      {/* ========================================================
          DELETE CONFIRMATION MODAL
      ======================================================== */}

      <Modal
        visible={
          deleteModalVisible
        }
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={
          closeDeleteModal
        }
      >

        <View
          style={
            styles.modalOverlay
          }
        >

          <Animated.View
            style={[
              styles.confirmModal,

              {
                backgroundColor:
                  themeColors.surface,

                opacity:
                  modalOpacity,

                transform: [
                  {
                    scale:
                      modalScale,
                  },
                ],
              },
            ]}
          >

            {/* ICON */}

            <View
              style={[
                styles.confirmIconContainer,

                {
                  backgroundColor:
                    isDark
                      ? 'rgba(211,47,47,0.14)'
                      : '#FFF1F1',
                },
              ]}
            >

              <Ionicons
                name="trash-outline"
                size={30}
                color="#D32F2F"
              />

            </View>


            {/* TITLE */}

            <Text
              style={[
                styles.confirmTitle,

                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Supprimer la notification ?
            </Text>


            {/* MESSAGE */}

            <Text
              style={[
                styles.confirmMessage,

                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              Voulez-vous vraiment supprimer cette notification ?
            </Text>


            {/* NOTIFICATION NAME */}

            {notificationToDelete && (
              <View
                style={[
                  styles.confirmNotificationPreview,

                  {
                    backgroundColor:
                      isDark
                        ? 'rgba(255,255,255,0.04)'
                        : '#F7F7F7',

                    borderColor:
                      isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#ECECEC',
                  },
                ]}
              >

                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color={
                    colors.primary
                  }
                />


                <Text
                  numberOfLines={2}
                  style={[
                    styles.confirmNotificationText,

                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  {safeText(
                    notificationToDelete?.title,
                    'Notification'
                  )}
                </Text>

              </View>
            )}


            {/* BUTTONS */}

            <View
              style={
                styles.confirmButtons
              }
            >

              {/* ANNULER */}

              <TouchableOpacity
                style={[
                  styles.confirmCancelButton,

                  {
                    backgroundColor:
                      isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#F2F2F2',

                    borderColor:
                      isDark
                        ? 'rgba(255,255,255,0.08)'
                        : '#E4E4E4',
                  },
                ]}
                onPress={
                  closeDeleteModal
                }
                disabled={
                  deleteModalLoading
                }
                activeOpacity={0.75}
              >

                <Text
                  style={[
                    styles.confirmCancelText,

                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Annuler
                </Text>

              </TouchableOpacity>


              {/* SUPPRIMER */}

              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,

                  {
                    opacity:
                      deleteModalLoading
                        ? 0.7
                        : 1,
                  },
                ]}
                onPress={() =>
                  performDeleteNotification(
                    notificationToDelete
                  )
                }
                disabled={
                  deleteModalLoading ||
                  !notificationToDelete
                }
                activeOpacity={0.8}
              >

                {deleteModalLoading ? (

                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                ) : (

                  <>

                    <Ionicons
                      name="trash-outline"
                      size={17}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.confirmDeleteText
                      }
                    >
                      Supprimer
                    </Text>

                  </>

                )}

              </TouchableOpacity>

            </View>

          </Animated.View>

        </View>

      </Modal>


      {/* ========================================================
          CENTRAL TOAST
      ======================================================== */}

      {toast.visible && (

        <View
          pointerEvents="box-none"
          style={
            styles.toastLayer
          }
        >

          <Animated.View
            style={[
              styles.toastContainer,

              {
                backgroundColor:
                  toastConfig.background,

                borderLeftColor:
                  toastConfig.accent,

                opacity:
                  toastOpacity,

                transform: [
                  {
                    translateY:
                      toastTranslateY,
                  },
                ],
              },
            ]}
          >

            {/* ICON */}

            <View
              style={[
                styles.toastIconContainer,

                {
                  backgroundColor:
                    `${toastConfig.iconColor}15`,
                },
              ]}
            >

              <Ionicons
                name={
                  toastConfig.icon
                }
                size={25}
                color={
                  toastConfig.iconColor
                }
              />

            </View>


            {/* CONTENT */}

            <View
              style={
                styles.toastContent
              }
            >

              {!!toast.title && (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.toastTitle,

                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  {toast.title}
                </Text>
              )}


              {!!toast.message && (
                <Text
                  numberOfLines={3}
                  style={[
                    styles.toastMessage,

                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {toast.message}
                </Text>
              )}

            </View>


            {/* CLOSE */}

            <TouchableOpacity
              style={
                styles.toastClose
              }
              onPress={
                hideToast
              }
              activeOpacity={0.7}
            >

              <Ionicons
                name="close"
                size={19}
                color={
                  themeColors.textSecondary
                }
              />

            </TouchableOpacity>

          </Animated.View>

        </View>

      )}

    </View>
  );
};


/* ============================================================
   STYLES
============================================================ */

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
    },


    /* ==========================================================
       HEADER
    ========================================================== */

    markAllButton: {
      minHeight: 34,

      paddingHorizontal: 10,
      paddingVertical: 6,

      borderRadius: 10,
      borderWidth: 1,

      flexDirection: 'row',
      alignItems: 'center',

      gap: 5,
    },


    markAllText: {
      fontSize:
        typography.fontSize.xs,

      fontFamily:
        typography.fontFamily.semiBold,
    },


    /* ==========================================================
       SUMMARY
    ========================================================== */

    summaryContainer: {
      minHeight: 68,

      paddingHorizontal:
        spacing.md,

      paddingVertical: 10,

      borderBottomWidth: 1,

      flexDirection: 'row',
      alignItems: 'center',

      justifyContent:
        'space-between',
    },


    summaryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    summaryIcon: {
      width: 38,
      height: 38,

      borderRadius: 12,

      alignItems: 'center',
      justifyContent: 'center',

      marginRight: 10,
    },


    summaryTitle: {
      fontSize:
        typography.fontSize.md,

      fontFamily:
        typography.fontFamily.semiBold,
    },


    summarySubtitle: {
      marginTop: 2,

      fontSize:
        typography.fontSize.xs,

      fontFamily:
        typography.fontFamily.regular,
    },


    unreadCountBadge: {
      minWidth: 74,

      paddingHorizontal: 10,
      paddingVertical: 6,

      borderRadius: 12,

      alignItems: 'center',
      justifyContent: 'center',
    },


    unreadCountText: {
      color: '#FFFFFF',

      fontSize: 16,

      fontFamily:
        typography.fontFamily.bold,
    },


    unreadCountLabel: {
      color: '#FFFFFF',

      fontSize: 9,

      marginTop: 1,

      fontFamily:
        typography.fontFamily.medium,
    },


    /* ==========================================================
       FILTERS
    ========================================================== */

    filtersContainer: {
      paddingVertical: 10,
    },


    filtersContent: {
      paddingHorizontal:
        spacing.md,
    },


    filterButton: {
      height: 38,

      minWidth: 92,

      paddingHorizontal: 13,

      borderRadius: 20,

      marginRight: 8,

      borderWidth: 1,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',

      gap: 6,
    },


    filterText: {
      fontSize:
        typography.fontSize.sm,

      fontFamily:
        typography.fontFamily.medium,

      flexShrink: 0,
    },


    /* ==========================================================
       LIST
    ========================================================== */

    listContainer: {
      flex: 1,
    },


    listContent: {
      paddingHorizontal:
        spacing.md,

      paddingTop: 4,

      paddingBottom: 30,
    },


    animationWrapper: {
      marginBottom: 9,
    },


    listHeader: {
      flexDirection: 'row',

      alignItems: 'center',

      paddingVertical: 8,

      gap: 8,
    },


    listHeaderLine: {
      height: 1,

      flex: 1,

      backgroundColor:
        '#E2E2E2',
    },


    listHeaderText: {
      fontSize: 10,

      textTransform:
        'uppercase',

      letterSpacing: 0.7,

      fontFamily:
        typography.fontFamily.semiBold,
    },


    listFooter: {
      flexDirection: 'row',

      justifyContent:
        'center',

      alignItems: 'center',

      gap: 6,

      paddingVertical: 20,
    },


    listFooterText: {
      fontSize:
        typography.fontSize.xs,

      fontFamily:
        typography.fontFamily.regular,
    },


    /* ==========================================================
       NOTIFICATION CARD
    ========================================================== */

    notificationCard: {
      minHeight: 92,

      borderRadius: 16,

      borderWidth: 1,

      padding: 11,

      flexDirection: 'row',

      alignItems: 'flex-start',

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.04,

      shadowRadius: 6,

      elevation: 1,

      position: 'relative',
    },


    iconTouchable: {
      marginRight: 10,
    },


    notificationIcon: {
      width: 44,
      height: 44,

      borderRadius: 14,

      alignItems: 'center',
      justifyContent: 'center',
    },


    notificationContent: {
      flex: 1,

      minWidth: 0,

      paddingRight: 5,
    },


    notificationHeader: {
      flexDirection: 'row',

      alignItems: 'flex-start',

      justifyContent:
        'space-between',
    },


    titleContainer: {
      flex: 1,

      minWidth: 0,

      paddingRight: 6,
    },


    notificationTitle: {
      fontSize:
        typography.fontSize.md,

      lineHeight: 20,

      fontFamily:
        typography.fontFamily.medium,
    },


    unreadTitle: {
      fontFamily:
        typography.fontFamily.semiBold,
    },


    notificationTime: {
      fontSize: 11,

      lineHeight: 18,

      fontFamily:
        typography.fontFamily.medium,

      textAlign: 'right',

      minWidth: 50,

      marginLeft: 4,
    },


    notificationBody: {
      fontSize:
        typography.fontSize.sm,

      lineHeight: 20,

      marginTop: 3,

      fontFamily:
        typography.fontFamily.regular,
    },


    /* ==========================================================
       NEW BADGE
    ========================================================== */

    newBadge: {
      alignSelf: 'flex-start',

      marginTop: 5,

      paddingHorizontal: 7,
      paddingVertical: 3,

      borderRadius: 6,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 4,
    },


    newBadgeDot: {
      width: 5,
      height: 5,

      borderRadius: 3,
    },


    newBadgeText: {
      fontSize: 8,

      letterSpacing: 0.4,

      fontFamily:
        typography.fontFamily.bold,
    },


    /* ==========================================================
       ACTION HINT
    ========================================================== */

    actionHint: {
      alignSelf: 'flex-start',

      marginTop: 8,

      paddingHorizontal: 8,
      paddingVertical: 5,

      borderRadius: 8,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 5,
    },


    actionHintText: {
      fontSize: 10,

      fontFamily:
        typography.fontFamily.semiBold,
    },


    /* ==========================================================
       OPTIONS BUTTON (⋮)
    ========================================================== */

    optionsButton: {
      width: 32,
      height: 32,

      marginLeft: 5,

      backgroundColor: 'transparent',

      alignItems: 'center',
      justifyContent: 'center',
    },


    /* ==========================================================
       OPTIONS BOTTOM SHEET
    ========================================================== */

    sheetOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },

    sheetContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,

      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,

      paddingHorizontal: 20,
      paddingTop: 12,

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: -4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 18,
      elevation: 24,
    },

    sheetHandle: {
      width: 42,
      height: 5,
      borderRadius: 3,
      alignSelf: 'center',
      marginBottom: 16,
    },

    sheetPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },

    sheetPreviewIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sheetPreviewText: {
      flex: 1,
      fontSize: 13.5,
      lineHeight: 19,
      fontFamily:
        typography.fontFamily.semiBold,
    },

    sheetDivider: {
      height: 1,
      marginBottom: 6,
    },

    sheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingVertical: 12,
    },

    sheetOptionIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sheetOptionTextWrap: {
      flex: 1,
    },

    sheetOptionTitle: {
      fontSize: 14,
      marginBottom: 2,
      fontFamily:
        typography.fontFamily.semiBold,
    },

    sheetOptionSubtitle: {
      fontSize: 11.5,
      fontFamily:
        typography.fontFamily.regular,
    },

    sheetCancelButton: {
      marginTop: 8,
      height: 49,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sheetCancelText: {
      fontSize: 14,
      fontFamily:
        typography.fontFamily.semiBold,
    },


    /* ==========================================================
       READING
    ========================================================== */

    readingOverlay: {
      position: 'absolute',

      right: 48,

      top: 14,
    },


    /* ==========================================================
       LOADING
    ========================================================== */

    loadingContainer: {
      flex: 1,

      alignItems: 'center',
      justifyContent: 'center',

      padding: spacing.xl,
    },


    loadingIconContainer: {
      width: 76,
      height: 76,

      borderRadius: 24,

      alignItems: 'center',
      justifyContent: 'center',
    },


    loader: {
      marginTop: 20,
    },


    loadingText: {
      marginTop: 12,

      fontSize:
        typography.fontSize.sm,

      fontFamily:
        typography.fontFamily.regular,
    },


    /* ==========================================================
       EMPTY
    ========================================================== */

    emptyScrollContent: {
      flexGrow: 1,
    },


    emptyState: {
      flex: 1,

      minHeight: 420,

      alignItems: 'center',
      justifyContent: 'center',

      paddingHorizontal:
        spacing.xl,
    },


    emptyIconContainer: {
      width: 92,
      height: 92,

      borderRadius: 30,

      alignItems: 'center',
      justifyContent: 'center',
    },


    emptyStateTitle: {
      fontSize:
        typography.fontSize.lg,

      fontFamily:
        typography.fontFamily.bold,

      marginTop: 18,
    },


    emptyStateText: {
      fontSize:
        typography.fontSize.sm,

      lineHeight: 21,

      textAlign: 'center',

      marginTop: 7,

      maxWidth: 300,

      fontFamily:
        typography.fontFamily.regular,
    },


    /* ==========================================================
       DELETE MODAL
    ========================================================== */

    modalOverlay: {
      flex: 1,

      backgroundColor:
        'rgba(0,0,0,0.58)',

      alignItems: 'center',
      justifyContent: 'center',

      paddingHorizontal: 20,

      ...Platform.select({
        web: {
          backdropFilter:
            'blur(5px)',
        },
      }),
    },


    confirmModal: {
      width: '100%',

      maxWidth: 430,

      borderRadius: 24,

      paddingHorizontal: 22,
      paddingVertical: 24,

      alignItems: 'center',

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 8,
      },

      shadowOpacity: 0.20,

      shadowRadius: 24,

      elevation: 10,
    },


    confirmIconContainer: {
      width: 68,
      height: 68,

      borderRadius: 22,

      alignItems: 'center',
      justifyContent: 'center',

      marginBottom: 15,
    },


    confirmTitle: {
      fontSize: 20,

      lineHeight: 26,

      textAlign: 'center',

      fontFamily:
        typography.fontFamily.bold,
    },


    confirmMessage: {
      fontSize:
        typography.fontSize.sm,

      lineHeight: 21,

      textAlign: 'center',

      marginTop: 7,

      maxWidth: 330,

      fontFamily:
        typography.fontFamily.regular,
    },


    confirmNotificationPreview: {
      width: '100%',

      minHeight: 52,

      borderRadius: 13,

      borderWidth: 1,

      marginTop: 18,

      paddingHorizontal: 12,

      paddingVertical: 9,

      flexDirection: 'row',

      alignItems: 'center',
    },


    confirmNotificationText: {
      flex: 1,

      fontSize:
        typography.fontSize.sm,

      lineHeight: 19,

      marginLeft: 9,

      fontFamily:
        typography.fontFamily.medium,
    },


    confirmButtons: {
      width: '100%',

      flexDirection: 'row',

      gap: 10,

      marginTop: 22,
    },


    confirmCancelButton: {
      flex: 1,

      height: 48,

      borderRadius: 13,

      borderWidth: 1,

      alignItems: 'center',
      justifyContent: 'center',
    },


    confirmCancelText: {
      fontSize:
        typography.fontSize.sm,

      fontFamily:
        typography.fontFamily.semiBold,
    },


    confirmDeleteButton: {
      flex: 1,

      height: 48,

      borderRadius: 13,

      backgroundColor:
        '#D32F2F',

      flexDirection: 'row',

      alignItems: 'center',
      justifyContent: 'center',

      gap: 7,
    },


    confirmDeleteText: {
      color: '#FFFFFF',

      fontSize:
        typography.fontSize.sm,

      fontFamily:
        typography.fontFamily.semiBold,
    },


    /* ==========================================================
       CENTRAL TOAST
    ========================================================== */

    toastLayer: {
      position: 'absolute',

      top: 0,
      left: 0,
      right: 0,
      bottom: 0,

      alignItems: 'center',

      pointerEvents: 'box-none',

      zIndex: 9999,

      elevation: 9999,
    },


    toastContainer: {
      width: '90%',

      maxWidth: 460,

      minHeight: 70,

      marginTop:
        Platform.OS === 'web'
          ? 25
          : 48,

      borderRadius: 17,

      borderLeftWidth: 4,

      paddingHorizontal: 12,
      paddingVertical: 10,

      flexDirection: 'row',

      alignItems: 'center',

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 5,
      },

      shadowOpacity: 0.16,

      shadowRadius: 14,

      elevation: 12,
    },


    toastIconContainer: {
      width: 43,
      height: 43,

      borderRadius: 13,

      alignItems: 'center',
      justifyContent: 'center',

      marginRight: 10,
    },


    toastContent: {
      flex: 1,

      minWidth: 0,

      justifyContent: 'center',
    },


    toastTitle: {
      fontSize:
        typography.fontSize.sm,

      lineHeight: 19,

      fontFamily:
        typography.fontFamily.bold,
    },


    toastMessage: {
      fontSize:
        typography.fontSize.xs,

      lineHeight: 18,

      marginTop: 2,

      fontFamily:
        typography.fontFamily.regular,
    },


    toastClose: {
      width: 32,
      height: 32,

      marginLeft: 5,

      alignItems: 'center',
      justifyContent: 'center',
    },

  });


export default NotificationScreen;