// src/services/notificationService.js

import { get, put, del, post } from './api';

import { Platform, Alert } from 'react-native';

import * as Notifications from 'expo-notifications';

// ✅ Web Notification - Tsy mila package fanampiny

let webNotificationsAvailable = false;

if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {

  webNotificationsAvailable = true;

}

class NotificationService {

  constructor() {

    this.notificationPermission = false;

    this.notificationListeners = [];

    this.onWebNotificationClick = null; // (data) => void, défini par l'app

  }

  // ============================================

  // ✅ WEB NOTIFICATIONS (API native)

  // ============================================

  /**

   * Mijery raha misy permission amin'ny Web

   */

  async checkWebPermission() {

    if (Platform.OS !== 'web' || !webNotificationsAvailable) {

      return false;

    }

    if (Notification.permission === 'granted') {

      this.notificationPermission = true;

      return true;

    }

    if (Notification.permission === 'denied') {

      console.log('⚠️ Web notifications denied');

      return false;

    }

    return false;

  }

  /**

   * Mangataka permission amin'ny Web

   */

  async requestWebPermission() {

    if (Platform.OS !== 'web' || !webNotificationsAvailable) {

      return false;

    }

    try {

      const permission = await Notification.requestPermission();

      this.notificationPermission = permission === 'granted';

      return this.notificationPermission;

    } catch (error) {

      console.error('Error requesting web notification permission:', error);

      return false;

    }

  }

  /**

   * Fandefasana notification amin'ny Web

   */

  sendWebNotification(title, body, data = {}) {

    if (Platform.OS !== 'web' || !webNotificationsAvailable) {

      console.log('⚠️ Web notifications not available');

      return false;

    }

    if (Notification.permission !== 'granted') {

      console.log('⚠️ Web notification permission not granted');

      // ✅ Fallback: Alert

      Alert.alert(title, body);

      return false;

    }

    try {

      const notification = new Notification(title, {

        body: body,

        icon: '/assets/icon.png',

        badge: '/assets/icon.png',

        data: data,

        tag: String(data.notificationId || data.id || Math.random()),

        requireInteraction: true,

        vibrate: [200, 100, 200],

        silent: false,

      });

      notification.onclick = (event) => {

        try { window.focus(); } catch (_e) { /* no-op */ }

        if (typeof this.onWebNotificationClick === 'function') {

          this.onWebNotificationClick(data);

        }

        console.log('🔔 Web notification clicked:', event.target.data);

        // ✅ Naviguer vers l'écran approprié

        if (data.screen) {

          // Navigation

        }

        if (data.bookingId) {

          // Navigation vers BookingDetail

        }

        if (data.type === 'sos') {

          // Navigation vers SOS

        }

      };

      notification.onclose = () => {

        console.log('🔔 Web notification closed');

      };

      return true;

    } catch (error) {

      console.error('Error sending web notification:', error);

      Alert.alert(title, body);

      return false;

    }

  }

  // ============================================

  // ✅ MOBILE NOTIFICATIONS (Expo)

  // ============================================

  /**

   * Mijery raha misy permission amin'ny Mobile

   */

  async checkMobilePermission() {

    if (Platform.OS === 'web') {

      return false;

    }

    try {

      const { status } = await Notifications.getPermissionsAsync();

      return status === 'granted';

    } catch (error) {

      console.error('Error checking mobile permission:', error);

      return false;

    }

  }

  /**

   * Mangataka permission amin'ny Mobile

   */

  async requestMobilePermission() {

    if (Platform.OS === 'web') {

      return false;

    }

    try {

      const { status } = await Notifications.requestPermissionsAsync();

      return status === 'granted';

    } catch (error) {

      console.error('Error requesting mobile permission:', error);

      return false;

    }

  }

  /**

   * Fandefasana notification amin'ny Mobile

   */

  async sendMobileNotification(title, body, data = {}) {

    if (Platform.OS === 'web') {

      return false;

    }

    try {

      const hasPermission = await this.checkMobilePermission();

      if (!hasPermission) {

        const granted = await this.requestMobilePermission();

        if (!granted) {

          console.log('⚠️ Mobile notification permission not granted');

          Alert.alert(title, body);

          return false;

        }

      }

      // Android 8+ : la notification doit être rattachée à un canal existant

      // (voir ensureChannels). Les messages de chat ont leur propre canal.

      const channelId = data?.kind === 'chat_message' ? 'messages' : 'default';

      await Notifications.scheduleNotificationAsync({

        content: {

          title: title,

          body: body,

          data: data,

          sound: true,

          priority: Notifications.AndroidNotificationPriority.HIGH,

        },

        trigger: Platform.OS === 'android' ? { channelId } : null,

      });

      return true;

    } catch (error) {

      console.error('Error sending mobile notification:', error);

      Alert.alert(title, body);

      return false;

    }

  }

