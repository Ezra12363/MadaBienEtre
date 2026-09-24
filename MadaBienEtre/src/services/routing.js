// src/services/routing.js
import axios from 'axios';
import { Platform, Linking } from 'react-native';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_DISTANCE_MATRIX_URL,
  GOOGLE_DIRECTIONS_URL,
} from '../config/googleMaps';

// ✅ Serveur public OSRM (routage OpenStreetMap, gratuit, sans clé).
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * ✅ "Distance automatique" — Haversine (calcul local, gratis, tsy
 * mila API call, ary mandeha na offline aza). Ampiasaina ho
 * distance an-tsipiriany avy hatrany (real-time) isaky ny miova
 * ny localisation-n'ny mpampiasa, alohan'ny hampiasana ny
 * Distance Matrix API (izay mila call, kely kokoa fa mety
 * hisy frais/limite quota).
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance en km
 */
export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  if (
    lat1 == null || lng1 == null || lat2 == null || lng2 == null ||
    Number.isNaN(lat1) || Number.isNaN(lng1) || Number.isNaN(lat2) || Number.isNaN(lng2)
  ) {
    return null;
  }
  const R = 6371; // rayon terrestre en km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * ✅ Calcul de distance automatique pour une liste de points (ex: tous
 * les thérapeutes) par rapport à une position de référence (ex: la
 * position GPS de l'utilisateur). Utilise Haversine — instantané,
 * aucun appel réseau, appelé automatiquement à chaque changement de
 * position (voir useLocationTracking).
 * @param {{latitude:number, longitude:number}} origin
 * @param {Array<{coordinate:{latitude:number, longitude:number}}>} points
 * @returns {Array} points enrichis avec `distance` (km), triés du plus proche au plus loin
 */
export const computeAutoDistances = (origin, points = []) => {
  if (!origin) return points;
  return points
    .map((p) => {
      const coord = p.coordinate || p;
      const distance = haversineDistance(origin.latitude, origin.longitude, coord.latitude, coord.longitude);
      return { ...p, distance: distance != null ? Number(distance.toFixed(2)) : p.distance };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
};

/**
 * ✅ Calculer la distance précise entre deux points (Google Distance Matrix API)
 * Ampiasaina rehefa mila valeur "officielle" Google (miaraka amin'ny trafic
 * sy ny lalana tena ho aleha), fa tsy Haversine fotsiny.
 * @param {number} lat1 - Latitude depart
 * @param {number} lng1 - Longitude depart
 * @param {number} lat2 - Latitude arrivee
 * @param {number} lng2 - Longitude arrivee
 * @param {string} mode - driving, walking, bicycling, transit
 * @returns {Promise<{distance: number, distanceText: string, duration: number, durationText: string} | null>}
 */
export const calculateDistance = async (lat1, lng1, lat2, lng2, mode = 'driving') => {
  try {
    const response = await axios.get(GOOGLE_DISTANCE_MATRIX_URL, {
      params: {
        origins: `${lat1},${lng1}`,
        destinations: `${lat2},${lng2}`,
        key: GOOGLE_MAPS_API_KEY,
        units: 'metric',
        mode,
      },
      timeout: 10000,
    });

    if (response.data.status === 'OK') {
      const element = response.data.rows[0]?.elements[0];
      if (element && element.status === 'OK') {
        return {
          distance: element.distance.value / 1000, // km
          distanceText: element.distance.text,
          duration: element.duration.value / 60, // minutes
          durationText: element.duration.text,
        };
      }
    }

    console.log('❌ Distance Matrix status:', response.data.status);
    // ✅ Fallback: Haversine raha tsy mahazo valiny avy amin'ny API (quota, réseau, ...)
    const fallback = haversineDistance(lat1, lng1, lat2, lng2);
    return fallback != null
      ? { distance: fallback, distanceText: formatDistance(fallback), duration: null, durationText: null }
      : null;
  } catch (error) {
    console.error('❌ Distance calculation error:', error.message);
    const fallback = haversineDistance(lat1, lng1, lat2, lng2);
    return fallback != null
      ? { distance: fallback, distanceText: formatDistance(fallback), duration: null, durationText: null }
      : null;
  }
};

/**
 * ✅ Attend que le SDK JavaScript Google Maps (chargé par
 * MapViewWrapper via <script src=".../maps/api/js...">) soit prêt,
 * avec un `DirectionsService` disponible.
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
// ✅ Mémorise le refus de Google (REQUEST_DENIED : facturation non activée,
// API "Directions" non activée, clé restreinte...). Une fois refusé, on ne
// re-sollicite plus Google pendant la session : on passe directement à OSRM
// (gratuit, sans clé), ce qui évite des erreurs répétées dans la console.
let googleDirectionsDenied = false;

const waitForGoogleMapsJS = (timeoutMs = 8000) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.google?.maps?.DirectionsService) {
      resolve(true);
      return;
    }
    const start = Date.now();
    const check = setInterval(() => {
      if (window.google?.maps?.DirectionsService) {
        clearInterval(check);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(check);
        resolve(false);
      }
    }, 200);
  });
};

/**
 * ✅ TRAJET RÉEL SUR LE WEB — via le SDK JavaScript Google Maps
 * (`window.google.maps.DirectionsService`), et non via l'API REST
 * "Directions" appelée en axios.
 *
 * Pourquoi : l'API REST Google Directions n'autorise PAS les
 * requêtes CORS depuis un navigateur — chaque appel axios échouait
 * donc silencieusement en "Network Error" sur le web, et le code
 * retombait systématiquement sur la ligne droite (Haversine) entre
 * le thérapeute et le client, au lieu de suivre les vraies rues.
 * Le SDK JavaScript, lui, n'est pas concerné par cette limite (ce
 * n'est pas un fetch/XHR classique) : il renvoie le tracé réel,
 * avec tous les points de la route (overview_path), exactement
 * comme sur Google Maps.
 * @returns {Promise<object|null>}
 */
const calculateRouteViaDirectionsService = (originLat, originLng, destinationLat, destinationLng, mode, alternatives) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.google?.maps?.DirectionsService) {
      resolve(null);
      return;
    }

    const google = window.google;
    const travelModeMap = {
      driving: google.maps.TravelMode.DRIVING,
      walking: google.maps.TravelMode.WALKING,
      bicycling: google.maps.TravelMode.BICYCLING,
      transit: google.maps.TravelMode.TRANSIT,
    };

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: { lat: originLat, lng: originLng },
        destination: { lat: destinationLat, lng: destinationLng },
        travelMode: travelModeMap[mode] || google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: !!alternatives,
        unitSystem: google.maps.UnitSystem.METRIC,
      },
      (result, status) => {
        if (status !== 'OK' || !result?.routes?.length) {
          console.warn('⚠️ DirectionsService (web) status:', status);
          if (status === 'REQUEST_DENIED' || status === 'OVER_QUERY_LIMIT') {
            googleDirectionsDenied = true;
          }
          resolve(null);
          return;
        }

        const route = result.routes[0];
        const leg = route.legs?.[0];

        if (!leg?.distance || !leg?.duration) {
          resolve(null);
          return;
        }

        // ✅ `overview_path` = TOUS les points de la vraie route
        // (suit les rues), déjà décodés par le SDK — pas besoin de
        // `decodePolyline` ici.
        const coordinates = (route.overview_path || []).map((p) => ({
          latitude: p.lat(),
          longitude: p.lng(),
        }));

        resolve({
          coordinates: coordinates.length > 0
            ? coordinates
            : [
                { latitude: originLat, longitude: originLng },
                { latitude: destinationLat, longitude: destinationLng },
              ],
          distance: leg.distance.value / 1000,
          distanceText: leg.distance.text,
          duration: leg.duration.value / 60,
          durationText: leg.duration.text,
          steps: (leg.steps || []).map((step) => ({
            instruction: step.instructions || '',
            distance: step.distance?.text || '',
            duration: step.duration?.text || '',
            latitude: step.start_location?.lat(),
            longitude: step.start_location?.lng(),
          })),
          polyline: route.overview_polyline || '',
          summary: route.summary || '',
          bounds: route.bounds
            ? {
                northeast: {
                  lat: route.bounds.getNorthEast().lat(),
                  lng: route.bounds.getNorthEast().lng(),
                },
                southwest: {
                  lat: route.bounds.getSouthWest().lat(),
                  lng: route.bounds.getSouthWest().lng(),
                },
              }
            : null,
          waypoints: route.waypoint_order || [],
          isFallback: false,
        });
      }
    );
  });
};

