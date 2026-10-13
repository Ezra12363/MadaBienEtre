// src/screens/shared/ConversationsScreen.js
// Liste des conversations (client ET thérapeute) — maquette « Messages » :
// en-tête vert arrondi + recherche, puis avatar, nom, heure, dernier message
// et pastille « non lus ». Se rafraîchit seule quand un message arrive.
// Android, iOS et Web.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';

import ChatAvatar from '../../components/chat/ChatAvatar';
import { CHAT_MAX_WIDTH, getChatPalette } from '../../components/chat/chatTheme';
import { API_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import useChatUnread from '../../hooks/useChatUnread';
import { typography } from '../../theme';
import { confirmAsync } from '../../utils/chatImage';
import { emitChatChanged } from '../../utils/chatEvents';
import { formatListTime, notifyInfo, resolvePhotoUrl } from '../../utils/chatUi';
import { cleanToken } from '../../utils/wsUrl';

const isTherapistRole = (role) => String(role || '').toUpperCase() === 'THERAPIST';

const ConversationsScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(isDark), [isDark]);
  const { token, user } = useAuth();
  const { unreadCount } = useChatUnread();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const aliveRef = useRef(true);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${cleanToken(token)}` }),
    [token]
  );

  const load = useCallback(
    async ({ pull = false } = {}) => {
      if (!token) return;
      if (pull) setRefreshing(true);
      try {
        const res = await axios.get(`${API_URL}/chat/conversations`, {
          headers: authHeaders,
          timeout: 15000,
        });
        if (!aliveRef.current) return;
        setItems(Array.isArray(res.data) ? res.data : []);
        setError(null);
      } catch (_e) {
        if (aliveRef.current) setError('Impossible de charger les conversations.');
      } finally {
        if (aliveRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, authHeaders]
  );

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Premier affichage + à chaque retour sur l'écran
  useEffect(() => {
    load();
    const unsubscribe = navigation?.addListener?.('focus', () => load());
    return unsubscribe;
  }, [load, navigation]);

  // Un nouveau message non lu est arrivé : on relit la liste
  useEffect(() => {
    load();
  }, [unreadCount, load]);

  const openChat = useCallback(
    (c) => {
      const params = {
        bookingId: c.booking_id,
        otherUserId: c.other_user?.id,
        otherName: c.other_user?.fullname,
        otherPhoto: resolvePhotoUrl(c.other_user?.profile_image),
      };
      // Client : pile Messages (ChatDetail) — Thérapeute : écran racine TherapistChat
      navigation.navigate(isTherapistRole(user?.role) ? 'TherapistChat' : 'ChatDetail', params);
    },
    [navigation, user?.role]
  );

  const markAsRead = useCallback(
    async (c) => {
      const name = c.other_user?.fullname || 'cette personne';
      const ok = await confirmAsync(
        'Marquer comme lu ?',
        `Les messages de ${name} seront marqués comme lus.`,
        'Marquer comme lu'
      );
      if (!ok) return;

      // Mise à jour immédiate de la liste, puis appel serveur
      setItems((prev) =>
        prev.map((x) => (x.booking_id === c.booking_id ? { ...x, unread_count: 0 } : x))
      );
      try {
        await axios.put(`${API_URL}/chat/read/${c.booking_id}`, null, { headers: authHeaders });
        emitChatChanged();
      } catch (_e) {
        notifyInfo('Erreur', 'Impossible de marquer la conversation comme lue.');
        load();
      }
    },
    [authHeaders, load]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        String(c.other_user?.fullname || '').toLowerCase().includes(q) ||
        String(c.last_message?.preview || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  const renderItem = ({ item }) => {
    const name = item.other_user?.fullname || 'Utilisateur';
    const photo = resolvePhotoUrl(item.other_user?.profile_image);
    const mine = String(item.last_message?.sender_id) === String(user?.id);
    const unread = item.unread_count || 0;

    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: palette.rowDivider }]}
        onPress={() => openChat(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Conversation avec ${name}${unread ? `, ${unread} non lus` : ''}`}
      >
        <ChatAvatar uri={photo} name={name} size={50} radius={13} palette={palette} />

        <View style={styles.body}>
          <View style={styles.line}>
            <Text
              style={[styles.name, { color: palette.rowTitle }, unread > 0 && styles.bold]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text style={[styles.time, { color: unread ? palette.primary : palette.rowSub }]}>
              {formatListTime(item.last_message?.created_at)}
            </Text>
          </View>

          <View style={styles.line}>
            <View style={styles.previewWrap}>
              <Text
                style={[
                  styles.preview,
                  { color: unread ? palette.rowTitle : palette.rowSub },
                  unread > 0 && styles.bold,
                ]}
                numberOfLines={1}
              >
                {mine ? 'Vous : ' : ''}
                {item.last_message?.preview}
              </Text>

              {unread > 0 && (
                <View style={[styles.badge, { backgroundColor: palette.primary }]}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>

            {unread > 0 ? (
              <TouchableOpacity
                onPress={() => markAsRead(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Marquer comme lu"
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={palette.rowSub} />
              </TouchableOpacity>
            ) : (
              <View style={styles.ellipsisSpace} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const canGoBack = Boolean(navigation?.canGoBack?.());
  const topPad = insets.top + 10;

  return (
    <View style={[styles.container, { backgroundColor: palette.screenBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={palette.headerFrom} />

      <LinearGradient
        colors={[palette.headerFrom, palette.headerTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad }]}
      >
        <View style={styles.headerInner}>
          <View style={styles.topRow}>
            <View style={styles.sideSlot}>
              {canGoBack && (
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.75}
                  style={styles.sideButton}
                  accessibilityRole="button"
                  accessibilityLabel="Retour"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={28} color={palette.headerText} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.title, { color: palette.headerText }]}>Messages</Text>

            <View style={styles.sideSlot} />
          </View>

          <View style={[styles.search, { backgroundColor: palette.searchBg }]}>
            <Ionicons name="search-outline" size={20} color={palette.placeholder} />
            <TextInput
              style={[
                styles.searchInput,
                { color: palette.searchText },
                Platform.OS === 'web' && styles.searchInputWeb,
              ]}
              placeholder="Rechercher"
              placeholderTextColor={palette.placeholder}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              underlineColorAndroid="transparent"
              accessibilityLabel="Rechercher une conversation"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Effacer la recherche"
              >
                <Ionicons name="close-circle" size={18} color={palette.placeholder} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => String(c.booking_id)}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={[styles.listContent, filtered.length === 0 && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ pull: true })}
              tintColor={palette.primary}
              colors={[palette.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={[styles.emptyIcon, { backgroundColor: palette.primarySoft }]}>
                <Ionicons
                  name={
                    error
                      ? 'cloud-offline-outline'
                      : query
                        ? 'search-outline'
                        : 'chatbubbles-outline'
                  }
                  size={34}
                  color={palette.primary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.rowTitle }]}>
                {error || (query ? 'Aucun résultat' : 'Aucune conversation')}
              </Text>
              {!error && (
                <Text style={[styles.emptyText, { color: palette.rowSub }]}>
                  {query
                    ? `Aucune conversation ne correspond à « ${query.trim()} ».`
                    : `Vos échanges avec ${isTherapistRole(user?.role) ? 'vos clients' : 'votre thérapeute'} apparaîtront ici.`}
                </Text>
              )}
              {!!error && (
                <TouchableOpacity
                  onPress={() => load()}
                  style={[styles.retry, { backgroundColor: palette.primary }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryText}>Réessayer</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 18,
    paddingBottom: 22,
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
  headerInner: { width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sideSlot: { width: 40, alignItems: 'flex-start' },
  sideButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 21,
    fontFamily: typography.fontFamily.medium,
    fontWeight: '600',
  },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    paddingVertical: 0,
    margin: 0,
  },
  searchInputWeb: { outlineStyle: 'none', outlineWidth: 0 },

  list: { flex: 1 },
  listContent: {
    width: '100%',
    maxWidth: CHAT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 100,
  },
  emptyList: { flexGrow: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  body: { flex: 1, minWidth: 0, gap: 5 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 16, fontFamily: typography.fontFamily.medium, fontWeight: '600' },
  bold: { fontWeight: '800' },
  time: { fontSize: 13, fontFamily: typography.fontFamily.regular },
  previewWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  preview: { flexShrink: 1, fontSize: 14, fontFamily: typography.fontFamily.regular },
  ellipsisSpace: { width: 18, height: 18 },

  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: typography.fontFamily.semiBold, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', fontFamily: typography.fontFamily.regular },
  retry: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});

export default ConversationsScreen;
