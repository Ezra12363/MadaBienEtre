// src/services/therapistService.js
import { get, post, put, del, handleApiError } from './api';

class TherapistService {
  /**
   * Postuler comme thérapeute
   */
  async applyAsTherapist(formData) {
    try {
      const response = await post('/therapists/apply', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la candidature' };
    }
  }

  /**
   * Obtenir tous les thérapeutes
   */
  async getTherapists(params = {}) {
    try {
      const response = await get('/therapists', params);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir un thérapeute spécifique
   */
  async getTherapist(therapistId) {
    try {
      const response = await get(`/therapists/${therapistId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Mettre à jour un thérapeute
   */
  async updateTherapist(therapistId, data) {
    try {
      const response = await put(`/therapists/${therapistId}`, data);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la mise à jour' };
    }
  }

  /**
   * Basculer le mode en ligne/hors ligne
   */
  async toggleOnline() {
    try {
      const response = await post('/therapists/toggle-online');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du changement de statut' };
    }
  }

  /**
   * Obtenir le statut de vérification
   */
  async getVerificationStatus() {
    try {
      const response = await get('/therapists/status');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir les gains du thérapeute
   */
  async getEarnings(period = 'month') {
    try {
      const response = await get('/therapists/earnings', { period });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Uploader la pièce d'identité
   */
  async uploadCIN(formData) {
    try {
      const response = await post('/therapists/upload-cin', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du téléchargement' };
    }
  }

  /**
   * Uploader le certificat professionnel
   */
  async uploadCertificate(formData) {
    try {
      const response = await post('/therapists/upload-certificate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du téléchargement' };
    }
  }

  /**
   * Obtenir les thérapeutes à proximité
   */
  async getNearbyTherapists(latitude, longitude, radius = 10) {
    try {
      const response = await get('/geolocation/nearby-therapists', {
        latitude,
        longitude,
        radius_km: radius,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir les disponibilités du thérapeute
   */
  async getAvailability() {
    try {
      const response = await get('/therapists/availability');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Mettre à jour les disponibilités
   */
  async updateAvailability(data) {
    try {
      const response = await put('/therapists/availability', data);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la mise à jour' };
    }
  }

  // ============================================================
  // ✅ NOUVELLES MÉTHODES POUR LA VÉRIFICATION ET LE CERTIFICAT
  // ============================================================

  /**
   * Obtenir le statut de vérification du thérapeute connecté
   */
  async getMyVerificationStatus() {
    try {
      const response = await get('/therapists/me/verification');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      console.error('getMyVerificationStatus:', error);
      return {
        success: false,
        error: error?.response?.data?.detail ||
               error?.response?.data?.message ||
               error?.message ||
               'Erreur lors du chargement du statut.',
      };
    }
  }

  /**
   * Obtenir les détails du certificat du thérapeute connecté
   */
  async getMyCertificate() {
    try {
      const response = await get('/therapists/me/certificate');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      console.error('getMyCertificate:', error);
      return {
        success: false,
        error: error?.response?.data?.detail ||
               error?.response?.data?.message ||
               error?.message ||
               'Erreur lors du chargement du certificat.',
      };
    }
  }

  /**
   * Obtenir l'URL de téléchargement du certificat
   */
  getCertificateDownloadUrl() {
    return '/therapists/me/certificate/download';
  }
}

export default new TherapistService();