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
  ScrollView,
  Dimensions,
  Animated,
  Image,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../theme';

import MapView, {
  Marker,
  Polyline,
} from '../../components/map/MapViewWrapper';

import {
  calculateRoute,
  haversineDistance,
  formatDistance,
} from '../../services/routing';

// ==========================================================
// CONSTANTES
// ==========================================================

const DEFAULT_REGION = {
  latitude: -18.8792,
  longitude: 47.5079,
};

const BLUE = '#1976D2';
const RED = '#D32F2F';
const DEFAULT_GREEN = '#168A55';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SHEET_MAX_HEIGHT = Math.min(
  Math.round(SCREEN_HEIGHT * 0.48),
  450
);

const SHEET_MIN_HEIGHT = 82;

// ==========================================================
// HELPERS
// ==========================================================

const toNumber = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
};

const bearing = (a, b) => {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const dLng =
    ((b.longitude - a.longitude) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);

  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) *
      Math.cos(lat2) *
      Math.cos(dLng);

  return (Math.atan2(y, x) * 180) / Math.PI;
};

const makeDirectionMarkers = (points = []) => {
  if (points.length < 2) {
    return [];
  }

  const step = Math.max(
    1,
    Math.floor(points.length / 8)
  );

  const result = [];

  for (
    let index = 0;
    index < points.length - 1;
    index += step
  ) {
    result.push({
      coordinate: points[index],
      angle: bearing(
        points[index],
        points[
          Math.min(index + 1, points.length - 1)
        ]
      ),
    });
  }

  return result;
};

// ==========================================================
// NAVIGATION SCREEN
// ==========================================================

