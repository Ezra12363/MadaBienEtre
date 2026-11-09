// src/components/messenger/CallModal.js
// Écran d'appel vocal plein écran : sonnerie (entrant / sortant), connexion,
// communication (minuteur, micro coupé) et fin d'appel.
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { typography } from '../../theme';
import { resolvePhotoUrl } from '../../utils/chatUi';
import ChatAvatar from '../chat/ChatAvatar';

const PALETTE = { avatarBg: '#1F3329', avatarText: '#6EE7A8' };

const fmt = (s = 0) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const CallModal = ({ call, onAccept, onDecline, onToggleMute }) => {
  if (!call) return null;
  const incomingRinging = call.direction === 'incoming' && call.status === 'ringing';

  const statusText = {
    ringing: call.direction === 'incoming' ? 'Appel vocal entrant…' : 'Appel en cours…',
    connecting: 'Connexion…',
    active: fmt(call.seconds),
    ended: call.message || 'Appel terminé',
  }[call.status];

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onDecline}>
      <View style={styles.screen}>
        <View style={styles.top}>
          <ChatAvatar
            uri={resolvePhotoUrl(call.peer?.profile_image)}
            name={call.peer?.fullname}
            size={120}
            palette={PALETTE}
          />
          <Text style={styles.name} numberOfLines={1}>{call.peer?.fullname || 'Appel'}</Text>
          <Text style={styles.status}>{statusText}</Text>
        </View>

        {call.status !== 'ended' && (
          <View style={styles.actions}>
            {call.status === 'active' || call.status === 'connecting' ? (
              <TouchableOpacity
                style={[styles.round, styles.muteBtn, call.muted && styles.muteOn]}
                onPress={onToggleMute}
                accessibilityLabel={call.muted ? 'Réactiver le micro' : 'Couper le micro'}
              >
                <Ionicons name={call.muted ? 'mic-off' : 'mic'} size={26} color="#fff" />
              </TouchableOpacity>
            ) : null}

            {incomingRinging && (
              <TouchableOpacity style={[styles.round, styles.accept]} onPress={onAccept} accessibilityLabel="Répondre">
                <Ionicons name="call" size={28} color="#fff" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.round, styles.hangup]} onPress={onDecline} accessibilityLabel="Raccrocher">
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F2A1D', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 80 },
  top: { alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  name: { color: '#fff', fontSize: 26, fontFamily: typography.fontFamily.bold, fontWeight: '700', marginTop: 10 },
  status: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontFamily: typography.fontFamily.regular },
  actions: { flexDirection: 'row', gap: 36, alignItems: 'center' },
  round: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: '#22C55E' },
  hangup: { backgroundColor: '#E53935' },
  muteBtn: { backgroundColor: 'rgba(255,255,255,0.18)' },
  muteOn: { backgroundColor: '#F59E0B' },
});

export default CallModal;
