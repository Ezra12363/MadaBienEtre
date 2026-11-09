// src/screens/shared/MessengerNewScreen.js
// Nouvelle conversation privée (contacts autorisés) ; pour l'administrateur,
// création d'un groupe ou d'un canal d'annonces avec choix de l'audience.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '../../components/common/Header';
import ChatAvatar from '../../components/chat/ChatAvatar';
import { getChatPalette } from '../../components/chat/chatTheme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import messengerService from '../../services/messengerService';
import { notifyInfo, resolvePhotoUrl } from '../../utils/chatUi';
import { isAdminUser, roleLabel } from '../../utils/messengerUtils';

const AUDIENCES = [
  ['clients', 'Clients', ['CLIENT']],
  ['therapists', 'Thérapeutes', ['THERAPIST']],
  ['clients_therapists', 'Clients + Thérapeutes', ['CLIENT', 'THERAPIST']],
  ['admins', 'Administrateurs', []],
  ['support', 'Assistance', []],
];

const MessengerNewScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(themeColors, isDark), [themeColors, isDark]);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const admin = isAdminUser(user);

  const [mode, setMode] = useState('direct'); // direct | group
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('group');
  const [audience, setAudience] = useState('clients_therapists');
  const [everyone, setEveryone] = useState(true);
  const [membersChat, setMembersChat] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await messengerService.contacts(q.trim() || undefined);
    setContacts(res.success ? res.data : []);
    setLoading(false);
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openDirect = async (c) => {
    const res = await messengerService.openDirect(c.id);
    if (!res.success) return notifyInfo('Messagerie', res.error);
    return navigation.replace('MessengerChat', { conversationId: res.data.id, title: c.fullname });
  };

  const createGroup = async () => {
    if (title.trim().length < 2) return notifyInfo('Groupe', 'Donnez un nom au groupe (2 caractères minimum).');
    setSaving(true);
    if (!admin && picked.length < 1) {
      setSaving(false);
      return notifyInfo('Groupe', 'Choisissez au moins un membre.');
    }
    const roles = admin && everyone ? (AUDIENCES.find((a) => a[0] === audience)?.[2] || []) : [];
    const res = await messengerService.createGroup(
      admin
        ? {
          title: title.trim(), type: kind, audience, member_ids: picked, add_roles: roles,
          members_can_chat: kind === 'group' ? membersChat : false,
        }
        : { title: title.trim(), type: 'group', member_ids: picked, add_roles: [], members_can_chat: true }
    );
    setSaving(false);
    if (!res.success) return notifyInfo('Groupe', res.error);
    return navigation.replace('MessengerChat', { conversationId: res.data.id, title: title.trim() });
  };

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const Chip = ({ active, label, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.primarySoft : 'transparent' }]}>
      <Text style={{ color: active ? palette.primary : palette.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.screenBg }]}>
      <Header title={mode === 'direct' ? 'Nouvelle conversation' : 'Nouveau groupe'} showBack onBackPress={() => navigation.goBack()} />

      <View style={styles.chips}>
        <Chip active={mode === 'direct'} label="Message privé" onPress={() => setMode('direct')} />
        <Chip active={mode === 'group'} label={admin ? 'Groupe / Annonces' : 'Nouveau groupe'} onPress={() => setMode('group')} />
      </View>

      {mode === 'group' && (
        <View style={styles.form}>
          <TextInput
            value={title} onChangeText={setTitle} placeholder="Nom du groupe" placeholderTextColor={palette.placeholder} maxLength={150}
            style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.inputText }]}
          />
          {admin && (
            <View style={styles.chips}>
              <Chip active={kind === 'group'} label="Groupe de discussion" onPress={() => setKind('group')} />
              <Chip active={kind === 'announcement'} label="Annonces uniquement" onPress={() => setKind('announcement')} />
            </View>
          )}
          {admin && <Text style={[styles.label, { color: palette.textSecondary }]}>Audience</Text>}
          {admin && <View style={styles.chips}>{AUDIENCES.map(([k, l]) => <Chip key={k} active={audience === k} label={l} onPress={() => setAudience(k)} />)}</View>}
          {admin && (AUDIENCES.find((a) => a[0] === audience)?.[2] || []).length > 0 && (
            <View style={styles.switchRow}>
              <Text style={{ color: palette.text, flex: 1 }}>Ajouter tous les utilisateurs de cette audience</Text>
              <Switch value={everyone} onValueChange={setEveryone} trackColor={{ true: palette.primary }} />
            </View>
          )}
          {admin && kind === 'group' && (
            <View style={styles.switchRow}>
              <Text style={{ color: palette.text, flex: 1 }}>Les membres peuvent s'écrire entre eux</Text>
              <Switch value={membersChat} onValueChange={setMembersChat} trackColor={{ true: palette.primary }} />
            </View>
          )}
          <Text style={[styles.label, { color: palette.textSecondary }]}>{admin ? 'Membres supplémentaires' : 'Membres'} ({picked.length})</Text>
        </View>
      )}

      <View style={[styles.search, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
        <Ionicons name="search" size={18} color={palette.textSecondary} />
        <TextInput
          value={q} onChangeText={setQ} placeholder="Rechercher par nom" placeholderTextColor={palette.placeholder}
          style={[styles.searchInput, { color: palette.inputText }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
        />
      </View>

      {loading ? <ActivityIndicator color={palette.primary} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={contacts} keyExtractor={(c) => String(c.id)} contentContainerStyle={{ padding: 12, gap: 6 }}
          ListEmptyComponent={<Text style={{ color: palette.textSecondary, textAlign: 'center', marginTop: 30, paddingHorizontal: 24 }}>
            {user?.role === 'ADMIN' ? 'Aucun résultat.' : 'Aucun contact disponible. Vous pouvez écrire à un thérapeute / client après une réservation, ou à l\'administration.'}
          </Text>}
          renderItem={({ item: c }) => {
            const on = picked.includes(c.id);
            return (
              <TouchableOpacity
                style={[styles.row, { backgroundColor: palette.surface, borderColor: on ? palette.primary : palette.border }]}
                onPress={() => (mode === 'direct' ? openDirect(c) : toggle(c.id))}
              >
                <ChatAvatar uri={resolvePhotoUrl(c.profile_image)} name={c.fullname} size={44} palette={palette} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{c.fullname}</Text>
                  <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{roleLabel(c.role)}{c.is_online ? ' · En ligne' : ''}</Text>
                </View>
                {mode === 'group' && <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? palette.primary : palette.border} />}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {mode === 'group' && (
        <TouchableOpacity onPress={createGroup} disabled={saving} style={[styles.create, { backgroundColor: palette.primary, marginBottom: insets.bottom + 12 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Créer</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 20, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginVertical: 6 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  form: { paddingHorizontal: 12 },
  input: { borderWidth: 1, borderRadius: 12, height: 46, paddingHorizontal: 12, fontSize: 15, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 8, marginHorizontal: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 6, paddingHorizontal: 12, height: 42, borderRadius: 21, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1 },
  create: { marginHorizontal: 12, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

export default MessengerNewScreen;