/**
 * ✅ TRAJET RÉEL VIA OSRM (gratuit, sans clé API, CORS autorisé → marche
 * sur le web ET sur mobile). Sert de secours lorsque Google Directions est
 * refusé (facturation non activée) ou indisponible. Renvoie le vrai tracé
 * qui suit les rues, au même format que Google.
 * NB : le serveur public OSRM ne calcule que la voiture ; pour les autres
 * modes, la distance/durée sont donc celles de la route en voiture.
 * @returns {Promise<object|null>}
 */
const calculateRouteViaOSRM = async (originLat, originLng, destinationLat, destinationLng) => {
  try {
    const url =
      `${OSRM_BASE_URL}/${originLng},${originLat};${destinationLng},${destinationLat}`;

    const response = await axios.get(url, {
      params: { overview: 'full', geometries: 'geojson', steps: 'true' },
      timeout: 12000,
    });

    const route = response.data?.routes?.[0];

    if (response.data?.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
      console.warn('⚠️ OSRM sans résultat:', response.data?.code);
      return null;
    }

    // GeoJSON = [lng, lat]
    const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    const distanceKm = route.distance / 1000;
    const durationMin = route.duration / 60;
    const leg = route.legs?.[0];

    const lats = coordinates.map((c) => c.latitude);
    const lngs = coordinates.map((c) => c.longitude);

    return {
      coordinates,
      distance: distanceKm,
      distanceText: formatDistance(distanceKm),
      duration: durationMin,
      durationText: formatDuration(durationMin),
      steps: (leg?.steps || []).map((step) => ({
        instruction: [step.maneuver?.type, step.maneuver?.modifier, step.name]
          .filter(Boolean)
          .join(' '),
        distance: formatDistance((step.distance || 0) / 1000),
        duration: formatDuration((step.duration || 0) / 60),
        latitude: step.maneuver?.location?.[1],
        longitude: step.maneuver?.location?.[0],
      })),
      polyline: '',
      summary: 'Itinéraire OSRM',
      bounds: {
        northeast: { lat: Math.max(...lats), lng: Math.max(...lngs) },
        southwest: { lat: Math.min(...lats), lng: Math.min(...lngs) },
      },
      waypoints: [],
      isFallback: false,
      source: 'osrm',
    };
  } catch (error) {
    console.warn('⚠️ OSRM indisponible:', error?.message);
    return null;
  }
};

