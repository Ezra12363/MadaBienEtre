// src/components/chat/ChatHeader.js
// En-tête vert arrondi de la conversation : retour, titre, avatar, nom,
// statut (« Actif maintenant ») et boutons appel / vidéo.
// `compact` (web large) : la barre de navigation du haut fournit déjà le
// retour et le titre, on n'affiche que la carte de l'interlocuteur.
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography } from '../../theme';
import ChatAvatar from './ChatAvatar';
import { CHAT_MAX_WIDTH } from './chatTheme';

const IconButton = ({ name, label, onPress, palette }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    style={[styles.iconButton, { backgroundColor: palette.headerIconBg }]}
    accessibilityRole="button"
    accessibilityLabel={label}
    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
  >
    <Ionicons name={name} size={20} color={palette.headerText} />
  </TouchableOpacity>
);

const ChatHeader = ({
  palette,
  title = 'Conversation',
  name,
  photo,
  statusText,
  statusColor,
  compact = false,
  onBack,
  onCall,
  onVideo,
  onLayout,
}) => {
  const insets = useSafeAreaInsets();
  const topPad = compact ? 12 : insets.top + 10;

  return (
    <LinearGradient
      colors={[palette.headerFrom, palette.headerTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: topPad }, compact && styles.headerCompact]}
      onLayout={onLayout}
    >
      <View style={styles.inner}>
        {!compact && (
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.75}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={28} color={palette.headerText} />
            </TouchableOpacity>

            <Text style={[styles.title, { color: palette.headerText }]} numberOfLines={1}>
              {title}
            </Text>

            {/* équilibre le bouton retour pour centrer le titre */}
            <View style={styles.backButton} />
          </View>
        )}

        <View style={styles.peerRow}>
          <ChatAvatar uri={photo} name={name} size={50} radius={13} palette={palette} />

          <View style={styles.peerText}>
            <Text style={[styles.name, { color: palette.headerText }]} numberOfLines={1}>
              {name || 'Conversation'}
            </Text>

            {!!statusText && (
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: statusColor || palette.online }]} />
                <Text style={[styles.status, { color: palette.headerSubText }]} numberOfLines={1}>
                  {statusText}
                </Text>
              </View>
            )}
          </View>

          <IconButton name="call" label="Appeler" onPress={onCall} palette={palette} />
          <IconButton name="videocam" label="Appel vidéo" onPress={onVideo} palette={palette} />
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 2,
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: '#0B8F54',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      web: { boxShadow: '0 6px 16px rgba(11,143,84,0.18)' },
      default: {},
    }),
  },
  headerCompact: { paddingBottom: 14 },
  inner: { width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 21,
    fontFamily: typography.fontFamily.medium,
    fontWeight: '600',
  },

  peerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  peerText: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontFamily: typography.fontFamily.semiBold, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
  status: { fontSize: 13, fontFamily: typography.fontFamily.regular, flexShrink: 1 },

  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatHeader;
