// src/context/NotificationContext.js
// ============================================================================
// Notifications de l'app (réservations, offres, MESSAGES DE CHAT...).
//
// Flux d'un nouveau message :
//   1. Le backend enregistre une notification (table notifications) et envoie
//      un signal instantané sur /ws/notifications  => pollNotifications()
//      est déclenché tout de suite (plus d'attente de 10 s).
//   2. pollNotifications() lit GET /notifications ; pour chaque notification
//      NOUVELLE et non lue, il affiche une notification native (mobile) /
//      navigateur (web) via notificationService.presentBackendNotification().
//   3. Si vous avez déjà CETTE conversation ouverte, rien n'est affiché
//      (setActiveChatBookingId, appelé par ChatScreen / useChatRoom).
//   4. Le polling (toutes les 10 s) reste en filet de sécurité.
// ============================================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import notificationService from '../services/notificationService';
import { toTimestamp } from '../utils/timeAgo';
import { buildWsUrl } from '../utils/wsUrl';

const NotificationContext = createContext();

const TOKEN_STORAGE_KEY = '@mada_token';
const POLL_INTERVAL_MS = 10000;
const NOTIF_PING_MS = 25000;

// created_at / data peuvent arriver sous forme de chaîne JSON
const parseNotifData = (n) => {
  let data = n?.data ?? n?.metadata ?? n?.payload ?? {};
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (_e) {
      data = {};
    }
  }
  return data && typeof data === 'object' ? data : {};
};

