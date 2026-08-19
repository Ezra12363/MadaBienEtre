// src/screens/therapist/NavigationScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import * as Location from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';

// ✅ Importer depuis le wrapper
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../../components/map/MapViewWrapper';

const NavigationScreen = ({ navigation, route }) => {
  const { bookingId, clientAddress, clientLatitude, clientLongitude } = route.params || {};
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const mapRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getLocation();
    loadBookingDetails();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Erreur', 'Permission de localisation refusée');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBookingDetails = async () => {
    try {
      setDestination({
        latitude: clientLatitude || -18.8792 + Math.random() * 0.02,
        longitude: clientLongitude || 47.5079 + Math.random() * 0.02,
        address: clientAddress || 'Adresse du client',
      });
      setDistance('2.5');
      setDuration('15 min');
    } catch (error) {
      console.error('Error loading booking:', error);
    }
  };

  const startNavigation = () => {
    setIsNavigating(true);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
    Linking.openURL(url);
  };

  const centerMap = () => {
    if (mapRef.current && userLocation && destination) {
      const coordinates = [userLocation, destination];
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement de l'itinéraire...
        </Text>
      </View>
    );
  }

  // ✅ Version Web - Affichage simplifié
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Navigation" showBack />
        <View style={styles.webContainer}>
          <View style={[styles.webMapFallback, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="map" size={64} color={themeColors.textSecondary} />
            <Text style={[styles.webTitle, { color: themeColors.text }]}>
              🗺️ Navigation vers le client
            </Text>
            <Text style={[styles.webSubtext, { color: themeColors.textSecondary }]}>
              Disponible sur l'application mobile
            </Text>
            <View style={styles.webInfoContainer}>
              <View style={styles.webInfoRow}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={[styles.webInfoText, { color: themeColors.text }]}>
                  {destination?.address || 'Adresse du client'}
                </Text>
              </View>
              <View style={styles.webInfoRow}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={[styles.webInfoText, { color: themeColors.text }]}>
                  {duration} • {distance} km
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.webStartButton}
              onPress={startNavigation}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryLight]}
                style={styles.webStartGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="navigate-outline" size={20} color="#fff" />
                <Text style={styles.webStartText}>Ouvrir dans Google Maps</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ✅ Version Mobile - Carte complète
  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Navigation" showBack />

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: userLocation?.latitude || -18.8792,
            longitude: userLocation?.longitude || 47.5079,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="Ma position"
              pinColor={colors.primary}
            >
              <View style={styles.userMarker}>
                <Ionicons name="person" size={16} color="#fff" />
              </View>
            </Marker>
          )}

          {destination && (
            <Marker
              coordinate={destination}
              title="Client"
              pinColor={colors.secondary}
            >
              <View style={styles.destinationMarker}>
                <Ionicons name="location" size={16} color="#fff" />
              </View>
            </Marker>
          )}

          {userLocation && destination && (
            <Polyline
              coordinates={[userLocation, destination]}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[5, 5]}
            />
          )}
        </MapView>

        <TouchableOpacity
          style={[styles.centerButton, { backgroundColor: themeColors.surface }]}
          onPress={centerMap}
        >
          <Ionicons name="locate" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={[styles.infoCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: themeColors.text }]} numberOfLines={1}>
              {destination?.address || 'Adresse du client'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: themeColors.text }]}>
              {duration} • {distance} km
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={startNavigation}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            style={styles.startGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="navigate-outline" size={24} color="#fff" />
            <Text style={styles.startText}>Démarrer la navigation</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
  userMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  destinationMarker: {
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
    borderRadius: 30,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  infoCard: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  startButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  startText: {
    color: '#fff',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  // Styles Web
  webContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  webMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.md,
    borderRadius: 16,
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  webTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.sm,
  },
  webSubtext: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
  },
  webInfoContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    width: '100%',
    gap: spacing.sm,
  },
  webInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  webInfoText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  webStartButton: {
    marginTop: spacing.lg,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  webStartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  webStartText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default NavigationScreen;