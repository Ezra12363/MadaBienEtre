// src/screens/shared/CallHistoryScreen.js
// Historique des appels vocaux : sens, durée, manqués. Toucher = ouvrir la conversation.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '../../components/common/Header';
import ChatAvatar from '../../components/chat/ChatAvatar';
import { getChatPalette } from '../../components/chat/chatTheme';
import { useTheme } from '../../context/ThemeContext';
import messengerService from '../../services/messengerService';
import { formatListTime, resolvePhotoUrl } from '../../utils/chatUi';
import { formatDuration } from '../../utils/messengerUtils';

const CallHistoryScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(themeColors, isDark), [themeColors, isDark]);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await messengerService.calls();
    setItems(res.success ? res.data : []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); return navigation.addListener('focus', load); }, [load, navigation]);

  const label = (c) => {
    if (c.status === 'ended' && c.duration_seconds >= 0 && c.direction) return formatDuration(c.duration_seconds);
    return { declined: 'Refusé', cancelled: 'Annulé', missed: 'Sans réponse', busy: 'Occupé' }[c.status] || '';
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.screenBg }]}>
      <Header title="Appels" showBack onBackPress={() => navigation.goBack()} />
      {loading ? <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={items} keyExtractor={(c) => String(c.id)} contentContainerStyle={{ padding: 12, gap: 6 }}
          ListEmptyComponent={<Text style={{ color: palette.textSecondary, textAlign: 'center', marginTop: 40 }}>Aucun appel pour le moment.</Text>}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}
              onPress={() => navigation.navigate('MessengerChat', { conversationId: c.conversation_id, title: c.peer.fullname })}
            >
              <ChatAvatar uri={resolvePhotoUrl(c.peer.profile_image)} name={c.peer.fullname} size={46} palette={palette} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.missed ? palette.danger : palette.text, fontWeight: '700' }} numberOfLines={1}>{c.peer.fullname}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name={c.direction === 'outgoing' ? 'arrow-up' : 'arrow-down'} size={12} color={c.missed ? palette.danger : palette.textSecondary} />
                  <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{c.direction === 'outgoing' ? 'Sortant' : c.missed ? 'Manqué' : 'Entrant'} · {label(c)}</Text>
                </View>
              </View>
              <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{formatListTime(c.created_at)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});

export default CallHistoryScreen;
