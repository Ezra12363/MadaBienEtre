// src/services/trackingSocket.js
// ============================================================
// Client WebSocket partagé (thérapeute ET client) pour le suivi
// en temps réel d'une réservation : /ws/tracking/{booking_id}
//
// ✅ Reconnexion automatique (backoff exponentiel)
// ✅ Heartbeat (ping toutes les 25 s) pour garder la connexion
// ✅ Pas de file d'attente pour les positions : une position
//    périmée n'a aucun intérêt, on n'envoie que si la socket est
//    ouverte (send() renvoie true/false).
// ✅ Arrêt des reconnexions si le serveur refuse (auth / droits)
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/env';

// Même clé que NotificationContext / api.js
const TOKEN_STORAGE_KEY = '@mada_token';

// ✅ Token : celui passé en paramètre, sinon celui d'AsyncStorage (relu à
// CHAQUE (re)connexion => pris en compte même si le contexte Auth ne l'a
// pas encore ou si le token a été rafraîchi). Retire un éventuel "Bearer ".
const resolveToken = async (given) => {
  let t = given;
  if (!t) {
    try { t = await AsyncStorage.getItem(TOKEN_STORAGE_KEY); } catch (_e) { t = null; }
  }
  if (!t) return '';
  if (typeof t === 'object') t = t.access_token || t.token || '';
  return String(t).replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '').trim();
};

const PING_INTERVAL_MS = 25000;
const MAX_BACKOFF_MS = 15000;
const FATAL_ERRORS = ['Authentication failed', 'Not authorized', 'Booking not found'];

// http://host:8000 -> ws://host:8000 ; https:// -> wss://
// ⚠️ Si dans main.py le router websocket est inclus avec un prefix
// (ex: prefix="/api"), ajoutez-le ici : `${base}/api/ws/tracking/...`
const buildUrl = (bookingId, token) => {
  const base = String(API_URL).replace(/\/+$/, '').replace(/^http/i, 'ws');
  return `${base}/ws/tracking/${bookingId}?token=${encodeURIComponent(token || '')}`;
};

/**
 * @param {Object} opts
 * @param {number|string} opts.bookingId
 * @param {string} opts.token                 JWT de l'utilisateur
 * @param {(msg:Object)=>void} opts.onMessage Message JSON reçu du serveur
 * @param {(status:'connecting'|'connected'|'reconnecting'|'closed')=>void} opts.onStatusChange
 * @returns {{ send:(payload:Object)=>boolean, close:()=>void, isOpen:()=>boolean }}
 */
export function createTrackingSocket({ bookingId, token, onMessage, onStatusChange }) {
  let ws = null;
  let closedByUser = false;
  let fatal = false;
  let attempts = 0;
  let reconnectTimer = null;
  let pingTimer = null;

  const setStatus = (s) => onStatusChange && onStatusChange(s);

  const clearTimers = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pingTimer) clearInterval(pingTimer);
    reconnectTimer = null;
    pingTimer = null;
  };

  const connect = async () => {
    setStatus(attempts === 0 ? 'connecting' : 'reconnecting');

    const finalToken = await resolveToken(token);
    if (closedByUser) return;

    if (!finalToken) {
      // Pas de token : inutile d'ouvrir la socket (le serveur refuserait)
      fatal = true;
      if (onMessage) onMessage({ error: 'Authentication failed', reason: 'missing_token' });
      setStatus('closed');
      return;
    }

    try {
      ws = new WebSocket(buildUrl(bookingId, finalToken));
    } catch (e) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      attempts = 0;
      setStatus('connected');
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }));
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      let msg = null;
      try { msg = JSON.parse(event.data); } catch (_e) { return; }
      if (msg?.error && FATAL_ERRORS.includes(msg.error)) fatal = true;
      if (onMessage) onMessage(msg);
    };

    ws.onerror = () => { /* onclose suit toujours : la reconnexion est gérée là */ };

    ws.onclose = () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      if (closedByUser || fatal) {
        setStatus('closed');
        return;
      }
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    attempts += 1;
    setStatus('reconnecting');
    const delay = Math.min(1000 * 2 ** (attempts - 1), MAX_BACKOFF_MS);
    reconnectTimer = setTimeout(connect, delay);
  };

  connect();

  return {
    send(payload) {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(payload));
        return true;
      }
      return false;
    },
    isOpen: () => !!ws && ws.readyState === 1,
    close() {
      closedByUser = true;
      clearTimers();
      try { ws && ws.close(); } catch (_e) { /* no-op */ }
      setStatus('closed');
    },
  };
}

export default createTrackingSocket;