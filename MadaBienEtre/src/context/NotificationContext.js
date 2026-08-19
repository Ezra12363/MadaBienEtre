// src/context/NotificationContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import notificationService from '../services/notificationService';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setupNotifications();
    loadUnreadCount();

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
        setUnreadCount(result.data?.count || 0);
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
    markAsRead,
    markAllAsRead,
    loadUnreadCount,
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