// ============================================================
// src/screens/client/TrackingScreen.js
//
// FIX COMPLET demandé:
//
// 1. ✅ CARTE WEB = CARTE ANDROID
//    Teo aloha dia "placeholder" tsotra (icône + texte) no niseho
//    tamin'ny web ("Disponible sur l'application mobile"). Eto dia
//    ny <MapView> MARINA (MapViewWrapper — Google Maps JS API amin'ny
//    web, react-native-maps amin'ny mobile) no ampiasaina amin'ny
//    PLATEFORME ROA, ka mitovy tanteraka ny fisehony.
//
// 2. ✅ LALANA MENA (itinéraire rouge) MANARAKA NY LALAM-BE MARINA
//    Miantso ny Google Directions API (avy amin'ny position actuelle
//    an'ny thérapeute mankany amin'ny adresse an'ny booking) ary
//    "décoder" ny polyline azo avy any mba hisehoan'ny lalana marina
//    (tsy tsipika mahitsy fotsiny), atao MENA (#E53935) mitovy
//    amin'ny web sy ny mobile (jereo ny fanavaozana natao tao amin'ny
//    MapViewWrapper.js: prop "route").
//
// 3. ✅ ANGONA REAL (tsy misy simulation/mock)
//    - Booking marina: bookingService.getBooking(bookingId)
//    - Thérapeute assigné marina: therapistService.getTherapist(id)
//      (photo, téléphone, note, expérience, statut en ligne, position
//      actuelle) — averina isaky ny 12 segondra mba hanaraka azy.
//    - Distance + durée ARRIVÉE ESTIMÉE marina, avy amin'ny valiny
//      Google Directions (distance.text / duration.text).
//
// 5. ✅ SUIVI EN DIRECT PAR WEBSOCKET (/ws/tracking/{bookingId})
//    Rehefa tsindriana ny bouton "Envoyer ma position" ao amin'ny
//    thérapeute, ny position-ny dia miseho avy hatrany eto amin'ny
//    carte ary mihetsika isaky ny mihetsika izy (tsy mila miandry ny
//    polling 12 s). Ny polling dia mijanona ho secours raha tapaka ny
//    WebSocket.
//
// 4. ✅ PROFIL THÉRAPEUTE miseho tsara ambany carte (avatar carré à
//    bords arrondis, note, expérience, statut en ligne, téléphone,
//    boutons Contacter / Appeler).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import * as Location from 'expo-location';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { spacing, typography } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import useShareToChat from '../../hooks/useShareToChat';
import SOSButton from '../../components/sos/SOSButton';

import bookingService from '../../services/bookingService';
import therapistService from '../../services/therapistService';
import { geocodeAddress } from '../../services/geocoding';
import { createTrackingSocket } from '../../services/trackingSocket';
// ✅ calculateRoute : Google JS SDK (web) / Directions (mobile) -> OSRM -> ligne droite
import { calculateRoute } from '../../services/routing';

// ✅ Importer depuis le wrapper (carte identique web / mobile)
import LiveRouteMap from '../../components/map/LiveRouteMap';

// ============================================================
// CONSTANTES
// ============================================================

const ROUTE_COLOR = '#E53935'; // rouge, comme demandé
const PRIMARY = '#2E7D32'; // vert, cohérent avec le thème de la page Welcome
const REFRESH_INTERVAL_MS = 12000; // rafraîchissement position + itinéraire
const ARRIVED_THRESHOLD_KM = 0.12; // ~120 m => considéré "arrivé"
const LIVE_FRESH_MS = 20000; // position WebSocket considérée "fraîche"
const ROUTE_MIN_MOVE_KM = 0.08; // recalcul itinéraire si > 80 m ...
const ROUTE_MIN_INTERVAL_MS = 20000; // ... ou toutes les 20 s

// ============================================================
// HELPERS — DISTANCE (secours si Directions API indisponible)
// ============================================================

const toRad = (value) => (value * Math.PI) / 180;

