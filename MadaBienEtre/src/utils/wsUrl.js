
// src/utils/wsUrl.js
// Construction centralisée des URLs WebSocket.
// Exemples :
// http://10.174.179.30:8000 + /notifications
//   => ws://10.174.179.30:8000/ws/notifications
//
// https://api.example.com + /chat/12
//   => wss://api.example.com/ws/chat/12

import { API_URL } from '../config/env';

// Nettoie le token reçu du backend ou du stockage local.
export const cleanToken = (token) => {
  if (!token) return '';

  const value =
    typeof token === 'object'
      ? token.access_token || token.token || ''
      : token;

  return String(value)
    .replace(/^Bearer\s+/i, '')
    .replace(/^"|"$/g, '')
    .trim();
};

// Retourne la base WebSocket : ws://host/ws ou wss://host/ws.
export const getWsBase = () => {
  const rawBase = String(API_URL || '').trim();

  if (!rawBase) {
    throw new Error(
      'API_URL est vide. Vérifiez src/config/env.js.'
    );
  }

  let base = rawBase.replace(/\/+$/, '');

  if (/^https:\/\//i.test(base)) {
    base = base.replace(/^https:\/\//i, 'wss://');
  } else if (/^http:\/\//i.test(base)) {
    base = base.replace(/^http:\/\//i, 'ws://');
  } else if (!/^wss?:\/\//i.test(base)) {
    throw new Error(
      `API_URL invalide : "${rawBase}". ` +
      'Utilisez http://, https://, ws:// ou wss://.'
    );
  }

  // Retire /ws final s'il existe déjà pour éviter /ws/ws.
  base = base.replace(/\/ws\/?$/i, '');

  return `${base}/ws`;
};

// Construit une URL WebSocket complète.
export const buildWsUrl = (path, token) => {
  if (path === undefined || path === null || !String(path).trim()) {
    throw new Error('Le chemin WebSocket est vide.');
  }

  let cleanPath = String(path).trim();

  // Accepte aussi un chemin fourni sous la forme /ws/chat/12.
  cleanPath = cleanPath.replace(/^\/+/, '');
  cleanPath = cleanPath.replace(/^ws\/+/i, '');

  const base = getWsBase();
  const clean = cleanToken(token);

  const separator = cleanPath.includes('?') ? '&' : '?';

  const url = `${base}/${cleanPath}`;

  return clean
    ? `${url}${separator}token=${encodeURIComponent(clean)}`
    : url;
};

// Convertit les dates du backend en dates JavaScript.
// Les dates sans fuseau sont considérées comme UTC.
export const parseServerDate = (value) => {
  if (!value) return new Date();

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  let dateString = String(value).trim();

  // Limite la précision des fractions de seconde à 3 chiffres.
  dateString = dateString.replace(
    /(\.\d{3})\d+/,
    '$1'
  );

  const hasTimezone =
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateString);

  const hasDateAndTime =
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(dateString);

  if (hasDateAndTime && !hasTimezone) {
    dateString = `${dateString.replace(' ', 'T')}Z`;
  }

  const parsed = new Date(dateString);

  return Number.isNaN(parsed.getTime())
    ? new Date()
    : parsed;
};
