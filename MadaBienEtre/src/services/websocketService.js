// src/services/websocketService.js

// ============================================================

// Service WebSocket partagé (chat, statut de réservation, suivi GPS...).

//

// ✅ CORRIGÉ par rapport à l'ancienne version :

//  1) `isConnected` : la propriété booléenne masquait la méthode du même nom

//     (`isConnected()` plantait). La propriété reste (compatibilité avec le

//     code existant qui lit `websocketService.isConnected`) ; la méthode est

//     remplacée par `isOpen()`.

//  2) `disconnect()` ne relance PLUS une reconnexion automatique (avant,

//     `onclose` appelait `reconnect()` même après une fermeture voulue).

//  3) Les événements d'une ancienne socket ne polluent plus la nouvelle

//     (chaque handler vérifie qu'il appartient à la socket courante).

//  4) Le timer de reconnexion est annulable (aucune reconnexion "fantôme").

//  5) Heartbeat (ping toutes les 25 s) pour garder la connexion ouverte.

//  6) Erreurs fatales du serveur (auth / droits / réservation) : plus de

//     reconnexion inutile.

//  7) Token encodé (encodeURIComponent) et URL qui contient déjà un "?".

//  8) `connectTracking(bookingId, token, { viewer })` : connexion au suivi

//     GPS /ws/tracking/{id}. `viewer: true` = lecture seule (écran web du

//     thérapeute qui reçoit la position GPS de son téléphone).

// ============================================================

import { API_URL } from '../config/env';

const PING_INTERVAL_MS = 25000;

const MAX_BACKOFF_MS = 15000;

const FATAL_ERRORS = ['Authentication failed', 'Not authorized', 'Booking not found'];

// http://host:8000 -> ws://host:8000 ; https:// -> wss\://

