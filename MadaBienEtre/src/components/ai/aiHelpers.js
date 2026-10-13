// src/components/ai/aiHelpers.js
// Petits utilitaires partagés par tous les composants IA.

import { colors } from '../../theme';

export const AI_GREEN = colors.primary; // #2E7D32
export const AI_GREEN_DARK = colors.primaryDark; // #1B5E20
export const AI_GREEN_LIGHT = colors.primaryLight; // #4CAF50
export const AI_GRADIENT = [colors.primaryDark, colors.primary, colors.primaryLight];

export const formatAr = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('fr-FR')} Ar`;
};

export const formatPercent = (value) => {
  let n = Number(value);
  if (!Number.isFinite(n)) return '—';
  // Le backend peut renvoyer 0..1 ou 0..100.
  if (n <= 1) n *= 100;
  return `${Math.round(n)} %`;
};

/** Normalise une probabilité en 0..100. */
export const toPercentNumber = (value) => {
  let n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 1) n *= 100;
  return Math.max(0, Math.min(100, n));
};

/** Lit le premier champ numérique disponible parmi `keys`. */
export const pickNumber = (obj, keys) => {
  if (!obj) return null;
  for (const key of keys) {
    const n = Number(obj[key]);
    if (obj[key] !== null && obj[key] !== undefined && Number.isFinite(n)) {
      return n;
    }
  }
  return null;
};

export const DEMAND_LEVELS = [
  { id: 'low', label: 'Faible' },
  { id: 'medium', label: 'Normale' },
  { id: 'high', label: 'Élevée' },
];

export const PERIODS = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
];

/** Chaîne -> entier positif ou null. */
export const toPositiveInt = (text) => {
  const n = parseInt(String(text ?? '').replace(/\s/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Chaîne -> nombre >= 0 ou null (accepte la virgule). */
export const toNonNegative = (text) => {
  const n = parseFloat(String(text ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
