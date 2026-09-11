// src/context/NotificationContext.js
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import notificationService from '../services/notificationService';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Notifications déjà vues par le polling.
  const knownNotificationIds = useRef(new Set());
  const firstNotificationPoll = useRef(true);
  const pollInProgress = useRef(false);

  useEffect(() => {
    setupNotifications();
    pollNotifications();

    // IMPORTANT : unread-count seul ne fait qu'actualiser le badge.
    // Pour faire apparaître réellement la notification, on doit aussi
    // récupérer GET /notifications.
    const pollingInterval = setInterval(() => {
      pollNotifications();
    }, 5000);

    return () => clearInterval(pollingInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {

    // ✅ FIXÉ : "listener" mandeha AMIN'NY MOBILE ihany (efa marina
    // teo aloha), fa nampio "try/catch" mba tsy hisy crash raha misy
    // olana amin'ny notificationService.addNotificationListener (ex:
    // permission na module tsy tafiditra tsara).
    if (Platform.OS !== 'web') {
      let subscription;
      let responseSubscription;
      try {
        subscription = notificationService.addNotificationListener((notif) => {
          setNotification(notif);
        });

        responseSubscription = notificationService.addNotificationResponseListener((response) => {
          const data = response.notification.request.content.data;
          if (data?.screen) {
            // navigation.navigate(data.screen, data);
          }
        });
      } catch (error) {
        console.warn('⚠️ [Notifications] Impossible d\'initialiser les listeners:', error?.message);
      }

      return () => {
        try {
          if (subscription) notificationService.removeListener(subscription);
          if (responseSubscription) notificationService.removeListener(responseSubscription);
        } catch (error) {
          console.warn('⚠️ [Notifications] Erreur lors du nettoyage des listeners:', error?.message);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupNotifications = async () => {
    try {
      const hasPermission = await notificationService.checkPermission();
      setPermissionStatus(hasPermission);

      if (!hasPermission) {
        const granted = await notificationService.requestPermission();
        setPermissionStatus(granted);
      }

      if (Platform.OS !== 'web') {
        const token = await notificationService.getPushToken();
        setExpoPushToken(token || '');
      }
    } catch (error) {
      // ✅ FIXÉ : atao "warn" fa tsy "error" — ny fandavana permission
      // na ny push token tsy azo (ex: web, simulator) dia tsy
      // "hadisoana" fa toe-javatra mahazatra
      console.warn('⚠️ [Notifications] setupNotifications:', error?.message);
    } finally {
      setIsLoading(false);
    }
  };

  const extractNotifications = (result) => {
    if (!result?.success) return [];
    if (Array.isArray(result.notifications)) return result.notifications;

    const raw = result.data;
    if (Array.isArray(raw)) return raw;

    const list =
      raw?.notifications ||
      raw?.items ||
      raw?.results ||
      raw?.data ||
      [];

    return Array.isArray(list) ? list : [];
  };

  const getNotificationId = (n) =>
    n?.id ??
    n?.notification_id ??
    n?.notificationId ??
    `${n?.created_at || n?.createdAt || ''}-${n?.title || ''}-${n?.body || n?.message || ''}`;

  const pollNotifications = async () => {
    if (pollInProgress.current) return;
    pollInProgress.current = true;

    try {
      const AsyncStorage =
        require('@react-native-async-storage/async-storage').default;
      const token = await AsyncStorage.getItem('@mada_token');

      if (!token) {
        setUnreadCount(0);
        return;
      }

      const result = await notificationService.getNotifications();
      const list = extractNotifications(result);

      if (!result?.success) return;

      // Tri : plus récentes en premier.
      const sorted = [...list].sort((a, b) => {
        const da = new Date(a?.created_at || a?.createdAt || 0).getTime();
        const db = new Date(b?.created_at || b?.createdAt || 0).getTime();
        return db - da;
      });

      // Le premier polling initialise le cache sans afficher de faux
      // "nouveau" message pour toutes les anciennes notifications.
      if (firstNotificationPoll.current) {
        sorted.forEach(n => knownNotificationIds.current.add(getNotificationId(n)));
        firstNotificationPoll.current = false;
      } else {
        for (const n of sorted) {
          const id = getNotificationId(n);
          if (!knownNotificationIds.current.has(id)) {
            knownNotificationIds.current.add(id);

            // Notification native / Web uniquement si elle est encore
            // non lue. La liste reste disponible dans NotificationScreen.
            if (!n?.is_read) {
              await notificationService.presentBackendNotification(n);
            }
          }
        }
      }

      // Nettoyage du cache pour éviter qu'il grossisse indéfiniment.
      if (knownNotificationIds.current.size > 300) {
        const keep = sorted.slice(0, 200).map(getNotificationId);
        knownNotificationIds.current = new Set(keep);
      }

      const unread = sorted.filter(n => !n?.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.warn('⚠️ [Notifications] polling:', error?.message || error);
    } finally {
      pollInProgress.current = false;
    }
  };

  // ✅ FIXÉ (BUG LEHIBE) : ny "unread-count" polling dia mety
  // MIANTSO ny backend ALOHAN'NY hisian'ny token (ex: rehefa
  // vao misokatra ny app, mbola tsy nanao login ny mpampiasa) — io
  // dia toe-javatra MAHAZATRA, tsy hadisoana. Ny code teo aloha dia
  // namoaka "console.error" mahery be foana rehefa "Network Error"
  // na 401 tamin'io fotoana io, na dia efa mandeha tsara aza ny app.
  //
  // Amin'izao:
  //   1) Tsy miantso ny backend raha mbola tsy misy token (mba tsy
  //      hamoaka fangatahana tsy ilaina, sy tsy hampiseho error).
  //   2) Raha misy error (Network Error, 401, sns.) mandritra ny
  //      fiantsoana, dia "warn" fotsiny (tsy manakorontana ny app),
  //      ary avelao ho 0 ny unreadCount.
  const loadUnreadCount = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const token = await AsyncStorage.getItem('@mada_token');
      if (!token) {
        // ✅ Mbola tsy nanao login — tsy misy antony hiantso ny
        // endpoint "unread-count" (izay mila authentification foana)
        setUnreadCount(0);
        return;
      }

      const result = await notificationService.getUnreadCount();
      if (result?.success) {
        // Le backend renvoie normalement unread_count. On garde aussi
        // un fallback count pour les anciennes versions.
        // ✅ FIXÉ : le backend (notifications.py) renvoie
        // {"unread_count": N}, jamais {"count": N}. Avec l'ancien
        // code, le badge de notifications restait bloqué à 0 en
        // permanence, quel que soit le nombre réel de notifications
        // non lues (négociations comprises).
        const count =
          result.data?.unread_count ??
          result.data?.count ??
          0;
        setUnreadCount(count);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      // ✅ FIXÉ : "warn" fotsiny, tsy "error" — mba tsy hampiseho
      // error mena tsy misy dikany rehefa tsy misy connexion na
      // token mbola tsy vonona
      console.warn('⚠️ [Notifications] loadUnreadCount:', error?.message);
      setUnreadCount(0);
    }
  };

  const sendNotification = (title, body, data = {}) => {
    return notificationService.sendNotification(title, body, data);
  };

  const scheduleNotification = (title, body, seconds, data = {}) => {
    return notificationService.scheduleNotification(title, body, seconds, data);
  };

  const sendSOSNotification = (title, body, data = {}) => {
    return notificationService.sendSOSNotification(title, body, data);
  };

  const sendBookingNotification = (title, body, bookingId, data = {}) => {
    return notificationService.sendBookingNotification(title, body, bookingId, data);
  };

  // ✅ AJOUT : notification liée à une négociation (offre / contre-offre)
  const sendOfferNotification = (title, body, bookingId, data = {}) => {
    return notificationService.sendOfferNotification(title, body, bookingId, data);
  };

  const markAsRead = async (notificationId) => {
    const result = await notificationService.markAsRead(notificationId);
    if (result?.success) {
      await loadUnreadCount();
    }
    return result;
  };

  const markAllAsRead = async () => {
    const result = await notificationService.markAllAsRead();
    if (result?.success) {
      await loadUnreadCount();
    }
    return result;
  };

  const value = {
    expoPushToken,
    notification,
    unreadCount,
    permissionStatus,
    isLoading,
    sendNotification,
    scheduleNotification,
    sendSOSNotification,
    sendBookingNotification,
    sendOfferNotification,
    markAsRead,
    markAllAsRead,
    loadUnreadCount,
    // ✅ alias explicite pour rafraîchir manuellement le badge
    // (ex: après avoir envoyé une contre-offre)
    refreshUnreadCount: loadUnreadCount,
    presentBackendNotification: notificationService.presentBackendNotification.bind(notificationService),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;