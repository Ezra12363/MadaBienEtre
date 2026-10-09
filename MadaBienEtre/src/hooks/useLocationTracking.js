// src/hooks/useLocationTracking.js
// ============================================
// ✅ "Tracking Temps Réel" — suivi continu de la position de l'utilisateur
// (Web : navigator.geolocation / Android-iOS : expo-location).
//
// ✅ WEB QUI FONCTIONNE COMME ANDROID
//  1) DEUX watchPosition en parallèle :
//       - haute précision (GPS / meilleur capteur dispo, jamais de cache),
//       - précision normale (Wi-Fi / IP) -> 1er point quasi instantané.
//     On garde toujours le MEILLEUR relevé : un relevé nettement moins
//     précis qui arrive juste après un bon est ignoré (plus de marqueur
//     qui saute à un mauvais endroit).
//  2) Les "Timeout expired" ne sont plus des erreurs : le navigateur
//     réessaie, et on n'affiche un message que si AUCUNE position n'est
//     arrivée au bout de 20 s.
//  3) Chien de garde : si le navigateur arrête d'envoyer des positions
//     (> 20 s), les watch sont relancés automatiquement.
//  4) Permission : détection du refus, et reprise automatique dès que
//     l'utilisateur autorise la localisation (sans recharger la page).
//  5) Contexte non sécurisé : la géolocalisation navigateur exige HTTPS
//     (ou localhost) -> message clair au lieu d'un échec silencieux.
//  6) Cap (heading) et vitesse CALCULÉS à partir des positions successives
//     quand le navigateur ne les fournit pas (ordinateur) -> la flèche de
//     direction fonctionne aussi sur le web.
//
// ✅ ANDROID / iOS : dernière position connue -> position précise (10 s max)
//    -> watch continu (repli en précision moindre), détection GPS désactivé,
//    et démarrage annulable (aucun abonnement orphelin).
// ✅ Une position valide EFFACE toute erreur précédente.
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

const NATIVE_QUICK_FIX_TIMEOUT_MS = 10000;
const WEB_NO_FIX_ERROR_DELAY_MS = 20000;
const WEB_WATCHDOG_STALL_MS = 20000;
const MOTION_MIN_DISTANCE_M = 3;

const IS_WEB = Platform.OS === 'web';

// ✅ WEB : au-delà de ce seuil, le relevé est "grossier" (Wi-Fi / IP, ordinateur
// sans GPS) : il ne bouge jamais et ne doit PAS être pris pour la position réelle.
const COARSE_ACCURACY_M = 300;
// Un relevé nettement moins précis est ignoré pendant cette durée
const KEEP_BEST_FIX_MS = 30000;

// ✅ Dernière position connue, partagée entre les écrans : en rouvrant un
// écran de navigation, l'itinéraire démarre IMMÉDIATEMENT avec cette
// position (corrigée ensuite par le vrai GPS). Ignorée au-delà de 5 min.
// `cached: true` = ancienne position : utile pour calculer la route, mais
// l'écran ne doit PAS l'afficher comme "position actuelle".
const LAST_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
let lastGlobalLocation = null;
const getFreshLastLocation = () =>
  lastGlobalLocation &&
  Date.now() - lastGlobalLocation.timestamp < LAST_LOCATION_MAX_AGE_MS
    ? { ...lastGlobalLocation, cached: true }
    : null;

// --- Géométrie (mètres / degrés) ---------------------------------
const toRad = (d) => (d * Math.PI) / 180;

