// src/components/map/MapView.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
// ❌ Esory ny import react-native-maps
// import MapView, { Marker, PROVIDER_GOOGLE, Circle, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const { width, height } = Dimensions.get('window');

// ✅ Palette de secours pour les mêmes "statuts" que MapViewWrapper —
// permet à ce composant simulé d'afficher aussi des couleurs
// différentes selon la situation (disponible, en attente, annulé...).
const DEFAULT_MARKER_COLORS = {
  available: '#22C55E',
  unavailable: '#9CA3AF',
  selected: '#F59E0B',
  user: '#2563EB',
  pending: '#3B82F6',
  confirmed: '#22C55E',
  in_progress: '#8B5CF6',
  completed: '#16A34A',
  cancelled: '#EF4444',
  default: '#EA4335',
};

const resolveMarkerColor = ({ pinColor, status, available } = {}) => {
  if (pinColor) return pinColor;
  if (status && DEFAULT_MARKER_COLORS[String(status).toLowerCase()]) {
    return DEFAULT_MARKER_COLORS[String(status).toLowerCase()];
  }
  if (typeof available === 'boolean') {
    return available ? DEFAULT_MARKER_COLORS.available : DEFAULT_MARKER_COLORS.unavailable;
  }
  return DEFAULT_MARKER_COLORS.default;
};

// ✅ MapView simulée ho an'ny web sy mobile
const MapViewComponent = ({ 
  children, 
  style, 
  initialRegion, 
  onRegionChange,
  onPress,
  provider,
  showsUserLocation,
  showsMyLocationButton,
  ...props 
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, style, { backgroundColor: themeColors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement de la carte...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style, { backgroundColor: themeColors.surface }]}>
      {/* Carte simulée */}
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={50} color={colors.primary} />
        <Text style={[styles.mapTitle, { color: themeColors.text }]}>
          Carte
        </Text>
        <Text style={[styles.mapSubtitle, { color: themeColors.textSecondary }]}>
          {location ? (
            `Position: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
          ) : (
            'Position non disponible'
          )}
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={getLocation}
        >
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={styles.refreshButtonText}>Actualiser</Text>
        </TouchableOpacity>
      </View>
      
      {/* Raha misy children (Marker, etc.) dia aseho eto */}
      {children && (
        <View style={styles.childrenContainer}>
          {children}
        </View>
      )}
    </View>
  );
};

// ✅ FIXÉ (BUG) : le marqueur n'est plus un badge rond (cercle) —
// il a désormais la forme d'une vraie "goutte" (pin) comme sur
// Google Maps : contour blanc + couleur pleine selon le statut,
// avec une petite ombre au sol pour donner un effet 3D "posé" sur
// la carte, plutôt qu'un simple point encerclé.
export const Marker = ({ children, coordinate, title, pinColor, status, available, ...props }) => {
  const { colors: themeColors } = useTheme();
  const color = resolveMarkerColor({ pinColor, status, available });

  return (
    <View style={styles.markerContainer} pointerEvents="box-none">
      <View style={styles.markerPinBox}>
        {/* Contour blanc (légèrement plus grand, en dessous) */}
        <Ionicons
          name="location-sharp"
          size={40}
          color="#ffffff"
          style={styles.markerPinOutline}
        />
        {/* Goutte colorée selon le statut (au-dessus, légèrement plus petite) */}
        <Ionicons
          name="location-sharp"
          size={32}
          color={color}
          style={styles.markerPinFill}
        />
        {children ? <View style={styles.markerChildrenBadge}>{children}</View> : null}
      </View>

      {/* Petite ombre au sol, pour un effet "posé" plutôt que flottant */}
      <View style={styles.markerShadow} />

      {title && (
        <Text style={[styles.markerTitle, { color: themeColors.text }]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </View>
  );
};

// ✅ Fake Circle
export const Circle = ({ center, radius, strokeColor, fillColor, ...props }) => {
  return (
    <View style={[
      styles.circle,
      {
        borderColor: strokeColor || colors.primary,
        backgroundColor: fillColor || 'rgba(76, 175, 80, 0.1)',
        width: radius || 100,
        height: radius || 100,
        borderRadius: (radius || 100) / 2,
      }
    ]} />
  );
};

// ✅ Fake Polyline
export const Polyline = ({ coordinates, strokeColor, strokeWidth, lineDashPattern, ...props }) => {
  return (
    <View style={[
      styles.polyline,
      {
        backgroundColor: strokeColor || colors.primary,
        height: strokeWidth || 3,
        width: '100%',
      }
    ]} />
  );
};

// ✅ Fake PROVIDER_GOOGLE
export const PROVIDER_GOOGLE = null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  mapTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    marginTop: 10,
  },
  mapSubtitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    marginTop: 5,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
    gap: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  childrenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  // ✅ FIXÉ : plus de cercle — conteneur simple, ancré par le bas
  // (comme une vraie goutte de carte dont la pointe touche le point).
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  markerPinBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPinOutline: {
    position: 'absolute',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  markerPinFill: {
    position: 'absolute',
    top: 4,
  },
  markerChildrenBadge: {
    position: 'absolute',
    top: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerShadow: {
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: -2,
  },
  markerTitle: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    marginTop: 4,
  },
  circle: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  polyline: {
    position: 'absolute',
    borderWidth: 0,
  },
});

export default MapViewComponent;