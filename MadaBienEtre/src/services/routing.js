// src/services/routing.js
import axios from 'axios';
import { Platform, Linking } from 'react-native';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_DISTANCE_MATRIX_URL,
  GOOGLE_DIRECTIONS_URL,
} from '../config/googleMaps';

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
  if (Platform.OS === 'web') {
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

  // Si aucune clé Google n'est disponible, inutile de provoquer une erreur
  // réseau : on utilise directement le calcul local.
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ GOOGLE_MAPS_API_KEY absente. Utilisation du trajet local.');
    return createFallbackRoute();
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
        return createFallbackRoute();
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

    return createFallbackRoute();
  } catch (error) {
    // "Network Error" est fréquent sur Expo Web lorsque l'endpoint Google
    // bloque la requête côté navigateur (CORS), ou si le réseau/quotas/API
    // ne sont pas disponibles. On ne laisse plus l'erreur casser l'écran.
    const message = error?.message || 'Unknown network error';

    console.warn(
      '⚠️ Google route unavailable, using local fallback:',
      message
    );

    return createFallbackRoute();
  }
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