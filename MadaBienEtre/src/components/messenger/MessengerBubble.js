// Bulle de message : texte, image, document, vocal, sticker, position, appel,
// système + réponse citée, « transféré », « modifié », réactions, coches.
import { memo } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { typography } from '../../theme';
import { buildFileUrl } from '../../services/messengerService';
import { formatClock, getMapsUrl, resolvePhotoUrl } from '../../utils/chatUi';
import { formatSize } from '../../utils/messengerUtils';
import ChatAvatar from '../chat/ChatAvatar';
import LocationMessageCard from '../chat/LocationMessageCard';
import AudioBubble from './AudioBubble';
import { Sticker } from './EmojiStickerPanel';

const Ticks = ({ status, palette, onDark }) => {
  const base = onDark ? 'rgba(255,255,255,0.75)' : palette.meta;
  const seen = onDark ? '#B9F6CA' : palette.metaRead;
  if (status === 'sending') return <Ionicons name="time-outline" size={13} color={base} />;
  if (status === 'failed') return <Ionicons name="alert-circle" size={14} color={palette.danger} />;
  if (status === 'sent') return <Ionicons name="checkmark" size={14} color={base} />;
  return <Ionicons name="checkmark-done" size={15} color={status === 'read' ? seen : base} />;
};

const MessengerBubble = ({
  msg, mine, palette, token, maxWidth, showSender, status, readBy, groupChat, highlighted,
  onLongPress, onReplyPress, onImagePress, onReact, onRetry,
}) => {
  const photo = resolvePhotoUrl(msg.sender?.profile_image);

  if (msg.message_type === 'system') {
    return (
      <View style={styles.center}>
        <Text style={[styles.pill, { backgroundColor: palette.pillBg, color: palette.pillText }]}>{msg.content}</Text>
      </View>
    );
  }
  if (msg.message_type === 'call') {
    const missed = /manqué|refusé/i.test(msg.content);
    return (
      <View style={styles.center}>
        <View style={[styles.pillRow, { backgroundColor: palette.pillBg }]}>
          <Ionicons name={missed ? 'call-outline' : 'call'} size={13} color={missed ? palette.danger : palette.pillText} />
          <Text style={[styles.pillTxt, { color: missed ? palette.danger : palette.pillText }]}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  const bg = mine ? palette.ownBubble : palette.otherBubble;
  const fg = mine ? palette.ownText : palette.otherText;
  const sub = mine ? 'rgba(255,255,255,0.8)' : palette.meta;
  const isSticker = msg.message_type === 'sticker' && !msg.deleted;
  const url = msg.attachment ? buildFileUrl(msg.attachment.url, token) : null;

  const body = () => {
    if (msg.deleted) {
      return <Text style={[styles.text, { color: sub, fontStyle: 'italic' }]}>Message supprimé</Text>;
    }
    switch (msg.message_type) {
      case 'image':
        return (
          <View>
            <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress?.(url)}>
              <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
            </TouchableOpacity>
            {!!msg.content && <Text style={[styles.text, { color: fg, marginTop: 6 }]}>{msg.content}</Text>}
          </View>
        );
      case 'file':
        return (
          <View>
            <TouchableOpacity
              style={styles.fileRow}
              onPress={() => Linking.openURL(buildFileUrl(msg.attachment.url, token, { download: true }))}
              accessibilityLabel={`Ouvrir ${msg.attachment?.name}`}
            >
              <Ionicons name="document-text" size={30} color={mine ? '#fff' : palette.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.fileName, { color: fg }]} numberOfLines={2}>{msg.attachment?.name}</Text>
                <Text style={{ color: sub, fontSize: 11 }}>{formatSize(msg.attachment?.size)} · Toucher pour ouvrir</Text>
              </View>
            </TouchableOpacity>
            {!!msg.content && <Text style={[styles.text, { color: fg, marginTop: 6 }]}>{msg.content}</Text>}
          </View>
        );
      case 'audio':
        return (
          <AudioBubble uri={url} duration={msg.attachment?.duration} color={mine ? '#fff' : palette.primary}
            trackColor={mine ? 'rgba(255,255,255,0.35)' : palette.border} />
        );
      case 'location':
        // même carte que le chat existant : lieu du RDV, position en route, fiche de réservation, suivi
        return (
          <LocationMessageCard
            message={{
              latitude: msg.location?.latitude,
              longitude: msg.location?.longitude,
              address: msg.location?.address,
              locationType: msg.location?.location_type,
              bookingInfo: msg.location?.booking_info,
            }}
            isOwn={mine}
            textColor={fg}
            onLongPress={() => onLongPress?.(msg)}
          />
        );
      default:
        return <Text style={[styles.text, { color: fg }]} selectable>{msg.content}</Text>;
    }
  };

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
      {!mine && groupChat ? (
        <View style={styles.avatarCol}>
          {showSender ? <ChatAvatar uri={photo} name={msg.sender?.fullname} size={30} palette={palette} /> : null}
        </View>
      ) : null}

      <View style={{ maxWidth, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => onLongPress?.(msg)}
          delayLongPress={250}
          style={[
            isSticker ? styles.stickerWrap : [styles.bubble, { backgroundColor: bg, borderColor: mine ? bg : palette.otherBorder }, msg.message_type === 'image' && !msg.deleted && !msg.content && styles.imageBubble],
            highlighted && { borderColor: palette.warning, borderWidth: 2 },
          ]}
        >
          {showSender && !mine && groupChat && !isSticker && (
            <Text style={[styles.sender, { color: palette.primary }]} numberOfLines={1}>
              {msg.sender?.fullname}{msg.sender?.role === 'ADMIN' ? ' · Admin' : ''}
            </Text>
          )}
          {msg.is_forwarded && !msg.deleted && (
            <View style={styles.fwdRow}>
              <Ionicons name="arrow-redo" size={11} color={sub} />
              <Text style={{ color: sub, fontSize: 11 }}>Transféré{msg.forwarded_from_name ? ` de ${msg.forwarded_from_name}` : ''}</Text>
            </View>
          )}
          {msg.reply_to && !msg.deleted && (
            <TouchableOpacity
              onPress={() => onReplyPress?.(msg.reply_to.id)}
              style={[styles.quote, { borderLeftColor: mine ? '#fff' : palette.primary, backgroundColor: mine ? 'rgba(255,255,255,0.18)' : palette.primarySoft }]}
            >
              <Text style={{ color: mine ? '#fff' : palette.primary, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{msg.reply_to.sender_name}</Text>
              <Text style={{ color: fg, fontSize: 12 }} numberOfLines={2}>{msg.reply_to.preview}</Text>
            </TouchableOpacity>
          )}

          {isSticker ? <Sticker item={msg.sticker || { emoji: '🙂' }} animated={msg.sticker?.animated} size={84} /> : body()}

          {!isSticker && (
            <View style={styles.meta}>
              {msg.is_pinned && <Ionicons name="pin" size={11} color={sub} />}
              {!!msg.edited_at && !msg.deleted && <Text style={{ color: sub, fontSize: 10 }}>modifié</Text>}
              <Text style={{ color: sub, fontSize: 10 }}>{formatClock(msg.created_at)}</Text>
              {mine && !msg.deleted && <Ticks status={status} palette={palette} onDark />}
            </View>
          )}
        </TouchableOpacity>

        {isSticker && (
          <View style={styles.meta}>
            <Text style={{ color: palette.meta, fontSize: 10 }}>{formatClock(msg.created_at)}</Text>
            {mine && <Ticks status={status} palette={palette} />}
          </View>
        )}

        {!!msg.reactions?.length && !msg.deleted && (
          <View style={styles.reacts}>
            {msg.reactions.map((r) => (
              <TouchableOpacity
                key={r.emoji}
                onPress={() => onReact?.(msg, r.emoji)}
                style={[styles.react, { backgroundColor: palette.surface, borderColor: palette.border }]}
              >
                <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
                {r.count > 1 && <Text style={{ fontSize: 11, color: palette.textSecondary }}>{r.count}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {mine && status === 'read' && groupChat && readBy > 0 && (
          <Text style={{ color: palette.meta, fontSize: 10, marginTop: 2 }}>Vu par {readBy}</Text>
        )}
        {mine && status === 'failed' && (
          <TouchableOpacity onPress={() => onRetry?.(msg)}>
            <Text style={{ color: palette.danger, fontSize: 11, marginTop: 2 }}>Échec de l'envoi — Réessayer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, marginVertical: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarCol: { width: 36, justifyContent: 'flex-end', paddingBottom: 2 },
  bubble: { borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth },
  stickerWrap: { paddingHorizontal: 4 },
  text: { fontSize: 15, fontFamily: typography.fontFamily.regular, lineHeight: 20 },
  sender: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  image: { width: 230, height: 230, borderRadius: 12, backgroundColor: '#E5E7EB' },
  imageBubble: { paddingHorizontal: 3, paddingTop: 3, paddingBottom: 5 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 210 },
  fileName: { fontSize: 14, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 3 },
  fwdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  quote: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 },
  reacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -4 },
  react: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 1 },
  center: { alignItems: 'center', marginVertical: 6, paddingHorizontal: 20 },
  pill: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', textAlign: 'center' },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  pillTxt: { fontSize: 12 },
});

export default memo(MessengerBubble);