/**
 * ✅ Calculer un itineraire complet (Google Directions API) — "Calcul trajet"
 * @param {number} lat1 - Latitude depart
 * @param {number} lng1 - Longitude depart
 * @param {number} lat2 - Latitude arrivee
 * @param {number} lng2 - Longitude arrivee
 * @param {string} mode - driving, walking, bicycling, transit
 * @param {boolean} alternatives - alternatives=true
 * @returns {Promise<{coordinates: Array, distance: number, distanceText: string, duration: number, durationText: string, steps: Array, polyline: string} | null>}
 */
export const calculateRoute = async (
  lat1,
  lng1,
  lat2,
  lng2,
  mode = 'driving',
  alternatives = false
) => {
  // Validation des coordonnées avant tout appel réseau.
  const coordinatesAreValid = [lat1, lng1, lat2, lng2].every(
    (value) => value != null && Number.isFinite(Number(value))
  );

  if (!coordinatesAreValid) {
    console.warn('⚠️ Invalid route coordinates:', { lat1, lng1, lat2, lng2 });
    return null;
  }

  const originLat = Number(lat1);
  const originLng = Number(lng1);
  const destinationLat = Number(lat2);
  const destinationLng = Number(lng2);

  // Fallback local : fonctionne même si Google Directions est indisponible
  // (Web/CORS, clé API, quota, réseau, etc.).
  const createFallbackRoute = () => {
    const distance = haversineDistance(
      originLat,
      originLng,
      destinationLat,
      destinationLng
    );

    if (distance == null) return null;

    const duration = estimateDuration(distance, mode);

    return {
      coordinates: [
        { latitude: originLat, longitude: originLng },
        { latitude: destinationLat, longitude: destinationLng },
      ],
      distance,
      distanceText: formatDistance(distance),
      duration,
      durationText: formatDuration(duration),
      steps: [],
      polyline: '',
      summary: 'Trajet estimé',
      bounds: {
        northeast: {
          lat: Math.max(originLat, destinationLat),
          lng: Math.max(originLng, destinationLng),
        },
        southwest: {
          lat: Math.min(originLat, destinationLat),
          lng: Math.min(originLng, destinationLng),
        },
      },
      waypoints: [],
      isFallback: true,
    };
  };

  // ✅ SUR LE WEB : on essaie D'ABORD le vrai tracé via le SDK
  // JavaScript (DirectionsService) — c'est lui qui fait suivre la
  // ligne rouge aux vraies rues, contrairement à l'appel REST
  // ci-dessous qui échoue à cause de CORS dans un navigateur.
  if (Platform.OS === 'web' && !googleDirectionsDenied) {
    const jsApiReady = await waitForGoogleMapsJS();

    if (jsApiReady) {
      const jsRoute = await calculateRouteViaDirectionsService(
        originLat,
        originLng,
        destinationLat,
        destinationLng,
        mode,
        alternatives
      );

      if (jsRoute && jsRoute.coordinates?.length > 1) {
        return jsRoute;
      }

      console.warn('⚠️ DirectionsService (web) sans résultat exploitable, tentative REST...');
    } else {
      console.warn('⚠️ Google Maps JS pas encore chargé (web), tentative REST...');
    }
  }

  // ✅ Google refusé (facturation non activée, clé restreinte...) ou web
  // (l'API REST Google est bloquée par CORS dans un navigateur) : on ne
  // tente pas l'appel REST inutile, on passe directement à OSRM, puis à la
  // ligne droite en dernier recours.
  if (Platform.OS === 'web' || googleDirectionsDenied || !GOOGLE_MAPS_API_KEY) {
    const osrmRoute = await calculateRouteViaOSRM(
      originLat,
      originLng,
      destinationLat,
      destinationLng
    );

    return osrmRoute || createFallbackRoute();
  }

  try {
    const response = await axios.get(GOOGLE_DIRECTIONS_URL, {
      params: {
        origin: `${originLat},${originLng}`,
        destination: `${destinationLat},${destinationLng}`,
        key: GOOGLE_MAPS_API_KEY,
        mode,
        alternatives: alternatives ? 'true' : 'false',
        units: 'metric',
      },
      timeout: 15000,
    });

    if (
      response.data?.status === 'OK' &&
      Array.isArray(response.data?.routes) &&
      response.data.routes.length > 0
    ) {
      const route = response.data.routes[0];
      const leg = route.legs?.[0];

      if (!leg?.distance || !leg?.duration) {
        console.warn('⚠️ Google Directions response incomplete.');
        return (
          (await calculateRouteViaOSRM(originLat, originLng, destinationLat, destinationLng)) ||
          createFallbackRoute()
        );
      }

      const polyline = route.overview_polyline?.points || '';
      const coordinates = decodePolyline(polyline);

      return {
        coordinates:
          coordinates.length > 0
            ? coordinates
            : [
                { latitude: originLat, longitude: originLng },
                { latitude: destinationLat, longitude: destinationLng },
              ],
        distance: leg.distance.value / 1000,
        distanceText: leg.distance.text,
        duration: leg.duration.value / 60,
        durationText: leg.duration.text,
        steps: (leg.steps || []).map((step) => ({
          instruction: step.html_instructions || '',
          distance: step.distance?.text || '',
          duration: step.duration?.text || '',
          latitude: step.start_location?.lat,
          longitude: step.start_location?.lng,
        })),
        polyline,
        summary: route.summary || '',
        bounds: route.bounds,
        waypoints: route.waypoint_order || [],
        isFallback: false,
      };
    }

    console.warn(
      '⚠️ Google Directions unavailable:',
      response.data?.status || 'UNKNOWN_STATUS',
      response.data?.error_message || ''
    );

    if (response.data?.status === 'REQUEST_DENIED' || response.data?.status === 'OVER_QUERY_LIMIT') {
      googleDirectionsDenied = true;
    }

    return (
      (await calculateRouteViaOSRM(originLat, originLng, destinationLat, destinationLng)) ||
      createFallbackRoute()
    );
  } catch (error) {
    // "Network Error" est fréquent sur Expo Web lorsque l'endpoint Google
    // bloque la requête côté navigateur (CORS), ou si le réseau/quotas/API
    // ne sont pas disponibles. On ne laisse plus l'erreur casser l'écran.
    const message = error?.message || 'Unknown network error';

    console.warn(
      '⚠️ Google route unavailable, using local fallback:',
      message
    );

    return (
      (await calculateRouteViaOSRM(originLat, originLng, destinationLat, destinationLng)) ||
      createFallbackRoute()
    );
  }
};