export default function NavigationScreen({
  navigation,
  route,
}) {
  const params = route?.params || {};

  const bookingId = params.bookingId;

  // Adresse récupérée une seule fois
  const clientAddress =
    params.clientAddress ||
    params.address ||
    'Adresse du client';

  const clientLatitude = toNumber(
    params.clientLatitude ?? params.latitude
  );

  const clientLongitude = toNumber(
    params.clientLongitude ?? params.longitude
  );

  const { colors: themeColors, isDark } = useTheme();

  // ========================================================
  // COULEURS THEME
  // ========================================================

  const PRIMARY =
    themeColors?.primary ||
    themeColors?.main ||
    themeColors?.success ||
    DEFAULT_GREEN;

  const HEADER_GREEN = PRIMARY;

  // ========================================================
  // REFS
  // ========================================================

  const mapRef = useRef(null);

  // ========================================================
  // STATES
  // ========================================================

  const [therapistPosition, setTherapistPosition] =
    useState(null);

  const [routeCoordinates, setRouteCoordinates] =
    useState([]);

  const [routeInfo, setRouteInfo] = useState(null);

  const [loading, setLoading] = useState(true);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [gpsError, setGpsError] = useState('');

  const [sheetOpen, setSheetOpen] = useState(true);

  const sheetAnimation = useRef(
    new Animated.Value(1)
  ).current;

  // ========================================================
  // POSITION CLIENT
  // ========================================================

  const clientPosition = useMemo(
    () => ({
      latitude:
        clientLatitude ?? DEFAULT_REGION.latitude,
      longitude:
        clientLongitude ?? DEFAULT_REGION.longitude,
    }),
    [clientLatitude, clientLongitude]
  );

  // ========================================================
  // DISTANCE
  // ========================================================

  const straightDistance = useMemo(() => {
    if (!therapistPosition) {
      return null;
    }

    return haversineDistance(
      therapistPosition.latitude,
      therapistPosition.longitude,
      clientPosition.latitude,
      clientPosition.longitude
    );
  }, [therapistPosition, clientPosition]);

  // ========================================================
  // MARQUEURS DIRECTION
  // ========================================================

  const directionMarkers = useMemo(
    () => makeDirectionMarkers(routeCoordinates),
    [routeCoordinates]
  );

  // ========================================================
  // GPS
  // ========================================================

  const loadCurrentPosition = useCallback(async () => {
    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setGpsError('Permission GPS refusée');
        return null;
      }

      const current =
        await Location.getCurrentPositionAsync({
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
      console.warn(
        '[Navigation] GPS:',
        error?.message
      );

      setGpsError(
        'Position actuelle indisponible'
      );

      return null;
    }
  }, []);

  // ========================================================
  // CALCUL ITINERAIRE
  // ========================================================

  const loadRoute = useCallback(
    async (origin) => {
      if (!origin) {
        return;
      }

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
          setRouteCoordinates(
            result.coordinates || [
              origin,
              clientPosition,
            ]
          );

          setRouteInfo(result);
        } else {
          setRouteCoordinates([
            origin,
            clientPosition,
          ]);

          setRouteInfo(null);
        }
      } catch (error) {
        console.warn(
          '[Navigation] Route:',
          error?.message
        );

        setRouteCoordinates([
          origin,
          clientPosition,
        ]);

        setRouteInfo(null);
      } finally {
        setRouteLoading(false);
      }
    },
    [clientPosition]
  );

  // ========================================================
  // INITIALISATION
  // ========================================================

  useEffect(() => {
    let active = true;

    const initializeNavigation = async () => {
      const position = await loadCurrentPosition();

      if (active && position) {
        await loadRoute(position);
      }

      if (active) {
        setLoading(false);
      }
    };

    initializeNavigation();

    return () => {
      active = false;
    };
  }, [loadCurrentPosition, loadRoute]);

  // ========================================================
  // CENTRER LA CARTE
  // ========================================================

  const centerMap = useCallback(() => {
    const points =
      routeCoordinates.length > 1
        ? routeCoordinates
        : [
            therapistPosition,
            clientPosition,
          ].filter(Boolean);

    if (points.length > 1) {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: {
          top: 145,
          right: 35,
          bottom: sheetOpen
            ? SHEET_MAX_HEIGHT + 35
            : SHEET_MIN_HEIGHT + 35,
          left: 35,
        },
        animated: true,
      });
    } else if (clientPosition) {
      mapRef.current?.animateToRegion(
        {
          ...clientPosition,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        500
      );
    }
  }, [
    routeCoordinates,
    therapistPosition,
    clientPosition,
    sheetOpen,
  ]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        centerMap();
      }, 700);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [loading, centerMap]);

  // ========================================================
  // RAFRAICHIR GPS
  // ========================================================

  const refreshGps = async () => {
    const position = await loadCurrentPosition();

    if (position) {
      await loadRoute(position);
    }
  };

  // ========================================================
  // OUVRIR GOOGLE MAPS
  // ========================================================

  const openDirections = async () => {
    const origin = therapistPosition
      ? `&origin=${therapistPosition.latitude},${therapistPosition.longitude}`
      : '';

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `${origin}` +
      `&destination=${clientPosition.latitude},${clientPosition.longitude}` +
      `&travelmode=driving`;

    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert(
        'Erreur',
        'Impossible d’ouvrir Google Maps.'
      );
    }
  };

  // ========================================================
  // TOGGLE BOTTOM SHEET
  // ========================================================

  const toggleSheet = () => {
    const nextState = !sheetOpen;

    setSheetOpen(nextState);

    Animated.spring(sheetAnimation, {
      toValue: nextState ? 1 : 0,
      useNativeDriver: false,
      damping: 22,
      stiffness: 180,
      mass: 0.8,
    }).start();

    setTimeout(() => {
      centerMap();
    }, 300);
  };

  const sheetTranslateY =
    sheetAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [
        SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT,
        0,
      ],
    });

  const locateButtonBottom = sheetOpen
    ? SHEET_MAX_HEIGHT + 14
    : SHEET_MIN_HEIGHT + 14;

  // ========================================================
  // LOADING
  // ========================================================

  if (loading) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={PRIMARY}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color:
                themeColors.textSecondary,
            },
          ]}
        >
          Calcul de la position et du trajet…
        </Text>
      </View>
    );
  }

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <View style={styles.root}>

      {/* =====================================================
          CARTE PLEIN ÉCRAN
      ====================================================== */}

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude:
            therapistPosition?.latitude ??
            clientPosition.latitude,
          longitude:
            therapistPosition?.longitude ??
            clientPosition.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }}
        userLocation={therapistPosition}
        showUserLocation={false}
        trackUserLocation={false}
        showMapTypeControl
      >
        {therapistPosition && (
          <Marker
            coordinate={therapistPosition}
            title="Départ — thérapeute"
            description="Position actuelle"
            pinColor={BLUE}
          />
        )}

        <Marker
          coordinate={clientPosition}
          title="Arrivée — client"
          description={clientAddress}
          pinColor={RED}
        />

        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={RED}
            strokeWidth={5}
            lineDashPattern={undefined}
          />
        )}

        {directionMarkers.map((item, index) => (
          <Marker
            key={`direction-${index}`}
            coordinate={item.coordinate}
            title="Direction à suivre"
          >
            <View
              style={[
                styles.arrowMarker,
                {
                  transform: [
                    {
                      rotate: `${item.angle}deg`,
                    },
                  ],
                },
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color="#FFFFFF"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* =====================================================
          HEADER FIXE — VERT + LOGO BLANC
      ====================================================== */}

      <View
        style={[
          styles.fixedHeader,
          {
            backgroundColor: HEADER_GREEN,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.fixedHeaderRow}>

          {/* Bouton retour */}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          {/* Titre centré avec logo blanc */}

          <View
            style={styles.headerBrandCenter}
            pointerEvents="none"
          >
            <View style={styles.brandRow}>

              <Image
                source={require('../../../assets/logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />

              <Text
                style={styles.headerBrandText}
                numberOfLines={1}
              >
                Navigation vers le client
              </Text>

            </View>

            <Text
              style={styles.fixedHeaderSubtitle}
              numberOfLines={1}
            >
              Itinéraire en cours
            </Text>
          </View>

          {/* Bouton recentrage */}

          <TouchableOpacity
            style={styles.headerMapButton}
            onPress={centerMap}
            activeOpacity={0.8}
          >
            <Ionicons
              name="locate-outline"
              size={21}
              color="#FFFFFF"
            />
          </TouchableOpacity>

        </View>
      </View>

      {/* =====================================================
          BOUTON RECENTRER — VERT
      ====================================================== */}

      <TouchableOpacity
        style={[
          styles.locateButton,
          {
            bottom: locateButtonBottom,
            backgroundColor: PRIMARY,
          },
        ]}
        onPress={centerMap}
        activeOpacity={0.85}
      >
        <Ionicons
          name="locate"
          size={22}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {/* =====================================================
          MESSAGE GPS
      ====================================================== */}

      {gpsError ? (
        <View
          style={[
            styles.warningFloating,
            {
              bottom: locateButtonBottom,
            },
          ]}
        >
          <Ionicons
            name="warning-outline"
            size={15}
            color="#92400E"
          />

          <Text style={styles.warningText}>
            {gpsError}
          </Text>

          <TouchableOpacity onPress={refreshGps}>
            <Text style={styles.retry}>
              Réessayer
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* =====================================================
          BOTTOM SHEET
      ====================================================== */}

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor:
              themeColors.surface,
            height: SHEET_MAX_HEIGHT,
            transform: [
              {
                translateY: sheetTranslateY,
              },
            ],
          },
        ]}
      >

        {/* En-tête du panneau : adresse UNE SEULE FOIS */}

        <TouchableOpacity
          style={styles.sheetHeader}
          onPress={toggleSheet}
          activeOpacity={0.92}
        >
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeaderContent}>

            <View
              style={[
                styles.sheetHeaderIcon,
                {
                  backgroundColor: isDark
                    ? 'rgba(211,47,47,0.18)'
                    : '#FDECEC',
                },
              ]}
            >
              <Ionicons
                name="location"
                size={17}
                color={RED}
              />
            </View>

            <View style={styles.sheetHeaderTextBox}>

              <Text
                style={[
                  styles.sheetHeaderTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {clientAddress}
              </Text>

              <Text
                style={[
                  styles.sheetHeaderSubtitle,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {routeInfo?.distanceText ||
                  formatDistance(straightDistance) ||
                  'Distance inconnue'}
                {' • '}
                {routeInfo?.durationText ||
                  'Durée estimée'}
              </Text>

            </View>

            {/* Bouton toggle vert */}

            <View
              style={[
                styles.sheetToggleButton,
                {
                  backgroundColor: PRIMARY,
                },
              ]}
            >
              <Ionicons
                name={
                  sheetOpen
                    ? 'chevron-down'
                    : 'chevron-up'
                }
                size={21}
                color="#FFFFFF"
              />
            </View>

          </View>
        </TouchableOpacity>

        {/* ===================================================
            CONTENU SCROLLABLE
        ==================================================== */}

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          bounces={Platform.OS !== 'web'}
          scrollEnabled={sheetOpen}
        >

          {/* =================================================
              LÉGENDE
          ================================================= */}

          <View
            style={[
              styles.legendCard,
              {
                backgroundColor: isDark
                  ? '#202D25'
                  : '#F8FAF8',
                borderColor: themeColors.border,
              },
            ]}
          >
            <View style={styles.legendLine}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: BLUE,
                  },
                ]}
              />

              <Text
                style={[
                  styles.legendText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                Départ : position du thérapeute
              </Text>
            </View>

            <View style={styles.legendLine}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: RED,
                  },
                ]}
              />

              <Text
                style={[
                  styles.legendText,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                Arrivée : adresse du client
              </Text>
            </View>
          </View>

          {/* =================================================
              DISTANCE ET DURÉE
          ================================================= */}

          <View style={styles.statsRow}>

            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(211,47,47,0.13)'
                    : '#FFF1F1',
                  borderColor: isDark
                    ? '#5A3030'
                    : '#F8D4D4',
                },
              ]}
            >
              <View style={styles.statTitleRow}>
                <Ionicons
                  name="navigate-outline"
                  size={16}
                  color={RED}
                />

                <Text style={styles.statLabel}>
                  Distance
                </Text>
              </View>

              <Text style={styles.statValueDistance}>
                {routeInfo?.distanceText ||
                  formatDistance(straightDistance) ||
                  '—'}
              </Text>
            </View>

            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(25,118,210,0.13)'
                    : '#EFF6FF',
                  borderColor: isDark
                    ? '#294C70'
                    : '#D4E5FA',
                },
              ]}
            >
              <View style={styles.statTitleRow}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={BLUE}
                />

                <Text style={styles.statLabel}>
                  Durée
                </Text>
              </View>

              <View style={styles.durationRow}>
                <Text
                  style={[
                    styles.statValueDuration,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {routeInfo?.durationText || '—'}
                </Text>

                {routeLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={PRIMARY}
                  />
                ) : null}
              </View>
            </View>

          </View>

          {/* =================================================
              BOUTON PRINCIPAL — VERT
          ================================================= */}

          <TouchableOpacity
            style={[
              styles.startButton,
              {
                backgroundColor: PRIMARY,
              },
            ]}
            onPress={openDirections}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[PRIMARY, PRIMARY]}
              style={styles.gradient}
            >
              <Ionicons
                name="navigate"
                size={19}
                color="#FFFFFF"
              />

              <Text style={styles.startText}>
                Démarrer l’itinéraire
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* =================================================
              BOUTON RÉDUIRE — VERT
          ================================================= */}

          <TouchableOpacity
            style={[
              styles.closeSheetButton,
              {
                backgroundColor: PRIMARY,
                borderColor: PRIMARY,
              },
            ]}
            onPress={toggleSheet}
            activeOpacity={0.85}
          >
            <Ionicons
              name="chevron-down"
              size={17}
              color="#FFFFFF"
            />

            <Text style={styles.closeSheetText}>
              Réduire le panneau
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ==========================================================
// STYLES
// ==========================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: typography.fontSize.md,
  },

  // ========================================================
  // HEADER FIXE VERT
  // ========================================================

  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height:
      Platform.OS === 'ios'
        ? 116
        : Platform.OS === 'web'
        ? 92
        : 104,
    paddingTop:
      Platform.OS === 'ios'
        ? 48
        : Platform.OS === 'web'
        ? 20
        : 34,
    zIndex: 40,
    elevation: 40,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  fixedHeaderRow: {
    width: '100%',
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    position: 'relative',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    zIndex: 3,
  },

  // Centre absolu du header
  headerBrandCenter: {
    position: 'absolute',
    left: 58,
    right: 58,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerLogo: {
    width: 32,
    height: 32,
    marginRight: 8,
  },

  headerBrandText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.1,
    textAlign: 'center',
  },

  fixedHeaderSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 3,
  },

  headerMapButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginLeft: 'auto',
    zIndex: 3,
  },

  // ========================================================
  // MARQUEURS
  // ========================================================

  arrowMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
  },

  // ========================================================
  // BOUTON LOCALISER VERT
  // ========================================================

  locateButton: {
    position: 'absolute',
    right: 15,
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    zIndex: 25,
  },

  // ========================================================
  // WARNING GPS
  // ========================================================

  warningFloating: {
    position: 'absolute',
    left: 15,
    right: 72,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    zIndex: 25,
  },

  warningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 11,
    marginLeft: 5,
  },

  retry: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
  },

  // ========================================================
  // BOTTOM SHEET
  // ========================================================

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: -5,
    },
    zIndex: 20,
  },

  sheetHeader: {
    height: 82,
    paddingTop: 8,
    paddingHorizontal: 13,
    justifyContent: 'flex-start',
  },

  sheetHandle: {
    alignSelf: 'center',
    width: 43,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(120,120,120,0.45)',
    marginBottom: 9,
  },

  sheetHeaderContent: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },

  sheetHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  sheetHeaderTextBox: {
    flex: 1,
    minWidth: 0,
  },

  sheetHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
  },

  sheetHeaderSubtitle: {
    fontSize: 10,
    marginTop: 3,
  },

  // Toggle vert
  sheetToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
  },

  sheetScroll: {
    flex: 1,
  },

  sheetContent: {
    paddingHorizontal: 13,
    paddingTop: 3,
    paddingBottom: 25,
  },

  // ========================================================
  // LÉGENDE
  // ========================================================

  legendCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 0,
    gap: 6,
  },

  legendLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  legendText: {
    flex: 1,
    fontSize: 10.5,
  },

  // ========================================================
  // DISTANCE ET DURÉE
  // ========================================================

  statsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 9,
    marginTop: 9,
  },

  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  statTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  statLabel: {
    color: '#6B7280',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  statValueDistance: {
    color: RED,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 6,
  },

  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },

  statValueDuration: {
    fontSize: 15,
    fontWeight: '900',
  },

  // ========================================================
  // BOUTON DÉMARRER VERT
  // ========================================================

  startButton: {
    width: '100%',
    marginTop: 12,
    borderRadius: 13,
    overflow: 'hidden',
    elevation: 5,
  },

  gradient: {
    minHeight: 49,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  startText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  // ========================================================
  // BOUTON RÉDUIRE VERT
  // ========================================================

  closeSheetButton: {
    minHeight: 38,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  closeSheetText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});