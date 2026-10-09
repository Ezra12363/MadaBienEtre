// src/components/map/LiveRouteMap.js
// ============================================================
// ✅ Carte "suivi en direct" PARTAGÉE par l'écran thérapeute
// (NavigationScreen) et l'écran client (TrackingScreen) => rendu
// IDENTIQUE des deux côtés :
//   - marqueur = POINT centré sur la position GPS RÉELLE du thérapeute
//     (cercle de précision + flèche de direction quand il roule),
//   - ligne ROUGE PLEINE qui suit la vraie route (flèches + halo blanc),
//     qui DÉMARRE exactement sous le marqueur et se "consomme" au fur et
//     à mesure qu'il avance vers l'adresse du client,
//   - pointillés entre la fin de la route et l'adresse exacte,
//   - marqueur de destination.
//
// Le marqueur n'est PLUS collé à la route : il est à la position réelle
// du GPS (seulement lissé entre deux relevés pour glisser au lieu de
// sauter). La position est rafraîchie chaque seconde.
//
// ANDROID : redessiner une Polyline native 12 fois/s la fait clignoter ->
// sur mobile la ligne est mise à jour ~4x/s (le marqueur glisse en continu).
// Web (Google Maps JS) : la ligne est mise à jour en place (setPath).
// ============================================================
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import MapView from './MapViewWrapper';
import useSmoothPosition from '../../hooks/useSmoothPosition';
import { projectOnRoute, trimRouteFromPosition } from '../../utils/routeTrim';

const NAV_SNAP_METERS = 30; // en mode navigation : collé à la route si < 30 m
const NAV_MIN_SPEED = 1.5; // m/s : en dessous, on considère qu'il est à l'arrêt

const bearingBetween = (a, b) => {
  const r = Math.PI / 180;
  const y = Math.sin((b.longitude - a.longitude) * r) * Math.cos(b.latitude * r);
  const x =
    Math.cos(a.latitude * r) * Math.sin(b.latitude * r) -
    Math.sin(a.latitude * r) * Math.cos(b.latitude * r) * Math.cos((b.longitude - a.longitude) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
};

// Interpolation par le plus court chemin (350° -> 10° = +20°, pas -340°)
const lerpAngle = (from, to, k) => {
  const d = ((to - from + 540) % 360) - 180;
  return (from + d * k + 360) % 360;
};

const IS_WEB = Platform.OS === 'web';
const NATIVE_LINE_THROTTLE_MS = 250;

const useThrottledValue = (value, ms) => {
  const [throttled, setThrottled] = useState(value);
  const lastRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (ms <= 0) {
      setThrottled(value);
      return undefined;
    }
    const wait = Math.max(0, ms - (Date.now() - lastRef.current));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastRef.current = Date.now();
      setThrottled(value);
    }, wait);
    return () => clearTimeout(timerRef.current);
  }, [value, ms]);

  return throttled;
};

