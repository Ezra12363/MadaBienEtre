// src/hooks/useAISearch.js
//
// IA de l'écran « Recherche massage » (client).
// Endpoints FastAPI existants utilisés (voir aiService) :
//   POST /ai/recommend-therapist   -> classement + score + raison
//   POST /ai/predict-price         -> prix estimé du massage choisi
//   GET  /ai/popular-services      -> massages les plus demandés
import { useCallback, useEffect, useRef, useState } from 'react';
import aiService from '../services/aiService';

export default function useAISearch({
  userId,
  massageTypeName = null,
  duration = 60,
  budgetMax = null,
  distanceMax = 15,
  referenceDistanceKm = 3,
  rankingEnabled = false,
  hasTherapists = false,
}) {
  const mountedRef = useRef(true);

  const [scores, setScores] = useState({});
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState(null);
  const [rankingCount, setRankingCount] = useState(0);

  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(null);

  const [popular, setPopular] = useState([]);
  const [popularLoading, setPopularLoading] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  const rankingCall = useRef(0);
  const estimateCall = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ----------------------------------------------------------
  // Services populaires (une fois)
  // ----------------------------------------------------------
  useEffect(() => {
    let active = true;
    setPopularLoading(true);
    aiService.getPopularServicesNamed('month').then((result) => {
      if (!active || !mountedRef.current) return;
      setPopular(result.success ? result.data || [] : []);
      setPopularLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // ----------------------------------------------------------
  // Estimation du prix (type de massage + durée)
  // ----------------------------------------------------------
  useEffect(() => {
    if (!massageTypeName) {
      setEstimate(null);
      setEstimateError(null);
      setEstimateLoading(false);
      return undefined;
    }

    const callId = ++estimateCall.current;
    setEstimateLoading(true);
    setEstimateError(null);

    const timer = setTimeout(async () => {
      const result = await aiService.predictPrice({
        massage_type: massageTypeName,
        duration,
        distance: referenceDistanceKm,
      });

      if (!mountedRef.current || callId !== estimateCall.current) return;

      if (result.success) {
        setEstimate({
          price: Number(result.data?.suggested_price ?? result.data?.price),
          min: Number(result.data?.min_price),
          max: Number(result.data?.max_price),
          confidence: Number(result.data?.confidence),
        });
      } else {
        setEstimate(null);
        setEstimateError(result.error);
      }
      setEstimateLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [massageTypeName, duration, referenceDistanceKm, reloadKey]);

  // ----------------------------------------------------------
  // Classement IA des thérapeutes
  // ----------------------------------------------------------
  useEffect(() => {
    if (!rankingEnabled || !userId || !hasTherapists) {
      return undefined;
    }

    const callId = ++rankingCall.current;
    setRankingLoading(true);
    setRankingError(null);

    const timer = setTimeout(async () => {
      const result = await aiService.recommendTherapists({
        user_id: userId,
        massage_type: massageTypeName,
        budget_max: budgetMax,
        distance_max: distanceMax,
      });

      if (!mountedRef.current || callId !== rankingCall.current) return;

      if (result.success) {
        const list = Array.isArray(result.data) ? result.data : [];
        const map = {};
        list.forEach((row, index) => {
          map[String(row.therapist_id)] = {
            rank: index + 1,
            score: Number(row.score) || 0,
            reason: row.reason || '',
            priceSuggested: row.price_suggested ?? null,
            distanceKm: row.distance_km ?? null,
          };
        });
        setScores(map);
        setRankingCount(list.length);
      } else {
        setScores({});
        setRankingCount(0);
        setRankingError(result.error);
      }
      setRankingLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [
    rankingEnabled,
    userId,
    hasTherapists,
    massageTypeName,
    budgetMax,
    distanceMax,
    reloadKey,
  ]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    scores,
    rankingLoading,
    rankingError,
    rankingCount,
    estimate,
    estimateLoading,
    estimateError,
    popular,
    popularLoading,
    refresh,
  };
}
