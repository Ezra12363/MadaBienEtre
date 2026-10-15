// src/components/chat/LocationMessageCard.js
// Bulle « position / réservation partagée ».
//   - booking + infos  -> fiche de réservation (service, date, durée, prix, statut…)
//   - booking          -> « Adresse du rendez-vous »
//   - live             -> « Position actuelle » (GPS)
// Toucher l'ADRESSE ouvre Google Maps ; « Voir la carte → » ouvre la carte dans l'app.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { getChatPalette } from './chatTheme';
import LocationViewerModal, { openInMaps } from './LocationViewerModal';
import { useChatTracking } from './ChatTrackingContext';

const INFO_ROWS = [
  ['service', 'Service', 'leaf-outline'],
  ['date', 'Date', 'calendar-outline'],
  ['duration', 'Durée', 'time-outline'],
  ['price', 'Prix', 'cash-outline'],
  ['status', 'Statut', 'information-circle-outline'],
  ['client', 'Client', 'person-outline'],
  ['notes', 'Note', 'document-text-outline'],
];

const LocationMessageCard = ({ message, isOwn, textColor, onLongPress }) => {
  const { colors: themeColors, isDark } = useTheme();
  const palette = getChatPalette(themeColors, isDark);
  const [open, setOpen] = useState(false);
  // Client uniquement : ouvre le suivi (TrackingScreen) avec la position en route
  const chatTracking = useChatTracking();

  const { latitude, longitude, address, locationType, bookingInfo } = message;
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
  const isBooking = locationType === 'booking';
  const muted = isOwn ? 'rgba(255,255,255,0.82)' : palette.textSecondary;
  const accent = isOwn ? '#FFFFFF' : palette.primary;
  const soft = isOwn ? 'rgba(255,255,255,0.16)' : palette.primarySoft;

  if (!hasCoords && !address) {
    return <Text style={{ color: textColor }}>📍 Position indisponible</Text>;
  }

  const title = bookingInfo
    ? `Réservation ${bookingInfo.ref || ''}`.trim()
    : isBooking
    ? 'Adresse du rendez-vous'
    : isOwn
    ? 'Ma position en route'
    : 'Thérapeute en route';
  const icon = bookingInfo ? 'calendar' : isBooking ? 'home' : 'navigate';
  const addressText = address || (hasCoords ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : '');

  // Position « en route » reçue par le client -> suivi sur la carte (TrackingScreen)
  const canTrack = !isOwn && !isBooking && !bookingInfo && hasCoords && !!chatTracking;
  const openTracking = () => chatTracking?.openTracking?.({ latitude, longitude, address });

  return (
    <View style={styles.card}>
      <Pressable
        onPress={canTrack ? openTracking : undefined}
        onLongPress={onLongPress}
        delayLongPress={450}
      >
        <View style={styles.titleRow}>
          <View style={[styles.iconBox, { backgroundColor: soft }]}>
            <Ionicons name={icon} size={18} color={accent} />
          </View>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {!!bookingInfo && (
          <View style={styles.infoBlock}>
            {INFO_ROWS.filter(([key]) => bookingInfo[key]).map(([key, label, ic]) => (
              <View key={key} style={styles.infoRow}>
                <Ionicons name={ic} size={14} color={muted} />
                <Text style={[styles.infoLabel, { color: muted }]}>{label}</Text>
                <Text style={[styles.infoValue, { color: textColor }]} numberOfLines={3}>
                  {bookingInfo[key]}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>

      {/* Toucher l'adresse -> Google Maps */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => openInMaps(latitude, longitude, address)}
        style={[styles.addressBox, { backgroundColor: soft }]}
        accessibilityRole="link"
        accessibilityLabel={`Ouvrir ${addressText} dans Google Maps`}
      >
        <Ionicons name="location" size={18} color={accent} />
        <Text style={[styles.addressText, { color: textColor }]} numberOfLines={3}>
          {addressText}
        </Text>
        <Ionicons name="open-outline" size={16} color={muted} />
      </TouchableOpacity>

      {canTrack && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={openTracking}
          style={[styles.trackBtn, { backgroundColor: accent }]}
          accessibilityRole="button"
          accessibilityLabel="Suivre le thérapeute en route"
        >
          <Ionicons name="navigate" size={16} color={isOwn ? '#2E7D32' : '#FFFFFF'} />
          <Text style={[styles.trackBtnText, { color: isOwn ? '#2E7D32' : '#FFFFFF' }]}>
            Suivre le thérapeute en route
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Voir la carte">
          <Text style={[styles.link, { color: textColor }]}>Voir la carte →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => openInMaps(latitude, longitude, address)}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir dans Google Maps"
        >
          <Text style={[styles.link, { color: textColor }]}>Google Maps ↗</Text>
        </TouchableOpacity>
      </View>

      <LocationViewerModal
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
        address={address}
        latitude={hasCoords ? latitude : null}
        longitude={hasCoords ? longitude : null}
        palette={palette}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: { width: 250, maxWidth: '100%', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  infoBlock: { gap: 5, marginTop: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoLabel: { width: 52, fontSize: 12 },
  infoValue: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addressText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  trackBtnText: { fontSize: 13, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' },
});

export default LocationMessageCard;
