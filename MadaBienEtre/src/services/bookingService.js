// src/services/bookingService.js
import { get, post, put, del, handleApiError } from './api';

class BookingService {
  /**
   * Créer une réservation
   */
  async createBooking(bookingData) {
    try {
      const response = await post('/bookings', bookingData);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la création' };
    }
  }

  /**
   * Obtenir toutes les réservations
   */
  async getBookings(params = {}) {
    try {
      const response = await get('/bookings', params);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir une réservation spécifique
   */
  async getBooking(bookingId) {
    try {
      const response = await get(`/bookings/${bookingId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Mettre à jour une réservation
   */
  async updateBooking(bookingId, data) {
    try {
      const response = await put(`/bookings/${bookingId}`, data);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la mise à jour' };
    }
  }

  /**
   * Annuler une réservation
   */
  async cancelBooking(bookingId, reason = '') {
    try {
      const response = await put(`/bookings/cancel/${bookingId}`, { reason });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de l\'annulation' };
    }
  }

  /**
   * Démarrer une réservation (thérapeute)
   */
  async startBooking(bookingId) {
    try {
      const response = await put(`/bookings/start/${bookingId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du démarrage' };
    }
  }

  /**
   * Terminer une réservation (thérapeute)
   */
  async completeBooking(bookingId) {
    try {
      const response = await put(`/bookings/complete/${bookingId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la finalisation' };
    }
  }

  /**
   * Obtenir les réservations d'un client
   */
  async getClientBookings(clientId) {
    return this.getBookings({ client_id: clientId });
  }

  /**
   * Obtenir les réservations d'un thérapeute
   */
  async getTherapistBookings(therapistId) {
    return this.getBookings({ therapist_id: therapistId });
  }

  /**
   * Obtenir les réservations par statut
   */
  async getBookingsByStatus(status) {
    return this.getBookings({ status });
  }

  /**
   * Obtenir les réservations à venir
   */
  async getUpcomingBookings() {
    return this.getBookings({ status: 'confirmed' });
  }

  /**
   * Obtenir l'historique des réservations
   */
  async getBookingHistory() {
    return this.getBookings({ status: 'completed' });
  }

  /**
   * Obtenir les réservations en attente
   */
  async getPendingBookings() {
    return this.getBookings({ status: 'pending' });
  }

  /**
   * Obtenir les réservations en négociation
   */
  async getNegotiatingBookings() {
    return this.getBookings({ status: 'negotiating' });
  }
}

export default new BookingService();