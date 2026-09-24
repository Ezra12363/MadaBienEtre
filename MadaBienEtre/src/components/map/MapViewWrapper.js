// src/components/map/MapViewWrapper.js
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GOOGLE_MAPS_API_KEY,
  DEFAULT_REGION,
  MARKER_COLORS,
  MAP_TYPES,
} from '../../config/googleMaps';
import { getRouteArrowPoints, haversineDistance } from '../../services/routing';

let RNMapView = null;
let RNMarker = null;
let RNPolyline = null;
let RNCircle = null;
let PROVIDER_GOOGLE = null;
let RN_MAPS_LOAD_ERROR;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    RNMapView = Maps.default || Maps.MapView;
    RNMarker = Maps.Marker;
    RNPolyline = Maps.Polyline;
    RNCircle = Maps.Circle;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
    if (!RNMapView) {
      RN_MAPS_LOAD_ERROR = "Ny module 'react-native-maps' dia hita fa tsy misy 'default'/'MapView' export.";
      console.warn('❌ react-native-maps tsy azo ampiasaina:', RN_MAPS_LOAD_ERROR);
    }
  } catch (e) {
    RN_MAPS_LOAD_ERROR = e?.message || String(e);
    console.warn('❌ react-native-maps tsy azo ampiasaina:', RN_MAPS_LOAD_ERROR);
  }
}

let googleMapsScriptPromise = null;
const resetGoogleMapsLoader = () => {
  googleMapsScriptPromise = null;
  const existing = document.getElementById('google-maps-js-api');
  if (existing) existing.remove();
  if (window.google) {
    try { delete window.google; } catch (_e) { window.google = undefined; }
  }
};

const loadGoogleMapsScript = (apiKey) => {
  if (typeof window === 'undefined') return Promise.reject(new Error('no-window'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google);
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    let settled = false;
    const fail = (reason) => {
      if (settled) return;
      settled = true;
      googleMapsScriptPromise = null;
      reject(new Error(reason));
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve(window.google);
    };

    window.gm_authFailure = () => fail('auth-failure');
    const timeoutId = setTimeout(() => fail('timeout'), 10000);

    const existing = document.getElementById('google-maps-js-api');
    if (existing) {
      existing.addEventListener('load', () => { clearTimeout(timeoutId); succeed(); });
      existing.addEventListener('error', () => { clearTimeout(timeoutId); fail('network'); });
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js-api';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      clearTimeout(timeoutId);
      setTimeout(() => {
        if (!settled && !window.google?.maps?.Map) fail('auth-failure');
        else succeed();
      }, 150);
    };
    script.onerror = () => { clearTimeout(timeoutId); fail('network'); };
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
};

// ✅ FIXÉ : le mode "satellite" affiche désormais les tuiles HYBRID
// (satellite + noms de rues, quartiers, POI) exactement comme dans
// l'app Google Maps native — une image satellite "nue" sans aucun
// repère est difficile à lire (on ne distingue pas les rues des
// bâtiments). C'est ce qui rend les toits/bâtiments réellement
// identifiables, comme sur la capture d'écran de référence.
const toWebMapTypeId = (mapType) => {
  switch (mapType) {
    case MAP_TYPES.satellite: return 'hybrid';
    case MAP_TYPES.hybrid: return 'hybrid';
    case MAP_TYPES.terrain: return 'terrain';
    default: return 'roadmap';
  }
};

// ============================================================
// ✅ COULEURS DE MARQUEUR SELON LA SITUATION ("statut")
// Palette de secours utilisée si `MARKER_COLORS` (config/googleMaps)
// ne définit pas encore telle ou telle clé — permet d'avoir tout de
// suite des couleurs différentes selon le contexte, sans dépendre
// d'un fichier de config à jour.
// ============================================================
const DEFAULT_MARKER_COLORS = {
  available: '#22C55E',   // vert — disponible
  unavailable: '#9CA3AF', // gris — indisponible
  selected: '#F59E0B',    // orange — position choisie par l'utilisateur
  user: '#2563EB',        // bleu — position GPS de l'utilisateur
  pending: '#3B82F6',     // bleu clair — en attente
  confirmed: '#22C55E',   // vert — confirmé
  in_progress: '#8B5CF6', // violet — en cours
  completed: '#16A34A',   // vert foncé — terminé
  cancelled: '#EF4444',   // rouge — annulé
  default: '#EA4335',     // rouge Google par défaut
};

// ============================================================
// ✅ COULEUR PAR DÉFAUT DU TRACÉ D'ITINÉRAIRE ("route")
// Rouge bien visible — c'est la ligne + les flèches qui montrent
// la distance/direction entre le thérapeute et l'adresse du
// client (indrindra amin'ny web, io no "faritra menamena").
// ============================================================
const DEFAULT_ROUTE_COLOR = '#EF4444';

/**
 * ✅ Détermine la couleur d'un marqueur selon son "état" (statut,
 * disponibilité, couleur forcée). Ordre de priorité :
 *   1) m.pinColor (couleur imposée explicitement)
 *   2) m.status  (ex: 'pending', 'confirmed', 'cancelled', ...)
 *   3) m.available (booléen — vert/gris)
 *   4) couleur par défaut
 */
const resolveMarkerColor = (m = {}) => {
  if (m.pinColor) return m.pinColor;

  if (m.status) {
    const key = String(m.status).toLowerCase();
    if (MARKER_COLORS?.[key]) return MARKER_COLORS[key];
    if (DEFAULT_MARKER_COLORS[key]) return DEFAULT_MARKER_COLORS[key];
  }

  if (typeof m.available === 'boolean') {
    return m.available
      ? (MARKER_COLORS?.available || DEFAULT_MARKER_COLORS.available)
      : (MARKER_COLORS?.unavailable || DEFAULT_MARKER_COLORS.unavailable);
  }

  return MARKER_COLORS?.default || DEFAULT_MARKER_COLORS.default;
};

// ✅ FIXÉ : icône "pin" (goutte) personnalisée — plus de cercle autour
// du marqueur. Le path SVG dessine directement la forme de goutte
// (comme le repère rouge de Google Maps), avec un contour blanc pour
// bien se détacher du fond (photo satellite, carte, etc.).
const getCustomMarkerIcon = (color, scale = 1.4) => {
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale,
    anchor: { x: 12, y: 24 },
  };
};