  // ============================================

  // ✅ CONFIGURATION MOBILE (premier plan + canaux Android)

  // ============================================

  /**

   * Sans handler, les notifications locales ne s'affichent PAS quand l'app

   * est ouverte (premier plan) : c'est le cas du chat. À appeler une fois.

   */

  configureForeground() {

    if (Platform.OS === 'web') return;

    try {

      Notifications.setNotificationHandler({

        handleNotification: async () => ({

          shouldShowAlert: true,

          shouldShowBanner: true,

          shouldShowList: true,

          shouldPlaySound: true,

          shouldSetBadge: false,

        }),

      });

    } catch (error) {

      console.warn('configureForeground:', error?.message);

    }

  }

  /**

   * Canaux Android (obligatoires depuis Android 8) : default, messages, sos.

   */

  async ensureChannels() {

    if (Platform.OS !== 'android') return;

    try {

      await Notifications.setNotificationChannelAsync('default', {

        name: 'Général',

        importance: Notifications.AndroidImportance.HIGH,

        vibrationPattern: [0, 250, 250, 250],

      });

      await Notifications.setNotificationChannelAsync('messages', {

        name: 'Messages',

        importance: Notifications.AndroidImportance.HIGH,

        vibrationPattern: [0, 200, 100, 200],

      });

      await Notifications.setNotificationChannelAsync('sos', {

        name: 'SOS',

        importance: Notifications.AndroidImportance.MAX,

        vibrationPattern: [0, 500, 250, 500],

      });

    } catch (error) {

      console.warn('ensureChannels:', error?.message);

    }

  }

  // ============================================

  // ✅ NOTIFICATIONS GENERIQUES

  // ============================================

  /**

   * Affiche une notification déjà créée par le BACKEND.

   *

   * Important :

   * sendNotification()/sendWebNotification() ne peuvent pas recevoir

   * automatiquement une notification créée sur FastAPI. Le frontend

   * doit d'abord appeler GET /notifications, puis afficher la nouvelle

   * notification localement.

   */

  async presentBackendNotification(notification) {

    if (!notification) return false;

    const title = notification.title || 'Mada Bien-Être';

    const body =

      notification.body ||

      notification.message ||

      'Vous avez une nouvelle notification.';

    // `data` peut arriver sous forme de chaîne JSON (colonne texte) : on la

    // parse, sinon le spread d'une chaîne casserait l'objet.

    let rawData = notification.data ?? notification.payload ?? notification.metadata ?? {};

    if (typeof rawData === 'string') {

      try {

        rawData = JSON.parse(rawData);

      } catch (_e) {

        rawData = {};

      }

    }

    if (!rawData || typeof rawData !== 'object') rawData = {};

    const data = {

      ...rawData,

      notificationId: notification.id,

      booking_id:

        notification.booking_id ??

        rawData.booking_id ??

        rawData.bookingId,

      offer_id:

        notification.offer_id ??

        rawData.offer_id,

      type: notification.type || 'system',

    };

    if (Platform.OS === 'web') {

      return this.sendWebNotification(title, body, data);

    }

    return this.sendMobileNotification(title, body, data);

  }

  /**

   * Fandefasana notification (Web ou Mobile)

   */

  async sendNotification(title, body, data = {}) {

    if (Platform.OS === 'web') {

      return this.sendWebNotification(title, body, data);

    } else {

      return await this.sendMobileNotification(title, body, data);

    }

  }

  /**

   * Notification programmée (Web ou Mobile)

   */

  async scheduleNotification(title, body, seconds, data = {}) {

    if (Platform.OS === 'web') {

      // ✅ Web notification programmée (setTimeout)

      setTimeout(() => {

        this.sendWebNotification(title, body, data);

      }, seconds * 1000);

      return true;

    }

    try {

      await Notifications.scheduleNotificationAsync({

        content: {

          title: title,

          body: body,

          data: data,

          sound: true,

        },

        trigger: {

          seconds: seconds,

          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,

        },

      });

      return true;

    } catch (error) {

      console.error('Error scheduling notification:', error);

      return false;

    }

  }

  /**

   * Notification SOS (urgence)

   */

  async sendSOSNotification(title, body, data = {}) {

    if (Platform.OS === 'web') {

      return this.sendWebNotification('🚨 SOS - ' + title, body, { ...data, type: 'sos' });

    }

    try {

      await Notifications.scheduleNotificationAsync({

        content: {

          title: '🚨 SOS - ' + title,

          body: body,

          data: { ...data, type: 'sos' },

          sound: true,

          priority: Notifications.AndroidNotificationPriority.MAX,

          channelId: 'sos',

        },

        trigger: null,

      });

      return true;

    } catch (error) {

      console.error('Error sending SOS notification:', error);

      return false;

    }

  }