const distanceMeters = (a, b) => {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const bearingDegrees = (a, b) => {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.cos(toRad(b.longitude - a.longitude));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

/**
 * @param {Object} options
 * @param {boolean} options.enabled - Démarre/arrête le tracking (default true)
 * @param {number} options.distanceIntervalMeters - Seuil de distance (m). 0 = aucun. (mobile)
 * @param {number} options.timeIntervalMs - Intervalle minimal entre 2 updates (ms). (mobile)
 */
export default function useLocationTracking({
  enabled = true,
  distanceIntervalMeters = 10,
  timeIntervalMs = 4000,
} = {}) {
  const [location, setLocation] = useState(getFreshLastLocation);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  // null = pas encore demandé, true = accordé, false = refusé
  const [permissionGranted, setPermissionGranted] = useState(null);

  const nativeSubscription = useRef(null);
  const webWatchId = useRef(null);
  const webLowWatchId = useRef(null);
  const webNoFixTimer = useRef(null);
  const webWatchdog = useRef(null);
  const webPermissionStatus = useRef(null);
  const lastFixAtRef = useRef(0);
  const lastAcceptedRef = useRef(null); // { accuracy, at } — meilleur relevé récent (web)
  const hasFirstFixRef = useRef(false);
  const runIdRef = useRef(0);
  const lastGoodRef = useRef(null); // dernier relevé précis (<= 50 m)
  const prevMotionRef = useRef(null); // pour calculer cap / vitesse

  const handlePosition = useCallback((coords) => {
    // ✅ Position RÉELLE : on ignore un relevé très imprécis (> 100 m, ex:
    // position "réseau") qui arrive juste après un bon relevé GPS (<= 50 m),
    // sinon le marqueur sauterait à un mauvais endroit.
    const acc = coords.accuracy ?? null;
    const good = lastGoodRef.current;
    if (good && acc != null && acc > 100 && Date.now() - good.at < KEEP_BEST_FIX_MS) {
      return;
    }
    if (acc != null && acc <= 50) {
      lastGoodRef.current = { accuracy: acc, at: Date.now() };
    }

    // ✅ Relevé "grossier" (web seulement : Wi-Fi / IP, ne bouge pas)
    const coarse = IS_WEB && acc != null && acc > COARSE_ACCURACY_M;

    // ✅ Cap + vitesse : ceux du capteur s'ils existent, sinon calculés
    // à partir des deux dernières positions. Jamais calculés à partir d'un
    // relevé imprécis (sinon fausse flèche due au "bruit" du Wi-Fi/IP).
    let heading = Number.isFinite(coords.heading) ? coords.heading : null;
    let speed = Number.isFinite(coords.speed) ? coords.speed : null;
    const now = Date.now();
    const prev = prevMotionRef.current;
    const preciseEnough = acc == null || acc <= 100;
    if (prev && preciseEnough) {
      const d = distanceMeters(prev, coords);
      const dt = (now - prev.t) / 1000;
      if (d >= MOTION_MIN_DISTANCE_M && dt > 0 && dt < 10) {
        if (heading == null) heading = bearingDegrees(prev, coords);
        if (speed == null) speed = d / dt;
        prevMotionRef.current = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          t: now,
        };
      }
    } else if (!prev) {
      prevMotionRef.current = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        t: now,
      };
    }

    hasFirstFixRef.current = true;
    setErrorMsg(null); // ✅ une position valide efface toute erreur précédente
    setIsLocating(false);

    const next = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading,
      speed,
      accuracy: acc,
      coarse,
      timestamp: now,
    };
    lastGlobalLocation = next;
    setLocation(next);
  }, []);

  const clearWebWatches = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (webWatchId.current != null) {
      navigator.geolocation.clearWatch(webWatchId.current);
      webWatchId.current = null;
    }
    if (webLowWatchId.current != null) {
      navigator.geolocation.clearWatch(webLowWatchId.current);
      webLowWatchId.current = null;
    }
  }, []);

  const stopTracking = useCallback(() => {
    runIdRef.current += 1; // invalide tout démarrage en cours

    if (nativeSubscription.current) {
      nativeSubscription.current.remove();
      nativeSubscription.current = null;
    }

    clearWebWatches();
    if (webNoFixTimer.current) clearTimeout(webNoFixTimer.current);
    if (webWatchdog.current) clearInterval(webWatchdog.current);
    webNoFixTimer.current = null;
    webWatchdog.current = null;
    if (webPermissionStatus.current) {
      webPermissionStatus.current.onchange = null;
      webPermissionStatus.current = null;
    }

    setIsTracking(false);
    setIsLocating(false);
    hasFirstFixRef.current = false;
    lastGoodRef.current = null;
    lastAcceptedRef.current = null;
    prevMotionRef.current = null;
  }, [clearWebWatches]);

  const startTracking = useCallback(async () => {
    const runId = (runIdRef.current += 1);
    const isStale = () => runId !== runIdRef.current;

    setErrorMsg(null);
    setIsLocating(true);
    hasFirstFixRef.current = false;

    // ============================================
    // WEB : navigator.geolocation
    // ============================================
    if (Platform.OS === 'web') {
      const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null;

      if (!geo) {
        setErrorMsg('Ce navigateur ne supporte pas la géolocalisation.');
        setIsLocating(false);
        return;
      }

      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setErrorMsg(
          "La géolocalisation du navigateur exige HTTPS (ou localhost). Ouvrez l'application en https:// ou via http://localhost."
        );
        setIsLocating(false);
        return;
      }

      setPermissionGranted(true);
      lastAcceptedRef.current = null;
      lastFixAtRef.current = Date.now();

      const denied = () => {
        setPermissionGranted(false);
        setErrorMsg(
          "Localisation refusée. Autorisez-la dans les réglages du navigateur (cadenas à côté de l'adresse)."
        );
        setIsLocating(false);
      };

      // Garde le MEILLEUR relevé : un relevé nettement moins précis qui
      // arrive peu après un meilleur (watch "Wi-Fi/IP") est ignoré.
      const onFix = (pos) => {
        if (isStale()) return;

        const acc = pos.coords.accuracy ?? null;
        const now = Date.now();
        const last = lastAcceptedRef.current;

        if (last && last.accuracy != null && acc != null) {
          const clearlyWorse = acc > last.accuracy * 1.5 + 20;
          if (clearlyWorse && now - last.at < KEEP_BEST_FIX_MS) return;
        }

        lastAcceptedRef.current = { accuracy: acc, at: now };
        lastFixAtRef.current = now;
        if (webNoFixTimer.current) {
          clearTimeout(webNoFixTimer.current);
          webNoFixTimer.current = null;
        }

        handlePosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
        });
      };

      // Les timeouts / positions indisponibles ne sont PAS fatals : le
      // navigateur continue d'essayer. Seul un refus de permission l'est.
      const onError = (err) => {
        if (err?.code === 1) denied();
      };

      const startWatches = () => {
        if (isStale()) return;
        clearWebWatches();

        // 1) Haute précision, jamais de cache
        webWatchId.current = geo.watchPosition(onFix, onError, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30000,
        });

        // 2) Précision normale : 1er point rapide (Wi-Fi / IP)
        webLowWatchId.current = geo.watchPosition(onFix, onError, {
          enableHighAccuracy: false,
          maximumAge: 5000,
          timeout: 30000,
        });
      };

      // Position immédiate (cache navigateur toléré 30 s) pour afficher vite
      geo.getCurrentPosition(onFix, onError, {
        enableHighAccuracy: false,
        maximumAge: 30000,
        timeout: 10000,
      });

      startWatches();

      // Aucun point au bout de 20 s -> là seulement on affiche une erreur
      webNoFixTimer.current = setTimeout(() => {
        if (!isStale() && !hasFirstFixRef.current) {
          setErrorMsg(
            'Position introuvable. Activez la localisation (GPS / Wi-Fi) puis touchez « Réessayer ».'
          );
          setIsLocating(false);
        }
      }, WEB_NO_FIX_ERROR_DELAY_MS);

      // Chien de garde : le navigateur n'envoie plus rien -> on relance
      webWatchdog.current = setInterval(() => {
        if (isStale()) return;
        if (
          hasFirstFixRef.current &&
          Date.now() - lastFixAtRef.current > WEB_WATCHDOG_STALL_MS
        ) {
          lastFixAtRef.current = Date.now();
          startWatches();
        }
      }, 5000);

      // Permission : refus détecté, reprise automatique à l'autorisation
      try {
        if (navigator.permissions?.query) {
          navigator.permissions
            .query({ name: 'geolocation' })
            .then((status) => {
              if (isStale()) return;
              webPermissionStatus.current = status;
              if (status.state === 'denied') denied();
              status.onchange = () => {
                if (isStale()) return;
                if (status.state === 'granted') {
                  setPermissionGranted(true);
                  setErrorMsg(null);
                  setIsLocating(true);
                  startWatches();
                } else if (status.state === 'denied') {
                  denied();
                }
              };
            })
            .catch(() => {});
        }
      } catch (_e) { /* API permissions indisponible : pas bloquant */ }

      setIsTracking(true);
      return;
    }

    // ============================================
    // ANDROID / iOS : expo-location
    // ============================================
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (isStale()) return;

      if (status !== 'granted') {
        setPermissionGranted(false);
        setErrorMsg('Autorisation de localisation refusée.');
        setIsLocating(false);
        return;
      }
      setPermissionGranted(true);

      let servicesOn = true;
      try {
        servicesOn = await Location.hasServicesEnabledAsync();
      } catch (_e) { /* on suppose activé */ }
      if (isStale()) return;

      if (!servicesOn) {
        setErrorMsg("Le GPS de l'appareil est désactivé. Activez la localisation.");
        setIsLocating(false);
        return;
      }

      // 1) Dernière position connue : quasi instantanée
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
        if (isStale()) return;
        if (last?.coords && !hasFirstFixRef.current) handlePosition(last.coords);
      } catch (_e) { /* pas bloquant */ }

      // 2) Position précise (10 s max)
      try {
        const quick = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('first fix timeout')),
              NATIVE_QUICK_FIX_TIMEOUT_MS
            )
          ),
        ]);
        if (isStale()) return;
        handlePosition(quick.coords);
      } catch (quickFixError) {
        console.warn('⚠️ first fix:', quickFixError?.message);
      }
      if (isStale()) return;

      // 3) Watch continu (repli en précision moindre si BestForNavigation échoue)
      const watch = (accuracy) =>
        Location.watchPositionAsync(
          {
            accuracy,
            timeInterval: timeIntervalMs,
            distanceInterval: distanceIntervalMeters,
          },
          (pos) => handlePosition(pos.coords)
        );

      let subscription;
      try {
        subscription = await watch(Location.Accuracy.BestForNavigation);
      } catch (_e) {
        subscription = await watch(Location.Accuracy.Balanced);
      }

      if (isStale()) {
        subscription.remove();
        return;
      }

      nativeSubscription.current = subscription;
      setIsTracking(true);
      setIsLocating(false);
    } catch (error) {
      if (isStale()) return;
      setErrorMsg(error?.message || 'Impossible de démarrer le suivi de position.');
      setIsLocating(false);
    }
  }, [distanceIntervalMeters, timeIntervalMs, handlePosition, clearWebWatches]);

  useEffect(() => {
    if (enabled) {
      startTracking();
    }
    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    location,
    errorMsg,
    isTracking,
    isLocating,
    permissionGranted,
    startTracking,
    stopTracking,
  };
}