const haversineKm = (a, b) => {
  if (!a || !b) return null;

  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// ============================================================
// HELPER — ITINÉRAIRE RÉEL (suit les vraies routes)
//
// ✅ FIXÉ : avant, on appelait l'API REST Google Directions avec axios.
// Sur le web c'est bloqué par CORS (et souvent refusé par la clé sur
// mobile) -> on retombait sur une LIGNE DROITE [origine, destination].
// Maintenant on utilise routing.calculateRoute qui essaie dans l'ordre :
//   web    : Google DirectionsService (JS SDK) -> OSRM -> ligne droite
//   mobile : Google Directions REST             -> OSRM -> ligne droite
// Renvoie { coordinates, distanceText, durationText, distanceKm,
// durationMinutes, isFallback } ou null.
// ============================================================

const fetchRoute = async (origin, destination) => {
  if (!origin || !destination) return null;

  try {
    const r = await calculateRoute(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
      'driving'
    );

    if (r?.coordinates?.length > 1) {
      return {
        coordinates: r.coordinates,
        distanceText: r.distanceText || null,
        durationText: r.durationText || null,
        distanceKm: r.distance ?? null,
        durationMinutes: r.duration != null ? Math.round(r.duration) : null,
        isFallback: !!r.isFallback,
      };
    }
    return null;
  } catch (error) {
    console.warn('⚠️ [Route] Erreur:', error?.message);
    return null;
  }
};

// ============================================================
// STATUS
// ============================================================

const normalizeBookingStatus = (status) =>
  String(status || 'pending').trim().toLowerCase();

const getStatusInfo = (status) => {
  const map = {
    waiting: {
      label: 'En attente du thérapeute',
      icon: 'time-outline',
      color: '#FFA726',
    },
    en_route: {
      label: 'Le thérapeute est en route',
      icon: 'walk-outline',
      color: '#4CAF50',
    },
    arrived: {
      label: 'Le thérapeute est arrivé',
      icon: 'checkmark-circle-outline',
      color: PRIMARY,
    },
    in_progress: {
      label: 'Massage en cours',
      icon: 'body-outline',
      color: '#2196F3',
    },
  };
  return map[status] || map.waiting;
};

// ============================================================
// THERAPIST AVATAR — carré à bords arrondis (cohérent avec le
// reste de l'application), avec pastille "en ligne".
// ============================================================

const TherapistPhoto = ({ photoUrl, name, online, size = 62 }) => {
  const [failed, setFailed] = useState(false);
  const showImage = !!photoUrl && !failed;

  const dimension = { width: size, height: size, borderRadius: size * 0.28 };
  const initial = String(name || 'T').trim().charAt(0).toUpperCase();

  return (
    <View style={{ position: 'relative' }}>
      {showImage ? (
        <Image
          source={{ uri: photoUrl }}
          style={[photoStyles.image, dimension]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[photoStyles.fallback, dimension]}>
          <Text style={[photoStyles.fallbackText, { fontSize: size * 0.36 }]}>
            {initial}
          </Text>
        </View>
      )}
      {online ? <View style={photoStyles.onlineDot} /> : null}
    </View>
  );
};

const photoStyles = StyleSheet.create({
  image: {
    backgroundColor: `${PRIMARY}15`,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 3px 8px rgba(0,0,0,0.15)' },
      default: { elevation: 3 },
    }),
  },
  fallback: {
    backgroundColor: `${PRIMARY}20`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 3px 8px rgba(0,0,0,0.15)' },
      default: { elevation: 3 },
    }),
  },
  fallbackText: { color: PRIMARY, fontWeight: '900' },
  onlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#4CAF50',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
});

// ============================================================
// SCREEN
// ============================================================

