// src/utils/webrtc.js
// Appels vocaux : WebRTC pair-à-pair. Web = API du navigateur ; Android/iOS =
// `react-native-webrtc` (module natif : nécessite un development build,
// pas Expo Go). Sans module, isCallSupported() renvoie false (pas de crash).
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

// Chargé à la demande (et non à l'import) : sur le web, navigator.mediaDevices
// n'existe qu'en HTTPS / localhost et peut apparaître après le chargement.
let nativeRTC;
const getRTC = () => {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    const PC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (!PC) return null;
    return {
      RTCPeerConnection: PC,
      RTCSessionDescription: window.RTCSessionDescription,
      RTCIceCandidate: window.RTCIceCandidate,
      mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : null,
    };
  }
  if (nativeRTC === undefined) {
    // Expo Go / ancien build : le module natif est absent. On ne fait PAS require()
    // dans ce cas, car react-native-webrtc lève une erreur fatale dès son chargement.
    if (!NativeModules.WebRTCModule) {
      nativeRTC = null;
      return nativeRTC;
    }
    try {
      // eslint-disable-next-line global-require
      const mod = require('react-native-webrtc');
      nativeRTC = mod && mod.RTCPeerConnection ? mod : (mod && mod.default) || null;
    } catch (_e) {
      nativeRTC = null;
    }
  }
  return nativeRTC;
};

export const isCallSupported = () => {
  const RTC = getRTC();
  return Boolean(RTC && RTC.RTCPeerConnection && RTC.mediaDevices?.getUserMedia);
};

const ensureAndroidMic = async () => {
  if (Platform.OS !== 'android') return;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (res !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('permission');
};

export const getMicrophone = async () => {
  const RTC = getRTC();
  if (!RTC || !RTC.mediaDevices?.getUserMedia) throw new Error('unsupported');
  await ensureAndroidMic();
  return RTC.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });
};

/* ---------------------------- sonnerie (web) ------------------------------ */
// Sur Android/iOS la sonnerie est une vibration (voir MessengerContext).
let ringCtx = null;
let ringTimer = null;

export const startRingtone = () => {
  if (Platform.OS !== 'web' || ringTimer) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ringCtx = ringCtx || new Ctx();
    ringCtx.resume?.().catch(() => {});
    const beep = () => {
      try {
        const osc = ringCtx.createOscillator();
        const gain = ringCtx.createGain();
        osc.frequency.value = 440;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ringCtx.destination);
        osc.start();
        osc.stop(ringCtx.currentTime + 0.6);
      } catch (_e) { /* noop */ }
    };
    beep();
    ringTimer = setInterval(beep, 2000);
  } catch (_e) { /* noop */ }
};

export const stopRingtone = () => {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
};

/**
 * Crée une connexion audio.
 * handlers : { onCandidate(c), onConnected(), onFailed() }
 */
export const createCallPeer = ({ iceServers, localStream, onCandidate, onConnected, onFailed }) => {
  const RTC = getRTC();
  const pc = new RTC.RTCPeerConnection({ iceServers: iceServers || [] });
  let connectedFired = false;
  let disconnectTimer = null;
  const fireConnected = () => {
    if (connectedFired) return;
    connectedFired = true;
    onConnected?.();
  };
  let remoteReady = false;
  const pending = [];
  let audioEl = null;

  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) onCandidate?.(e.candidate.toJSON ? e.candidate.toJSON() : e.candidate);
  };
  pc.ontrack = (e) => {
    // Android / iOS : react-native-webrtc joue l'audio distant tout seul.
    if (Platform.OS !== 'web') return;
    let stream = e.streams?.[0];
    if (!stream && e.track && typeof MediaStream !== 'undefined') stream = new MediaStream([e.track]);
    if (!stream) return;
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.play?.().catch(() => {});
  };

  const onState = (s) => {
    if (s === 'connected' || s === 'completed') {
      clearTimeout(disconnectTimer);
      fireConnected();
    } else if (s === 'disconnected') {
      // coupure brève fréquente sur mobile : on laisse 8 s pour se rétablir
      clearTimeout(disconnectTimer);
      disconnectTimer = setTimeout(() => onFailed?.(), 8000);
    } else if (s === 'failed') {
      clearTimeout(disconnectTimer);
      onFailed?.();
    }
  };
  // connectionState (récent) ET iceConnectionState (anciennes versions du module natif)
  pc.onconnectionstatechange = () => onState(pc.connectionState);
  pc.oniceconnectionstatechange = () => onState(pc.iceConnectionState);

  const flush = async () => {
    remoteReady = true;
    while (pending.length) {
      try {
        await pc.addIceCandidate(new RTC.RTCIceCandidate(pending.shift()));
      } catch (_e) { /* candidat périmé */ }
    }
  };

  return {
    async createOffer() {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      return { type: offer.type, sdp: offer.sdp };
    },
    async acceptOffer(offer) {
      await pc.setRemoteDescription(new RTC.RTCSessionDescription(offer));
      await flush();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return { type: answer.type, sdp: answer.sdp };
    },
    async acceptAnswer(answer) {
      await pc.setRemoteDescription(new RTC.RTCSessionDescription(answer));
      await flush();
    },
    async addCandidate(candidate) {
      if (!remoteReady) {
        pending.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTC.RTCIceCandidate(candidate));
      } catch (_e) { /* ignoré */ }
    },
    setMuted(muted) {
      localStream.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    },
    close() {
      clearTimeout(disconnectTimer);
      try { localStream.getTracks().forEach((t) => t.stop()); } catch (_e) { /* noop */ }
      try { pc.close(); } catch (_e) { /* noop */ }
      if (audioEl) {
        audioEl.srcObject = null;
        audioEl.remove?.();
        audioEl = null;
      }
    },
  };
};