const MapTypeToggle = ({ mapType, onToggle, style }) => {
  const isSatellite = mapType === MAP_TYPES.satellite || mapType === MAP_TYPES.hybrid;
  return (
    <TouchableOpacity
      style={[styles.mapTypeButton, style]}
      onPress={onToggle}
      activeOpacity={0.85}
      accessibilityLabel="Basculer mode satellite"
    >
      <Ionicons name={isSatellite ? 'map-outline' : 'globe-outline'} size={18} color="#333" />
      <Text style={styles.mapTypeButtonText}>{isSatellite ? 'Plan' : 'Satellite'}</Text>
    </TouchableOpacity>
  );
};

// eslint-disable-next-line no-unused-vars
const ScrollableMarkerList = ({ markers = [], onMarkerPress }) => {
  if (!markers.length) return null;
  return (
    <ScrollView style={styles.embedMarkerListScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {markers.map((m) => {
        const color = resolveMarkerColor(m);
        return (
          <TouchableOpacity key={m.id} style={styles.embedMarkerItem} onPress={() => onMarkerPress && onMarkerPress(m)} activeOpacity={0.7}>
            <View style={[styles.embedMarkerDot, { backgroundColor: color }]} />
            <View style={styles.embedMarkerInfo}>
              <Text style={styles.embedMarkerName} numberOfLines={1}>{m.title || 'Thérapeute'}</Text>
              {m.description ? <Text style={styles.embedMarkerDesc} numberOfLines={1}>{m.description}</Text> : null}
            </View>
            {m.distance != null && <Text style={styles.embedMarkerDistance}>{m.distance.toFixed(1)} km</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// ✅ La prop `route` doit être un tableau [{latitude, longitude}, ...].
// Auparavant, un objet (résultat complet de calculateRoute, avec
// `coordinates`, `distance`, ...) faisait planter le composant :
// "TypeError: route.map is not a function". On accepte maintenant les
// deux formes et on ignore proprement toute valeur invalide.
const normalizeRouteCoordinates = (input) => {
  const list = Array.isArray(input)
    ? input
    : Array.isArray(input?.coordinates)
      ? input.coordinates
      : null;

  if (!list) return null;

  const valid = list
    .map((p) => ({
      latitude: Number(p?.latitude ?? p?.lat),
      longitude: Number(p?.longitude ?? p?.lng),
    }))
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

  return valid.length > 1 ? valid : null;
};

// ✅ TSIPIKA TSIPIKA (pointillés) — rehefa tsy misy lalana mampitohy
// tanteraka ny depart sy ny arrivée :
//   • `routeIsFallback` = tsy nahitana lalana (Google/OSRM tsy nisy valiny)
//     → ny tsipika mihitsy dia aseho ho pointillés ;
//   • lalana misy saingy tsy tonga tanteraka amin'ny toerana marina
//     (ohatra: ny adiresy dia tsy eo amin'ny lalana) → pointillés
//     eo anelanelan'ny toerana marina sy ny farany/fiandohan'ny lalana.
const ROUTE_GAP_MIN_KM = 0.02; // 20 m
const DOTTED_DASH_PATTERN = [1, 9];

// ✅ ITINÉRAIRES ALTERNATIFS : lalana hafa (gris, tsindrio mba
// hisafidianana) + étiquette (voiture / à pied / distance) eo amin'ny
// lalana tsirairay.
const ALT_ROUTE_COLOR = '#8A8F98';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const normalizeRouteOptions = (options) => {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => ({
      ...option,
      coordinates: normalizeRouteCoordinates(option?.coordinates),
    }))
    .filter((option) => option.id != null && option.coordinates);
};

// Point où poser l'étiquette : fraction différente pour chaque
// itinéraire, pour éviter que les étiquettes ne se chevauchent.
const getRouteLabelPoint = (coordinates, fraction) => {
  const index = Math.min(
    coordinates.length - 1,
    Math.max(0, Math.round((coordinates.length - 1) * fraction))
  );
  return coordinates[index];
};

const buildRouteGapSegments = (route, origin, destination, isFallback) => {
  if (!route || route.length < 2 || isFallback) return [];

  const segments = [];
  const first = route[0];
  const last = route[route.length - 1];

  const gap = (a, b) => {
    const d = haversineDistance(a?.latitude, a?.longitude, b?.latitude, b?.longitude);
    return d != null && d > ROUTE_GAP_MIN_KM;
  };

  if (origin && gap(origin, first)) segments.push([origin, first]);
  if (destination && gap(last, destination)) segments.push([last, destination]);

  return segments;
};

const MapViewWrapper = forwardRef(({
  style,
  initialRegion,
  region,
  markers = [],
  userLocation = null,
  route: routeProp = null,
  routeColor,
  routeWidth = 5,
  routeIsFallback = false,
  routeOrigin = null,
  routeDestination = null,
  routeOptions = null,
  selectedRouteId = null,
  onRouteSelect,
  showRouteArrows = true,
  showUserLocation = true,
  trackUserLocation = true,
  mapType: controlledMapType,
  onMapTypeChange,
  showMapTypeControl = true,
  onMarkerPress,
  onMapReady,
  onMapPress,
  selectionMarker = null,
  onSelectionDragEnd,
  children,
}, ref) => {
  const route = useMemo(() => normalizeRouteCoordinates(routeProp), [routeProp]);

  const routeOptionList = useMemo(() => normalizeRouteOptions(routeOptions), [routeOptions]);

  const onRouteSelectRef = useRef(onRouteSelect);
  onRouteSelectRef.current = onRouteSelect;

  const routeGapSegments = useMemo(
    () => buildRouteGapSegments(route, routeOrigin, routeDestination, routeIsFallback),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      route,
      routeIsFallback,
      routeOrigin?.latitude,
      routeOrigin?.longitude,
      routeDestination?.latitude,
      routeDestination?.longitude,
    ],
  );

  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [mapErrorReason, setMapErrorReason] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [internalMapType, setInternalMapType] = useState(MAP_TYPES.standard);

  const mapType = controlledMapType || internalMapType;
  const setMapType = useCallback((next) => {
    if (onMapTypeChange) onMapTypeChange(next);
    else setInternalMapType(next);
  }, [onMapTypeChange]);

  const toggleMapType = useCallback(() => {
    setMapType(mapType === MAP_TYPES.satellite ? MAP_TYPES.standard : MAP_TYPES.satellite);
  }, [mapType, setMapType]);

  const latitude = region?.latitude ?? initialRegion?.latitude ?? DEFAULT_REGION.latitude;
  const longitude = region?.longitude ?? initialRegion?.longitude ?? DEFAULT_REGION.longitude;

  const webDivRef = useRef(null);
  const webMapRef = useRef(null);
  const webMarkersRef = useRef({});
  const webUserMarkerRef = useRef(null);
  const webAccuracyCircleRef = useRef(null);
  const webPolylineRef = useRef(null);
  const webSelectionMarkerRef = useRef(null);
  const webClickListenerRef = useRef(null);
  const nativeMapRef = useRef(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (r, duration = 500) => {
      if (Platform.OS === 'web' && webMapRef.current) {
        webMapRef.current.panTo({ lat: r.latitude, lng: r.longitude });
        if (r.latitudeDelta) {
          const zoom = Math.round(Math.log2(360 / r.latitudeDelta));
          webMapRef.current.setZoom(zoom);
        }
      } else if (nativeMapRef.current) {
        nativeMapRef.current.animateToRegion(r, duration);
      }
    },
    fitToCoordinates: (coords = [], options = {}) => {
      if (!coords.length) return;
      if (Platform.OS === 'web' && webMapRef.current && window.google) {
        const bounds = new window.google.maps.LatLngBounds();
        coords.forEach((c) => bounds.extend({ lat: c.latitude, lng: c.longitude }));
        webMapRef.current.fitBounds(bounds, 60);
      } else if (nativeMapRef.current) {
        nativeMapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
          ...options,
        });
      }
    },
    setMapType: (t) => setMapType(t),
  }), [setMapType]);

  // ✅ Chargement de Google Maps pour le web
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    let cancelled = false;
    setIsLoading(true);
    setMapError(false);
    setMapErrorReason(null);

    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
      .then((google) => {
        if (cancelled || !webDivRef.current) return;
        if (!webMapRef.current) {
          const map = new google.maps.Map(webDivRef.current, {
            center: { lat: latitude, lng: longitude },
            zoom: 14,
            mapTypeId: toWebMapTypeId(mapType),
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true,
            tilt: 0,
            // ✅ Rendu plus net des bâtiments/toits en mode satellite
            gestureHandling: 'greedy',
          });
          webMapRef.current = map;
        }
        setIsLoading(false);
        if (onMapReady) onMapReady();
      })
      .catch((err) => {
        if (!cancelled) {
          setMapError(true);
          setMapErrorReason(err.message || 'unknown');
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  const retryWebMap = useCallback(() => {
    resetGoogleMapsLoader();
    webMapRef.current = null;
    setRetryCount((n) => n + 1);
  }, []);

  const webErrorMessage = (() => {
    switch (mapErrorReason) {
      case 'auth-failure':
        return "Clé API Google Maps refusée (vérifiez : Maps JavaScript API activée, facturation active, et restrictions HTTP referrer de la clé web).";
      case 'timeout':
        return "Le chargement a expiré — connexion lente ou maps.googleapis.com bloqué par le réseau/proxy.";
      case 'network':
        return "Impossible de contacter Google Maps (réseau, bloqueur de script, ou pare-feu).";
      default:
        return "Impossible de charger Google Maps.";
    }
  })();

  // ✅ FIXÉ : quand on bascule en mode satellite, on passe aussi en
  // tuiles "hybrid" (labels visibles), on incline légèrement la vue
  // (tilt 45°, comme Google Maps sur les zones prises en photo
  // aérienne 3D) et on zoome un peu plus près pour bien distinguer
  // la forme des bâtiments/toits.
  useEffect(() => {
    if (Platform.OS === 'web' && webMapRef.current) {
      const map = webMapRef.current;
      map.setMapTypeId(toWebMapTypeId(mapType));

      const isSatelliteMode = mapType === MAP_TYPES.satellite || mapType === MAP_TYPES.hybrid;
      if (isSatelliteMode) {
        try { map.setTilt(45); } catch (_e) { /* tilt indisponible sur cette zone */ }
        if ((map.getZoom() || 0) < 17) map.setZoom(18);
      } else {
        try { map.setTilt(0); } catch (_e) { /* no-op */ }
      }
    }
  }, [mapType]);

  // ✅ Gestion des marqueurs normaux (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !webMapRef.current || !window.google) return;
    const google = window.google;
    const map = webMapRef.current;
    const seenIds = new Set();

    markers.forEach((m) => {
      const id = String(m.id);
      seenIds.add(id);
      const color = resolveMarkerColor(m);
      const position = { lat: m.coordinate.latitude, lng: m.coordinate.longitude };

      let marker = webMarkersRef.current[id];
      if (!marker) {
        // ✅ Icône "goutte" personnalisée — jamais de cercle autour
        const icon = m.icon || getCustomMarkerIcon(color);
        marker = new google.maps.Marker({
          map,
          position,
          title: m.title,
          icon,
          optimized: true,
        });
        marker.addListener('click', () => onMarkerPress && onMarkerPress(m));
        webMarkersRef.current[id] = marker;
      } else {
        marker.setPosition(position);
        // ✅ Met à jour la couleur si le statut du marqueur a changé
        marker.setIcon(m.icon || getCustomMarkerIcon(color));
      }
    });

    Object.keys(webMarkersRef.current).forEach((id) => {
      if (!seenIds.has(id)) {
        webMarkersRef.current[id].setMap(null);
        delete webMarkersRef.current[id];
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, isLoading]);

  // ============================================================
  // ✅ TRACÉ DE L'ITINÉRAIRE SUR LE WEB — "faritra menamena"
  // ============================================================
  // AVANT : la prop `route` n'était jamais dessinée sur le web
  // (aucun code ne la consommait), donc aucune ligne ni aucune
  // flèche n'apparaissait entre le thérapeute et l'adresse du
  // client. FIXÉ : on dessine désormais
  //   1) un "halo" blanc épais sous la ligne (pour bien la
  //      détacher du fond de carte, satellite compris) ;
  //   2) la ligne rouge (ou `routeColor`) par-dessus ;
  //   3) des flèches (icons Google) répétées tout au long du
  //      trajet, orientées automatiquement dans le sens du
  //      déplacement — mitodika mankany amin'ny client foana.
  // ============================================================
  useEffect(() => {
    if (Platform.OS !== 'web' || !webMapRef.current || !window.google) return;
    const google = window.google;
    const map = webMapRef.current;

    // Nettoie l'ancien tracé avant d'en dessiner un nouveau
    if (webPolylineRef.current) {
      webPolylineRef.current.outline?.setMap(null);
      webPolylineRef.current.line?.setMap(null);
      (webPolylineRef.current.dotted || []).forEach((d) => d.setMap(null));
      webPolylineRef.current = null;
    }

    if (!route || route.length < 2) return;

    const path = route.map((p) => ({ lat: p.latitude, lng: p.longitude }));
    const color = routeColor || DEFAULT_ROUTE_COLOR;

    // ✅ Pointillés (tsipika tsipika) : ligne invisible + petits ronds
    // répétés tous les 12 px le long du segment.
    const makeDotted = (points) =>
      new google.maps.Polyline({
        map,
        path: points.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        strokeOpacity: 0,
        zIndex: 11,
        clickable: false,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 3,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 1,
            },
            offset: '0',
            repeat: '12px',
          },
        ],
      });

    // Aucun vrai trajet trouvé : toute la liaison depart → arrivée
    // est affichée en pointillés (au lieu d'une ligne pleine trompeuse).
    if (routeIsFallback) {
      const dottedMain = makeDotted(route);
      webPolylineRef.current = { dotted: [dottedMain] };
      return () => dottedMain.setMap(null);
    }

    const dotted = routeGapSegments.map(makeDotted);

    // 1) Halo blanc — rend la ligne rouge lisible sur tout fond
    const outline = new google.maps.Polyline({
      map,
      path,
      strokeColor: '#FFFFFF',
      strokeOpacity: 0.95,
      strokeWeight: routeWidth + 5,
      zIndex: 10,
      clickable: false,
    });

    // 2) Ligne rouge + 3) flèches de direction (icons répétés)
    const line = new google.maps.Polyline({
      map,
      path,
      strokeColor: color,
      strokeOpacity: 1,
      strokeWeight: routeWidth,
      zIndex: 11,
      clickable: false,
      icons: showRouteArrows
        ? [
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 3.4,
                strokeColor: '#FFFFFF',
                strokeWeight: 1.5,
                fillColor: color,
                fillOpacity: 1,
              },
              offset: '0%',
              // ✅ Une flèche tous les 90px le long de la ligne —
              // bien visible sans surcharger le trajet.
              repeat: '90px',
            },
          ]
        : [],
    });

    webPolylineRef.current = { outline, line, dotted };

    return () => {
      outline.setMap(null);
      line.setMap(null);
      dotted.forEach((d) => d.setMap(null));
    };
  }, [route, routeColor, routeWidth, showRouteArrows, isLoading, routeIsFallback, routeGapSegments]);

  // ============================================================
  // ✅ PROPOSITION D'ITINÉRAIRES (web) — routes alternatives en gris
  // (cliquables) + étiquette sur CHAQUE itinéraire :
  //   🚗 durée en voiture · 🚶 durée à pied · distance
  // L'itinéraire sélectionné est dessiné par l'effet ci-dessus
  // (prop `route`) ; ici on ajoute les alternatives et les étiquettes.
  // ============================================================
  useEffect(() => {
    if (Platform.OS !== 'web' || !webMapRef.current || !window.google) return undefined;
    if (routeOptionList.length === 0) return undefined;

    const google = window.google;
    const map = webMapRef.current;
    const activeColor = routeColor || DEFAULT_ROUTE_COLOR;
    const selectedId = selectedRouteId ?? routeOptionList[0].id;

    class RouteLabelOverlay extends google.maps.OverlayView {
      constructor(position, html, selected, onClick) {
        super();
        this.position = position;
        this.html = html;
        this.selected = selected;
        this.onClick = onClick;
        this.div = null;
      }

      onAdd() {
        const div = document.createElement('div');
        div.style.cssText = [
          'position:absolute',
          'transform:translate(-50%,-100%)',
          'margin-top:-6px',
          'padding:4px 8px',
          'border-radius:10px',
          'font:600 11px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
          'white-space:nowrap',
          'cursor:pointer',
          'text-align:center',
          'box-shadow:0 2px 6px rgba(0,0,0,0.3)',
          this.selected
            ? `background:${activeColor};color:#fff;border:2px solid #fff;z-index:20`
            : 'background:#fff;color:#333;border:1px solid #B8BDC4;z-index:10',
        ].join(';');
        div.innerHTML = this.html;
        div.addEventListener('click', (event) => {
          event.stopPropagation();
          this.onClick?.();
        });
        this.div = div;
        this.getPanes().overlayMouseTarget.appendChild(div);
      }

      draw() {
        const projection = this.getProjection();
        if (!projection || !this.div) return;
        const point = projection.fromLatLngToDivPixel(this.position);
        if (point) {
          this.div.style.left = `${point.x}px`;
          this.div.style.top = `${point.y}px`;
        }
      }

      onRemove() {
        this.div?.parentNode?.removeChild(this.div);
        this.div = null;
      }
    }

    const created = [];
    const total = routeOptionList.length;

    routeOptionList.forEach((option, index) => {
      const isSelected = option.id === selectedId;
      const path = option.coordinates.map((p) => ({ lat: p.latitude, lng: p.longitude }));
      const select = () => onRouteSelectRef.current?.(option.id);

      if (!isSelected) {
        created.push(
          new google.maps.Polyline({
            map,
            path,
            strokeColor: '#FFFFFF',
            strokeOpacity: 0.9,
            strokeWeight: routeWidth + 4,
            zIndex: 8,
            clickable: false,
          })
        );

        const altLine = new google.maps.Polyline({
          map,
          path,
          strokeColor: ALT_ROUTE_COLOR,
          strokeOpacity: 0.95,
          strokeWeight: routeWidth,
          zIndex: 9,
          clickable: true,
        });
        altLine.addListener('click', select);
        created.push(altLine);
      }

      const labelPoint = getRouteLabelPoint(option.coordinates, (index + 1) / (total + 1));
      const html =
        `<div>🚗 ${escapeHtml(option.drivingDurationText || option.durationText)}` +
        ` &nbsp;·&nbsp; 🚶 ${escapeHtml(option.walkingDurationText)}</div>` +
        `<div style="font-weight:500;opacity:0.85">${escapeHtml(option.distanceText)}` +
        `${option.summary ? ` · via ${escapeHtml(option.summary)}` : ''}</div>`;

      const overlay = new RouteLabelOverlay(
        new google.maps.LatLng(labelPoint.latitude, labelPoint.longitude),
        html,
        isSelected,
        select
      );
      overlay.setMap(map);
      created.push(overlay);
    });

    return () => {
      created.forEach((item) => item.setMap(null));
    };
  }, [routeOptionList, selectedRouteId, routeColor, routeWidth, isLoading]);

  // ✅ Position utilisateur sur le web
  useEffect(() => {
    if (Platform.OS !== 'web' || !webMapRef.current || !window.google) return;
    const google = window.google;
    const map = webMapRef.current;

    if (!showUserLocation || !userLocation) {
      if (webUserMarkerRef.current) { webUserMarkerRef.current.setMap(null); webUserMarkerRef.current = null; }
      if (webAccuracyCircleRef.current) { webAccuracyCircleRef.current.setMap(null); webAccuracyCircleRef.current = null; }
      return;
    }

    const position = { lat: userLocation.latitude, lng: userLocation.longitude };
    const userColor = MARKER_COLORS?.user || DEFAULT_MARKER_COLORS.user;
    const userIcon = getCustomMarkerIcon(userColor, 1.3);

    if (!webUserMarkerRef.current) {
      webUserMarkerRef.current = new google.maps.Marker({
        map,
        position,
        title: 'Vous êtes ici',
        zIndex: 999,
        icon: userIcon,
      });
    } else {
      webUserMarkerRef.current.setPosition(position);
    }
  }, [userLocation, showUserLocation]);

  // ✅ Interception du clic sur la carte sur Web
  useEffect(() => {
    if (Platform.OS !== 'web' || !webMapRef.current || !window.google) return;
    const google = window.google;
    const map = webMapRef.current;

    if (webClickListenerRef.current) {
      google.maps.event.removeListener(webClickListenerRef.current);
    }
    if (onMapPress) {
      webClickListenerRef.current = map.addListener('click', (e) => {
        onMapPress({ latitude: e.latLng.lat(), longitude: e.latLng.lng() });
      });
    }

    return () => {
      if (webClickListenerRef.current) {
        google.maps.event.removeListener(webClickListenerRef.current);
      }
    };
  }, [onMapPress, isLoading]);

  // ✅ EFFECT DU MARQUEUR DE SÉLECTION SUR LE WEB — CORRIGÉ
  // ✅ FIXÉ : goutte orange bien visible (scale plus grand + petite
  // animation "DROP" à la création, comme un vrai marqueur Google
  // Maps qui "tombe" sur la carte), sans jamais de cercle autour.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!webMapRef.current || !window.google) {
      console.log('⏳ Web map not ready yet, waiting...');
      return;
    }
    if (mapError) {
      console.log('❌ Map error, skipping selection marker');
      return;
    }

    const google = window.google;
    const map = webMapRef.current;

    if (!selectionMarker || !selectionMarker.latitude || !selectionMarker.longitude) {
      if (webSelectionMarkerRef.current) {
        webSelectionMarkerRef.current.setMap(null);
        webSelectionMarkerRef.current = null;
        console.log('🗑️ Selection marker removed');
      }
      return;
    }

    const position = { lat: selectionMarker.latitude, lng: selectionMarker.longitude };
    const markerColor = MARKER_COLORS?.selected || DEFAULT_MARKER_COLORS.selected;

    console.log(`📍 Creating/updating selection marker at: ${position.lat}, ${position.lng}`);

    const selectedIcon = getCustomMarkerIcon(markerColor, 1.7);

    if (!webSelectionMarkerRef.current) {
      webSelectionMarkerRef.current = new google.maps.Marker({
        map,
        position,
        draggable: true,
        zIndex: 1000,
        icon: selectedIcon,
        title: 'Position sélectionnée',
        animation: google.maps.Animation.DROP,
      });
      webSelectionMarkerRef.current.addListener('dragend', (e) => {
        const coord = { latitude: e.latLng.lat(), longitude: e.latLng.lng() };
        if (onSelectionDragEnd) onSelectionDragEnd(coord);
      });
      console.log('✅ New selection marker created');
    } else {
      webSelectionMarkerRef.current.setPosition(position);
      console.log('✅ Selection marker position updated');
    }

    map.panTo(position);
    if ((map.getZoom() || 0) < 15) map.setZoom(15);
    console.log('✅ Map panned to selection');

  }, [selectionMarker, onSelectionDragEnd, isLoading, mapError]);

  const nativeInitialRegion = {
    latitude,
    longitude,
    latitudeDelta: region?.latitudeDelta || initialRegion?.latitudeDelta || DEFAULT_REGION.latitudeDelta,
    longitudeDelta: region?.longitudeDelta || initialRegion?.longitudeDelta || DEFAULT_REGION.longitudeDelta,
  };

  // ============================================================
  // ✅ RENDER WEB
  // ============================================================
  if (Platform.OS === 'web') {
    const embedUrl = `https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_API_KEY}&center=${latitude},${longitude}&zoom=14&maptype=${(mapType === MAP_TYPES.satellite || mapType === MAP_TYPES.hybrid) ? 'satellite' : 'roadmap'}`;

    const hasSelectionMarker = selectionMarker && selectionMarker.latitude && selectionMarker.longitude;

    return (
      <View style={[styles.container, style]}>
        <View ref={webDivRef} style={[styles.map, mapError && { display: 'none' }]} />

        {mapError && (
          <View style={styles.map}>
            <iframe
              src={embedUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              loading="lazy"
              title="Google Maps (mode secours)"
              referrerPolicy="no-referrer-when-downgrade"
            />
            {hasSelectionMarker && (
              <View style={styles.embedSelectionBanner}>
                <Ionicons name="location" size={16} color="#F59E0B" />
                <Text style={styles.embedSelectionBannerText} numberOfLines={2}>
                  📍 Position sélectionnée : {selectionMarker.latitude.toFixed(5)}, {selectionMarker.longitude.toFixed(5)}
                </Text>
              </View>
            )}
            <View style={styles.embedErrorBanner}>
              <Ionicons name="warning-outline" size={16} color="#B45309" />
              <Text style={styles.embedErrorBannerText} numberOfLines={2}>{webErrorMessage}</Text>
              <TouchableOpacity onPress={retryWebMap} style={styles.retryButton}>
                <Ionicons name="refresh" size={14} color="#fff" />
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isLoading && !mapError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Chargement de la carte...</Text>
          </View>
        )}

        {showMapTypeControl && !isLoading && (
          <MapTypeToggle mapType={mapType} onToggle={toggleMapType} style={styles.mapTypeButtonWeb} />
        )}

        {!mapError && !isLoading && hasSelectionMarker && (
          <View style={styles.selectionInfoBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.selectionInfoText} numberOfLines={1}>
              📍 Position: {selectionMarker.latitude.toFixed(5)}, {selectionMarker.longitude.toFixed(5)}
            </Text>
          </View>
        )}

        {children}
      </View>
    );
  }

  // ============================================================
  // ✅ RENDER NATIVE (IOS / ANDROID)
  // ============================================================
  if (RNMapView) {
    return (
      <View style={[styles.container, style]}>
        <RNMapView
          ref={nativeMapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={nativeInitialRegion}
          region={region}
          // ✅ FIXÉ : "hybrid" au lieu de "satellite" pur — affiche
          // les noms de rues/quartiers par-dessus la photo aérienne.
          mapType={(mapType === MAP_TYPES.satellite || mapType === MAP_TYPES.hybrid) ? 'hybrid' : 'standard'}
          showsUserLocation={showUserLocation && !userLocation}
          followsUserLocation={trackUserLocation && !userLocation}
          showsMyLocationButton={false}
          showsCompass
          showsBuildings
          onMapReady={() => { setIsLoading(false); onMapReady && onMapReady(); }}
          onPress={(e) => {
            if (onMapPress) onMapPress(e.nativeEvent.coordinate);
          }}
        >
          {/* ✅ MARQUEUR SÉLECTIONNÉ SUR MOBILE — pin natif (goutte), pas de cercle */}
          {selectionMarker && selectionMarker.latitude && selectionMarker.longitude && (
            <RNMarker
              coordinate={{
                latitude: selectionMarker.latitude,
                longitude: selectionMarker.longitude,
              }}
              draggable
              pinColor={MARKER_COLORS?.selected || DEFAULT_MARKER_COLORS.selected}
              anchor={{ x: 0.5, y: 1 }}
              onDragEnd={(e) => {
                if (onSelectionDragEnd) onSelectionDragEnd(e.nativeEvent.coordinate);
              }}
            />
          )}

          {markers.map((m) => (
            <RNMarker
              key={m.id}
              coordinate={m.coordinate}
              title={m.title}
              description={m.description}
              pinColor={resolveMarkerColor(m)}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => onMarkerPress && onMarkerPress(m)}
            />
          ))}

          {/* ✅ PROPOSITION D'ITINÉRAIRES (natif) — alternatives en gris
              (tsindrio = safidy) + étiquette voiture / à pied / distance. */}
          {routeOptionList.map((option) =>
            option.id !== (selectedRouteId ?? routeOptionList[0].id) ? (
              <RNPolyline
                key={`alt-route-${option.id}`}
                coordinates={option.coordinates}
                strokeColor={ALT_ROUTE_COLOR}
                strokeWidth={routeWidth}
                zIndex={3}
                lineCap="round"
                tappable
                onPress={() => onRouteSelect && onRouteSelect(option.id)}
              />
            ) : null
          )}

          {routeOptionList.map((option, index) => {
            const isSelected = option.id === (selectedRouteId ?? routeOptionList[0].id);
            const labelPoint = getRouteLabelPoint(
              option.coordinates,
              (index + 1) / (routeOptionList.length + 1)
            );

            return (
              <RNMarker
                key={`route-label-${option.id}-${isSelected ? 's' : 'u'}`}
                coordinate={labelPoint}
                anchor={{ x: 0.5, y: 1 }}
                zIndex={isSelected ? 8 : 7}
                tracksViewChanges={false}
                onPress={() => onRouteSelect && onRouteSelect(option.id)}
              >
                <View
                  style={[
                    styles.routeLabel,
                    isSelected && {
                      backgroundColor: routeColor || DEFAULT_ROUTE_COLOR,
                      borderColor: '#FFFFFF',
                    },
                  ]}
                >
                  <Text style={[styles.routeLabelText, isSelected && styles.routeLabelTextSelected]}>
                    {`🚗 ${option.drivingDurationText || option.durationText}  ·  🚶 ${option.walkingDurationText}`}
                  </Text>
                  <Text style={[styles.routeLabelSub, isSelected && styles.routeLabelTextSelected]}>
                    {option.distanceText}
                  </Text>
                </View>
              </RNMarker>
            );
          })}

          {/* ✅ TRACÉ DE L'ITINÉRAIRE (natif) — ligne rouge (ou
              `routeColor`) + flèches de direction régulièrement
              espacées, mitodika mankany amin'ny client. */}
          {route && route.length > 1 && (
            <>
              <RNPolyline
                coordinates={route}
                strokeColor={routeColor || DEFAULT_ROUTE_COLOR}
                strokeWidth={routeWidth}
                zIndex={5}
                geodesic
                lineCap="round"
                lineDashPattern={routeIsFallback ? DOTTED_DASH_PATTERN : undefined}
              />
              {/* ✅ Pointillés entre les points réels et les extrémités du tracé */}
              {routeGapSegments.map((segment, idx) => (
                <RNPolyline
                  key={`route-gap-${idx}`}
                  coordinates={segment}
                  strokeColor={routeColor || DEFAULT_ROUTE_COLOR}
                  strokeWidth={routeWidth}
                  zIndex={5}
                  lineCap="round"
                  lineDashPattern={DOTTED_DASH_PATTERN}
                />
              ))}
              {showRouteArrows &&
                getRouteArrowPoints(route, 6).map((arrow, idx) => (
                  <RNMarker
                    key={`route-arrow-${idx}`}
                    coordinate={{ latitude: arrow.latitude, longitude: arrow.longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    rotation={arrow.bearing}
                    flat
                    tracksViewChanges={false}
                    zIndex={6}
                  >
                    <View style={styles.routeArrowWrap}>
                      <Ionicons
                        name="caret-up"
                        size={20}
                        color={routeColor || DEFAULT_ROUTE_COLOR}
                      />
                    </View>
                  </RNMarker>
                ))}
            </>
          )}

          {children}
        </RNMapView>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Chargement de la carte...</Text>
          </View>
        )}

        {showMapTypeControl && (
          <MapTypeToggle mapType={mapType} onToggle={toggleMapType} style={styles.mapTypeButtonNative} />
        )}
      </View>
    );
  }

  // ============================================================
  // ✅ FALLBACK
  // ============================================================
  return (
    <View style={[styles.fallbackContainer, style]}>
      <Ionicons name="warning-outline" size={40} color="#FF9800" />
      <Text style={styles.fallbackTitle}>react-native-maps tsy voa-install</Text>
      <Text style={styles.fallbackText}>
        Ataovy `npx expo install react-native-maps` ao anaty projet mba hampiasa ny sarintany.
      </Text>
    </View>
  );
});