  /**

   * Notification de réservation

   */

  async sendBookingNotification(title, body, bookingId, data = {}) {

    return this.sendNotification(title, body, {

      ...data,

      type: 'booking',

      bookingId: bookingId,

      screen: 'BookingDetail'

    });

  }

  /**

   * Notification de massage

   */

  async sendMassageNotification(title, body, massageId, data = {}) {

    return this.sendNotification(title, body, {

      ...data,

      type: 'massage',

      massageId: massageId,

      screen: 'MassageDetail'

    });

  }

  /**

   * ✅ Notification de négociation / offre

   * (nouvelle offre, contre-offre, acceptation, refus)

   */

  async sendOfferNotification(title, body, bookingId, data = {}) {

    return this.sendNotification(title, body, {

      ...data,

      type: 'offer',

      bookingId: bookingId,

      screen: 'Offers'

    });

  }

  /**

   * Notification de paiement

   */

  async sendPaymentNotification(title, body, paymentId, data = {}) {

    return this.sendNotification(title, body, {

      ...data,

      type: 'payment',

      paymentId: paymentId,

      screen: 'PaymentDetail'

    });

  }

  // ============================================

  // ✅ GESTION DES NOTIFICATIONS (API)

  // ============================================

  /**

   * Obtenir les notifications

   */

  async getNotifications(params = {}) {

    try {

      const response = await get('/notifications', params);

      if (response.error) {

        return { success: false, error: response.error.message };

      }

      // FastAPI peut renvoyer directement une liste ou un objet

      // {notifications/items/results/data: [...]}. On conserve la

      // réponse brute mais on expose aussi une liste normalisée.

      const raw = response.data;

      const list = Array.isArray(raw)

        ? raw

        : (

            raw?.notifications ||

            raw?.items ||

            raw?.results ||

            raw?.data ||

            []

          );

      return {

        success: true,

        data: raw,

        notifications: Array.isArray(list) ? list : [],

      };

    } catch (error) {

      return { success: false, error: error.message || 'Erreur lors du chargement' };

    }

  }

  /**

   * Obtenir les notifications non lues

   */

  async getUnreadNotifications() {

    return this.getNotifications({ is_read: false });

  }

  /**

   * Obtenir le nombre de notifications non lues

   */

  async getUnreadCount() {

    try {

      const response = await get('/notifications/unread-count');

      if (response.error) {

        return { success: false, error: response.error.message };

      }

      return { success: true, data: response.data };

    } catch (error) {

      return { success: false, error: error.message || 'Erreur lors du chargement' };

    }

  }

  /**

   * Marquer une notification comme lue

   */

  async markAsRead(notificationId) {

    try {

      const response = await put(`/notifications/read/${notificationId}`);

      if (response.error) {

        return { success: false, error: response.error.message };

      }

      return { success: true, data: response.data };

    } catch (error) {

      return { success: false, error: error.message || 'Erreur lors du marquage' };

    }

  }

  /**

   * Marquer toutes les notifications comme lues

   */

  async markAllAsRead() {

    try {

      const response = await put('/notifications/read-all');

      if (response.error) {

        return { success: false, error: response.error.message };

      }

      return { success: true, data: response.data };

    } catch (error) {

      return { success: false, error: error.message || 'Erreur lors du marquage' };

    }

  }

  /**

   * Supprimer une notification

   */

  async deleteNotification(notificationId) {

    try {

      const response = await del(`/notifications/${notificationId}`);

      if (response.error) {

        return { success: false, error: response.error.message };

      }

      return { success: true, data: response.data };

    } catch (error) {

      return { success: false, error: error.message || 'Erreur lors de la suppression' };

    }

  }

  /**

   * Supprimer toutes les notifications

   */

  async deleteAllNotifications() {

    try {

      const response = await del('/notifications/all');

      if (response.error) {

        return { success: false, error: response.error.message };

      }

      return { success: true, data: response.data };

    } catch (error) {

      return { success: false, error: error.message || 'Erreur lors de la suppression' };

    }

  }

  /**

   * Obtenir les préférences de notification

   */

  async getPreferences() {

    try {

      const response = await get('/notifications/preferences');

      if (response.error) {

        return { success: false, error: response.error.message };

      }

      return { success: true, data: response.data };

    } catch (error) {

      return { success: false, error: error.message || 'Erreur lors du chargement' };

    }

  }

  /**

   * Mettre à jour les préférences de notification

   */

  async updatePreferences(data) {

    try {

      const response = await put('/notifications/preferences', data);

      if (response.error) {

        return { success: false, error: response.error.message };

      }

      return { success: true, data: response.data };

    } catch (error) {

      return { success: false, error: error.message || 'Erreur lors de la mise à jour' };

    }

  }

