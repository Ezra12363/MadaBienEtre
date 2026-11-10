// src/context/LiveSharingContext.js
// ============================================================
// PARTAGE DE POSITION EN DIRECT — GLOBAL ET PERSISTANT
// ------------------------------------------------------------
// Avant : le WebSocket vivait dans NavigationScreen et mourait dès que le
// thérapeute quittait cette page ; le client n'était au courant du partage
// que dans TrackingScreen.
//
// Maintenant :
//   THÉRAPEUTE
//     - startSharing() / stopSharing() pilotent UNE session globale.
//     - Le GPS + le WebSocket sont gérés par <SharingEngine>, monté à la
//       racine de l'app : le partage continue sur TOUTES les pages et ne
//       s'arrête que si le thérapeute appuie sur « Arrêter » (ou si la
//       réservation est terminée / annulée, ou en cas de déconnexion).
//     - La session est mémorisée (AsyncStorage) : elle reprend toute seule
//       après un rafraîchissement du navigateur ou un redémarrage de l'app.
//     - Si NavigationScreen est ouvert, il peut transmettre sa position
//       (GPS / téléphone / position manuelle) via reportLocation().
//   CLIENT
//     - interroge GET /tracking/active toutes les 8 s : il sait, depuis
//       n'importe quelle page, que son thérapeute partage sa position.
//
// Les en-têtes (Header, AppHeader, TopNavBar) affichent <LiveShareChip/>
// tant que `active` est vrai.
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../config/env';
import { useAuth } from './AuthContext';
import useTherapistPosition from '../hooks/useTherapistPosition';
import { createTrackingSocket } from '../services/trackingSocket';

const STORAGE_KEY = '@mada_live_share_session';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 h
const SEND_INTERVAL_MS = 1000; // vérification d'envoi (1 / s)
const SEND_MIN_GAP_MS = 900; // 1 position / s au maximum
const SEND_HEARTBEAT_MS = 3500; // renvoi même si la position ne bouge pas
const STATE_UPDATE_GAP_MS = 4000; // « dernier envoi » : on évite 1 rendu / s
const CLIENT_POLL_MS = 8000;

const FATAL_ERRORS = ['Authentication failed', 'Not authorized', 'Booking not found'];
const TERMINAL_STATUSES = [
  'completed',
  'cancelled',
  'cancelled_by_client',
  'cancelled_by_therapist',
  'expired',
];

const DEFAULT_VALUE = {
  active: false,
  role: null,
  isTherapist: false,
  bookingId: null,
  peerName: null,
  session: null,
  status: 'idle',
  lastSentAt: null,
  error: '',
  isSharingBooking: () => false,
  startSharing: () => false,
  stopSharing: () => {},
  reportLocation: () => {},
  clearError: () => {},
};

const LiveSharingContext = createContext(DEFAULT_VALUE);

/** Sûr même sans provider (écrans admin, tests…) : renvoie un état « inactif ». */
export const useLiveSharing = () => useContext(LiveSharingContext) || DEFAULT_VALUE;

