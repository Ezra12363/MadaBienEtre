// src/screens/shared/ConversationsScreen.js
// Liste des conversations (client ET thérapeute), au style des autres écrans :
// Header partagé, fond du thème, cartes arrondies, recherche.
// Chaque ligne : avatar, nom, heure, dernier message (« Message supprimé » en
// italique quand il a été supprimé), pastille « non lus » et menu ⋮ :
//   - Marquer comme lu
//   - Supprimer tous mes messages (envoyés à cette personne)
// Se rafraîchit seule quand un message arrive. Android, iOS et Web.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

import ChatActionSheet from '../../components/chat/ChatActionSheet';
import ChatConfirmHost from '../../components/chat/ChatConfirmHost';
import ChatAvatar from '../../components/chat/ChatAvatar';
import ChatStatusLabel from '../../components/chat/ChatStatusLabel';
import { CHAT_MAX_WIDTH, getChatPalette } from '../../components/chat/chatTheme';
import Header from '../../components/common/Header';
import { API_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import useChatUnread from '../../hooks/useChatUnread';
import { typography } from '../../theme';
import { emitChatChanged } from '../../utils/chatEvents';
import { confirmAsync } from '../../utils/chatImage';
import { formatListTime, notifyInfo, resolvePhotoUrl } from '../../utils/chatUi';
import { cleanToken } from '../../utils/wsUrl';

const isTherapistRole = (role) => String(role || '').toUpperCase() === 'THERAPIST';

const ConversationsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(themeColors, isDark), [themeColors, isDark]);
  const { token, user } = useAuth();
  const { unreadCount } = useChatUnread();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState(null); // conversation dont le menu ⋮ est ouvert
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

  /* ------------------------------ actions du menu ------------------------------ */
  const markAsRead = useCallback(
    async (c) => {
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

  const deleteMine = useCallback(
    async (c) => {
      const n = c.my_count || 0;
      const name = c.other_user?.fullname || 'cette personne';
      const ok = await confirmAsync(
        'Supprimer tous vos messages ?',
        `${n > 0 ? `Les ${n} message${n > 1 ? 's' : ''} que vous avez envoyé${n > 1 ? 's' : ''}` : 'Les messages que vous avez envoyés'} ` +
          `à ${name} seront supprimés pour tout le monde. Cette action est irréversible.`,
        'Tout supprimer'
      );
      if (!ok) return;

      try {
        await axios.delete(`${API_URL}/chat/messages/${c.booking_id}/mine`, {
          headers: authHeaders,
          timeout: 30000,
        });
        emitChatChanged();
      } catch (_e) {
        notifyInfo('Suppression impossible', 'Vérifiez votre connexion puis réessayez.');
      }
      load();
    },
    [authHeaders, load]
  );

  const menuActions = useMemo(() => {
    if (!menuFor) return [];
    const list = [];
    if ((menuFor.unread_count || 0) > 0) {
      list.push({
        key: 'read',
        label: 'Marquer comme lu',
        icon: 'checkmark-done-outline',
        onPress: () => markAsRead(menuFor),
      });
    }
    if ((menuFor.my_count || 0) > 0) {
      list.push({
        key: 'delete-mine',
        label: `Supprimer mes messages (${menuFor.my_count})`,
        icon: 'trash-outline',
        destructive: true,
        onPress: () => deleteMine(menuFor),
      });
    }
    list.push({
      key: 'open',
      label: 'Ouvrir la conversation',
      icon: 'chatbubble-ellipses-outline',
      onPress: () => openChat(menuFor),
    });
    return list;
  }, [menuFor, markAsRead, deleteMine, openChat]);

  /* --------------------------------- liste --------------------------------- */
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
    const last = item.last_message || {};
    const deleted = Boolean(last.deleted);
    const mine = String(last.sender_id) === String(user?.id);
    const unread = item.unread_count || 0;

    return (
      // ✅ FIX web : un <button> ne peut pas contenir un autre <button>
      // (TouchableOpacity imbriqué => erreur validateDOMNesting). La carte est
      // donc une simple View ; la zone cliquable et le bouton ⋮ sont FRÈRES.
      <View
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => openChat(item)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Conversation avec ${name}${unread ? `, ${unread} non lus` : ''}`}
        >
        <ChatAvatar uri={photo} name={name} size={52} palette={palette} />

        <View style={styles.body}>
          <View style={styles.line}>
            <Text
              style={[styles.name, { color: palette.text }, unread > 0 && styles.bold]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text style={[styles.time, { color: unread ? palette.primary : palette.textSecondary }]}>
              {formatListTime(last.created_at)}
            </Text>
          </View>

          <View style={styles.line}>
            <View style={styles.previewWrap}>
              {deleted && (
                <Ionicons name="ban-outline" size={14} color={palette.textSecondary} />
              )}
              <Text
                style={[
                  styles.preview,
                  { color: unread ? palette.text : palette.textSecondary },
                  unread > 0 && styles.bold,
                  deleted && styles.deleted,
                ]}
                numberOfLines={1}
              >
                {mine && !deleted ? 'Vous : ' : ''}
                {last.preview}
              </Text>
              {mine && !deleted && (
                <ChatStatusLabel
                  status={last.is_read || last.status === 'read' ? 'read' : 'delivered'}
                  palette={palette}
                />
              )}

              {unread > 0 && (
                <View style={[styles.badge, { backgroundColor: palette.primary }]}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMenuFor(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.menuBtn}
          accessibilityRole="button"
          accessibilityLabel="Options de la conversation"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  const canGoBack = Boolean(navigation?.canGoBack?.());

  return (
    <View style={[styles.container, { backgroundColor: palette.screenBg }]}>
      <Header title="Messages" showBack={canGoBack} />

      <View style={styles.searchWrap}>
        <View
          style={[
            styles.search,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Ionicons name="search-outline" size={20} color={palette.placeholder} />
          <TextInput
            style={[
              styles.searchInput,
              { color: palette.text },
              Platform.OS === 'web' && styles.searchInputWeb,
            ]}
            placeholder="Rechercher une conversation"
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
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                {error || (query ? 'Aucun résultat' : 'Aucune conversation')}
              </Text>
              {!error && (
                <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
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

      <ChatConfirmHost />

      <ChatActionSheet
        visible={Boolean(menuFor)}
        title={menuFor?.other_user?.fullname || 'Conversation'}
        subtitle={menuFor?.booking_id ? `Réservation #${menuFor.booking_id}` : undefined}
        actions={menuActions}
        onClose={() => setMenuFor(null)}
        palette={palette}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  searchWrap: {
    width: '100%',
    maxWidth: CHAT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
    gap: 10,
  },
  emptyList: { flexGrow: 1 },

  cardMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    ...Platform.select({
      android: { elevation: 1 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.05)', cursor: 'pointer' },
      default: {},
    }),
  },
  body: { flex: 1, minWidth: 0, gap: 5 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 15, fontFamily: typography.fontFamily.semiBold, fontWeight: '600' },
  bold: { fontWeight: '800' },
  time: { fontSize: 12, fontFamily: typography.fontFamily.regular },
  previewWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  preview: { flexShrink: 1, fontSize: 13, fontFamily: typography.fontFamily.regular },
  deleted: { fontStyle: 'italic' },

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
