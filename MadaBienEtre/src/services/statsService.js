// src/services/statsService.js
// Statistiques des tableaux de bord — TOUTES les valeurs viennent de la
// base de données via le backend (app/api/stats.py). Aucune donnée fictive.
import api from './api';

const errMsg = (error, fallback) =>
  error?.response?.data?.detail && typeof error.response.data.detail === 'string'
    ? error.response.data.detail
    : fallback;

const load = async (url, months, fallback) => {
  try {
    const res = await api.get(url, { params: months ? { months } : undefined });
    return res.data;
  } catch (error) {
    const e = new Error(errMsg(error, fallback));
    e.status = error?.response?.status;
    throw e;
  }
};

const statsService = {
  /** Tableau de bord CLIENT */
  client: (months = 6) => load('/stats/client', months, 'Impossible de charger vos statistiques.'),
  /** Tableau de bord THÉRAPEUTE */
  therapist: (months = 6) => load('/stats/therapist', months, 'Impossible de charger vos statistiques.'),
  /** Tableau de bord ADMIN + écran Analyses */
  admin: (months = 6) => load('/stats/admin', months, 'Impossible de charger les statistiques.'),
};

export default statsService;
