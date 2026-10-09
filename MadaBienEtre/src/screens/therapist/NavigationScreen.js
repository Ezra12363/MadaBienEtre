// ============================================================
// src/screens/therapist/NavigationScreen.js
//
// VERSION THÉRAPEUTE - NAVIGATION VERS LE CLIENT
//
// ✅ NOUVEAU — POSITION EN DIRECT + PARTAGE AU CLIENT
// - La position du thérapeute vient maintenant de useLocationTracking
//   (watch continu) : le marqueur "Départ — vous" BOUGE en direct.
// - Le bouton "Envoyer ma position au client" ouvre un WebSocket
//   (/ws/tracking/{bookingId}) et envoie la position à chaque
//   déplacement. "Arrêter le partage" coupe l'envoi.
// - L'itinéraire est recalculé automatiquement quand le thérapeute
//   s'est éloigné de > 200 m du point de départ du dernier calcul.
// - La caméra n'est plus recadrée à chaque mise à jour (sinon
//   impossible de zoomer/déplacer la carte) : cadrage initial une
//   seule fois + bouton "suivre ma position" optionnel.
//
// ✅ ÉCRAN UNIQUE (remplace l'ancien therapist/TrackingScreen.js, supprimé) :
// carte + itinéraire + position en direct + partage au client + bouton SOS.
// ✅ AFFICHAGE RAPIDE : l'écran s'ouvre tout de suite (plus d'écran de
// chargement bloquant). Dès l'ouverture : dernière position connue ->
// ligne pointillée immédiate -> vrai itinéraire (Google + OSRM en parallèle,
// avec cache) dès qu'il arrive.
//
// ✅ Adapté à l'API RÉELLE de MapViewWrapper (composants/map) :
// - Les marqueurs (thérapeute + client) sont passés via la prop
//   `markers` (tableau), PAS via des <Marker> en enfants JSX.
//   Sur le web, MapViewWrapper exporte `Marker`/`Polyline` comme
//   de simples <View> inertes (react-native-maps n'existe pas
//   côté web) : les utiliser en enfants JSX ne faisait donc
//   RIEN de visible sur le web.
// - Le tracé de l'itinéraire est passé via la prop `route`
//   (liste de {latitude, longitude}), désormais câblée dans
//   MapViewWrapper aussi bien en natif qu'en web.
// - `showMapTypeControl` reste actif (comportement par défaut
//   du wrapper) : le bouton satellite/plan maison s'affiche en
//   HAUT-GAUCHE sur web comme sur mobile. Nos propres éléments
//   (bouton recentrer, carte adresse) restent donc du côté
//   DROIT de l'écran pour ne jamais le recouvrir.
//
// Charte graphique alignée sur les autres écrans thérapeute :
// Header commun, cards bordées + ombre légère, bouton principal
// en dégradé PRIMARY.
// ============================================================

import { projectOnRoute } from '../../utils/routeTrim';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../context/AuthContext';
import useLocationTracking from '../../hooks/useLocationTracking';
import { createTrackingSocket } from '../../services/trackingSocket';
import { API_URL } from '../../config/env';

import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

import Header from '../../components/common/Header';
import SOSButton from '../../components/sos/SOSButton';
import { reverseGeocode } from '../../services/geocoding';
import LiveRouteMap from '../../components/map/LiveRouteMap';

import {
  calculateAlternativeRoutes,
  haversineDistance,
  formatDistance,
} from '../../services/routing';

// ============================================================
// CONSTANTES
// ============================================================

const DEFAULT_REGION = { latitude: -18.8792, longitude: 47.5079 };

const PRIMARY = '#2E7D32'; // vert, cohérent avec le thème de la page Welcome

// Convention carte standard (reconnaissable internationalement) :
// bleu = position du thérapeute, rouge = destination du client.
const START_COLOR = '#1976D2';
const END_COLOR = '#D32F2F';
// ✅ Même rendu que l'écran client : ligne ROUGE sur la vraie route,
// destination en VERT, thérapeute en BLEU ("vous").
const ROUTE_COLOR = '#E53935';
const DEST_COLOR = '#2E7D32';

const SHARE_MIN_INTERVAL_MS = 900; // 1 envoi par seconde
const REROUTE_DISTANCE_KM = 0.2; // recalcul itinéraire après 200 m

// ============================================================
// HELPERS
// ============================================================

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// ============================================================
// SCREEN
// ============================================================

