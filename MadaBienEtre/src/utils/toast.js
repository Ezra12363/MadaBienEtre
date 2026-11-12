// src/utils/toast.js
// ============================================================================
// TOAST GLOBAL — un seul système pour toute l'application WEB.
//
//   showToast(type, titre, message?, duree?)
//       type : 'success' (vert) | 'error' (rouge) | 'delete' (rouge, corbeille)
//              | 'warning' (orange) | 'info' (bleu)
//
//   toast.success('..') / toast.error('..') / toast.delete('..')
//   toast.warning('..') / toast.info('..')
//
//   toastAdapters.msgType / typeMsg / typeTitleMsg
//       -> remplacent les anciens showToast locaux de chaque écran
//          (chaque écran avait sa propre signature et son propre style).
//
//   installGlobalAlertOverrides()   -> appelé UNE fois dans App.js
//
// RÈGLES
//   - Web     : toast identique sur TOUTES les pages (même position, même design,
//               couleur selon l'action : supprimer = rouge, succès = vert …).
//   - Android / iOS : AUCUN toast n'est affiché (showToast ne fait rien) et
//               Alert.alert n'est pas modifié.
// ============================================================================
import { Alert, Platform } from 'react-native';

export const TOAST_ENABLED = Platform.OS === 'web';

const listeners = new Set();

export const subscribeToast = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const VALID_TYPES = ['success', 'error', 'delete', 'warning', 'info'];

const DELETE_RE = /(supprim|suppression|effac|retir[ée]|delete|removed)/i;
const ERROR_RE = /(erreur|error|impossible|échec|echec|refus|invalide|interdit|non autoris|introuvable|expir|incorrect|manquant|indisponible|échoué|echoue)/i;
const WARNING_RE = /(attention|avertissement|warning|veuillez|requis|obligatoire)/i;
const SUCCESS_RE = /(succès|succes|réussi|reussi|envoy[ée]|enregistr[ée]|cr[ée]{1,2}|mis à jour|ajout[ée]|confirm[ée]|valid[ée]|copi[ée]|approuv[ée]|activ[ée]|d[ée]sactiv[ée]|✅)/i;

const guessType = (text) => {
  if (DELETE_RE.test(text) && !ERROR_RE.test(text)) return 'delete';
  if (ERROR_RE.test(text)) return 'error';
  if (WARNING_RE.test(text)) return 'warning';
  if (SUCCESS_RE.test(text)) return 'success';
  return 'info';
};

const normalizeType = (type, text) => {
  const t = type === 'danger' ? 'error' : type === 'warn' ? 'warning' : type;
  if (!VALID_TYPES.includes(t)) return guessType(text);
  // Un succès qui parle d'une suppression s'affiche en rouge (action « supprimer »).
  if (t === 'success' && DELETE_RE.test(text) && !/(annul|restaur)/i.test(text)) return 'delete';
  return t;
};

export const showToast = (type, title, message, duration) => {
  if (!TOAST_ENABLED) return; // pas de toast sur l'application Android / iOS
  const t = title == null ? '' : String(title);
  const m = message == null ? '' : String(message);
  if (!t && !m) return;
  const text = `${t} ${m}`;
  const payload = {
    id: Date.now() + Math.random(),
    type: normalizeType(type, text),
    title: m ? t : '',
    message: m || t,
    duration: typeof duration === 'number' ? duration : undefined,
  };
  listeners.forEach((fn) => {
    try { fn(payload); } catch (_e) { /* no-op */ }
  });
};

export const toast = {
  success: (message, title) => showToast('success', title || '', message),
  error: (message, title) => showToast('error', title || '', message),
  delete: (message, title) => showToast('delete', title || '', message),
  warning: (message, title) => showToast('warning', title || '', message),
  info: (message, title) => showToast('info', title || '', message),
};

// ---------------------------------------------------------------------------
// Adaptateurs : les écrans gardent leur appel habituel, mais tout passe par le
// même toast global.
// ---------------------------------------------------------------------------
export const toastAdapters = {
  /** showToast(message, type?, duree?, titre?) */
  msgType: (message, type, duration, title) =>
    showToast(type, title || '', message, typeof duration === 'number' ? duration : undefined),
  /** showToast(type, message?) */
  typeMsg: (type, message) => showToast(type, '', message),
  /** showToast(type, titre, message?) */
  typeTitleMsg: (type, title, message) => showToast(type, title, message),
  /** showToast({ type, title, message, duration }) */
  obj: (opts) => {
    const o = opts || {};
    showToast(o.type, o.title, o.message, typeof o.duration === 'number' ? o.duration : undefined);
  },
};

// ---------------------------------------------------------------------------
// Remplacement de window.alert / Alert.alert (web uniquement)
// ---------------------------------------------------------------------------
const OK_LABELS = /^(ok|oui|fermer|compris|d'accord|continuer|close|got it)$/i;

let installed = false;

export const installGlobalAlertOverrides = () => {
  if (installed) return;
  installed = true;

  // Android / iOS : on ne touche à rien.
  if (!TOAST_ENABLED || typeof window === 'undefined') return;

  // 1) window.alert du navigateur -> toast
  window.alert = (msg) =>
    showToast(undefined, '', msg == null ? '' : String(msg).replace(/\n{2,}/g, ' — ').replace(/\n/g, ' '));

  // 2) Alert.alert : information -> toast ; confirmation -> modale de l'application
  //    (react-native-web n'affiche rien pour Alert.alert avec boutons).
  Alert.alert = (title, message, buttons) => {
    const list = Array.isArray(buttons) ? buttons : [];
    const isInfo =
      list.length === 0 ||
      (list.length === 1 && (OK_LABELS.test(String(list[0]?.text || 'OK').trim()) || !list[0]?.onPress));

    if (isInfo) {
      showToast(undefined, title, message);
      const cb = list[0]?.onPress;
      if (typeof cb === 'function') {
        try { cb(); } catch (_e) { /* no-op */ }
      }
      return;
    }

    // Vraie confirmation : modale de l'application (GlobalConfirmHost)
    const cancelBtn = list.find((b) => b?.style === 'cancel');
    const actionBtns = list.filter((b) => b !== cancelBtn);
    const main = actionBtns.find((b) => b?.style === 'destructive') || actionBtns[actionBtns.length - 1] || list[0];
    // eslint-disable-next-line global-require
    const { confirmAsync } = require('./chatImage');
    confirmAsync(String(title || ''), String(message || ''), String(main?.text || 'Confirmer'), {
      cancelLabel: String(cancelBtn?.text || 'Annuler'),
      tone: main?.style === 'destructive' ? 'danger' : 'info',
    }).then((ok) => {
      const target = ok ? main : cancelBtn;
      if (target && typeof target.onPress === 'function') {
        try { target.onPress(); } catch (_e) { /* no-op */ }
      }
    });
  };
};