/**
 * ✅ ITINÉRAIRES MULTIPLES (proposition d'itinéraires) — le plus rapide
 * + les routes alternatives, chacune avec sa distance, sa durée EN
 * VOITURE et sa durée À PIED.
 *
 * Ordre d'essai : Google (JS SDK sur le web / REST sur mobile) → OSRM
 * (gratuit) → ligne droite estimée (dernier recours, `isFallback`).
 *
 * NB : la durée en voiture vient du fournisseur (Google/OSRM) ; la durée
 * à pied est estimée à 5 km/h (estimateDuration) car OSRM public ne
 * calcule que la voiture.
 */
const buildRouteOption = ({
  coordinates,
  distanceKm,
  durationMin,
  summary = '',
  isFallback = false,
  source = 'google',
}) => {
  const walkingMin = estimateDuration(distanceKm, 'walking');

  return {
    coordinates,
    distance: distanceKm,
    distanceText: formatDistance(distanceKm),
    // `duration` = voiture (compatibilité avec calculateRoute)
    duration: durationMin,
    durationText: formatDuration(durationMin),
    drivingDuration: durationMin,
    drivingDurationText: formatDuration(durationMin),
    walkingDuration: walkingMin,
    walkingDurationText: formatDuration(walkingMin),
    summary,
    steps: [],
    isFallback,
    source,
  };
};