  // ============================================

  // ✅ UTILITAIRES

  // ============================================

  /**

   * Mijery raha misy permission

   */

  async checkPermission() {

    if (Platform.OS === 'web') {

      return await this.checkWebPermission();

    } else {

      return await this.checkMobilePermission();

    }

  }

  /**

   * Mangataka permission

   */

  async requestPermission() {

    if (Platform.OS === 'web') {

      return await this.requestWebPermission();

    } else {

      return await this.requestMobilePermission();

    }

  }

  /**

   * Mahazo ny token (ho an'ny mobile)

   */

  async getPushToken() {

    if (Platform.OS === 'web') {

      return null;

    }

    // ✅ FCM (Firebase) non configuré : inutile de réessayer à chaque lancement.
    if (this._pushUnavailable) {
      return null;
    }

    try {

      let projectId;

      try {

        const Constants = require('expo-constants').default;

        projectId =

          Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

      } catch (_e) { /* expo-constants absent */ }

      const token = projectId

        ? await Notifications.getExpoPushTokenAsync({ projectId })

        : await Notifications.getExpoPushTokenAsync();

      return token.data;

    } catch (error) {

      // ✅ FIX « Default FirebaseApp is not initialized » : sur Android, les
      // notifications push (FCM) exigent google-services.json dans le build.
      // Sans lui, ce n'est PAS un bug de code : on désactive simplement le
      // push distant. L'app continue de fonctionner (WebSocket + polling +
      // notifications locales). Voir app.json -> android.googleServicesFile.
      const message = String(error?.message || error || '');
      const fcmMissing =
        /FirebaseApp|Firebase Messaging|googleServicesFile|fcm-credentials/i.test(message);

      if (fcmMissing) {
        this._pushUnavailable = true;
        console.warn(
          '⚠️ [Push] Firebase (FCM) non configuré — push distant désactivé. ' +
            'Ajoutez google-services.json et "android.googleServicesFile" dans app.json, ' +
            'puis refaites un build (le push ne marche pas dans Expo Go).'
        );
      } else {
        console.warn('⚠️ [Push] Impossible d\'obtenir le token push :', message);
      }

      return null;

    }

  }

  /**

   * Mametraka ny notification handler (mobile)

   */

  setNotificationHandler(handler) {

    if (Platform.OS === 'web') {

      return;

    }

    Notifications.setNotificationHandler(handler);

  }

  /**

   * Mihaino notifications (mobile)

   */

  addNotificationListener(callback) {

    if (Platform.OS === 'web') {

      return null;

    }

    const subscription = Notifications.addNotificationReceivedListener(callback);

    this.notificationListeners.push(subscription);

    return subscription;

  }

  /**

   * Mihaino ny clic amin'ny notification (mobile)

   */

  addNotificationResponseListener(callback) {

    if (Platform.OS === 'web') {

      return null;

    }

    const subscription = Notifications.addNotificationResponseReceivedListener(callback);

    this.notificationListeners.push(subscription);

    return subscription;

  }

  /**

   * Manala ny listeners rehetra

   */

  removeAllListeners() {

    this.notificationListeners.forEach(listener => {

      try {

        listener.remove();

      } catch (error) {

        console.error('Error removing listener:', error);

      }

    });

    this.notificationListeners = [];

  }

  /**

   * Manala ny listener iray

   */

  removeListener(subscription) {

    if (subscription) {

      try {

        subscription.remove();

      } catch (error) {

        console.error('Error removing listener:', error);

      }

    }

  }

  /**
   * ADMIN : Vérifier · Approuver · Rejeter · Marquer comme traité (depuis une notification).
   * @param {number|string} id    notification
   * @param {'verify'|'approve'|'reject'|'handled'} action
   * @param {string} [reason]     motif (rejet)
   * @returns {{success:boolean, message?:string, handled?:boolean, data?:object, error?:string}}
   */
  async adminAction(id, action, reason) {
    try {
      const response = await post(`/notifications/${id}/admin-action`, {
        action,
        reason: reason || undefined,
      });
      if (response?.error) {
        return { success: false, error: response.error.message || "L'action a échoué." };
      }
      return { success: true, ...(response.data || {}) };
    } catch (error) {
      return { success: false, error: error?.message || "L'action a échoué." };
    }
  }

  /**

   * Mamono ny notifications rehetra (mobile)

   */

  async cancelAllNotifications() {

    if (Platform.OS === 'web') {

      return;

    }

    try {

      await Notifications.cancelAllScheduledNotificationsAsync();

      return true;

    } catch (error) {

      console.error('Error canceling notifications:', error);

      return false;

    }

  }

}

export default new NotificationService();
