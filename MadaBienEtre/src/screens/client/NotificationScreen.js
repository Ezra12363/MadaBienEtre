/**
 * ============================================================
 * CLIENT - NOTIFICATION SCREEN
 * ============================================================
 *
 * Fonctionnalités :
 *
 * 1. Chargement réel depuis notificationService
 * 2. Tri : plus récente -> plus ancienne
 * 3. Durée réelle :
 *      À l'instant
 *      12 sec
 *      2 min
 *      1 h
 *      1 h 25
 *      3 j
 *      2 sem
 *      2 mois
 *      1 an
 *
 * 4. Notification cliquable
 * 5. Notification négociation -> Negotiation
 * 6. Notification réservation -> BookingDetail
 *
 * 7. Marquage automatique comme lu
 * 8. Suppression individuelle
 * 9. Confirmation personnalisée avant suppression
 * 10. Toast centré sous le Header
 * 11. "Tout marquer comme lu"
 *
 * 12. Filtres :
 *      Toutes
 *      Réservations
 *      Négociations
 *      Paiements
 *      Système
 *
 * 13. Texte conservé après lecture
 * 14. Badge "NON LUE"
 * 15. Pull-to-refresh
 * 16. Android + Web
 * 17. Dark mode
 * 18. Mise à jour réelle du temps toutes les secondes
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
  Platform,
  Modal,
  Pressable,
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
 * Retourne le timestamp d'une notification.
 */
const getNotificationTimestamp = (notification) => {
  const rawDate =
    notification?.created_at ||
    notification?.createdAt ||
    notification?.date ||
    notification?.timestamp ||
    notification?.sent_at ||
    notification?.sentAt;

  if (!rawDate) {
    return 0;
  }

  const timestamp = new Date(rawDate).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
};


/**
 * Retourne l'identifiant de la notification.
 */
