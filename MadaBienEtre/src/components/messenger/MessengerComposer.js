// Barre de saisie : emoji/stickers, pièces jointes (photo, galerie, document,
// position), message vocal, réponse / modification en cours, saisie « écrit… ».
import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import EmojiStickerPanel from './EmojiStickerPanel';
import VoiceRecorderBar from './VoiceRecorderBar';

const MessengerComposer = ({
  palette, disabledReason, replyTo, editing, onCancelContext, adminAllowReplyToggle,
  allowReply, onToggleAllowReply, onSendText, onSticker, onTyping, onAttach, onVoice, onError,
}) => {
  const [text, setText] = useState('');
  const [panel, setPanel] = useState(false);
  const [menu, setMenu] = useState(false);
  const [recording, setRecording] = useState(false);
  const inputRef = useRef(null);
  const typingRef = useRef(false);
  const typingTimer = useRef(null);

  // Édition : pré-remplit le champ
  const lastEditId = useRef(null);
  if (editing && lastEditId.current !== editing.id) {
    lastEditId.current = editing.id;
    setTimeout(() => setText(editing.content || ''), 0);
  }
  if (!editing && lastEditId.current) lastEditId.current = null;

  if (disabledReason) {
    return (
      <View style={[styles.locked, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
        <Ionicons name="lock-closed" size={16} color={palette.textSecondary} />
        <Text style={{ color: palette.textSecondary, flex: 1, fontSize: 13 }}>{disabledReason}</Text>
      </View>
    );
  }

  const changeText = (v) => {
    setText(v);
    if (!typingRef.current && v) {
      typingRef.current = true;
      onTyping?.(true);
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (typingRef.current) { typingRef.current = false; onTyping?.(false); }
    }, 2500);
  };

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSendText(value);
    setText('');
    setPanel(false);
    if (typingRef.current) { typingRef.current = false; onTyping?.(false); }
  };

  const attach = (kind) => { setMenu(false); onAttach(kind); };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
      {(replyTo || editing) && (
        <View style={[styles.context, { backgroundColor: palette.primarySoft, borderLeftColor: palette.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>
              {editing ? 'Modifier le message' : `Répondre à ${replyTo.sender?.fullname || ''}`}
            </Text>
            <Text style={{ color: palette.text, fontSize: 12 }} numberOfLines={1}>
              {editing ? editing.content : replyTo.content || replyTo.preview || 'Pièce jointe'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setText(''); onCancelContext(); }}><Ionicons name="close" size={20} color={palette.textSecondary} /></TouchableOpacity>
        </View>
      )}

      {adminAllowReplyToggle && !editing && (
        <TouchableOpacity style={styles.toggle} onPress={onToggleAllowReply}>
          <Ionicons name={allowReply ? 'checkbox' : 'square-outline'} size={18} color={palette.primary} />
          <Text style={{ color: palette.textSecondary, fontSize: 12 }}>Autoriser les membres à répondre à mon prochain message</Text>
        </TouchableOpacity>
      )}

      {menu && (
        <View style={[styles.menu, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {[
            ['camera', 'Appareil photo', 'camera', Platform.OS !== 'web'],
            ['image', 'Galerie / photo', 'gallery', true],
            ['document-text', 'Document (PDF, Word…)', 'document', true],
            ['location', 'Ma position', 'location', true],
          ].filter((x) => x[3]).map(([icon, label, kind]) => (
            <TouchableOpacity key={kind} style={styles.menuItem} onPress={() => attach(kind)}>
              <Ionicons name={icon} size={20} color={palette.primary} />
              <Text style={{ color: palette.text, fontSize: 14 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.row}>
        {recording ? (
          <VoiceRecorderBar
            palette={palette}
            onError={onError}
            onCancel={() => setRecording(false)}
            onDone={(rec) => { setRecording(false); onVoice(rec); }}
          />
        ) : (
          <>
            <TouchableOpacity onPress={() => { setMenu((m) => !m); setPanel(false); }} style={styles.icon} accessibilityLabel="Joindre un fichier">
              <Ionicons name="add-circle" size={30} color={palette.primary} />
            </TouchableOpacity>
            <View style={[styles.inputBox, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
              <TextInput
                ref={inputRef} value={text} onChangeText={changeText} multiline maxLength={4000}
                placeholder="Écrire un message…" placeholderTextColor={palette.placeholder}
                style={[styles.input, { color: palette.inputText }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
                onFocus={() => { setPanel(false); setMenu(false); }}
                onKeyPress={(e) => {
                  if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                    e.preventDefault?.();
                    submit();
                  }
                }}
              />
              <TouchableOpacity onPress={() => { setPanel((p) => !p); setMenu(false); inputRef.current?.blur?.(); }} accessibilityLabel="Emojis et stickers">
                <Ionicons name={panel ? 'keypad' : 'happy-outline'} size={24} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
            {text.trim() ? (
              <TouchableOpacity onPress={submit} style={[styles.send, { backgroundColor: palette.primary }]} accessibilityLabel="Envoyer">
                <Ionicons name={editing ? 'checkmark' : 'send'} size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => { setRecording(true); setPanel(false); setMenu(false); }} style={[styles.send, { backgroundColor: palette.primary }]} accessibilityLabel="Message vocal">
                <Ionicons name="mic" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {panel && !recording && (
        <EmojiStickerPanel
          palette={palette}
          onEmoji={(e) => changeText(text + e)}
          onSticker={(s) => { onSticker(s); setPanel(false); }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 8, paddingVertical: 8 },
  icon: { paddingBottom: 6 },
  inputBox: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, paddingVertical: Platform.OS === 'web' ? 6 : 4, minHeight: 44, maxHeight: 130 },
  input: { flex: 1, fontSize: 15, paddingTop: Platform.OS === 'ios' ? 8 : 4, paddingBottom: 4, maxHeight: 110 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  context: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 8, marginTop: 8, padding: 8, borderLeftWidth: 4, borderRadius: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 6 },
  menu: { position: 'absolute', bottom: 60, left: 8, borderWidth: 1, borderRadius: 14, padding: 6, zIndex: 20, minWidth: 220 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});

export default MessengerComposer;
