// src/hooks/useChatUnread.js
// ============================================================================
// Badge « messages non lus » (menu, onglet Messages, liste des conversations).
//
// Source de vérité : GET /chat/unread  ->  { unread_count, by_booking }
// Mise à jour :
//   - signal instantané /ws/notifications (kind = "chat_message")
//   - évènement local (chat lu / message supprimé) via utils/chatEvents
//   - retour de l'app au premier plan
//   - polling de secours toutes les 30 s
// Un seul store partagé : peu importe le nombre de composants qui l'utilisent,
// il n'y a qu'un polling et qu'un WebSocket.
// ============================================================================
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { onChatChanged } from '../utils/chatEvents';
import { buildWsUrl, cleanToken } from '../utils/wsUrl';

const POLL_MS = 30000;
const PING_MS = 25000;
const EMPTY = { count: 0, byBooking: {} };

let snapshot = EMPTY;
const subscribers = new Set();

let refs = 0;
let runningToken = '';
let pollTimer = null;
let appSub = null;
let offChat = null;
let debounceTimer = null;
let socket = null;
let socketTimer = null;
let socketFails = 0;

const publish = (next) => {
  snapshot = next;
  subscribers.forEach((fn) => fn(next));
};

export const refreshChatUnread = async () => {
  if (!runningToken) {
    if (snapshot !== EMPTY) publish(EMPTY);
    return;
  }
  try {
    // ✅ via l'instance `api` : en cas de 401 le token est rafraîchi
    // automatiquement (au lieu de réessayer en boucle avec un token expiré).
    const res = await api.get('/chat/unread', { timeout: 10000 });
    const count = Number(res.data?.unread_count ?? res.data?.count ?? 0) || 0;
    const byBooking = res.data?.by_booking || {};
    if (count !== snapshot.count || JSON.stringify(byBooking) !== JSON.stringify(snapshot.byBooking)) {
      publish({ count, byBooking });
    }
  } catch (_e) {
    /* réseau coupé : on garde la dernière valeur connue */
  }
};

const refreshSoon = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refreshChatUnread, 300);
};

const closeSocket = () => {
  if (socketTimer) clearTimeout(socketTimer);
  socketTimer = null;
  const ws = socket;
  socket = null;
  if (ws) {
    try {
      ws.close();
    } catch (_e) { /* no-op */ }
  }
};

const openSocket = () => {
  if (!runningToken || socket) return;
  let ws;
  try {
    ws = new WebSocket(buildWsUrl('/notifications', runningToken));
  } catch (_e) {
    scheduleSocket();
    return;
  }
  socket = ws;
  let ping = null;

  ws.onopen = () => {
    socketFails = 0;
    ping = setInterval(() => {
      if (ws.readyState === 1) {
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch (_e) { /* no-op */ }
      }
    }, PING_MS);
    refreshChatUnread(); // rattrape ce qui est arrivé pendant une coupure
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.type === 'notification' && data.kind === 'chat_message') refreshSoon();
    } catch (_e) { /* ignoré */ }
  };

  ws.onerror = () => { /* onclose suit */ };

  ws.onclose = () => {
    if (ping) clearInterval(ping);
    if (socket === ws) socket = null;
    scheduleSocket();
  };
};

function scheduleSocket() {
  if (!runningToken || socketTimer) return;
  socketFails += 1;
  const delay = Math.min(2000 * 2 ** socketFails, 30000);
  socketTimer = setTimeout(() => {
    socketTimer = null;
    openSocket();
  }, delay);
}

const start = (token) => {
  runningToken = token;
  socketFails = 0;
  refreshChatUnread();
  pollTimer = setInterval(refreshChatUnread, POLL_MS);
  appSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      refreshChatUnread();
      if (!socket) openSocket();
    }
  });
  offChat = onChatChanged(refreshSoon);
  openSocket();
};

const stop = () => {
  runningToken = '';
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  appSub?.remove?.();
  appSub = null;
  offChat?.();
  offChat = null;
  closeSocket();
  if (snapshot !== EMPTY) publish(EMPTY);
};

export default function useChatUnread() {
  const { token } = useAuth();
  const [snap, setSnap] = useState(snapshot);

  useEffect(() => {
    subscribers.add(setSnap);
    setSnap(snapshot);
    return () => {
      subscribers.delete(setSnap);
    };
  }, []);

  useEffect(() => {
    const clean = cleanToken(token);
    if (!clean) return undefined;

    refs += 1;
    if (runningToken !== clean) {
      if (runningToken) stop();
      start(clean);
    }
    return () => {
      refs -= 1;
      if (refs <= 0) {
        refs = 0;
        stop();
      }
    };
  }, [token]);

  const refresh = useCallback(() => refreshChatUnread(), []);

  return { unreadCount: snap.count, byBooking: snap.byBooking, refresh };
}
