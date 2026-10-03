// src/utils/timeAgo.js
//
// Utilitaires de date partagés (notifications, etc.).
//
// Le backend (FastAPI + PostgreSQL) stocke des datetimes en UTC SANS
// fuseau : ils sont renvoyés sans "Z" (ex: "2026-09-30T11:30:00").
// new Date() les lirait comme heure LOCALE de l'appareil, ce qui
// décale tout de plusieurs heures. Ici on force l'UTC, puis on
// calcule la durée écoulée avec l'heure ACTUELLE réelle.
//
// Madagascar : Indian/Antananarivo = UTC+3, sans heure d'été.

import { useEffect, useState } from 'react';

const MADAGASCAR_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

const MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

const MONTHS_LONG = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const pad2 = (value) => String(value).padStart(2, '0');

/**
 * Convertit une valeur du backend en objet Date (instant UTC correct).
 * Accepte : string ISO (avec ou sans "Z"), Date, timestamp (s ou ms).
 */
export const parseServerDate = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value < 10000000000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();

  // "2026-09-30T11:30:00" / "2026-09-30 11:30:00.123" (sans Z ni offset)
  const isNaiveDateTime =
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text);

  const date = new Date(
    isNaiveDateTime ? `${text.replace(' ', 'T')}Z` : text,
  );

  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Retourne le timestamp (ms) d'une valeur backend, ou 0 si invalide.
 */
export const toTimestamp = (value) => {
  const date = parseServerDate(value);
  return date ? date.getTime() : 0;
};

/**
 * Date en heure de Madagascar (UTC+3), indépendamment du fuseau
 * de l'appareil. Ex: "30 sept. 2026" (l'année est omise si c'est
 * l'année en cours à Madagascar).
 */
export const formatMadagascarDate = (value) => {
  const timestamp = toTimestamp(value);

  if (!timestamp) {
    return '';
  }

  const local = new Date(timestamp + MADAGASCAR_UTC_OFFSET_MS);
  const currentYear = new Date(
    Date.now() + MADAGASCAR_UTC_OFFSET_MS,
  ).getUTCFullYear();

  const day = pad2(local.getUTCDate());
  const month = MONTHS_SHORT[local.getUTCMonth()];
  const year = local.getUTCFullYear();

  return year === currentYear
    ? `${day} ${month}`
    : `${day} ${month} ${year}`;
};

/**
 * Heure en heure de Madagascar. Ex: "14:30".
 */
