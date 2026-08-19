// src/services/notificationService.js
import { get, put, del, handleApiError } from './api';
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
        tag: data.id || Math.random().toString(),
        requireInteraction: true,
        vibrate: [200, 100, 200],
        silent: false,
      });

      notification.onclick = (event) => {
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

      await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          data: data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });

      return true;
    } catch (error) {
      console.error('Error sending mobile notification:', error);
      Alert.alert(title, body);
      return false;
    }
  }

  // ============================================
  // ✅ NOTIFICATIONS GENERIQUES
  // ============================================

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
          sound: 'default',
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
          sound: 'default',
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
      return { success: true, data: response.data };
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
    
    try {
      const token = await Notifications.getExpoPushTokenAsync();
      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
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