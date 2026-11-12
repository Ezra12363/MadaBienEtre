// src/utils/inputMasks.js
// ============================================================
// Masques de saisie des formulaires (création / modification de compte,
// inscription). Chaque fonction nettoie la valeur au fur et à mesure de la frappe.
// Le téléphone est géré par components/common/PhoneInput + utils/phone.
// ============================================================

import { validatePhoneNumber } from './phone';

/** Nom complet : lettres (accents inclus), espaces, tiret, apostrophe, point. Pas de chiffres. */
export const maskFullname = (value) =>
  String(value || '')
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’.\-\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, 100);

/** Email : sans espaces, en minuscules. */
export const maskEmail = (value) =>
  String(value || '')
    .replace(/\s/g, '')
    .toLowerCase()
    .slice(0, 254);

export const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());

/**
 * Règles du mot de passe côté serveur à l'inscription (schemas/auth.py) :
 * 8 caractères min, majuscule, minuscule, chiffre, caractère spécial.
 */
export const getPasswordRuleError = (value) => {
  const p = String(value || '');
  if (!p) return 'Le mot de passe est requis.';
  if (p.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[A-Z]/.test(p)) return 'Ajoutez au moins une majuscule.';
  if (!/[a-z]/.test(p)) return 'Ajoutez au moins une minuscule.';
  if (!/[0-9]/.test(p)) return 'Ajoutez au moins un chiffre.';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(p)) {
    return 'Ajoutez au moins un caractère spécial (! @ # $ % ^ & * ( ) , . ? " : { } | < >).';
  }
  if (p.length > 72) return 'Le mot de passe ne doit pas dépasser 72 caractères.';
  return '';
};

// ============================================================
// MASQUES SUPPLÉMENTAIRES (tous les formulaires de l'application)
// Chaque masque nettoie / formate la valeur pendant la frappe.
// ============================================================

const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

/** Chiffres uniquement, longueur max. */
export const maskDigits = (max = 20) => (value) => onlyDigits(value).slice(0, max);

/** Code OTP / code à N chiffres. */
export const maskOtp = (length = 6) => maskDigits(length);

/** Montant : chiffres uniquement, séparateur de milliers « 50 000 ». */
export const maskAmount = (value, max = 9) => {
  const d = onlyDigits(value).slice(0, max).replace(/^0+(?=\d)/, '');
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

/** « 50 000 » -> 50000 */
export const parseAmount = (value) => Number(onlyDigits(value)) || 0;

/** Nombre entier positif (durée, pourcentage, quantité…). */
export const maskInteger = (max = 6) => (value) => onlyDigits(value).slice(0, max).replace(/^0+(?=\d)/, '');

/** Nombre décimal positif : « 12,5 » -> « 12.5 ». */
export const maskDecimal = (value, max = 10) => {
  let v = String(value ?? '').replace(',', '.').replace(/[^0-9.]/g, '');
  const i = v.indexOf('.');
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
  return v.slice(0, max);
};

/** Numéro malgache local « 034 12 345 67 » (10 chiffres, groupes 3-2-3-2). */
export const maskMgPhone = (value) => {
  const d = onlyDigits(value).slice(0, 10);
  const parts = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 8), d.slice(8, 10)].filter(Boolean);
  return parts.join(' ');
};

/** CIN malgache : 12 chiffres groupés « 101 234 567 890 ». */
export const maskCin = (value) =>
  onlyDigits(value).slice(0, 12).replace(/(\d{3})(?=\d)/g, '$1 ').trim();

