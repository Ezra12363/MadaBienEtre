// src/utils/chatImage.js
// Sélection + validation + URL des images du chat (Android, iOS et Web).
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { API_URL } from '../config/env';
import { cleanToken } from './wsUrl';

export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo (idem backend)
export const CHAT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const extOf = (name = '') => String(name).split('?')[0].split('.').pop().toLowerCase();

export const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

/** Vérifie le fichier AVANT l'envoi (le serveur revérifie de toute façon). */
export const validateChatImage = (asset) => {
  if (!asset?.uri) return { ok: false, error: 'Aucune image sélectionnée.' };

  const mime = String(asset.mimeType || '').toLowerCase();
  if (mime && !CHAT_IMAGE_TYPES.includes(mime)) {
    return { ok: false, error: 'Format non supporté. Utilisez une image JPEG, PNG ou WebP.' };
  }
  if (asset.size && asset.size > CHAT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Image trop lourde (${formatBytes(asset.size)}). Maximum : 5 Mo.`,
    };
  }
  return { ok: true };
};

/**
 * URL affichable d'une image du chat.
 * - blob:/file:/data: (aperçu local) -> inchangée
 * - /chat/files/... (serveur)        -> API_URL + ?token=... (un <img> web
 *   ne peut pas envoyer d'en-tête Authorization ; le serveur contrôle que
 *   le porteur du token est bien dans la conversation)
 */
export const resolveChatImageUrl = (url, token) => {
  if (!url) return null;
  if (/^(blob:|data:|file:|content:|asset:)/i.test(url)) return url;

  let full = /^https?:\/\//i.test(url)
    ? url
    : `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  if (full.includes('/chat/files/')) {
    const clean = cleanToken(token);
    if (clean) full += `${full.includes('?') ? '&' : '?'}token=${encodeURIComponent(clean)}`;
  }
  return full;
};

/* ------------------------------ sélection ------------------------------ */
const pickWeb = () =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = CHAT_IMAGE_TYPES.join(',');
    input.style.display = 'none';

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocusBack);
      if (input.parentNode) input.parentNode.removeChild(input);
      resolve(value);
    };
    // Annulation : le navigateur ne déclenche pas onchange -> on écoute le retour du focus
    const onFocusBack = () => setTimeout(() => finish(null), 1200);

    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return finish(null);
      finish({
        asset: {
          uri: URL.createObjectURL(file),
          name: file.name,
          mimeType: file.type || MIME_BY_EXT[extOf(file.name)] || '',
          size: file.size,
          file,
        },
      });
    };

    document.body.appendChild(input);
    window.addEventListener('focus', onFocusBack);
    input.click();
  });

const askSource = () =>
  new Promise((resolve) => {
    Alert.alert(
      'Envoyer une photo',
      'Choisissez la source',
      [
        { text: 'Galerie', onPress: () => resolve('gallery') },
        { text: 'Appareil photo', onPress: () => resolve('camera') },
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });

const toAsset = (picked) => {
  const name = picked.fileName || picked.uri.split('/').pop() || 'photo.jpg';
  return {
    uri: picked.uri,
    name,
    // quality < 1 : l'image est ré-encodée (JPEG) -> plus légère
    mimeType: picked.mimeType || MIME_BY_EXT[extOf(name)] || 'image/jpeg',
    size: picked.fileSize,
  };
};

const pickNative = async () => {
  const source = await askSource();
  if (!source) return null;

  const options = {
    mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? ['images'],
    quality: 0.7,
    allowsEditing: false,
  };

  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { error: "L'accès à l'appareil photo est refusé." };
    const res = await ImagePicker.launchCameraAsync(options);
    return res.canceled ? null : { asset: toAsset(res.assets[0]) };
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { error: "L'accès à la galerie est refusé." };
  const res = await ImagePicker.launchImageLibraryAsync(options);
  return res.canceled ? null : { asset: toAsset(res.assets[0]) };
};

/** Retourne null (annulé), { asset } ou { error }. */
export const pickChatImage = () => (Platform.OS === 'web' ? pickWeb() : pickNative());

// Modale de confirmation de l'application (components/chat/ChatConfirmHost).
// Un « hôte » est monté par chaque écran qui en a besoin et s'enregistre ici ;
// sans hôte, on retombe sur window.confirm / Alert (ancien comportement).
let confirmHandler = null;

export const registerConfirmHandler = (handler) => {
  confirmHandler = handler;
  return () => {
    if (confirmHandler === handler) confirmHandler = null;
  };
};

/**
 * Confirmation compatible web + Android + iOS.
 * options : { tone: 'danger' | 'info' | 'warning', cancelLabel, icon }
 */
export const confirmAsync = (title, message, confirmLabel = 'Supprimer', options = {}) => {
  if (confirmHandler) {
    return confirmHandler({ title, message, confirmLabel, ...options });
  }
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
};
