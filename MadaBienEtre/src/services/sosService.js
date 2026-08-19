// src/services/sosService.js
import { get, post, put, handleApiError } from './api';
import * as Location from 'expo-location';

class SOSService {
  /**
   * Créer une alerte SOS
   */
  async createSOSAlert(sosData) {
    try {
      // Si les coordonnées ne sont pas fournies, obtenir la position actuelle
      if (!sosData.latitude || !sosData.longitude) {
        const location = await this.getCurrentLocation();
        if (location.success) {
          sosData.latitude = location.data.latitude;
          sosData.longitude = location.data.longitude;
        }
      }

      const response = await post('/sos/create', sosData);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la création de l\'alerte' };
    }
  }

  /**
   * Obtenir toutes les alertes SOS
   */
  async getSOSAlerts(status = null) {
    try {
      const params = status ? { status } : {};
      const response = await get('/sos', params);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir une alerte SOS spécifique
   */
  async getSOSAlert(sosId) {
    try {
      const response = await get(`/sos/${sosId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Fermer une alerte SOS (Admin)
   */
  async closeSOSAlert(sosId, notes = '') {
    try {
      const response = await put(`/sos/close/${sosId}`, { response_notes: notes });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la fermeture' };
    }
  }

  /**
   * Obtenir les alertes SOS actives (Admin)
   */
  async getActiveSOSAlerts() {
    try {
      const response = await get('/sos/admin/active');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir les statistiques SOS (Admin)
   */
  async getSOSStats() {
    try {
      const response = await get('/sos/stats');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir la position actuelle
   */
  async getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, error: 'Permission de localisation refusée' };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        success: true,
        data: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la localisation' };
    }
  }

  /**
   * Envoyer une notification d'urgence
   */
  async sendEmergencyNotification(userId, message, data = {}) {
    try {
      const response = await post('/notifications/emergency', {
        user_id: userId,
        message,
        data,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de l\'envoi' };
    }
  }

  /**
   * Vérifier si une alerte est critique
   */
  isCritical(alert) {
    return alert?.severity === 'critical' || alert?.severity === 'high';
  }

  /**
   * Formater les coordonnées pour l'affichage
   */
  formatCoordinates(latitude, longitude) {
    if (!latitude || !longitude) return 'Position inconnue';
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }

  /**
   * Obtenir le lien de la position sur Google Maps
   */
  getGoogleMapsLink(latitude, longitude) {
    if (!latitude || !longitude) return null;
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
}

export default new SOSService();