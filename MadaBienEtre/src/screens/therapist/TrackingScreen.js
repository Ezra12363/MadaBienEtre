// src/screens/therapist/TrackingScreen.js
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import SOSButton from '../../components/sos/SOSButton';
import axios from 'axios';
import { API_URL, WS_URL } from '../../config';

// ✅ IMPORTANT : on utilise désormais MapViewWrapper avec son API par
// PROPS (`markers`, `route`) — exactement comme dans
// NavigationScreen.js — au lieu des <Marker>/<Polyline> passés en
// enfants JSX. Sur le web, MapViewWrapper affiche `Marker`/`Polyline`
// comme de simples <View> inertes (react-native-maps n'existe pas
// côté web), donc les utiliser en enfants ne dessinait RIEN de
// visible sur le web. La prop `markers` + `route`, elle, est câblée
// pour fonctionner aussi bien en natif (Android/iOS) que sur le web.
import MapView from '../../components/map/MapViewWrapper';

// ============================================================
// CONSTANTES
// ============================================================

const DEFAULT_REGION = { latitude: -18.8792, longitude: 47.5079 };

// Convention couleurs cohérente avec NavigationScreen.js :
// bleu = position du thérapeute (vous), rouge = client.
const THERAPIST_COLOR = '#1976D2';
const CLIENT_COLOR = '#D32F2F';

const STATUS_MAP = {
  en_route: {
    label: 'En route vers le client',
    icon: 'walk-outline',
    color: '#4CAF50',
  },
  arrived: {
    label: 'Arrivé chez le client',
    icon: 'checkmark-circle-outline',
    color: '#2E7D32',
  },
  in_progress: {
    label: 'Massage en cours',
    icon: 'body-outline',
    color: '#2196F3',
  },
  completed: {
    label: 'Massage terminé',
    icon: 'checkmark-done-outline',
    color: '#2E7D32',
  },
};

const getStatusInfo = (status) => STATUS_MAP[status] || STATUS_MAP.en_route;

// ============================================================
// ✅ WEBSOCKET — CONSTRUCTION SÉCURISÉE DE L'URL (CORRECTIF CRASH)
// ============================================================
// AVANT : `new WebSocket(`${WS_URL}/tracking/${bookingId}?token=...`)`
// plantait TOUTE l'application dès le montage de l'écran si `WS_URL`
// était vide/undefined ou ne commençait pas par "ws://"/"wss://" :
//
//   java.lang.IllegalArgumentException: Expected URL scheme
//   'http' or 'https' but no scheme was found
//   at ...WebSocketModule.connect...
//
// C'est exactement l'erreur visible dans la capture d'écran ("There
// was a problem loading the project") — l'écran plantait avant même
// d'avoir eu la chance d'afficher la carte, d'où l'impression que
// "la carte ne s'affiche pas du tout" sur Android.
//
// FIXÉ EN DEUX TEMPS :
//   1) On construit toujours une URL avec un schéma valide
//      (ws:// ou wss://), y compris quand `WS_URL` est absent (on la
//      dérive alors de `API_URL`).
//   2) La création du WebSocket est protégée par un `try/catch` :
//      si l'URL reste invalide pour une raison quelconque, on
//      désactive simplement le temps réel au lieu de faire planter
//      tout l'écran.
// ============================================================
const buildTrackingWebSocketUrl = (bookingId, token) => {
  let base = (WS_URL || '').trim();

  if (!base && API_URL) {
    // Pas de WS_URL configurée : on dérive une URL ws(s) à partir de
    // l'URL de l'API REST (http -> ws, https -> wss).
    base = API_URL.trim().replace(/^http/i, 'ws');
  }

  if (!base) return null;

  // Retire un éventuel "/" final avant d'ajouter le chemin.
  base = base.replace(/\/+$/, '');

  // Si le schéma est absent ou n'est pas ws/wss, on force "ws://"
  // (ex: "192.168.1.10:8000" -> "ws://192.168.1.10:8000").
  if (!/^wss?:\/\//i.test(base)) {
    base = `ws://${base.replace(/^\/\//, '')}`;
  }

  if (!bookingId) return null;

  return `${base}/tracking/${bookingId}?token=${encodeURIComponent(token || '')}`;
};

