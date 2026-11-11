// src/services/aiService.js
//
// Service IA + Chatbot + Tarification — aligné sur le backend FastAPI :
//   app/api/ai.py        (/ai/*)
//   app/api/chatbot.py   (/chatbot/*)
//   app/api/pricing.py   (/pricing/*)
//
// ⚠️ Points importants (corrigés par rapport à l'ancienne version) :
//  - /ai/predict-acceptance, /pricing/suggest, /pricing/calculate et
//    /chatbot/faq reçoivent leurs paramètres en QUERY STRING (Query(...)
//    côté FastAPI), PAS dans le body JSON. Avant, ils étaient envoyés
//    en body => erreur 422.
//  - Chaque méthode renvoie toujours { success, data, error }.
//  - Les messages d'erreur FastAPI (detail = string OU liste 422) sont
//    convertis en texte lisible.

import { get, post } from './api';
import massageTypeService from './massageTypeService';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const errorText = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const detail = error.data?.detail;
  if (Array.isArray(detail)) {
    const joined = detail
      .map((d) => d?.msg || d?.message)
      .filter(Boolean)
      .join(' · ');
    if (joined) return joined;
  }
  if (typeof detail === 'string' && detail) return detail;
  if (error.status === 403) return "Accès refusé pour votre rôle.";
  if (error.status === 404) return 'Ressource introuvable.';
  return error.message || fallback;
};

const wrap = async (request, fallback) => {
  try {
    const response = await request();
    if (response?.error) {
      return {
        success: false,
        data: null,
        error: errorText(response.error, fallback),
        status: response.error.status,
      };
    }
    return { success: true, data: response?.data ?? null, error: null };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error?.message || fallback,
    };
  }
};

const cleanParams = (params) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== ''
    )
  );

// ------------------------------------------------------------
// Service
// ------------------------------------------------------------

class AIService {
  // ============ /ai ============

  /**
   * POST /ai/recommend-therapist (body JSON) — Tableau 45 du mémoire.
   * Corps : massage_type_id, budget, max_distance_km, latitude, longitude
   * (les anciens noms massage_type / budget_max / distance_max restent acceptés).
   *
   * Résultat normalisé : `data` est TOUJOURS un tableau. Si aucun masseur ne
   * correspond, `data` est vide et `suggestion` propose d'élargir le rayon / le
   * budget ({ message, suggested_max_distance_km, suggested_budget }).
   */
  async recommendTherapists({
    user_id = null,
    massage_type_id = null,
    massage_type = null,
    budget = null,
    budget_max = null,
    max_distance_km = null,
    distance_max = null,
    latitude = null,
    longitude = null,
    preferred_gender = null,
    symptoms = null,
  } = {}) {
    const result = await wrap(
      () =>
        post(
          '/ai/recommend-therapist',
          cleanParams({
            user_id,
            massage_type_id,
            massage_type,
            budget: budget ?? budget_max,
            max_distance_km: max_distance_km ?? distance_max,
            latitude,
            longitude,
            preferred_gender,
            symptoms,
          })
        ),
      'Erreur lors de la recommandation'
    );
    if (!result.success) return { ...result, suggestion: null };

    const payload = result.data;
    if (Array.isArray(payload)) return { ...result, suggestion: null };
    return {
      ...result,
      data: Array.isArray(payload?.items) ? payload.items : [],
      suggestion: payload?.suggestion || null,
    };
  }

  /** POST /ai/predict-price (body JSON) — estimation du prix conseillé */
  predictPrice({
    massage_type,
    duration = 60,
    distance = 0,
    demand_level = 'medium',
    scheduled_at = null,
  }) {
    return wrap(
      () =>
        post(
          '/ai/predict-price',
          cleanParams({
            massage_type,
            duration,
            distance,
            demand_level,
            scheduled_at,
          })
        ),
      "Erreur lors de l'estimation du prix"
    );
  }

  /**
   * POST /ai/predict-price (body JSON) — probabilité d'acceptation d'un prix
   * proposé sur une réservation (Tableau 45).
   * Réponse : { acceptance_probability, recommended_price, model_version }
   */
  predictAcceptanceForBooking(bookingId, proposedPrice) {
    return wrap(
      () =>
        post('/ai/predict-price', {
          booking_id: bookingId,
          proposed_price: proposedPrice,
        }),
      "Erreur lors de la prédiction d'acceptation"
    );
  }

  /**
   * POST /ai/predict-acceptance?booking_id=..&price=..&reference_price=.. (QUERY)
   * `referencePrice` = offre actuelle de l'AUTRE partie (optionnel).
   */
  predictAcceptance(bookingId, price, referencePrice = null) {
    return wrap(
      () =>
        post(
          '/ai/predict-acceptance',
          {},
          {
            params: cleanParams({
              booking_id: bookingId,
              price,
              reference_price: referencePrice,
            }),
          }
        ),
      "Erreur lors de la prédiction d'acceptation"
    );
  }

