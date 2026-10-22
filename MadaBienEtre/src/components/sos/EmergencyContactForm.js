// src/components/sos/EmergencyContactForm.js
// Formulaire (ajout / modification) d'un contact d'urgence.
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const EMPTY = { name: '', phone: '', relationship: '', email: '', is_primary: false };
const PHONE_RE = /^(\+261|0)[0-9]{9}$/;

const EmergencyContactForm = ({ visible, contact, saving, error, onSave, onClose }) => {
  const { colors: themeColors } = useTheme();
  const [form, setForm] = useState(EMPTY);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (visible) {
      setForm(contact ? { ...EMPTY, ...contact, email: contact.email || '', relationship: contact.relationship || '' } : EMPTY);
      setLocalError('');
    }
  }, [visible, contact]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const phone = form.phone.replace(/[\s.\-()]/g, '');
    if (form.name.trim().length < 2) return setLocalError('Entrez le nom du contact');
    if (!PHONE_RE.test(phone)) return setLocalError('Numéro invalide (ex : 034 12 345 67)');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setLocalError('Email invalide');
    setLocalError('');
    onSave({
      name: form.name.trim(),
      phone,
      relationship: form.relationship.trim() || null,
      email: form.email.trim() || null,
      is_primary: !!form.is_primary,
    });
  };

  const inputStyle = [styles.input, { color: themeColors.text, borderColor: themeColors.border || '#E0E0E0' }];
  const shownError = localError || error;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { backgroundColor: themeColors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.text }]}>
              {contact ? 'Modifier le contact' : "Nouveau contact d'urgence"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Nom *</Text>
            <TextInput style={inputStyle} value={form.name} onChangeText={set('name')}
              placeholder="Ex : Rakoto Jean" placeholderTextColor="#999" />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Téléphone *</Text>
            <TextInput style={inputStyle} value={form.phone} onChangeText={set('phone')}
              placeholder="034 12 345 67" placeholderTextColor="#999" keyboardType="phone-pad" />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Lien avec vous</Text>
            <TextInput style={inputStyle} value={form.relationship} onChangeText={set('relationship')}
              placeholder="Frère, conjoint, ami..." placeholderTextColor="#999" />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Email (facultatif)</Text>
            <TextInput style={inputStyle} value={form.email} onChangeText={set('email')}
              placeholder="contact@email.com" placeholderTextColor="#999"
              keyboardType="email-address" autoCapitalize="none" />

            <TouchableOpacity style={styles.primaryRow} onPress={() => set('is_primary')(!form.is_primary)}>
              <Ionicons name={form.is_primary ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
              <Text style={[styles.primaryText, { color: themeColors.text }]}>Contact principal</Text>
            </TouchableOpacity>

            {!!shownError && <Text style={styles.error}>{shownError}</Text>}

            <TouchableOpacity style={styles.saveButton} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  label: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, marginTop: spacing.sm, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.md },
  primaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  primaryText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular },
  error: { color: colors.error, marginTop: spacing.sm, fontSize: typography.fontSize.sm },
  saveButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm },
  saveText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
});

export default EmergencyContactForm;
