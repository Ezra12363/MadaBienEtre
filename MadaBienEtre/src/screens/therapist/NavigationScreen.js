// ============================================================
// src/screens/therapist/NavigationScreen.js
//
// VERSION THÉRAPEUTE - NAVIGATION VERS LE CLIENT
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
// en dégradé colors.primary.
// ============================================================

import React, {
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
import * as Location from 'expo-location';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

import Header from '../../components/common/Header';
import MapView from '../../components/map/MapViewWrapper';

import {
  calculateRoute,
  haversineDistance,
  formatDistance,
  formatDuration,
} from '../../services/routing';

// ============================================================
// CONSTANTES
// ============================================================

const DEFAULT_REGION = { latitude: -18.8792, longitude: 47.5079 };

// Convention carte standard (reconnaissable internationalement) :
// bleu = position du thérapeute, rouge = destination du client.
const START_COLOR = '#1976D2';
const END_COLOR = '#D32F2F';

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

export default function NavigationScreen({ navigation, route: navRoute }) {
  const params = navRoute?.params || {};

  const bookingId = params.bookingId;

  const clientAddress =
    params.clientAddress || params.address || 'Adresse du client';

  const clientLatitude = toNumber(params.clientLatitude ?? params.latitude);
  const clientLongitude = toNumber(params.clientLongitude ?? params.longitude);

  const { colors: themeColors } = useTheme();
  const mapRef = useRef(null);

  const [therapistPosition, setTherapistPosition] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

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

  // ✅ Marqueurs (thérapeute + client) — tableau consommé par
  // MapViewWrapper aussi bien en natif qu'en web (`markers` prop).
  const mapMarkers = useMemo(() => {
    const list = [
      {
        id: 'client',
        coordinate: clientPosition,
        title: 'Arrivée — client',
        description: clientAddress,
        pinColor: END_COLOR,
      },
    ];

    if (therapistPosition) {
      list.unshift({
        id: 'therapist',
        coordinate: therapistPosition,
        title: 'Départ — vous',
        description: 'Position actuelle',
        pinColor: START_COLOR,
      });
    }

    return list;
  }, [therapistPosition, clientPosition, clientAddress]);

  // ==========================================================
  // GPS
  // ==========================================================

  const loadCurrentPosition = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setGpsError('Permission GPS refusée');
        return null;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const position = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      setTherapistPosition(position);
      setGpsError('');

      return position;
    } catch (error) {
      console.warn('[Navigation] GPS:', error?.message);
      setGpsError('Position actuelle indisponible');
      return null;
    }
  }, []);

  // ==========================================================
  // ROUTE
  // ==========================================================

  const loadRoute = useCallback(
    async (origin) => {
      if (!origin) return;

      setRouteLoading(true);

      try {
        const result = await calculateRoute(
          origin.latitude,
          origin.longitude,
          clientPosition.latitude,
          clientPosition.longitude,
          'driving'
        );

        if (result) {
          setRouteCoordinates(result.coordinates || [origin, clientPosition]);
          setRouteInfo(result);
        } else {
          setRouteCoordinates([origin, clientPosition]);
          setRouteInfo(null);
        }
      } catch (error) {
        console.warn('[Navigation] Route:', error?.message);
        setRouteCoordinates([origin, clientPosition]);
        setRouteInfo(null);
      } finally {
        setRouteLoading(false);
      }
    },
    [clientPosition]
  );

  useEffect(() => {
    let active = true;

    (async () => {
      const position = await loadCurrentPosition();
      if (active && position) await loadRoute(position);
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [loadCurrentPosition, loadRoute]);

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

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(centerMap, 700);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, centerMap]);

  // ==========================================================
  // ACTIONS
  // ==========================================================

  const refreshGps = async () => {
    const position = await loadCurrentPosition();
    if (position) await loadRoute(position);
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
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: themeColors.background }]}
      >
        <Header title="Navigation vers le client" showBack />

        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text
            style={[styles.loadingText, { color: themeColors.textSecondary }]}
          >
            Calcul de la position et du trajet...
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
      <Header title="Navigation vers le client" showBack />

      {/* ==================================================
          CARTE — occupe tout l'espace restant.
          `showMapTypeControl` (par défaut) affiche le bouton
          satellite/plan maison en HAUT-GAUCHE : nos propres
          éléments (recentrer, adresse) restent donc à DROITE.
      ================================================== */}

      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: therapistPosition?.latitude ?? clientPosition.latitude,
            longitude: therapistPosition?.longitude ?? clientPosition.longitude,
            latitudeDelta: 0.025,
            longitudeDelta: 0.025,
          }}
          markers={mapMarkers}
          route={routeCoordinates.length > 1 ? routeCoordinates : null}
          routeColor={END_COLOR}
          routeWidth={5}
          showUserLocation={false}
          trackUserLocation={false}
          showMapTypeControl
        />

        {/* Recentrer — bouton flottant discret, seul en haut à droite */}
        <TouchableOpacity
          style={[
            styles.locateButton,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border || '#E5E5E5',
            },
          ]}
          onPress={centerMap}
          activeOpacity={0.85}
        >
          <Ionicons name="locate" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Bloc ancré en BAS DROITE de la carte uniquement :
            le côté gauche reste totalement libre (contrôle
            natif "satellite" en haut-gauche, zoom Google Maps
            déplacé en bas-gauche côté web). Alerte GPS (si
            besoin) puis, juste au-dessus du bandeau du trajet,
            le badge adresse. */}
        <View style={styles.mapBottomOverlay} pointerEvents="box-none">
          {gpsError ? (
            <View style={styles.gpsWarning}>
              <Ionicons name="warning-outline" size={14} color="#92400E" />
              <Text style={styles.gpsWarningText}>{gpsError}</Text>
              <TouchableOpacity onPress={refreshGps}>
                <Text style={styles.gpsWarningRetry}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View
            style={[
              styles.addressBadge,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border || '#E5E5E5',
              },
            ]}
          >
            <View
              style={[
                styles.addressIcon,
                { backgroundColor: `${END_COLOR}15` },
              ]}
            >
              <Ionicons name="location" size={16} color={END_COLOR} />
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
        </View>
      </View>

      {/* ==================================================
          BANDEAU BAS — SÉPARÉ de la carte (pas en overlay).
          Regroupe légende, distance/durée et l'action
          principale.
      ================================================== */}

      <View
        style={[
          styles.bottomSheet,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border || '#E5E5E5',
          },
        ]}
      >
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: START_COLOR }]} />
            <Text
              style={[styles.legendText, { color: themeColors.textSecondary }]}
            >
              Vous
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: END_COLOR }]} />
            <Text
              style={[styles.legendText, { color: themeColors.textSecondary }]}
            >
              Client
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.routeInfoRow,
            { borderTopColor: themeColors.border || '#E5E5E5' },
          ]}
        >
          <View style={styles.routeInfoItem}>
            <Ionicons name="navigate-outline" size={18} color={END_COLOR} />
            <Text
              style={[
                styles.routeInfoLabel,
                { color: themeColors.textSecondary },
              ]}
            >
              Distance
            </Text>
            <Text style={[styles.routeInfoValue, { color: themeColors.text }]}>
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
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text
              style={[
                styles.routeInfoLabel,
                { color: themeColors.textSecondary },
              ]}
            >
              Durée
            </Text>

            {routeLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[styles.routeInfoValue, { color: themeColors.text }]}
              >
                {routeInfo?.durationText || '—'}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={openDirections}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.primary, `${colors.primary}CC`]}
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
  // CARTE
  // ==========================================================

  mapArea: { flex: 1, position: 'relative' },

  map: { flex: 1 },

  mapBottomOverlay: {
    // ✅ FIXÉ : avant, ce bloc était collé à droite avec une largeur
    // fixe de 76% ("width: '76%'" + "right" seulement), ce qui
    // laissait un grand vide à gauche et coupait le texte de
    // l'adresse. Désormais ancré à la fois à `left` ET `right` :
    // il occupe toute la largeur disponible (havia ka hatramin'ny
    // havanana), tout en restant sous le bouton "recentrer" et le
    // contrôle satellite (haut-gauche), qui restent au-dessus.
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: 0,
    gap: spacing.sm,
  },

  addressBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.sm,
    // Ombre plus marquée + fond opaque pour rester lisible
    // même sur un fond de carte chargé (mode satellite),
    // sur web comme sur mobile.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },

  addressIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
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
  // BANDEAU BAS — séparé de la carte
  // ==========================================================

  bottomSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
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

  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },

  routeInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  routeInfoDivider: { width: 1, height: 24, marginHorizontal: spacing.sm },

  routeInfoLabel: { fontSize: typography.fontSize.xs },

  routeInfoValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
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