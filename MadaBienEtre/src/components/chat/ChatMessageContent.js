// src/components/chat/ChatMessageContent.js
// Contenu d'une bulle : texte, image (plein écran au toucher) ou message supprimé.
// Appui long sur SON message => suppression (confirmation compatible web).
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { confirmAsync, resolveChatImageUrl } from '../../utils/chatImage';

const ChatMessageContent = ({
  message,
  isOwn,
  token,
  textStyle,
  textColor = '#000',
  onDelete,
}) => {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  const askDelete = async () => {
    if (!isOwn || !onDelete || message.status === 'sending') return;
    const isImage = message.type === 'image';
    const ok = await confirmAsync(
      'Supprimer le message ?',
      isImage ? 'Cette photo sera supprimée pour tout le monde.' : 'Ce message sera supprimé pour tout le monde.'
    );
    if (ok) onDelete(message.id);
  };

  /* ---------- supprimé ---------- */
  if (message.deleted) {
    return (
      <View style={styles.deletedRow}>
        <Ionicons name="ban-outline" size={14} color={textColor} style={{ opacity: 0.7 }} />
        <Text style={[textStyle, styles.deletedText, { color: textColor }]}>Message supprimé</Text>
      </View>
    );
  }

  /* ---------- image ---------- */
  if (message.type === 'image') {
    const uri = resolveChatImageUrl(message.imageUrl, token) || message.localUri;

    return (
      <View>
        <Pressable
          onPress={() => !failed && uri && setZoom(true)}
          onLongPress={askDelete}
          delayLongPress={450}
          accessibilityRole="imagebutton"
          accessibilityLabel="Photo envoyée dans la conversation"
        >
          {failed || !uri ? (
            <View style={[styles.image, styles.imageError]}>
              <Ionicons name="image-outline" size={28} color="#9CA3AF" />
              <Text style={styles.imageErrorText}>Image indisponible</Text>
            </View>
          ) : (
            <View>
              <Image
                source={{ uri }}
                style={styles.image}
                resizeMode="cover"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  // L'aperçu local reste affiché tant que l'envoi n'est pas terminé
                  if (!message.localUri || uri === message.localUri) setFailed(true);
                }}
              />
              {(loading || message.status === 'sending') && (
                <View style={styles.imageOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          )}
        </Pressable>

        {Boolean(message.content) && (
          <Text style={[textStyle, { color: textColor, marginTop: 4 }]}>{message.content}</Text>
        )}

        <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
          <Pressable style={styles.lightbox} onPress={() => setZoom(false)}>
            {uri ? <Image source={{ uri }} style={styles.lightboxImage} resizeMode="contain" /> : null}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setZoom(false)}
              accessibilityRole="button"
              accessibilityLabel="Fermer l'image"
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </Pressable>
        </Modal>
      </View>
    );
  }

  /* ---------- texte ---------- */
  return (
    <Text
      style={[textStyle, { color: textColor }]}
      onLongPress={askDelete}
      selectable
    >
      {message.content}
    </Text>
  );
};

const styles = StyleSheet.create({
  image: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#E5E7EB' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageError: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  imageErrorText: { fontSize: 12, color: '#6B7280' },
  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deletedText: { fontStyle: 'italic', opacity: 0.75 },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '85%' },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatMessageContent;
