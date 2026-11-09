// src/utils/phone.js
// ============================================================
// Masque de saisie + validation des numéros de téléphone
// (Madagascar par défaut, tous les pays acceptés).
//
// Valeur manipulée partout dans l'application : le format E.164
//   +261341234567   (Madagascar)
//   +33612345678    (France)
// Les anciens numéros « 0341234567 » restent lisibles (parseStoredPhone).
// ============================================================
import {
  DEFAULT_COUNTRY_ISO,
  KEEP_LEADING_ZERO,
  MASK_GROUPS,
  NATIONAL_LENGTH,
  findCountryByE164,
  getCountry,
} from '../constants/countries';

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

/** Longueur max / min du numéro national pour un pays. */
export const getNationalLimits = (country) => {
  const dialLen = String(country?.dial || '').length;
  const e164Max = 15 - dialLen; // E.164 : 15 chiffres maximum au total
  const known = NATIONAL_LENGTH[country?.iso];
  if (known) return { min: known[0], max: Math.min(known[1], e164Max) };
  return { min: 6, max: Math.min(14, e164Max) };
};

/** Retire le 0 initial (« 034… » -> « 34… ») sauf pour les pays où il fait partie du numéro. */
export const stripTrunkZero = (national, country) => {
  if (KEEP_LEADING_ZERO.includes(country?.iso)) return national;
  return national.replace(/^0+/, '');
};

/** Applique le masque du pays : MG « 341234567 » -> « 34 12 345 67 ». */
export const formatNational = (national, country) => {
  const digits = onlyDigits(national);
  const groups = MASK_GROUPS[country?.iso] || [3, 3, 3, 3, 3];
  const parts = [];
  let i = 0;
  for (const size of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  if (i < digits.length) parts.push(digits.slice(i)); // chiffres restants
  return parts.join(' ');
};

/** Masque d'exemple affiché en placeholder : MG « 34 12 345 67 ». */
export const getPlaceholder = (country) => {
  if (country?.iso === 'MG') return '34 12 345 67';
  const { min, max } = getNationalLimits(country);
  const len = min === max ? max : Math.min(max, 9);
  return formatNational('1234567890123456'.slice(0, len), country);
};

/**
 * Lit un numéro déjà enregistré (ou saisi) et retourne { country, national }.
 *  - « +33 6 12 34 56 78 » -> FR, « 612345678 »
 *  - « 0341234567 » (ancien format malgache) -> MG, « 341234567 »
 *  - valeur illisible (ex. « SOC… » des comptes Google/Apple) -> null
 */
export const parseStoredPhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const digits = onlyDigits(raw);
  if (!digits) return null;

  if (raw.startsWith('+')) return findCountryByE164(digits);
  if (raw.startsWith('00')) return findCountryByE164(digits.slice(2));
  if (/^0\d{9}$/.test(digits)) {
    return { country: getCountry(DEFAULT_COUNTRY_ISO), national: digits.slice(1) };
  }
  return null;
};

/** E.164 à partir du pays + numéro national saisi (« » si rien saisi). */
export const buildE164 = (country, national) => {
  const digits = stripTrunkZero(onlyDigits(national), country);
  if (!digits) return '';
  return `+${country.dial}${digits}`;
};

/** Message d'erreur (français) ou « » si le numéro est valide. */
export const validatePhoneNumber = (e164) => {
  const value = String(e164 || '').trim();
  if (!value) return 'Le numéro de téléphone est requis.';

  const parsed = parseStoredPhone(value);
  if (!parsed || !parsed.country) {
    return "Numéro invalide : choisissez le pays puis saisissez le numéro.";
  }
  const { country, national } = parsed;
  const { min, max } = getNationalLimits(country);
  const len = onlyDigits(national).length;

  if (country.iso === 'MG' && !/^3[0-9]{8}$/.test(onlyDigits(national))) {
    return 'Numéro malgache invalide : il doit avoir 9 chiffres et commencer par 3 (ex. 034 12 345 67).';
  }
  if (len < min || len > max) {
    return min === max
      ? `Numéro invalide pour ${country.name} : ${min} chiffres attendus.`
      : `Numéro invalide pour ${country.name} : entre ${min} et ${max} chiffres attendus.`;
  }
  return '';
};

/** Format lisible : « +261 34 12 345 67 ». */
export const formatE164ForDisplay = (value) => {
  const parsed = parseStoredPhone(value);
  if (!parsed) return String(value || '');
  return `+${parsed.country.dial} ${formatNational(parsed.national, parsed.country)}`.trim();
};