const isChatNotification = (n) => {
  const data = parseNotifData(n);
  const type = String(n?.type || '').toLowerCase();
  return data.kind === 'chat_message' || type.includes('chat') || type.includes('message');
};

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
  const pollAgain = useRef(false);

  // Conversation actuellement ouverte à l'écran (null = aucune)
  const activeChatBookingId = useRef(null);

  // Clic sur une notification native -> navigation (fournie par l'app)
  const responseHandlerRef = useRef(null);
  const pendingResponseRef = useRef(null);

  // WebSocket "signal instantané"
  const notifSocketRef = useRef(null);
  const notifSocketFailsRef = useRef(0);
  const notifSocketNextTryRef = useRef(0);

  /* ------------------------------------------------------------------ */
  /* Cycle de vie                                                         */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    setupNotifications();
    pollNotifications();

    const pollingInterval = setInterval(() => {
      pollNotifications();
    }, POLL_INTERVAL_MS);

    // Retour au premier plan : on relit tout de suite
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pollNotifications();
    });

    return () => {
      clearInterval(pollingInterval);
      appSub?.remove?.();
      closeNotifSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    let subscription;
    let responseSubscription;
    try {
      subscription = notificationService.addNotificationListener((notif) => {
        setNotification(notif);
      });

      responseSubscription = notificationService.addNotificationResponseListener((response) => {
        const data = response?.notification?.request?.content?.data || {};
        if (responseHandlerRef.current) {
          responseHandlerRef.current(data);
        } else {
          pendingResponseRef.current = data; // l'app n'est pas encore prête
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
  }, []);

  /* ------------------------------------------------------------------ */
  /* Permissions / token / canaux                                         */
  /* ------------------------------------------------------------------ */
  const setupNotifications = async () => {
    try {
      // Affiche les notifications même quand l'app est au premier plan
      // + crée les canaux Android (sans canal, rien ne s'affiche sur Android 8+)
      notificationService.configureForeground();
      await notificationService.ensureChannels();

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
      console.warn('⚠️ [Notifications] setupNotifications:', error?.message);
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Signal instantané (WebSocket /ws/notifications)                      */
  /* ------------------------------------------------------------------ */
  const closeNotifSocket = () => {
    const ws = notifSocketRef.current;
    notifSocketRef.current = null;
    if (ws) {
      try {
        ws.close();
      } catch (_e) { /* no-op */ }
    }
  };

  const ensureNotifSocket = (token) => {
    if (notifSocketRef.current) return;
    if (Date.now() < notifSocketNextTryRef.current) return;

    try {
      const ws = new WebSocket(buildWsUrl('/notifications', token));
      notifSocketRef.current = ws;
      let pingTimer = null;

      ws.onopen = () => {
        notifSocketFailsRef.current = 0;
        pingTimer = setInterval(() => {
          if (ws.readyState === 1) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch (_e) { /* no-op */ }
          }
        }, NOTIF_PING_MS);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'notification') {
            pollNotifications();
          }
        } catch (_e) { /* message ignoré */ }
      };

      ws.onerror = () => { /* onclose suit */ };

      ws.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (notifSocketRef.current === ws) notifSocketRef.current = null;
        notifSocketFailsRef.current += 1;
        const delay = Math.min(2000 * 2 ** notifSocketFailsRef.current, 30000);
        notifSocketNextTryRef.current = Date.now() + delay;
      };
    } catch (error) {
      notifSocketRef.current = null;
      notifSocketFailsRef.current += 1;
      notifSocketNextTryRef.current =
        Date.now() + Math.min(2000 * 2 ** notifSocketFailsRef.current, 30000);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Polling                                                              */
  /* ------------------------------------------------------------------ */
  const extractNotifications = (result) => {
    if (!result?.success) return [];
    if (Array.isArray(result.notifications)) return result.notifications;

    const raw = result.data;
    if (Array.isArray(raw)) return raw;

    const list = raw?.notifications || raw?.items || raw?.results || raw?.data || [];
    return Array.isArray(list) ? list : [];
  };

  const getNotificationId = (n) =>
    n?.id ??
    n?.notification_id ??
    n?.notificationId ??
    `${n?.created_at || n?.createdAt || ''}-${n?.title || ''}-${n?.body || n?.message || ''}`;

  const pollNotifications = async () => {
    // Un signal reçu pendant un polling => on relance juste après
    if (pollInProgress.current) {
      pollAgain.current = true;
      return;
    }
    pollInProgress.current = true;

    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);

      if (!token) {
        // Déconnecté : plus de socket, plus de badge, cache remis à zéro
        closeNotifSocket();
        knownNotificationIds.current = new Set();
        firstNotificationPoll.current = true;
        setUnreadCount(0);
        return;
      }

      ensureNotifSocket(token);

      const result = await notificationService.getNotifications();
      if (!result?.success) return;
      const list = extractNotifications(result);

      // Tri : plus récentes en premier (created_at = UTC sans "Z" -> toTimestamp)
      const sorted = [...list].sort((a, b) => {
        const da = toTimestamp(a?.created_at || a?.createdAt);
        const db = toTimestamp(b?.created_at || b?.createdAt);
        return db - da;
      });

      if (firstNotificationPoll.current) {
        // Le premier polling initialise le cache sans afficher de faux "nouveau"
        sorted.forEach((n) => knownNotificationIds.current.add(getNotificationId(n)));
        firstNotificationPoll.current = false;
      } else {
        // Les plus anciennes d'abord => ordre d'apparition naturel
        for (const n of [...sorted].reverse()) {
          const id = getNotificationId(n);
          if (knownNotificationIds.current.has(id)) continue;
          knownNotificationIds.current.add(id);

          if (n?.is_read) continue;

          // Message de la conversation actuellement ouverte : inutile de notifier
          if (isChatNotification(n) && activeChatBookingId.current != null) {
            const data = parseNotifData(n);
            const bookingId = n?.booking_id ?? data.booking_id ?? data.bookingId;
            if (String(bookingId) === String(activeChatBookingId.current)) continue;
          }

          await notificationService.presentBackendNotification(n);
        }
      }

      // Nettoyage du cache pour éviter qu'il grossisse indéfiniment.
      if (knownNotificationIds.current.size > 300) {
        const keep = sorted.slice(0, 200).map(getNotificationId);
        knownNotificationIds.current = new Set(keep);
      }

      setUnreadCount(sorted.filter((n) => !n?.is_read).length);
    } catch (error) {
      console.warn('⚠️ [Notifications] polling:', error?.message || error);
    } finally {
      pollInProgress.current = false;
      if (pollAgain.current) {
        pollAgain.current = false;
        pollNotifications();
      }
    }
  };

  // Compteur seul (après markAsRead / markAllAsRead)
  const loadUnreadCount = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setUnreadCount(0);
        return;
      }

      const result = await notificationService.getUnreadCount();
      if (result?.success) {
        // Le backend renvoie {"unread_count": N} (fallback "count" conservé)
        const count = result.data?.unread_count ?? result.data?.count ?? 0;
        setUnreadCount(count);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.warn('⚠️ [Notifications] loadUnreadCount:', error?.message);
      setUnreadCount(0);
    }
  };

  /* ------------------------------------------------------------------ */
  /* API exposée                                                          */
  /* ------------------------------------------------------------------ */

  // Appelé par ChatScreen (via useChatRoom) : bookingId de la conversation
  // ouverte, ou null quand on la quitte / que l'app passe en arrière-plan.
  const setActiveChatBookingId = useCallback((bookingId) => {
    activeChatBookingId.current = bookingId ?? null;
  }, []);

  // Navigation au clic sur une notification native. À appeler UNE fois dans
  // un composant qui a accès à `navigation` (voir README) :
  //   setNotificationResponseHandler((data) => { ... navigation.navigate(...) })
  const setNotificationResponseHandler = useCallback((handler) => {
    responseHandlerRef.current = handler || null;
    if (handler && pendingResponseRef.current) {
      const pending = pendingResponseRef.current;
      pendingResponseRef.current = null;
      handler(pending);
    }
  }, []);

  const sendNotification = (title, body, data = {}) =>
    notificationService.sendNotification(title, body, data);

  const scheduleNotification = (title, body, seconds, data = {}) =>
    notificationService.scheduleNotification(title, body, seconds, data);

  const sendSOSNotification = (title, body, data = {}) =>
    notificationService.sendSOSNotification(title, body, data);

  const sendBookingNotification = (title, body, bookingId, data = {}) =>
    notificationService.sendBookingNotification(title, body, bookingId, data);

  // Notification liée à une négociation (offre / contre-offre)
  const sendOfferNotification = (title, body, bookingId, data = {}) =>
    notificationService.sendOfferNotification(title, body, bookingId, data);

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
    // alias explicite pour rafraîchir manuellement le badge
    refreshUnreadCount: loadUnreadCount,
    // relecture complète immédiate (ex. après avoir envoyé un message / une offre)
    refreshNotifications: pollNotifications,
    setActiveChatBookingId,
    setNotificationResponseHandler,
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