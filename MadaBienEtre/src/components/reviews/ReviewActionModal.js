// src/components/reviews/ReviewActionModal.js
// Modal générique : saisie de texte (réponse, motif de modération) avec choix
// optionnel d'un motif (signalement). Fonctionne sur web et mobile.
import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function ReviewActionModal({
  visible,
  title,
  subtitle,
  placeholder = 'Votre texte...',
  confirmLabel = 'Envoyer',
  tone = 'primary', // primary | danger
  reasons = null, // [{key,label}] -> choix obligatoire
  initialText = '',
  minLength = 0,
  maxLength = 1000,
  required = true,
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  const { colors: c, isDark } = useTheme();
  const [text, setText] = useState('');
  const [reason, setReason] = useState(null);

  useEffect(() => {
    if (visible) {
      setText(initialText || '');
      setReason(null);
    }
  }, [visible, initialText]);

  const trimmed = text.trim();
  const textOk = required ? trimmed.length >= Math.max(minLength, 1) : true;
  const canSubmit = !loading && textOk && (!reasons || !!reason);
  const accent = tone === 'danger' ? '#DC2626' : c.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.backdrop}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={loading ? undefined : onCancel} />
        <View style={[s.card, { backgroundColor: c.surface }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[s.title, { color: c.text }]}>{title}</Text>
            {!!subtitle && <Text style={[s.subtitle, { color: c.textSecondary }]}>{subtitle}</Text>}

            {reasons && (
              <View style={s.reasons}>
                {reasons.map((r) => {
                  const active = reason === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => setReason(r.key)}
                      style={[
                        s.chip,
                        { borderColor: active ? accent : c.border || '#DDD', backgroundColor: active ? `${accent}18` : 'transparent' },
                      ]}
                    >
                      <Text style={{ color: active ? accent : c.text, fontSize: 13, fontWeight: active ? '700' : '500' }}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TextInput
              value={text}
              onChangeText={(t) => setText(t.slice(0, maxLength))}
              placeholder={placeholder}
              placeholderTextColor={c.textSecondary}
              multiline
              textAlignVertical="top"
              style={[
                s.input,
                { color: c.text, borderColor: c.border || '#DDD', backgroundColor: isDark ? '#1E1E1E' : '#F7F8FA' },
              ]}
            />
            <Text style={[s.counter, { color: c.textSecondary }]}>
              {trimmed.length}/{maxLength}
            </Text>
            {!!error && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity onPress={onCancel} disabled={loading} style={[s.btn, { borderColor: c.border || '#DDD', borderWidth: 1 }]}>
              <Text style={{ color: c.text, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => canSubmit && onConfirm({ text: trimmed, reason })}
              disabled={!canSubmit}
              style={[s.btn, { backgroundColor: accent, opacity: canSubmit ? 1 : 0.45 }]}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 480, maxHeight: '88%', borderRadius: 18, padding: 18 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 8 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 100, fontSize: 14, marginTop: 10 },
  counter: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
