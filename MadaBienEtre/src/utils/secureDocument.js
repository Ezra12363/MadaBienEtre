// src/utils/secureDocument.js
//
// Récupère un document (PDF) protégé par Bearer token et le renvoie en base64,
// SANS jamais l'enregistrer de façon durable ni proposer de téléchargement :
// il sert uniquement à l'affichage dans la visionneuse (SecurePdfViewerModal).
//   - Web      : fetch + arrayBuffer
//   - Android  : téléchargement temporaire dans le cache, lecture base64, suppression
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../config/env';

const TOKEN_KEY = '@mada_token';

const toFullUrl = (path) =>
  /^https?:\/\//i.test(path) ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;

const sameOrigin = (url) => {
  try {
    return new URL(url).origin === new URL(API_URL).origin;
  } catch (e) {
    return false;
  }
};

const httpMessage = (status) => {
  if (status === 401) return 'Session expirée : reconnectez-vous puis réessayez.';
  if (status === 403) return "Accès refusé : ce certificat n'est pas disponible pour votre compte.";
  if (status === 404) return "Ce certificat n'est pas encore disponible.";
  return `Impossible de charger le certificat (erreur ${status}).`;
};

const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const loadFileSystem = () => {
  try {
    try {
      return require('expo-file-system/legacy');
    } catch (e) {
      return require('expo-file-system');
    }
  } catch (e) {
    return null;
  }
};

/**
 * @param {string} path  Chemin API ou URL complète d'un PDF
 * @returns {Promise<{success: boolean, base64?: string, status?: number, error?: string}>}
 */
export async function fetchPdfAsBase64(path) {
  if (!path) return { success: false, status: 404, error: httpMessage(404) };

  const url = toFullUrl(path);

  const headers = { Accept: 'application/pdf' };
  if (sameOrigin(url)) {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      // pas bloquant
    }
  }

  try {
    if (Platform.OS === 'web') {
      const response = await fetch(url, { headers, cache: 'no-store' });
      if (!response.ok) {
        return { success: false, status: response.status, error: httpMessage(response.status) };
      }
      return { success: true, base64: bufferToBase64(await response.arrayBuffer()) };
    }

    const FileSystem = loadFileSystem();
    if (!FileSystem?.downloadAsync) {
      return { success: false, error: "Impossible d'afficher le certificat sur cet appareil." };
    }

    const target = `${FileSystem.cacheDirectory}cert-view-${Date.now()}.pdf`;
    try {
      const result = await FileSystem.downloadAsync(url, target, { headers });
      if (!result || (result.status && result.status >= 400)) {
        return {
          success: false,
          status: result?.status || 0,
          error: httpMessage(result?.status || 0),
        };
      }
      const base64 = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType?.Base64 || 'base64',
      });
      return { success: true, base64 };
    } finally {
      try {
        await FileSystem.deleteAsync(target, { idempotent: true });
      } catch (e) {
        // pas bloquant
      }
    }
  } catch (error) {
    console.warn('fetchPdfAsBase64:', error);
    return {
      success: false,
      error: 'Impossible de charger le certificat. Vérifiez votre connexion puis réessayez.',
    };
  }
}

export default fetchPdfAsBase64;
