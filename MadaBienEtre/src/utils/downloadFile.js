// src/utils/downloadFile.js
//
// Téléchargement d'un PDF protégé (Authorization: Bearer ...) qui marche partout :
//   - Web      : fetch + blob + <a download>  (le token n'apparaît jamais dans l'URL)
//   - Android / iOS : fichier téléchargé dans le cache de l'app avec l'en-tête
//     Authorization, puis feuille de partage système (Enregistrer dans Fichiers /
//     Drive, ouvrir dans un lecteur PDF, WhatsApp, e-mail...).
//
// Pourquoi pas Linking.openURL(url) comme avant ? Parce que le navigateur Android
// n'envoie pas le token => 401 « Authentification requise » et aucun PDF.
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../config/env';
import { getExtension, mimeFromExtension } from './documentUtils';

const TOKEN_KEY = '@mada_token';

const toFullUrl = (path) => (/^https?:\/\//i.test(path) ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`);

const safeName = (name, fallback) => {
  const cleaned = String(name || fallback)
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = cleaned || fallback;
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
};

const httpMessage = (status) => {
  if (status === 401) return 'Session expirée : reconnectez-vous puis réessayez.';
  if (status === 403) return "Accès refusé : ce certificat n'est pas disponible pour votre compte.";
  if (status === 404) return 'Certificat introuvable.';
  return `Téléchargement impossible (erreur ${status}).`;
};

const loadNativeModules = () => {
  let FileSystem = null;
  let Sharing = null;
  try {
    try {
      FileSystem = require('expo-file-system/legacy');
    } catch (e) {
      FileSystem = require('expo-file-system');
    }
    Sharing = require('expo-sharing');
  } catch (e) {
    FileSystem = null;
    Sharing = null;
  }
  return { FileSystem, Sharing };
};

/**
 * @param {string} path      Chemin API (ex. '/therapists/me/certificate/download') ou URL complète
 * @param {string} filename  Nom proposé (ex. 'MBE-TH-2026-000013.pdf')
 * @param {{dialogTitle?: string}} [options]
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function downloadAuthenticatedPdf(path, filename = 'certificat.pdf', options = {}) {
  if (!path) return { success: false, error: 'Lien de téléchargement introuvable.' };

  const url = toFullUrl(path);
  const name = safeName(filename, 'certificat.pdf');

  let token = null;
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch (e) {
    token = null;
  }
  if (!token) {
    return { success: false, error: 'Vous devez être connecté pour télécharger ce certificat.' };
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/pdf' };

  try {
    // ------------------------------ WEB ------------------------------
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const response = await fetch(url, { headers });
      if (!response.ok) return { success: false, error: httpMessage(response.status) };

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 4000);
      return { success: true };
    }

    // ------------------------- ANDROID / IOS -------------------------
    const { FileSystem, Sharing } = loadNativeModules();

    if (!FileSystem || !FileSystem.downloadAsync) {
      // Module absent (ancien build) : repli navigateur, le backend accepte ?token=
      const sep = url.includes('?') ? '&' : '?';
      await Linking.openURL(`${url}${sep}token=${encodeURIComponent(token)}`);
      return { success: true };
    }

    const target = `${FileSystem.cacheDirectory}${name}`;
    try {
      await FileSystem.deleteAsync(target, { idempotent: true });
    } catch (e) {
      // pas bloquant
    }

    const result = await FileSystem.downloadAsync(url, target, { headers });
    if (!result || (result.status && result.status >= 400)) {
      try {
        await FileSystem.deleteAsync(target, { idempotent: true });
      } catch (e) {
        // pas bloquant
      }
      return { success: false, error: httpMessage(result?.status || 0) };
    }

    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: options.dialogTitle || 'Enregistrer ou partager le certificat',
      });
      return { success: true };
    }

    return { success: false, error: "Aucune application ne peut ouvrir ou enregistrer le PDF sur cet appareil." };
  } catch (error) {
    console.warn('downloadAuthenticatedPdf:', error);
    return {
      success: false,
      error: 'Impossible de télécharger le certificat. Vérifiez votre connexion puis réessayez.',
    };
  }
}


// ============================================================
// DOCUMENTS (CIN / certificat) : image OU PDF — Web + Android + iOS
// ============================================================

const sameOrigin = (url) => {
  try {
    return new URL(url).origin === new URL(API_URL).origin;
  } catch (e) {
    return false;
  }
};

/** Nom de fichier dont l'extension correspond TOUJOURS au vrai fichier (celle de l'URL). */
const documentFileName = (url, suggested, fallbackBase = 'document') => {
  const ext = getExtension(url) || getExtension(suggested) || 'jpg';
  const base = String(suggested || fallbackBase)
    .replace(/\.[A-Za-z0-9]{2,5}$/, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base || fallbackBase}.${ext}`;
};

/**
 * Télécharge un document (image ou PDF).
 *  - Web : fetch + blob + <a download> ; repli : ouverture dans un nouvel onglet.
 *  - Android / iOS : fichier téléchargé dans le cache puis feuille de partage
 *    système (Enregistrer dans Fichiers / Drive, ouvrir, WhatsApp, e-mail...).
 * Le jeton n'est envoyé que si le fichier est sur NOTRE serveur (jamais à Cloudinary).
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function downloadDocument(url, suggestedName = 'document', options = {}) {
  if (!url) return { success: false, error: 'Document indisponible.' };

  const fullUrl = toFullUrl(url);
  const name = documentFileName(fullUrl, suggestedName);
  const mime = mimeFromExtension(getExtension(name)) || 'application/octet-stream';

  const headers = {};
  if (sameOrigin(fullUrl)) {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      // pas bloquant : /uploads est public
    }
  }

  try {
    // ------------------------------ WEB ------------------------------
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const response = await fetch(fullUrl, { headers });
        if (!response.ok) {
          return { success: false, error: `Téléchargement impossible (erreur ${response.status}).` };
        }
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(new Blob([blob], { type: mime }));
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(objectUrl), 4000);
        return { success: true };
      } catch (fetchError) {
        // CORS / réseau : on laisse le navigateur ouvrir le fichier
        window.open(fullUrl, '_blank', 'noopener');
        return { success: true };
      }
    }

    // ------------------------- ANDROID / IOS -------------------------
    const { FileSystem, Sharing } = loadNativeModules();

    if (!FileSystem || !FileSystem.downloadAsync) {
      await Linking.openURL(fullUrl);
      return { success: true };
    }

    const target = `${FileSystem.cacheDirectory}${name}`;
    try {
      await FileSystem.deleteAsync(target, { idempotent: true });
    } catch (e) {
      // pas bloquant
    }

    const result = await FileSystem.downloadAsync(fullUrl, target, { headers });
    if (!result || (result.status && result.status >= 400)) {
      try {
        await FileSystem.deleteAsync(target, { idempotent: true });
      } catch (e) {
        // pas bloquant
      }
      return { success: false, error: `Téléchargement impossible (erreur ${result?.status || 0}).` };
    }

    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(result.uri, {
        mimeType: mime,
        UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : mime === 'image/png' ? 'public.png' : 'public.jpeg',
        dialogTitle: options.dialogTitle || 'Enregistrer ou partager le document',
      });
      return { success: true };
    }

    await Linking.openURL(fullUrl);
    return { success: true };
  } catch (error) {
    console.warn('downloadDocument:', error);
    return { success: false, error: 'Impossible de télécharger le document. Vérifiez votre connexion puis réessayez.' };
  }
}

/** Ouvre un document : nouvel onglet sur le web, application système sur mobile. */
export async function openDocument(url) {
  if (!url) return { success: false, error: 'Document indisponible.' };
  const fullUrl = toFullUrl(url);
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(fullUrl, '_blank', 'noopener');
      return { success: true };
    }
    await Linking.openURL(fullUrl);
    return { success: true };
  } catch (e) {
    return { success: false, error: "Impossible d'ouvrir le document." };
  }
}

export default downloadAuthenticatedPdf;
