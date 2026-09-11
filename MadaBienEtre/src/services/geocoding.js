// src/services/geocoding.js
// ============================================
// ✅ GEOCODING HYBRID — Google Geocoding API (voalohany, marina
// indrindra ho an'ny Lot any Madagasikara) + OpenStreetMap Nominatim
// (fallback, maimaim-poana tanteraka raha misy olana amin'i Google).
//
// ⚠️ POURQUOI CE CHOIX :
// - OpenStreetMap dia MAIMAIM-POANA TANTERAKA fa TSY MANANA angona
//   ampy ho an'ny "Lot" any Madagasikara (matetika "aucun résultat").
// - Google Geocoding API dia MANANA angona BETSAKA KOKOA ho an'i
//   Madagasikara (Local Guides, POI navoitry ny mponina), ary
//   "maimaim-poana" hatramin'ny $200 crédit isam-bolana (~40 000
//   fangatahana geocoding) — ampy tanteraka ho an'ny app kely/moyen.
// - Ity fichier ity dia MANANDRANA an'i Google ALOHA, ary MIVERINA
//   any amin'i OpenStreetMap raha tsy mahazo valiny i Google (ex:
//   quota lany, key tsy mety, na tsy misy connexion internet ho an'ny
//   endpoint googleapis.com).
// ============================================
import axios from 'axios';
import { GOOGLE_MAPS_API_KEY } from '../config/googleMaps';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

// ============================================
// ✅ COUPE-CIRCUIT GOOGLE (évite de spammer la console et le réseau)
//
// "REQUEST_DENIED" est une erreur DE CONFIGURATION (clé invalide,
// Geocoding/Places API non activée, facturation coupée, restrictions
// de la clé) — ce n'est jamais transitoire. Retenter la même requête
// juste après donnera TOUJOURS le même résultat. On désactive donc
// Google pour le reste de la session dès la première occurrence, et
// on retombe directement sur OpenStreetMap sans attendre 4 appels
// réseau inutiles à chaque recherche.
// ============================================
let googleDisabled = false;
let googleDisabledLogged = false;

const disableGoogle = (reason) => {
  googleDisabled = true;
  if (!googleDisabledLogged) {
    googleDisabledLogged = true;
    console.warn(
      `🚫 [Google Geocoding] Désactivé pour cette session (${reason}).\n` +
      '   → Vérifiez dans Google Cloud Console :\n' +
      '     1. La clé API est correcte (config/googleMaps.js)\n' +
      '     2. "Geocoding API" ET "Places API" sont ACTIVÉES\n' +
      '     3. La facturation du projet est active\n' +
      '     4. Les restrictions de la clé (référents HTTP / IP) autorisent ce domaine\n' +
      '   → En attendant, toutes les recherches utilisent OpenStreetMap (gratuit).'
    );
  }
};

// ============================================
// ✅ PARTIE 1 : GOOGLE GEOCODING API (précision maximale)
// ============================================

const mapGoogleResult = (result, originalQuery) => {
  const components = result.address_components || [];

  const getComponent = (type) => {
    const comp = components.find((c) => c.types.includes(type));
    return comp ? comp.long_name : '';
  };

  // ✅ Ny "Lot" any Madagasikara dia matetika voarakitra ao anaty
  // "street_number" na "premise" na "subpremise" arakaraka ny
  // fomba nandraisan'i Google azy io.
  const lot =
    getComponent('street_number') ||
    getComponent('premise') ||
    getComponent('subpremise') ||
    '';

  const rue = getComponent('route') || getComponent('neighborhood') || '';
  const ville =
    getComponent('locality') ||
    getComponent('administrative_area_level_2') ||
    getComponent('sublocality') ||
    '';
  const pays = getComponent('country') || 'Madagascar';
  const codePostal = getComponent('postal_code') || '';

  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    display_name: result.formatted_address || originalQuery,
    place_id: result.place_id,
    lot,
    rue,
    ville,
    pays,
    codePostal,
    address_components: components,
    source: 'google',
    fullAddress: { lot, rue, ville, pays, codePostal, display_name: result.formatted_address || originalQuery },
  };
};

