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
import { trimRouteFromPosition } from '../../utils/routeTrim';

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

    // --- Ligne : démarre EXACTEMENT sous le marqueur ------------------
    const lineStart = useThrottledValue(
      markerPosition,
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

      if (markerPosition) {
        list.push({
          id: 'live-mover',
          kind: 'position', // point bleu centré + précision + direction
          coordinate: markerPosition,
          title: moverTitle,
          description: moverDescription,
          pinColor: moverColor,
          heading: moverHeading,
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
      markerPosition,
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