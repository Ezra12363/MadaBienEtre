// src/hooks/useNegotiationAI.js
//
// IA de négociation partagée par :
//   - src/screens/client/NegotiationScreen.js
//   - src/screens/therapist/NegotiationScreen.js
//
// Endpoints FastAPI réellement utilisés (déjà existants, voir aiService) :
//   GET  /bookings/{id}                   -> type de massage, durée, distance
//   POST /pricing/suggest                 -> prix juste + fourchette (QUERY)
//   POST /ai/predict-price                -> repli si /pricing/suggest échoue
//   GET  /pricing/market-analysis         -> THÉRAPEUTE / ADMIN uniquement
//   POST /ai/predict-acceptance           -> probabilité d'acceptation (QUERY)
//
// Rien n'est inventé : si un appel échoue, la partie correspondante est
// simplement absente et le reste de l'écran continue de fonctionner.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import aiService from '../services/aiService';
import bookingService from '../services/bookingService';
import massageTypeService from '../services/massageTypeService';
import { pickNumber, toPercentNumber } from '../components/ai/aiHelpers';

const roundTo500 = (value) => Math.round(Number(value) / 500) * 500;

const firstDefined = (...values) =>
  values.find((v) => v !== undefined && v !== null && String(v).trim() !== '');

const toNumber = (value, fallback = null) => {
  const n = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

/** Extrait massage_type_id / nom / durée / distance d'une réservation. */
export const readBookingContext = (booking) => {
  if (!booking) return null;

  const massage = booking.massage_type || booking.massage || {};
  const massageObject = typeof massage === 'object' ? massage : {};

  return {
    massageTypeId: toNumber(
      firstDefined(booking.massage_type_id, massageObject.id),
      null
    ),
    massageName:
      firstDefined(
        booking.massage_type_name,
        massageObject.name,
        typeof massage === 'string' ? massage : null
      ) || null,
    duration:
      toNumber(
        firstDefined(
          booking.duration_minutes,
          booking.duration,
          booking.duration_min,
          massageObject.duration_minutes,
          massageObject.duration
        ),
        60
      ) || 60,
    distance:
      toNumber(firstDefined(booking.distance_km, booking.distance), 0) || 0,
  };
};

/**
 * @param {object}  options
 * @param {'client'|'therapist'} options.role
 * @param {number|string} options.bookingId
 * @param {number} options.currentPrice  prix actuellement sur la table
 * @param {boolean} [options.enabled=true]
 */
export default function useNegotiationAI({
  role = 'client',
  bookingId,
  currentPrice = 0,
  enabled = true,
}) {
  const isTherapist = role === 'therapist';

  const [context, setContext] = useState(null);
  const [pricing, setPricing] = useState(null); // { fair, min, max, confidence }
  const [market, setMarket] = useState(null); // THERAPIST uniquement
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [acceptance, setAcceptance] = useState({
    price: null,
    probability: null,
    loading: false,
    error: null,
  });

  const mountedRef = useRef(true);
  const acceptanceCall = useRef(0);

  // Le prix actuel sert de référence sans relancer le callback à chaque rendu.
  const currentPriceRef = useRef(currentPrice);
  currentPriceRef.current = currentPrice;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ----------------------------------------------------------
  // Chargement : réservation -> prix juste -> analyse du marché
  // ----------------------------------------------------------
  const load = useCallback(async () => {
    if (!enabled || !bookingId) return;

    setLoading(true);
    setError(null);

    try {
      const bookingResult = await bookingService.getBooking(bookingId);
      if (!bookingResult?.success || !bookingResult.data) {
        throw new Error(
          bookingResult?.error || 'Réservation introuvable pour l\'analyse IA.'
        );
      }

      const ctx = readBookingContext(bookingResult.data);

      // Le backend peut ne renvoyer que le nom : on retrouve l'id.
      if (!ctx.massageTypeId && ctx.massageName) {
        try {
          const types = await massageTypeService.getActiveMassageTypes();
          const found = types.find(
            (t) =>
              String(t.name).trim().toLowerCase() ===
              String(ctx.massageName).trim().toLowerCase()
          );
          if (found) ctx.massageTypeId = Number(found.id);
        } catch (e) {
          // non bloquant
        }
      }

      if (!mountedRef.current) return;
      setContext(ctx);

      const requests = [];

      // 1) Prix juste.
      requests.push(
        ctx.massageTypeId
          ? aiService.suggestPrice({
              massage_type_id: ctx.massageTypeId,
              duration: ctx.duration,
              distance: ctx.distance,
            })
          : Promise.resolve({ success: false, error: 'Type de massage inconnu' })
      );

      // 2) Repli : /ai/predict-price (par nom).
      requests.push(
        ctx.massageName
          ? aiService.predictPrice({
              massage_type: ctx.massageName,
              duration: ctx.duration,
              distance: ctx.distance,
            })
          : Promise.resolve({ success: false, error: 'Nom de massage inconnu' })
      );

      // 3) Marché : thérapeute / admin seulement (403 pour un client).
      requests.push(
        isTherapist && ctx.massageTypeId
          ? aiService.getMarketAnalysis(ctx.massageTypeId)
          : Promise.resolve({ success: false, data: null })
      );

      const [suggest, predict, marketResult] = await Promise.all(requests);

      if (!mountedRef.current) return;

      const source = suggest.success ? suggest.data : predict.success ? predict.data : null;

      if (source) {
        const fair = pickNumber(source, [
          'suggested_price',
          'price',
          'predicted_price',
        ]);
        setPricing({
          fair,
          min: pickNumber(source, ['min_price']),
          max: pickNumber(source, ['max_price']),
          confidence: pickNumber(source, ['confidence']),
        });
      } else {
        setPricing(null);
        setError(
          suggest.error || predict.error || "Estimation IA indisponible."
        );
      }

      setMarket(marketResult.success ? marketResult.data : null);
    } catch (e) {
      if (mountedRef.current) {
        setError(e?.message || "Erreur lors de l'analyse IA.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, bookingId, isTherapist]);

  useEffect(() => {
    load();
  }, [load]);

  // ----------------------------------------------------------
  // Probabilité d'acceptation d'un prix (appel à la demande)
  // ----------------------------------------------------------
  const checkAcceptance = useCallback(
    async (price) => {
      const value = Math.round(Number(price));
      if (!enabled || !bookingId || !Number.isFinite(value) || value <= 0) {
        setAcceptance({ price: null, probability: null, loading: false, error: null });
        return;
      }

      const callId = ++acceptanceCall.current;
      setAcceptance((prev) => ({ ...prev, price: value, loading: true, error: null }));

      const reference = Math.round(Number(currentPriceRef.current));
      const result = await aiService.predictAcceptance(
        bookingId,
        value,
        Number.isFinite(reference) && reference > 0 ? reference : null
      );

      // Une réponse plus ancienne ne doit jamais écraser la plus récente.
      if (!mountedRef.current || callId !== acceptanceCall.current) return;

      if (result.success) {
        setAcceptance({
          price: value,
          probability: toPercentNumber(result.data?.probability),
          loading: false,
          error: null,
        });
      } else {
        setAcceptance({
          price: value,
          probability: null,
          loading: false,
          error: result.error,
        });
      }
    },
    [enabled, bookingId]
  );

  // ----------------------------------------------------------
  // Analyse dérivée
  // ----------------------------------------------------------
  const analysis = useMemo(() => {
    const fair = pricing?.fair;
    const current = Number(currentPrice);

    if (!fair || !Number.isFinite(fair) || !(current > 0)) {
      return { position: null, action: null, recommendedPrice: null, gapPercent: null };
    }

    const gapPercent = Math.round(((current - fair) / fair) * 100);

    let position = 'fair';
    if (gapPercent >= 10) position = 'above';
    else if (gapPercent <= -10) position = 'below';

    let recommendedPrice;
    let action;

    if (!isTherapist) {
      // CLIENT : on vise le prix juste, jamais au-dessus de l'offre actuelle.
      recommendedPrice = roundTo500(Math.min(current, fair));
      if (pricing.min) recommendedPrice = Math.max(recommendedPrice, roundTo500(pricing.min));
      action = position === 'above' ? 'counter' : 'accept';
    } else {
      // THÉRAPEUTE : on vise le prix juste, jamais en dessous de l'offre du client.
      recommendedPrice = roundTo500(Math.max(current, fair));
      if (pricing.max) recommendedPrice = Math.min(recommendedPrice, roundTo500(pricing.max));
      action = position === 'below' ? 'counter' : 'accept';
    }

    return { position, action, recommendedPrice, gapPercent };
  }, [pricing, currentPrice, isTherapist]);

  return {
    role,
    context,
    pricing,
    market,
    loading,
    error,
    acceptance,
    ...analysis,
    refresh: load,
    checkAcceptance,
  };
}
