// src/components/sos/EmergencyContactForm.js
// Formulaire (ajout / modification) d'un contact d'urgence.
import { useState, useEffect } from 'react';
import {
  View,
  Text,
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
import MaskedField, { FormSummary } from '../common/MaskedField';
import { maskEmail, maskFullname, maskLabel, maskMgPhone, rules } from '../../utils/inputMasks';

const EMPTY = { name: '', phone: '', relationship: '', email: '', is_primary: false };

const EmergencyContactForm = ({ visible, contact, saving, error, onSave, onClose }) => {
  const { colors: themeColors } = useTheme();
  const [form, setForm] = useState(EMPTY);
  const [localError, setLocalError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(contact ? { ...EMPTY, ...contact, email: contact.email || '', relationship: contact.relationship || '' } : EMPTY);
      setLocalError('');
      setSubmitted(false);
    }
  }, [visible, contact]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // Erreurs par champ (affichées en rouge sous chaque champ, vert quand valide)
  const nameRule = rules.fullname;
  const fieldErrors = {};
  const nameErr = nameRule(form.name);
  const phoneErr = rules.mgPhone(form.phone);
  const emailErr = rules.emailOptional(form.email);
  if (nameErr) fieldErrors.name = nameErr;
  if (phoneErr) fieldErrors.phone = phoneErr;
  if (emailErr) fieldErrors.email = emailErr;

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(fieldErrors).length) return;
    const phone = form.phone.replace(/[\s.\-()]/g, '');
    setLocalError('');
    onSave({
      name: form.name.trim(),
      phone,
      relationship: form.relationship.trim() || null,
      email: form.email.trim() || null,
      is_primary: !!form.is_primary,
    });
  };

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
            <MaskedField
              label="Nom" required value={form.name} onChangeText={set('name')}
              mask={maskFullname} validate={nameRule} showErrors={submitted}
              placeholder="Ex : Rakoto Jean" autoCapitalize="words" icon="person-outline"
              successText="Nom valide" textColor={themeColors.text} surfaceColor={themeColors.surface}
            />
            <MaskedField
              label="Téléphone" required value={form.phone} onChangeText={set('phone')}
              mask={maskMgPhone} validate={rules.mgPhone} showErrors={submitted}
              placeholder="034 12 345 67" keyboardType="phone-pad" icon="call-outline"
              successText="Numéro valide" textColor={themeColors.text} surfaceColor={themeColors.surface}
            />
            <MaskedField
              label="Lien avec vous" value={form.relationship} onChangeText={set('relationship')}
              mask={maskLabel(40)} placeholder="Frère, conjoint, ami..." icon="people-outline"
              textColor={themeColors.text} surfaceColor={themeColors.surface}
            />
            <MaskedField
              label="Email (facultatif)" value={form.email} onChangeText={set('email')}
              mask={maskEmail} validate={rules.emailOptional} showErrors={submitted}
              placeholder="contact@email.com" keyboardType="email-address" icon="mail-outline"
              successText="Email valide" textColor={themeColors.text} surfaceColor={themeColors.surface}
            />

            <TouchableOpacity style={styles.primaryRow} onPress={() => set('is_primary')(!form.is_primary)}>
              <Ionicons name={form.is_primary ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
              <Text style={[styles.primaryText, { color: themeColors.text }]}>Contact principal</Text>
            </TouchableOpacity>

            <FormSummary errors={fieldErrors} show={submitted} successText="Formulaire valide." />
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