const geocodeWithGoogle = async (address) => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ [Google Geocoding] Clé API manquante, saut vers OpenStreetMap');
    return null;
  }

  // Coupe-circuit actif : on ne retente pas une requête vouée à échouer.
  if (googleDisabled) return null;

  try {
    console.log(`🔍 [Google] Geocoding: "${address}"`);
    const response = await axios.get(GOOGLE_GEOCODE_URL, {
      params: {
        address,
        key: GOOGLE_MAPS_API_KEY,
        components: 'country:MG', // ✅ Filtre Madagascar
        language: 'fr',
      },
      timeout: 12000,
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      console.log(`✅ [Google] Trouvé: "${response.data.results[0].formatted_address}"`);
      return mapGoogleResult(response.data.results[0], address);
    }

    if (response.data.status === 'REQUEST_DENIED') {
      disableGoogle('REQUEST_DENIED');
    } else if (response.data.status === 'OVER_QUERY_LIMIT') {
      console.warn('⚠️ [Google Geocoding] Quota dépassé pour ce mois.');
    } else {
      console.log(`ℹ️ [Google] Statut: ${response.data.status} pour "${address}"`);
    }

    return null;
  } catch (error) {
    console.warn('⚠️ [Google Geocoding] Erreur réseau:', error.message);
    return null;
  }
};

// ============================================
// ✅ PARTIE 2 : OPENSTREETMAP NOMINATIM (fallback maimaim-poana)
// ============================================

const nominatimRequest = async (endpoint, params) => {
  const response = await axios.get(`${NOMINATIM_URL}${endpoint}`, {
    params,
    headers: { 'User-Agent': 'MadaBienEtre/1.0 (contact@madabienetre.com)' },
    timeout: 15000,
  });
  return response.data;
};

const mapNominatimResult = (result, originalQuery) => {
  const addressData = result.address || {};
  const lot = addressData.house_number || '';
  const rue = addressData.road || addressData.pedestrian || addressData.street || '';
  const ville = addressData.city || addressData.town || addressData.village || addressData.municipality || addressData.suburb || '';
  const pays = addressData.country || 'Madagascar';
  const codePostal = addressData.postcode || '';

  return {
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    display_name: result.display_name || originalQuery,
    place_id: result.place_id,
    lot,
    rue,
    ville,
    pays,
    codePostal,
    address_components: [],
    source: 'osm',
    fullAddress: { lot, rue, ville, pays, codePostal, display_name: result.display_name || originalQuery },
  };
};

const geocodeWithNominatim = async (address) => {
  try {
    console.log(`🔍 [OSM] Geocoding: "${address}"`);
    const data = await nominatimRequest('/search', {
      q: address,
      format: 'json',
      addressdetails: 1,
      limit: 1,
      countrycodes: 'mg',
      'accept-language': 'fr',
    });

    if (data && data.length > 0) {
      console.log(`✅ [OSM] Trouvé: "${data[0].display_name}"`);
      return mapNominatimResult(data[0], address);
    }
    return null;
  } catch (error) {
    console.warn('⚠️ [OSM Geocoding] Erreur:', error.message);
    return null;
  }
};

// ============================================
// ✅ PARTIE 3 : FONCTION HYBRIDE PRINCIPALE
// ============================================

/**
 * ✅ Geocoding "hybride" — Google en priorité, OSM en secours.
 * @param {string} address
 * @returns {Promise<Object|null>}
 */
export const geocodeAddress = async (address) => {
  // ✅ 1) Google d'abord (meilleure précision pour Madagascar)
  const googleResult = await geocodeWithGoogle(address);
  if (googleResult) return googleResult;

  // ✅ 2) OpenStreetMap en secours
  console.log('🔄 Google indisponible/sans résultat, tentative OpenStreetMap...');
  const osmResult = await geocodeWithNominatim(address);
  if (osmResult) return osmResult;

  return null;
};

