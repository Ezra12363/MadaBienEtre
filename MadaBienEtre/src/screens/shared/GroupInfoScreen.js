// src/screens/shared/GroupInfoScreen.js
// Infos d'un groupe / canal : nom, photo, membres, rôles, réglages.
// Administrateurs : renommer, photo, mode annonces, ajouter / retirer.
// Membres : voir la liste, quitter le groupe.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '../../components/common/Header';
import ChatAvatar from '../../components/chat/ChatAvatar';
import ChatConfirmHost from '../../components/chat/ChatConfirmHost';
import { getChatPalette } from '../../components/chat/chatTheme';
import { useAuth } from '../../context/AuthContext';
import { useMessenger } from '../../context/MessengerContext';
import { useTheme } from '../../context/ThemeContext';
import messengerService, { buildFileUrl } from '../../services/messengerService';
import { confirmAsync } from '../../utils/chatImage';
import { notifyInfo, resolvePhotoUrl } from '../../utils/chatUi';
import { pickPhoto } from '../../utils/messengerPicker';
import { presenceLabel, roleLabel } from '../../utils/messengerUtils';

const GroupInfoScreen = ({ navigation, route }) => {
  const conversationId = route.params?.conversationId;
  const { colors: themeColors, isDark } = useTheme();
  const palette = useMemo(() => getChatPalette(themeColors, isDark), [themeColors, isDark]);
  const { token, user } = useAuth();
  const { subscribe, presence } = useMessenger();
  const insets = useSafeAreaInsets();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);

  const load = useCallback(async () => {
    const res = await messengerService.conversation(conversationId);
    if (res.success) { setDetail(res.data); setTitle(res.data.title || ''); setDescription(res.data.description || ''); }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribe((ev) => {
    if (ev.conversation_id === conversationId && ['conversation_updated', 'presence'].includes(ev.type)) load();
    if (ev.type === 'conversation_removed' && ev.conversation_id === conversationId) navigation.popToTop();
  }), [subscribe, conversationId, load, navigation]);

  useEffect(() => {
    if (!adding) return undefined;
    const t = setTimeout(async () => {
      const res = await messengerService.contacts(q.trim() || undefined);
      const ids = new Set((detail?.members || []).map((m) => m.id));
      setFound(res.success ? res.data.filter((c) => !ids.has(c.id)) : []);
    }, 250);
    return () => clearTimeout(t);
  }, [adding, q, detail]);

  const manage = detail?.can_manage;
  const run = async (promise, okMsg) => {
    const res = await promise;
    if (!res.success) notifyInfo('Groupe', res.error); else { if (okMsg) notifyInfo('Groupe', okMsg); load(); }
    return res;
  };

  const changePhoto = async () => {
    const p = await pickPhoto('gallery');
    if (!p) return;
    if (p.error) { notifyInfo('Groupe', p.error); return; }
    run(messengerService.setGroupPhoto(conversationId, p.file));
  };

  if (loading || !detail) {
    return <View style={[styles.screen, { backgroundColor: palette.screenBg, justifyContent: 'center' }]}><ActivityIndicator color={palette.primary} size="large" /></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.screenBg }]}>
      <Header title={detail.type === 'announcement' ? "Canal d'annonces" : 'Infos du groupe'} showBack onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <TouchableOpacity disabled={!manage} onPress={changePhoto}>
            <ChatAvatar uri={buildFileUrl(detail.photo, token)} name={detail.title} size={96} palette={palette} />
            {manage && <View style={[styles.cam, { backgroundColor: palette.primary }]}><Ionicons name="camera" size={16} color="#fff" /></View>}
          </TouchableOpacity>
          {manage ? (
            <>
              <TextInput value={title} onChangeText={setTitle} maxLength={150} style={[styles.input, { color: palette.inputText, backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]} />
              <TextInput
                value={description} onChangeText={setDescription} maxLength={500} placeholder="Description" placeholderTextColor={palette.placeholder} multiline
                style={[styles.input, { color: palette.inputText, backgroundColor: palette.inputBg, borderColor: palette.inputBorder, height: 70 }]}
              />
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: palette.primary }]}
                onPress={() => run(messengerService.updateGroup(conversationId, { title, description }), 'Enregistré.')}
              ><Text style={{ color: '#fff', fontWeight: '700' }}>Enregistrer</Text></TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.name, { color: palette.text }]}>{detail.title}</Text>
              {!!detail.description && <Text style={{ color: palette.textSecondary, textAlign: 'center' }}>{detail.description}</Text>}
            </>
          )}
          <Text style={{ color: palette.textSecondary }}>{detail.member_count} membres</Text>
        </View>

        {manage && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '600' }}>Annonces uniquement</Text>
                <Text style={{ color: palette.textSecondary, fontSize: 12 }}>Seuls les administrateurs peuvent écrire.</Text>
              </View>
              <Switch value={detail.type === 'announcement'} trackColor={{ true: palette.primary }}
                onValueChange={(v) => run(messengerService.updateGroup(conversationId, { type: v ? 'announcement' : 'group' }))} />
            </View>
            {detail.type === 'group' && (
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '600' }}>Les membres peuvent s'écrire</Text>
                  <Text style={{ color: palette.textSecondary, fontSize: 12 }}>Désactivé : ils lisent sans pouvoir écrire.</Text>
                </View>
                <Switch value={detail.members_can_chat} trackColor={{ true: palette.primary }}
                  onValueChange={(v) => run(messengerService.updateGroup(conversationId, { members_can_chat: v }))} />
              </View>
            )}
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={[styles.section, { color: palette.text }]}>Membres</Text>
          {manage && (
            <TouchableOpacity onPress={() => setAdding((a) => !a)}>
              <Text style={{ color: palette.primary, fontWeight: '700' }}>{adding ? 'Fermer' : '+ Ajouter'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {adding && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <TextInput
              value={q} onChangeText={setQ} placeholder="Rechercher un utilisateur" placeholderTextColor={palette.placeholder}
              style={[styles.input, { color: palette.inputText, backgroundColor: palette.inputBg, borderColor: palette.inputBorder, width: '100%' }]}
            />
            {found.slice(0, 15).map((c) => (
              <TouchableOpacity key={c.id} style={styles.member} onPress={() => run(messengerService.addMembers(conversationId, [c.id]))}>
                <ChatAvatar uri={resolvePhotoUrl(c.profile_image)} name={c.fullname} size={36} palette={palette} />
                <Text style={{ flex: 1, color: palette.text }}>{c.fullname} · {roleLabel(c.role)}</Text>
                <Ionicons name="add-circle" size={24} color={palette.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {detail.members.map((m) => {
          const p = presence[m.id] || { is_online: m.is_online, last_seen_at: m.last_seen_at };
          return (
            <View key={m.id} style={[styles.member, { borderBottomColor: palette.border }]}>
              <ChatAvatar uri={resolvePhotoUrl(m.profile_image)} name={m.fullname} size={42} palette={palette} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '600' }}>{m.fullname}{m.id === user?.id ? ' (vous)' : ''}</Text>
                <Text style={{ color: p.is_online ? palette.primary : palette.textSecondary, fontSize: 12 }}>
                  {roleLabel(m.role)}{m.member_role === 'owner' ? ' · Propriétaire' : m.member_role === 'admin' ? ' · Admin du groupe' : ''} · {presenceLabel(p)}
                </Text>
              </View>
              {manage && m.member_role !== 'owner' && m.id !== user?.id && (
                <TouchableOpacity onPress={async () => {
                  if (await confirmAsync('Retirer le membre', `Retirer ${m.fullname} du groupe ?`, 'Retirer')) run(messengerService.removeMember(conversationId, m.id));
                }}><Ionicons name="person-remove-outline" size={22} color={palette.danger} /></TouchableOpacity>
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.leave, { borderColor: palette.danger }]}
          onPress={async () => {
            if (!(await confirmAsync('Quitter le groupe', 'Vous ne recevrez plus les messages de ce groupe.', 'Quitter'))) return;
            const res = await messengerService.leaveGroup(conversationId);
            if (res.success) navigation.popToTop(); else notifyInfo('Groupe', res.error);
          }}
        ><Text style={{ color: palette.danger, fontWeight: '700' }}>Quitter le groupe</Text></TouchableOpacity>

        {manage && (
          <TouchableOpacity
            style={[styles.leave, { borderColor: palette.danger, backgroundColor: palette.dangerSoft }]}
            onPress={async () => {
              if (!(await confirmAsync('Supprimer le groupe', 'Tous les messages et fichiers seront supprimés pour tout le monde.', 'Supprimer'))) return;
              const res = await messengerService.deleteGroup(conversationId);
              if (res.success) navigation.popToTop(); else notifyInfo('Groupe', res.error);
            }}
          ><Text style={{ color: palette.danger, fontWeight: '700' }}>Supprimer le groupe</Text></TouchableOpacity>
        )}
      </ScrollView>
      <ChatConfirmHost />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800' },
  cam: { position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46, fontSize: 15, width: '100%', maxWidth: 460, textAlign: 'left' },
  btn: { height: 42, paddingHorizontal: 22, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, marginBottom: 6 },
  section: { fontSize: 16, fontWeight: '800' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  leave: { borderWidth: 1, borderRadius: 12, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
});

export default GroupInfoScreen;
