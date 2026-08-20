// src/services/adminService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// ============================================================
// SERVICE ADMIN COMPLET
// ============================================================

const adminService = {
  // ============================================================
  // 1. GESTION DES UTILISATEURS
  // ============================================================

  /**
   * Récupérer la liste des utilisateurs
   * @param {Object} params - Paramètres de filtrage
   * @param {number} params.skip - Nombre d'éléments à sauter
   * @param {number} params.limit - Nombre maximum de résultats
   * @param {string} params.role - Filtrer par rôle (CLIENT, THERAPIST, ADMIN)
   * @param {string} params.search - Recherche par nom, email ou téléphone
   * @param {boolean} params.isActive - Filtrer par statut actif
   * @param {boolean} params.showDeleted - Afficher les utilisateurs supprimés
   */
  async getUsers(params = {}) {
    try {
      const {
        skip = 0,
        limit = 100,
        role = '',
        search = '',
        isActive = '',
        showDeleted = false
      } = params;

      const queryParams = new URLSearchParams();

      if (skip) queryParams.append('skip', skip);
      if (limit) queryParams.append('limit', limit);
      if (role) queryParams.append('role', role);
      if (search) queryParams.append('search', search);
      if (isActive !== '') queryParams.append('is_active', isActive);
      if (showDeleted) queryParams.append('show_deleted', 'true');

      const response = await api.get(`/users?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getUsers:', error);
      throw error;
    }
  },

  /**
   * Récupérer les détails d'un utilisateur
   * @param {number} userId - ID de l'utilisateur
   */
  async getUserById(userId) {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getUserById:', error);
      throw error;
    }
  },

  /**
   * Créer un utilisateur (Admin uniquement)
   * @param {Object} userData - Données de l'utilisateur
   */
  async createUser(userData) {
    try {
      const response = await api.post('/users', userData);
      return response.data;
    } catch (error) {
      console.error('❌ Error createUser:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour un utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @param {Object} userData - Données à mettre à jour
   */
  async updateUser(userId, userData) {
    try {
      const response = await api.put(`/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      console.error('❌ Error updateUser:', error);
      throw error;
    }
  },

  /**
   * ✅ Activer ou désactiver un utilisateur (Toggle Status)
   * @param {number} userId - ID de l'utilisateur
   * @param {boolean} isActive - True pour activer, False pour désactiver
   * @param {string} reason - Raison de l'action (optionnel)
   */
  async toggleUserStatus(userId, isActive, reason = '') {
    try {
      const response = await api.put(`/users/${userId}/toggle-status`, {
        is_active: isActive,
        reason: reason
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error toggleUserStatus:', error);
      throw error;
    }
  },

  /**
   * Réactiver un utilisateur (seulement si soft delete)
   * @param {number} userId - ID de l'utilisateur
   */
  async reactivateUser(userId) {
    try {
      const response = await api.put(`/users/${userId}/reactivate`);
      return response.data;
    } catch (error) {
      console.error('❌ Error reactivateUser:', error);
      throw error;
    }
  },

  /**
   * Supprimer un utilisateur (soft delete ou permanent)
   * @param {number} userId - ID de l'utilisateur
   * @param {boolean} permanent - Suppression définitive
   */
  async deleteUser(userId, permanent = false) {
    try {
      const response = await api.delete(`/users/${userId}?permanent=${permanent}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error deleteUser:', error);
      throw error;
    }
  },

  /**
   * Réinitialiser le mot de passe d'un utilisateur (Admin)
   * @param {number} userId - ID de l'utilisateur
   * @param {boolean} sendEmail - Envoyer le nouveau mot de passe par email
   */
  async resetUserPassword(userId, sendEmail = true) {
    try {
      const response = await api.post(`/users/${userId}/reset-password`, {
        send_email: sendEmail
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error resetUserPassword:', error);
      throw error;
    }
  },

  /**
   * Actions en masse sur les utilisateurs (Admin)
   * @param {string} action - Action: activate, deactivate, delete
   * @param {number[]} userIds - Liste des IDs des utilisateurs
   * @param {string} reason - Raison de l'action (optionnel)
   */
  async bulkUserAction(action, userIds, reason = '') {
    try {
      const response = await api.post('/users/bulk-action', {
        action: action,
        user_ids: userIds,
        reason: reason
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error bulkUserAction:', error);
      throw error;
    }
  },

  /**
   * Récupérer les statistiques des utilisateurs
   */
  async getUserStats() {
    try {
      const response = await api.get('/users/stats/overview');
      return response.data;
    } catch (error) {
      console.error('❌ Error getUserStats:', error);
      return {
        total: 0,
        clients: 0,
        therapists: 0,
        admins: 0,
        active: 0,
        inactive: 0,
        new_users_last_week: 0,
        verified_therapists: 0,
        online_therapists: 0
      };
    }
  },

  /**
   * Mettre à jour le profil de l'utilisateur connecté
   * @param {Object} userData - Données à mettre à jour
   */
  async updateMyProfile(userData) {
    try {
      const response = await api.put('/users/profile/me', userData);
      return response.data;
    } catch (error) {
      console.error('❌ Error updateMyProfile:', error);
      throw error;
    }
  },

  /**
   * ✅ CORRIGÉ : Uploader une photo de profil
   *
   * 🐛 L'ancien code forçait manuellement
   * `headers: { 'Content-Type': 'multipart/form-data' }` SANS le
   * paramètre `boundary` (ex: `; boundary=----WebKitFormBoundary...`).
   * Ce boundary est OBLIGATOIRE pour que le serveur (python-multipart
   * côté FastAPI) sache où commencent/finissent les parties du
   * formulaire — sans lui, le parsing peut échouer silencieusement ou
   * produire un fichier tronqué/corrompu, même si la requête renvoie
   * 200. Axios (et le XHR/fetch sous-jacent de React Native) génèrent
   * ce boundary automatiquement quand on le LAISSE détecter le
   * FormData lui-même — il ne faut donc PAS fixer 'Content-Type' à la
   * main ici.
   *
   * @param {File|{uri,type,name}} file - Fichier image
   */
  async uploadProfilePhoto(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // ✅ CORRIGÉ (bug "Field required" / "body.file missing") :
      // l'instance axios `api` a un header par défaut
      // `Content-Type: application/json` (voir api.js). Sans
      // override explicite, CE défaut reste actif même pour une
      // requête FormData — le backend reçoit alors une requête
      // "application/json" sans aucune partie multipart, donc "file"
      // est totalement absent ("Field required").
      //
      // On efface ce header en le mettant à `undefined` : axios ne
      // l'envoie alors plus du tout, et c'est l'environnement lui-même
      // qui calcule le bon `multipart/form-data; boundary=...` —
      // le navigateur (Web) ou le pont réseau natif de React Native
      // (Android/iOS). C'est la seule approche qui fonctionne sur les
      // DEUX plateformes : fixer la chaîne à la main casse le Web
      // (pas de boundary ajouté par le navigateur), et l'omettre
      // complètement laisse 'application/json' hérité côté instance.
      const response = await api.post('/users/upload-profile-photo', formData, {
        headers: {
          'Content-Type': undefined,
        },
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error uploadProfilePhoto:', error);
      throw error;
    }
  },

  /**
   * Changer le mot de passe de l'utilisateur connecté
   * @param {Object} passwordData - { old_password, new_password }
   */
  async changePassword(passwordData) {
    try {
      const response = await api.post('/users/change-password', passwordData);
      return response.data;
    } catch (error) {
      console.error('❌ Error changePassword:', error);
      throw error;
    }
  },

  /**
   * Rechercher des utilisateurs
   * @param {string} query - Terme de recherche
   * @param {number} limit - Nombre maximum de résultats
   */
  async searchUsers(query, limit = 20) {
    try {
      const response = await api.get(`/users/search?query=${encodeURIComponent(query)}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error searchUsers:', error);
      throw error;
    }
  },

  // ============================================================
  // 2. ✅ GESTION DES THÉRAPEUTES - NOUVEAUX ENDPOINTS
  // ============================================================

  /**
   * ✅ Récupérer la liste des thérapeutes avec filtres (NOUVEAU)
   * @param {Object} filters - Filtres
   */
  async getTherapists(filters = {}) {
    try {
      const {
        onlineOnly = false,
        verifiedOnly = false,
        availableOnly = false,
        minRating = null,
        limit = 20,
        skip = 0,
        search = '',
        latitude = null,
        longitude = null,
        radius = 10
      } = filters;

      const queryParams = new URLSearchParams();
      if (onlineOnly) queryParams.append('online_only', 'true');
      if (verifiedOnly) queryParams.append('verified_only', 'true');
      if (availableOnly) queryParams.append('available_only', 'true');
      if (minRating) queryParams.append('min_rating', minRating);
      if (limit) queryParams.append('limit', limit);
      if (skip) queryParams.append('skip', skip);
      if (search) queryParams.append('search', search);
      if (latitude) queryParams.append('latitude', latitude);
      if (longitude) queryParams.append('longitude', longitude);
      if (radius) queryParams.append('radius_km', radius);

      const response = await api.get(`/therapists?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getTherapists:', error);
      throw error;
    }
  },

  /**
   * ✅ Obtenir le profil complet d'un thérapeute (NOUVEAU)
   * @param {number} therapistId - ID du thérapeute
   */
  async getTherapistProfile(therapistId) {
    try {
      const response = await api.get(`/therapists/${therapistId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getTherapistProfile:', error);
      throw error;
    }
  },

  /**
   * ✅ Changer le statut en ligne d'un thérapeute (NOUVEAU)
   * @param {number} therapistId - ID du thérapeute
   * @param {boolean} isOnline - Statut en ligne
   */
  async toggleTherapistStatus(therapistId, isOnline) {
    try {
      const response = await api.put(`/therapists/status?is_online=${isOnline}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error toggleTherapistStatus:', error);
      throw error;
    }
  },

  /**
   * ✅ Changer la disponibilité d'un thérapeute (NOUVEAU)
   * @param {boolean} isAvailable - Disponible ou non
   */
  async toggleTherapistAvailability(isAvailable) {
    try {
      const response = await api.put(`/therapists/availability?is_available=${isAvailable}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error toggleTherapistAvailability:', error);
      throw error;
    }
  },

  /**
   * ✅ Obtenir le statut de vérification du thérapeute (NOUVEAU)
   */
  async getTherapistVerificationStatus() {
    try {
      const response = await api.get('/therapists/status');
      return response.data;
    } catch (error) {
      console.error('❌ Error getTherapistVerificationStatus:', error);
      throw error;
    }
  },

  /**
   * ✅ Obtenir les gains du thérapeute (NOUVEAU)
   * @param {string} period - Période: day, week, month, year
   */
  async getTherapistEarnings(period = 'month') {
    try {
      const response = await api.get(`/therapists/earnings?period=${period}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getTherapistEarnings:', error);
      throw error;
    }
  },

  /**
   * ✅ CORRIGÉ (même bug de boundary) : Soumettre une candidature pour
   * devenir thérapeute (NOUVEAU)
   * @param {Object} data - Données de la candidature
   * @param {File} data.cin_file - Fichier CIN
   * @param {File} data.certificate_file - Fichier certificat
   */
  async applyAsTherapist(data) {
    try {
      const formData = new FormData();
      formData.append('bio', data.bio);
      formData.append('experience_years', data.experience_years);
      formData.append('base_price', data.base_price);
      formData.append('service_radius', data.service_radius || 10);
      formData.append('cin_file', data.cin_file);
      formData.append('certificate_file', data.certificate_file);

      // ✅ Même correctif que uploadProfilePhoto : on efface le header
      // 'Content-Type' hérité (application/json) pour laisser
      // l'environnement (navigateur ou pont React Native) calculer
      // lui-même le bon boundary multipart.
      const response = await api.post('/therapists/apply', formData, {
        headers: {
          'Content-Type': undefined,
        },
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error applyAsTherapist:', error);
      throw error;
    }
  },

  /**
   * ✅ Mettre à jour les informations d'un thérapeute (NOUVEAU)
   * @param {number} therapistId - ID du thérapeute
   * @param {Object} data - Données à mettre à jour
   */
  async updateTherapist(therapistId, data) {
    try {
      const response = await api.put(`/therapists/${therapistId}`, data);
      return response.data;
    } catch (error) {
      console.error('❌ Error updateTherapist:', error);
      throw error;
    }
  },

  // ============================================================
  // 3. GESTION DES RÉSERVATIONS
  // ============================================================

  /**
   * Récupérer la liste des réservations
   * @param {Object} params - Paramètres de filtrage
   */
  async getBookings(params = {}) {
    try {
      const { status = '', limit = 50, skip = 0, startDate = '', endDate = '' } = params;
      const queryParams = new URLSearchParams();
      if (status) queryParams.append('status_filter', status);
      if (limit) queryParams.append('limit', limit);
      if (skip) queryParams.append('offset', skip);
      if (startDate) queryParams.append('start_date', startDate);
      if (endDate) queryParams.append('end_date', endDate);

      const response = await api.get(`/bookings?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getBookings:', error);
      throw error;
    }
  },

  /**
   * Récupérer les détails d'une réservation
   * @param {number} bookingId - ID de la réservation
   */
  async getBookingById(bookingId) {
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getBookingById:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour une réservation
   * @param {number} bookingId - ID de la réservation
   * @param {Object} bookingData - Données à mettre à jour
   */
  async updateBooking(bookingId, bookingData) {
    try {
      const response = await api.put(`/bookings/${bookingId}`, bookingData);
      return response.data;
    } catch (error) {
      console.error('❌ Error updateBooking:', error);
      throw error;
    }
  },

  /**
   * Annuler une réservation
   * @param {number} bookingId - ID de la réservation
   * @param {string} reason - Raison de l'annulation
   */
  async cancelBooking(bookingId, reason = '') {
    try {
      const response = await api.put(`/bookings/${bookingId}/cancel?reason=${encodeURIComponent(reason)}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error cancelBooking:', error);
      throw error;
    }
  },

  /**
   * Obtenir les statistiques des réservations
   * @param {string} period - Période (day, week, month, year)
   */
  async getBookingStats(period = 'month') {
    try {
      const response = await api.get(`/bookings/stats/overview?period=${period}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getBookingStats:', error);
      throw error;
    }
  },

  // ============================================================
  // 4. GESTION DES AVIS
  // ============================================================

  /**
   * Récupérer la liste des avis
   * @param {Object} filters - Filtres
   */
  async getReviews(filters = {}) {
    try {
      const { therapistId = null, rating = null, limit = 50, skip = 0 } = filters;
      const queryParams = new URLSearchParams();
      if (therapistId) queryParams.append('therapist_id', therapistId);
      if (rating) queryParams.append('rating', rating);
      if (limit) queryParams.append('limit', limit);
      if (skip) queryParams.append('skip', skip);

      const response = await api.get(`/reviews?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getReviews:', error);
      throw error;
    }
  },

  /**
   * Supprimer un avis
   * @param {number} reviewId - ID de l'avis
   */
  async deleteReview(reviewId) {
    try {
      const response = await api.delete(`/reviews/${reviewId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error deleteReview:', error);
      throw error;
    }
  },

  // ============================================================
  // 5. GESTION DES PAIEMENTS
  // ============================================================

  /**
   * Récupérer la liste des paiements
   * @param {Object} filters - Filtres
   */
  async getPayments(filters = {}) {
    try {
      const { userId = null, status = null, limit = 50, skip = 0 } = filters;
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);
      if (status) queryParams.append('status', status);
      if (limit) queryParams.append('limit', limit);
      if (skip) queryParams.append('skip', skip);

      const response = await api.get(`/payments?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getPayments:', error);
      throw error;
    }
  },

  /**
   * Créer un paiement
   * @param {Object} paymentData - Données du paiement
   */
  async createPayment(paymentData) {
    try {
      const response = await api.post('/payments/create', paymentData);
      return response.data;
    } catch (error) {
      console.error('❌ Error createPayment:', error);
      throw error;
    }
  },

  // ============================================================
  // 6. GESTION DES NOTIFICATIONS
  // ============================================================

  /**
   * Récupérer la liste des notifications
   * @param {Object} params - Paramètres
   */
  async getNotifications(params = {}) {
    try {
      const { limit = 50, skip = 0, unreadOnly = false } = params;
      const queryParams = new URLSearchParams();
      if (limit) queryParams.append('limit', limit);
      if (skip) queryParams.append('skip', skip);
      if (unreadOnly) queryParams.append('unread_only', 'true');

      const response = await api.get(`/notifications?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getNotifications:', error);
      throw error;
    }
  },

  /**
   * Marquer une notification comme lue
   * @param {number} notificationId - ID de la notification
   */
  async markNotificationAsRead(notificationId) {
    try {
      const response = await api.put(`/notifications/read/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error markNotificationAsRead:', error);
      throw error;
    }
  },

  /**
   * Supprimer une notification
   * @param {number} notificationId - ID de la notification
   */
  async deleteNotification(notificationId) {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error deleteNotification:', error);
      throw error;
    }
  },

  // ============================================================
  // 7. GESTION DES ALERTES SOS
  // ============================================================

  /**
   * Récupérer la liste des alertes SOS
   * @param {Object} filters - Filtres
   */
  async getSOSAlerts(filters = {}) {
    try {
      const { status = null, limit = 50, skip = 0 } = filters;
      const queryParams = new URLSearchParams();
      if (status) queryParams.append('status', status);
      if (limit) queryParams.append('limit', limit);
      if (skip) queryParams.append('skip', skip);

      const response = await api.get(`/sos?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getSOSAlerts:', error);
      throw error;
    }
  },

  /**
   * Résoudre une alerte SOS
   * @param {number} alertId - ID de l'alerte
   */
  async resolveSOSAlert(alertId) {
    try {
      const response = await api.put(`/sos/close/${alertId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error resolveSOSAlert:', error);
      throw error;
    }
  },

  // ============================================================
  // 8. ADMIN - APPROBATION DES THÉRAPEUTES
  // ============================================================

  /**
   * Récupérer la liste des thérapeutes en attente
   */
  async getPendingTherapists() {
    try {
      const response = await api.get('/admin/pending-therapists');
      return response.data;
    } catch (error) {
      console.error('❌ Error getPendingTherapists:', error);
      throw error;
    }
  },

  /**
   * Approuver un thérapeute
   * @param {number} therapistId - ID du thérapeute
   */
  async approveTherapist(therapistId) {
    try {
      const response = await api.put(`/admin/approve-therapist/${therapistId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error approveTherapist:', error);
      throw error;
    }
  },

  /**
   * Rejeter un thérapeute
   * @param {number} therapistId - ID du thérapeute
   * @param {string} reason - Raison du rejet
   */
  async rejectTherapist(therapistId, reason = '') {
    try {
      const response = await api.put(`/admin/reject-therapist/${therapistId}`, { reason });
      return response.data;
    } catch (error) {
      console.error('❌ Error rejectTherapist:', error);
      throw error;
    }
  },

  // ============================================================
  // 9. ADMIN - DASHBOARD
  // ============================================================

  /**
   * Récupérer les données du tableau de bord admin
   */
  async getAdminDashboard() {
    try {
      const response = await api.get('/admin/dashboard');
      return response.data;
    } catch (error) {
      console.error('❌ Error getAdminDashboard:', error);
      throw error;
    }
  },

  /**
   * Récupérer les statistiques admin
   */
  async getAdminStatistics() {
    try {
      const response = await api.get('/admin/statistics');
      return response.data;
    } catch (error) {
      console.error('❌ Error getAdminStatistics:', error);
      throw error;
    }
  },

  /**
   * Récupérer les statistiques des revenus
   * @param {string} period - Période (day, week, month, year)
   */
  async getRevenueStats(period = 'month') {
    try {
      const response = await api.get(`/admin/revenues?period=${period}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getRevenueStats:', error);
      throw error;
    }
  },

  /**
   * Récupérer le nombre d'utilisateurs
   */
  async getUserCount() {
    try {
      const response = await api.get('/admin/users-count');
      return response.data;
    } catch (error) {
      console.error('❌ Error getUserCount:', error);
      throw error;
    }
  },

  /**
   * Récupérer le nombre de réservations
   */
  async getBookingCount() {
    try {
      const response = await api.get('/admin/bookings-count');
      return response.data;
    } catch (error) {
      console.error('❌ Error getBookingCount:', error);
      throw error;
    }
  },

  // ============================================================
  // 10. IA - INSIGHTS
  // ============================================================

  /**
   * Récupérer les insights IA
   */
  async getAIInsights() {
    try {
      const response = await api.get('/ai/insights');
      return response.data;
    } catch (error) {
      console.error('❌ Error getAIInsights:', error);
      throw error;
    }
  },

  /**
   * Récupérer les services populaires
   */
  async getPopularServices() {
    try {
      const response = await api.get('/ai/popular-services');
      return response.data;
    } catch (error) {
      console.error('❌ Error getPopularServices:', error);
      throw error;
    }
  },

  /**
   * Récupérer les meilleurs thérapeutes
   */
  async getBestTherapists() {
    try {
      const response = await api.get('/ai/best-therapists');
      return response.data;
    } catch (error) {
      console.error('❌ Error getBestTherapists:', error);
      throw error;
    }
  },

  /**
   * Récupérer les prévisions de revenus
   */
  async getRevenuePrediction() {
    try {
      const response = await api.get('/ai/revenue-prediction');
      return response.data;
    } catch (error) {
      console.error('❌ Error getRevenuePrediction:', error);
      throw error;
    }
  },

  // ============================================================
  // 11. CHATBOT IA
  // ============================================================

  /**
   * Envoyer un message au chatbot
   * @param {string} message - Message de l'utilisateur
   */
  async sendChatbotMessage(message) {
    try {
      const response = await api.post('/chatbot/message', { message });
      return response.data;
    } catch (error) {
      console.error('❌ Error sendChatbotMessage:', error);
      throw error;
    }
  },

  /**
   * Récupérer les FAQs
   */
  async getChatbotFAQs() {
    try {
      const response = await api.get('/chatbot/faq');
      return response.data;
    } catch (error) {
      console.error('❌ Error getChatbotFAQs:', error);
      throw error;
    }
  },

  // ============================================================
  // 12. GÉOLOCALISATION
  // ============================================================

  /**
   * Mettre à jour la position de l'utilisateur
   * @param {Object} location - { latitude, longitude }
   */
  async updateLocation(location) {
    try {
      const response = await api.post('/geolocation/update', location);
      return response.data;
    } catch (error) {
      console.error('❌ Error updateLocation:', error);
      throw error;
    }
  },

  /**
   * Récupérer les thérapeutes à proximité
   * @param {Object} location - { latitude, longitude, radius }
   */
  async getNearbyTherapists(location) {
    try {
      const { latitude, longitude, radius = 10 } = location;
      const response = await api.get(
        `/geolocation/nearby-therapists?latitude=${latitude}&longitude=${longitude}&radius=${radius}`
      );
      return response.data;
    } catch (error) {
      console.error('❌ Error getNearbyTherapists:', error);
      throw error;
    }
  },

  // ============================================================
  // 13. SUGGESTION DE PRIX (IA)
  // ============================================================

  /**
   * Suggérer un prix pour un massage
   * @param {Object} data - { massage_type, duration, location, distance }
   */
  async suggestPrice(data) {
    try {
      const response = await api.post('/pricing/suggest', data);
      return response.data;
    } catch (error) {
      console.error('❌ Error suggestPrice:', error);
      throw error;
    }
  },

  /**
   * Calculer un prix
   * @param {Object} data - Données pour le calcul
   */
  async calculatePrice(data) {
    try {
      const response = await api.post('/pricing/calculate', data);
      return response.data;
    } catch (error) {
      console.error('❌ Error calculatePrice:', error);
      throw error;
    }
  },

  // ============================================================
  // 14. RECOMMANDATIONS IA
  // ============================================================

  /**
   * Recommander un thérapeute
   * @param {Object} data - { massage_type, location, budget, preferences }
   */
  async recommendTherapist(data) {
    try {
      const response = await api.post('/ai/recommend-therapist', data);
      return response.data;
    } catch (error) {
      console.error('❌ Error recommendTherapist:', error);
      throw error;
    }
  },

  /**
   * Recommander un type de massage
   * @param {Object} data - { symptoms, preferences, budget }
   */
  async recommendMassage(data) {
    try {
      const response = await api.post('/ai/recommend-massage', data);
      return response.data;
    } catch (error) {
      console.error('❌ Error recommendMassage:', error);
      throw error;
    }
  },

  /**
   * Prédire un prix
   * @param {Object} data - { massage_type, duration, location, time }
   */
  async predictPrice(data) {
    try {
      const response = await api.post('/ai/predict-price', data);
      return response.data;
    } catch (error) {
      console.error('❌ Error predictPrice:', error);
      throw error;
    }
  },

  /**
   * Détecter une fraude
   * @param {Object} data - Données à analyser
   */
  async detectFraud(data) {
    try {
      const response = await api.post('/ai/fraud-detection', data);
      return response.data;
    } catch (error) {
      console.error('❌ Error detectFraud:', error);
      throw error;
    }
  },

  // ============================================================
  // 15. AUTHENTIFICATION
  // ============================================================

  /**
   * Login admin
   * @param {Object} credentials - { email, password }
   */
  async adminLogin(credentials) {
    try {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      console.error('❌ Error adminLogin:', error);
      throw error;
    }
  },

  /**
   * Vérifier si l'utilisateur est admin
   */
  async isAdmin() {
    try {
      const response = await api.get('/auth/verify-admin');
      return response.data.isAdmin || false;
    } catch (error) {
      console.error('❌ Error isAdmin:', error);
      return false;
    }
  },

  // ============================================================
  // 16. OFFRES / NÉGOCIATION
  // ============================================================

  /**
   * Créer une offre
   * @param {Object} offerData - Données de l'offre
   */
  async createOffer(offerData) {
    try {
      const response = await api.post('/offers/create', offerData);
      return response.data;
    } catch (error) {
      console.error('❌ Error createOffer:', error);
      throw error;
    }
  },

  /**
   * Accepter une offre
   * @param {number} offerId - ID de l'offre
   */
  async acceptOffer(offerId) {
    try {
      const response = await api.post(`/offers/${offerId}/accept`);
      return response.data;
    } catch (error) {
      console.error('❌ Error acceptOffer:', error);
      throw error;
    }
  },

  /**
   * Rejeter une offre
   * @param {number} offerId - ID de l'offre
   */
  async rejectOffer(offerId) {
    try {
      const response = await api.post(`/offers/${offerId}/reject`);
      return response.data;
    } catch (error) {
      console.error('❌ Error rejectOffer:', error);
      throw error;
    }
  },

  /**
   * Faire une contre-offre
   * @param {number} offerId - ID de l'offre
   * @param {Object} counterData - { price, message }
   */
  async counterOffer(offerId, counterData) {
    try {
      const response = await api.post(`/offers/${offerId}/counter`, counterData);
      return response.data;
    } catch (error) {
      console.error('❌ Error counterOffer:', error);
      throw error;
    }
  },

  // ============================================================
  // ADMIN - PARAMÈTRES
  // ============================================================

  /**
   * Récupérer les paramètres admin
   *
   * ✅ CORRIGÉ : un 404 ici signifie simplement que l'endpoint
   * `/admin/settings` n'est pas encore implémenté côté backend — ce
   * n'est pas un bug frontend, donc on ne le log plus en
   * `console.error` (mena, alarmant) mais en `console.log` simple, et
   * les valeurs par défaut sont utilisées silencieusement.
   */
  async getAdminSettings() {
    try {
      const response = await api.get('/admin/settings');
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('ℹ️ [ADMIN SETTINGS] Endpoint /admin/settings non implémenté côté backend — valeurs par défaut utilisées.');
      } else {
        console.error('❌ Error getAdminSettings:', error.message || error);
      }
      // Retourner les valeurs par défaut si l'endpoint n'existe pas
      return {
        notifications: true,
        emailNotifications: true,
        smsNotifications: false,
        autoApprove: false,
        commissionRate: 10,
        minPrice: 25000,
        maxDistance: 10
      };
    }
  },

  /**
   * Mettre à jour les paramètres admin
   */
  async updateAdminSettings(settings) {
    try {
      const response = await api.put('/admin/settings', settings);
      return response.data;
    } catch (error) {
      console.error('❌ Error updateAdminSettings:', error);
      throw error;
    }
  },
  // ============================================================
// ✅ NOUVEAU : OBTENIR LES INFOS CERTIFICAT D'UN THÉRAPEUTE
// ============================================================
async getTherapistCertificateInfo(therapistId) {
  try {
    const response = await api.get(`/admin/therapist-certificate/${therapistId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error getTherapistCertificateInfo:', error);
    throw error;
  }
},
// ============================================================
// 18. GESTION DES TYPES DE MASSAGE - ADMIN
// ============================================================

async getMassageTypes(isActive = null) {
  try {

    const params = {};

    if (isActive !== null) {
      params.is_active = Boolean(isActive);
    }

    console.log(
      '📤 [API REQUEST] GET /admin/massage-types',
      params
    );

    const response = await api.get(
      '/admin/massage-types',
      {
        params,
      }
    );

    console.log(
      '📥 [API RESPONSE]',
      response.status,
      '/admin/massage-types'
    );

    return response.data;

  } catch (error) {

    console.error(
      '❌ Error getMassageTypes:',
      error?.response?.status,
      error?.response?.data || error?.message
    );

    throw error;
  }
},


/**
 * ✅ Créer un type de massage (multipart/form-data).
 *
 * `formData` doit être une instance de FormData (champs texte +
 * fichiers `icon`/`image` optionnels — voir buildMassageTypeFormData
 * dans MassageTypesScreen.js).
 *
 * 🐛 CORRECTIF (422 "field required" sur name/category/... alors que
 * le formulaire les envoie bien) : l'instance axios `api` a un header
 * par défaut `Content-Type: application/json` (voir api.js). Sans
 * override, ce défaut reste actif même pour une requête FormData —
 * le backend reçoit alors une requête "application/json" qui ne
 * contient aucune partie multipart, donc TOUS les champs Form(...)
 * sont vus comme absents → 422 sur chaque champ obligatoire.
 *
 * On efface ce header en le mettant à `undefined` : axios ne l'envoie
 * alors plus du tout, et c'est l'environnement (navigateur côté Web,
 * pont réseau natif côté React Native) qui calcule lui-même le bon
 * `multipart/form-data; boundary=...`. Fixer la chaîne à la main
 * (`'multipart/form-data'` sans boundary) casse le Web ; l'omettre
 * complètement laisse 'application/json' hérité de l'instance. Seul
 * `undefined` marche sur les DEUX plateformes.
 */
async createMassageType(formData) {
  try {

    console.log(
      '📤 [API REQUEST] POST /admin/massage-types (multipart)'
    );

    const response = await api.post(
      '/admin/massage-types',
      formData,
      {
        headers: {
          'Content-Type': undefined,
        },
      }
    );

    console.log(
      '📥 [API RESPONSE]',
      response.status,
      '/admin/massage-types'
    );

    return response.data;

  } catch (error) {

    console.error(
      '❌ Error createMassageType:',
      error?.response?.status,
      error?.response?.data || error?.message
    );

    throw error;
  }
},


/**
 * ✅ Mettre à jour un type de massage (multipart/form-data).
 * Voir le commentaire de `createMassageType` pour le détail du
 * correctif `'Content-Type': undefined` (bug 422 sur les deux
 * plateformes sinon).
 */
async updateMassageType(typeId, formData) {
  try {

    const id = Number(typeId);

    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(
        `ID de massage invalide: ${typeId}`
      );
    }

    console.log(
      '📤 [API REQUEST] PUT',
      `/admin/massage-types/${id}`,
      '(multipart)'
    );

    const response = await api.put(
      `/admin/massage-types/${id}`,
      formData,
      {
        headers: {
          'Content-Type': undefined,
        },
      }
    );

    console.log(
      '📥 [API RESPONSE]',
      response.status,
      `/admin/massage-types/${id}`
    );

    return response.data;

  } catch (error) {

    console.error(
      '❌ Error updateMassageType:',
      error?.response?.status,
      error?.response?.data || error?.message
    );

    throw error;
  }
},


async deleteMassageType(typeId, permanent = false) {
  try {

    const id = Number(typeId);

    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(
        `ID de massage invalide: ${typeId}`
      );
    }

    const isPermanent =
      Boolean(permanent);


    console.log(
      '📤 [API REQUEST] DELETE',
      `/admin/massage-types/${id}`
    );

    console.log(
      '📤 [API PARAMS]',
      {
        permanent: isPermanent,
      }
    );


    /*
     * IMPORTANT POUR WEB:
     *
     * On NE met pas manuellement:
     *
     * ?permanent=false
     *
     * dans l'URL.
     *
     * Axios construit lui-même le query string.
     */

    const response = await api.delete(
      `/admin/massage-types/${id}`,
      {
        params: {
          permanent: isPermanent,
        },
      }
    );


    console.log(
      '📥 [API RESPONSE DELETE]',
      response.status,
      response.data
    );


    return response.data;

  } catch (error) {

    console.error(
      '❌ Error deleteMassageType'
    );

    console.error(
      'Status:',
      error?.response?.status
    );

    console.error(
      'Data:',
      error?.response?.data
    );

    console.error(
      'URL:',
      error?.config?.url
    );

    console.error(
      'Method:',
      error?.config?.method
    );

    console.error(
      'Params:',
      error?.config?.params
    );

    throw error;
  }
},

// ============================================================
// ✅ NOUVEAU : TÉLÉCHARGER LE CERTIFICAT D'UN THÉRAPEUTE
// ============================================================
getCertificateDownloadUrl(therapistId) {
  return `/admin/therapist-certificate/${therapistId}/download`;
},
  // ============================================================
  // 17. WEBSOCKET
  // ============================================================

  /**
   * ✅ CORRIGÉ : `API_URL` n'était jamais importé dans ce fichier
   * (seul `api`, l'instance axios, l'était) — tout appel à
   * `getWebSocketURL`/`getChatWebSocketURL` levait un
   * `ReferenceError: API_URL is not defined`. On dérive maintenant
   * l'URL depuis `api.defaults.baseURL`, qui est déjà la même base
   * que le reste du fichier utilise pour ses requêtes.
   *
   * Récupérer l'URL WebSocket pour le tracking
   * @param {string} bookingId - ID de la réservation
   */
  /**
   * Transforme le chemin relatif renvoyé par le backend
   * (ex: "/uploads/massage_types/xxx.jpg") en URL absolue affichable
   * dans un <Image>, en se basant sur la même base URL que le reste
   * des requêtes (on retire juste le suffixe "/api" si présent).
   * @param {string} path - chemin relatif stocké en base (icon_url / image_url)
   */
  getMassageImageUrl(path) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;

    const base = api.defaults.baseURL || '';
    const origin = base.replace(/\/api\/?$/, '');

    return `${origin}${path}`;
  },

  getWebSocketURL(bookingId) {
    const wsUrl = api.defaults.baseURL.replace(/^http/, 'ws');
    return `${wsUrl}/ws/tracking/${bookingId}`;
  },

  /**
   * Récupérer l'URL WebSocket pour le chat
   * @param {string} bookingId - ID de la réservation
   */
  getChatWebSocketURL(bookingId) {
    const wsUrl = api.defaults.baseURL.replace(/^http/, 'ws');
    return `${wsUrl}/ws/chat/${bookingId}`;
  }


};

export default adminService;