// src/hooks/useChatRoom.js
// ============================================================================
// Logique de chat PARTAGÉE client <-> thérapeute (une réservation = une salle).
//
//  ✅ Historique REST + temps réel WebSocket (/ws/chat/{bookingId})
//  ✅ Envoi optimiste : "sending" -> "delivered" (ack du serveur) -> "read"
//  ✅ Si le WebSocket est coupé : envoi de secours par REST (+ retry manuel)
//  ✅ Reconnexion automatique (backoff) + heartbeat + rattrapage de
//     l'historique à chaque reconnexion (aucun message perdu)
//  ✅ Pas de doublons (id serveur / client_id), heure UTC corrigée
//  ✅ Indicateur de saisie, accusés de lecture
//  ✅ Envoi d'images (aperçu local, upload multipart, réessai) + suppression
//     d'un message ou de TOUS mes messages (deleteAllMine)
//  ✅ Dit au contexte de notifications quelle conversation est ouverte
//     (=> pas de notification pour un message que vous êtes en train de lire)
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import axios from 'axios';

import { API_URL } from '../config/env';
import { emitChatChanged } from '../utils/chatEvents';
import { buildWsUrl, cleanToken, parseServerDate } from '../utils/wsUrl';

const PING_MS = 25000;
const ACK_TIMEOUT_MS = 10000;
const FATAL_ERRORS = ['Authentication failed', 'Not authorized', 'Booking not found'];

export const normalizeMessage = (raw, index = 0) => {
  const m = raw || {};
  const type = m.message_type || m.type || 'text';
  const isRead = m.is_read === true || m.read === true || m.status === 'read';
  return {
    ...m,
    id: m.id ?? m.message_id ?? m.messageId ?? m.client_id ?? `message-${index}-${Date.now()}`,
    clientId: m.clientId ?? m.client_id ?? null,
    senderId: m.senderId ?? m.sender_id ?? m.user_id ?? m.sender?.id,
    senderName: m.senderName || m.sender_name || m.username || m.sender?.fullname || '',
    content: m.content ?? m.message ?? m.text ?? m.body ?? '',
    type: type === 'message' ? 'text' : type,
    imageUrl: m.imageUrl || m.image_url || null,
    localUri: m.localUri || null,
    deleted: m.deleted === true || Boolean(m.deleted_at),
    createdAt: parseServerDate(m.createdAt || m.created_at || m.timestamp).toISOString(),
    status: m.status && m.status !== 'message' ? m.status : isRead ? 'read' : 'delivered',
  };
};

const sameMessage = (a, b) =>
  (a.id != null && b.id != null && String(a.id) === String(b.id)) ||
  (a.clientId && b.clientId && a.clientId === b.clientId) ||
  (a.clientId && b.id != null && a.clientId === String(b.id)) ||
  (b.clientId && a.id != null && b.clientId === String(a.id));

const mergeMessage = (list, incoming) => {
  const idx = list.findIndex((m) => sameMessage(m, incoming));
  if (idx === -1) return [...list, incoming];
  const next = [...list];
  // On garde le "read" s'il était déjà acquis
  const keepRead = next[idx].status === 'read' ? 'read' : incoming.status;
  next[idx] = { ...next[idx], ...incoming, status: keepRead };
  return next;
};

const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

