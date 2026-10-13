// src/utils/chatUi.js
// Helpers d'affichage partagés par la liste des conversations et l'écran de
// discussion (client ET thérapeute) : photos, heures, dates, lignes de liste.
import { Alert, Platform } from 'react-native';

import { API_URL } from '../config/env';
import { parseServerDate } from './wsUrl';

/* ------------------------------ identité ------------------------------ */

export const getInitial = (name) => {
  const value = String(name || '').trim();
  return value ? value.charAt(0).toUpperCase() : '?';
};

export const getFirstName = (name) => {
  const value = String(name || '').trim();
  return value ? value.split(/\s+/)[0] : '';
};

/** URL absolue d'une photo de profil (le backend peut renvoyer un chemin relatif). */
export const resolvePhotoUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (/^(https?:|data:|blob:|file:)/i.test(value)) return value;
  const base = String(API_URL || '').replace(/\/+$/, '');
  return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
};

/* -------------------------------- dates -------------------------------- */

const safeDate = (value) => {
  try {
    const d = parseServerDate(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  } catch (_e) {
    return new Date();
  }
};

export const formatClock = (value) =>
  safeDate(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const longDate = (d) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** « Aujourd'hui, 10 mars 2022 » / « Hier, 9 mars 2022 » / « mercredi 2 mars 2022 » */
export const formatDayLabel = (value) => {
  const d = safeDate(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return `Aujourd'hui, ${longDate(d)}`;
  if (d.toDateString() === yesterday.toDateString()) return `Hier, ${longDate(d)}`;

  const label = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/** Heure affichée dans la liste : 12:15 aujourd'hui, « Hier », sinon 09/03. */
export const formatListTime = (value) => {
  if (!value) return '';
  const d = safeDate(value);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return formatClock(value);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';

  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

/* --------------------- lignes de la conversation ---------------------- */

/**
 * Transforme la liste de messages en lignes affichables :
 *   - séparateur de date quand le jour change ;
 *   - `showTime` : l'heure n'est affichée qu'une fois par série de messages
 *     du même expéditeur dans la même minute (comme sur la maquette).
 */
export const buildChatRows = (messages) => {
  const rows = [];

  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    const date = safeDate(message.createdAt);
    const dayKey = date.toDateString();
    const prevDate = previous ? safeDate(previous.createdAt) : null;
    const prevDayKey = prevDate ? prevDate.toDateString() : null;

    if (dayKey !== prevDayKey) {
      rows.push({
        rowType: 'date',
        id: `date-${dayKey}`,
        label: formatDayLabel(message.createdAt),
      });
    }

    const sameSender = previous && String(previous.senderId) === String(message.senderId);
    const sameMinute =
      prevDate &&
      dayKey === prevDayKey &&
      date.getHours() === prevDate.getHours() &&
      date.getMinutes() === prevDate.getMinutes();

    rows.push({
      rowType: 'message',
      id: `msg-${String(message.id ?? index)}`,
      message,
      showTime: !(sameSender && sameMinute),
      isGroupStart: !sameSender || dayKey !== prevDayKey,
    });
  });

  return rows;
};

/* ------------------------------ messages UI ------------------------------ */

/** Information compatible web + mobile (Alert.alert n'existe pas sur react-native-web). */
export const notifyInfo = (title, message) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
};
