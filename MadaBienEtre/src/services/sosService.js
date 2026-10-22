// src/services/sosService.js
//
// Service SOS : alertes, position GPS + adresse, contacts d'urgence,
// safety checks et suivi admin. Toutes les méthodes renvoient
// { success, data } ou { success: false, error } et ne lèvent jamais.
import * as Location from 'expo-location';
import { get, post, put, del } from './api';
import { reverseGeocode } from './geocoding';

// Numéros d'urgence locaux (appel direct depuis le téléphone ; l'app ne
// prévient PAS les secours toute seule).
export const EMERGENCY_NUMBERS = [
  { name: 'Police', number: '117', icon: 'shield' },
  { name: 'Pompiers', number: '118', icon: 'flame' },
  { name: 'SAMU', number: '119', icon: 'medical' },
];

// Raisons proposées avant l'envoi : elles fixent le type + la gravité.
export const SOS_REASONS = [
  { key: 'danger', label: 'Danger immédiat', icon: 'flash', alert_type: 'emergency', severity: 'critical' },
  { key: 'threat', label: 'Menace / agression', icon: 'warning', alert_type: null, severity: 'high' },
  { key: 'other', label: 'Autre problème', icon: 'help-circle', alert_type: 'other', severity: 'medium' },
];

const fail = (response, fallback) => ({
  success: false,
  error: response?.error?.message || fallback,
});

// Appelle l'API et normalise la réponse.
const call = async (fn, fallback) => {
  try {
    const response = await fn();
    if (response?.error) return fail(response, fallback);
    return { success: true, data: response?.data };
  } catch (error) {
    return { success: false, error: error?.message || fallback };
  }
};

class SOSService {
  // ------------------------------------------------------------
  // Alertes
  // ------------------------------------------------------------
  /**
   * Créer une alerte SOS. Ajoute la position GPS (si autorisée) et l'adresse
   * lisible ; l'alerte part QUAND MÊME sans position (mieux vaut une alerte
   * sans GPS qu'aucune alerte).
   */
  async createSOSAlert(sosData = {}) {
    const payload = { ...sosData };
    if (payload.latitude == null || payload.longitude == null) {
      const loc = await this.getCurrentLocation();
      if (loc.success) {
        payload.latitude = loc.data.latitude;
        payload.longitude = loc.data.longitude;
      }
    }
    if (!payload.address && payload.latitude != null) {
      payload.address = await this.getAddress(payload.latitude, payload.longitude);
    }
    return call(() => post('/sos/create', payload), "Erreur lors de la création de l'alerte");
  }

  /** Anti-fausse alerte : annuler une alerte encore active. */
  cancelSOSAlert(sosId, reason = '') {
    return call(() => put(`/sos/${sosId}/cancel`, { reason: reason || null }), "Impossible d'annuler l'alerte");
  }

  /** Partage de position : envoie la dernière position pendant l'alerte. */
  async shareLocation(sosId) {
    const loc = await this.getCurrentLocation();
    if (!loc.success) return loc;
    const address = await this.getAddress(loc.data.latitude, loc.data.longitude);
    return call(() => put(`/sos/${sosId}/location`, { ...loc.data, address }), 'Erreur lors du partage de position');
  }

  getSOSAlerts(status = null) {
    return call(() => get('/sos/', status ? { status } : {}), 'Erreur lors du chargement');
  }

  getMyAlerts(limit = 20) {
    return call(() => get('/sos/mine', { limit }), 'Erreur lors du chargement');
  }

  getSOSAlert(sosId) {
    return call(() => get(`/sos/${sosId}`), 'Erreur lors du chargement');
  }

  // ------------------------------------------------------------
  // Admin
  // ------------------------------------------------------------
  getActiveSOSAlerts() {
    return call(() => get('/sos/admin/active'), 'Erreur lors du chargement');
  }

  getSOSHistory(params = {}) {
    return call(() => get('/sos/admin/history', params), "Erreur lors du chargement de l'historique");
  }

  getSOSAdminDetail(sosId) {
    return call(() => get(`/sos/admin/${sosId}`), 'Erreur lors du chargement');
  }

  addSOSNote(sosId, note) {
    return call(() => put(`/sos/${sosId}/notes`, { note }), "Impossible d'enregistrer la note");
  }

