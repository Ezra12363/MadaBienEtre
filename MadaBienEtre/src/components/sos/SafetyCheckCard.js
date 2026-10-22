// src/components/sos/SafetyCheckCard.js
// Safety check : « tout va bien / un souci / urgence » avant, pendant ou après la séance.
// « Urgence » déclenche une vraie alerte SOS côté serveur.
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import sosService from '../../services/sosService';

const PHASES = [
  { key: 'before', label: 'Avant', checkType: (role) => (role === 'THERAPIST' ? 'therapist_checkin' : 'client_checkin') },
  { key: 'during', label: 'Pendant', checkType: () => 'mid_session' },
  { key: 'after', label: 'Après', checkType: () => 'post_session' },
];

const ANSWERS = [
  { status: 'ok', label: 'Tout va bien', icon: 'checkmark-circle', color: '#27AE60' },
  { status: 'warning', label: 'Un souci', icon: 'warning', color: '#F5A623' },
  { status: 'emergency', label: 'Urgence', icon: 'alert-circle', color: '#D32F2F' },
];

const SafetyCheckCard = ({ bookingId, role, style }) => {
  const { colors: themeColors } = useTheme();
  const [phase, setPhase] = useState('before');
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState(null);

  if (!bookingId) return null;

  const send = async (status) => {
    const p = PHASES.find((x) => x.key === phase);
    setLoading(true);
    const r = await sosService.createSafetyCheck({
      bookingId,
      checkType: p.checkType(String(role || '').toUpperCase()),
      status,
    });
    setLoading(false);
    if (!r.success) {
      Alert.alert('Erreur', r.error || "Impossible d'enregistrer le safety check");
      return;
    }
    setLast({ phase: p.label, status });
    if (status === 'emergency') {
      Alert.alert('🚨 Alerte SOS envoyée',
        "Notre équipe est prévenue. La police n'est pas prévenue automatiquement : appelez le 117 si besoin.");
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }, style]}>
      <View style={styles.titleRow}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: themeColors.text }]}>Safety check</Text>
      </View>

      <View style={styles.phases}>
        {PHASES.map((p) => (
          <TouchableOpacity key={p.key} onPress={() => setPhase(p.key)}
            style={[styles.phase, phase === p.key && styles.phaseActive]}>
            <Text style={[styles.phaseText, phase === p.key && { color: '#fff' }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.answers}>
        {ANSWERS.map((a) => (
          <TouchableOpacity key={a.status} style={[styles.answer, { borderColor: a.color }]}
            onPress={() => send(a.status)} disabled={loading}>
            <Ionicons name={a.icon} size={22} color={a.color} />
            <Text style={[styles.answerText, { color: a.color }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator style={{ marginTop: spacing.sm }} color={colors.primary} />}
      {last && !loading && (
        <Text style={[styles.last, { color: themeColors.textSecondary }]}>
          Dernier check : {last.phase} — {ANSWERS.find((a) => a.status === last.status)?.label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: spacing.md, marginBottom: spacing.md, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
  phases: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  phase: { flex: 1, paddingVertical: 6, borderRadius: 10, alignItems: 'center', backgroundColor: '#F0F0F0' },
  phaseActive: { backgroundColor: colors.primary },
  phaseText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: '#555' },
  answers: { flexDirection: 'row', gap: spacing.xs },
  answer: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: spacing.sm, alignItems: 'center', gap: 2 },
  answerText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium },
  last: { marginTop: spacing.sm, fontSize: typography.fontSize.xs, textAlign: 'center' },
});

export default SafetyCheckCard;
