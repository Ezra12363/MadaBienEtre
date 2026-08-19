// src/components/map/MapView.js
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
// ❌ Esory ny import react-native-maps
// import MapView, { Marker, PROVIDER_GOOGLE, Circle, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const { width, height } = Dimensions.get('window');

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

// ✅ Fake Marker
export const Marker = ({ children, coordinate, title, pinColor, ...props }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.markerContainer}>
      <View style={[styles.marker, { backgroundColor: pinColor || colors.primary }]}>
        {children || <Ionicons name="location" size={20} color="#fff" />}
      </View>
      {title && (
        <Text style={[styles.markerTitle, { color: themeColors.text }]}>
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
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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