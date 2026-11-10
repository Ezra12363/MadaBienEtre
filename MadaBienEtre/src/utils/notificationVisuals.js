// src/utils/notificationVisuals.js
// ============================================================
// Icône / couleur / libellé d'une notification selon le STATUT de la
// réservation qu'elle annonce (même palette que les filtres de statut :
// En attente, Négociation, Confirmées, En cours, Terminées, Annulées,
// Expirées…).
//
// Utilisé par les écrans de notifications CLIENT et THÉRAPEUTE
// ainsi que par NotificationItem.
// ============================================================

const VISUALS = {
  // En attente
  new_booking: { icon: 'calendar-outline', color: '#2196F3', label: 'En attente' },
  booking_created: { icon: 'paper-plane-outline', color: '#2196F3', label: 'En attente' },
  // Négociation
  new_offer: { icon: 'pricetag-outline', color: '#FF9800', label: 'Négociation' },
  counter_offer: { icon: 'swap-horizontal-outline', color: '#FF9800', label: 'Négociation' },
  // Confirmée
  offer_accepted: { icon: 'checkmark-circle-outline', color: '#4CAF50', label: 'Confirmée' },
  booking_confirmed: { icon: 'checkmark-circle-outline', color: '#4CAF50', label: 'Confirmée' },
  // Refus
  offer_rejected: { icon: 'close-circle-outline', color: '#E53935', label: 'Refusée' },
  // En route / En cours
  booking_en_route: { icon: 'car-outline', color: '#00897B', label: 'En route' },
  booking_started: { icon: 'play-circle-outline', color: '#3F51B5', label: 'En cours' },
  // Terminée
  booking_completed: { icon: 'checkmark-done-circle-outline', color: '#2E7D32', label: 'Terminée' },
  // Annulée / Expirée
  booking_cancelled: { icon: 'close-circle-outline', color: '#D32F2F', label: 'Annulée' },
  booking_expired: { icon: 'hourglass-outline', color: '#757575', label: 'Expirée' },
  // Rappel calendrier
  booking_reminder: { icon: 'alarm-outline', color: '#FF6F00', label: 'Rappel' },
};

const normalize = (type) =>
  String(type || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

/** { icon, color, label } pour un type précis, sinon null (→ visuel par catégorie). */
export const getStatusVisual = (type) => VISUALS[normalize(type)] || null;

/** Types qui ouvrent directement le DÉTAIL de la réservation (pas l'écran d'offre). */
const BOOKING_DETAIL_TYPES = new Set([
  'offer_accepted',
  'booking_confirmed',
  'booking_cancelled',
  'booking_started',
  'booking_completed',
  'booking_expired',
  'booking_reminder',
  'booking_created',
]);

export const opensBookingDetail = (type) => BOOKING_DETAIL_TYPES.has(normalize(type));

export default getStatusVisual;
