// src/services/paymentService.js
import { get, post, put, handleApiError } from './api';

class PaymentService {
  /**
   * Créer un paiement
   */
  async createPayment(paymentData) {
    try {
      const response = await post('/payments/create', paymentData);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du paiement' };
    }
  }

  /**
   * Paiement Mobile Money
   */
  async payWithMobileMoney(bookingId, amount, phone, provider) {
    try {
      const response = await post('/payments/mobile-money', {
        booking_id: bookingId,
        amount,
        phone,
        provider,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du paiement Mobile Money' };
    }
  }

  /**
   * Paiement par carte bancaire
   */
  async payWithCard(bookingId, amount, cardToken) {
    try {
      const response = await post('/payments/card', {
        booking_id: bookingId,
        amount,
        card_token: cardToken,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du paiement par carte' };
    }
  }

  /**
   * Paiement Vanila Pay
   */
  async payWithVanilaPay(bookingId, amount) {
    try {
      const response = await post('/payments/vanila-pay', {
        booking_id: bookingId,
        amount,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du paiement Vanila Pay' };
    }
  }

  /**
   * Obtenir l'historique des paiements
   */
  async getPaymentHistory() {
    try {
      const response = await get('/payments/history');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir un paiement spécifique
   */
  async getPayment(paymentId) {
    try {
      const response = await get(`/payments/${paymentId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Rembourser un paiement
   */
  async refundPayment(paymentId, amount = null, reason = '') {
    try {
      const response = await post('/payments/refund', {
        payment_id: paymentId,
        amount,
        reason,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du remboursement' };
    }
  }

  /**
   * Vérifier le statut d'un paiement
   */
  async verifyPayment(transactionId) {
    try {
      const response = await post(`/payments/verify/${transactionId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la vérification' };
    }
  }

  /**
   * Obtenir les méthodes de paiement disponibles
   */
  async getPaymentMethods() {
    try {
      const response = await get('/payments/methods');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }
}

export default new PaymentService();