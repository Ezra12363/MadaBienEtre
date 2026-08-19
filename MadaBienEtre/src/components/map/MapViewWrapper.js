// src/components/map/MapViewWrapper.js
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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

let RNMapView = null;
let RNMarker = null;
let RNPolyline = null;
let RNCircle = null;
let PROVIDER_GOOGLE = null;
let RN_MAPS_LOAD_ERROR = null;

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
    try { delete window.google; } catch (e) { window.google = undefined; }
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

const toWebMapTypeId = (mapType) => {
  switch (mapType) {
    case MAP_TYPES.satellite: return 'satellite';
    case MAP_TYPES.hybrid: return 'hybrid';
    case MAP_TYPES.terrain: return 'terrain';
    default: return 'roadmap';
  }
};

// ✅ Icône personnalisée pour le marqueur (comme l'icône "local")
const getCustomMarkerIcon = (color, scale = 1.2) => {
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.5,
    anchor: { x: 12, y: 24 },
  };
};

const MapTypeToggle = ({ mapType, onToggle, style }) => {
  const isSatellite = mapType === MAP_TYPES.satellite;
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

const ScrollableMarkerList = ({ markers = [], onMarkerPress }) => {
  if (!markers.length) return null;
  return (
    <ScrollView style={styles.embedMarkerListScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {markers.map((m) => {
        const color = m.pinColor || (m.available ? MARKER_COLORS.available : MARKER_COLORS.unavailable);
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

const MapViewWrapper = forwardRef(({
  style,
  initialRegion,
  region,
  markers = [],
  userLocation = null,
  route = null,
  showUserLocation = true,
  trackUserLocation = true,
  mapType: controlledMapType,
  onMapTypeChange,
  showMapTypeControl = true,
  onMarkerPress,
  onMapReady,
  fitToMarkersOnLoad = true,
  onMapPress,
  selectionMarker = null,
  onSelectionDragEnd,
  children,
}, ref) => {
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

  useEffect(() => {
    if (Platform.OS === 'web' && webMapRef.current) {
      webMapRef.current.setMapTypeId(toWebMapTypeId(mapType));
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
      const color = m.pinColor || (m.available ? MARKER_COLORS.available : MARKER_COLORS.unavailable);
      const position = { lat: m.coordinate.latitude, lng: m.coordinate.longitude };

      let marker = webMarkersRef.current[id];
      if (!marker) {
        // ✅ Utiliser une icône personnalisée pour les marqueurs
        const icon = m.icon || getCustomMarkerIcon(color);
        marker = new google.maps.Marker({
          map,
          position,
          title: m.title,
          icon: icon,
        });
        marker.addListener('click', () => onMarkerPress && onMarkerPress(m));
        webMarkersRef.current[id] = marker;
      } else {
        marker.setPosition(position);
      }
    });

    Object.keys(webMarkersRef.current).forEach((id) => {
      if (!seenIds.has(id)) {
        webMarkersRef.current[id].setMap(null);
        delete webMarkersRef.current[id];
      }
    });
  }, [markers, isLoading]);

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
    const userIcon = getCustomMarkerIcon(MARKER_COLORS.user || '#2563EB');

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

  // ✅ EFFECT DU MARQUEUR ORANGE (SelectionMarker) SUR LE WEB - CORRIGÉ
  useEffect(() => {
    // ⚠️ Tsy mandeha raha mbola misy error na tsy vita ny loading
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

    // ✅ Raha tsy misy selectionMarker, esory ny marqueur
    if (!selectionMarker || !selectionMarker.latitude || !selectionMarker.longitude) {
      if (webSelectionMarkerRef.current) {
        webSelectionMarkerRef.current.setMap(null);
        webSelectionMarkerRef.current = null;
        console.log('🗑️ Selection marker removed');
      }
      return;
    }

    const position = { lat: selectionMarker.latitude, lng: selectionMarker.longitude };
    const markerColor = MARKER_COLORS?.selected || '#F59E0B';

    console.log(`📍 Creating/updating selection marker at: ${position.lat}, ${position.lng}`);

    // ✅ Mampiasa icône personnalisée pour le marqueur sélectionné
    const selectedIcon = getCustomMarkerIcon(markerColor);

    if (!webSelectionMarkerRef.current) {
      webSelectionMarkerRef.current = new google.maps.Marker({
        map,
        position,
        draggable: true,
        zIndex: 1000,
        icon: selectedIcon,
        title: 'Position sélectionnée',
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

    // ✅ Pan to position and zoom
    map.panTo(position);
    map.setZoom(15);
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
    const embedUrl = `https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_API_KEY}&center=${latitude},${longitude}&zoom=14&maptype=${mapType === MAP_TYPES.satellite ? 'satellite' : 'roadmap'}`;

    // ✅ Marqueur de sélection affiché dans le banner (fallback)
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

        {/* ✅ Afficher un banner pour confirmer la position si sélectionnée */}
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
          mapType={mapType === MAP_TYPES.satellite ? 'satellite' : 'standard'}
          showsUserLocation={showUserLocation && !userLocation}
          followsUserLocation={trackUserLocation && !userLocation}
          showsMyLocationButton={false}
          showsCompass
          onMapReady={() => { setIsLoading(false); onMapReady && onMapReady(); }}
          onPress={(e) => {
            if (onMapPress) onMapPress(e.nativeEvent.coordinate);
          }}
        >
          {/* ✅ MARQUEUR ORANGE SELECTIONNÉ SUR MOBILE */}
          {selectionMarker && selectionMarker.latitude && selectionMarker.longitude && (
            <RNMarker
              coordinate={{
                latitude: selectionMarker.latitude,
                longitude: selectionMarker.longitude,
              }}
              draggable
              pinColor={MARKER_COLORS?.selected || '#F59E0B'}
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
              pinColor={m.pinColor || (m.available ? MARKER_COLORS.available : MARKER_COLORS.unavailable)}
              onPress={() => onMarkerPress && onMarkerPress(m)}
            />
          ))}

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
  
  // ✅ Nouveau banner d'information pour la sélection
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