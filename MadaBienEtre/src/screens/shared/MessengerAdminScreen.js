// src/screens/shared/MessengerAdminScreen.js
// Modération (administrateurs) : signalements à traiter + liste de tous les
// groupes (rejoindre un groupe pour le gérer ou modérer ses messages).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '../../components/common/Header';
import { getChatPalette } from '../../components/chat/chatTheme';
import { useTheme } from '../../context/ThemeContext';
import messengerService from '../../services/messengerService';
import { formatListTime, notifyInfo } from '../../utils/chatUi';

const REASONS = { spam: 'Spam', harcelement: 'Harcèlement', contenu_inapproprie: 'Contenu inapproprié', arnaque: 'Arnaque', autre: 'Autre' };

const MessengerAdminScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(themeColors, isDark), [themeColors, isDark]);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, g] = await Promise.all([messengerService.adminReports('open'), messengerService.adminGroups()]);
    setReports(r.success ? r.data : []);
    setGroups(g.success ? g.data : []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id, status) => {
    const res = await messengerService.adminReviewReport(id, status);
    if (res.success) setReports((l) => l.filter((x) => x.id !== id)); else notifyInfo('Modération', res.error);
  };

  const openGroup = async (g) => {
    if (!g.joined) {
      const res = await messengerService.adminJoinGroup(g.id);
      if (!res.success) return notifyInfo('Modération', res.error);
    }
    return navigation.navigate('MessengerChat', { conversationId: g.id, title: g.title });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.screenBg }]}>
      <Header title="Modération" showBack onBackPress={() => navigation.goBack()} />
      <View style={styles.tabs}>
        {[['reports', `Signalements (${reports.length})`], ['groups', `Groupes (${groups.length})`]].map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[styles.tab, { borderBottomColor: tab === k ? palette.primary : 'transparent' }]}>
            <Text style={{ color: tab === k ? palette.primary : palette.textSecondary, fontWeight: '700' }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} /> : tab === 'reports' ? (
        <FlatList
          data={reports} keyExtractor={(r) => String(r.id)} contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={<Text style={{ color: palette.textSecondary, textAlign: 'center', marginTop: 40 }}>Aucun signalement en attente 🎉</Text>}
          renderItem={({ item: r }) => (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={{ color: palette.danger, fontWeight: '800' }}>{REASONS[r.reason] || r.reason}</Text>
              <Text style={{ color: palette.textSecondary, fontSize: 12 }}>
                {r.reporter?.fullname} a signalé {r.reported_user?.fullname} · {r.conversation_title} · {formatListTime(r.created_at)}
              </Text>
              <Text style={{ color: palette.text, marginVertical: 8 }}>« {r.message_snapshot || '—'} »</Text>
              {!!r.details && <Text style={{ color: palette.textSecondary, fontSize: 12 }}>Détails : {r.details}</Text>}
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, { borderColor: palette.border, borderWidth: 1 }]} onPress={() => review(r.id, 'dismissed')}><Text style={{ color: palette.text }}>Ignorer</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: palette.primary }]} onPress={() => review(r.id, 'reviewed')}><Text style={{ color: '#fff', fontWeight: '700' }}>Traité</Text></TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={groups} keyExtractor={(g) => String(g.id)} contentContainerStyle={{ padding: 12, gap: 8 }}
          ListEmptyComponent={<Text style={{ color: palette.textSecondary, textAlign: 'center', marginTop: 40 }}>Aucun groupe.</Text>}
          renderItem={({ item: g }) => (
            <TouchableOpacity style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border, flexDirection: 'row', alignItems: 'center', gap: 10 }]} onPress={() => openGroup(g)}>
              <Ionicons name={g.type === 'announcement' ? 'megaphone' : 'people'} size={24} color={palette.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>{g.title}</Text>
                <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{g.member_count} membres{g.joined ? '' : ' · Rejoindre pour gérer'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
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
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  btn: { height: 38, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

export default MessengerAdminScreen;
