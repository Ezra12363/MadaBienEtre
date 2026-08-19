// src/screens/client/TrackingScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import * as Location from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import SOSButton from '../../components/sos/SOSButton';

// ✅ Importer depuis le wrapper
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../../components/map/MapViewWrapper';

const { width, height } = Dimensions.get('window');

const TrackingScreen = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [therapistLocation, setTherapistLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('waiting');
  const [estimatedArrival, setEstimatedArrival] = useState(null);
  const mapRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    getUserLocation();
    return () => {};
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setBooking({
        id: bookingId,
        address: 'Lot III A 78, Antananarivo',
        therapist: {
          id: 1,
          name: 'Sarah B.',
          phone: '+261 34 12 345 67',
        },
      });
      setStatus('waiting');
    } catch (error) {
      console.error('Error loading tracking data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserLocation = async () => {
    try {
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== 'granted') {
        console.warn('Location permission denied');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting user location:', error);
      setUserLocation({
        latitude: -18.8792,
        longitude: 47.5079,
      });
    }
  };

  const getStatusInfo = () => {
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
        color: '#2E7D32',
      },
      in_progress: {
        label: 'Massage en cours',
        icon: 'spa-outline',
        color: '#2196F3',
      },
    };
    return map[status] || map.waiting;
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

  // ✅ Version Web - Affichage simplifié
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Suivi en direct" showBack />
        <View style={[styles.webMapFallback, { backgroundColor: themeColors.surface }]}>
          <Ionicons name="map" size={64} color={themeColors.textSecondary} />
          <Text style={[styles.webMapText, { color: themeColors.text }]}>
            🗺️ Suivi du thérapeute
          </Text>
          <Text style={[styles.webMapSubtext, { color: themeColors.textSecondary }]}>
            Disponible sur l'application mobile
          </Text>
          <View style={styles.webStatusContainer}>
            <View style={[styles.webStatusDot, { backgroundColor: statusInfo.color }]} />
            <Text style={[styles.webStatusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
          <View style={[styles.webAddressContainer, { backgroundColor: themeColors.background }]}>
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            <Text style={[styles.webAddressText, { color: themeColors.text }]}>
              {booking?.address || 'Adresse non disponible'}
            </Text>
          </View>
        </View>
        <View style={styles.webTherapistCard}>
          <SOSButton bookingId={bookingId} variant="compact" />
        </View>
      </View>
    );
  }

  // ✅ Version Mobile - Carte complète
  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Suivi en direct" showBack />

      {/* Carte Mobile */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: userLocation?.latitude || -18.8792,
            longitude: userLocation?.longitude || 47.5079,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="Votre position"
              pinColor={colors.primary}
            >
              <View style={styles.userMarker}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
            </Marker>
          )}
        </MapView>

        {/* Bouton SOS */}
        <View style={styles.sosButtonContainer}>
          <SOSButton bookingId={bookingId} />
        </View>
      </View>

      {/* Statut Mobile */}
      <Animatable.View animation="fadeInUp" delay={300} duration={600}>
        <View style={[styles.statusCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.statusHeader}>
            <Ionicons name={statusInfo.icon} size={24} color={statusInfo.color} />
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons name="location-outline" size={20} color={themeColors.textSecondary} />
            <Text style={[styles.statusItemText, { color: themeColors.text }]}>
              {booking?.address || 'Adresse non disponible'}
            </Text>
          </View>
        </View>
      </Animatable.View>

      {/* Informations du thérapeute */}
      {booking?.therapist && (
        <Animatable.View animation="fadeInUp" delay={500} duration={600}>
          <TouchableOpacity
            style={[styles.therapistCard, { backgroundColor: themeColors.surface }]}
            onPress={() => navigation.navigate('Chat', {
              bookingId: bookingId,
              therapistId: booking.therapist.id,
              therapistName: booking.therapist.name,
            })}
          >
            <View style={styles.therapistCardContent}>
              <View style={styles.therapistCardAvatar}>
                <Text style={styles.therapistCardAvatarText}>
                  {booking.therapist.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.therapistCardInfo}>
                <Text style={[styles.therapistCardName, { color: themeColors.text }]}>
                  {booking.therapist.name}
                </Text>
                <Text style={[styles.therapistCardStatus, { color: colors.primary }]}>
                  • En ligne
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
            </View>
          </TouchableOpacity>
        </Animatable.View>
      )}
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
    height: 400,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  userMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  sosButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  statusCard: {
    marginHorizontal: spacing.md,
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
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusItemText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  therapistCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  therapistCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  therapistCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  therapistCardAvatarText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  therapistCardInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  therapistCardName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  therapistCardStatus: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  // Styles Web
  webMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 16,
    minHeight: 300,
  },
  webMapText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.sm,
  },
  webMapSubtext: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
  },
  webStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  webStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  webStatusText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  webAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: 8,
  },
  webAddressText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  webTherapistCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
});

export default TrackingScreen;