/**
 * ✅ RECHERCHE PROGRESSIVE COMPLÈTE ("fallback en cascade")
 *
 * Dingana:
 *   1) Google — query feno (Lot + Rue + Ville + Pays)
 *   2) OSM — query feno (raha tsy nahitan'i Google na fanoherana)
 *   3) Google/OSM — esorina ilay "Lot XXX" (avelao ny rue/quartier)
 *   4) Google/OSM — quartier/ville ihany
 *   5) Google/OSM — centre-ville Antananarivo (farany, azo antoka)
 *
 * Mariky ho `isApproximate: true` raha toerana akaiky ihany no hita
 * (tsy ny Lot marina, fa ny quartier/ville manodidina).
 */
export const searchLocation = async (query) => {
  if (!query || query.trim().length < 2) return null;

  const rawQuery = query.trim().replace(/\s+/g, ' ');
  const lower = rawQuery.toLowerCase();
  const hasMadagascar = /madagascar|mg\b/i.test(rawQuery);
  const cityNames = [
    'antananarivo', 'tananarive', 'fianarantsoa', 'toamasina',
    'mahajanga', 'antsiranana', 'toliara', 'antsirabe', 'moramanga'
  ];
  const hasCity = cityNames.some((c) => lower.includes(c));
  const hasLot = /\blot\b/i.test(rawQuery);

  // Pour les recherches de type "Lot 123", on ajoute Madagascar/Antananarivo
  // mais on ne supprime JAMAIS le numéro du lot : Google doit recevoir la requête complète.
  const queries = [];
  const addQuery = (q) => {
    const clean = q.trim().replace(/\s+/g, ' ');
    if (clean && !queries.some((x) => x.toLowerCase() === clean.toLowerCase())) queries.push(clean);
  };

  addQuery(rawQuery);
  if (!hasMadagascar) {
    addQuery(`${rawQuery}, Madagascar`);
    if (hasLot && !hasCity) addQuery(`${rawQuery}, Antananarivo, Madagascar`);
  }

  // Variantes utiles pour les lots mal indexés par les fournisseurs.
  if (hasLot) {
    const lotNumber = rawQuery.match(/\blot\s+([a-z0-9][a-z0-9\-\/]*)/i)?.[1];
    if (lotNumber) {
      const rest = rawQuery.replace(/\blot\s+[a-z0-9][a-z0-9\-\/]*\s*/i, '').replace(/^[-,\s]+|[-,\s]+$/g, '');
      if (rest) {
        addQuery(`${lotNumber}, ${rest}, Madagascar`);
        addQuery(`Lot ${lotNumber}, ${rest}, Madagascar`);
      }
    }
  }

  // 1) Google Geocoding : meilleure chance pour les adresses/POI précis.
  for (const q of queries) {
    const result = await geocodeWithGoogle(q);
    if (result) return { ...result, isApproximate: false, searchedQuery: rawQuery };
  }

  // 2) OSM : plusieurs résultats, puis sélection du meilleur résultat.
  for (const q of queries) {
    const result = await geocodeWithNominatim(q);
    if (result) return { ...result, isApproximate: false, searchedQuery: rawQuery };
  }

  // 3) Si le lot exact n'est pas indexé, chercher la rue/quartier sans inventer un lot.
  const withoutLot = rawQuery
    .replace(/\blot\s+[a-z0-9][a-z0-9\-\/]*\s*,?\s*/i, '')
    .replace(/^[-,\s]+|[-,\s]+$/g, '')
    .trim();

  if (withoutLot && withoutLot.toLowerCase() !== rawQuery.toLowerCase()) {
    const q = /madagascar/i.test(withoutLot)
      ? withoutLot
      : `${withoutLot}, Antananarivo, Madagascar`;
    const result = await geocodeWithGoogle(q) || await geocodeWithNominatim(q);
    if (result) {
      return {
        ...result,
        isApproximate: true,
        searchedQuery: rawQuery,
        warning: `Le lot exact "${rawQuery}" n'est pas indexé. Emplacement de la rue/quartier affiché.`
      };
    }
  }

  return null;
};

// ============================================
// ✅ PARTIE 4 : REVERSE GEOCODING (coordonnées -> adresse)
// ============================================

