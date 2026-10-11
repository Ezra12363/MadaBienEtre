// src/hooks/useTherapistPosition.js
// ============================================================
// ✅ POSITION RÉELLE du thérapeute — logique PARTAGÉE (NavigationScreen,
// OffersScreen, ...). Résultat : la même position partout, la vraie.
//
//  - GPS de l'appareil (watch continu, filtre Kalman, jamais d'ancienne
//    position en cache considérée comme "réelle"),
//  - MOBILE : envoie sa position GPS au serveur toutes les ~4 s
//    (POST /geolocation/update),
//  - WEB : un PC n'a pas de GPS (Wi-Fi / IP = ±20 à 1000 m). Si sa position
//    est imprécise (> 60 m) ou absente, il lit la position GPS du téléphone
//    (GET /geolocation/current/{moi}, toutes les 2 s, si < 45 s),
//  - POSITION MANUELLE (web) : le thérapeute touche la carte à l'endroit
//    où il se trouve réellement (bouton épingle).
//
// Retour :
//   activeLocation    position complète (heading, speed, accuracy, ...) ou null
//   therapistPosition {latitude, longitude} RÉELLE, ou null tant qu'il n'y a
//                     pas de vrai relevé (jamais la position en cache)
//   hasRealPosition   boolean
//   permissionGranted true | false | null
//   positionChip      { text, color, action } pour afficher la fiabilité
//   onChipPress       exécute l'action du chip (GPS / corriger)
//   pickingPosition, setPickingPosition, handleMapPress(coord)
//   manualPosition, clearManualPosition
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/env';
import useLocationTracking from './useLocationTracking';

export default function useTherapistPosition({
  enabled = true,
  distanceIntervalMeters = 0,
  timeIntervalMs = 1000,
} = {}) {
  const { token, user } = useAuth();
  const myUserId = user?.id ?? null;

  const {
    location: gpsLocation,
    errorMsg,
    permissionGranted,
    isLocating,
    startTracking,
    stopTracking,
  } = useLocationTracking({ enabled, distanceIntervalMeters, timeIntervalMs });

  // ---------- MOBILE -> serveur ----------
  const [phoneLocation, setPhoneLocation] = useState(null);
  const lastPhonePostRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === 'web' || !token || !gpsLocation || gpsLocation.cached) return;
    if (gpsLocation.accuracy != null && gpsLocation.accuracy > 100) return;
    if (Date.now() - lastPhonePostRef.current < 4000) return;
    lastPhonePostRef.current = Date.now();

    fetch(`${API_URL}/geolocation/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
      }),
    }).catch(() => {});
  }, [gpsLocation, token]);

  // ---------- WEB <- serveur (GPS du téléphone) ----------
  const webNeedsPhone =
    Platform.OS === 'web' &&
    (!gpsLocation ||
      gpsLocation.cached ||
      gpsLocation.accuracy == null ||
      gpsLocation.accuracy > 60);

  useEffect(() => {
    if (!webNeedsPhone || !token || !myUserId) {
      setPhoneLocation(null);
      return undefined;
    }

    let cancelled = false;
    const fetchPhone = async () => {
      try {
        const res = await fetch(`${API_URL}/geolocation/current/${myUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (d?.latitude == null || d?.longitude == null) return;
        const lat = Number(d.latitude);
        const lng = Number(d.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;

        // updated_at est en UTC sans "Z" : on force l'UTC
        let at = 0;
        if (d.last_updated) {
          const raw = String(d.last_updated);
          at = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`);
        }
        if (!at || Date.now() - at > 45000) {
          if (!cancelled) setPhoneLocation(null);
          return;
        }

        setPhoneLocation((prev) =>
          prev && prev.latitude === lat && prev.longitude === lng
            ? prev
            : {
                latitude: lat,
                longitude: lng,
                heading: null,
                speed: null,
                accuracy: 15,
                phone: true,
                timestamp: at,
              }
        );
      } catch (_e) {
        /* réseau : on réessaie au prochain tour */
      }
    };

    fetchPhone();
    const timer = setInterval(fetchPhone, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [webNeedsPhone, token, myUserId]);

  // ---------- POSITION MANUELLE (web) ----------
  const [manualPosition, setManualPosition] = useState(null);
  const [pickingPosition, setPickingPosition] = useState(false);

  const activeLocation = manualPosition
    ? {
        latitude: manualPosition.latitude,
        longitude: manualPosition.longitude,
        heading: null,
        speed: null,
        accuracy: 5,
        manual: true,
        timestamp: manualPosition.at,
      }
    : webNeedsPhone && phoneLocation
      ? phoneLocation
      : gpsLocation;

  const hasRealPosition = !!activeLocation && !activeLocation.cached;

  // Position RÉELLE uniquement (référence stable tant qu'elle ne change pas)
  const lat = hasRealPosition ? activeLocation.latitude : null;
  const lng = hasRealPosition ? activeLocation.longitude : null;
  const therapistPosition = useMemo(
    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),
    [lat, lng]
  );

  const handleMapPress = useCallback(
    (coord) => {
      if (!pickingPosition || !coord) return;
      setManualPosition({
        latitude: coord.latitude,
        longitude: coord.longitude,
        at: Date.now(),
      });
      setPickingPosition(false);
    },
    [pickingPosition]
  );

  const clearManualPosition = useCallback(() => setManualPosition(null), []);

  const positionChip = (() => {
    if (pickingPosition) {
      return { text: 'Touchez la carte à votre position réelle (annuler)', color: '#6A1B9A', action: 'cancel' };
    }
    if (!activeLocation || activeLocation.cached) {
      return { text: 'Recherche de votre position…', color: '#607D8B', action: null };
    }
    if (activeLocation.manual) {
      return { text: 'Position manuelle · Revenir au GPS', color: '#6A1B9A', action: 'gps' };
    }
    if (activeLocation.phone) {
      return { text: 'GPS du téléphone', color: '#2E7D32', action: null };
    }
    const acc = activeLocation.accuracy;
    if (acc == null) return null;
    const m = Math.round(acc);
    if (acc <= 50) return { text: `GPS précis · ±${m} m`, color: '#2E7D32', action: null };
    if (acc <= 150) return { text: `GPS · ±${m} m`, color: '#F59E0B', action: null };
    return { text: `Position approximative ±${m} m · Corriger`, color: '#D32F2F', action: 'pick' };
  })();

  const onChipPress = useCallback(() => {
    if (!positionChip?.action) return;
    if (positionChip.action === 'gps') setManualPosition(null);
    else if (positionChip.action === 'pick') setPickingPosition(true);
    else if (positionChip.action === 'cancel') setPickingPosition(false);
  }, [positionChip?.action]);

  return {
    activeLocation,
    therapistPosition,
    hasRealPosition,
    permissionGranted,
    errorMsg,
    isLocating,
    startTracking,
    stopTracking,
    positionChip,
    onChipPress,
    pickingPosition,
    setPickingPosition,
    handleMapPress,
    manualPosition,
    clearManualPosition,
  };
}