export const formatMadagascarTime = (value) => {
  const timestamp = toTimestamp(value);

  if (!timestamp) {
    return '';
  }

  const local = new Date(timestamp + MADAGASCAR_UTC_OFFSET_MS);

  return `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}`;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Clé de jour "YYYY-MM-DD" selon l'heure de Madagascar.
 * Une date seule ("2026-09-30") est renvoyée telle quelle.
 */
export const getMadagascarDateKey = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim())) {
    return value.trim();
  }

  const timestamp = toTimestamp(value);

  if (!timestamp) {
    return null;
  }

  const local = new Date(timestamp + MADAGASCAR_UTC_OFFSET_MS);

  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(
    local.getUTCDate(),
  )}`;
};

/**
 * Date complète (avec l'année) en heure de Madagascar.
 * Ex: "30 sept. 2026". Une date seule n'est pas décalée.
 */
export const formatMadagascarDateFull = (value) => {
  const key = getMadagascarDateKey(value);

  if (!key) {
    return '';
  }

  const [year, month, day] = key.split('-');

  return `${day} ${MONTHS_SHORT[Number(month) - 1]} ${year}`;
};

/**
 * Date complète avec le mois en toutes lettres, en heure de Madagascar.
 * Ex: "30 septembre 2026". Une date seule n'est pas décalée.
 */
export const formatMadagascarDateLong = (value, padDay = true) => {
  const key = getMadagascarDateKey(value);

  if (!key) {
    return '';
  }

  const [year, month, day] = key.split('-');
  const dayLabel = padDay ? day : String(Number(day));

  return `${dayLabel} ${MONTHS_LONG[Number(month) - 1]} ${year}`;
};

/**
 * Date longue + heure en heure de Madagascar.
 * Ex: "30 septembre 2026 à 14:30".
 */
export const formatMadagascarDateTimeLong = (value) => {
  const date = formatMadagascarDateLong(value);

  if (!date) {
    return '';
  }

  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim())) {
    return date;
  }

  return `${date} à ${formatMadagascarTime(value)}`;
};

/**
 * Date + heure en heure de Madagascar.
 * Ex: "30 sept. 2026 à 14:30".
 */
export const formatMadagascarDateTime = (value) => {
  const date = formatMadagascarDateFull(value);

  if (!date) {
    return '';
  }

  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim())) {
    return date;
  }

  return `${date} à ${formatMadagascarTime(value)}`;
};

/**
 * Durée écoulée RÉELLE depuis `value` jusqu'à `now`, calculée à partir
 * de l'heure actuelle (Madagascar = UTC+3, déjà géré par parseServerDate) :
 *
 *   À l'instant      (moins de 10 s)
 *   12 sec
 *   2 min
 *   1 h
 *   1 h 25
 *   3 j
 *   2 sem
 *   2 mois
 *   1 an / 2 ans
 */
export const formatTimeAgo = (value, now = Date.now()) => {
  const timestamp = toTimestamp(value);

  if (!timestamp) {
    return '';
  }

  // max(0, …) : évite un libellé négatif si l'horloge du serveur
  // avance de quelques secondes sur celle du téléphone.
  const diffMs = Math.max(0, now - timestamp);
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 10) {
    return "À l'instant";
  }

  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return remainingMinutes > 0
      ? `${hours} h ${pad2(remainingMinutes)}`
      : `${hours} h`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} j`;
  }

  const weeks = Math.floor(days / 7);

  if (weeks < 5) {
    return `${weeks} sem`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${Math.max(1, months)} mois`;
  }

  const years = Math.floor(days / 365);

  return `${years} an${years > 1 ? 's' : ''}`;
};

/**
 * Hook : renvoie l'heure actuelle (ms) et la rafraîchit toutes les
 * `intervalMs`, pour que les durées (12 sec, 2 min…) avancent en direct.
 */
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());

    const timer = setInterval(() => setNow(Date.now()), intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
};

// ============================================================
// AJOUTS : formats numériques, "aujourd'hui" et conversion
// Madagascar -> UTC (tous indépendants du fuseau de l'appareil)
// ============================================================

/**
 * Jour + mois court en heure de Madagascar. Ex: "30 sept."
 */
export const formatMadagascarDayMonth = (value) => {
  const key = getMadagascarDateKey(value);

  if (!key) {
    return '';
  }

  const [, month, day] = key.split('-');

  return `${day} ${MONTHS_SHORT[Number(month) - 1]}`;
};

/**
 * Date numérique en heure de Madagascar. Ex: "30/09/2026".
 */
export const formatMadagascarDateNumeric = (value) => {
  const key = getMadagascarDateKey(value);

  if (!key) {
    return '';
  }

  const [year, month, day] = key.split('-');

  return `${day}/${month}/${year}`;
};

/**
 * Date + heure numériques en heure de Madagascar.
 * Ex: "30/09/2026 14:30".
 */
export const formatMadagascarDateTimeNumeric = (value) => {
  const date = formatMadagascarDateNumeric(value);

  if (!date) {
    return '';
  }

  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim())) {
    return date;
  }

  return `${date} ${formatMadagascarTime(value)}`;
};

/**
 * Clé "YYYY-MM-DD" du jour ACTUEL à Madagascar.
 */
export const getMadagascarTodayKey = () => getMadagascarDateKey(Date.now());

/**
 * "Aujourd'hui" à Madagascar sous forme de Date locale à minuit
 * (jour/mois/année = ceux de Madagascar). Pour les calendriers.
 */
export const getMadagascarTodayDate = () => {
  const [year, month, day] = getMadagascarTodayKey().split('-').map(Number);

  return new Date(year, month - 1, day);
};

/**
 * Convertit une date/heure saisie en heure de Madagascar
 * ("2026-10-05", "14:30") en ISO UTC avec "Z" à envoyer au backend.
 * Ex: ("2026-10-05", "14:30") -> "2026-10-05T11:30:00.000Z"
 */
export const madagascarLocalToUtcIso = (dateKey, time = '00:00') => {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
  const h = /^(\d{1,2}):(\d{2})/.exec(String(time || '').trim());

  if (!d || !h) {
    return null;
  }

  const utcMs =
    Date.UTC(
      Number(d[1]),
      Number(d[2]) - 1,
      Number(d[3]),
      Number(h[1]),
      Number(h[2]),
    ) - MADAGASCAR_UTC_OFFSET_MS;

  return new Date(utcMs).toISOString();
};