/** Date « JJ/MM/AAAA » (slashs automatiques). */
export const maskDateFr = (value) => {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

/** Heure « HH:MM:SS » (deux-points automatiques). */
export const maskTimeHms = (value) => {
  const d = onlyDigits(value).slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
  return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4)}`;
};

/** Référence de transaction : majuscules, lettres/chiffres/point/tiret. */
export const maskReference = (value) =>
  String(value ?? '').toUpperCase().replace(/[^A-Z0-9.\-_]/g, '').slice(0, 40);

/** Numéro de compte bancaire : chiffres, groupes de 4. */
export const maskBankAccount = (value) =>
  onlyDigits(value).slice(0, 28).replace(/(\d{4})(?=\d)/g, '$1 ').trim();

/** Nom de banque / libellé court : lettres, chiffres, espace, & . - ' */
export const maskLabel = (max = 60) => (value) =>
  String(value ?? '')
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9'’&.\-\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, max);

/** Texte libre d'une ligne : pas de caractères de contrôle, espaces nettoyés. */
export const maskText = (max = 200) => (value) =>
  String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, max);

/** Texte libre multi-lignes (description, message, motif). */
export const maskNote = (max = 1000) => (value) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/^\s+/, '')
    .slice(0, max);

/** Adresse : lettres, chiffres, espace et , . ' - / # ° ( ) */
export const maskAddress = (value) =>
  String(value ?? '')
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9,.'’\-/#°()\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, 200);

// ============================================================
// RÈGLES DE VALIDATION  (retournent '' si valide, sinon le message d'erreur)
// ============================================================
const isEmpty = (v) => String(v ?? '').trim() === '';

export const rules = {
  required: (label = 'Ce champ') => (v) => (isEmpty(v) ? `${label} est requis.` : ''),

  minLen: (n, label = 'Ce champ') => (v) =>
    !isEmpty(v) && String(v).trim().length < n ? `${label} doit contenir au moins ${n} caractères.` : '',

  maxLen: (n, label = 'Ce champ') => (v) =>
    String(v ?? '').length > n ? `${label} ne doit pas dépasser ${n} caractères.` : '',

  fullname: (v) => {
    if (isEmpty(v)) return 'Le nom complet est requis.';
    const s = String(v).trim();
    if (s.length < 3) return 'Le nom doit contenir au moins 3 caractères.';
    if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(s)) return 'Le nom doit contenir des lettres.';
    return '';
  },

  email: (v) => {
    if (isEmpty(v)) return "L'adresse email est requise.";
    return isValidEmail(v) ? '' : "Adresse email invalide (ex. nom@domaine.com).";
  },

  /** Email facultatif : valide seulement s'il est rempli. */
  emailOptional: (v) => (isEmpty(v) || isValidEmail(v) ? '' : "Adresse email invalide (ex. nom@domaine.com)."),

  /** Téléphone E.164 (voir components/common/PhoneInput). */
  phone: (v) => validatePhoneNumber(v),

  phoneOptional: (v) => (isEmpty(v) ? '' : validatePhoneNumber(v)),

  password: (v) => getPasswordRuleError(v),

  confirmPassword: (other) => (v) => {
    if (isEmpty(v)) return 'Confirmez le mot de passe.';
    return v === other ? '' : 'Les mots de passe ne correspondent pas.';
  },

  otp: (length = 6) => (v) => {
    const d = onlyDigits(v);
    if (!d) return 'Le code est requis.';
    return d.length === length ? '' : `Le code doit contenir ${length} chiffres.`;
  },

  /** Montant (masque maskAmount) : min / max optionnels. */
  amount: ({ min = 1, max, label = 'Le montant', required = true } = {}) => (v) => {
    if (isEmpty(v)) return required ? `${label} est requis.` : '';
    const n = parseAmount(v);
    if (!n || n < min) return `${label} doit être d'au moins ${String(min).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ar.`;
    if (max && n > max) return `${label} ne doit pas dépasser ${String(max).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ar.`;
    return '';
  },

  /** Nombre (entier ou décimal) dans [min, max]. */
  number: ({ min, max, label = 'La valeur', required = true } = {}) => (v) => {
    if (isEmpty(v)) return required ? `${label} est requise.` : '';
    const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
    if (!Number.isFinite(n)) return `${label} doit être un nombre.`;
    if (min != null && n < min) return `${label} doit être au moins ${min}.`;
    if (max != null && n > max) return `${label} ne doit pas dépasser ${max}.`;
    return '';
  },

  /** Numéro malgache local : 032 / 033 / 034 / 037 / 038 + 7 chiffres. */
  mgPhone: (v) => {
    const d = onlyDigits(v);
    if (!d) return 'Le numéro de téléphone est requis.';
    if (!/^03[23478]/.test(d)) return 'Le numéro doit commencer par 032, 033, 034, 037 ou 038.';
    return d.length === 10 ? '' : 'Le numéro doit contenir 10 chiffres (ex. 034 12 345 67).';
  },

  cin: (v) => {
    const d = onlyDigits(v);
    if (!d) return 'Le numéro CIN est requis.';
    return d.length === 12 ? '' : 'Le CIN doit contenir 12 chiffres.';
  },

  bankAccount: (v) => {
    const d = onlyDigits(v);
    if (!d) return 'Le numéro de compte est requis.';
    return d.length >= 8 ? '' : 'Numéro de compte trop court (8 chiffres minimum).';
  },

  reference: (v) => {
    const s = String(v ?? '').trim();
    if (!s) return 'La référence est requise.';
    return s.length >= 4 ? '' : 'La référence est trop courte (4 caractères minimum).';
  },

  /** Date « JJ/MM/AAAA » valide (et pas dans le passé si notPast). */
  dateFr: ({ notPast = false, required = true } = {}) => (v) => {
    if (isEmpty(v)) return required ? 'La date est requise.' : '';
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v));
    if (!m) return 'Date incomplète (format JJ/MM/AAAA).';
    const d = Number(m[1]); const mo = Number(m[2]); const y = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return "Cette date n'existe pas.";
    if (notPast) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (dt < today) return 'La date ne peut pas être dans le passé.';
    }
    return '';
  },

  /** Heure « HH:MM » ou « HH:MM:SS » valide. */
  time: ({ required = true } = {}) => (v) => {
    if (isEmpty(v)) return required ? "L'heure est requise." : '';
    const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(v));
    if (!m) return 'Heure incomplète (format HH:MM:SS).';
    if (Number(m[1]) > 23 || Number(m[2]) > 59 || (m[3] != null && Number(m[3]) > 59)) return 'Heure invalide.';
    return '';
  },
};

/** Enchaîne plusieurs règles : retourne la première erreur trouvée. */
export const composeRules = (...fns) => (value, all) => {
  for (const fn of fns) {
    const err = typeof fn === 'function' ? fn(value, all) : '';
    if (err) return err;
  }
  return '';
};

/** Valide un objet de valeurs avec un objet de règles : { champ: règle } -> { champ: message } */
export const validateFields = (values, schema) => {
  const errors = {};
  Object.keys(schema).forEach((key) => {
    const err = schema[key](values[key], values);
    if (err) errors[key] = err;
  });
  return errors;
};
