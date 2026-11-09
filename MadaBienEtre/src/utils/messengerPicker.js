// src/utils/messengerPicker.js
// Sélection de photo (appareil / galerie) et de document, avec contrôle de
// taille et de type AVANT l'envoi (le serveur revérifie tout).
import { Platform } from 'react-native';

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
const DOC_EXT = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv'];

const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

export const pickPhoto = async (source) => {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { error: "L'accès à l'appareil photo est refusé." };
  } else if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { error: "L'accès à la galerie est refusé." };
  }
  const options = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
  const res = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  if (a.fileSize && a.fileSize > MAX_IMAGE_BYTES) return { error: 'Image trop lourde (maximum 10 Mo).' };
  return {
    file: {
      uri: a.uri,
      name: a.fileName || `photo.${extOf(a.uri) || 'jpg'}`,
      mimeType: a.mimeType || 'image/jpeg',
      size: a.fileSize,
      kind: 'image',
    },
  };
};

export const pickDocument = async () => {
  const res = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
    ],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  if (!DOC_EXT.includes(extOf(a.name))) {
    return { error: 'Format non autorisé (PDF, Word, Excel, PowerPoint, TXT, CSV).' };
  }
  if (a.size && a.size > MAX_FILE_BYTES) return { error: 'Fichier trop lourd (maximum 15 Mo).' };
  return { file: { uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size, kind: 'file' } };
};