const mapGoogleReverseResult = (result) => mapGoogleResult(result, '');

export const reverseGeocode = async (latitude, longitude) => {
  // ✅ 1) Google d'abord (sauf si désactivé par le coupe-circuit)
  if (GOOGLE_MAPS_API_KEY && !googleDisabled) {
    try {
      console.log(`🔍 [Google] Reverse Geocoding: ${latitude}, ${longitude}`);
      const response = await axios.get(GOOGLE_GEOCODE_URL, {
        params: {
          latlng: `${latitude},${longitude}`,
          key: GOOGLE_MAPS_API_KEY,
          language: 'fr',
        },
        timeout: 12000,
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const mapped = mapGoogleReverseResult(response.data.results[0]);
        return {
          address: mapped.display_name,
          display_name: mapped.display_name,
          place_id: mapped.place_id,
          latitude,
          longitude,
          lot: mapped.lot,
          rue: mapped.rue,
          ville: mapped.ville,
          pays: mapped.pays,
          codePostal: mapped.codePostal,
          source: 'google',
        };
      }

      if (response.data.status === 'REQUEST_DENIED') {
        disableGoogle('REQUEST_DENIED');
      }
    } catch (error) {
      console.warn('⚠️ [Google Reverse] Erreur:', error.message);
    }
  }

  // ✅ 2) OpenStreetMap en secours
  try {
    console.log(`🔍 [OSM] Reverse Geocoding: ${latitude}, ${longitude}`);
    const data = await nominatimRequest('/reverse', {
      lat: latitude,
      lon: longitude,
      format: 'json',
      addressdetails: 1,
      'accept-language': 'fr',
    });

    if (data && data.display_name) {
      const addressData = data.address || {};
      return {
        address: data.display_name,
        display_name: data.display_name,
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lon),
        lot: addressData.house_number || '',
        rue: addressData.road || '',
        ville: addressData.city || addressData.town || addressData.village || addressData.suburb || '',
        pays: addressData.country || 'Madagascar',
        codePostal: addressData.postcode || '',
        source: 'osm',
      };
    }
  } catch (error) {
    console.warn('⚠️ [OSM Reverse] Erreur:', error.message);
  }

  return null;
};

// ============================================
// ✅ PARTIE 5 : AUTOCOMPLETE (suggestions pendant la frappe)
// ============================================

/**
 * ✅ Google Places Autocomplete (précision maximale, "maimaim-poana"
 * hatramin'ny quota) — ampiasaina rehefa manoratra ny mpampiasa, mba
 * hampiseho soso-kevitra AVY HATRANY (tsy miandry ny "Rechercher").
 */
