// src/components/chat/LocationViewerModal.js
// Carte plein écran d'une position partagée : marqueur + adresse + bouton
// « Ouvrir dans Google Maps ».
import { useMemo } from 'react';
import { Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import MapViewWrapper from '../map/MapViewWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography } from '../../theme';
import { getMapsUrl } from '../../utils/chatUi';

export const openInMaps = (latitude, longitude, address) => {
  const url = getMapsUrl(latitude, longitude, address);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(url).catch(() => {});
};

const LocationViewerModal = ({ visible, onClose, title, address, latitude, longitude, palette }) => {
  const insets = useSafeAreaInsets();
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
  const region = useMemo(
    () => (hasCoords ? { latitude, longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 } : null),
    [hasCoords, latitude, longitude]
  );
  const markers = useMemo(
    () => !hasCoords ? [] : [
      {
        id: 'shared-location',
        coordinate: { latitude, longitude },
        title: title || 'Position',
        description: address || '',
      },
    ],
    [hasCoords, latitude, longitude, title, address]
  );

  return (
    <Modal visible={Boolean(visible)} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: palette.screenBg }]}>
        <View
          style={[
            styles.head,
            {
              backgroundColor: palette.surface,
              borderBottomColor: palette.border,
              // ✅ FIX « Property 'insets' doesn't exist » : insets n'existe que dans le composant
              paddingTop: (Platform.OS === 'web' ? 14 : insets.top) + 12,
            },
          ]}
        >
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer la carte">
            <Ionicons name="close" size={26} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {title || 'Position partagée'}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.map}>
          {hasCoords ? (
          <MapViewWrapper
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            region={region}
            markers={markers}
            showUserLocation={false}
            trackUserLocation={false}
          />
          ) : (
            <View style={styles.noMap}>
              <Ionicons name="map-outline" size={40} color={palette.textSecondary} />
              <Text style={{ color: palette.textSecondary, textAlign: 'center' }}>
                Pas de coordonnées GPS : ouvrez l'adresse dans Google Maps.
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.foot, { backgroundColor: palette.surface, borderTopColor: palette.border, paddingBottom: 14 + insets.bottom }]}>
          <Ionicons name="location" size={20} color={palette.primary} />
          <Text style={[styles.address, { color: palette.text }]} numberOfLines={3}>
            {address || (hasCoords ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : '')}
          </Text>
          <TouchableOpacity
            onPress={() => openInMaps(latitude, longitude, address)}
            activeOpacity={0.85}
            style={[styles.btn, { backgroundColor: palette.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir dans Google Maps"
          >
            <Text style={styles.btnText}>Google Maps</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: typography.fontFamily.semiBold, fontWeight: '700' },
  map: { flex: 1, minHeight: 0 },
  noMap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
  },
  address: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

export default LocationViewerModal;
