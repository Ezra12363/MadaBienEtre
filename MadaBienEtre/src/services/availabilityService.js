// src/services/availabilityService.js
import { get, put, post, del } from './api';

class AvailabilityService {

  // Lire les disponibilités complètes
  async getMyAvailability() {
    try {
      const response = await get('/therapists/availability');
      if (response.error) {
        return { success: false, error: response.error.message, data: null };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Erreur lors du chargement des disponibilités',
        data: null,
      };
    }
  }

  // Mettre à jour le planning hebdomadaire
  async updateWeeklySchedule(weekly) {
    try {
      const response = await put('/therapists/availability', { weekly });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Erreur lors de la mise à jour du planning',
      };
    }
  }

  // Mettre à jour un seul jour (helper)
  async updateSingleDay(dayIndex, changes, currentWeekly) {
    const updated = currentWeekly.map((day) => {
      if (day.day === dayIndex) {
        return { ...day, ...changes };
      }
      return day;
    });
    return this.updateWeeklySchedule(updated);
  }

  // Basculer en ligne / hors ligne
  async toggleOnline() {
    try {
      const response = await put('/therapists/toggle-online');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Erreur lors du changement de statut en ligne',
      };
    }
  }

  // Basculer disponible / indisponible
  async toggleAvailable() {
    try {
      const response = await put('/therapists/toggle-available');
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Erreur lors du changement de disponibilité',
      };
    }
  }

  // Ajouter une date bloquée
  async addBlockedDate(payload) {
    try {
      const response = await post('/therapists/availability/blocked', payload);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Erreur lors de l'ajout de la date bloquée",
      };
    }
  }

  // Supprimer une date bloquée
  async deleteBlockedDate(blockedId) {
    try {
      const response = await del(`/therapists/availability/blocked/${blockedId}`);
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Erreur lors de la suppression de la date bloquée',
      };
    }
  }

  // Créneaux disponibles d'un thérapeute (vue client)
  async getTherapistSlots(therapistId, fromDate = null, toDate = null) {
    try {
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const response = await get(`/therapists/${therapistId}/slots`, params);
      if (response.error) {
        return { success: false, error: response.error.message, data: [] };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Erreur lors du chargement des créneaux',
        data: [],
      };
    }
  }

  // Planning par défaut
  getDefaultWeeklySchedule() {
    return [
      { day: 0, start: '09:00', end: '18:00', is_available: false, notes: '' }, // Dimanche
      { day: 1, start: '09:00', end: '18:00', is_available: true,  notes: '' }, // Lundi
      { day: 2, start: '09:00', end: '18:00', is_available: true,  notes: '' }, // Mardi
      { day: 3, start: '09:00', end: '18:00', is_available: true,  notes: '' }, // Mercredi
      { day: 4, start: '09:00', end: '18:00', is_available: true,  notes: '' }, // Jeudi
      { day: 5, start: '09:00', end: '17:00', is_available: true,  notes: '' }, // Vendredi
      { day: 6, start: '10:00', end: '14:00', is_available: false, notes: '' }, // Samedi
    ];
  }

  getDayName(dayIndex) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayIndex] ?? `Jour ${dayIndex}`;
  }
}

export default new AvailabilityService();