// src/utils/documentUtils.js
// ============================================================
// Outils communs pour les documents CIN / certificat (image OU PDF)
// — identiques sur Android, iOS et Web.
// ============================================================
import { Platform } from 'react-native';

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB

const EXT_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Extension (en minuscules) d'une URL / d'un nom de fichier, sans query ni hash. */
export const getExtension = (value) => {
  if (!value || typeof value !== 'string') return '';
  const clean = value.split('#')[0].split('?')[0];
  const last = clean.split('/').pop() || '';
  const idx = last.lastIndexOf('.');
  return idx >= 0 ? last.slice(idx + 1).toLowerCase() : '';
};

export const isPdfUrl = (url) => getExtension(url) === 'pdf';

export const mimeFromExtension = (ext) => EXT_TO_MIME[String(ext || '').toLowerCase()] || null;

/**
 * Déduit l'extension fiable d'un fichier choisi : d'abord son type MIME,
 * puis son nom, puis son URI. Défaut : jpg (photo de galerie).
 */
export const resolveExtension = (asset) => {
  const mime = String(asset?.mimeType || asset?.type || '').toLowerCase();
  if (MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];

  for (const source of [asset?.name, asset?.fileName, asset?.uri]) {
    const ext = getExtension(source);
    if (EXT_TO_MIME[ext]) return ext === 'jpeg' ? 'jpg' : ext;
  }
  return 'jpg';
};

/**
 * Construit le FormData d'un document (champ "file") compatible
 * Android / iOS / Web, avec un nom + un type MIME toujours corrects.
 */
export const buildDocumentFormData = async (asset, defaultBaseName = 'document', fieldName = 'file') => {
  if (!asset?.uri) throw new Error('Aucun fichier sélectionné.');

  const ext = resolveExtension(asset);
  const mime = EXT_TO_MIME[ext];
  const filename = `${defaultBaseName}.${ext}`;
  const formData = new FormData();

  if (Platform.OS === 'web') {
    let blob = asset.file;
    if (!blob) {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Impossible de lire le fichier sélectionné.');
      blob = await response.blob();
    }
    if (!blob || blob.size === 0) throw new Error('Le fichier sélectionné est vide.');
    // Le navigateur peut donner un type vide : on force le bon.
    const typed = blob.type === mime ? blob : new Blob([blob], { type: mime });
    formData.append(fieldName, typed, filename);
  } else {
    formData.append(fieldName, { uri: asset.uri, type: mime, name: filename });
  }

  return formData;
};
