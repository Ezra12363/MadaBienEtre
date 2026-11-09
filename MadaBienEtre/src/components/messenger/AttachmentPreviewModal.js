// Aperçu AVANT envoi (image / document) avec légende facultative.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { formatSize } from '../../utils/messengerUtils';

const AttachmentPreviewModal = ({ file, palette, sending, onCancel, onSend }) => {
  const [caption, setCaption] = useState('');
  useEffect(() => { setCaption(''); }, [file?.uri]);
  if (!file) return null;
  const isImage = file.kind === 'image';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: palette.text }]}>Aperçu avant envoi</Text>
            <TouchableOpacity onPress={onCancel} accessibilityLabel="Annuler"><Ionicons name="close" size={24} color={palette.text} /></TouchableOpacity>
          </View>

          {isImage ? (
            <Image source={{ uri: file.uri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={[styles.doc, { backgroundColor: palette.primarySoft }]}>
              <Ionicons name="document-text" size={48} color={palette.primary} />
              <Text style={{ color: palette.text, fontWeight: '600', marginTop: 8 }} numberOfLines={2}>{file.name}</Text>
              <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{formatSize(file.size)}</Text>
            </View>
          )}

          <TextInput
            value={caption} onChangeText={setCaption} placeholder="Ajouter une légende…" maxLength={1000}
            placeholderTextColor={palette.placeholder}
            style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.inputText }]}
          />

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={[styles.btn, { borderColor: palette.border, borderWidth: 1 }]}>
              <Text style={{ color: palette.text }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onSend(caption.trim())} disabled={sending} style={[styles.btn, { backgroundColor: palette.primary }]}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Envoyer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 16 },
  card: { borderRadius: 16, padding: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '700' },
  image: { width: '100%', height: 300, borderRadius: 10, backgroundColor: '#000' },
  doc: { alignItems: 'center', padding: 24, borderRadius: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginTop: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  btn: { paddingHorizontal: 18, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 96 },
});

export default AttachmentPreviewModal;
