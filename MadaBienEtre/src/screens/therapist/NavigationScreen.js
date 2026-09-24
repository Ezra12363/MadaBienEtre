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
// en dégradé PRIMARY.
// ============================================================

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
import * as Location from 'expo-location';

import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

import Header from '../../components/common/Header';
import MapView from '../../components/map/MapViewWrapper';

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

  const [therapistPosition, setTherapistPosition] = useState(null);
  // ✅ Proposition d'itinéraires : le plus rapide + alternatives.
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

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

  // Itinéraire sélectionné (par défaut : le plus rapide) et données
  // dérivées, avec les mêmes noms qu'avant pour le reste de l'écran.
  const routeInfo = useMemo(
    () =>
      routeOptions.find((option) => option.id === selectedRouteId) ||
      routeOptions[0] ||
      null,
    [routeOptions, selectedRouteId]
  );

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

      setRouteLoading(true);

      try {
        const options = await calculateAlternativeRoutes(
          origin.latitude,
          origin.longitude,
          clientPosition.latitude,
          clientPosition.longitude
        );

        setRouteOptions(options || []);
        setSelectedRouteId(options?.[0]?.id ?? null);
      } catch (error) {
        console.warn('[Navigation] Route:', error?.message);
        setRouteOptions([]);
        setSelectedRouteId(null);
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
          <ActivityIndicator size="large" color={PRIMARY} />

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
            // ✅ Tsipika tsipika (pointillés) rehefa tsy nahitana lalana
            // mampitohy ny thérapeute sy ny client ; ary eo anelanelan'ny
            // toerana marina sy ny lalana raha tsy tonga tanteraka.
            routeIsFallback={!routeInfo || !!routeInfo.isFallback}
            routeOrigin={therapistPosition}
            routeDestination={clientPosition}
            routeOptions={routeOptions}
            selectedRouteId={routeInfo?.id}
            onRouteSelect={setSelectedRouteId}
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
          onPress={centerMap}
          activeOpacity={0.85}
        >
          <Ionicons name="locate" size={20} color={PRIMARY} />
        </TouchableOpacity>

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
          pointerEvents="box-none"
        >
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
              <Ionicons name="car-outline" size={18} color={PRIMARY} />
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
              <Ionicons name="walk-outline" size={18} color={PRIMARY} />
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
                      { borderColor: active ? PRIMARY : themeColors.border || '#E5E5E5' },
                      active && { backgroundColor: `${PRIMARY}12` },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.routeOptionTitle, { color: themeColors.text }]}
                    >
                      {`${index + 1}. ${option.tag}`}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={[styles.routeOptionMeta, { color: themeColors.textSecondary }]}
                    >
                      {`🚗 ${option.drivingDurationText}  ·  🚶 ${option.walkingDurationText}  ·  ${option.distanceText}`}
                    </Text>

                    {active && (
                      <Ionicons name="checkmark-circle" size={16} color={PRIMARY} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

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
    // ✅ FIXÉ : avant, ce bloc était collé à droite avec une largeur
    // fixe de 76% ("width: '76%'" + "right" seulement), ce qui
    // laissait un grand vide à gauche et coupait le texte de
    // l'adresse. Désormais ancré à la fois à `left` ET `right` :
    // il occupe toute la largeur disponible (havia ka hatramin'ny
    // havanana), tout en restant sous le bouton "recentrer" et le
    // contrôle satellite (haut-gauche), qui restent au-dessus.
    // Le `bottom` est relevé pour ne jamais passer sous le
    // bandeau flottant (bottomSheetFloating).
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: 230,
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