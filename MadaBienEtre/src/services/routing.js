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
 * ✅ Calculer un itineraire complet (Google Directions API) — "Calcul trajet"
 * @param {number} lat1 - Latitude depart
 * @param {number} lng1 - Longitude depart
 * @param {number} lat2 - Latitude arrivee
 * @param {number} lng2 - Longitude arrivee
 * @param {string} mode - driving, walking, bicycling, transit
 * @param {boolean} alternatives - alternatives=true
 * @returns {Promise<{coordinates: Array, distance: number, distanceText: string, duration: number, durationText: string, steps: Array, polyline: string} | null>}
 */
export const calculateRoute = async (lat1, lng1, lat2, lng2, mode = 'driving', alternatives = false) => {
  try {
    const response = await axios.get(GOOGLE_DIRECTIONS_URL, {
      params: {
        origin: `${lat1},${lng1}`,
        destination: `${lat2},${lng2}`,
        key: GOOGLE_MAPS_API_KEY,
        mode,
        alternatives: alternatives ? 'true' : 'false',
        units: 'metric',
      },
      timeout: 15000,
    });

    if (response.data.status === 'OK' && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const leg = route.legs[0];
      // ✅ Extraire les coordonnées du polyline
      const polyline = route.overview_polyline?.points || '';
      const coordinates = decodePolyline(polyline);

      return {
        coordinates,
        distance: leg.distance.value / 1000, // km
        distanceText: leg.distance.text,
        duration: leg.duration.value / 60, // minutes
        durationText: leg.duration.text,
        steps: leg.steps.map((step) => ({
          instruction: step.html_instructions,
          distance: step.distance.text,
          duration: step.duration.text,
          latitude: step.start_location.lat,
          longitude: step.start_location.lng,
        })),
        polyline,
        summary: route.summary || '',
        bounds: route.bounds,
        waypoints: route.waypoint_order || [],
      };
    }

    console.log('❌ Directions status:', response.data.status);
    return null;
  } catch (error) {
    console.error('❌ Route calculation error:', error.message);
    return null;
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
};
