// src/components/chat/MessageBubble.js
// Une ligne de message : l'heure en petit AU-DESSUS de la bulle, bulle de la
// couleur principale de l'app (moi, à droite) ou surface + bordure (l'autre).
// Gère : texte, image, message supprimé, envoi en cours / échec (réessayer),
// accusé de lecture (✓ envoyé, ✓✓ lu) et suppression de MON message :
//   - mobile : appui long sur la bulle ;
//   - web    : bouton corbeille au survol (ou appui long sur écran tactile).
import { memo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { typography } from '../../theme';
import { confirmAsync } from '../../utils/chatImage';
import { formatClock } from '../../utils/chatUi';
import ChatMessageContent from './ChatMessageContent';

const IS_WEB = Platform.OS === 'web';

const StatusIcon = ({ status, palette }) => {
  if (status === 'sending') {
    return <ActivityIndicator size={10} color={palette.meta} style={styles.statusIcon} />;
  }
  if (status === 'failed') {
    return <Ionicons name="alert-circle" size={14} color={palette.danger} style={styles.statusIcon} />;
  }
  if (status === 'read') {
    return <Ionicons name="checkmark-done" size={15} color={palette.metaRead} style={styles.statusIcon} />;
  }
  return <Ionicons name="checkmark" size={14} color={palette.meta} style={styles.statusIcon} />;
};

const MessageBubble = ({ message, isOwn, showTime, isGroupStart, palette, token, onDelete, onRetry }) => {
  const [hover, setHover] = useState(false);

  const failed = isOwn && message.status === 'failed';
  const isImage = message.type === 'image' && !message.deleted;
  const canDelete = isOwn && !message.deleted && message.status !== 'sending' && !!onDelete;

  const askDelete = async () => {
    const ok = await confirmAsync(
      'Supprimer le message ?',
      isImage
        ? 'Cette photo sera supprimée pour tout le monde.'
        : 'Ce message sera supprimé pour tout le monde.'
    );
    if (ok) onDelete(message.id);
  };

  const bubbleStyle = [
    styles.bubble,
    isOwn ? styles.bubbleOwn : styles.bubbleOther,
    isOwn
      ? { backgroundColor: palette.ownBubble }
      : { backgroundColor: palette.otherBubble, borderWidth: 1, borderColor: palette.otherBorder },
    isImage && styles.bubbleImage,
    message.deleted && { opacity: 0.75 },
    failed && { borderWidth: 1.5, borderColor: palette.danger },
  ];

  const bubble = (
    <View style={bubbleStyle}>
      <ChatMessageContent
        message={message}
        isOwn={isOwn}
        token={token}
        textStyle={styles.text}
        textColor={isOwn ? palette.ownText : palette.otherText}
        onDelete={onDelete}
      />
    </View>
  );

  const hoverProps = IS_WEB
    ? { onHoverIn: () => setHover(true), onHoverOut: () => setHover(false) }
    : {};
  const Wrap = IS_WEB ? Pressable : View;

  return (
    <Wrap
      {...hoverProps}
      style={[
        styles.row,
        isOwn ? styles.rowOwn : styles.rowOther,
        { marginTop: isGroupStart ? 12 : 4 },
      ]}
    >
      {showTime && (
        <View style={[styles.metaRow, isOwn ? styles.metaOwn : styles.metaOther]}>
          <Text style={[styles.time, { color: palette.meta }]}>{formatClock(message.createdAt)}</Text>
          {isOwn && !message.deleted && <StatusIcon status={message.status} palette={palette} />}
        </View>
      )}

      <View style={styles.bubbleLine}>
        {IS_WEB && canDelete && !failed && (
          <TouchableOpacity
            onPress={askDelete}
            activeOpacity={0.7}
            style={[styles.trash, { opacity: hover ? 1 : 0, backgroundColor: palette.dangerSoft }]}
            accessibilityRole="button"
            accessibilityLabel="Supprimer ce message"
          >
            <Ionicons name="trash-outline" size={16} color={palette.danger} />
          </TouchableOpacity>
        )}

        {failed ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onRetry?.(message.id)}
            accessibilityRole="button"
            accessibilityLabel="Échec de l'envoi, appuyer pour réessayer"
          >
            {bubble}
          </TouchableOpacity>
        ) : (
          bubble
        )}
      </View>

      {failed && (
        <View style={styles.failedRow}>
          <Text style={[styles.failedText, { color: palette.danger }]}>
            Échec de l'envoi · Appuyez pour réessayer
          </Text>
          {!!onDelete && (
            <TouchableOpacity
              onPress={askDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Supprimer ce message"
            >
              <Ionicons name="trash-outline" size={14} color={palette.danger} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </Wrap>
  );
};

const styles = StyleSheet.create({
  row: { maxWidth: '82%', minWidth: 0 },
  rowOwn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 2 },
  metaOwn: { justifyContent: 'flex-end' },
  metaOther: { justifyContent: 'flex-start' },
  time: { fontSize: 11, fontFamily: typography.fontFamily.regular },
  statusIcon: { marginLeft: 4 },

  bubbleLine: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  trash: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '100%',
    flexShrink: 1,
    ...Platform.select({ web: { wordBreak: 'break-word' }, default: {} }),
  },
  bubbleOwn: { borderBottomRightRadius: 5 },
  bubbleOther: { borderBottomLeftRadius: 5 },
  bubbleImage: { padding: 4 },

  text: { fontSize: 14, lineHeight: 21, fontFamily: typography.fontFamily.regular },

  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  failedText: { fontSize: 11, fontFamily: typography.fontFamily.regular },
});

export default memo(MessageBubble);
