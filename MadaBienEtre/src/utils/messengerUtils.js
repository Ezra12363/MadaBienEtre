// src/utils/messengerUtils.js
import { parseServerDate } from './wsUrl';

const dayKey = (value) => {
  const d = parseServerDate(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Liste ASC de messages -> lignes DESC (pour FlatList inversée) avec séparateurs de jour. */
export const buildRows = (messagesAsc) => {
  const rows = [];
  let prev = null;
  messagesAsc.forEach((m) => {
    const k = dayKey(m.created_at);
    if (k !== prev) rows.push({ rowType: 'day', key: `day-${k}`, date: m.created_at });
    rows.push({ rowType: 'msg', key: `m-${m.id || m.client_id}`, message: m });
    prev = k;
  });
  return rows.reverse();
};

/** envoyé ✓ / reçu ✓✓ / vu — calculé depuis les accusés des autres membres. */
export const computeStatus = (msg, detail, myId) => {
  if (msg.local_status === 'sending') return { status: 'sending' };
  if (msg.local_status === 'failed') return { status: 'failed' };
  const others = (detail?.members || []).filter((m) => m.id !== myId);
  if (!others.length || !msg.id) return { status: 'sent' };
  const readBy = others.filter((m) => (m.last_read_message_id || 0) >= msg.id).length;
  const deliveredBy = others.filter((m) => (m.last_delivered_message_id || 0) >= msg.id).length;
  if (readBy === others.length) return { status: 'read', readBy };
  if (!['direct', 'booking'].includes(detail.type) && readBy > 0) return { status: 'delivered', readBy };
  if (deliveredBy === others.length) return { status: 'delivered', readBy };
  return { status: 'sent', readBy };
};

export const formatDuration = (s = 0) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

export const newClientId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** « en ligne » / « Actif il y a 5 min » / « Vu hier » */
export const presenceLabel = (p) => {
  if (!p) return '';
  if (p.is_online) return 'En ligne';
  if (!p.last_seen_at) return 'Hors ligne';
  const diff = Math.max(0, Date.now() - parseServerDate(p.last_seen_at).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Vu à l\'instant';
  if (min < 60) return `Vu il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Vu il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Vu hier' : `Vu il y a ${d} j`;
};

export const roleLabel = (role) => ({ CLIENT: 'Client', THERAPIST: 'Thérapeute', ADMIN: 'Administrateur' }[role] || '');

export const isAdminUser = (user) => String(user?.role || '').toUpperCase() === 'ADMIN';

/** Droits d'interface (indicatif : le serveur revérifie TOUT). */
export const canReplyTo = (msg, detail, user) => {
  if (!detail?.can_post || msg.deleted || msg.message_type === 'system' || msg.message_type === 'call') return false;
  return msg.allow_reply || isAdminUser(user);
};

export const canEditMsg = (msg, user) =>
  msg.sender?.id === user?.id && msg.message_type === 'text' && !msg.deleted &&
  Date.now() - parseServerDate(msg.created_at).getTime() <= 30 * 60 * 1000;