  /** POST /ai/fraud-detection (body JSON) — ADMIN */
  detectFraud(bookingId) {
    return wrap(
      () => post('/ai/fraud-detection', { booking_id: bookingId }),
      'Erreur lors de la détection de fraude'
    );
  }

  /** GET /ai/popular-services?period=day|week|month */
  getPopularServices(period = 'month') {
    return wrap(
      () => get('/ai/popular-services', { period }),
      'Erreur lors du chargement des services populaires'
    );
  }

  /**
   * Services populaires + NOM du massage.
   * Le backend ne renvoie que massage_type_id et bookings_count : on
   * complète avec GET /massage-types (accessible à tous les rôles).
   */
  async getPopularServicesNamed(period = 'month') {
    const result = await this.getPopularServices(period);
    if (!result.success) return result;

    let byId = {};
    try {
      const types = await massageTypeService.getActiveMassageTypes();
      byId = Object.fromEntries(types.map((t) => [String(t.id), t]));
    } catch (e) {
      // Pas bloquant : on affichera "Massage #id".
    }

    const list = (Array.isArray(result.data) ? result.data : []).map(
      (row) => {
        const type = byId[String(row.massage_type_id)];
        return {
          ...row,
          name: type?.name || `Massage #${row.massage_type_id}`,
          category: type?.category || null,
          min_price: type?.min_price ?? null,
        };
      }
    );
    return { success: true, data: list, error: null };
  }

  /** GET /ai/best-therapists?limit= */
  getBestTherapists(limit = 10) {
    return wrap(
      () => get('/ai/best-therapists', { limit }),
      'Erreur lors du chargement des thérapeutes'
    );
  }

  /** GET /ai/revenue-prediction — ADMIN */
  getRevenuePrediction(therapistId = null, daysAhead = 30) {
    return wrap(
      () =>
        get(
          '/ai/revenue-prediction',
          cleanParams({
            therapist_id: therapistId,
            days_ahead: daysAhead,
          })
        ),
      'Erreur lors du chargement des prévisions'
    );
  }

  /**
   * GET /ai/insights?period=day|week|month|quarter|year — ADMIN
   * Renvoie : indicateurs + popular_services, busy_periods, forecast.
   */
  getAIInsights(period = 'month') {
    return wrap(
      () => get('/ai/insights', { period }),
      'Erreur lors du chargement des indicateurs'
    );
  }

  // ============ /chatbot ============

  /** POST /chatbot/message (body JSON, utilisateur du token) */
  chatWithAI(message, conversationId = null) {
    return wrap(
      () =>
        post('/chatbot/message', {
          message,
          conversation_id: conversationId,
        }),
      'Erreur lors du chat'
    );
  }

  /** GET /chatbot/suggestions */
  getChatSuggestions(context = null) {
    return wrap(
      () => get('/chatbot/suggestions', cleanParams({ context })),
      'Erreur lors du chargement des suggestions'
    );
  }

  /** POST /chatbot/faq?question=.. (QUERY) */
  getFAQAnswer(question) {
    return wrap(
      () => post('/chatbot/faq', {}, { params: { question } }),
      'Erreur lors du chargement de la FAQ'
    );
  }

  // ============ /pricing ============

  /**
   * POST /pricing/suggest (QUERY)
   * Réponse : { suggested_price, acceptance_probability, model_version, … }
   * `proposed_price` : prix saisi, dont on veut la probabilité d'acceptation.
   */
  suggestPrice({
    massage_type_id,
    duration,
    distance = 0,
    user_id = null,
    scheduled_at = null,
    proposed_price = null,
  }) {
    return wrap(
      () =>
        post(
          '/pricing/suggest',
          {},
          {
            params: cleanParams({
              massage_type_id,
              duration,
              distance,
              user_id,
              scheduled_at,
              proposed_price,
            }),
          }
        ),
      'Erreur lors de la suggestion de prix'
    );
  }

  /** POST /pricing/calculate (QUERY) — massage_type = NOM du type */
  calculatePrice({
    massage_type,
    duration,
    distance = 0,
    demand_level = 'medium',
  }) {
    return wrap(
      () =>
        post(
          '/pricing/calculate',
          {},
          {
            params: { massage_type, duration, distance, demand_level },
          }
        ),
      'Erreur lors du calcul du prix'
    );
  }

  /** GET /pricing/market-analysis — THERAPIST / ADMIN (selon backend) */
  getMarketAnalysis(massageTypeId = null) {
    return wrap(
      () =>
        get(
          '/pricing/market-analysis',
          cleanParams({ massage_type_id: massageTypeId })
        ),
      "Erreur lors de l'analyse du marché"
    );
  }
}

export default new AIService();
