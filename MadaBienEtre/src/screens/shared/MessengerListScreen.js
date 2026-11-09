// src/screens/shared/MessengerListScreen.js
// Liste des conversations : photo, nom, dernier message, heure, non lus,
// en ligne, épinglées, archives. Se met à jour en temps réel.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ChatActionSheet from '../../components/chat/ChatActionSheet';
import Header from '../../components/common/Header';
import ChatAvatar from '../../components/chat/ChatAvatar';
import { getChatPalette } from '../../components/chat/chatTheme';
import { useAuth } from '../../context/AuthContext';
import { useMessenger } from '../../context/MessengerContext';
import { useTheme } from '../../context/ThemeContext';
import messengerService, { buildFileUrl } from '../../services/messengerService';
import { formatListTime, resolvePhotoUrl } from '../../utils/chatUi';
import { isAdminUser } from '../../utils/messengerUtils';

const MessengerListScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(themeColors, isDark), [themeColors, isDark]);
  const { token, user } = useAuth();
  const { subscribe, presence, connected } = useMessenger();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState([]);
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState(null);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    const res = await messengerService.conversations(archived);
    if (res.success) { setItems(res.data); setError(null); } else setError(res.error);
    setLoading(false);
    setRefreshing(false);
  }, [archived]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => navigation?.addListener?.('focus', () => load()), [navigation, load]);
  useEffect(() => { if (connected) load(); }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => subscribe((ev) => {
    if (['message_new', 'message_updated', 'message_deleted', 'conversation_updated', 'conversation_removed', 'receipt'].includes(ev.type)) load();
  }), [subscribe, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((c) => (c.title || '').toLowerCase().includes(q)) : items;
  }, [items, query]);

  const open = (c) => navigation.navigate('MessengerChat', { conversationId: c.id, title: c.title });

  const setting = async (c, patch) => {
    await messengerService.settings(c.id, patch);
    load();
  };

  const renderItem = ({ item: c }) => {
    const last = c.last_message;
    const online = c.peer ? (presence[c.peer.id]?.is_online ?? c.peer.is_online) : false;
    const pair = c.type === 'direct' || c.type === 'booking';
    const photo = pair ? resolvePhotoUrl(c.photo) : buildFileUrl(c.photo, token);
    const mine = last?.sender_id === user?.id;
    const prefix = !pair && last && last.message_type !== 'system'
      ? `${mine ? 'Vous' : (last.sender_name || '').split(' ')[0]} : ` : (mine ? 'Vous : ' : '');
    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}
        onPress={() => open(c)} onLongPress={() => setMenuFor(c)} activeOpacity={0.8}
      >
        <View>
          <ChatAvatar uri={photo} name={c.title} size={52} palette={palette} />
          {online && <View style={[styles.dot, { backgroundColor: palette.online, borderColor: palette.surface }]} />}
          {!pair && (
            <View style={[styles.badgeType, { backgroundColor: palette.primary }]}>
              <Ionicons name={c.type === 'announcement' ? 'megaphone' : 'people'} size={10} color="#fff" />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.line}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>{c.title}{c.booking_id ? <Text style={{ color: palette.textSecondary, fontWeight: '400', fontSize: 12 }}>{`  ·  Réservation #${c.booking_id}`}</Text> : null}</Text>
            {c.is_muted && <Ionicons name="notifications-off" size={13} color={palette.textSecondary} />}
            {c.is_pinned && <Ionicons name="pin" size={13} color={palette.textSecondary} />}
            <Text style={{ color: c.unread_count ? palette.primary : palette.textSecondary, fontSize: 12 }}>{formatListTime(c.last_message_at)}</Text>
          </View>
          <View style={styles.line}>
            <Text
              style={{ flex: 1, color: c.unread_count ? palette.text : palette.textSecondary, fontWeight: c.unread_count ? '600' : '400', fontStyle: last?.deleted ? 'italic' : 'normal' }}
              numberOfLines={1}
            >
              {last ? `${prefix}${last.preview}` : 'Aucun message'}
            </Text>
            {c.unread_count > 0 && (
              <View style={[styles.unread, { backgroundColor: c.is_muted ? palette.textSecondary : palette.primary }]}>
                <Text style={styles.unreadTxt}>{c.unread_count > 99 ? '99+' : c.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.screenBg }]}>
      <Header title={archived ? 'Archives' : 'Messages'} />
      <View style={styles.top}>
        <Text style={[styles.h1, { color: palette.text }]}>{archived ? 'Archives' : 'Discussions'}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity style={styles.hBtn} onPress={() => navigation.navigate('MessengerSearch')} accessibilityLabel="Rechercher"><Ionicons name="search" size={22} color={palette.text} /></TouchableOpacity>
          <TouchableOpacity style={styles.hBtn} onPress={() => navigation.navigate('CallHistory')} accessibilityLabel="Appels"><Ionicons name="call-outline" size={22} color={palette.text} /></TouchableOpacity>
          {isAdminUser(user) && (
            <TouchableOpacity style={styles.hBtn} onPress={() => navigation.navigate('MessengerAdmin')} accessibilityLabel="Modération"><Ionicons name="shield-checkmark-outline" size={22} color={palette.text} /></TouchableOpacity>
          )}
          <TouchableOpacity style={styles.hBtn} onPress={() => setArchived((a) => !a)} accessibilityLabel="Archives">
            <Ionicons name={archived ? 'chatbubbles-outline' : 'archive-outline'} size={22} color={palette.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.search, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
        <Ionicons name="search" size={18} color={palette.textSecondary} />
        <TextInput
          value={query} onChangeText={setQuery} placeholder="Rechercher une conversation" placeholderTextColor={palette.placeholder}
          style={[styles.searchInput, { color: palette.inputText }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
        />
      </View>

      {!!user?.id && !connected && (
        <Text style={[styles.offline, { color: palette.warning }]}>Connexion en cours… les messages arriveront dès le retour du réseau.</Text>
      )}

      {loading ? <ActivityIndicator color={palette.primary} size="large" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={filtered} keyExtractor={(c) => String(c.id)} renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={56} color={palette.textSecondary} />
              <Text style={{ color: palette.textSecondary, textAlign: 'center', marginTop: 10 }}>
                {error || (archived ? 'Aucune conversation archivée.' : 'Aucune conversation. Touchez ✎ pour écrire.')}
              </Text>
            </View>
          }
        />
      )}

      {!archived && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: palette.primary }]} onPress={() => navigation.navigate('MessengerNew')}
          accessibilityLabel="Nouvelle conversation"
        >
          <Ionicons name="create" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <ChatActionSheet
        visible={!!menuFor} title={menuFor?.title} palette={palette} onClose={() => setMenuFor(null)}
        actions={menuFor ? [
          { key: 'pin', label: menuFor.is_pinned ? 'Désépingler' : 'Épingler', icon: 'pin', onPress: () => setting(menuFor, { is_pinned: !menuFor.is_pinned }) },
          { key: 'mute', label: menuFor.is_muted ? 'Réactiver les notifications' : 'Mettre en sourdine', icon: 'notifications-off', onPress: () => setting(menuFor, { is_muted: !menuFor.is_muted }) },
          { key: 'archive', label: menuFor.is_archived ? 'Désarchiver' : 'Archiver', icon: 'archive-outline', onPress: () => setting(menuFor, { is_archived: !menuFor.is_archived }) },
        ] : []}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  h1: { fontSize: 26, fontWeight: '800' },
  hBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 4, paddingHorizontal: 12, height: 42, borderRadius: 21, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  offline: { textAlign: 'center', fontSize: 12, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 1 },
  name: { flex: 1, fontSize: 16, fontWeight: '700' },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  badgeType: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  unread: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 30 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
});

export default MessengerListScreen;