MapViewWrapper.displayName = 'MapViewWrapper';

// ============================================================
// ✅ STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5', 
    borderRadius: 12, 
    overflow: 'hidden', 
    minHeight: 250, 
    position: 'relative' 
  },
  map: { flex: 1, width: '100%', height: '100%' },
  routeArrowWrap: { alignItems: 'center', justifyContent: 'center' },
  routeLabel: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B8BDC4',
    backgroundColor: '#FFFFFF',
  },
  routeLabelText: { fontSize: 11, fontWeight: '700', color: '#333333' },
  routeLabelSub: { fontSize: 10, fontWeight: '500', color: '#555555' },
  routeLabelTextSelected: { color: '#FFFFFF' },
  loadingOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(255,255,255,0.85)' 
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  mapTypeButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    paddingHorizontal: 10, 
    paddingVertical: 8, 
    borderRadius: 20, 
    gap: 6, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 4, 
    elevation: 3 
  },
  mapTypeButtonText: { fontSize: 12, fontWeight: '600', color: '#333' },
  mapTypeButtonWeb: { position: 'absolute', top: 10, left: 10 },
  mapTypeButtonNative: { position: 'absolute', top: 10, left: 10 },
  
  embedMarkerListScroll: { maxHeight: 210 },
  embedMarkerItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 6, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    gap: 8 
  },
  embedMarkerDot: { width: 10, height: 10, borderRadius: 5 },
  embedMarkerInfo: { flex: 1 },
  embedMarkerName: { fontSize: 12, fontWeight: '600', color: '#333' },
  embedMarkerDesc: { fontSize: 10, color: '#777' },
  embedMarkerDistance: { fontSize: 11, fontWeight: '600', color: '#4CAF50' },
  
  embedSelectionBanner: { 
    position: 'absolute', 
    top: 10, 
    left: 10, 
    right: 10, 
    backgroundColor: '#FFFBEB', 
    borderRadius: 10, 
    padding: 10, 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 8, 
    borderWidth: 1, 
    borderColor: '#FDE68A' 
  },
  embedSelectionBannerText: { flex: 1, fontSize: 11, color: '#92400E' },
  
  embedErrorBanner: { 
    position: 'absolute', 
    bottom: 10, 
    left: 10, 
    right: 10, 
    backgroundColor: '#FEF3C7', 
    borderRadius: 10, 
    padding: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3 
  },
  embedErrorBannerText: { flex: 1, fontSize: 11, color: '#92400E' },
  
  retryButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#B45309', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8, 
    gap: 4 
  },
  retryButtonText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  
  selectionInfoBanner: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectionInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  
  fallbackContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20, 
    backgroundColor: '#f5f5f5', 
    borderRadius: 12, 
    minHeight: 250 
  },
  fallbackTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 8, textAlign: 'center' },
  fallbackText: { fontSize: 13, color: '#666', marginTop: 6, textAlign: 'center' },
});

export default MapViewWrapper;

export const Marker = RNMarker || View;
export const Polyline = RNPolyline || View;
export const Circle = RNCircle || View;