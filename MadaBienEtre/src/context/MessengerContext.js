// src/context/MessengerContext.js
// ============================================================================
// Connexion WebSocket unique (/ws/messenger) pour TOUTE l'application :
//   - total de messages non lus (badge)
//   - évènements temps réel distribués aux écrans via subscribe()
//   - présence (en ligne / dernière connexion) et « en train d'écrire »
//   - appels vocaux (sonnerie, acceptation, WebRTC, minuteur)
// Reconnexion automatique (backoff) et au retour de l'application au premier plan.
// ============================================================================
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState, Platform, Vibration } from 'react-native';

import CallModal from '../components/messenger/CallModal';
import messengerService from '../services/messengerService';
import { createCallPeer, getMicrophone, isCallSupported } from '../utils/webrtc';
import { buildWsUrl, cleanToken } from '../utils/wsUrl';
import { useAuth } from './AuthContext';

const MessengerContext = createContext(null);

const PING_MS = 25000;
const MAX_BACKOFF_MS = 15000;

export const MessengerProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [presence, setPresence] = useState({}); // userId -> { is_online, last_seen_at }
  const [call, setCall] = useState(null);

  const wsRef = useRef(null);
  const listeners = useRef(new Set());
  const retryRef = useRef(0);
  const timers = useRef({ ping: null, retry: null, tick: null });
  const aliveRef = useRef(false);
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const iceRef = useRef([]);

  const setCallState = useCallback((next) => {
    callRef.current = typeof next === 'function' ? next(callRef.current) : next;
    setCall(callRef.current);
  }, []);

  /* ----------------------------- envoi / abonnement ---------------------- */
  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const refreshUnread = useCallback(async () => {
    const res = await messengerService.unread();
    if (res.success) setUnreadTotal(res.data?.total || 0);
  }, []);

  /* ------------------------------- appels -------------------------------- */
  const stopRing = () => {
    if (Platform.OS !== 'web') Vibration.cancel();
  };

  const clearTick = () => {
    if (timers.current.tick) clearInterval(timers.current.tick);
    timers.current.tick = null;
  };

  const closePeer = () => {
    clearTick();
    stopRing();
    try { peerRef.current?.close(); } catch (_e) { /* noop */ }
    peerRef.current = null;
  };

  const startTimer = () => {
    clearTick();
    timers.current.tick = setInterval(
      () => setCallState((c) => (c ? { ...c, seconds: (c.seconds || 0) + 1 } : c)),
      1000
    );
  };

  const buildPeer = useCallback(async (callId) => {
    const stream = await getMicrophone();
    peerRef.current = createCallPeer({
      iceServers: iceRef.current,
      localStream: stream,
      onCandidate: (candidate) => send({ type: 'call_signal', call_id: callId, signal: 'candidate', data: candidate }),
      onConnected: () => {
        setCallState((c) => (c ? { ...c, status: 'active', seconds: c.seconds || 0 } : c));
        stopRing();
        startTimer();
      },
      onFailed: () => send({ type: 'call_hangup', call_id: callId }),
    });
    return peerRef.current;
  }, [send, setCallState]);

  const startCall = useCallback(async (conversationId, peerUser) => {
    if (callRef.current) return { ok: false, error: 'Vous êtes déjà en communication.' };
    if (!isCallSupported()) {
      return {
        ok: false,
        error: Platform.OS === 'web'
          ? "Ce navigateur ne permet pas les appels vocaux."
          : "Les appels vocaux nécessitent l'application complète (development build avec react-native-webrtc).",
      };
    }
    try {
      const stream = await getMicrophone();
      stream.getTracks().forEach((t) => t.stop()); // test de permission : le vrai flux est ouvert à l'acceptation
    } catch (_e) {
      return { ok: false, error: "L'accès au microphone est refusé." };
    }
    if (!send({ type: 'call_invite', conversation_id: conversationId })) {
      return { ok: false, error: 'Connexion en cours, réessayez dans un instant.' };
    }
    setCallState({ id: null, conversationId, peer: peerUser, direction: 'outgoing', status: 'ringing', seconds: 0, muted: false });
    return { ok: true };
  }, [send, setCallState]);

  const acceptCall = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.direction !== 'incoming') return;
    stopRing();
    try {
      await buildPeer(c.id);
      setCallState((x) => (x ? { ...x, status: 'connecting' } : x));
      send({ type: 'call_accept', call_id: c.id });
    } catch (_e) {
      send({ type: 'call_decline', call_id: c.id });
      setCallState({ ...c, status: 'ended', message: "Microphone indisponible" });
      setTimeout(() => setCallState(null), 1800);
    }
  }, [buildPeer, send, setCallState]);

  const declineCall = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    if (c.id) send({ type: 'call_hangup', call_id: c.id });
    closePeer();
    setCallState(null);
  }, [send, setCallState]);

  const toggleMute = useCallback(() => {
    setCallState((c) => {
      if (!c) return c;
      peerRef.current?.setMuted(!c.muted);
      return { ...c, muted: !c.muted };
    });
  }, [setCallState]);

  const handleCallEvent = useCallback(async (msg) => {
    if (msg.type === 'call_incoming') {
      if (callRef.current) {
        send({ type: 'call_decline', call_id: msg.call_id });
        return;
      }
      iceRef.current = msg.ice_servers || [];
      setCallState({
        id: msg.call_id, conversationId: msg.conversation_id, peer: msg.caller,
        direction: 'incoming', status: 'ringing', seconds: 0, muted: false,
      });
      if (Platform.OS !== 'web') Vibration.vibrate([0, 600, 900], true);
      return;
    }

    if (msg.type === 'call_state') {
      const c = callRef.current;
      if (msg.ice_servers) iceRef.current = msg.ice_servers;
      if (msg.status === 'ringing' && c && c.direction === 'outgoing' && !c.id) {
        setCallState({ ...c, id: msg.call_id });
        return;
      }
      if (msg.status === 'accepted' && c && c.direction === 'outgoing') {
        setCallState({ ...c, id: msg.call_id, status: 'connecting' });
        try {
          const peer = await buildPeer(msg.call_id);
          const offer = await peer.createOffer();
          send({ type: 'call_signal', call_id: msg.call_id, signal: 'offer', data: offer });
        } catch (_e) {
          send({ type: 'call_hangup', call_id: msg.call_id });
        }
        return;
      }
      if (['declined', 'missed', 'cancelled', 'busy', 'ended', 'failed'].includes(msg.status)) {
        if (!c || (c.id && c.id !== msg.call_id)) return;
        closePeer();
        const labels = {
          declined: 'Appel refusé', missed: 'Pas de réponse', cancelled: 'Appel annulé',
          busy: 'Ligne occupée', ended: 'Appel terminé', failed: "L'appel a échoué",
        };
        setCallState({ ...c, status: 'ended', message: labels[msg.status] });
        setTimeout(() => setCallState((x) => (x && x.status === 'ended' ? null : x)), 1800);
      }
      return;
    }

    if (msg.type === 'call_signal') {
      const peer = peerRef.current;
      if (!peer) return;
      try {
        if (msg.signal === 'offer') {
          const answer = await peer.acceptOffer(msg.data);
          send({ type: 'call_signal', call_id: msg.call_id, signal: 'answer', data: answer });
        } else if (msg.signal === 'answer') {
          await peer.acceptAnswer(msg.data);
        } else if (msg.signal === 'candidate') {
          await peer.addCandidate(msg.data);
        }
      } catch (_e) {
        send({ type: 'call_hangup', call_id: msg.call_id });
      }
    }
  }, [buildPeer, send, setCallState]);

  /* ------------------------------ WebSocket ------------------------------ */
  const handleMessage = useCallback((raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (_e) { return; }
    if (!msg || !msg.type || msg.type === 'pong') return;

    if (msg.type === 'ready') {
      setUnreadTotal(msg.unread?.total || 0);
    } else if (msg.type === 'presence') {
      setPresence((p) => ({ ...p, [msg.user_id]: { is_online: msg.is_online, last_seen_at: msg.last_seen_at } }));
    } else if (['message_new', 'message_deleted', 'receipt', 'conversation_updated', 'conversation_removed'].includes(msg.type)) {
      refreshUnread();
    }
    if (msg.type.startsWith('call_')) handleCallEvent(msg);

    listeners.current.forEach((fn) => {
      try { fn(msg); } catch (_e) { /* un écran en erreur ne bloque pas les autres */ }
    });
  }, [handleCallEvent, refreshUnread]);

  const connect = useCallback(() => {
    if (!aliveRef.current || !token) return;
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    let ws;
    try {
      ws = new WebSocket(buildWsUrl('messenger', cleanToken(token)));
    } catch (_e) {
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      retryRef.current = 0;
      setConnected(true);
      clearInterval(timers.current.ping);
      timers.current.ping = setInterval(() => send({ type: 'ping' }), PING_MS);
    };
    ws.onmessage = (e) => handleMessage(e.data);
    ws.onclose = () => {
      setConnected(false);
      clearInterval(timers.current.ping);
      if (wsRef.current === ws) wsRef.current = null;
      if (!aliveRef.current) return;
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** retryRef.current);
      retryRef.current += 1;
      clearTimeout(timers.current.retry);
      timers.current.retry = setTimeout(connect, delay);
    };
    ws.onerror = () => { /* onclose suit */ };
  }, [token, handleMessage, send]);

  useEffect(() => {
    aliveRef.current = Boolean(token && user);
    if (aliveRef.current) {
      connect();
      refreshUnread();
    }
    return () => {
      aliveRef.current = false;
      clearTimeout(timers.current.retry);
      clearInterval(timers.current.ping);
      try { wsRef.current?.close(); } catch (_e) { /* noop */ }
      wsRef.current = null;
      setConnected(false);
      closePeer();
      setCallState(null);
      if (!token) {
        setUnreadTotal(0);
        setPresence({});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && aliveRef.current) {
        connect();
        refreshUnread();
      }
    });
    return () => sub.remove();
  }, [connect, refreshUnread]);

  const value = useMemo(() => ({
    connected, unreadTotal, presence, call, send, subscribe, refreshUnread,
    startCall, acceptCall, declineCall, toggleMute, callSupported: isCallSupported(),
  }), [connected, unreadTotal, presence, call, send, subscribe, refreshUnread, startCall, acceptCall, declineCall, toggleMute]);

  return (
    <MessengerContext.Provider value={value}>
      {children}
      <CallModal call={call} onAccept={acceptCall} onDecline={declineCall} onToggleMute={toggleMute} />
    </MessengerContext.Provider>
  );
};

const NOOP = {
  connected: false, unreadTotal: 0, presence: {}, call: null, send: () => false,
  subscribe: () => () => {}, refreshUnread: () => {}, startCall: async () => ({ ok: false }),
  acceptCall: () => {}, declineCall: () => {}, toggleMute: () => {}, callSupported: false,
};

export const useMessenger = () => useContext(MessengerContext) || NOOP;
export default MessengerContext;
