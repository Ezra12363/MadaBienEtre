// src/services/aiService.js
import { get, post, handleApiError } from './api';

class AIService {
  /**
   * Recommander des thérapeutes
   */
  async recommendTherapists(params) {
    try {
      const response = await post('/ai/recommend-therapist', params);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la recommandation' };
    }
  }

  /**
   * Prédire le prix
   */
  async predictPrice(params) {
    try {
      const response = await post('/ai/predict-price', params);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la prédiction' };
    }
  }

  /**
   * Prédire la probabilité d'acceptation
   */
  async predictAcceptance(bookingId, price) {
    try {
      const response = await post('/ai/predict-acceptance', { booking_id: bookingId, price });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la prédiction' };
    }
  }

  /**
   * Détecter la fraude
   */
  async detectFraud(bookingId) {
    try {
      const response = await post('/ai/fraud-detection', { booking_id: bookingId });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la détection' };
    }
  }

  /**
   * Obtenir les services populaires
   */
  async getPopularServices(period = 'month') {
    try {
      const response = await get('/ai/popular-services', { period });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir les meilleurs thérapeutes
   */
  async getBestTherapists(limit = 10) {
    try {
      const response = await get('/ai/best-therapists', { limit });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir les prédictions de revenus
   */
  async getRevenuePrediction(therapistId = null) {
    try {
      const params = therapistId ? { therapist_id: therapistId } : {};
      const response = await get('/ai/revenue-prediction', params);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir les insights IA
   */
  async getAIInsights() {
    try {
      const response = await get('/ai/insights');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Chatbot IA
   */
  async chatWithAI(message, conversationId = null) {
    try {
      const response = await post('/chatbot/message', {
        message,
        conversation_id: conversationId,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chat' };
    }
  }

  /**
   * Obtenir les suggestions du chatbot
   */
  async getChatSuggestions() {
    try {
      const response = await get('/chatbot/suggestions');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * FAQ du chatbot
   */
  async getFAQAnswer(question) {
    try {
      const response = await post('/chatbot/faq', { question });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }
}

export default new AIService();