const LiveRouteMap = forwardRef(
  (
    {
      mover, // position RÉELLE (brute, ~1 Hz) du thérapeute : {latitude, longitude}
      moverHeading = null, // cap en degrés (0 = nord) — flèche de direction
      moverSpeed = null, // vitesse en m/s
      moverAccuracy = null, // précision GPS en mètres — cercle bleu
      moverTitle = 'Thérapeute',
      moverDescription = 'Position actuelle',
      moverColor = '#1976D2',

      destination, // adresse du client : {latitude, longitude}
      destinationTitle = 'Destination',
      destinationDescription,
      destinationColor = '#2E7D32',

      routeCoordinates, // tracé complet (vraie route) calculé par routing.js
      routeIsFallback = false,
      routeColor = '#E53935',
      routeWidth = 6,

      navMode = false, // style Google Maps Navigation (chevron + halo, collé à la route)
      smoothMs = 800,
      ...mapProps // initialRegion, userLocation, onMapReady, style, ...
    },
    ref
  ) => {
    // Position affichée = position GPS réelle, juste lissée (glisse en ~0,8 s)
    const markerPosition = useSmoothPosition(mover, smoothMs);

    const hasRealRoute =
      !routeIsFallback &&
      Array.isArray(routeCoordinates) &&
      routeCoordinates.length > 1;

    // --- Mode navigation : accroche à la route + cap lissé -------------
    const headingRef = useRef(null);
    const nav = useMemo(() => {
      if (!markerPosition) return { position: null, heading: null };
      const moving = (moverSpeed ?? 0) > NAV_MIN_SPEED;
      let position = markerPosition;
      let target = Number.isFinite(moverHeading) ? moverHeading : null;

      if (navMode && hasRealRoute) {
        const proj = projectOnRoute(routeCoordinates, markerPosition);
        if (proj && proj.distanceKm * 1000 <= NAV_SNAP_METERS && moving) {
          position = proj.point;
          const a = routeCoordinates[proj.index];
          const b = routeCoordinates[proj.index + 1];
          if (a && b) target = bearingBetween(a, b);
        }
      }
      if (target != null && (moving || headingRef.current == null)) {
        headingRef.current =
          headingRef.current == null ? target : lerpAngle(headingRef.current, target, 0.35);
      }
      return { position, heading: headingRef.current };
    }, [markerPosition, navMode, hasRealRoute, routeCoordinates, moverHeading, moverSpeed]);

    const shownPosition = nav.position;

    // --- Ligne : démarre EXACTEMENT sous le marqueur ------------------
    const lineStart = useThrottledValue(
      shownPosition,
      IS_WEB ? 0 : NATIVE_LINE_THROTTLE_MS
    );

    const route = useMemo(() => {
      if (!routeCoordinates || routeCoordinates.length < 2) return null;
      if (!lineStart) return routeCoordinates;

      // Ligne de secours (pas de vraie route) : elle part aussi du marqueur
      if (!hasRealRoute) return [lineStart, ...routeCoordinates.slice(1)];

      // snapKm: 0 -> le point de départ de la ligne est la position réelle
      // (le tracé n'est utilisé que pour savoir quelle partie est déjà faite)
      const trimmed = trimRouteFromPosition(routeCoordinates, lineStart, {
        snapKm: 0,
      });
      // Hors itinéraire (> 200 m) : tracé inchangé, relié en pointillés
      if (trimmed === routeCoordinates) return trimmed;

      return [lineStart, ...trimmed.slice(1)];
    }, [routeCoordinates, hasRealRoute, lineStart]);

    const markers = useMemo(() => {
      const list = [];

      if (destination) {
        list.push({
          id: 'live-destination',
          coordinate: destination,
          title: destinationTitle,
          description: destinationDescription,
          pinColor: destinationColor,
        });
      }

      if (shownPosition) {
        list.push({
          id: 'live-mover',
          kind: 'position', // point bleu centré + précision + direction
          nav: navMode, // chevron dans un halo (style Google Maps)
          coordinate: shownPosition,
          title: moverTitle,
          description: moverDescription,
          pinColor: moverColor,
          heading: navMode ? nav.heading : moverHeading,
          speed: moverSpeed,
          accuracy: moverAccuracy,
        });
      }

      return list;
    }, [
      destination,
      destinationTitle,
      destinationDescription,
      destinationColor,
      shownPosition,
      navMode,
      nav.heading,
      moverTitle,
      moverDescription,
      moverColor,
      moverHeading,
      moverSpeed,
      moverAccuracy,
    ]);

    return (
      <MapView
        ref={ref}
        {...mapProps}
        markers={markers}
        route={route}
        routeColor={routeColor}
        routeWidth={routeWidth}
        routeIsFallback={routeIsFallback}
        routeOrigin={lineStart}
        routeDestination={destination}
        showRouteArrows
      />
    );
  }
);

LiveRouteMap.displayName = 'LiveRouteMap';

export default LiveRouteMap;