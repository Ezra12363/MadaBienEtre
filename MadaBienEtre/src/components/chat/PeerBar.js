// src/components/chat/PeerBar.js
// Carte de l'interlocuteur (avatar, nom, statut) sous le Header, avec le bouton
// menu (⋮). Sur le web LARGE la TopNavBar donne déjà retour + titre : cette
// carte garde alors l'accès au menu « Supprimer mes messages ».
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { typography } from '../../theme';
import ChatAvatar from './ChatAvatar';
import { CHAT_MAX_WIDTH } from './chatTheme';

const PeerBar = ({ palette, name, photo, statusText, statusColor, bookingId, onMenu }) => (
  <View style={[styles.bar, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
    <View style={styles.inner}>
      <ChatAvatar uri={photo} name={name} size={42} palette={palette} />

      <View style={styles.text}>
        <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
          {name || 'Conversation'}
        </Text>
        <View style={styles.statusRow}>
          {!!statusText && <View style={[styles.dot, { backgroundColor: statusColor }]} />}
          <Text style={[styles.status, { color: palette.textSecondary }]} numberOfLines={1}>
            {statusText}
            {bookingId ? `${statusText ? ' · ' : ''}Réservation #${bookingId}` : ''}
          </Text>
        </View>
      </View>

      {!!onMenu && (
        <TouchableOpacity
          onPress={onMenu}
          style={[styles.menu, { backgroundColor: palette.primarySoft }]}
          accessibilityRole="button"
          accessibilityLabel="Options de la conversation"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={palette.primary} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  inner: {
    width: '100%',
    maxWidth: CHAT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontFamily: typography.fontFamily.semiBold, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 12, fontFamily: typography.fontFamily.regular, flexShrink: 1 },
  menu: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

export default PeerBar;