// Convertit une URL HTTP(S) de base en URL WebSocket (WS/WSS).
const toWsBase = (base) => {
  const value = String(base || '').trim().replace(/\/+$/, '');
  if (/^https:\/\//i.test(value)) return value.replace(/^https:/i, 'wss:');
  if (/^http:\/\//i.test(value)) return value.replace(/^http:/i, 'ws:');
  if (/^wss?:\/\//i.test(value)) return value;
  throw new Error(`API_URL invalide pour WebSocket : "${value}"`);
};

// Accepte une URL complète ou un chemin /ws/... à compléter avec API_URL.
const normalizeWsUrl = (url) => {
  const value = String(url || '').trim();
  if (/^wss?:\/\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  }
  if (value.startsWith('/')) return `${toWsBase(API_URL)}${value}`;
  throw new Error(`URL WebSocket invalide : "${value}"`);
};

const withQuery = (url, params) => {

  const query = Object.entries(params)

    .filter(([, value]) => value !== undefined && value !== null && value !== '')

    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)

    .join('&');

  if (!query) return url;

  return `${url}${url.includes('?') ? '&' : '?'}${query}`;

};

const cleanToken = (token) => {

  if (!token) return '';

  let t = typeof token === 'object' ? token.access_token || token.token || '' : token;

  t = String(t).replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '').trim();

  return t;

};

class WebSocketService {

  constructor() {

    this.ws = null;

    this.reconnectAttempts = 0;

    this.maxReconnectAttempts = 5;

    this.reconnectDelay = 3000;

    this.listeners = {};

    // ⚠️ Propriétés booléennes (lues directement par le code existant)

    this.isConnected = false;

    this.isConnecting = false;

    this.closedByUser = false;

    this.fatal = false;

    this.reconnectTimer = null;

    this.pingTimer = null;

    this.lastUrl = null;

    this.lastOptions = {};

  }

  // ----------------------------------------------------------

  // Connexion

  // ----------------------------------------------------------

  /**

   * Se connecter au WebSocket

   * @param {string} url      ex : ws://host:8000/ws/chat/12

   * @param {Object} options  { token, onOpen, onClose, onError }

   */

  connect(url, options = {}) {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    let normalizedUrl;
    try {
      normalizedUrl = normalizeWsUrl(url);
    } catch (error) {
      console.error('URL WebSocket invalide :', error.message);
      this.isConnecting = false;
      return;
    }

    this.closedByUser = false;
    this.fatal = false;
    this.lastUrl = normalizedUrl;
    this.lastOptions = options;
    this.isConnecting = true;

    const { token, onOpen, onClose, onError } = options;
    const finalToken = cleanToken(token);
    const wsUrl = finalToken ? withQuery(normalizedUrl, { token: finalToken }) : normalizedUrl;

    let socket;

    try {

      socket = new WebSocket(wsUrl);

    } catch (error) {

      this.isConnecting = false;

      console.error('WebSocket connection error:', error);

      this.scheduleReconnect();

      return;

    }

    this.ws = socket;

    socket.onopen = () => {

      if (this.ws !== socket) return;

      this.isConnected = true;

      this.isConnecting = false;

      this.reconnectAttempts = 0;

      this.startPing(socket);

      if (onOpen) onOpen();

      this.emit('connected');

    };

    socket.onmessage = (event) => {

      if (this.ws !== socket) return;

      try {

        const data = JSON.parse(event.data);

        if (data?.error && FATAL_ERRORS.includes(data.error)) {

          this.fatal = true;

        }

        this.emit('message', data);

        if (data?.type) {

          this.emit(data.type, data);

        }

      } catch (error) {

        console.error('WebSocket message parse error:', error);

      }

    };

    socket.onclose = (event) => {

      this.stopPing();

      if (this.ws !== socket) return; // ancienne socket : on ignore

      this.ws = null;

      this.isConnected = false;

      this.isConnecting = false;

      if (onClose) onClose(event);

      this.emit('disconnected', event);

      // Fermeture voulue ou erreur fatale : pas de reconnexion

      if (this.closedByUser || this.fatal) return;

      this.scheduleReconnect();

    };

    socket.onerror = (error) => {

      if (this.ws !== socket) return;

      // `onclose` suit toujours : la reconnexion est gérée là

      if (onError) onError(error);

      this.emit('error', error);

    };

  }

  /**

   * Connexion au suivi GPS d'une réservation : /ws/tracking/{bookingId}

   * @param {number|string} bookingId

   * @param {string} token

   * @param {Object} opts { viewer?: boolean (lecture seule), onOpen, onClose, onError }

   */

  connectTracking(bookingId, token, { viewer = false, ...handlers } = {}) {

    const url = `${toWsBase(API_URL)}/ws/tracking/${bookingId}`;

    this.connect(withQuery(url, { viewer: viewer ? 1 : undefined }), {

      token,

      ...handlers,

    });

  }

  // ----------------------------------------------------------

  // Reconnexion / heartbeat

  // ----------------------------------------------------------

  scheduleReconnect() {

    if (this.closedByUser || this.fatal || !this.lastUrl) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {

      this.emit('reconnect_failed');

      return;

    }

    this.reconnectAttempts += 1;

    const delay = Math.min(

      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),

      MAX_BACKOFF_MS

    );

    clearTimeout(this.reconnectTimer);

    this.reconnectTimer = setTimeout(() => {

      this.reconnectTimer = null;

      if (!this.isConnected && !this.isConnecting && !this.closedByUser) {

        this.connect(this.lastUrl, this.lastOptions);

      }

    }, delay);

  }

  startPing(socket) {

    this.stopPing();

    this.pingTimer = setInterval(() => {

      if (this.ws === socket && socket.readyState === 1) {

        try {

          socket.send(JSON.stringify({ type: 'ping' }));

        } catch (_e) { /* no-op */ }

      }

    }, PING_INTERVAL_MS);

  }

  stopPing() {

    if (this.pingTimer) clearInterval(this.pingTimer);

    this.pingTimer = null;

  }

  /**

   * Déconnecter le WebSocket (sans reconnexion automatique)

   */

  disconnect() {

    this.closedByUser = true;

    clearTimeout(this.reconnectTimer);

    this.reconnectTimer = null;

    this.stopPing();

    this.reconnectAttempts = 0;

    const socket = this.ws;

    this.ws = null;

    this.isConnected = false;

    this.isConnecting = false;

    if (socket) {

      try { socket.close(); } catch (_e) { /* no-op */ }

    }

    this.emit('disconnected');

  }

  // ----------------------------------------------------------

  // Envoi

  // ----------------------------------------------------------

  /**

   * Envoyer un message (true si envoyé)

   */

  send(data) {

    if (this.ws && this.ws.readyState === 1) {

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

  sendLocationUpdate(latitude, longitude, bookingId = null, extra = {}) {

    return this.send({

      type: 'location_update',

      latitude,

      longitude,

      booking_id: bookingId,

      ...extra, // heading, speed, accuracy...

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

  // ----------------------------------------------------------

  // Événements

  // ----------------------------------------------------------

  /**

   * Écouter un événement (renvoie une fonction de désinscription)

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

      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);

    }

  }

  /**

   * Émettre un événement

   */

  emit(event, data) {

    if (this.listeners[event]) {

      this.listeners[event].forEach((callback) => {

        try {

          callback(data);

        } catch (error) {

          console.error('WebSocket event handler error:', error);

        }

      });

    }

  }

  // ----------------------------------------------------------

  // État

  // ----------------------------------------------------------

  /**

   * Socket réellement ouverte ? (remplace l'ancienne méthode isConnected(),

   * masquée par la propriété du même nom)

   */

  isOpen() {

    return !!this.ws && this.ws.readyState === 1;

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