// ============================================================
// MOTEUR : GPS + WebSocket (monté uniquement pendant un partage)
// ============================================================
function SharingEngine({ session, token, apiRef, reportedRef, onStatus, onSent, onFatal, onAutoStop }) {
  // Position réelle (GPS appareil, GPS du téléphone sur le web…)
  const { activeLocation: ownLocation } = useTherapistPosition({
    enabled: true,
    distanceIntervalMeters: 0,
    timeIntervalMs: 1000,
  });

  const ownRef = useRef(null);
  ownRef.current = ownLocation;

  const socketRef = useRef(null);
  const lastSendRef = useRef(0);
  const lastKeyRef = useRef('');
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Callbacks stables (le moteur ne doit pas se reconnecter à chaque rendu)
  const cbRef = useRef({});
  cbRef.current = { onStatus, onSent, onFatal, onAutoStop };

  // Position à envoyer : celle fournie par NavigationScreen s'il est ouvert
  // (elle peut être manuelle), sinon la position propre du moteur.
  const pickLocation = () => {
    const reported = reportedRef.current;
    const loc = reported || ownRef.current;
    if (!loc || loc.cached) return null;
    if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return null;
    return loc;
  };

  const sendCurrent = (force = false) => {
    const loc = pickLocation();
    if (!loc) return false;

    const key = `${loc.latitude},${loc.longitude},${loc.timestamp ?? ''}`;
    const now = Date.now();
    const since = now - lastSendRef.current;
    const changed = key !== lastKeyRef.current;

    if (!force) {
      if (since < SEND_MIN_GAP_MS) return false;
      if (!changed && since < SEND_HEARTBEAT_MS) return false;
    }

    const sent = socketRef.current?.send({
      type: 'location_update',
      latitude: loc.latitude,
      longitude: loc.longitude,
      heading: loc.heading ?? null,
      speed: loc.speed ?? null,
      accuracy: loc.accuracy ?? null,
    });

    if (sent) {
      lastSendRef.current = now;
      lastKeyRef.current = key;
      cbRef.current.onSent(now);
    }
    return !!sent;
  };

  // API exposée au provider (envoi du « stop » avant fermeture)
  useEffect(() => {
    apiRef.current = {
      sendStop: () => socketRef.current?.send({ type: 'tracking_stopped' }),
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  // WebSocket : une seule connexion pour toute la durée du partage
  useEffect(() => {
    lastSendRef.current = 0;
    lastKeyRef.current = '';

    socketRef.current = createTrackingSocket({
      bookingId: session.bookingId,
      token,
      onStatusChange: (status) => {
        cbRef.current.onStatus(status);
        // (Re)connecté : annonce le partage + position immédiate
        if (status === 'connected') {
          socketRef.current?.send({
            type: 'tracking_started',
            eta: sessionRef.current?.eta || null,
            distance: sessionRef.current?.distance || null,
          });
          sendCurrent(true);
        }
      },
      onMessage: (msg) => {
        // La réservation est terminée / annulée : plus rien à partager
        if (msg?.type === 'tracking_state' && TERMINAL_STATUSES.includes(String(msg.status || '').toLowerCase())) {
          cbRef.current.onAutoStop();
          return;
        }

        if (!msg?.error) return;
        const reasons = {
          missing_token: 'token manquant',
          invalid_token: 'token invalide ou expiré',
        };
        // ✅ Messages clairs (au lieu du « Not authorized » brut du serveur)
        let text;
        if (msg.error === 'Not authorized') {
          text =
            "Cette réservation ne vous est pas attribuée. Faites d'abord une offre ou attendez l'acceptation du client, puis réessayez.";
        } else if (msg.error === 'Booking not found') {
          text = 'Réservation introuvable.';
        } else {
          text = reasons[msg.reason] ? `${msg.error} (${reasons[msg.reason]})` : msg.error;
        }
        if (FATAL_ERRORS.includes(msg.error)) {
          cbRef.current.onFatal(text);
        }
      },
    });

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.bookingId, token]);

  // Envoi régulier (1 / s) + battement de cœur
  useEffect(() => {
    const timer = setInterval(() => sendCurrent(false), SEND_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ============================================================
// PROVIDER
// ============================================================
export function LiveSharingProvider({ children }) {
  const { user, token, isAuthenticated } = useAuth();
  const role = String(user?.role || '').toUpperCase();
  const isTherapist = isAuthenticated && role === 'THERAPIST';
  const isClient = isAuthenticated && !!role && role !== 'THERAPIST' && role !== 'ADMIN';
  const userId = user?.id ?? null;

  // ---------- THÉRAPEUTE : session de partage ----------
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('idle');
  const [lastSentAt, setLastSentAt] = useState(null);
  const [error, setError] = useState('');

  const apiRef = useRef(null); // { sendStop }
  const reportedRef = useRef(null); // position transmise par NavigationScreen
  const lastStateUpdateRef = useRef(0);

  const persist = useCallback(async (value) => {
    try {
      if (value) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      /* stockage indisponible : le partage marche quand même */
    }
  }, []);

  // Reprise automatique après rafraîchissement / redémarrage
  useEffect(() => {
    if (!isTherapist) {
      if (!isAuthenticated) {
        setSession(null);
        setStatus('idle');
      }
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw || cancelled) return;
        const saved = JSON.parse(raw);
        const fresh = saved?.startedAt && Date.now() - saved.startedAt < SESSION_MAX_AGE_MS;
        if (saved?.bookingId && String(saved.userId) === String(userId) && fresh) {
          setSession((prev) => prev || saved);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch (_e) {
        /* ignoré */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTherapist, isAuthenticated, userId]);

  // Déconnexion : on oublie la session
  useEffect(() => {
    if (!isAuthenticated) persist(null);
  }, [isAuthenticated, persist]);

  const startSharing = useCallback(
    (info) => {
      if (!isTherapist) return false;
      if (!info?.bookingId) {
        Alert.alert('Erreur', 'Réservation introuvable.');
        return false;
      }
      const next = {
        bookingId: info.bookingId,
        clientName: info.clientName || null,
        clientAddress: info.clientAddress || null,
        clientLatitude: info.clientLatitude ?? null,
        clientLongitude: info.clientLongitude ?? null,
        clientId: info.clientId ?? null,
        eta: info.eta || null,
        distance: info.distance || null,
        userId,
        startedAt: Date.now(),
      };
      setError('');
      setLastSentAt(null);
      setStatus('connecting');
      setSession(next);
      persist(next);
      return true;
    },
    [isTherapist, userId, persist]
  );

  const stopSharing = useCallback(() => {
    // Prévient le client AVANT de fermer la socket (le moteur se démonte ensuite)
    apiRef.current?.sendStop?.();
    reportedRef.current = null;
    setSession(null);
    setStatus('idle');
    setLastSentAt(null);
    persist(null);
  }, [persist]);

  const reportLocation = useCallback((loc) => {
    reportedRef.current = loc || null;
  }, []);

  const clearError = useCallback(() => setError(''), []);

  const handleFatal = useCallback(
    (text) => {
      setError(text);
      setSession(null);
      setStatus('idle');
      persist(null);
      if (Platform.OS !== 'web') {
        Alert.alert('Partage impossible', `${text}\n\nReconnectez-vous puis réessayez.`);
      }
    },
    [persist]
  );

  const handleAutoStop = useCallback(() => {
    reportedRef.current = null;
    setSession(null);
    setStatus('idle');
    persist(null);
  }, [persist]);

  const handleSent = useCallback((at) => {
    if (at - lastStateUpdateRef.current < STATE_UPDATE_GAP_MS) return;
    lastStateUpdateRef.current = at;
    setLastSentAt(at);
  }, []);

  // ---------- CLIENT : le thérapeute partage-t-il sa position ? ----------
  const [clientLive, setClientLive] = useState(null);

  useEffect(() => {
    if (!isClient || !token) {
      setClientLive(null);
      return undefined;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/tracking/active`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.sessions || [];
        // Le client est « partie client » de ces sessions (le backend filtre déjà)
        const first = list.find((s) => s?.booking_id != null) || null;
        if (!cancelled) {
          setClientLive((prev) => {
            if (!first && !prev) return prev;
            if (first && prev && prev.booking_id === first.booking_id && prev.therapist_name === first.therapist_name) {
              return prev;
            }
            return first;
          });
        }
      } catch (_e) {
        /* réseau coupé : on garde l'état courant et on réessaie */
      }
    };

    poll();
    const timer = setInterval(poll, CLIENT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isClient, token]);

  // ---------- Valeur du contexte ----------
  const value = useMemo(() => {
    if (isTherapist) {
      return {
        active: !!session,
        role: 'THERAPIST',
        isTherapist: true,
        bookingId: session?.bookingId ?? null,
        peerName: session?.clientName ?? null,
        session,
        status,
        lastSentAt,
        error,
        isSharingBooking: (id) => !!session && String(session.bookingId) === String(id),
        startSharing,
        stopSharing,
        reportLocation,
        clearError,
      };
    }
    return {
      ...DEFAULT_VALUE,
      active: !!clientLive,
      role: isClient ? 'CLIENT' : null,
      bookingId: clientLive?.booking_id ?? null,
      peerName: clientLive?.therapist_name ?? null,
      session: clientLive,
      status: clientLive ? 'connected' : 'idle',
    };
  }, [
    isTherapist,
    isClient,
    session,
    status,
    lastSentAt,
    error,
    clientLive,
    startSharing,
    stopSharing,
    reportLocation,
    clearError,
  ]);

  return (
    <LiveSharingContext.Provider value={value}>
      {children}
      {isTherapist && session ? (
        <SharingEngine
          key={`${session.bookingId}`}
          session={session}
          token={token}
          apiRef={apiRef}
          reportedRef={reportedRef}
          onStatus={setStatus}
          onSent={handleSent}
          onFatal={handleFatal}
          onAutoStop={handleAutoStop}
        />
      ) : null}
    </LiveSharingContext.Provider>
  );
}

export default LiveSharingContext;
