// src/hooks/useSmoothPosition.js
// ============================================================
// ✅ Mouvement FLUIDE du marqueur.
// Le GPS / WebSocket donne une position ~1 fois par seconde : sans
// lissage le marqueur "saute" de point en point. Ce hook interpole
// (animation linéaire) entre la position précédente et la nouvelle en
// `duration` ms, ~12 images/s, pour que le marqueur GLISSE sur la route.
//
// - Premier point : affiché tel quel (pas d'animation).
// - Saut > 500 m (reconnexion, téléportation) : on "snap" directement.
// - Renvoie null tant qu'il n'y a pas de position.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Web : 12 images/s ; mobile : 8 (le marqueur natif coûte plus cher)
const FPS = Platform.OS === 'web' ? 12 : 8;
const SNAP_DISTANCE_KM = 0.5;

const roughKm = (a, b) => {
  const dLat = (b.latitude - a.latitude) * 111;
  const dLng =
    (b.longitude - a.longitude) * 111 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

export default function useSmoothPosition(target, duration = 950) {
  const [position, setPosition] = useState(target || null);
  const currentRef = useRef(target || null);

  const lat = target?.latitude;
  const lng = target?.longitude;

  useEffect(() => {
    if (lat == null || lng == null) {
      currentRef.current = null;
      setPosition(null);
      return undefined;
    }

    const to = { latitude: lat, longitude: lng };
    const from = currentRef.current;

    if (!from || roughKm(from, to) > SNAP_DISTANCE_KM) {
      currentRef.current = to;
      setPosition(to);
      return undefined;
    }

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / duration);
      const next = {
        latitude: from.latitude + (to.latitude - from.latitude) * t,
        longitude: from.longitude + (to.longitude - from.longitude) * t,
      };
      currentRef.current = next;
      setPosition(next);
      if (t >= 1) clearInterval(timer);
    }, 1000 / FPS);

    return () => clearInterval(timer);
  }, [lat, lng, duration]);

  return position;
}