  /** Résoudre : `notes` = note interne, `message` = message envoyé à la personne (notification). */
  closeSOSAlert(sosId, notes = '', message = '') {
    return call(
      () => put(`/sos/close/${sosId}`, { response_notes: notes || null, message_to_user: message || null }),
      'Erreur lors de la fermeture'
    );
  }

  /** Admin : écrire à la personne (elle reçoit une notification). */
  sendSOSMessage(sosId, message) {
    return call(() => post(`/sos/${sosId}/message`, { message }), "Impossible d'envoyer le message");
  }

  /** Lien Google Maps en vue SATELLITE centrée sur la position. */
  getSatelliteLink(latitude, longitude, zoom = 19) {
    if (latitude == null || longitude == null) return null;
    return `https://www.google.com/maps/@?api=1&map_action=map&center=${latitude},${longitude}&zoom=${zoom}&basemap=satellite`;
  }

  getSOSStats() {
    return call(() => get('/sos/stats'), 'Erreur lors du chargement');
  }

  // ------------------------------------------------------------
  // Contacts d'urgence
  // ------------------------------------------------------------
  getContacts() {
    return call(() => get('/sos/contacts'), 'Erreur lors du chargement des contacts');
  }

  addContact(contact) {
    return call(() => post('/sos/contacts', contact), "Impossible d'ajouter le contact");
  }

  updateContact(id, contact) {
    return call(() => put(`/sos/contacts/${id}`, contact), 'Impossible de modifier le contact');
  }

  deleteContact(id) {
    return call(() => del(`/sos/contacts/${id}`), 'Impossible de supprimer le contact');
  }

  // ------------------------------------------------------------
  // Safety checks (avant / pendant / après la séance)
  // ------------------------------------------------------------
  /** status: 'ok' | 'warning' | 'emergency' (réponse immédiate) ou omis (pending). */
  async createSafetyCheck({ bookingId, checkType, status, notes }) {
    const payload = { booking_id: bookingId, check_type: checkType, status: status || null, notes: notes || null };
    const loc = await this.getCurrentLocation();
    if (loc.success) Object.assign(payload, loc.data);
    return call(() => post('/sos/safety-checks', payload), 'Erreur lors du safety check');
  }

  respondSafetyCheck(checkId, status, notes = '') {
    return call(() => put(`/sos/safety-checks/${checkId}/respond`, { status, notes: notes || null }),
      'Erreur lors de la réponse');
  }

  getSafetyChecks(bookingId) {
    return call(() => get('/sos/safety-checks', { booking_id: bookingId }), 'Erreur lors du chargement');
  }

  // ------------------------------------------------------------
  // Position
  // ------------------------------------------------------------
  async getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, error: 'Permission de localisation refusée' };
      }
      // Position récente d'abord (instantané), sinon une vraie mesure avec timeout.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60000 }).catch(() => null);
      const location =
        last ||
        (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Délai GPS dépassé')), 8000)),
        ]));
      return {
        success: true,
        data: { latitude: location.coords.latitude, longitude: location.coords.longitude },
      };
    } catch (error) {
      return { success: false, error: error?.message || 'Erreur lors de la localisation' };
    }
  }

  /** Adresse lisible (null si indisponible — ne bloque jamais l'alerte). */
  async getAddress(latitude, longitude) {
    try {
      const r = await Promise.race([
        reverseGeocode(latitude, longitude),
        new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      return r?.display_name || null;
    } catch (_e) {
      return null;
    }
  }

  // ------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------
  isCritical(alert) {
    return alert?.severity === 'critical' || alert?.severity === 'high';
  }

  formatCoordinates(latitude, longitude) {
    if (latitude == null || longitude == null) return 'Position inconnue';
    return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
  }

  getGoogleMapsLink(latitude, longitude) {
    if (latitude == null || longitude == null) return null;
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  /** Type d'alerte à envoyer selon le rôle de l'utilisateur. */
  alertTypeForRole(role) {
    const r = String(role || '').toUpperCase();
    if (r === 'THERAPIST') return 'therapist';
    if (r === 'CLIENT') return 'client';
    return 'other';
  }
}

export default new SOSService();