export default function NavigationScreen({ route: navRoute }) {
  const params = navRoute?.params || {};

  const bookingId = params.bookingId;

  const clientAddress =
    params.clientAddress || params.address || 'Adresse du client';

  const clientLatitude = toNumber(params.clientLatitude ?? params.latitude);
  const clientLongitude = toNumber(params.clientLongitude ?? params.longitude);

  const { colors: themeColors } = useTheme();
  const mapRef = useRef(null);

  const { token, user } = useAuth();
  const myUserId = user?.id ?? null;

  // ✅ Position GPS en DIRECT (watch continu + "first fix" rapide)
  const {
    location: gpsLocation,
    errorMsg: gpsErrorMsg,
    startTracking,
    stopTracking,
  } = useLocationTracking({
    enabled: true,
    // ✅ Position mise à jour CHAQUE SECONDE (0 m = pas de seuil de distance,
    // sinon Android attend d'avoir bougé de X mètres avant d'émettre)
    distanceIntervalMeters: 0,
    timeIntervalMs: 1000,
  });

  // ==========================================================
  // ✅ SYNCHRO TÉLÉPHONE <-> WEB
  // Un ordinateur n'a pas de GPS : Chrome estime la position par Wi-Fi / IP
  // (souvent à plusieurs centaines de mètres). Le téléphone du thérapeute,
  // lui, a le vrai GPS. Donc :
  //  - MOBILE : envoie sa position GPS au serveur toutes les ~4 s
  //    (POST /geolocation/update) ;
  //  - WEB : si sa propre position est imprécise (> 60 m) ou absente, il lit
  //    la position GPS du téléphone (GET /geolocation/current/{moi}, toutes
  //    les 2 s) tant qu'elle date de moins de 45 s.
  // Résultat : le marqueur du web est au même endroit que sur Android.
  // ==========================================================
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

  // Position active : GPS du téléphone (sur le web, si le navigateur est
  // imprécis), sinon le GPS de cet appareil.
  // ✅ POSITION MANUELLE (web uniquement) : si ni le navigateur ni le téléphone
  // ne donnent une position fiable, le thérapeute touche la carte à l'endroit
  // où il se trouve réellement (bouton épingle violet).
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

  const therapistPosition = useMemo(
    () =>
      activeLocation
        ? { latitude: activeLocation.latitude, longitude: activeLocation.longitude }
        : null,
    [activeLocation]
  );

  // true = vrai relevé GPS ; false = ancienne position en cache
  const hasRealPosition = !!activeLocation && !activeLocation.cached;

  // ✅ ADRESSE ACTUELLE du thérapeute (géocodage inverse de sa position GPS),
  // affichée dans la carte d'infos et sur le marqueur : permet de vérifier
  // d'un coup d'œil qu'il est bien placé là où il se trouve.
  const [currentAddress, setCurrentAddress] = useState('');
  const lastGeocodeRef = useRef(null); // { pos, at }
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    if (!hasRealPosition || !therapistPosition) return;

    const last = lastGeocodeRef.current;
    const age = last ? Date.now() - last.at : Infinity;
    const moved = last
      ? haversineDistance(
          last.pos.latitude,
          last.pos.longitude,
          therapistPosition.latitude,
          therapistPosition.longitude
        ) ?? Infinity
      : Infinity;

    // 1re fois, ou (>= 15 s ET déplacé de >= 100 m), ou rafraîchi toutes les 90 s
    const shouldLookup = !last || (age >= 15000 && moved >= 0.1) || age >= 90000;
    if (!shouldLookup) return;

    lastGeocodeRef.current = { pos: therapistPosition, at: Date.now() };

    reverseGeocode(therapistPosition.latitude, therapistPosition.longitude)
      .then((result) => {
        if (mountedRef.current && result?.display_name) {
          setCurrentAddress(result.display_name);
        }
      })
      .catch(() => {});
  }, [hasRealPosition, therapistPosition]);
  // ✅ Proposition d'itinéraires : le plus rapide + alternatives.
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const gpsError = gpsErrorMsg || '';

  // ✅ Partage de la position au client (WebSocket)
  const [isSharing, setIsSharing] = useState(false);
  const [socketStatus, setSocketStatus] = useState('idle');
  const [lastSentAt, setLastSentAt] = useState(null);
  const [shareError, setShareError] = useState('');
  const [followMe, setFollowMe] = useState(true);
  const navWasOnRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const socketRef = useRef(null);
  const lastSendRef = useRef(0);
  const gpsLocationRef = useRef(null);
  const lastRouteOriginRef = useRef(null);
  const routeLoadingRef = useRef(false);
  const followZoomSetRef = useRef(false);
  const routeOptionsRef = useRef([]);
  const selectedIdRef = useRef(null);
  const routeInfoRef = useRef(null);
  const routeFromRealRef = useRef(false); // l'itinéraire part-il d'un vrai relevé GPS ?

  // ✅ CORRECTIF ANDROID : taille exacte (en pixels) de la zone
  // carte, mesurée via `onLayout`. Sur Android, react-native-maps
  // ne se redimensionne pas toujours correctement quand il est
  // seulement en `flex:1` à l'intérieur d'un parent positionné en
  // absolu (`StyleSheet.absoluteFillObject`) — la carte peut alors
  // ne remplir qu'une partie de l'écran et laisser un grand espace
  // vide en dessous. En donnant une largeur/hauteur EXPLICITES
  // (mesurées), la carte occupe systématiquement tout l'espace
  // disponible, sur Android comme sur le web.
  const [screenSize, setScreenSize] = useState(null);

  // ✅ Hauteur réelle du bandeau bas flottant, mesurée dynamiquement,
  // pour placer le badge adresse juste au-dessus de lui — quel que
  // soit l'appareil — au lieu d'une valeur fixe ("bottom: 230") qui
  // pouvait laisser un vide ou se chevaucher.
  const [bottomSheetHeight, setBottomSheetHeight] = useState(210);

  // ✅ Hauteur mesurée du bloc adresse/stats : le bouton SOS se place juste
  // au-dessus, sans jamais le chevaucher.
  const [overlayHeight, setOverlayHeight] = useState(120);
  const routeRequestIdRef = useRef(0);

  gpsLocationRef.current = activeLocation;
  routeOptionsRef.current = routeOptions;
  selectedIdRef.current = selectedRouteId;

  // ==========================================================
  // POSITIONS
  // ==========================================================

  const clientPosition = useMemo(
    () => ({
      latitude: clientLatitude ?? DEFAULT_REGION.latitude,
      longitude: clientLongitude ?? DEFAULT_REGION.longitude,
    }),
    [clientLatitude, clientLongitude]
  );

  const straightDistance = useMemo(
    () =>
      therapistPosition
        ? haversineDistance(
            therapistPosition.latitude,
            therapistPosition.longitude,
            clientPosition.latitude,
            clientPosition.longitude
          )
        : null,
    [therapistPosition, clientPosition]
  );


  // ==========================================================
  // ROUTE
  // ==========================================================

  // Itinéraire sélectionné (par défaut : le plus rapide) et données
  // dérivées, avec les mêmes noms qu'avant pour le reste de l'écran.
  const routeInfo = useMemo(
    () =>
      routeOptions.find((option) => option.id === selectedRouteId) ||
      routeOptions[0] ||
      null,
    [routeOptions, selectedRouteId]
  );

  routeInfoRef.current = routeInfo;

  const routeCoordinates = useMemo(() => {
    if (routeInfo?.coordinates?.length > 1) return routeInfo.coordinates;
    if (therapistPosition && clientPosition) {
      return [therapistPosition, clientPosition];
    }
    return [];
  }, [routeInfo, therapistPosition, clientPosition]);

  const loadRoute = useCallback(
    async (origin) => {
      if (!origin) return;

      lastRouteOriginRef.current = origin;
      routeLoadingRef.current = true;
      setRouteLoading(true);
      routeRequestIdRef.current += 1;
      const requestId = routeRequestIdRef.current;

      try {
        const options = await calculateAlternativeRoutes(
          origin.latitude,
          origin.longitude,
          clientPosition.latitude,
          clientPosition.longitude
        );

        if (requestId !== routeRequestIdRef.current) return; // réponse périmée

        // ✅ Garde le choix d'itinéraire du thérapeute (par rang) lors
        // d'un recalcul automatique, au lieu de le remettre au 1er.
        const prevIdx = Math.max(
          0,
          routeOptionsRef.current.findIndex(
            (o) => o.id === selectedIdRef.current
          )
        );
        setRouteOptions(options || []);
        setSelectedRouteId(
          options?.[Math.min(prevIdx, (options?.length || 1) - 1)]?.id ?? null
        );
      } catch (error) {
        console.warn('[Navigation] Route:', error?.message);
        setRouteOptions([]);
        setSelectedRouteId(null);
      } finally {
        if (requestId === routeRequestIdRef.current) {
          routeLoadingRef.current = false;
          setRouteLoading(false);
        }
      }
    },
    [clientPosition]
  );

  // ✅ ITINÉRAIRE : il PART de la position actuelle du thérapeute.
  //  - 1er calcul immédiat (même avec une position en cache, pour afficher
  //    vite la ligne), PUIS recalcul dès le 1er VRAI relevé GPS si l'ancienne
  //    origine en diffère de plus de 50 m -> la route démarre bien là où il est ;
  //  - ensuite recalcul automatique quand il s'éloigne de > 200 m du dernier
  //    point de calcul (la ligne, elle, démarre toujours sous le marqueur).
  useEffect(() => {
    if (!therapistPosition || routeLoadingRef.current) return;

    const last = lastRouteOriginRef.current;
    const moved = last
      ? haversineDistance(
          last.latitude,
          last.longitude,
          therapistPosition.latitude,
          therapistPosition.longitude
        ) ?? Infinity
      : Infinity;

    const needsRealOrigin = hasRealPosition && !routeFromRealRef.current;
    const threshold = needsRealOrigin ? 0.05 : REROUTE_DISTANCE_KM;

    if (moved > threshold) loadRoute(therapistPosition);
    if (needsRealOrigin) routeFromRealRef.current = true;
  }, [therapistPosition, hasRealPosition, loadRoute]);

  // ==========================================================
  // CENTRER LA CARTE
  // ==========================================================

  const centerMap = useCallback(() => {
    const points =
      routeCoordinates.length > 1
        ? routeCoordinates
        : [therapistPosition, clientPosition].filter(Boolean);

    if (points.length > 1) {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 70, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    } else if (clientPosition) {
      mapRef.current?.animateToRegion({
        ...clientPosition,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    }
  }, [routeCoordinates, therapistPosition, clientPosition]);

  // ✅ MODE NAVIGATION (style Google Maps) : s'active tout seul dès que le
  // thérapeute roule (> 1,5 m/s) et s'arrête s'il reste à l'arrêt ~8 s.
  const [navMode, setNavMode] = useState(false);
  const slowSinceRef = useRef(null);
  useEffect(() => {
    const speed = activeLocation?.speed ?? 0;
    if (!hasRealPosition || !followMe) {
      slowSinceRef.current = null;
      setNavMode(false);
      return;
    }
    if (speed > 1.5) {
      slowSinceRef.current = null;
      setNavMode(true);
    } else if (navMode) {
      if (slowSinceRef.current == null) slowSinceRef.current = Date.now();
      else if (Date.now() - slowSinceRef.current > 8000) setNavMode(false);
    }
  }, [activeLocation, hasRealPosition, followMe, navMode]);

  // Distance / durée RESTANTES, recalculées sur la partie de route non parcourue
  const navRemaining = useMemo(() => {
    if (!navMode || !therapistPosition || !routeCoordinates?.length) return null;
    const proj = projectOnRoute(routeCoordinates, therapistPosition);
    if (!proj) return null;
    const hav = (a, b) => {
      const r = Math.PI / 180;
      const dLat = (b.latitude - a.latitude) * r;
      const dLng = (b.longitude - a.longitude) * r;
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLng / 2) ** 2;
      return 12742 * Math.asin(Math.sqrt(h));
    };
    let km = hav(proj.point, routeCoordinates[proj.index + 1]);
    for (let i = proj.index + 1; i < routeCoordinates.length - 1; i += 1) {
      km += hav(routeCoordinates[i], routeCoordinates[i + 1]);
    }
    const speedKmh = Math.max(15, (activeLocation?.speed ?? 0) * 3.6);
    const baseMin =
      routeInfo?.distance > 0 && routeInfo?.drivingDuration
        ? (km / routeInfo.distance) * routeInfo.drivingDuration
        : (km / speedKmh) * 60;
    return {
      distText: km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km.toFixed(1)} km`,
      minText: `${Math.max(1, Math.round(baseMin))} min`,
    };
  }, [navMode, therapistPosition, routeCoordinates, routeInfo, activeLocation]);

  // ✅ SUIVI DE LA POSITION (activé par défaut) : la carte se recentre sur le
  // thérapeute à chaque seconde SANS toucher au zoom (panTo). Le zoom est
  // réglé une seule fois à l'activation. Le bouton "navigate" le coupe pour
  // pouvoir déplacer / zoomer librement ; "locate" cadre tout l'itinéraire.
  useEffect(() => {
    if (!followMe) {
      followZoomSetRef.current = false;
      return;
    }
    if (!mapReady || !therapistPosition || !mapRef.current) return;

    // Mode navigation : caméra inclinée, tournée dans le sens de la marche,
    // marqueur dans le tiers inférieur de l'écran (centre décalé vers l'avant)
    if (navMode) {
      const h = activeLocation?.heading;
      const heading = Number.isFinite(h) ? h : null;
      let center = therapistPosition;
      if (heading != null) {
        const r = Math.PI / 180;
        const aheadM = 70;
        center = {
          latitude: therapistPosition.latitude + (aheadM / 111320) * Math.cos(heading * r),
          longitude:
            therapistPosition.longitude +
            (aheadM / (111320 * Math.cos(therapistPosition.latitude * r))) * Math.sin(heading * r),
        };
      }
      mapRef.current.followCamera?.({ center, heading, pitch: 55, zoom: 18, duration: 900 });
      followZoomSetRef.current = true;
      navWasOnRef.current = true;
      return;
    }
    if (navWasOnRef.current) {
      navWasOnRef.current = false;
      mapRef.current.resetCamera?.();
      followZoomSetRef.current = false;
    }

    if (!followZoomSetRef.current) {
      mapRef.current.animateToRegion(
        { ...therapistPosition, latitudeDelta: 0.008, longitudeDelta: 0.008 },
        600
      );
      followZoomSetRef.current = true;
    } else {
      mapRef.current.panTo(therapistPosition, 900);
    }
  }, [followMe, mapReady, therapistPosition, navMode, activeLocation]);

  // ==========================================================
  // ACTIONS
  // ==========================================================

  const refreshGps = () => {
    stopTracking();
    setTimeout(() => startTracking(), 150);
  };

  // ==========================================================
  // PARTAGE DE LA POSITION AU CLIENT (WebSocket)
  // ==========================================================

  // Envoie la position ACTIVE au client. Ne renvoie JAMAIS une position en
  // cache (ancienne) : le client verrait le thérapeute au mauvais endroit.
  const sendCurrentLocation = useCallback(() => {
    const loc = gpsLocationRef.current;
    if (!loc || loc.cached) return false;

    const sent = socketRef.current?.send({
      type: 'location_update',
      latitude: loc.latitude,
      longitude: loc.longitude,
      heading: loc.heading,
      speed: loc.speed,
      accuracy: loc.accuracy,
    });

    if (sent) {
      lastSendRef.current = Date.now();
      setLastSentAt(Date.now());
    }
    return !!sent;
  }, []);

  const startSharing = useCallback(() => {
    if (!bookingId) {
      Alert.alert('Erreur', 'Réservation introuvable.');
      return;
    }
    // (le token manquant est géré par trackingSocket : relecture AsyncStorage)
    socketRef.current?.close();
    setShareError('');
    lastSendRef.current = 0;

    socketRef.current = createTrackingSocket({
      bookingId,
      token,
      onStatusChange: (status) => {
        setSocketStatus(status);
        // (Re)connecté : annonce le début du partage + position immédiate
        if (status === 'connected') {
          // ETA + distance : insérés dans la notification du client
          socketRef.current?.send({
            type: 'tracking_started',
            eta: routeInfoRef.current?.drivingDurationText || null,
            distance: routeInfoRef.current?.distanceText || null,
          });
          // Position réelle immédiate (si on a déjà un vrai relevé)
          sendCurrentLocation();
        }
      },
      onMessage: (msg) => {
        if (!msg?.error) return;

        const reasons = {
          missing_token: 'token manquant',
          invalid_token: 'token invalide ou expiré',
        };
        const text = reasons[msg.reason]
          ? `${msg.error} (${reasons[msg.reason]})`
          : msg.error;
        setShareError(text);

        // ✅ Erreur FATALE (auth / droits / réservation) : on ne laisse pas
        // le bouton rouge "en cours" alors que rien n'est envoyé.
        if (
          ['Authentication failed', 'Not authorized', 'Booking not found'].includes(
            msg.error
          )
        ) {
          socketRef.current?.close();
          socketRef.current = null;
          setIsSharing(false);
          setSocketStatus('idle');
          Alert.alert(
            'Partage impossible',
            `${text}\n\nReconnectez-vous puis réessayez.`
          );
        }
      },
    });

    setIsSharing(true);
  }, [bookingId, token, sendCurrentLocation]);

  const stopSharing = useCallback(() => {
    socketRef.current?.send({ type: 'tracking_stopped' });
    socketRef.current?.close();
    socketRef.current = null;
    setIsSharing(false);
    setSocketStatus('idle');
  }, []);

  // Envoi à CHAQUE nouvelle position (limité à 1 par seconde)
  useEffect(() => {
    if (!isSharing || !activeLocation || activeLocation.cached) return;
    if (Date.now() - lastSendRef.current < SHARE_MIN_INTERVAL_MS) return;
    sendCurrentLocation();
  }, [activeLocation, isSharing, sendCurrentLocation]);

  // Battement de cœur : si la position ne change pas (arrêt, position
  // manuelle), on renvoie quand même toutes les ~4 s pour que le client voie
  // que le partage est toujours actif.
  useEffect(() => {
    if (!isSharing) return undefined;
    const timer = setInterval(() => {
      if (Date.now() - lastSendRef.current >= 3500) sendCurrentLocation();
    }, 2000);
    return () => clearInterval(timer);
  }, [isSharing, sendCurrentLocation]);

  // Ferme la socket en quittant l'écran
  useEffect(
    () => () => {
      socketRef.current?.close();
      socketRef.current = null;
    },
    []
  );

  const shareStatusText = (() => {
    if (shareError) return `⚠️ ${shareError}`;
    if (socketStatus === 'connecting') return 'Connexion au serveur…';
    if (socketStatus === 'reconnecting') return 'Connexion perdue — reconnexion…';
    if (socketStatus === 'connected') {
      const time = lastSentAt
        ? new Date(lastSentAt).toLocaleTimeString('fr-FR')
        : '…';
      return `🔴 En direct · dernier envoi ${time} · gardez l'application ouverte`;
    }
    return '';
  })();

  const handleMapPress = useCallback(
    (coord) => {
      if (!pickingPosition || !coord) return;
      setManualPosition({
        latitude: coord.latitude,
        longitude: coord.longitude,
        at: Date.now(),
      });
      setPickingPosition(false);
      setFollowMe(true);
    },
    [pickingPosition]
  );

  // Indicateur de fiabilité de la position affichée
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

  const onChipPress = () => {
    if (!positionChip?.action) return;
    if (positionChip.action === 'gps') setManualPosition(null);
    else if (positionChip.action === 'pick') setPickingPosition(true);
    else if (positionChip.action === 'cancel') setPickingPosition(false);
  };

  const openDirections = async () => {
    const origin = therapistPosition
      ? `&origin=${therapistPosition.latitude},${therapistPosition.longitude}`
      : '';

    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${clientPosition.latitude},${clientPosition.longitude}&travelmode=driving`;

    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir Google Maps.");
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Header title="Navigation vers le client" showBack />

      {/* ==================================================
          CARTE — occupe tout l'écran restant. Le bandeau bas
          flotte désormais au-dessus, pour une carte agrandie.
          `showMapTypeControl` (par défaut) affiche le bouton
          satellite/plan maison en HAUT-GAUCHE : nos propres
          éléments (recentrer, adresse) restent donc à DROITE.
      ================================================== */}

      <View
        style={styles.screenArea}
        onLayout={(e) => setScreenSize(e.nativeEvent.layout)}
      >
        <View
          style={[
            styles.mapArea,
            // ✅ Dimensions explicites (voir commentaire plus haut) —
            // tant que la mesure n'est pas encore arrivée, on garde
            // le repli `absoluteFillObject` défini dans les styles.
            screenSize && {
              width: screenSize.width,
              height: screenSize.height,
            },
          ]}
        >
          {/* ✅ Carte identique à celle du client : ligne rouge pleine qui
              suit la vraie route + flèches, marqueur qui glisse chaque
              seconde, ligne qui se consomme, pointillés vers l'adresse. */}
          <LiveRouteMap
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: therapistPosition?.latitude ?? clientPosition.latitude,
              longitude: therapistPosition?.longitude ?? clientPosition.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}
            onMapReady={() => setMapReady(true)}
            onMapPress={handleMapPress}
            // ✅ Position GPS RÉELLE (jamais l'ancienne position en cache)
            mover={hasRealPosition ? therapistPosition : null}
            moverHeading={activeLocation?.heading ?? null}
            moverSpeed={activeLocation?.speed ?? null}
            moverAccuracy={activeLocation?.accuracy ?? null}
            moverTitle="Départ — votre position actuelle"
            moverDescription={currentAddress || 'Position GPS en direct'}
            moverColor={ROUTE_COLOR}
            destination={clientPosition}
            destinationTitle="Arrivée — client"
            destinationDescription={clientAddress}
            destinationColor={DEST_COLOR}
            routeCoordinates={routeCoordinates}
            routeIsFallback={!routeInfo || !!routeInfo.isFallback}
            routeColor={ROUTE_COLOR}
            routeWidth={6}
            navMode={navMode}
            showUserLocation={false}
            trackUserLocation={false}
            showMapTypeControl
          />
        </View>

        {/* Recentrer — bouton flottant discret, seul en haut à droite */}
        <TouchableOpacity
          style={[
            styles.locateButton,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border || '#E5E5E5',
            },
          ]}
          onPress={() => {
            setFollowMe(false);
            centerMap();
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="locate" size={20} color={PRIMARY} />
        </TouchableOpacity>

        {/* Suivre ma position (la carte se recentre à chaque mouvement) */}
        <TouchableOpacity
          style={[
            styles.locateButton,
            styles.followButton,
            {
              backgroundColor: followMe ? PRIMARY : themeColors.surface,
              borderColor: themeColors.border || '#E5E5E5',
            },
          ]}
          onPress={() => setFollowMe((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons
            name="navigate"
            size={20}
            color={followMe ? '#FFFFFF' : PRIMARY}
          />
        </TouchableOpacity>

        {navMode && navRemaining ? (
          <View style={styles.navChip} pointerEvents="none">
            <Text style={styles.navChipMain}>{navRemaining.minText}</Text>
            <Text style={styles.navChipSub}>{navRemaining.distText}</Text>
          </View>
        ) : null}

        {/* Poser MA position réelle sur la carte (web) */}
        <TouchableOpacity
          style={[
            styles.locateButton,
            styles.pickButton,
            {
              backgroundColor: pickingPosition ? '#6A1B9A' : themeColors.surface,
              borderColor: themeColors.border || '#E5E5E5',
            },
          ]}
          onPress={() => setPickingPosition((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons name="pin" size={20} color={pickingPosition ? '#FFFFFF' : '#6A1B9A'} />
        </TouchableOpacity>

        {positionChip ? (
          <TouchableOpacity
            style={[styles.positionChip, { backgroundColor: positionChip.color }]}
            onPress={onChipPress}
            disabled={!positionChip.action}
            activeOpacity={0.85}
          >
            <Text style={styles.positionChipText} numberOfLines={2}>
              {positionChip.text}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Bloc ancré en BAS DROITE de la carte uniquement :
            le côté gauche reste totalement libre (contrôle
            natif "satellite" en haut-gauche, zoom Google Maps
            déplacé en bas-gauche côté web). Alerte GPS (si
            besoin) puis, juste au-dessus du bandeau du trajet,
            le badge adresse. */}
        <View
          style={[
            styles.mapBottomOverlay,
            { bottom: bottomSheetHeight + spacing.sm },
          ]}
          onLayout={(e) => setOverlayHeight(e.nativeEvent.layout.height)}
          pointerEvents="box-none"
        >
          {gpsError && !therapistPosition ? (
            <View style={styles.gpsWarning}>
              <Ionicons name="warning-outline" size={14} color="#92400E" />
              <Text style={styles.gpsWarningText}>{gpsError}</Text>
              <TouchableOpacity onPress={refreshGps}>
                <Text style={styles.gpsWarningRetry}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ✅ CARD UNIQUE : Adresse + Distance/Temps fusionnés */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border || '#E5E5E5',
              },
            ]}
          >
            {/* Ligne 0 : MA position actuelle (adresse où je suis en ce moment) */}
            <View style={styles.addressRow}>
              <View
                style={[
                  styles.addressIcon,
                  { backgroundColor: `${ROUTE_COLOR}15` },
                ]}
              >
                <Ionicons name="radio-button-on" size={14} color={ROUTE_COLOR} />
              </View>

              <View style={styles.addressTextWrap}>
                <Text
                  style={[
                    styles.addressLabel,
                    { color: themeColors.textSecondary },
                  ]}
                >
                  Votre position actuelle
                </Text>

                <Text
                  style={[styles.addressValue, { color: themeColors.text }]}
                  numberOfLines={2}
                >
                  {currentAddress ||
                    (hasRealPosition
                      ? "Recherche de l'adresse…"
                      : 'Recherche du GPS…')}
                </Text>
              </View>
            </View>

            {/* Ligne 1 : Adresse */}
            <View style={styles.addressRow}>
              <View
                style={[
                  styles.addressIcon,
                  { backgroundColor: `${END_COLOR}15` },
                ]}
              >
                <Ionicons name="location" size={14} color={END_COLOR} />
              </View>

              <View style={styles.addressTextWrap}>
                <Text
                  style={[
                    styles.addressLabel,
                    { color: themeColors.textSecondary },
                  ]}
                >
                  Adresse du client
                </Text>

                <Text
                  style={[styles.addressValue, { color: themeColors.text }]}
                  numberOfLines={2}
                >
                  {clientAddress}
                </Text>

                {bookingId ? (
                  <Text
                    style={[
                      styles.addressBookingId,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    Réservation #{bookingId}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Ligne 2 : Stats (Distance, Voiture, À pied) */}
            <View
              style={[
                styles.routeInfoRow,
                { borderTopColor: themeColors.border || '#E5E5E5' },
              ]}
            >
              <View style={styles.routeInfoItem}>
                <Ionicons name="navigate-outline" size={14} color={END_COLOR} />
                <Text
                  style={[
                    styles.routeInfoLabel,
                    { color: themeColors.textSecondary },
                  ]}
                >
                  Distance
                </Text>
                <Text
                  style={[styles.routeInfoValue, { color: themeColors.text }]}
                >
                  {routeInfo?.distanceText || formatDistance(straightDistance)}
                </Text>
              </View>

              <View
                style={[
                  styles.routeInfoDivider,
                  { backgroundColor: themeColors.border || '#E5E5E5' },
                ]}
              />

              <View style={styles.routeInfoItem}>
                <Ionicons name="car-outline" size={14} color={PRIMARY} />
                <Text
                  style={[
                    styles.routeInfoLabel,
                    { color: themeColors.textSecondary },
                  ]}
                >
                  Voiture
                </Text>

                {routeLoading ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Text
                    style={[styles.routeInfoValue, { color: themeColors.text }]}
                  >
                    {routeInfo?.drivingDurationText || '—'}
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.routeInfoDivider,
                  { backgroundColor: themeColors.border || '#E5E5E5' },
                ]}
              />

              <View style={styles.routeInfoItem}>
                <Ionicons name="walk-outline" size={14} color={PRIMARY} />
                <Text
                  style={[
                    styles.routeInfoLabel,
                    { color: themeColors.textSecondary },
                  ]}
                >
                  À pied
                </Text>

                {routeLoading ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Text
                    style={[styles.routeInfoValue, { color: themeColors.text }]}
                  >
                    {routeInfo?.walkingDurationText || '—'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ✅ Bouton SOS (repris de l'ancien écran "Suivi en direct") :
            ancré en bas à gauche, juste au-dessus du bloc adresse/stats. */}
        <View
          style={[
            styles.sosButtonContainer,
            { bottom: bottomSheetHeight + overlayHeight + spacing.md },
          ]}
          pointerEvents="box-none"
        >
          <SOSButton bookingId={bookingId} />
        </View>

        {/* ==================================================
            BANDEAU BAS — flotte désormais au-dessus de la carte
            (au lieu d'un bloc séparé qui réduisait la carte).
            Regroupe légende, distance/durée et l'action
            principale.
        ================================================== */}

        <View
          onLayout={(e) => setBottomSheetHeight(e.nativeEvent.layout.height)}
          style={[
            styles.bottomSheetFloating,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border || '#E5E5E5',
            },
          ]}
        >
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ROUTE_COLOR }]} />
              <Text
                style={[styles.legendText, { color: themeColors.textSecondary }]}
              >
                Vous
              </Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: DEST_COLOR }]} />
              <Text
                style={[styles.legendText, { color: themeColors.textSecondary }]}
              >
                Client
              </Text>
            </View>
          </View>

          {/* ✅ Choix de l'itinéraire (le plus rapide + alternatives) */}
          {routeOptions.length > 1 && (
            <View style={styles.routeOptionsList}>
              {routeOptions.map((option, index) => {
                const active = option.id === routeInfo?.id;

                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedRouteId(option.id)}
                    style={[
                      styles.routeOption,
                      {
                        borderColor: active
                          ? PRIMARY
                          : themeColors.border || '#E5E5E5',
                      },
                      active && { backgroundColor: `${PRIMARY}12` },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.routeOptionTitle,
                        { color: themeColors.text },
                      ]}
                    >
                      {`${index + 1}. ${option.tag}`}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.routeOptionMeta,
                        { color: themeColors.textSecondary },
                      ]}
                    >
                      {`🚗 ${option.drivingDurationText}  ·  🚶 ${option.walkingDurationText}  ·  ${option.distanceText}`}
                    </Text>

                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={PRIMARY}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ✅ ENVOYER / ARRÊTER LE PARTAGE DE POSITION AU CLIENT */}
          <TouchableOpacity
            style={[
              styles.shareButton,
              isSharing
                ? { backgroundColor: END_COLOR, borderColor: END_COLOR }
                : { borderColor: START_COLOR },
            ]}
            onPress={isSharing ? stopSharing : startSharing}
            disabled={!hasRealPosition && !isSharing}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isSharing ? 'stop-circle' : 'paper-plane'}
              size={20}
              color={isSharing ? '#FFFFFF' : START_COLOR}
            />
            <Text
              style={[
                styles.shareButtonText,
                { color: isSharing ? '#FFFFFF' : START_COLOR },
              ]}
            >
              {isSharing
                ? 'Arrêter le partage de position'
                : 'Envoyer ma position au client'}
            </Text>
          </TouchableOpacity>

          {(isSharing || shareError) && shareStatusText ? (
            <Text
              style={[styles.shareStatus, { color: themeColors.textSecondary }]}
            >
              {shareStatusText}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.startButton}
            onPress={openDirections}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[PRIMARY, `${PRIMARY}CC`]}
              style={styles.startButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="navigate" size={20} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Démarrer l'itinéraire</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1 },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  loadingText: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },

  // ==========================================================
  // CARTE — occupe désormais tout l'écran (le bandeau bas
  // flotte par-dessus au lieu de réduire son espace).
  // ==========================================================

  screenArea: { flex: 1, position: 'relative' },

  mapArea: { ...StyleSheet.absoluteFillObject },

  map: { flex: 1 },

  mapBottomOverlay: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: 230,
    gap: spacing.sm,
  },

  // ==========================================================
  // CARD UNIQUE (Adresse + Stats)
  // ==========================================================

  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
    gap: spacing.xs,
  },

  // --- Ligne Adresse ---
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },

  addressIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressTextWrap: { flex: 1, minWidth: 0 },

  addressLabel: { fontSize: 10, marginBottom: 2 },

  addressValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    lineHeight: 18,
  },

  addressBookingId: { fontSize: 10, marginTop: 3 },

  // --- Ligne Stats (Distance / Voiture / À pied) ---
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },

  routeInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Réduit pour les petits écrans
  },

  routeInfoDivider: { width: 1, height: 20, marginHorizontal: 4 },

  routeInfoLabel: { fontSize: 10 }, // Réduit

  routeInfoValue: {
    fontSize: typography.fontSize.xs, // Réduit
    fontFamily: typography.fontFamily.bold,
  },

  // ==========================================================
  // BOUTON RECENTRER & GPS
  // ==========================================================

  locateButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 2,
  },

  followButton: { top: spacing.sm + 52 },

  pickButton: { top: spacing.sm + 104 },

  navChip: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: '#1B5E20',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 4,
  },
  navChipMain: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  navChipSub: { color: '#C8E6C9', fontSize: 12, fontWeight: '600' },

  positionChip: {
    position: 'absolute',
    top: spacing.sm + 52,
    left: spacing.sm,
    maxWidth: '62%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 2,
    elevation: 4,
  },

  positionChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // ✅ Conteneur du bouton SOS : ANCRÉ en absolu dans la carte (avant, ce
  // style n'existait pas -> le conteneur n'était pas positionné et le
  // bouton SOS s'affichait mal / hors de la carte, surtout sur le web).
  // `bottom` est calculé dynamiquement (hauteurs mesurées des blocs bas).
  sosButtonContainer: {
    position: 'absolute',
    left: spacing.sm,
    zIndex: 10,
    elevation: 10,
  },

  shareButton: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 2,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  shareButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
  },

  shareStatus: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  gpsWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },

  gpsWarningText: { flex: 1, color: '#92400E', fontSize: 11 },

  gpsWarningRetry: {
    color: START_COLOR,
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
  },

  // ==========================================================
  // BANDEAU BAS — flotte au-dessus de la carte agrandie
  // ==========================================================

  bottomSheetFloating: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    borderRadius: 22,
    borderWidth: 1,
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },

  legendRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },

  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  legendDot: { width: 8, height: 8, borderRadius: 4 },

  legendText: { fontSize: typography.fontSize.xs },

  routeOptionsList: { marginBottom: spacing.md, gap: 6 },

  routeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  routeOptionTitle: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bold,
  },

  routeOptionMeta: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },

  startButton: {
    minHeight: 50,
    borderRadius: 13,
    overflow: 'hidden',
  },

  startButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
  },
});