export default function useChatRoom({
  bookingId,
  token,
  user,
  onActiveChange, // (bookingId|null) => void  (NotificationContext.setActiveChatBookingId)
}) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [fatalError, setFatalError] = useState(null);

  const myId = user?.id;
  const myIdRef = useRef(myId);
  const myNameRef = useRef('Vous');
  const wsRef = useRef(null);
  const closedRef = useRef(false);
  const fatalRef = useRef(false);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingSentRef = useRef(false);
  const ackTimersRef = useRef({});
  const messagesRef = useRef([]);
  const assetsRef = useRef({}); // clientId -> image locale (pour réessayer)
  const focusedRef = useRef(true);
  const onActiveChangeRef = useRef(onActiveChange);

  useEffect(() => {
    myIdRef.current = myId;
    myNameRef.current = user?.fullname || user?.full_name || user?.name || 'Vous';
  }, [myId, user]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
  }, [onActiveChange]);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${cleanToken(token)}` }),
    [token]
  );

  /* ------------------------------ historique ------------------------------ */
  const loadHistory = useCallback(
    async ({ silent = false } = {}) => {
      if (!bookingId) {
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      try {
        const res = await axios.get(`${API_URL}/chat/history/${bookingId}`, {
          headers: authHeaders,
        });
        const data = Array.isArray(res.data) ? res.data : res.data?.messages || [];
        const history = data.map((item, i) => normalizeMessage(item, i));

        setMessages((prev) => {
          let merged = history;
          // On garde les messages locaux (en attente / échec / reçus en direct)
          // que l'historique ne contient pas (encore).
          prev.forEach((p) => {
            if (!merged.some((h) => sameMessage(h, p))) merged = [...merged, p];
          });
          return [...merged].sort(byDate);
        });
      } catch (error) {
        console.warn('Chat : historique indisponible', error?.response?.data || error?.message);
      } finally {
        setIsLoading(false);
      }
    },
    [bookingId, authHeaders]
  );

  /* ------------------------------ lecture ------------------------------ */
  const sendRaw = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(payload));
        return true;
      } catch (_e) {
        return false;
      }
    }
    return false;
  }, []);

  const markRead = useCallback(() => {
    if (!focusedRef.current) return;
    const hasIncoming = messagesRef.current.some(
      (m) => String(m.senderId) !== String(myIdRef.current) && m.status !== 'read'
    );
    if (hasIncoming) {
      if (!sendRaw({ type: 'read' }) && bookingId) {
        // WebSocket coupé : accusé de lecture par REST
        axios
          .put(`${API_URL}/chat/read/${bookingId}`, null, { headers: authHeaders })
          .catch(() => {});
      }
      setMessages((prev) =>
        prev.map((m) =>
          String(m.senderId) !== String(myIdRef.current) ? { ...m, status: 'read' } : m
        )
      );
      setTimeout(emitChatChanged, 400); // le badge « non lus » se met à jour
    }
  }, [sendRaw, bookingId, authHeaders]);

  /* ------------------------------ WebSocket ------------------------------ */
  const connectRef = useRef(null);

  const scheduleReconnect = useCallback(() => {
    if (closedRef.current || fatalRef.current) return;
    attemptsRef.current += 1;
    const delay = Math.min(1000 * 2 ** (attemptsRef.current - 1), 15000);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => connectRef.current?.(), delay);
  }, []);

  const connect = useCallback(() => {
    if (!bookingId || !token || closedRef.current || fatalRef.current) return;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    let socket;
    try {
      socket = new WebSocket(buildWsUrl(`/chat/${bookingId}`, token));
    } catch (error) {
      console.warn('Chat : WebSocket impossible', error?.message);
      scheduleReconnect();
      return;
    }
    wsRef.current = socket;

    socket.onopen = () => {
      if (wsRef.current !== socket) return;
      attemptsRef.current = 0;
      setIsConnected(true);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => {
        if (socket.readyState === 1) {
          try {
            socket.send(JSON.stringify({ type: 'ping' }));
          } catch (_e) { /* no-op */ }
        }
      }, PING_MS);
      // Rattrape ce qui a pu arriver pendant la coupure, puis marque comme lu
      loadHistory({ silent: true }).then(() => setTimeout(markRead, 300));
    };

    socket.onmessage = (event) => {
      if (wsRef.current !== socket) return;
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (_e) {
        return;
      }

      if (data?.error) {
        if (FATAL_ERRORS.includes(data.error)) {
          fatalRef.current = true;
          setFatalError(data.error);
        }
        return;
      }

      if (data.type === 'message') {
        const incoming = normalizeMessage({
          ...data,
          sender_id: data.user_id,
          status: 'delivered',
        });
        const mine = String(incoming.senderId) === String(myIdRef.current);

        if (mine && incoming.clientId && ackTimersRef.current[incoming.clientId]) {
          clearTimeout(ackTimersRef.current[incoming.clientId]);
          delete ackTimersRef.current[incoming.clientId];
        }

        setMessages((prev) => mergeMessage(prev, incoming).sort(byDate));

        if (!mine) {
          setIsTyping(false);
          if (focusedRef.current) {
            sendRaw({ type: 'read' });
            setMessages((prev) =>
              prev.map((m) => (sameMessage(m, incoming) ? { ...m, status: 'read' } : m))
            );
            setTimeout(emitChatChanged, 400);
          }
        }
      } else if (data.type === 'message_deleted') {
        setMessages((prev) =>
          prev.map((m) =>
            String(m.id) === String(data.id)
              ? { ...m, deleted: true, content: '', imageUrl: null, localUri: null }
              : m
          )
        );
        emitChatChanged();
      } else if (data.type === 'messages_deleted' && Array.isArray(data.ids)) {
        const gone = new Set(data.ids.map(String));
        setMessages((prev) =>
          prev.map((m) =>
            gone.has(String(m.id))
              ? { ...m, deleted: true, content: '', imageUrl: null, localUri: null }
              : m
          )
        );
        emitChatChanged();
      } else if (data.type === 'typing') {
        if (String(data.user_id) !== String(myIdRef.current)) {
          setIsTyping(Boolean(data.is_typing));
        }
      } else if (data.type === 'read' && String(data.reader_id) !== String(myIdRef.current)) {
        // L'autre a lu : nos messages passent à "read" (✓✓ vert)
        setMessages((prev) =>
          prev.map((m) =>
            String(m.senderId) === String(myIdRef.current) &&
            m.status !== 'sending' &&
            m.status !== 'failed'
              ? { ...m, status: 'read' }
              : m
          )
        );
      }
    };

    socket.onerror = () => { /* onclose suit toujours */ };

    socket.onclose = () => {
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
      if (wsRef.current === socket) {
        wsRef.current = null;
        setIsConnected(false);
        setIsTyping(false);
      }
      if (closedRef.current || fatalRef.current) return;
      scheduleReconnect();
    };
  }, [bookingId, token, loadHistory, markRead, sendRaw, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  /* ------------------------------ cycle de vie ------------------------------ */
  useEffect(() => {
    closedRef.current = false;
    fatalRef.current = false;
    attemptsRef.current = 0;
    setFatalError(null);

    loadHistory();
    connect();
    onActiveChangeRef.current?.(bookingId || null);

    const appSub = AppState.addEventListener('change', (state) => {
      focusedRef.current = state === 'active';
      if (state === 'active') {
        if (!wsRef.current || wsRef.current.readyState !== 1) {
          attemptsRef.current = 0;
          connectRef.current?.();
        } else {
          loadHistory({ silent: true }).then(() => setTimeout(markRead, 300));
        }
        onActiveChangeRef.current?.(bookingId || null);
      } else {
        // App en arrière-plan : on veut être notifié des nouveaux messages
        onActiveChangeRef.current?.(null);
      }
    });

    return () => {
      closedRef.current = true;
      appSub?.remove?.();
      onActiveChangeRef.current?.(null);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      Object.values(ackTimersRef.current).forEach(clearTimeout);
      ackTimersRef.current = {};
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try { ws.close(); } catch (_e) { /* no-op */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, token]);

  /* ------------------------------ envoi ------------------------------ */
  const markFailed = useCallback((clientId) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.clientId === clientId && m.status === 'sending' ? { ...m, status: 'failed' } : m
      )
    );
  }, []);

  const uploadImage = useCallback(
    async (clientId, asset) => {
      try {
        const form = new FormData();
        if (asset.file) {
          form.append('image', asset.file, asset.name || 'photo.jpg'); // Web
        } else {
          form.append('image', {
            uri: asset.uri,
            name: asset.name || 'photo.jpg',
            type: asset.mimeType || 'image/jpeg',
          }); // Android / iOS
        }
        form.append('client_id', clientId);

        // Pas de Content-Type manuel : axios ajoute le « boundary » multipart
        const res = await axios.post(`${API_URL}/chat/send-image/${bookingId}`, form, {
          headers: authHeaders,
          timeout: 60000,
        });
        const saved = normalizeMessage({
          ...res.data,
          client_id: clientId,
          sender_id: myIdRef.current,
          status: 'delivered',
          localUri: asset.uri,
        });
        setMessages((prev) => mergeMessage(prev, saved).sort(byDate));
        delete assetsRef.current[clientId];
        return true;
      } catch (error) {
        console.warn('Chat : envoi image échoué', error?.response?.data || error?.message);
        markFailed(clientId);
        return false;
      }
    },
    [bookingId, authHeaders, markFailed]
  );

  const deliver = useCallback(
    async (clientId, content) => {
      // 1) WebSocket (temps réel + notification créée par le serveur)
      if (sendRaw({ type: 'message', client_id: clientId, message: content })) {
        ackTimersRef.current[clientId] = setTimeout(() => {
          delete ackTimersRef.current[clientId];
          markFailed(clientId);
        }, ACK_TIMEOUT_MS);
        return true;
      }

      // 2) Secours REST (socket coupée)
      try {
        const res = await axios.post(
          `${API_URL}/chat/send/${bookingId}`,
          { message: content },
          { headers: authHeaders }
        );
        const body =
          res.data?.message && typeof res.data.message === 'object' ? res.data.message : res.data;
        const saved = normalizeMessage(
          {
            ...(body && typeof body === 'object' ? body : {}),
            client_id: clientId,
            sender_id: myIdRef.current,
            content,
            created_at: body?.created_at || new Date().toISOString(),
            status: 'delivered',
          },
          0
        );
        setMessages((prev) => mergeMessage(prev, saved).sort(byDate));
        return true;
      } catch (error) {
        console.warn('Chat : envoi REST échoué', error?.response?.data || error?.message);
        markFailed(clientId);
        return false;
      }
    },
    [bookingId, authHeaders, markFailed, sendRaw]
  );

  const sendMessage = useCallback(
    async (text) => {
      const content = String(text || '').trim();
      if (!content || !bookingId) return false;

      const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setMessages((prev) => [
        ...prev,
        normalizeMessage({
          id: clientId,
          client_id: clientId,
          sender_id: myIdRef.current,
          sender_name: myNameRef.current,
          content,
          created_at: new Date().toISOString(),
          status: 'sending',
        }),
      ]);

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (typingSentRef.current) {
        typingSentRef.current = false;
        sendRaw({ type: 'typing', is_typing: false });
      }
      return deliver(clientId, content);
    },
    [bookingId, deliver, sendRaw]
  );

  const retryMessage = useCallback(
    (messageId) => {
      const target = messagesRef.current.find((m) => String(m.id) === String(messageId));
      if (!target || target.status !== 'failed') return;
      const clientId = target.clientId || String(target.id);
      setMessages((prev) =>
        prev.map((m) => (String(m.id) === String(messageId) ? { ...m, status: 'sending' } : m))
      );
      if (target.type === 'image') {
        const asset = assetsRef.current[clientId];
        if (asset) uploadImage(clientId, asset);
        else markFailed(clientId);
        return;
      }
      deliver(clientId, target.content);
    },
    [deliver, uploadImage, markFailed]
  );

  const sendImage = useCallback(
    async (asset) => {
      if (!asset?.uri || !bookingId) return false;

      const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      assetsRef.current[clientId] = asset;
      setMessages((prev) => [
        ...prev,
        normalizeMessage({
          id: clientId,
          client_id: clientId,
          sender_id: myIdRef.current,
          sender_name: myNameRef.current,
          content: '',
          message_type: 'image',
          localUri: asset.uri,
          created_at: new Date().toISOString(),
          status: 'sending',
        }),
      ]);
      return uploadImage(clientId, asset);
    },
    [bookingId, uploadImage]
  );

  const deleteMessage = useCallback(
    async (messageId) => {
      const target = messagesRef.current.find((m) => String(m.id) === String(messageId));
      if (!target) return false;

      // Message qui n'a jamais atteint le serveur : suppression locale
      if (target.status === 'failed') {
        delete assetsRef.current[target.clientId || target.id];
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
        return true;
      }
      if (String(target.senderId) !== String(myIdRef.current)) return false;
      if (String(target.id).startsWith('c-')) return false; // pas encore enregistré

      const tombstone = { deleted: true, content: '', imageUrl: null, localUri: null };
      setMessages((prev) =>
        prev.map((m) => (String(m.id) === String(messageId) ? { ...m, ...tombstone } : m))
      );
      try {
        await axios.delete(`${API_URL}/chat/message/${messageId}`, { headers: authHeaders });
        emitChatChanged();
        return true;
      } catch (error) {
        console.warn('Chat : suppression échouée', error?.response?.data || error?.message);
        setMessages((prev) => prev.map((m) => (String(m.id) === String(messageId) ? target : m)));
        return false;
      }
    },
    [authHeaders]
  );

  /* ------------------------- supprimer TOUS mes messages ------------------------- */
  // DELETE /chat/messages/{bookingId}/mine : les messages de l'autre personne ne
  // sont jamais touchés. Mise à jour immédiate puis retour arrière si le serveur refuse.
  const deleteAllMine = useCallback(async () => {
    if (!bookingId) return { ok: false, count: 0 };
    const mine = (id) => String(id) === String(myIdRef.current);
    const before = messagesRef.current;
    const targets = before.filter((m) => mine(m.senderId) && !m.deleted);
    if (targets.length === 0) return { ok: true, count: 0 };

    // Messages jamais arrivés au serveur : suppression locale
    const localOnly = (m) => m.status === 'failed' || m.status === 'sending';
    targets.filter(localOnly).forEach((m) => {
      delete assetsRef.current[m.clientId || m.id];
    });

    const tombstone = { deleted: true, content: '', imageUrl: null, localUri: null };
    const targetIds = new Set(targets.map((m) => String(m.id)));
    setMessages((prev) =>
      prev
        .filter((m) => !(targetIds.has(String(m.id)) && localOnly(m)))
        .map((m) => (targetIds.has(String(m.id)) ? { ...m, ...tombstone } : m))
    );

    try {
      const res = await axios.delete(`${API_URL}/chat/messages/${bookingId}/mine`, {
        headers: authHeaders,
        timeout: 30000,
      });
      emitChatChanged();
      return { ok: true, count: Number(res.data?.deleted ?? targets.length) };
    } catch (error) {
      console.warn('Chat : suppression globale échouée', error?.response?.data || error?.message);
      setMessages(before);
      return { ok: false, count: 0 };
    }
  }, [bookingId, authHeaders]);

  /* ------------------------------ saisie ------------------------------ */
  const notifyTyping = useCallback(
    (text) => {
      if (text.length > 0 && !typingSentRef.current) {
        typingSentRef.current = true;
        sendRaw({ type: 'typing', is_typing: true });
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (typingSentRef.current) {
          typingSentRef.current = false;
          sendRaw({ type: 'typing', is_typing: false });
        }
      }, 1500);
    },
    [sendRaw]
  );

  return {
    messages,
    isLoading,
    isConnected,
    isTyping,
    fatalError,
    sendMessage,
    sendImage,
    deleteMessage,
    deleteAllMine,
    retryMessage,
    notifyTyping,
    reload: loadHistory,
  };
}