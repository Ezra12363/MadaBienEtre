// src/utils/authEvents.js
//
// Petit bus d'évènements entre services/api.js (qui rafraîchit le token en
// arrière-plan) et AuthContext (qui garde le token dans son état React).
//
// Sans ceci, après un rafraîchissement automatique le nouveau token n'est
// écrit que dans AsyncStorage : l'état React garde l'ANCIEN token expiré, et
// tout ce qui l'utilise directement (WebSocket /ws/notifications, GET
// /chat/unread...) reçoit 401 en boucle.
const tokenListeners = new Set();
const sessionListeners = new Set();

export const onTokenRefreshed = (fn) => {
  tokenListeners.add(fn);
  return () => tokenListeners.delete(fn);
};

export const onSessionExpired = (fn) => {
  sessionListeners.add(fn);
  return () => sessionListeners.delete(fn);
};

export const emitTokenRefreshed = (accessToken, refreshToken) => {
  tokenListeners.forEach((fn) => {
    try {
      fn(accessToken, refreshToken);
    } catch (e) {
      console.warn('authEvents (token) :', e?.message || e);
    }
  });
};

export const emitSessionExpired = () => {
  sessionListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('authEvents (session) :', e?.message || e);
    }
  });
};
