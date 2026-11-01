// src/hooks/useClientStats.js
// Statistiques réelles du CLIENT (GET /stats/client) — partagées entre le hero
// et la section "Mes statistiques" de l'accueil.
// Rechargement : montage, changement de `refreshKey` (pull-to-refresh),
// retour sur l'écran (focus) et toutes les 60 s (silencieux).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import statsService from '../services/statsService';

const AUTO_REFRESH_MS = 60 * 1000;

const useClientStats = (refreshKey = 0) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await statsService.client(6);
      if (!mounted.current) return;
      setData(res);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(e?.message || 'Impossible de charger vos statistiques.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (refreshKey > 0) load();
  }, [load, refreshKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const timer = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { data, loading, error, reload: load };
};

export default useClientStats;