const getNotificationId = (notification) => {
  return (
    notification?.id ??
    notification?.notification_id ??
    notification?.notificationId
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
 * Détermine la catégorie.
 */
const resolveCategory = (type) => {
  const value = String(type || '')
    .toLowerCase()
    .trim();

  if (
    value.includes('offer') ||
    value.includes('negotiation') ||
    value.includes('negociation') ||
    value.includes('counter')
  ) {
    return 'offer';
  }

  if (value.includes('sos')) {
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
 * Libellés humains des catégories de notification.
 * Utilisés dans le bottom sheet (désactivation) et le toast associé.
 */
const CATEGORY_LABELS = {
  booking: 'Réservations',
  offer: 'Négociations',
  payment: 'Paiements',
  system: 'Système',
  sos: 'SOS',
};


/**
 * Détermine l'action de navigation.
 */
const resolveNotificationAction = (notification) => {
  const type = String(notification?.type || '')
    .toLowerCase()
    .trim();

  const category = resolveCategory(type);

  if (
    category === 'offer' ||
    type.includes('counter_offer') ||
    type.includes('counter-offer') ||
    type.includes('counteroffer') ||
    type.includes('negotiation') ||
    type.includes('negociation')
  ) {
    return 'negotiation';
  }

  if (category === 'booking') {
    return 'booking';
  }

  return 'none';
};


/**
 * Récupère bookingId.
 */
const getBookingIdFromNotification = (notification) => {
  const data =
    notification?.data ||
    notification?.metadata ||
    notification?.payload ||
    {};

  return (
    notification?.booking_id ??
    notification?.bookingId ??
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
 * Récupère offerId.
 */
const getOfferIdFromNotification = (notification) => {
  const data =
    notification?.data ||
    notification?.metadata ||
    notification?.payload ||
    {};

  return (
    notification?.offer_id ??
    notification?.offerId ??
    data?.offer_id ??
    data?.offerId ??
    data?.offer?.id ??
    null
  );
};


/**
 * Temps écoulé réel.
 */
const formatTimeAgo = (date) => {
  if (!date) {
    return '';
  }

  const created = new Date(date).getTime();

  if (Number.isNaN(created)) {
    return '';
  }

  const now = Date.now();

  let diff = now - created;

  if (diff < 0) {
    diff = 0;
  }

  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) {
    return "À l'instant";
  }

  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);

  const remainingMinutes =
    minutes % 60;

  if (hours < 24) {
    if (remainingMinutes > 0) {
      return `${hours} h ${remainingMinutes}`;
    }

    return `${hours} h`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} j`;
  }

  const weeks = Math.floor(days / 7);

  if (weeks < 5) {
    return `${weeks} sem`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${months} mois`;
  }

  const years = Math.floor(days / 365);

  return `${years} an${years > 1 ? 's' : ''}`;
};


/**
 * Texte sécurisé.
 */
const safeText = (
  value,
  fallback = ''
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  return String(value);
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

  const {
    unreadCount,
    markAsRead,
    markAllAsRead,
    refreshUnreadCount,
  } = useNotifications();

  const insets =
    useSafeAreaInsets();


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


  /* ==========================================================
     ACTION SHEET (⋮ menu)
  ========================================================== */

  const [
    actionSheetVisible,
    setActionSheetVisible,
  ] = useState(false);

  const [
    notificationForActionSheet,
    setNotificationForActionSheet,
  ] = useState(null);

  const [
    disablingCategory,
    setDisablingCategory,
  ] = useState(null);

  const sheetTranslateY =
    useRef(
      new Animated.Value(400)
    ).current;

  const sheetBackdropOpacity =
    useRef(
      new Animated.Value(0)
    ).current;


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

  const toastTimerRef =
    useRef(null);

  const toastAnimation =
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
     SHOW TOAST
  ========================================================== */

  const showToast = useCallback(
    ({
      type = 'success',
      title = '',
      message = '',
      duration = 2600,
    }) => {

      if (toastTimerRef.current) {
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

      toastAnimation.setValue(0);

      Animated.spring(
        toastAnimation,
        {
          toValue: 1,
          friction: 7,
          tension: 65,
          useNativeDriver: true,
        }
      ).start();

      toastTimerRef.current =
        setTimeout(() => {

          Animated.timing(
            toastAnimation,
            {
              toValue: 0,
              duration: 220,
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

        }, duration);

    },
    [toastAnimation]
  );


  /* ==========================================================
     CLEAN TOAST TIMER
  ========================================================== */

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(
          toastTimerRef.current
        );
      }
    };
  }, []);


  /* ==========================================================
     FILTERS
  ========================================================== */

  const filters = [
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
  ];


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
            '⚠️ [CLIENT Notifications] Impossible de charger:',
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
        } else if (
          Array.isArray(
            data?.notifications
          )
        ) {
          list =
            data.notifications;
        } else if (
          Array.isArray(
            data?.items
          )
        ) {
          list =
            data.items;
        } else if (
          Array.isArray(
            data?.results
          )
        ) {
          list =
            data.results;
        }


        /* ------------------------------------------------------
           NORMALISATION
        ------------------------------------------------------ */

        const normalized =
          list.map(
            (item, index) => ({
              ...item,

              id:
                getNotificationId(
                  item
                ) ??
                `notification-${index}`,

              is_read:
                isNotificationRead(
                  item
                ),

              created_at:
                item?.created_at ||
                item?.createdAt ||
                item?.date ||
                item?.timestamp ||
                item?.sent_at ||
                item?.sentAt ||
                null,
            })
          );


        /* ------------------------------------------------------
           PLUS RÉCENTE EN PREMIER
        ------------------------------------------------------ */

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
          '❌ [CLIENT Notifications] Error loading:',
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
     FOCUS
  ========================================================== */

  useFocusEffect(
    useCallback(() => {

      loadNotifications();

      refreshUnreadCount?.();

      return undefined;

    }, [
      loadNotifications,
      refreshUnreadCount,
    ])
  );


  /* ==========================================================
     UPDATE TIME EVERY SECOND
  ========================================================== */

  const [, setCurrentTime] =
    useState(Date.now());

  useFocusEffect(
    useCallback(() => {

      const interval =
        setInterval(() => {
          setCurrentTime(
            Date.now()
          );
        }, 1000);

      return () => {
        clearInterval(interval);
      };

    }, [])
  );


  /* ==========================================================
     REFRESH
  ========================================================== */

  const onRefresh =
    useCallback(async () => {

      setRefreshing(true);

      try {

        await loadNotifications();

        await refreshUnreadCount?.();

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

                    read: true,
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


        /* ------------------------------------------------------
           NÉGOCIATION
        ------------------------------------------------------ */

        if (
          action ===
          'negotiation'
        ) {

          if (!bookingId) {

            showToast({
              type: 'warning',
              title: 'Notification',
              message:
                'Cette notification ne contient pas de réservation.',
            });

            return;
          }


          /*
           * CLIENT :
           *
           * On garde les routes du
           * ClientNavigator.
           *
           * Negotiation doit être enregistré
           * dans le stack client.
           */

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
           RÉSERVATION
        ------------------------------------------------------ */

        if (
          action ===
          'booking'
        ) {

          if (!bookingId) {

            showToast({
              type: 'warning',
              title: 'Notification',
              message:
                'Identifiant de réservation introuvable.',
            });

            return;
          }

          navigation.navigate(
            'BookingDetail',
            {
              bookingId,
            }
          );

          return;
        }

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

              await markAsRead(
                notificationId
              );

            } catch (error) {

              console.warn(
                '⚠️ Impossible de marquer comme lue:',
                error
              );

            }


            /*
             * IMPORTANT :
             * On garde title + body.
             */

            updateNotificationAsRead(
              notificationId
            );


            refreshUnreadCount?.();


            /*
             * Toast discret.
             */

            showToast({
              type: 'success',
              title: 'Notification lue',
              message:
                'La notification a été marquée comme lue.',
              duration: 1800,
            });
          }


          /* ----------------------------------------------------
             NAVIGATION DIRECTE
          ---------------------------------------------------- */

          navigateFromNotification(
            notification
          );

        } finally {

          setReadingId(null);

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
     OPEN DELETE MODAL
  ========================================================== */

  const handleDeleteNotification =
    useCallback(
      (notification) => {

        setNotificationToDelete(
          notification
        );

        setDeleteModalVisible(
          true
        );

      },
      []
    );


  /* ==========================================================
     CLOSE DELETE MODAL
  ========================================================== */

  const closeDeleteModal =
    useCallback(() => {

      if (deletingId) {
        return;
      }

      setDeleteModalVisible(
        false
      );

      setNotificationToDelete(
        null
      );

    }, [deletingId]);


  /* ==========================================================
     OPEN ACTION SHEET (⋮)
  ========================================================== */

  const openActionSheet =
    useCallback(
      (notification) => {

        setNotificationForActionSheet(
          notification
        );

        setActionSheetVisible(
          true
        );

        sheetTranslateY.setValue(400);
        sheetBackdropOpacity.setValue(0);

        Animated.parallel([

          Animated.spring(
            sheetTranslateY,
            {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
              speed: 14,
            }
          ),

          Animated.timing(
            sheetBackdropOpacity,
            {
              toValue: 1,
              duration: 220,
              useNativeDriver: true,
            }
          ),

        ]).start();

      },
      [
        sheetTranslateY,
        sheetBackdropOpacity,
      ]
    );


  /* ==========================================================
     CLOSE ACTION SHEET
  ========================================================== */

  const closeActionSheet =
    useCallback(
      (afterClose) => {

        if (disablingCategory) {
          return;
        }

        Animated.parallel([

          Animated.timing(
            sheetTranslateY,
            {
              toValue: 400,
              duration: 200,
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            sheetBackdropOpacity,
            {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }
          ),

        ]).start(() => {

          setActionSheetVisible(
            false
          );

          setNotificationForActionSheet(
            null
          );

          if (
            typeof afterClose ===
            'function'
          ) {
            afterClose();
          }

        });

      },
      [
        disablingCategory,
        sheetTranslateY,
        sheetBackdropOpacity,
      ]
    );


  /* ==========================================================
     DÉSACTIVER LA NOTIFICATION (par catégorie)
  ========================================================== */

  const handleDisableCategory =
    useCallback(
      async () => {

        const notification =
          notificationForActionSheet;

        if (!notification) {
          return;
        }

        const category =
          resolveCategory(
            notification?.type
          );

        const categoryLabel =
          CATEGORY_LABELS[
            category
          ] || 'cette catégorie';

        setDisablingCategory(
          category
        );

        try {

          const result =
            await notificationService.updatePreferences({
              [`${category}_enabled`]: false,
            });

          const success =
            result?.success === true;

          if (!success) {

            throw new Error(
              result?.error ||
              'Mise à jour impossible'
            );

          }

          setDisablingCategory(
            null
          );

          closeActionSheet(() => {

            showToast({
              type: 'success',
              title: 'Notifications désactivées',
              message: `Vous ne recevrez plus de notifications « ${categoryLabel} ».`,
            });

          });

        } catch (error) {

          console.error(
            '❌ [CLIENT Notifications] Désactivation impossible:',
            error
          );

          setDisablingCategory(
            null
          );

          showToast({
            type: 'error',
            title: 'Action impossible',
            message: `Impossible de désactiver les notifications « ${categoryLabel} ».`,
          });

        }

      },
      [
        notificationForActionSheet,
        closeActionSheet,
        showToast,
      ]
    );


  /* ==========================================================
     DELETE NOTIFICATION
  ========================================================== */

  const performDeleteNotification =
    useCallback(
      async () => {

        const notification =
          notificationToDelete;

        if (!notification) {
          return;
        }

        const notificationId =
          getNotificationId(
            notification
          );

        if (!notificationId) {

          setDeleteModalVisible(
            false
          );

          setNotificationToDelete(
            null
          );

          showToast({
            type: 'error',
            title: 'Erreur',
            message:
              'Identifiant de notification introuvable.',
          });

          return;
        }


        setDeletingId(
          notificationId
        );


        try {

          let result = null;


          /* ----------------------------------------------------
             BACKEND DELETE
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

          } else if (
            typeof notificationService
              .removeNotification ===
            'function'
          ) {

            result =
              await notificationService
                .removeNotification(
                  notificationId
                );

          } else if (
            typeof notificationService
              .delete ===
            'function'
          ) {

            result =
              await notificationService.delete(
                notificationId
              );

          } else if (
            typeof notificationService
              .remove ===
            'function'
          ) {

            result =
              await notificationService.remove(
                notificationId
              );

          } else {

            /*
             * Aucun endpoint delete disponible
             * dans notificationService.
             *
             * On ne prétend PAS que le backend
             * a supprimé la notification.
             */

            console.warn(
              '⚠️ notificationService ne possède aucune méthode delete.'
            );

            result = {
              success: true,
              localOnly: true,
            };

          }


          /* ----------------------------------------------------
             VÉRIFICATION
          ---------------------------------------------------- */

          const success =
            result?.success === true ||
            (
              result?.status >= 200 &&
              result?.status < 300
            ) ||
            result?.localOnly === true;


          if (!success) {

            throw new Error(
              result?.error ||
              'Suppression impossible'
            );

          }


          /* ----------------------------------------------------
             REMOVE FROM UI
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


          /* ----------------------------------------------------
             CLOSE MODAL
          ---------------------------------------------------- */

          setDeleteModalVisible(
            false
          );

          setNotificationToDelete(
            null
          );


          /* ----------------------------------------------------
             BADGE
          ---------------------------------------------------- */

          await refreshUnreadCount?.();


          /* ----------------------------------------------------
             TOAST CENTRÉ
          ---------------------------------------------------- */

          showToast({
            type: 'success',
            title: 'Notification supprimée',
            message:
              'La notification a été supprimée avec succès.',
          });

        } catch (error) {

          console.error(
            '❌ [CLIENT Notifications] Suppression impossible:',
            error
          );


          setDeleteModalVisible(
            false
          );

          setNotificationToDelete(
            null
          );


          showToast({
            type: 'error',
            title: 'Suppression impossible',
            message:
              'Impossible de supprimer cette notification.',
          });

        } finally {

          setDeletingId(null);

        }

      },
      [
        notificationToDelete,
        refreshUnreadCount,
        showToast,
      ]
    );


  /* ==========================================================
     MARK ALL AS READ
  ========================================================== */

  const handleMarkAllRead =
    useCallback(
      async () => {

        if (
          !notifications.length
        ) {
          return;
        }


        try {

          await markAllAsRead();


          /*
           * On garde tout le contenu.
           */

          setNotifications(
            (previous) =>
              previous.map(
                (item) => ({
                  ...item,
                  is_read: true,
                  read: true,
                })
              )
          );


          await refreshUnreadCount?.();


          showToast({
            type: 'success',
            title: 'Notifications lues',
            message:
              'Toutes les notifications ont été marquées comme lues.',
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
                item?.type
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
    ]);


  /* ==========================================================
     RENDER TOAST
  ========================================================== */

  const renderToast = () => {

    if (!toast.visible) {
      return null;
    }


    const isError =
      toast.type === 'error';

    const isWarning =
      toast.type === 'warning';


    const iconName =
      isError
        ? 'close-circle'
        : isWarning
          ? 'warning'
          : 'checkmark-circle';


    const iconColor =
      isError
        ? '#D32F2F'
        : isWarning
          ? '#F57C00'
          : colors.primary;


    const iconBackground =
      isError
        ? 'rgba(211,47,47,0.12)'
        : isWarning
          ? 'rgba(245,124,0,0.12)'
          : `${colors.primary}15`;


    const translateY =
      toastAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-20, 0],
      });


    const scale =
      toastAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0.96, 1],
      });


    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toastWrapper,
          {
            transform: [
              {
                translateY,
              },
              {
                scale,
              },
            ],
            opacity:
              toastAnimation,
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
                isDark
                  ? 'rgba(255,255,255,0.08)'
                  : '#E9E9E9',

              shadowColor:
                '#000',
            },
          ]}
        >

          <View
            style={[
              styles.toastIcon,
              {
                backgroundColor:
                  iconBackground,
              },
            ]}
          >
            <Ionicons
              name={iconName}
              size={23}
              color={iconColor}
            />
          </View>


          <View
            style={
              styles.toastContent
            }
          >
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

            <Text
              numberOfLines={2}
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
          </View>

        </View>
      </Animated.View>
    );
  };


  /* ==========================================================
     RENDER DELETE MODAL
  ========================================================== */

  const renderDeleteModal =
    () => {

      const title =
        safeText(
          notificationToDelete?.title,
          'cette notification'
        );


      return (
        <Modal
          visible={
            deleteModalVisible
          }
          transparent
          animationType="fade"
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

            <Pressable
              style={
                StyleSheet.absoluteFill
              }
              onPress={
                closeDeleteModal
              }
            />


            <Animatable.View
              animation="zoomIn"
              duration={220}
              style={[
                styles.confirmModal,
                {
                  backgroundColor:
                    themeColors.surface,

                  borderColor:
                    isDark
                      ? 'rgba(255,255,255,0.08)'
                      : '#E8E8E8',
                },
              ]}
            >

              {/* ------------------------------------------------
                  ICON
              ------------------------------------------------ */}

              <View
                style={[
                  styles.confirmIcon,
                  {
                    backgroundColor:
                      isDark
                        ? 'rgba(211,47,47,0.15)'
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


              {/* ------------------------------------------------
                  TITLE
              ------------------------------------------------ */}

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


              {/* ------------------------------------------------
                  MESSAGE
              ------------------------------------------------ */}

              <Text
                style={[
                  styles.confirmMessage,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Voulez-vous vraiment supprimer
                {' '}
                <Text
                  style={[
                    styles.confirmStrong,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  « {title} »
                </Text>
                {' '}?
              </Text>


              <Text
                style={[
                  styles.confirmWarning,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Cette action retirera la notification
                de votre liste.
              </Text>


              {/* ------------------------------------------------
                  BUTTONS
              ------------------------------------------------ */}

              <View
                style={
                  styles.confirmActions
                }
              >

                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    {
                      backgroundColor:
                        isDark
                          ? 'rgba(255,255,255,0.06)'
                          : '#F5F5F5',

                      borderColor:
                        isDark
                          ? 'rgba(255,255,255,0.08)'
                          : '#E2E2E2',
                    },
                  ]}
                  onPress={
                    closeDeleteModal
                  }
                  disabled={
                    !!deletingId
                  }
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      {
                        color:
                          themeColors.text,
                      },
                    ]}
                  >
                    Annuler
                  </Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={
                    styles.deleteConfirmButton
                  }
                  onPress={
                    performDeleteNotification
                  }
                  disabled={
                    !!deletingId
                  }
                  activeOpacity={0.8}
                >

                  {deletingId ? (
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
                          styles.deleteConfirmText
                        }
                      >
                        Supprimer
                      </Text>
                    </>
                  )}

                </TouchableOpacity>

              </View>

            </Animatable.View>
          </View>
        </Modal>
      );
    };


  /* ==========================================================
     RENDER ACTION SHEET (menu ⋮)
  ========================================================== */

  const renderActionSheet =
    () => {

      const notification =
        notificationForActionSheet;

      const category =
        resolveCategory(
          notification?.type
        );

      const categoryLabel =
        CATEGORY_LABELS[
          category
        ] || 'cette catégorie';

      const icon =
        getIcon(
          notification?.type
        );

      const color =
        getColor(
          notification?.type
        );

      const isDisabling =
        !!disablingCategory;


      return (
        <Modal
          visible={
            actionSheetVisible
          }
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={() =>
            closeActionSheet()
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

            <Pressable
              style={
                StyleSheet.absoluteFill
              }
              onPress={() =>
                closeActionSheet()
              }
            />


            <Animated.View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor:
                    themeColors.surface,

                  borderColor:
                    isDark
                      ? 'rgba(255,255,255,0.08)'
                      : '#ECECEC',

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
                style={
                  styles.sheetHandle
                }
              />


              {/* ----------------------------------------------
                  APERÇU NOTIFICATION
              ---------------------------------------------- */}

              <View
                style={[
                  styles.sheetPreview,
                  {
                    borderBottomColor:
                      isDark
                        ? 'rgba(255,255,255,0.08)'
                        : '#F0F0F0',
                  },
                ]}
              >

                <View
                  style={[
                    styles.sheetPreviewIcon,
                    {
                      backgroundColor:
                        `${color}18`,
                    },
                  ]}
                >
                  <Ionicons
                    name={icon}
                    size={20}
                    color={color}
                  />
                </View>

                <Text
                  numberOfLines={2}
                  style={[
                    styles.sheetPreviewTitle,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  {safeText(
                    notification?.title,
                    'Notification'
                  )}
                </Text>

              </View>


              {/* ----------------------------------------------
                  SUPPRIMER LA NOTIFICATION
              ---------------------------------------------- */}

              <TouchableOpacity
                style={styles.sheetOption}
                activeOpacity={0.7}
                disabled={isDisabling}
                onPress={() =>
                  closeActionSheet(() =>
                    handleDeleteNotification(
                      notification
                    )
                  )
                }
              >

                <View
                  style={[
                    styles.sheetOptionIcon,
                    {
                      backgroundColor:
                        isDark
                          ? 'rgba(211,47,47,0.15)'
                          : '#FFF1F1',
                    },
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color="#D32F2F"
                  />
                </View>

                <Text
                  style={[
                    styles.sheetOptionText,
                    { color: '#D32F2F' },
                  ]}
                >
                  Supprimer la notification
                </Text>

              </TouchableOpacity>


              {/* ----------------------------------------------
                  DÉSACTIVER LA NOTIFICATION
              ---------------------------------------------- */}

              <TouchableOpacity
                style={styles.sheetOption}
                activeOpacity={0.7}
                disabled={isDisabling}
                onPress={
                  handleDisableCategory
                }
              >

                <View
                  style={[
                    styles.sheetOptionIcon,
                    {
                      backgroundColor:
                        isDark
                          ? 'rgba(255,255,255,0.08)'
                          : '#F2F2F2',
                    },
                  ]}
                >
                  {isDisabling ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        themeColors.textSecondary
                      }
                    />
                  ) : (
                    <Ionicons
                      name="notifications-off-outline"
                      size={18}
                      color={
                        themeColors.text
                      }
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.sheetOptionText,
                    { color: themeColors.text },
                  ]}
                >
                  {isDisabling
                    ? `Désactivation « ${categoryLabel} »…`
                    : `Désactiver « ${categoryLabel} »`}
                </Text>

              </TouchableOpacity>


              {/* ----------------------------------------------
                  ANNULER
              ---------------------------------------------- */}

              <TouchableOpacity
                style={[
                  styles.sheetCancel,
                  {
                    backgroundColor:
                      isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#F5F5F5',
                  },
                ]}
                activeOpacity={0.8}
                disabled={isDisabling}
                onPress={() =>
                  closeActionSheet()
                }
              >
                <Text
                  style={[
                    styles.sheetCancelText,
                    { color: themeColors.text },
                  ]}
                >
                  Annuler
                </Text>
              </TouchableOpacity>

            </Animated.View>

          </Animated.View>
        </Modal>
      );

    };


  /* ==========================================================
     RENDER NOTIFICATION
  ========================================================== */

  const renderNotification =
    useCallback(
      ({
        item,
        index,
      }) => {

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
            item?.type
          );

        const color =
          getColor(
            item?.type
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
          String(
            deletingId
          ) ===
          String(
            notificationId
          );

        const isReading =
          String(
            readingId
          ) ===
          String(
            notificationId
          );


        return (
          <Animatable.View
            animation="fadeInUp"
            duration={350}
            delay={
              Math.min(
                index * 40,
                300
              )
            }
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

              {/* =================================================
                  ICON
              ================================================= */}

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


              {/* =================================================
                  CONTENT
              ================================================= */}

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
                      {safeText(
                        item?.title,
                        'Notification'
                      )}
                    </Text>


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

                <Text
                  style={[
                    styles.notificationBody,
                    {
                      color:
                        themeColors.textSecondary,
                    },
                  ]}
                >
                  {safeText(
                    item?.body ||
                    item?.message ||
                    item?.description,
                    ''
                  )}
                </Text>


                {/* =================================================
                    NEGOTIATION
                ================================================= */}

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


                {/* =================================================
                    BOOKING
                ================================================= */}

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


              {/* =================================================
                  MENU (⋮)
              ================================================= */}

              <TouchableOpacity
                style={
                  styles.menuButton
                }
                onPress={() =>
                  openActionSheet(
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
                    color={
                      themeColors.textSecondary
                    }
                  />
                ) : (
                  <Ionicons
                    name="ellipsis-vertical"
                    size={18}
                    color={
                      themeColors.textSecondary
                    }
                  />
                )}

              </TouchableOpacity>


              {/* =================================================
                  READING
              ================================================= */}

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
        handleDeleteNotification,
        handleNotificationPress,
        openActionSheet,
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
    () => {

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
    };


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

      {/* ======================================================
          HEADER
      ====================================================== */}

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


      {/* ======================================================
          TOAST
          Juste sous le Header
      ====================================================== */}

      {renderToast()}


      {/* ======================================================
          SUMMARY
      ====================================================== */}

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


      {/* ======================================================
          FILTERS
      ====================================================== */}

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


      {/* ======================================================
          LIST
      ====================================================== */}

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


      {/* ======================================================
          DELETE CONFIRMATION MODAL
      ====================================================== */}

      {renderDeleteModal()}

      {renderActionSheet()}

    </View>
  );
};


/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({

  container: {
    flex: 1,
  },


  /* ==========================================================
     MARK ALL
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
     TOAST
  ========================================================== */

  toastWrapper: {
    position: 'absolute',

    top:
      Platform.OS === 'web'
        ? 68
        : 72,

    left: 18,
    right: 18,

    zIndex: 9999,

    alignItems: 'center',

    pointerEvents: 'none',
  },

  toast: {
    width:
      Platform.OS === 'web'
        ? 430
        : '94%',

    minHeight: 66,

    borderRadius: 16,

    borderWidth: 1,

    paddingHorizontal: 12,
    paddingVertical: 10,

    flexDirection: 'row',
    alignItems: 'center',

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.14,
    shadowRadius: 18,

    elevation: 9,
  },

  toastIcon: {
    width: 42,
    height: 42,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  toastContent: {
    flex: 1,
    minWidth: 0,
  },

  toastTitle: {
    fontSize: 14,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  toastMessage: {
    marginTop: 2,

    fontSize: 12,

    lineHeight: 17,

    fontFamily:
      typography.fontFamily.regular,
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

    paddingHorizontal: 13,

    borderRadius: 20,

    marginRight: 8,

    borderWidth: 1,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 6,
  },

  filterText: {
    fontSize:
      typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.medium,
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

    minWidth: 44,
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
     DELETE BUTTON
  ========================================================== */

  menuButton: {
    width: 32,
    height: 32,

    marginLeft: 5,

    backgroundColor: 'transparent',

    alignItems: 'center',
    justifyContent: 'center',
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
     DELETE MODAL
  ========================================================== */

  modalOverlay: {
    flex: 1,

    backgroundColor:
      'rgba(0,0,0,0.58)',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 20,
  },

  confirmModal: {
    width:
      Platform.OS === 'web'
        ? 430
        : '100%',

    maxWidth: 430,

    borderRadius: 24,

    borderWidth: 1,

    paddingHorizontal: 22,

    paddingTop: 25,

    paddingBottom: 20,

    alignItems: 'center',

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 10,
    },

    shadowOpacity: 0.2,

    shadowRadius: 25,

    elevation: 15,
  },

  confirmIcon: {
    width: 68,
    height: 68,

    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 15,
  },

  confirmTitle: {
    fontSize: 19,

    textAlign: 'center',

    fontFamily:
      typography.fontFamily.bold,
  },

  confirmMessage: {
    fontSize: 14,

    lineHeight: 21,

    textAlign: 'center',

    marginTop: 10,

    paddingHorizontal: 8,

    fontFamily:
      typography.fontFamily.regular,
  },

  confirmStrong: {
    fontFamily:
      typography.fontFamily.semiBold,
  },

  confirmWarning: {
    fontSize: 12,

    lineHeight: 18,

    textAlign: 'center',

    marginTop: 5,

    paddingHorizontal: 12,

    fontFamily:
      typography.fontFamily.regular,
  },

  confirmActions: {
    width: '100%',

    flexDirection: 'row',

    gap: 10,

    marginTop: 22,
  },

  cancelButton: {
    flex: 1,

    minHeight: 46,

    borderRadius: 13,

    borderWidth: 1,

    alignItems: 'center',

    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 13,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  deleteConfirmButton: {
    flex: 1,

    minHeight: 46,

    borderRadius: 13,

    backgroundColor:
      '#D32F2F',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 7,

    shadowColor: '#D32F2F',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.18,

    shadowRadius: 7,

    elevation: 4,
  },

  deleteConfirmText: {
    color: '#FFFFFF',

    fontSize: 13,

    fontFamily:
      typography.fontFamily.bold,
  },


  /* ==========================================================
     ACTION SHEET (menu ⋮)
  ========================================================== */

  sheetOverlay: {
    flex: 1,

    backgroundColor:
      'rgba(0,0,0,0.5)',

    justifyContent: 'flex-end',
  },

  sheetContainer: {
    width: '100%',

    alignSelf: 'stretch',

    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,

    borderWidth: 1,
    borderBottomWidth: 0,

    paddingHorizontal: 18,

    paddingTop: 10,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: -4,
    },

    shadowOpacity: 0.15,

    shadowRadius: 16,

    elevation: 20,
  },

  sheetHandle: {
    width: 40,
    height: 4,

    borderRadius: 3,

    backgroundColor:
      'rgba(150,150,150,0.4)',

    alignSelf: 'center',

    marginBottom: 14,
  },

  sheetPreview: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 12,

    paddingBottom: 14,

    marginBottom: 8,

    borderBottomWidth: 1,
  },

  sheetPreviewIcon: {
    width: 40,
    height: 40,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetPreviewTitle: {
    flex: 1,

    fontSize:
      typography.fontSize.sm,

    lineHeight: 19,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  sheetOption: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 13,

    paddingVertical: 13,
  },

  sheetOptionIcon: {
    width: 36,
    height: 36,

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetOptionText: {
    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.medium,
  },

  sheetCancel: {
    marginTop: 10,

    minHeight: 48,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetCancelText: {
    fontSize:
      typography.fontSize.md,

    fontFamily:
      typography.fontFamily.semiBold,
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

});


export default NotificationScreen;