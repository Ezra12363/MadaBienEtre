// src/components/chat/ChatImagePreviewModal.js
// Aperçu de l'image AVANT l'envoi (Annuler / Envoyer). Android, iOS et Web.
import {
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme';
import { formatBytes } from '../../utils/chatImage';

const ChatImagePreviewModal = ({ visible, asset, onCancel, onConfirm }) => {
  const { width, height } = useWindowDimensions();
  const boxWidth = Math.min(width - 32, 520);
  const imageHeight = Math.min(height * 0.55, 420);
  const primary = colors?.primary || '#168A55';

  return (
    <Modal
      visible={Boolean(visible && asset)}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { width: boxWidth }]}>
          <Text style={styles.title}>Envoyer cette photo ?</Text>

          {asset?.uri ? (
            <Image
              source={{ uri: asset.uri }}
              style={[styles.image, { height: imageHeight }]}
              resizeMode="contain"
            />
          ) : null}

          <Text style={styles.meta} numberOfLines={1}>
            {asset?.name || 'photo'}
            {asset?.size ? ` · ${formatBytes(asset.size)}` : ''}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancel]}
              onPress={onCancel}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Annuler l'envoi"
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: primary }]}
              onPress={onConfirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Envoyer la photo"
            >
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={styles.confirmText}>Envoyer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    ...Platform.select({
      web: { boxShadow: '0 12px 40px rgba(0,0,0,0.35)' },
      default: { elevation: 12 },
    }),
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  image: { width: '100%', borderRadius: 12, backgroundColor: '#F1F5F3' },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 8, marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancel: { backgroundColor: '#EEF1EF' },
  cancelText: { color: '#374151', fontWeight: '600', fontSize: 15 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default ChatImagePreviewModal;
