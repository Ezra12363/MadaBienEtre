// src/screens/shared/MessengerSearchScreen.js
// Recherche de conversations et de messages (globale ou dans une conversation).
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '../../components/common/Header';
import { getChatPalette } from '../../components/chat/chatTheme';
import { useTheme } from '../../context/ThemeContext';
import messengerService from '../../services/messengerService';
import { formatListTime } from '../../utils/chatUi';

const MessengerSearchScreen = ({ navigation, route }) => {
  const scopeId = route.params?.conversationId;
  const { colors: themeColors, isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(themeColors, isDark), [themeColors, isDark]);
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ messages: [], conversations: [] });

  useEffect(() => {
    if (q.trim().length < 2) { setData({ messages: [], conversations: [] }); return undefined; }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await messengerService.search(q.trim(), scopeId);
      setData(res.success ? res.data : { messages: [], conversations: [] });
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, scopeId]);

  const rows = [
    ...data.conversations.map((c) => ({ key: `c${c.id}`, kind: 'conv', c })),
    ...data.messages.map((m) => ({ key: `m${m.id}`, kind: 'msg', m })),
  ];

  const openRow = (r) => {
    if (r.kind === 'conv') navigation.navigate('MessengerChat', { conversationId: r.c.id, title: r.c.title });
    else navigation.navigate('MessengerChat', { conversationId: r.m.conversation_id, title: r.m.conversation_title, focusMessageId: r.m.id });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.screenBg }]}>
      <Header title="Recherche" showBack onBackPress={() => navigation.goBack()} />
      <View style={styles.head}>
        <View style={[styles.search, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
          <TextInput
            autoFocus value={q} onChangeText={setQ} placeholder={scopeId ? 'Rechercher dans la conversation' : 'Rechercher un message ou une conversation'}
            placeholderTextColor={palette.placeholder} style={[styles.input, { color: palette.inputText }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
          />
          {loading && <ActivityIndicator color={palette.primary} />}
        </View>
      </View>
      <FlatList
        data={rows} keyExtractor={(r) => r.key} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, gap: 6 }}
        ListEmptyComponent={<Text style={{ color: palette.textSecondary, textAlign: 'center', marginTop: 40 }}>{q.trim().length < 2 ? 'Tapez au moins 2 lettres.' : loading ? '' : 'Aucun résultat.'}</Text>}
        renderItem={({ item: r }) => (
          <TouchableOpacity style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => openRow(r)}>
            <Ionicons name={r.kind === 'conv' ? 'chatbubbles' : 'chatbubble-ellipses-outline'} size={22} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontWeight: '700' }} numberOfLines={1}>{r.kind === 'conv' ? r.c.title : r.m.conversation_title || r.m.sender?.fullname}</Text>
              <Text style={{ color: palette.textSecondary }} numberOfLines={2}>
                {r.kind === 'conv' ? (r.c.last_message?.preview || 'Conversation') : (r.m.content || r.m.attachment?.name)}
              </Text>
            </View>
            {r.kind === 'msg' && <Text style={{ color: palette.textSecondary, fontSize: 11 }}>{formatListTime(r.m.created_at)}</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, height: 44 },
  input: { flex: 1, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});

export default MessengerSearchScreen;
