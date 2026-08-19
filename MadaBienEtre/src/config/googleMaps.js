// src/config/googleMaps.js
// ============================================
// ✅ Configuration centralisée Google Maps
// Ampiasaina amin'ny fichier rehetra (web, Android, iOS)
// mba tsy hisy duplication ny key na ny constantes.
//
// ⚠️ IMPORTANT (sécurité) : aza avela ho hardcodé mivantana ao
// anaty code ireo API key rehefa efa haparitaka (production).
// Ampiasao .env + app.config.js (expo-constants) toy izao:
//
//   // app.config.js
//   export default {
//     expo: {
//       extra: {
//         googleMapsApiKeyAndroid: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
//         googleMapsApiKeyIos: process.env.GOOGLE_MAPS_API_KEY_IOS,
//         googleMapsApiKeyWeb: process.env.GOOGLE_MAPS_API_KEY_WEB,
//       },
//     },
//   };
//
// Ary ao amin'ny .env (tsy atao commit ao git — ampio .gitignore):
//   GOOGLE_MAPS_API_KEY_ANDROID=xxxx
//   GOOGLE_MAPS_API_KEY_IOS=xxxx
//   GOOGLE_MAPS_API_KEY_WEB=xxxx
// ============================================

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra =
  Constants?.expoConfig?.extra ||
  Constants?.manifest?.extra ||
  {};

// ✅ Fallback amin'ireo key efa nomena raha tsy voahangy ao amin'ny .env
// (tokony hosoloina amin'ny key vaovao rehefa ho production ianao,
// satria efa niseho anaty fichier ireto — mety ho compromised).
const FALLBACK_KEYS = {
  android: 'AIzaSyDYfhgdzPKOF4gQCr040Xi5Y5Qp_IO7p_I',
  ios: 'AIzaSyCipWGbYymVqX7cp9qoZt2TKKJeA_fUdJI',
  web: 'AIzaSyCjN5zFt_vMLuCKL66c0dEfmJDxWSnXLMg',
};

export const GOOGLE_MAPS_API_KEY_ANDROID =
  extra.googleMapsApiKeyAndroid || FALLBACK_KEYS.android;

export const GOOGLE_MAPS_API_KEY_IOS =
  extra.googleMapsApiKeyIos || FALLBACK_KEYS.ios;

export const GOOGLE_MAPS_API_KEY_WEB =
  extra.googleMapsApiKeyWeb || FALLBACK_KEYS.web;

// ✅ Key mifanaraka amin'ny plateforme ampiasaina
export const GOOGLE_MAPS_API_KEY = (() => {
  if (Platform.OS === 'ios') return GOOGLE_MAPS_API_KEY_IOS;
  if (Platform.OS === 'android') return GOOGLE_MAPS_API_KEY_ANDROID;
  return GOOGLE_MAPS_API_KEY_WEB;
})();

// ✅ URLs API samihafa (REST — ampiasaina amin'ny services/*.js)
export const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
export const GOOGLE_PLACES_URL = 'https://maps.googleapis.com/maps/api/place';
export const GOOGLE_DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
export const GOOGLE_DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

// ✅ Région par défaut (Antananarivo) — ampiasaina rehefa mbola tsy
// hita ny localisation-n'ny mpampiasa.
export const DEFAULT_REGION = {
  latitude: -18.8792,
  longitude: 47.5079,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

// ✅ Loko ampiasaina ho an'ny marqueurs (disponible / indisponible)
export const MARKER_COLORS = {
  available: '#22C55E', // vert = disponible
  unavailable: '#EF4444', // rouge = indisponible
  user: '#2563EB', // bleu = position-n'ny mpampiasa
  selected: '#F59E0B', // orange = marker voafantina
};

// ✅ Mode-n'ny sarintany azo isafidianana
export const MAP_TYPES = {
  standard: 'standard', // = roadmap (web)
  satellite: 'satellite',
  hybrid: 'hybrid',
  terrain: 'terrain',
};

export default {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_API_KEY_ANDROID,
  GOOGLE_MAPS_API_KEY_IOS,
  GOOGLE_MAPS_API_KEY_WEB,
  GOOGLE_GEOCODE_URL,
  GOOGLE_PLACES_URL,
  GOOGLE_DISTANCE_MATRIX_URL,
  GOOGLE_DIRECTIONS_URL,
  DEFAULT_REGION,
  MARKER_COLORS,
  MAP_TYPES,
};