const finalizeRouteOptions = (list) => {
  const seen = new Set();
  const unique = [];

  list.forEach((route) => {
    const key = `${route.distance.toFixed(2)}-${Math.round(route.duration)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(route);
    }
  });

  unique.sort((a, b) => a.duration - b.duration);

  const shortest = unique.reduce(
    (best, route) => (route.distance < best.distance ? route : best),
    unique[0]
  );

  return unique.slice(0, 4).map((route, index) => ({
    ...route,
    id: `route-${index}`,
    tag: route.isFallback
      ? 'Trajet estimé'
      : index === 0
        ? 'Le plus rapide'
        : route === shortest
          ? 'Le plus court'
          : `Alternative ${index}`,
  }));
};

const fetchGoogleJsRoutes = (oLat, oLng, dLat, dLng) =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.google?.maps?.DirectionsService) {
      resolve(null);
      return;
    }

    const google = window.google;

    new google.maps.DirectionsService().route(
      {
        origin: { lat: oLat, lng: oLng },
        destination: { lat: dLat, lng: dLng },
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
        unitSystem: google.maps.UnitSystem.METRIC,
      },
      (result, status) => {
        if (status !== 'OK' || !result?.routes?.length) {
          console.warn('⚠️ DirectionsService (web, alternatives) status:', status);
          if (status === 'REQUEST_DENIED' || status === 'OVER_QUERY_LIMIT') {
            googleDirectionsDenied = true;
          }
          resolve(null);
          return;
        }

        const list = result.routes
          .map((route) => {
            const leg = route.legs?.[0];
            const coordinates = (route.overview_path || []).map((pt) => ({
              latitude: pt.lat(),
              longitude: pt.lng(),
            }));

            if (!leg?.distance || !leg?.duration || coordinates.length < 2) return null;

            return buildRouteOption({
              coordinates,
              distanceKm: leg.distance.value / 1000,
              durationMin: leg.duration.value / 60,
              summary: route.summary || '',
              source: 'google',
            });
          })
          .filter(Boolean);

        resolve(list.length ? list : null);
      }
    );
  });

const fetchGoogleRestRoutes = async (oLat, oLng, dLat, dLng) => {
  try {
    const response = await axios.get(GOOGLE_DIRECTIONS_URL, {
      params: {
        origin: `${oLat},${oLng}`,
        destination: `${dLat},${dLng}`,
        key: GOOGLE_MAPS_API_KEY,
        mode: 'driving',
        alternatives: 'true',
        units: 'metric',
      },
      timeout: 15000,
    });

    const status = response.data?.status;

    if (status !== 'OK' || !Array.isArray(response.data?.routes)) {
      console.warn('⚠️ Google Directions (alternatives):', status, response.data?.error_message || '');
      if (status === 'REQUEST_DENIED' || status === 'OVER_QUERY_LIMIT') {
        googleDirectionsDenied = true;
      }
      return null;
    }

    const list = response.data.routes
      .map((route) => {
        const leg = route.legs?.[0];
        const coordinates = decodePolyline(route.overview_polyline?.points || '');

        if (!leg?.distance || !leg?.duration || coordinates.length < 2) return null;

        return buildRouteOption({
          coordinates,
          distanceKm: leg.distance.value / 1000,
          durationMin: leg.duration.value / 60,
          summary: route.summary || '',
          source: 'google',
        });
      })
      .filter(Boolean);

    return list.length ? list : null;
  } catch (error) {
    console.warn('⚠️ Google Directions (alternatives) indisponible:', error?.message);
    return null;
  }
};

const fetchOsrmRoutes = async (oLat, oLng, dLat, dLng) => {
  try {
    const response = await axios.get(
      `${OSRM_BASE_URL}/${oLng},${oLat};${dLng},${dLat}`,
      {
        params: { overview: 'full', geometries: 'geojson', alternatives: 'true' },
        timeout: 12000,
      }
    );

    if (response.data?.code !== 'Ok' || !Array.isArray(response.data?.routes)) {
      return null;
    }

    const list = response.data.routes
      .map((route) => {
        const coordinates = (route.geometry?.coordinates || []).map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        }));

        if (coordinates.length < 2) return null;

        return buildRouteOption({
          coordinates,
          distanceKm: route.distance / 1000,
          durationMin: route.duration / 60,
          summary: route.legs?.[0]?.summary || '',
          source: 'osrm',
        });
      })
      .filter(Boolean);

    return list.length ? list : null;
  } catch (error) {
    console.warn('⚠️ OSRM (alternatives) indisponible:', error?.message);
    return null;
  }
};

/**
 * @returns {Promise<Array>} liste d'itinéraires triés du plus rapide au plus
 * lent : { id, tag, coordinates, distance, distanceText, drivingDuration,
 * drivingDurationText, walkingDuration, walkingDurationText, summary,
 * isFallback } — ou [] si les coordonnées sont invalides.
 */
export const calculateAlternativeRoutes = async (lat1, lng1, lat2, lng2) => {
  const valid = [lat1, lng1, lat2, lng2].every(
    (value) => value != null && Number.isFinite(Number(value))
  );

  if (!valid) {
    console.warn('⚠️ Invalid route coordinates:', { lat1, lng1, lat2, lng2 });
    return [];
  }

  const oLat = Number(lat1);
  const oLng = Number(lng1);
  const dLat = Number(lat2);
  const dLng = Number(lng2);

  let routes = null;

  if (!googleDirectionsDenied) {
    if (Platform.OS === 'web') {
      if (await waitForGoogleMapsJS()) {
        routes = await fetchGoogleJsRoutes(oLat, oLng, dLat, dLng);
      }
    } else if (GOOGLE_MAPS_API_KEY) {
      routes = await fetchGoogleRestRoutes(oLat, oLng, dLat, dLng);
    }
  }

  if (!routes?.length) {
    routes = await fetchOsrmRoutes(oLat, oLng, dLat, dLng);
  }

  if (!routes?.length) {
    const distance = haversineDistance(oLat, oLng, dLat, dLng);

    if (distance == null) return [];

    routes = [
      buildRouteOption({
        coordinates: [
          { latitude: oLat, longitude: oLng },
          { latitude: dLat, longitude: dLng },
        ],
        distanceKm: distance,
        durationMin: estimateDuration(distance, 'driving'),
        summary: 'Trajet estimé',
        isFallback: true,
        source: 'local',
      }),
    ];
  }

  return finalizeRouteOptions(routes);
};

/**
 * ✅ Decoder un polyline Google Maps
 * @param {string} encoded - Polyline encodé
 * @returns {Array<{latitude: number, longitude: number}>}
 */
export const decodePolyline = (encoded) => {
  if (!encoded) return [];
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
};

/**
 * ✅ Ouvrir Google Maps avec itineraire
 * @param {number} toLat - Latitude destination
 * @param {number} toLng - Longitude destination
 * @param {string} destinationName - Nom de la destination
 */
export const openGoogleMaps = (toLat, toLng, destinationName = 'Destination') => {
  const url = `https://www.google.com/maps/search/?api=1&query=${toLat},${toLng}&query_place_id=${destinationName}`;
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url).catch((err) => {
      console.error('❌ Error opening Google Maps:', err);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${toLat},${toLng}`);
    });
  }
};

/**
 * ✅ Ouvrir Google Maps avec directions depuis la position actuelle
 * @param {number} toLat - Latitude destination
 * @param {number} toLng - Longitude destination
 * @param {string} destinationName - Nom de la destination
 * @param {string} mode - driving, walking, transit
 */
export const openDirections = (toLat, toLng, destinationName = 'Destination', mode = 'driving') => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${toLat},${toLng}&destination_place_id=&travelmode=${mode}`;
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url).catch((err) => {
      console.error('❌ Error opening directions:', err);
      openGoogleMaps(toLat, toLng, destinationName);
    });
  }
};

/**
 * ✅ Calculer le prix estimé en fonction de la distance
 * @param {number} distance - Distance en km
 * @param {number} basePrice - Prix de base
 * @param {number} pricePerKm - Prix par km
 * @param {number} minPrice - Prix minimum
 * @param {number} maxPrice - Prix maximum
 * @returns {number}
 */
export const calculateEstimatedPrice = (distance, basePrice = 25000, pricePerKm = 5000, minPrice = 30000, maxPrice = 150000) => {
  let price = basePrice + distance * pricePerKm;
  price = Math.round(price / 1000) * 1000;
  price = Math.max(minPrice, Math.min(maxPrice, price));
  return price;
};

/**
 * ✅ Estimer le temps de trajet en fonction de la distance et du mode
 * @param {number} distance - Distance en km
 * @param {string} mode - driving, walking, bicycling, transit
 * @returns {number} - Temps en minutes
 */
export const estimateDuration = (distance, mode = 'driving') => {
  const speeds = { driving: 40, walking: 5, bicycling: 15, transit: 20 };
  const speed = speeds[mode] || 30;
  return (distance / speed) * 60;
};

/**
 * ✅ Formatter la distance
 * @param {number} distance - Distance en km
 * @returns {string}
 */
export const formatDistance = (distance) => {
  if (distance == null || Number.isNaN(distance)) return 'N/A';
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(1)} km`;
};

/**
 * ✅ Calculer le "bearing" (cap / direction en degrés, 0 = Nord,
 * 90 = Est, ...) entre deux points GPS. Ampiasaina hampitodika ny
 * icône fleche (arrow) amin'ny lalana, mba hisehoany tsara ny
 * "direction" mankany amin'ny client.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} cap en degrés (0-360)
 */
export const computeBearing = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
};

/**
 * ✅ Extraire, le long d'un tracé (liste de coordonnées), quelques
 * points régulièrement espacés avec leur "bearing" (cap), pour
 * afficher des flèches de direction sur la carte NATIVE (iOS/Android)
 * — mitodika mankany amin'ny client foana ireo fleche ireo.
 * (Sur le web, Google Maps gère nativement les flèches via les
 * "icons" d'un Polyline — voir MapViewWrapper.)
 * @param {Array<{latitude:number, longitude:number}>} coordinates
 * @param {number} maxArrows - nombre maximum de flèches à générer
 * @returns {Array<{latitude:number, longitude:number, bearing:number}>}
 */
export const getRouteArrowPoints = (coordinates = [], maxArrows = 6) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
  const step = Math.max(1, Math.floor(coordinates.length / (maxArrows + 1)));
  const arrows = [];
  for (let i = step; i < coordinates.length - 1; i += step) {
    const from = coordinates[i - 1];
    const to = coordinates[i + 1] || coordinates[i];
    const bearing = computeBearing(from.latitude, from.longitude, to.latitude, to.longitude);
    arrows.push({
      latitude: coordinates[i].latitude,
      longitude: coordinates[i].longitude,
      bearing,
    });
  }
  return arrows;
};

/**
 * ✅ Formatter la durée
 * @param {number} minutes - Durée en minutes
 * @returns {string}
 */
export const formatDuration = (minutes) => {
  if (minutes == null || Number.isNaN(minutes)) return 'N/A';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}min`;
};

// ✅ Export par défaut
export default {
  haversineDistance,
  computeAutoDistances,
  calculateDistance,
  calculateRoute,
  calculateAlternativeRoutes,
  decodePolyline,
  openGoogleMaps,
  openDirections,
  calculateEstimatedPrice,
  estimateDuration,
  formatDistance,
  formatDuration,
  computeBearing,
  getRouteArrowPoints,
};