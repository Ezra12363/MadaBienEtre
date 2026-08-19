// src/screens/therapist/TrackingScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
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

// ✅ Import avy amin'ny MapViewWrapper
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../../components/map/MapViewWrapper';

const { width, height } = Dimensions.get('window');

const TrackingScreen = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [clientLocation, setClientLocation] = useState(null);
  const [therapistLocation, setTherapistLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('en_route');
  const [distance, setDistance] = useState(null);
  const [estimatedArrival, setEstimatedArrival] = useState(null);
  const [ws, setWs] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    loadData();
    setupWebSocket();
    getCurrentLocation();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  const loadData = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBooking(response.data);
      setStatus(response.data.status);
      
      const client = await axios.get(`${API_URL}/geolocation/current/${response.data.client_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClientLocation({
        latitude: client.data.latitude,
        longitude: client.data.longitude,
      });
    } catch (error) {
      console.error('Error loading tracking data:', error);
      setBooking({
        id: bookingId,
        client: { fullname: 'Marie L.' },
        address: 'Lot III A 78, Antananarivo',
      });
      setClientLocation({
        latitude: -18.8792,
        longitude: 47.5079,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setTherapistLocation(locationData);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'location_update',
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          booking_id: bookingId,
        }));
      }
      
      await axios.post(
        `${API_URL}/geolocation/update`,
        locationData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const setupWebSocket = () => {
    const wsUrl = `${WS_URL}/tracking/${bookingId}?token=${token}`;
    const websocket = new WebSocket(wsUrl);
    setWs(websocket);

    websocket.onopen = () => {
      console.log('Tracking WebSocket connected');
      if (therapistLocation) {
        websocket.send(JSON.stringify({
          type: 'location_update',
          latitude: therapistLocation.latitude,
          longitude: therapistLocation.longitude,
          booking_id: bookingId,
        }));
      }
    };

    websocket.onmessage = (event) => {
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
    };

    websocket.onerror = (error) => {
      console.error('Tracking WebSocket error:', error);
    };
  };

  const updateLocation = async () => {
    await getCurrentLocation();
  };

  const updateMap = () => {
    if (mapRef.current && therapistLocation && clientLocation && Platform.OS !== 'web') {
      try {
        const coordinates = [therapistLocation, clientLocation];
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      } catch (error) {
        console.error('Error updating map:', error);
      }
    }
  };

  const getStatusInfo = () => {
    const map = {
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
        icon: 'spa-outline',
        color: '#2196F3',
      },
      completed: {
        label: 'Massage terminé',
        icon: 'checkmark-done-outline',
        color: '#2E7D32',
      },
    };
    return map[status] || map.en_route;
  };

  const statusInfo = getStatusInfo();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement du suivi...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Suivi en direct" showBack />

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: therapistLocation?.latitude || -18.8792,
            longitude: therapistLocation?.longitude || 47.5079,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={Platform.OS !== 'web'}
          showsMyLocationButton={false}
        >
          {therapistLocation && (
            <Marker
              coordinate={therapistLocation}
              title="Votre position"
              pinColor={colors.primary}
            >
              <View style={styles.therapistMarker}>
                <Ionicons name="medical" size={16} color="#fff" />
              </View>
            </Marker>
          )}

          {clientLocation && (
            <Marker
              coordinate={clientLocation}
              title="Client"
              pinColor={colors.secondary}
            >
              <View style={styles.clientMarker}>
                <Ionicons name="person" size={16} color="#fff" />
              </View>
            </Marker>
          )}

          {therapistLocation && clientLocation && (
            <Polyline
              coordinates={[therapistLocation, clientLocation]}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[5, 5]}
            />
          )}
        </MapView>

        {Platform.OS !== 'web' && (
          <>
            <TouchableOpacity
              style={styles.centerButton}
              onPress={updateMap}
            >
              <Ionicons name="locate" size={24} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.updateButton}
              onPress={updateLocation}
            >
              <Ionicons name="refresh-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        <View style={styles.sosButtonContainer}>
          <SOSButton bookingId={bookingId} />
        </View>
      </View>

      {/* Statut */}
      <Animatable.View animation="fadeInUp" delay={300} duration={600}>
        <View style={[styles.statusCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.statusHeader}>
            <Ionicons name={statusInfo.icon} size={24} color={statusInfo.color} />
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>

          {distance !== null && (
            <View style={styles.statusDetails}>
              <View style={styles.statusItem}>
                <Ionicons name="location-outline" size={20} color={themeColors.textSecondary} />
                <Text style={[styles.statusItemText, { color: themeColors.text }]}>
                  Distance: {distance} km
                </Text>
              </View>
              {estimatedArrival && (
                <View style={styles.statusItem}>
                  <Ionicons name="time-outline" size={20} color={themeColors.textSecondary} />
                  <Text style={[styles.statusItemText, { color: themeColors.text }]}>
                    Arrivée estimée: {estimatedArrival}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.clientInfo}>
            <Text style={[styles.clientInfoLabel, { color: themeColors.textSecondary }]}>
              Client
            </Text>
            <Text style={[styles.clientInfoName, { color: themeColors.text }]}>
              {booking?.client?.fullname || 'Client'}
            </Text>
            <Text style={[styles.clientInfoAddress, { color: themeColors.textSecondary }]}>
              {booking?.address || 'Adresse non disponible'}
            </Text>
          </View>
        </View>
      </Animatable.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  therapistMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  clientMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  centerButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  updateButton: {
    position: 'absolute',
    bottom: 180,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: 30,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sosButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  statusCard: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    borderTopColor: '#E0E0E0',
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