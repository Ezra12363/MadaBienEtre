// src/utils/webrtc.js
// Appels vocaux : WebRTC pair-à-pair. Web = API du navigateur ; Android/iOS =
// `react-native-webrtc` (module natif : nécessite un development build,
// pas Expo Go). Sans module, isCallSupported() renvoie false (pas de crash).
import { Platform } from 'react-native';

let RTC = null;
if (Platform.OS === 'web') {
  if (typeof window !== 'undefined' && window.RTCPeerConnection) {
    RTC = {
      RTCPeerConnection: window.RTCPeerConnection,
      RTCSessionDescription: window.RTCSessionDescription,
      RTCIceCandidate: window.RTCIceCandidate,
      mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : null,
    };
  }
} else {
  try {
    // eslint-disable-next-line global-require
    RTC = require('react-native-webrtc');
  } catch (_e) {
    RTC = null;
  }
}

export const isCallSupported = () => Boolean(RTC && RTC.RTCPeerConnection && RTC.mediaDevices?.getUserMedia);

export const getMicrophone = async () => {
  if (!isCallSupported()) throw new Error('unsupported');
  return RTC.mediaDevices.getUserMedia({ audio: true, video: false });
};

/**
 * Crée une connexion audio.
 * handlers : { onCandidate(c), onConnected(), onFailed() }
 */
export const createCallPeer = ({ iceServers, localStream, onCandidate, onConnected, onFailed }) => {
  const pc = new RTC.RTCPeerConnection({ iceServers: iceServers || [] });
  let remoteReady = false;
  const pending = [];
  let audioEl = null;

  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) onCandidate?.(e.candidate.toJSON ? e.candidate.toJSON() : e.candidate);
  };
  pc.ontrack = (e) => {
    if (Platform.OS === 'web' && e.streams?.[0]) {
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = e.streams[0];
      audioEl.play?.().catch(() => {});
    }
  };
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === 'connected') onConnected?.();
    if (s === 'failed') onFailed?.();
  };

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
