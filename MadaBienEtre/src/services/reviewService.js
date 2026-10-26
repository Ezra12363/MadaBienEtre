// src/services/reviewService.js
// Service unique pour « Avis et évaluations » (client / thérapeute / admin).
import api from './api';

const errMsg = (error, fallback) =>
  error?.response?.data?.detail && typeof error.response.data.detail === 'string'
    ? error.response.data.detail
    : fallback;

const wrap = async (fn, fallback) => {
  try {
    const res = await fn();
    return res.data;
  } catch (error) {
    const e = new Error(errMsg(error, fallback));
    e.status = error?.response?.status;
    throw e;
  }
};

const reviewService = {
  // ---- Client ----
  create: (payload) => wrap(() => api.post('/reviews', payload), "Impossible d'envoyer votre avis."),
  update: (id, payload) => wrap(() => api.put(`/reviews/${id}`, payload), 'Impossible de modifier votre avis.'),
  remove: (id, reason) =>
    wrap(
      () => api.delete(`/reviews/${id}`, { params: reason ? { reason } : undefined }),
      "Impossible de supprimer l'avis."
    ),
  mine: () => wrap(() => api.get('/reviews/mine'), 'Impossible de charger vos avis.'),
  pending: () => wrap(() => api.get('/reviews/pending'), 'Impossible de charger les séances à évaluer.'),
  forBooking: (bookingId) =>
    wrap(() => api.get(`/reviews/booking/${bookingId}`), "Impossible de charger l'avis."),

  // ---- Public / thérapeute ----
  list: (params = {}) => wrap(() => api.get('/reviews', { params }), 'Impossible de charger les avis.'),
  received: (params = {}) =>
    wrap(() => api.get('/reviews/received', { params }), 'Impossible de charger vos avis.'),
  therapistStats: (therapistId) =>
    wrap(() => api.get(`/reviews/therapist/${therapistId}/stats`), 'Impossible de charger la note.'),
  respond: (id, response) =>
    wrap(() => api.put(`/reviews/${id}/respond`, { response }), "Impossible d'envoyer la réponse."),
  deleteResponse: (id) =>
    wrap(() => api.delete(`/reviews/${id}/respond`), 'Impossible de supprimer la réponse.'),
  report: (id, reason, description) =>
    wrap(
      () => api.post(`/reviews/${id}/report`, { reason, description: description || undefined }),
      'Impossible de signaler cet avis.'
    ),

  // ---- Admin ----
  adminSummary: (params = {}) =>
    wrap(() => api.get('/reviews/admin/summary', { params }), 'Impossible de charger le suivi.'),
  adminReports: (status = 'pending') =>
    wrap(() => api.get('/reviews/admin/reports', { params: { status } }), 'Impossible de charger les signalements.'),
  adminResolveReport: (reportId, action, admin_notes) =>
    wrap(
      () => api.put(`/reviews/admin/reports/${reportId}`, { action, admin_notes }),
      'Impossible de traiter le signalement.'
    ),
  moderate: (id, action, reason) =>
    wrap(() => api.put(`/reviews/${id}/moderate`, { action, reason }), 'Modération impossible.'),
};

export const REPORT_REASONS = [
  { key: 'inappropriate', label: 'Contenu inapproprié' },
  { key: 'fake', label: 'Faux avis / mensonger' },
  { key: 'offensive', label: 'Propos offensants' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Autre motif' },
];

export default reviewService;
