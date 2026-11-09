// src/services/messengerService.js
// Client REST de la messagerie (/messenger/...). Le temps réel passe par
// MessengerContext (WebSocket /ws/messenger).
import { Platform } from 'react-native';

import { API_URL } from '../config/env';
import { cleanToken } from '../utils/wsUrl';
import { del, get, post, put } from './api';

const unwrap = async (promise, fallback) => {
  const res = await promise;
  if (res.error) {
    const detail = res.error?.data?.detail;
    return {
      success: false,
      status: res.error.status,
      error: (typeof detail === 'string' && detail) || res.error.message || fallback,
    };
  }
  return { success: true, data: res.data };
};

/** URL authentifiée d'un fichier (image, audio, document) : le token passe en query. */
export const buildFileUrl = (path, token, { download = false } = {}) => {
  if (!path) return null;
  if (/^(https?:|data:|blob:|file:)/i.test(path)) return path;
  const params = [];
  if (token) params.push(`token=${encodeURIComponent(cleanToken(token))}`);
  if (download) params.push('download=1');
  return `${API_URL}${path}${params.length ? `?${params.join('&')}` : ''}`;
};

// Fichier -> FormData (web : blob ; mobile : { uri, name, type })
const appendFile = async (form, field, file) => {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name || 'fichier');
  } else {
    form.append(field, { uri: file.uri, name: file.name || 'fichier', type: file.mimeType || 'application/octet-stream' });
  }
};

const messengerService = {
  conversations: (archived = false) => unwrap(get('/messenger/conversations', { archived }), 'Chargement impossible'),
  conversation: (id) => unwrap(get(`/messenger/conversations/${id}`), 'Conversation introuvable'),
  openBooking: (bookingId) => unwrap(post(`/messenger/conversations/booking/${bookingId}`), 'Conversation indisponible'),
  openDirect: (userId) => unwrap(post('/messenger/conversations/direct', { user_id: userId }), 'Conversation impossible'),
  messages: (id, { beforeId, afterId, limit = 40 } = {}) =>
    unwrap(get(`/messenger/conversations/${id}/messages`, { before_id: beforeId, after_id: afterId, limit }), 'Chargement impossible'),
  pinned: (id) => unwrap(get(`/messenger/conversations/${id}/pinned`), 'Chargement impossible'),
  unread: () => unwrap(get('/messenger/unread'), 'Chargement impossible'),

  sendText: (id, body) => unwrap(post(`/messenger/conversations/${id}/messages`, { type: 'text', ...body }), "Envoi impossible"),
  sendSticker: (id, body) => unwrap(post(`/messenger/conversations/${id}/messages`, { type: 'sticker', ...body }), "Envoi impossible"),
  sendLocation: (id, body) => unwrap(post(`/messenger/conversations/${id}/messages`, { type: 'location', ...body }), "Envoi impossible"),

  async sendAttachment(id, file, { kind, caption, clientId, replyToId, durationSeconds, allowReply } = {}) {
    const form = new FormData();
    await appendFile(form, 'file', file);
    if (kind) form.append('kind', kind);
    if (caption) form.append('caption', caption);
    if (clientId) form.append('client_id', clientId);
    if (replyToId) form.append('reply_to_id', String(replyToId));
    if (durationSeconds != null) form.append('duration_seconds', String(Math.round(durationSeconds)));
    if (allowReply != null) form.append('allow_reply', allowReply ? 'true' : 'false');
    return unwrap(
      post(`/messenger/conversations/${id}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }),
      "Envoi du fichier impossible"
    );
  },

  markRead: (id, upToId) => unwrap(post(`/messenger/conversations/${id}/read`, { up_to_id: upToId || null }), 'Erreur'),
  settings: (id, body) => unwrap(put(`/messenger/conversations/${id}/settings`, body), 'Erreur'),
  deleteConversation: (id) => unwrap(del(`/messenger/conversations/${id}`), 'Suppression impossible'),

  editMessage: (id, text) => unwrap(put(`/messenger/messages/${id}`, { text }), 'Modification impossible'),
  deleteMessage: (id, scope = 'all') => unwrap(del(`/messenger/messages/${id}?scope=${scope}`), 'Suppression impossible'),
  react: (id, emoji) => unwrap(post(`/messenger/messages/${id}/reactions`, { emoji }), 'Réaction impossible'),
  pin: (id, pinned) => unwrap(put(`/messenger/messages/${id}/pin`, { pinned }), 'Action impossible'),
  forward: (id, conversationIds) => unwrap(post(`/messenger/messages/${id}/forward`, { conversation_ids: conversationIds }), 'Transfert impossible'),
  report: (id, reason, details) => unwrap(post(`/messenger/messages/${id}/report`, { reason, details }), 'Signalement impossible'),

  contacts: (q) => unwrap(get('/messenger/contacts', q ? { q } : {}), 'Chargement impossible'),
  search: (q, conversationId) => unwrap(get('/messenger/search', { q, conversation_id: conversationId }), 'Recherche impossible'),
  stickers: () => unwrap(get('/messenger/stickers'), 'Chargement impossible'),
  favoriteSticker: (id, favorite) => unwrap(put(`/messenger/stickers/${id}/favorite`, { favorite }), 'Erreur'),

  blocks: () => unwrap(get('/messenger/blocks'), 'Chargement impossible'),
  block: (userId) => unwrap(post(`/messenger/blocks/${userId}`), 'Blocage impossible'),
  unblock: (userId) => unwrap(del(`/messenger/blocks/${userId}`), 'Action impossible'),

  createGroup: (body) => unwrap(post('/messenger/groups', body), 'Création impossible'),
  updateGroup: (id, body) => unwrap(put(`/messenger/groups/${id}`, body), 'Modification impossible'),
  async setGroupPhoto(id, file) {
    const form = new FormData();
    await appendFile(form, 'file', file);
    return unwrap(post(`/messenger/groups/${id}/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Photo impossible');
  },
  addMembers: (id, userIds, roles = []) => unwrap(post(`/messenger/groups/${id}/members`, { user_ids: userIds, roles }), 'Ajout impossible'),
  removeMember: (id, userId) => unwrap(del(`/messenger/groups/${id}/members/${userId}`), 'Retrait impossible'),
  leaveGroup: (id) => unwrap(post(`/messenger/groups/${id}/leave`), 'Action impossible'),
  deleteGroup: (id) => unwrap(del(`/messenger/groups/${id}`), 'Suppression impossible'),

  calls: () => unwrap(get('/messenger/calls'), 'Chargement impossible'),

  adminReports: (status = 'open') => unwrap(get('/messenger/admin/reports', { status }), 'Chargement impossible'),
  adminReviewReport: (id, status) => unwrap(put(`/messenger/admin/reports/${id}`, { status }), 'Action impossible'),
  adminGroups: (q) => unwrap(get('/messenger/admin/groups', q ? { q } : {}), 'Chargement impossible'),
  adminJoinGroup: (id) => unwrap(post(`/messenger/admin/groups/${id}/join`), 'Action impossible'),
};

export default messengerService;
