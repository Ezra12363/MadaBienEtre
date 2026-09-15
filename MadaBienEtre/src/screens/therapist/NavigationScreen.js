// src/screens/therapist/NavigationScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
import { colors, typography } from '../../theme';
import Header from '../../components/common/Header';
import MapView, { Marker, Polyline } from '../../components/map/MapViewWrapper';
import { calculateRoute, haversineDistance, formatDistance, formatDuration } from '../../services/routing';

const DEFAULT_REGION = { latitude: -18.8792, longitude: 47.5079 };
const BLUE = '#1976D2';
const RED = '#D32F2F';

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const bearing = (a, b) => {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
};

const makeDirectionMarkers = (points = []) => {
  if (points.length < 2) return [];
  const step = Math.max(1, Math.floor(points.length / 8));
  const result = [];
  for (let i = 0; i < points.length - 1; i += step) {
    result.push({ coordinate: points[i], angle: bearing(points[i], points[Math.min(i + 1, points.length - 1)]) });
  }
  return result;
};

export default function NavigationScreen({ navigation, route }) {
  const params = route?.params || {};
  const bookingId = params.bookingId;
  const clientAddress = params.clientAddress || params.address || 'Adresse du client';
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

  const clientPosition = useMemo(() => ({
    latitude: clientLatitude ?? DEFAULT_REGION.latitude,
    longitude: clientLongitude ?? DEFAULT_REGION.longitude,
  }), [clientLatitude, clientLongitude]);

  const straightDistance = useMemo(
    () => therapistPosition ? haversineDistance(therapistPosition.latitude, therapistPosition.longitude, clientPosition.latitude, clientPosition.longitude) : null,
    [therapistPosition, clientPosition]
  );

  const directionMarkers = useMemo(() => makeDirectionMarkers(routeCoordinates), [routeCoordinates]);

  const loadCurrentPosition = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setGpsError('Permission GPS refusée');
        return null;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const position = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setTherapistPosition(position);
      return position;
    } catch (error) {
      console.warn('[Navigation] GPS:', error?.message);
      setGpsError('Position actuelle indisponible');
      return null;
    }
  }, []);

  const loadRoute = useCallback(async (origin) => {
    if (!origin) return;
    setRouteLoading(true);
    try {
      const result = await calculateRoute(
        origin.latitude, origin.longitude,
        clientPosition.latitude, clientPosition.longitude,
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
  }, [clientPosition]);

  useEffect(() => {
    let active = true;
    (async () => {
      const position = await loadCurrentPosition();
      if (active && position) await loadRoute(position);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [loadCurrentPosition, loadRoute]);

  const centerMap = useCallback(() => {
    const points = routeCoordinates.length > 1 ? routeCoordinates : [therapistPosition, clientPosition].filter(Boolean);
    if (points.length > 1) {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 45, right: 35, bottom: 250, left: 35 },
        animated: true,
      });
    } else if (clientPosition) {
      mapRef.current?.animateToRegion({ ...clientPosition, latitudeDelta: 0.015, longitudeDelta: 0.015 });
    }
  }, [routeCoordinates, therapistPosition, clientPosition]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(centerMap, 700);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, centerMap]);

  const refreshGps = async () => {
    const position = await loadCurrentPosition();
    if (position) await loadRoute(position);
  };

  const openDirections = async () => {
    const origin = therapistPosition ? `&origin=${therapistPosition.latitude},${therapistPosition.longitude}` : '';
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${clientPosition.latitude},${clientPosition.longitude}&travelmode=driving`;
    try {
      if (Platform.OS === 'web') window.open(url, '_blank');
      else await Linking.openURL(url);
    } catch { Alert.alert('Erreur', 'Impossible d’ouvrir Google Maps.'); }
  };

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: themeColors.background }]}><ActivityIndicator size="large" color={BLUE} /><Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Calcul de la position et du trajet…</Text></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}> 
      <Header title="Navigation vers le client" showBack />
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{ latitude: therapistPosition?.latitude ?? clientPosition.latitude, longitude: therapistPosition?.longitude ?? clientPosition.longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }}
          userLocation={therapistPosition}
          showUserLocation={false}
          trackUserLocation={false}
          showMapTypeControl
        >
          {therapistPosition && <Marker coordinate={therapistPosition} title="Départ — thérapeute" description="Position actuelle" pinColor={BLUE} />}
          <Marker coordinate={clientPosition} title="Arrivée — client" description={clientAddress} pinColor={RED} />
          {routeCoordinates.length > 1 && <Polyline coordinates={routeCoordinates} strokeColor={RED} strokeWidth={5} lineDashPattern={undefined} />}
          {directionMarkers.map((item, index) => (
            <Marker key={`direction-${index}`} coordinate={item.coordinate} title="Direction à suivre">
              <View style={[styles.arrowMarker, { transform: [{ rotate: `${item.angle}deg` }] }]}><Ionicons name="arrow-up" size={18} color="#fff" /></View>
            </Marker>
          ))}
        </MapView>

        <View style={[styles.infoCard, { backgroundColor: themeColors.surface }]}> 
          <View style={styles.infoHeader}><Ionicons name="location" size={19} color={RED} /><Text style={[styles.infoTitle, { color: themeColors.text }]}>Adresse du client</Text></View>
          <Text style={[styles.address, { color: themeColors.text }]} numberOfLines={2}>{clientAddress}</Text>
          {bookingId ? <Text style={[styles.booking, { color: themeColors.textSecondary }]}>Réservation #{bookingId}</Text> : null}
        </View>

        <TouchableOpacity style={[styles.locateButton, { backgroundColor: themeColors.surface }]} onPress={centerMap}><Ionicons name="locate" size={21} color={BLUE} /></TouchableOpacity>

        <View style={[styles.bottomInfo, { backgroundColor: themeColors.surface }]}> 
          <View style={styles.legendLine}><View style={[styles.dot, { backgroundColor: BLUE }]} /><Text style={[styles.smallText, { color: themeColors.text }]}>Départ : position actuelle du thérapeute</Text></View>
          <View style={styles.legendLine}><View style={[styles.dot, { backgroundColor: RED }]} /><Text style={[styles.smallText, { color: themeColors.text }]}>Arrivée : adresse du client</Text></View>
          <View style={styles.routeLine}><Ionicons name="navigate" size={18} color={RED} /><Text style={[styles.distanceLabel, { color: themeColors.textSecondary }]}>Distance par route :</Text><Text style={styles.distanceValue}>{routeInfo?.distanceText || formatDistance(straightDistance)}</Text></View>
          <View style={styles.routeLine}><Ionicons name="time-outline" size={17} color={BLUE} /><Text style={[styles.distanceLabel, { color: themeColors.textSecondary }]}>Durée estimée :</Text><Text style={[styles.durationValue, { color: themeColors.text }]}>{routeInfo?.durationText || '—'}</Text>{routeLoading ? <ActivityIndicator size="small" color={BLUE} style={{ marginLeft: 6 }} /> : null}</View>
        </View>

        {gpsError ? <View style={styles.warning}><Ionicons name="warning-outline" size={15} color="#92400E" /><Text style={styles.warningText}>{gpsError}</Text><TouchableOpacity onPress={refreshGps}><Text style={styles.retry}>Réessayer</Text></TouchableOpacity></View> : null}
        <TouchableOpacity style={styles.startButton} onPress={openDirections} activeOpacity={0.9}><LinearGradient colors={[BLUE, '#42A5F5']} style={styles.gradient}><Ionicons name="navigate" size={20} color="#fff" /><Text style={styles.startText}>Démarrer l’itinéraire</Text></LinearGradient></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center' }, loadingText: { marginTop: 12, fontSize: typography.fontSize.md }, mapArea: { flex: 1, position: 'relative' }, map: { flex: 1 },
  infoCard: { position: 'absolute', top: 10, left: 10, right: 10, borderRadius: 14, padding: 10, elevation: 5, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 }, infoTitle: { fontSize: 12, fontWeight: '800', marginLeft: 6 }, address: { fontSize: 11, fontWeight: '600', lineHeight: 15 }, booking: { fontSize: 10, marginTop: 3 }, locateButton: { position: 'absolute', right: 12, top: 92, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', elevation: 5 }, arrowMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 }, bottomInfo: { position: 'absolute', left: 10, right: 10, bottom: 70, borderRadius: 14, padding: 10, elevation: 5, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, legendLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 }, dot: { width: 10, height: 10, borderRadius: 5, marginRight: 7 }, smallText: { fontSize: 10, flex: 1 }, routeLine: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 5, paddingTop: 6 }, distanceLabel: { fontSize: 11, marginLeft: 6 }, distanceValue: { color: RED, fontSize: 14, fontWeight: '900', marginLeft: 5 }, durationValue: { fontSize: 12, fontWeight: '800', marginLeft: 5 }, warning: { position: 'absolute', left: 10, right: 10, bottom: 60, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 7, flexDirection: 'row', alignItems: 'center' }, warningText: { flex: 1, color: '#92400E', fontSize: 10, marginLeft: 5 }, retry: { color: BLUE, fontSize: 10, fontWeight: '800', marginLeft: 5 }, startButton: { position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: 14, overflow: 'hidden', elevation: 6 }, gradient: { minHeight: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, startText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
