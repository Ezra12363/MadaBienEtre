// src/services/offerService.js
import { get, post, put, handleApiError } from './api';

class OfferService {
  /**
   * Créer une offre
   */
  async createOffer(offerData) {
    try {
      const response = await post('/offers/create', offerData);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la création' };
    }
  }

  /**
   * Obtenir les offres d'une réservation
   */
  async getOffersByBooking(bookingId) {
    try {
      const response = await get(`/offers/booking/${bookingId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Accepter une offre
   */
  async acceptOffer(offerId) {
    try {
      const response = await post(`/offers/${offerId}/accept`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de l\'acceptation' };
    }
  }

  /**
   * Rejeter une offre
   */
  async rejectOffer(offerId) {
    try {
      const response = await post(`/offers/${offerId}/reject`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du rejet' };
    }
  }

  /**
   * Faire une contre-offre
   */
  async counterOffer(offerId, counterPrice, message = '') {
    try {
      const response = await post(`/offers/${offerId}/counter`, {
        counter_price: counterPrice,
        message,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la contre-offre' };
    }
  }

  /**
   * Obtenir l'historique des négociations
   */
  async getNegotiationHistory(bookingId) {
    return this.getOffersByBooking(bookingId);
  }

  /**
   * Envoyer une offre de prix (thérapeute)
   */
  async sendOffer(bookingId, price, message = '') {
    return this.createOffer({
      booking_id: bookingId,
      price_offered: price,
      message,
    });
  }

  /**
   * Accepter une offre client (thérapeute)
   */
  async acceptClientOffer(offerId) {
    return this.acceptOffer(offerId);
  }

  /**
   * Rejeter une offre client (thérapeute)
   */
  async rejectClientOffer(offerId) {
    return this.rejectOffer(offerId);
  }
}

export default new OfferService();