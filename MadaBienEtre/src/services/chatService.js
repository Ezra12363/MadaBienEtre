// src/services/chatService.js
import { get, post, put, del } from './api';

class ChatService {
  /**
   * Obtenir l'historique des messages
   */
  async getChatHistory(bookingId) {
    try {
      const response = await get(`/chat/history/${bookingId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Envoyer un message
   */
  async sendMessage(bookingId, message) {
    try {
      const response = await post(`/chat/send/${bookingId}`, { message });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de l\'envoi' };
    }
  }

  /**
   * Marquer les messages comme lus
   */
  async markAsRead(bookingId) {
    try {
      const response = await put(`/chat/read/${bookingId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du marquage' };
    }
  }

  /**
   * Obtenir les conversations
   */
  async getConversations() {
    try {
      const response = await get('/chat/conversations');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Obtenir les messages non lus
   */
  async getUnreadCount() {
    try {
      const response = await get('/chat/unread');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement' };
    }
  }

  /**
   * Envoyer une image
   */
  async sendImage(bookingId, imageUri) {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'image.jpg',
      });
      
      const response = await post(`/chat/send-image/${bookingId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de l\'envoi de l\'image' };
    }
  }

  /**
   * Partager une position (location_type : 'booking' | 'live')
   */
  async sendLocation(bookingId, { latitude, longitude, address, locationType, clientId }) {
    try {
      const response = await post(`/chat/send-location/${bookingId}`, {
        latitude,
        longitude,
        address: address || null,
        location_type: locationType,
        client_id: clientId || null,
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du partage de position' };
    }
  }

  /**
   * Partager l'adresse + les informations de la réservation dans la conversation
   */
  async shareBooking(bookingId) {
    try {
      const response = await post(`/chat/share-booking/${bookingId}`, {});
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error:
          error?.response?.data?.detail ||
          error.message ||
          'Erreur lors du partage de la réservation',
      };
    }
  }

  /**
   * Lieu de la réservation (adresse + GPS)
   */
  async getBookingLocation(bookingId) {
    try {
      const response = await get(`/chat/booking-location/${bookingId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors du chargement du lieu' };
    }
  }

  /**
   * Supprimer un message
   */
  async deleteMessage(messageId) {
    try {
      const response = await del(`/chat/message/${messageId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message || 'Erreur lors de la suppression' };
    }
  }
}

export default new ChatService();