export const getAddressSuggestions = async (input) => {
  if (!input || input.trim().length < 2) return [];

  const text = input.trim().replace(/\s+/g, ' ');
  const suggestions = [];
  const seen = new Set();

  const push = (item) => {
    if (!item?.description) return;
    const key = `${item.description}|${item.latitude}|${item.longitude}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(item);
  };

  // Google Places Autocomplete : utile pour maisons, commerces, hôtels, rues et POI.
  if (GOOGLE_MAPS_API_KEY && !googleDisabled) {
    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
        params: {
          input: text,
          key: GOOGLE_MAPS_API_KEY,
          components: 'country:mg',
          language: 'fr',
        },
        timeout: 8000,
      });

      if (response.data?.status === 'OK') {
        response.data.predictions?.slice(0, 8).forEach((p) => {
          push({
            id: p.place_id,
            description: p.description,
            main_text: p.structured_formatting?.main_text || p.description,
            secondary_text: p.structured_formatting?.secondary_text || '',
            source: 'google',
            place_id: p.place_id,
          });
        });
      } else if (response.data?.status === 'REQUEST_DENIED') {
        disableGoogle('REQUEST_DENIED');
      }
    } catch (error) {
      console.warn('⚠️ [Google Autocomplete] Erreur:', error.message);
    }
  }

  // Pour "Lot ...", OSM peut parfois trouver un house_number même si Google Places
  // ne propose aucune suggestion.
  try {
    const data = await nominatimRequest('/search', {
      q: /\blot\b/i.test(text) && !/madagascar/i.test(text) ? `${text}, Madagascar` : text,
      format: 'json',
      addressdetails: 1,
      limit: 8,
      countrycodes: 'mg',
      'accept-language': 'fr',
    });

    if (Array.isArray(data)) {
      data.forEach((result) => {
        const a = result.address || {};
        const lot = a.house_number || '';
        const rue = a.road || a.pedestrian || a.street || '';
        const ville = a.city || a.town || a.village || a.municipality || a.suburb || '';
        push({
          id: `osm-${result.place_id}`,
          description: result.display_name,
          main_text: lot ? `Lot ${lot}${rue ? `, ${rue}` : ''}` : (result.display_name?.split(',')[0] || text),
          secondary_text: [rue, ville].filter(Boolean).join(', '),
          latitude: Number(result.lat),
          longitude: Number(result.lon),
          place_id: result.place_id,
          lot,
          rue,
          ville,
          source: 'osm',
        });
      });
    }
  } catch (error) {
    console.warn('⚠️ [OSM Autocomplete] Erreur:', error.message);
  }

  return suggestions.slice(0, 8);
};

/**
 * ✅ Détails d'un lieu à partir de son place_id (Google uniquement,
 * car OSM n'a pas de système de "place_id" équivalent réutilisable).
 */
export const getPlaceDetails = async (placeId) => {
  if (!GOOGLE_MAPS_API_KEY || googleDisabled) return null;
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        key: GOOGLE_MAPS_API_KEY,
        fields: 'name,formatted_address,geometry,address_component,place_id',
        language: 'fr',
      },
      timeout: 10000,
    });

    if (response.data.status === 'OK') {
      const result = response.data.result;
      return mapGoogleResult(
        { ...result, formatted_address: result.formatted_address, address_components: result.address_component, place_id: result.place_id },
        result.name
      );
    }
    if (response.data.status === 'REQUEST_DENIED') {
      disableGoogle('REQUEST_DENIED');
    }
    return null;
  } catch (error) {
    console.warn('⚠️ [Place Details] Erreur:', error.message);
    return null;
  }
};

// ============================================
// ✅ PARTIE 6 : UTILITAIRES
// ============================================

export const getAddressFromCoords = async (latitude, longitude) => {
  const result = await reverseGeocode(latitude, longitude);
  return result?.display_name || null;
};

export const formatFullAddress = (fullAddress) => {
  if (!fullAddress) return '';
  const parts = [];
  if (fullAddress.lot) parts.push(`Lot ${fullAddress.lot}`);
  if (fullAddress.rue) parts.push(fullAddress.rue);
  if (fullAddress.ville) parts.push(fullAddress.ville);
  if (fullAddress.codePostal) parts.push(fullAddress.codePostal);
  if (fullAddress.pays) parts.push(fullAddress.pays);
  return parts.join(', ');
};

export const isValidLocation = async (latitude, longitude) => {
  try {
    const result = await reverseGeocode(latitude, longitude);
    return result !== null;
  } catch (error) {
    console.error('❌ Location validation error:', error.message);
    return false;
  }
};

export const getGoogleMapsUrl = (latitude, longitude, zoom = 15) =>
  `https://www.google.com/maps/@${latitude},${longitude},${zoom}z`;

export const getDirectionsUrl = (fromLat, fromLng, toLat, toLng, mode = 'driving') =>
  `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=${mode}`;

// ⚠️ Fonctions conservées pour compatibilité (non utilisées activement)
export const searchPlaceByQuery = async (query) => searchLocation(query);
export const searchNearby = async () => [];
export const searchTherapistsNearby = async () => [];
export const isTherapistPlace = () => false;

export default {
  geocodeAddress,
  searchLocation,
  searchPlaceByQuery,
  reverseGeocode,
  searchNearby,
  searchTherapistsNearby,
  getAddressSuggestions,
  getPlaceDetails,
  isTherapistPlace,
  getGoogleMapsUrl,
  getDirectionsUrl,
  isValidLocation,
  getAddressFromCoords,
  formatFullAddress,
};