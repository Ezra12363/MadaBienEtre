// src/utils/toast.js
// ============================================================================
// Toast GLOBAL (web + mobile) : remplace les fenêtres « localhost indique… »
// (window.alert) et les Alert.alert d'information.
//
//   showToast('success' | 'error' | 'info', titre, message?)
//   installGlobalAlertOverrides()   -> appelé UNE fois dans App.js
//
// Après installation :
//   - window.alert(...)                         -> toast (web)
//   - Alert.alert(titre, msg)                   -> toast
//   - Alert.alert(titre, msg, [{text:'OK'}])    -> toast
//   - Alert.alert(titre, msg, [A, B])           -> dialogue natif (vraie confirmation)
// ============================================================================
import { Alert, Platform } from 'react-native';

const listeners = new Set();

export const subscribeToast = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const ERROR_RE = /(erreur|error|impossible|échec|echec|refus|invalide|interdit|non autoris|introuvable|expir|incorrect|manquant)/i;
const SUCCESS_RE = /(succès|succes|réussi|reussi|envoyé|enregistré|créé|cree|mis à jour|supprimé|ajouté|confirmé|validé|copié|✅)/i;

const guessType = (title, message) => {
  const text = `${title || ''} ${message || ''}`;
  if (ERROR_RE.test(text)) return 'error';
  if (SUCCESS_RE.test(text)) return 'success';
  return 'info';
};

export const showToast = (type, title, message) => {
  const t = title == null ? '' : String(title);
  const m = message == null ? '' : String(message);
  if (!t && !m) return;
  const payload = {
    id: Date.now() + Math.random(),
    type: ['success', 'error', 'info'].includes(type) ? type : guessType(t, m),
    title: m ? t : '',
    message: m || t,
  };
  listeners.forEach((fn) => {
    try { fn(payload); } catch (_e) { /* no-op */ }
  });
};

const OK_LABELS = /^(ok|oui|fermer|compris|d'accord|continuer|close|got it)$/i;

let installed = false;

export const installGlobalAlertOverrides = () => {
  if (installed) return;
  installed = true;

  // 1) window.alert du navigateur -> toast
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert = (msg) => showToast(undefined, '', msg == null ? '' : String(msg).replace(/\n{2,}/g, ' — ').replace(/\n/g, ' '));
  }

  // 2) Alert.alert d'information -> toast ; les vraies confirmations restent natives
  const original = Alert.alert ? Alert.alert.bind(Alert) : null;
  Alert.alert = (title, message, buttons, options) => {
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
    if (original) original(title, message, buttons, options);
  };
};
