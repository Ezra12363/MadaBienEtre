// src/services/websocketService.js
import { Platform } from 'react-native';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = {};
    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Se connecter au WebSocket
   */
  connect(url, options = {}) {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const { token, onOpen, onClose, onError } = options;

    try {
      // Ajouter le token à l'URL
      const wsUrl = token ? `${url}?token=${token}` : url;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (onOpen) onOpen();
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
          if (data.type) {
            this.emit(data.type, data);
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.isConnecting = false;
        if (onClose) onClose(event);
        this.emit('disconnected', event);
        this.reconnect(url, options);
      };

      this.ws.onerror = (error) => {
        if (onError) onError(error);
        this.emit('error', error);
      };
    } catch (error) {
      this.isConnecting = false;
      console.error('WebSocket connection error:', error);
      this.reconnect(url, options);
    }
  }

  /**
   * Tentative de reconnexion
   */
  reconnect(url, options) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect(url, options);
      }
    }, delay);
  }

  /**
   * Déconnecter le WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.isConnecting = false;
      this.emit('disconnected');
    }
  }

  /**
   * Envoyer un message
   */
  send(data) {
    if (this.isConnected && this.ws) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(message);
        return true;
      } catch (error) {
        console.error('WebSocket send error:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Envoyer une mise à jour de position
   */
  sendLocationUpdate(latitude, longitude, bookingId = null) {
    return this.send({
      type: 'location_update',
      latitude,
      longitude,
      booking_id: bookingId,
    });
  }

  /**
   * Envoyer un message de chat
   */
  sendChatMessage(roomId, message, userId, username) {
    return this.send({
      type: 'chat_message',
      room_id: roomId,
      user_id: userId,
      username,
      message,
    });
  }

  /**
   * Envoyer une indication de saisie
   */
  sendTyping(roomId, userId, isTyping) {
    return this.send({
      type: 'typing',
      room_id: roomId,
      user_id: userId,
      is_typing: isTyping,
    });
  }

  /**
   * Envoyer une mise à jour de statut de réservation
   */
  sendBookingUpdate(bookingId, status, userId) {
    return this.send({
      type: 'booking_update',
      booking_id: bookingId,
      status,
      user_id: userId,
    });
  }

  /**
   * Écouter un événement
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Arrêter d'écouter un événement
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Émettre un événement
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('WebSocket event handler error:', error);
        }
      });
    }
  }

  /**
   * Vérifier si le WebSocket est connecté
   */
  isConnected() {
    return this.isConnected;
  }

  /**
   * Obtenir le statut de la connexion
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export default new WebSocketService();