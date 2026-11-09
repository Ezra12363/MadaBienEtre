// src/utils/inputMasks.js
// ============================================================
// Masques de saisie des formulaires (création / modification de compte,
// inscription). Chaque fonction nettoie la valeur au fur et à mesure de la frappe.
// Le téléphone est géré par components/common/PhoneInput + utils/phone.
// ============================================================

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
