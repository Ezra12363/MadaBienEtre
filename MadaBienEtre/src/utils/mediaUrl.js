// src/utils/mediaUrl.js
// ---------------------------------------------------------------------------
// SOURCE UNIQUE pour afficher les photos (profil, CIN, certificats, services...).
//
// 🐛 ANTONY (pourquoi la photo de profil disparaissait) :
// Le backend enregistrait en base l'URL COMPLÈTE avec l'IP du moment, ex :
//   http://10.78.77.30:8000/uploads/profiles/xxx.jpg
// Quand l'IP du serveur change (autre Wi-Fi, redémarrage du routeur, autre PC,
// nouvelle IP DHCP...), l'ancienne URL pointe vers un hôte mort => photo grise.
//
// ✅ SOLUTION : tout ce qui contient « /uploads/ » est RECONSTRUIT avec
// l'API_URL ACTUELLE. Les URLs externes (Cloudinary, Google, Apple...) restent
// inchangées.
// ---------------------------------------------------------------------------
import { API_URL } from '../config/env';

// nom de fichier image sans dossier ni protocole (ex: "therapist_17_profile.jpg")
const BARE_IMAGE_RE = /^[^/:?#\s]+\.(?:jpe?g|png|gif|webp|heic)$/i;

const UPLOADS_RE = /^(?:https?:\/\/[^/]+)?\/?(uploads\/.*)$/i;

/**
 * Retourne une URL affichable, basée sur l'API_URL actuelle.
 * - chemin relatif ("/uploads/x.jpg", "uploads\\x.jpg")  -> API_URL + chemin
 * - URL absolue d'un ancien hôte contenant "/uploads/"   -> API_URL + chemin
 * - Cloudinary / https externe / data: / blob: / file:   -> inchangé
 */
export const normalizeMediaUrl = (value) => {
  if (!value || typeof value !== 'string') return value || null;
  const v = value.trim().replace(/\\/g, '/');
  if (!v) return null;
  if (/^(data:|blob:|file:|content:|asset:)/i.test(v)) return v;

  const base = String(API_URL || '').replace(/\/+$/, '');
  const m = v.match(UPLOADS_RE);
  if (m) return `${base}/${m[1]}`;

  // 🐛 FIX 404 « GET /therapist_17_profile.jpg » : certaines lignes de la base
  // contiennent seulement le NOM du fichier (sans dossier). Sans ce correctif,
  // l'app interrogeait la racine du serveur (/nom.jpg) qui n'existe pas.
  // Un nom nu est donc rangé sous /uploads/profiles/.
  if (BARE_IMAGE_RE.test(v)) return `${base}/uploads/profiles/${v}`;

  if (/^https?:\/\//i.test(v)) return v; // externe (Cloudinary...) : on ne touche pas
  return `${base}${v.startsWith('/') ? '' : '/'}${v}`;
};

// Parcourt une réponse JSON et réécrit toute chaîne qui est un chemin « uploads ».
const UPLOAD_STRING_RE = /^(?:https?:\/\/[^/\s]+)?\/?uploads\/[^\s]+$/i;

export const deepNormalizeMedia = (data, depth = 0) => {
  if (depth > 12 || data == null) return data;
  if (typeof data === 'string') {
    return UPLOAD_STRING_RE.test(data.trim()) ? normalizeMediaUrl(data) : data;
  }
  if (Array.isArray(data)) return data.map((x) => deepNormalizeMedia(x, depth + 1));
  if (typeof data === 'object') {
    // ne touche pas aux Blob / FormData / etc.
    if (Object.getPrototypeOf(data) !== Object.prototype) return data;
    const out = {};
    for (const k of Object.keys(data)) out[k] = deepNormalizeMedia(data[k], depth + 1);
    return out;
  }
  return data;
};

export default normalizeMediaUrl;
