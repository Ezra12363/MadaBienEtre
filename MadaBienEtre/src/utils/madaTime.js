// src/utils/madaTime.js
//
// Dates/heures « argent » : TOUJOURS à l'heure de Madagascar (UTC+3, sans heure d'été),
// quel que soit le fuseau du téléphone / navigateur.
//
// Le backend renvoie des dates UTC (« 2026-10-20T21:55:00Z »). Une chaîne SANS fuseau
// est considérée comme UTC (ancien format) : on ajoute « Z » avant de l'analyser.
// Aucun Intl / toLocale* : calcul manuel, identique sur Web, Android (Hermes) et iOS.
const OFFSET_MS = 3 * 60 * 60 * 1000;
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const pad = (n) => String(n).padStart(2, '0');

export const parseApiDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    s = `${s.replace(' ', 'T')}Z`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Parties de la date à Madagascar. */
export const madaParts = (value) => {
  const d = parseApiDate(value);
  if (!d) return null;
  const m = new Date(d.getTime() + OFFSET_MS); // on lit ensuite en getUTC*
  return { y: m.getUTCFullYear(), mo: m.getUTCMonth(), d: m.getUTCDate(), h: m.getUTCHours(), mi: m.getUTCMinutes(), s: m.getUTCSeconds() };
};

export const madaNowParts = () => madaParts(new Date());

/** 21 octobre 2026 à 03:55 */
export const formatMadaLong = (value) => {
  const p = madaParts(value);
  return p ? `${pad(p.d)} ${MONTHS_LONG[p.mo]} ${p.y} à ${pad(p.h)}:${pad(p.mi)}` : '—';
};

/** 21 oct., 03:55  (+ année si ce n'est pas l'année en cours) */
export const formatMadaShort = (value) => {
  const p = madaParts(value);
  if (!p) return '';
  const cur = madaNowParts();
  const year = cur && cur.y !== p.y ? ` ${p.y}` : '';
  return `${pad(p.d)} ${MONTHS_SHORT[p.mo]}${year}, ${pad(p.h)}:${pad(p.mi)}`;
};

/** Clé de jour à Madagascar : 2026-10-21 (pour filtrer par période). */
export const madaDayKey = (value) => {
  const p = madaParts(value);
  return p ? `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}` : '';
};

/** Début (ms UTC) de « aujourd'hui », « il y a n jours » à Madagascar. */
export const madaStartOfDayMs = (daysAgo = 0) => {
  const p = madaNowParts();
  return Date.UTC(p.y, p.mo, p.d - daysAgo) - OFFSET_MS;
};

/** value est-il dans la période ? range : all | today | 7d | 30d | month */
export const inRange = (value, range) => {
  if (!range || range === 'all') return true;
  const d = parseApiDate(value);
  if (!d) return false;
  const t = d.getTime();
  if (range === 'today') return t >= madaStartOfDayMs(0);
  if (range === '7d') return t >= madaStartOfDayMs(6);
  if (range === '30d') return t >= madaStartOfDayMs(29);
  if (range === 'month') {
    const p = madaNowParts();
    return t >= Date.UTC(p.y, p.mo, 1) - OFFSET_MS;
  }
  return true;
};