const TrackingScreen = ({ navigation, route: navRoute }) => {
  const { bookingId, sharedPosition } = navRoute.params || {};
  const { colors: themeColors } = useTheme();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { shareBooking, busy: sharing, host: shareHost } = useShareToChat({
    navigation,
    role: 'client',
  });
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const _isSmallScreen = screenWidth < 600;
  const _isTabletWidth = screenWidth >= 768;
  const isDesktopWidth = screenWidth >= 1100;

  const mapHeight = Platform.OS === 'web'
    ? Math.min(screenHeight * (isDesktopWidth ? 0.78 : 0.65), isDesktopWidth ? 780 : 620)
    : Math.min(screenHeight * 0.58, 560);

  const [booking, setBooking] = useState(null);
  const [therapistProfile, setTherapistProfile] = useState(null);

  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null); // adresse du client (demande)
  const [therapistLocation, setTherapistLocation] = useState(null); // position actuelle réelle

  const [routeInfo, setRouteInfo] = useState(null); // { coordinates, distanceText, durationText, ... }

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshingLocation, setRefreshingLocation] = useState(false);

  // ✅ Suivi en direct (WebSocket)
  const [liveActive, setLiveActive] = useState(false); // le thérapeute partage
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [lastLiveAt, setLastLiveAt] = useState(null);
  // cap / vitesse / précision du GPS du thérapeute (flèche + cercle sur la carte)
  const [therapistMeta, setTherapistMeta] = useState({ heading: null, speed: null, accuracy: null });

  const mapRef = useRef(null);
  const pollTimerRef = useRef(null);
  const therapistLocationRef = useRef(null);
  const destinationRef = useRef(null);
  const lastSocketUpdateRef = useRef(0);
  const lastRouteRef = useRef(null); // { pos, at }

  // Met à jour la position du thérapeute (état + ref, lisible sans
  // recréer les callbacks / intervalles)
  const updateTherapistLocation = useCallback((pos) => {
    therapistLocationRef.current = pos;
    setTherapistLocation(pos);
  }, []);

  // ==========================================================
  // 0. POSITION « EN ROUTE » REÇUE DANS LA MESSAGERIE
  //
  // Quand le client touche le message « Thérapeute en route » dans la
  // conversation, la position partagée est transmise ici (sharedPosition).
  // On l'affiche tout de suite ; le suivi en direct (WebSocket) et le
  // rafraîchissement périodique prennent le relais ensuite.
  // ==========================================================

  const sharedLat = sharedPosition?.latitude;
  const sharedLng = sharedPosition?.longitude;
  const sharedAt = sharedPosition?.at;
  const hasSharedPosition =
    sharedLat != null &&
    sharedLng != null &&
    Number.isFinite(Number(sharedLat)) &&
    Number.isFinite(Number(sharedLng));

  useEffect(() => {
    if (!hasSharedPosition) return;

    const pos = { latitude: Number(sharedLat), longitude: Number(sharedLng) };

    // « frais » pendant LIVE_FRESH_MS : le profil (position en base, plus
    // ancienne) n'écrase pas la position partagée.
    lastSocketUpdateRef.current = Date.now();
    updateTherapistLocation(pos);

    if (destinationRef.current) {
      updateRoute(pos, destinationRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSharedPosition, sharedLat, sharedLng, sharedAt]);

  // ==========================================================
  // 1. CHARGER LA RÉSERVATION RÉELLE
  // ==========================================================

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setLoadError('Identifiant de réservation manquant.');
      setIsLoading(false);
      return null;
    }

    try {
      const result = await bookingService.getBooking(bookingId);

      if (!result?.success || !result?.data) {
        throw new Error(
          result?.error || 'Impossible de charger la réservation.'
        );
      }

      setBooking(result.data);
      setLoadError('');
      return result.data;
    } catch (error) {
      console.error('❌ [TRACKING] loadBooking:', error);
      setLoadError(
        error?.message || 'Impossible de charger le suivi de la réservation.'
      );
      return null;
    }
  }, [bookingId]);

  // ==========================================================
  // 2. DESTINATION RÉELLE (adresse de la demande du client)
  //
  // Priorité: client_latitude/client_longitude déjà enregistrés
  // sur le booking. Sinon, on géocode l'adresse texte en dernier
  // recours (geocoding.js — même service que le reste de l'app).
  // ==========================================================

  const resolveDestination = useCallback(async (bookingData) => {
    if (!bookingData) return null;

    const lat = Number(bookingData?.client_latitude);
    const lng = Number(bookingData?.client_longitude);

    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { latitude: lat, longitude: lng };
    }

    const address =
      bookingData?.address ??
      bookingData?.client_location ??
      bookingData?.location;

    if (!address) return null;

    try {
      const geocoded = await geocodeAddress(address);
      if (geocoded?.latitude && geocoded?.longitude) {
        return { latitude: geocoded.latitude, longitude: geocoded.longitude };
      }
    } catch (error) {
      console.warn('⚠️ [TRACKING] Géocodage adresse impossible:', error.message);
    }

    return null;
  }, []);

  // ==========================================================
  // 3. PROFIL + POSITION RÉELLE DU THÉRAPEUTE ASSIGNÉ
  // ==========================================================

  const loadTherapist = useCallback(async (therapistId) => {
    if (!therapistId) return null;

    try {
      const result = await therapistService.getTherapist(therapistId);

      if (result?.success && result?.data) {
        setTherapistProfile(result.data);

        const lat = Number(result.data?.latitude);
        const lng = Number(result.data?.longitude);

        // ✅ Si la position WebSocket est fraîche, on NE l'écrase PAS avec
        // la dernière position (plus ancienne) enregistrée en base.
        const isLive = Date.now() - lastSocketUpdateRef.current < LIVE_FRESH_MS;

        if (
          !isLive &&
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          (lat !== 0 || lng !== 0)
        ) {
          updateTherapistLocation({ latitude: lat, longitude: lng });
        }

        return result.data;
      }
    } catch (error) {
      console.warn('⚠️ [TRACKING] Profil thérapeute indisponible:', error.message);
    }

    return null;
  }, [updateTherapistLocation]);

  // ==========================================================
  // 4. POSITION DE L'UTILISATEUR (utile pour "showsUserLocation")
  // ==========================================================

  const getUserLocation = useCallback(async () => {
    try {
      const { status: permissionStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (permissionStatus !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.warn('⚠️ [TRACKING] Position utilisateur indisponible:', error.message);
    }
  }, []);

  // ==========================================================
  // 5. RAFRAÎCHIR ITINÉRAIRE (thérapeute → adresse client)
  // ==========================================================

  const refreshRoute = useCallback(async (origin, dest) => {
    if (!origin || !dest) {
      setRouteInfo(null);
      return;
    }

    const directions = await fetchRoute(origin, dest);

    if (directions?.coordinates?.length) {
      setRouteInfo(directions);
    } else {
      // Secours: ligne directe + distance approximative, tsy misy
      // "lalana" marina fa mba tsy ho banga ny carte.
      setRouteInfo({
        coordinates: [origin, dest],
        isFallback: true,
        distanceText: null,
        durationText: null,
        distanceKm: haversineKm(origin, dest),
        durationMinutes: null,
      });
    }
  }, []);

  // ✅ Recalcul d'itinéraire LIMITÉ : au plus 1 appel Directions toutes
  // les 20 s, ou dès que le thérapeute a bougé de > 80 m.
  const updateRoute = useCallback(
    async (origin, dest) => {
      if (!origin || !dest) {
        await refreshRoute(origin, dest);
        return;
      }

      const last = lastRouteRef.current;
      const moved = last ? haversineKm(last.pos, origin) : Infinity;

      if (
        last &&
        moved < ROUTE_MIN_MOVE_KM &&
        Date.now() - last.at < ROUTE_MIN_INTERVAL_MS
      ) {
        return;
      }

      lastRouteRef.current = { pos: origin, at: Date.now() };
      await refreshRoute(origin, dest);
    },
    [refreshRoute]
  );

  // ==========================================================
  // CYCLE PRINCIPAL: charge + rafraîchit périodiquement
  // ==========================================================

  const runFullRefresh = useCallback(
    async (showLoader) => {
      if (showLoader) setIsLoading(true);
      else setRefreshingLocation(true);

      const bookingData = await loadBooking();

      if (bookingData) {
        const dest = await resolveDestination(bookingData);
        destinationRef.current = dest;
        setDestination(dest);

        const therapistId =
          bookingData?.therapist_id ?? bookingData?.therapist?.id ?? null;

        await loadTherapist(therapistId);

        // Position la plus récente (WebSocket si fraîche, sinon profil)
        const originForRoute = therapistLocationRef.current;

        await updateRoute(originForRoute, dest);
      }

      setIsLoading(false);
      setRefreshingLocation(false);
    },
    [loadBooking, resolveDestination, loadTherapist, updateRoute]
  );

  useEffect(() => {
    runFullRefresh(true);
    getUserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rafraîchissement périodique (position + itinéraire "en direct")
  useEffect(() => {
    pollTimerRef.current = setInterval(() => {
      runFullRefresh(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFullRefresh]);

  // ==========================================================
  // ✅ SUIVI EN DIRECT — WebSocket
  // Reçoit la position du thérapeute à chaque déplacement et met à
  // jour le marqueur + l'itinéraire immédiatement.
  // ==========================================================

  const applyLivePosition = useCallback(
    (msg) => {
      // ⚠️ Number(null) === 0 : on rejette explicitement null/undefined
      if (msg?.latitude == null || msg?.longitude == null) return;
      const lat = Number(msg.latitude);
      const lng = Number(msg.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const pos = { latitude: lat, longitude: lng };

      lastSocketUpdateRef.current = Date.now();
      setLiveActive(true);
      setLastLiveAt(Date.now());
      updateTherapistLocation(pos);
      setTherapistMeta({
        heading: msg.heading ?? null,
        speed: msg.speed ?? null,
        accuracy: msg.accuracy ?? null,
      });

      updateRoute(pos, destinationRef.current);
    },
    [updateRoute, updateTherapistLocation]
  );

  const handleSocketMessage = useCallback(
    (msg) => {
      switch (msg?.type) {
        case 'tracking_state':
          setLiveActive(!!msg.active);
          if (msg.active) applyLivePosition(msg);
          break;
        case 'tracking_started':
          setLiveActive(true);
          break;
        case 'location_update':
          applyLivePosition(msg);
          break;
        case 'tracking_stopped':
          setLiveActive(false);
          lastSocketUpdateRef.current = 0; // le polling reprend la main
          break;
        case 'status_update':
          setBooking((prev) => (prev ? { ...prev, status: msg.status } : prev));
          break;
        default:
          break;
      }
    },
    [applyLivePosition]
  );

  useEffect(() => {
    if (!bookingId) return undefined;

    const socket = createTrackingSocket({
      bookingId,
      token,
      onStatusChange: setSocketStatus,
      onMessage: handleSocketMessage,
    });

    return () => socket.close();
  }, [bookingId, token, handleSocketMessage]);

  // ==========================================================
  // STATUT AFFICHÉ — dérivé du statut réel de la réservation +
  // de la distance réelle thérapeute ↔ client.
  // ==========================================================

  const distanceKm = routeInfo?.distanceKm ?? haversineKm(therapistLocation, destination);

  const displayStatus = useMemo(() => {
    const bookingStatus = normalizeBookingStatus(booking?.status);

    if (bookingStatus === 'in_progress') return 'in_progress';

    if (bookingStatus === 'confirmed') {
      if (!therapistLocation) return 'waiting';
      if (distanceKm !== null && distanceKm <= ARRIVED_THRESHOLD_KM) return 'arrived';
      return 'en_route';
    }

    return 'waiting';
  }, [booking?.status, therapistLocation, distanceKm]);

  const statusInfo = getStatusInfo(displayStatus);

  // ==========================================================
  // DONNÉES THÉRAPEUTE (réelles) POUR L'AFFICHAGE
  // ==========================================================

  const therapistName =
    therapistProfile?.fullname ??
    booking?.therapist_name ??
    (booking?.therapist_id ? 'Thérapeute' : null);

  const therapistPhone = therapistProfile?.phone ?? null;
  const therapistPhoto = therapistProfile?.profile_image ?? null;
  const therapistRating = therapistProfile?.rating ?? null;
  const therapistExperience = therapistProfile?.experience_years ?? null;
  const therapistOnline = !!therapistProfile?.is_online;

  const address =
    booking?.address ?? booking?.client_location ?? booking?.location ?? 'Adresse non disponible';

  // ==========================================================
  // ✅ CAMÉRA : suit automatiquement thérapeute + adresse du client.
  // Le bouton "Auto" (en haut à gauche de la carte) la libère pour
  // pouvoir déplacer / zoomer la carte librement.
  // ==========================================================

  const [autoFollow, setAutoFollow] = useState(true);
  const lastFitRef = useRef(0);

  useEffect(() => {
    if (!autoFollow || !mapRef.current) return undefined;

    const points = [therapistLocation, destination].filter(Boolean);
    if (!points.length) return undefined;

    // Au plus un recadrage toutes les 3 s (trailing)
    const delay = Math.max(0, 3000 - (Date.now() - lastFitRef.current));

    const timer = setTimeout(() => {
      lastFitRef.current = Date.now();

      const close =
        points.length === 1 ||
        (haversineKm(points[0], points[1]) ?? 0) < 0.3;

      if (close) {
        // Très proche : fitBounds zoomerait au maximum -> zoom fixe
        const center =
          points.length === 1
            ? points[0]
            : {
                latitude: (points[0].latitude + points[1].latitude) / 2,
                longitude: (points[0].longitude + points[1].longitude) / 2,
              };
        mapRef.current?.animateToRegion(
          { ...center, latitudeDelta: 0.006, longitudeDelta: 0.006 },
          600
        );
      } else {
        mapRef.current?.fitToCoordinates(points);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [autoFollow, therapistLocation, destination]);

  // ==========================================================
  // ACTIONS
  // ==========================================================

  const handleContact = () => {
    if (!booking) return;

    navigation.navigate('Chat', {
      bookingId,
      therapistId: booking?.therapist_id,
      therapistName,
    });
  };

  const handleCall = async () => {
    if (!therapistPhone) {
      if (Platform.OS === 'web') {
        window?.alert?.('Le numéro du thérapeute est indisponible.');
      } else {
        Alert.alert('Téléphone', 'Le numéro du thérapeute est indisponible.');
      }
      return;
    }

    try {
      await Linking.openURL(`tel:${therapistPhone}`);
    } catch (error) {
      console.error('❌ Appel impossible:', error);
    }
  };


  // ==========================================================
  // LOADING
  // ==========================================================

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <Header title="Suivi en direct" showBack />
        <View style={styles.centerFlex}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Chargement du suivi...
          </Text>
        </View>
      </View>
    );
  }

  if (loadError && !booking) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <Header title="Suivi en direct" showBack />
        <View style={styles.centerFlex}>
          <Ionicons name="cloud-offline-outline" size={48} color={PRIMARY} />
          <Text style={[styles.errorTitle, { color: themeColors.text }]}>
            Impossible de charger le suivi
          </Text>
          <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => runFullRefresh(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================================
  // RENDER — CARTE IDENTIQUE WEB / MOBILE
  // ==========================================================

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Suivi en direct" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >

      {/* ==================================================
          CARTE — MapViewWrapper (Google Maps JS sur le web,
          react-native-maps sur mobile). Plus de "placeholder"
          sur le web : la vraie carte s'affiche partout.
      ================================================== */}

      <View style={[styles.mapContainer, { height: mapHeight }]}>
        {/* ✅ Même carte que côté thérapeute (LiveRouteMap) : ligne rouge pleine
            sur la vraie route + flèches, marqueur du thérapeute qui GLISSE
            chaque seconde, ligne qui se "consomme", pointillés jusqu'à
            l'adresse exacte, marqueur vert = adresse du client. */}
        <LiveRouteMap
          ref={mapRef}
          navMode={(therapistMeta?.speed ?? 0) > 1.5}
          style={styles.map}
          initialRegion={{
            latitude:
              therapistLocation?.latitude ??
              userLocation?.latitude ??
              destination?.latitude ??
              -18.8792,
            longitude:
              therapistLocation?.longitude ??
              userLocation?.longitude ??
              destination?.longitude ??
              47.5079,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          userLocation={userLocation}
          showUserLocation
          mover={therapistLocation}
          // En direct : point rouge + précision + direction. Sinon : point GRIS
          // "dernière position connue" (position enregistrée en base, peut
          // être ancienne) pour ne jamais la faire passer pour la position réelle.
          moverHeading={liveActive ? therapistMeta.heading : null}
          moverSpeed={liveActive ? therapistMeta.speed : null}
          moverAccuracy={liveActive ? therapistMeta.accuracy : null}
          moverTitle={therapistName || 'Thérapeute'}
          moverDescription={
            liveActive ? 'Position actuelle (en direct)' : 'Dernière position connue'
          }
          moverColor={liveActive ? ROUTE_COLOR : '#9E9E9E'}
          destination={destination}
          destinationTitle="Adresse de la demande"
          destinationDescription={address}
          destinationColor={PRIMARY}
          routeCoordinates={routeInfo?.coordinates}
          routeIsFallback={!!routeInfo?.isFallback}
          routeColor={ROUTE_COLOR}
          routeWidth={6}
        />

        {/* ✅ Caméra auto (thérapeute + adresse) / libre */}
        <TouchableOpacity
          style={[
            styles.autoFollowButton,
            { backgroundColor: autoFollow ? PRIMARY : '#FFFFFF' },
          ]}
          onPress={() => setAutoFollow((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons
            name="locate"
            size={16}
            color={autoFollow ? '#FFFFFF' : PRIMARY}
          />
          <Text
            style={[
              styles.autoFollowText,
              { color: autoFollow ? '#FFFFFF' : PRIMARY },
            ]}
          >
            Auto
          </Text>
        </TouchableOpacity>

        {/* ✅ Badge "EN DIRECT" — rouge quand le thérapeute partage */}
        <View style={styles.liveBadgeWrap} pointerEvents="none">
          <View
            style={[
              styles.liveBadge,
              { backgroundColor: liveActive ? '#E53935' : 'rgba(0,0,0,0.55)' },
            ]}
          >
            <View
              style={[
                styles.liveDot,
                { backgroundColor: liveActive ? '#fff' : '#BDBDBD' },
              ]}
            />
            <Text style={styles.liveBadgeText}>
              {liveActive
                ? 'EN DIRECT'
                : socketStatus === 'connected'
                  ? 'Position non partagée'
                  : 'Connexion…'}
            </Text>
          </View>
        </View>

        {refreshingLocation && (
          <View style={styles.refreshBadge}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.refreshBadgeText}>Actualisation…</Text>
          </View>
        )}

        <View style={styles.sosButtonContainer}>
          <SOSButton bookingId={bookingId} />
        </View>
      </View>

      {/* ==================================================
          STATUT
      ================================================== */}

      <Animatable.View animation="fadeInUp" delay={150} duration={500}>
        <View style={[styles.statusCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.statusHeader}>
            <Ionicons name={statusInfo.icon} size={22} color={statusInfo.color} />
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Ionicons name="location-outline" size={18} color={themeColors.textSecondary} />
            <Text style={[styles.statusItemText, { color: themeColors.text }]} numberOfLines={2}>
              {address}
            </Text>
          </View>

          {/* Partager l'adresse + les infos de la réservation dans la messagerie */}
          {!!booking?.therapist_id && (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={sharing}
              onPress={() =>
                shareBooking(bookingId, {
                  id: booking?.therapist_id,
                  name: therapistName,
                  photo: therapistPhoto,
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Partager l'adresse avec le thérapeute dans la messagerie"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 10,
                paddingVertical: 11,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: PRIMARY,
                opacity: sharing ? 0.6 : 1,
              }}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={PRIMARY} />
              )}
              <Text style={{ color: PRIMARY, fontWeight: '700', fontSize: 14 }}>
                Partager l'adresse dans la messagerie
              </Text>
            </TouchableOpacity>
          )}

          {liveActive && lastLiveAt ? (
            <Text style={[styles.liveUpdateText, { color: themeColors.textSecondary }]}>
              Position mise à jour à {new Date(lastLiveAt).toLocaleTimeString('fr-FR')}
            </Text>
          ) : null}

          {(routeInfo?.distanceText || distanceKm !== null) && (
            <View style={styles.statusMetaRow}>
              <View style={styles.statusMetaBadge}>
                <Ionicons name="navigate-outline" size={13} color={PRIMARY} />
                <Text style={styles.statusMetaText}>
                  {routeInfo?.distanceText || `${distanceKm.toFixed(1)} km`}
                </Text>
              </View>

              {routeInfo?.durationText && (
                <View style={styles.statusMetaBadge}>
                  <Ionicons name="time-outline" size={13} color={PRIMARY} />
                  <Text style={styles.statusMetaText}>
                    Arrivée estimée : {routeInfo.durationText}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Animatable.View>

      {/* ==================================================
          ✅ PROFIL THÉRAPEUTE — données réelles
      ================================================== */}

      {!!booking?.therapist_id && (
        <Animatable.View animation="fadeInUp" delay={280} duration={500}>
          <View style={[styles.therapistCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.therapistTopRow}>
              <TherapistPhoto
                photoUrl={therapistPhoto}
                name={therapistName}
                online={therapistOnline}
                size={60}
              />

              <View style={styles.therapistInfo}>
                <Text style={[styles.therapistName, { color: themeColors.text }]} numberOfLines={1}>
                  {therapistName || 'Thérapeute'}
                </Text>

                <View style={styles.metaRow}>
                  {therapistRating !== null && therapistRating !== undefined && (
                    <View style={styles.metaBadge}>
                      <Ionicons name="star" size={11} color="#F5A623" />
                      <Text style={styles.metaBadgeText}>
                        {Number(therapistRating).toFixed(1)}
                      </Text>
                    </View>
                  )}

                  {therapistExperience !== null && therapistExperience !== undefined && (
                    <View style={styles.metaBadge}>
                      <Ionicons name="ribbon-outline" size={11} color={PRIMARY} />
                      <Text style={styles.metaBadgeText}>
                        {therapistExperience} an{Number(therapistExperience) > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}

                  <View style={styles.metaBadge}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: therapistOnline ? '#4CAF50' : '#BDBDBD' },
                      ]}
                    />
                    <Text style={styles.metaBadgeText}>
                      {therapistOnline ? 'En ligne' : 'Hors ligne'}
                    </Text>
                  </View>
                </View>

                {!!therapistPhone && (
                  <Text style={[styles.therapistPhone, { color: themeColors.textSecondary }]}>
                    <Ionicons name="call-outline" size={11} /> {therapistPhone}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.therapistActions}>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={handleContact}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-outline" size={18} color={PRIMARY} />
                <Text style={[styles.secondaryActionText, { color: PRIMARY }]}>
                  Contacter
                </Text>
              </TouchableOpacity>

              {!!therapistPhone && (
                <TouchableOpacity
                  style={[styles.secondaryAction, styles.callAction]}
                  onPress={handleCall}
                  activeOpacity={0.85}
                >
                  <Ionicons name="call" size={18} color="#fff" />
                  <Text style={[styles.secondaryActionText, { color: '#fff' }]}>
                    Appeler
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animatable.View>
      )}
      </ScrollView>

      {shareHost}
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1 },
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  errorTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    textAlign: 'center',
  },
  errorText: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  mapContainer: {
    marginHorizontal: Platform.OS === 'web' ? spacing.lg : spacing.md,
    marginTop: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: { flex: 1 },

  refreshBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  refreshBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },

  autoFollowButton: {
    position: 'absolute',
    top: 56,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 3,
    zIndex: 5,
  },
  autoFollowText: { fontSize: 12, fontWeight: '700' },

  liveBadgeWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  liveUpdateText: { fontSize: 11, marginTop: 6 },

  sosButtonContainer: { position: 'absolute', bottom: 20, left: 20 },

  statusCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusItemText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  statusMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  statusMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: `${PRIMARY}12`,
  },
  statusMetaText: { fontSize: 11, fontWeight: '700', color: PRIMARY },

  therapistCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  therapistTopRow: { flexDirection: 'row', alignItems: 'center' },
  therapistInfo: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  therapistName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  therapistPhone: { marginTop: 6, fontSize: typography.fontSize.sm },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: `${PRIMARY}0D`,
  },
  metaBadgeText: { fontSize: 10.5, fontWeight: '700', color: PRIMARY },
  dot: { width: 7, height: 7, borderRadius: 3.5 },

  therapistActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryAction: {
    flex: 1,
    minWidth: 130,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  callAction: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  secondaryActionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default TrackingScreen;