// ============================================================
// SCREEN
// ============================================================

const TrackingScreen = ({ route }) => {
  const { bookingId } = route.params;

  const { colors: themeColors } = useTheme();
  const { token } = useAuth();

  const [booking, setBooking] = useState(null);
  const [clientLocation, setClientLocation] = useState(null);
  const [therapistLocation, setTherapistLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('en_route');
  const [distance, setDistance] = useState(null);
  const [estimatedArrival, setEstimatedArrival] = useState(null);
  const [gpsError, setGpsError] = useState('');

  // ✅ CORRECTIF ANDROID : dimensions exactes (en pixels) de la zone
  // carte, mesurées via `onLayout`. Sur Android, react-native-maps ne
  // se redimensionne pas toujours correctement s'il est seulement en
  // `flex:1` à l'intérieur d'un parent positionné en absolu — la
  // carte peut alors ne remplir qu'une partie de l'écran et laisser
  // un grand espace vide en dessous (exactement ce qui était visible
  // sur la capture d'écran). En donnant une largeur/hauteur
  // EXPLICITES mesurées, la carte occupe systématiquement tout
  // l'espace disponible, sur Android comme sur le web.
  const [screenSize, setScreenSize] = useState(null);

  // ✅ Hauteur réelle du bandeau d'infos flottant (mesurée), pour que
  // le bouton SOS reste toujours juste au-dessus de lui, quel que
  // soit l'appareil, au lieu d'un chevauchement possible.
  const [infoCardHeight, setInfoCardHeight] = useState(190);

  const mapRef = useRef(null);
  const wsRef = useRef(null);
  const isMountedRef = useRef(true);
  const therapistLocationRef = useRef(null);

  useEffect(() => {
    therapistLocationRef.current = therapistLocation;
  }, [therapistLocation]);

  // ==========================================================
  // MARQUEURS — tableau `markers`, identique à NavigationScreen.js
  // (fonctionne aussi bien en natif qu'en web).
  // ==========================================================
  const mapMarkers = useMemo(() => {
    const list = [];

    if (therapistLocation) {
      list.push({
        id: 'therapist',
        coordinate: therapistLocation,
        title: 'Votre position',
        description: 'Thérapeute',
        pinColor: THERAPIST_COLOR,
      });
    }

    if (clientLocation) {
      list.push({
        id: 'client',
        coordinate: clientLocation,
        title: booking?.client?.fullname || 'Client',
        description: booking?.address || '',
        pinColor: CLIENT_COLOR,
      });
    }

    return list;
  }, [therapistLocation, clientLocation, booking]);

  const routeCoordinates = useMemo(() => {
    if (therapistLocation && clientLocation) {
      return [therapistLocation, clientLocation];
    }
    return null;
  }, [therapistLocation, clientLocation]);

  // ==========================================================
  // DONNÉES DE LA RÉSERVATION
  // ==========================================================
  const loadData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!isMountedRef.current) return;
      setBooking(response.data);
      setStatus(response.data.status);

      const client = await axios.get(
        `${API_URL}/geolocation/current/${response.data.client_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!isMountedRef.current) return;
      setClientLocation({
        latitude: client.data.latitude,
        longitude: client.data.longitude,
      });
    } catch (error) {
      console.error('Error loading tracking data:', error);
      if (!isMountedRef.current) return;
      setBooking({
        id: bookingId,
        client: { fullname: 'Marie L.' },
        address: 'Lot III A 78, Antananarivo',
      });
      setClientLocation(DEFAULT_REGION);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [bookingId, token]);

  // ==========================================================
  // GPS
  // ==========================================================
  const getCurrentLocation = useCallback(async () => {
    try {
      const { status: permissionStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (permissionStatus !== 'granted') {
        if (isMountedRef.current) setGpsError('Permission GPS refusée');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      if (!isMountedRef.current) return;
      setTherapistLocation(locationData);
      setGpsError('');

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'location_update',
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            booking_id: bookingId,
          })
        );
      }

      await axios.post(`${API_URL}/geolocation/update`, locationData, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Error getting location:', error);
      if (isMountedRef.current) {
        setGpsError('Position actuelle indisponible');
      }
    }
  }, [bookingId, token]);

  // ==========================================================
  // WEBSOCKET (temps réel) — protégé, ne fait plus jamais planter
  // l'écran (voir `buildTrackingWebSocketUrl` plus haut).
  // ==========================================================
  const setupWebSocket = useCallback(() => {
    const wsUrl = buildTrackingWebSocketUrl(bookingId, token);

    if (!wsUrl) {
      console.warn(
        '[Tracking] URL WebSocket indisponible (WS_URL/API_URL manquante) — suivi en temps réel désactivé, la carte reste fonctionnelle.'
      );
      return;
    }

    try {
      const websocket = new WebSocket(wsUrl);
      wsRef.current = websocket;

      websocket.onopen = () => {
        console.log('Tracking WebSocket connecté');
        if (therapistLocationRef.current) {
          websocket.send(
            JSON.stringify({
              type: 'location_update',
              latitude: therapistLocationRef.current.latitude,
              longitude: therapistLocationRef.current.longitude,
              booking_id: bookingId,
            })
          );
        }
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'location_update') {
            setClientLocation({
              latitude: data.latitude,
              longitude: data.longitude,
            });
            setDistance(data.distance);
            setEstimatedArrival(data.estimated_arrival);
          } else if (data.type === 'status_update') {
            setStatus(data.status);
          }
        } catch (parseError) {
          console.warn(
            '[Tracking] Message WebSocket illisible:',
            parseError?.message
          );
        }
      };

      websocket.onerror = (error) => {
        console.warn(
          '[Tracking] Erreur WebSocket:',
          error?.message || error
        );
      };

      websocket.onclose = () => {
        wsRef.current = null;
      };
    } catch (error) {
      // ✅ C'est ICI que plantait toute l'appli avant le correctif :
      // `new WebSocket(url)` lève une exception SYNCHRONE si le
      // schéma de l'URL est invalide. On l'attrape pour ne plus
      // jamais faire planter l'écran entier.
      console.warn(
        "[Tracking] Impossible d'ouvrir le WebSocket:",
        error?.message || error
      );
    }
  }, [bookingId, token]);

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    setupWebSocket();
    getCurrentLocation();

    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (_e) {
          // no-op
        }
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================
  // CENTRER LA CARTE
  // ==========================================================
  const centerMap = useCallback(() => {
    const points = [therapistLocation, clientLocation].filter(Boolean);

    if (points.length > 1) {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 70, right: 50, bottom: infoCardHeight + 40, left: 50 },
        animated: true,
      });
    } else if (points.length === 1) {
      mapRef.current?.animateToRegion({
        ...points[0],
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }, [therapistLocation, clientLocation, infoCardHeight]);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(centerMap, 700);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isLoading, centerMap]);

  const statusInfo = getStatusInfo(status);

  // ==========================================================
  // LOADING
  // ==========================================================
  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: themeColors.background }]}
      >
        <Header title="Suivi en direct" showBack />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[styles.loadingText, { color: themeColors.textSecondary }]}
          >
            Chargement du suivi...
          </Text>
        </View>
      </View>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================
  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Header title="Suivi en direct" showBack />

      {/* ==================================================
          CARTE — occupe désormais tout l'écran restant (Android
          ET web). Le bandeau d'infos et le bouton SOS flottent
          par-dessus au lieu de réduire son espace.
          `showMapTypeControl` affiche le bouton satellite/plan en
          HAUT-GAUCHE ; nos propres boutons restent donc à DROITE.
      ================================================== */}

      <View
        style={styles.screenArea}
        onLayout={(e) => setScreenSize(e.nativeEvent.layout)}
      >
        <View
          style={[
            styles.mapArea,
            screenSize && {
              width: screenSize.width,
              height: screenSize.height,
            },
          ]}
        >
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude:
                therapistLocation?.latitude ??
                clientLocation?.latitude ??
                DEFAULT_REGION.latitude,
              longitude:
                therapistLocation?.longitude ??
                clientLocation?.longitude ??
                DEFAULT_REGION.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            markers={mapMarkers}
            route={routeCoordinates}
            routeColor={colors.primary}
            routeWidth={4}
            showUserLocation={false}
            trackUserLocation={false}
            showMapTypeControl
          />
        </View>

        {/* Recentrer + rafraîchir GPS — empilés en HAUT À DROITE,
            pour ne jamais recouvrir ni le bouton satellite (haut-
            gauche) ni le bandeau d'infos (en bas). */}
        <View style={styles.topRightButtons} pointerEvents="box-none">
          <TouchableOpacity
            style={[
              styles.circleButton,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border || '#E5E5E5',
              },
            ]}
            onPress={centerMap}
            activeOpacity={0.85}
          >
            <Ionicons name="locate" size={22} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.circleButton, styles.circleButtonPrimary]}
            onPress={getCurrentLocation}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {gpsError ? (
          <View style={styles.gpsWarning} pointerEvents="box-none">
            <Ionicons name="warning-outline" size={14} color="#92400E" />
            <Text style={styles.gpsWarningText}>{gpsError}</Text>
          </View>
        ) : null}

        {/* ✅ Bouton SOS — ancré en BAS, À L'INTÉRIEUR de la carte,
            juste au-dessus du bandeau d'infos flottant (dont la
            hauteur est mesurée dynamiquement pour ne jamais se
            chevaucher). */}
        <View
          style={[
            styles.sosButtonContainer,
            { bottom: infoCardHeight + spacing.md },
          ]}
          pointerEvents="box-none"
        >
          <SOSButton bookingId={bookingId} />
        </View>

        {/* ==================================================
            BANDEAU D'INFOS — flotte au-dessus de la carte agrandie
            (au lieu d'un bloc séparé sous la carte qui en réduisait
            la taille).
        ================================================== */}
        <Animatable.View
          animation="fadeInUp"
          delay={200}
          duration={500}
          onLayout={(e) => setInfoCardHeight(e.nativeEvent.layout.height)}
          style={[
            styles.statusCardFloating,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border || '#E5E5E5',
            },
          ]}
        >
          <View style={styles.statusHeader}>
            <Ionicons name={statusInfo.icon} size={22} color={statusInfo.color} />
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>

          {distance !== null && (
            <View style={styles.statusDetails}>
              <View style={styles.statusItem}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={themeColors.textSecondary}
                />
                <Text style={[styles.statusItemText, { color: themeColors.text }]}>
                  Distance : {distance} km
                </Text>
              </View>
              {estimatedArrival && (
                <View style={styles.statusItem}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={themeColors.textSecondary}
                  />
                  <Text
                    style={[styles.statusItemText, { color: themeColors.text }]}
                  >
                    Arrivée estimée : {estimatedArrival}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View
            style={[
              styles.clientInfo,
              { borderTopColor: themeColors.border || '#E0E0E0' },
            ]}
          >
            <Text
              style={[styles.clientInfoLabel, { color: themeColors.textSecondary }]}
            >
              Client
            </Text>
            <Text
              style={[styles.clientInfoName, { color: themeColors.text }]}
              numberOfLines={1}
            >
              {booking?.client?.fullname || 'Client'}
            </Text>
            <Text
              style={[
                styles.clientInfoAddress,
                { color: themeColors.textSecondary },
              ]}
              numberOfLines={2}
            >
              {booking?.address || 'Adresse non disponible'}
            </Text>
          </View>
        </Animatable.View>
      </View>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1 },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },

  // ==========================================================
  // CARTE — occupe tout l'écran restant (voir `screenSize` /
  // correctif Android en tête du composant).
  // ==========================================================
  screenArea: { flex: 1, position: 'relative' },

  mapArea: { ...StyleSheet.absoluteFillObject },

  map: { flex: 1 },

  topRightButtons: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    gap: spacing.sm,
    zIndex: 2,
  },

  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },

  circleButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  gpsWarning: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: 64,
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

  // ✅ Bouton SOS flottant, ANCRÉ EN BAS À L'INTÉRIEUR DE LA CARTE,
  // juste au-dessus du bandeau d'infos (bottom recalculé dynamiquement
  // via `infoCardHeight`).
  sosButtonContainer: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 2,
  },

  // ==========================================================
  // BANDEAU D'INFOS — flotte au-dessus de la carte agrandie
  // ==========================================================
  statusCardFloating: {
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

  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  statusLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },

  statusDetails: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },

  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  statusItemText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },

  clientInfo: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },

  clientInfoLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },

  clientInfoName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },

  clientInfoAddress: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
});

export default TrackingScreen;