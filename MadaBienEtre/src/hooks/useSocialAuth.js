// src/hooks/useSocialAuth.js
// ============================================================
// Connexion Google / Apple.
//
// Dépendances (à installer une seule fois) :
//   npx expo install expo-auth-session expo-web-browser expo-crypto expo-apple-authentication
//
// Si un paquet manque, le bouton affiche un message clair au lieu de
// faire planter l'application.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
} from '../config/env';

let Google = null;
let AppleAuth = null;

try {
  // eslint-disable-next-line global-require
  Google = require('expo-auth-session/providers/google');
  // eslint-disable-next-line global-require
  require('expo-web-browser').maybeCompleteAuthSession();
} catch (_e) {
  Google = null;
}

try {
  // eslint-disable-next-line global-require
  AppleAuth = require('expo-apple-authentication');
} catch (_e) {
  AppleAuth = null;
}

// Hook de repli stable (même ordre d'appel à chaque rendu) si le paquet manque
const useGoogleRequest =
  Google?.useIdTokenAuthRequest ||
  (() => [null, null, async () => ({ type: 'dismiss' })]);

const PLACEHOLDER = 'not-configured.apps.googleusercontent.com';

export default function useSocialAuth({ socialLogin, onMessage, role = 'CLIENT' }) {
  const [busy, setBusy] = useState(null); // 'google' | 'apple' | null
  const [appleAvailable, setAppleAvailable] = useState(false);
  const handledRef = useRef(null);

  const googleConfigured = !!(
    GOOGLE_WEB_CLIENT_ID ||
    GOOGLE_ANDROID_CLIENT_ID ||
    GOOGLE_IOS_CLIENT_ID
  );

  const [request, response, promptAsync] = useGoogleRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID || PLACEHOLDER,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID || PLACEHOLDER,
    iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID || PLACEHOLDER,
  });

  const say = useCallback(
    (type, message) => onMessage && onMessage(type, message),
    [onMessage]
  );

  // Disponibilité d'Apple Sign-In (iOS uniquement)
  useEffect(() => {
    let alive = true;
    if (Platform.OS === 'ios' && AppleAuth?.isAvailableAsync) {
      AppleAuth.isAvailableAsync()
        .then((ok) => alive && setAppleAvailable(!!ok))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, []);

  // Réponse Google
  useEffect(() => {
    if (!response || handledRef.current === response) return;
    handledRef.current = response;

    if (response.type === 'success') {
      const idToken = response.params?.id_token || response.authentication?.idToken;
      if (!idToken) {
        setBusy(null);
        say('error', 'Google n’a pas fourni de jeton. Réessayez.');
        return;
      }
      (async () => {
        const result = await socialLogin('google', idToken, { role });
        setBusy(null);
        if (result?.success) {
          say('success', 'Connexion Google réussie. Bienvenue !');
        } else {
          say('error', result?.error || 'Connexion Google impossible.');
        }
      })();
    } else {
      setBusy(null);
      if (response.type === 'error') {
        say('error', 'Connexion Google annulée ou refusée.');
      }
    }
  }, [response, socialLogin, role, say]);

  const signInWithGoogle = useCallback(async () => {
    if (busy) return;
    if (!Google) {
      say('warning', 'Google Sign-In : installez expo-auth-session, expo-web-browser et expo-crypto.');
      return;
    }
    if (!googleConfigured) {
      say('warning', 'Google Sign-In non configuré (GOOGLE_*_CLIENT_ID manquants).');
      return;
    }
    if (!request) {
      say('info', 'Préparation de Google… réessayez dans un instant.');
      return;
    }
    setBusy('google');
    try {
      await promptAsync();
    } catch (_e) {
      setBusy(null);
      say('error', 'Impossible d’ouvrir Google.');
    }
  }, [busy, googleConfigured, request, promptAsync, say]);

  const signInWithApple = useCallback(async () => {
    if (busy) return;
    if (!AppleAuth) {
      say('warning', 'Apple Sign-In : installez expo-apple-authentication.');
      return;
    }
    if (!appleAvailable) {
      say('info', 'La connexion avec Apple est disponible uniquement sur iPhone / iPad.');
      return;
    }
    setBusy('apple');
    try {
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential?.identityToken) {
        say('error', 'Apple n’a pas fourni de jeton. Réessayez.');
        return;
      }
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      const result = await socialLogin('apple', credential.identityToken, {
        role,
        fullName: fullName || undefined,
      });
      if (result?.success) {
        say('success', 'Connexion Apple réussie. Bienvenue !');
      } else {
        say('error', result?.error || 'Connexion Apple impossible.');
      }
    } catch (e) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        say('error', 'Connexion Apple impossible.');
      }
    } finally {
      setBusy(null);
    }
  }, [busy, appleAvailable, socialLogin, role, say]);

  return { signInWithGoogle, signInWithApple, appleAvailable, socialBusy: busy };
}
