// src/components/chat/MessageBubble.js
// Une ligne de message, comme la maquette : l'heure en petit AU-DESSUS de la
// bulle, bulle verte (moi, à droite) ou grise (l'autre, à gauche).
// Gère : texte, image, message supprimé, envoi en cours / échec (réessayer),
// accusé de lecture (✓ envoyé, ✓✓ vert = lu).
import { memo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { typography } from '../../theme';
import { formatClock } from '../../utils/chatUi';
import ChatMessageContent from './ChatMessageContent';

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
  const failed = isOwn && message.status === 'failed';
  const isImage = message.type === 'image' && !message.deleted;

  const bubbleStyle = [
    styles.bubble,
    isOwn ? styles.bubbleOwn : styles.bubbleOther,
    { backgroundColor: isOwn ? palette.ownBubble : palette.otherBubble },
    isImage && styles.bubbleImage,
    message.deleted && { opacity: 0.8 },
    failed && { borderWidth: 1.5, borderColor: palette.danger },
  ];

  const content = (
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

  return (
    <View
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

      {failed ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onRetry?.(message.id)}
          accessibilityRole="button"
          accessibilityLabel="Échec de l'envoi, appuyer pour réessayer"
        >
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}

      {failed && (
        <Text style={[styles.failedText, { color: palette.danger }]}>
          Échec de l'envoi · Appuyez pour réessayer
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { maxWidth: '78%', minWidth: 0 },
  rowOwn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 2 },
  metaOwn: { justifyContent: 'flex-end' },
  metaOther: { justifyContent: 'flex-start' },
  time: { fontSize: 11, fontFamily: typography.fontFamily.regular },
  statusIcon: { marginLeft: 4 },

  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    maxWidth: '100%',
    ...Platform.select({ web: { wordBreak: 'break-word' }, default: {} }),
  },
  bubbleOwn: { borderBottomRightRadius: 5 },
  bubbleOther: { borderBottomLeftRadius: 5 },
  bubbleImage: { padding: 4 },

  text: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: typography.fontFamily.regular,
  },
  failedText: { fontSize: 11, marginTop: 4, fontFamily: typography.fontFamily.regular },
});

export default memo(MessageBubble);
