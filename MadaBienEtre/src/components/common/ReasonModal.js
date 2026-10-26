// src/components/common/ReasonModal.js
//
// Petite fenêtre « motif » multiplateforme (iOS / Android / Web) : Alert.prompt n'existe pas sur Android.
// Utilisée pour : rejet d'un retrait / d'une commission / d'un remboursement (admin),
// demande de remboursement (client).
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../../context/ThemeContext';

/**
 * @param {{
 *  visible: boolean, title: string, message?: string, placeholder?: string,
 *  confirmLabel?: string, tone?: 'danger'|'primary', required?: boolean,
 *  onCancel: () => void, onConfirm: (text:string) => void
 * }} props
 */
export default function ReasonModal({
  visible,
  title,
  message,
  placeholder = 'Motif (facultatif)',
  confirmLabel = 'Confirmer',
  tone = 'danger',
  required = false,
  onCancel,
  onConfirm,
}) {
  const { colors: theme } = useTheme();
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const color = tone === 'danger' ? '#D9363E' : '#1F6B45';
  const disabled = required && !text.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={[styles.box, { backgroundColor: theme.surface || '#fff' }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text> : null}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            multiline
            style={[styles.input, { color: theme.text, borderColor: theme.border || '#E5E7EB' }]}
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={[styles.btnText, { color: theme.textSecondary }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnFill, { backgroundColor: color }, disabled && { opacity: 0.45 }]}
              disabled={disabled}
              onPress={() => onConfirm(text.trim())}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: '#fff' }]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  box: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 18 },
  title: { fontSize: 16, fontWeight: '800' },
  message: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 70,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  btnFill: { minWidth: 110, alignItems: 'center' },
  btnText: { fontSize: 14, fontWeight: '800' },
});
