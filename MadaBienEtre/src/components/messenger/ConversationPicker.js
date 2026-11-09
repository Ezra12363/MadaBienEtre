// Choix d'une ou plusieurs conversations (transfert de message).
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import messengerService, { buildFileUrl } from '../../services/messengerService';
import { resolvePhotoUrl } from '../../utils/chatUi';
import ChatAvatar from '../chat/ChatAvatar';

const ConversationPicker = ({ visible, palette, token, excludeId, onClose, onConfirm }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!visible) return;
    setSelected([]);
    setLoading(true);
    messengerService.conversations(false).then((res) => {
      setItems((res.success ? res.data : []).filter((c) => c.id !== excludeId && c.can_post));
      setLoading(false);
    });
  }, [visible, excludeId]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(0, 10)));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: palette.text }]}>Transférer à…</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={palette.text} /></TouchableOpacity>
          </View>
          {loading ? <ActivityIndicator color={palette.primary} style={{ margin: 24 }} /> : (
            <FlatList
              data={items} keyExtractor={(c) => String(c.id)} style={{ maxHeight: 380 }}
              ListEmptyComponent={<Text style={{ color: palette.textSecondary, textAlign: 'center', margin: 24 }}>Aucune conversation disponible.</Text>}
              renderItem={({ item }) => {
                const on = selected.includes(item.id);
                const photo = (item.type === 'direct' || item.type === 'booking') ? resolvePhotoUrl(item.photo) : buildFileUrl(item.photo, token);
                return (
                  <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)}>
                    <ChatAvatar uri={photo} name={item.title} size={40} palette={palette} />
                    <Text style={{ flex: 1, color: palette.text, fontSize: 15 }} numberOfLines={1}>{item.title}</Text>
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? palette.primary : palette.border} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
          <TouchableOpacity
            disabled={!selected.length} onPress={() => onConfirm(selected)}
            style={[styles.send, { backgroundColor: selected.length ? palette.primary : palette.border }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Envoyer{selected.length ? ` (${selected.length})` : ''}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  send: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
});

export default ConversationPicker;
