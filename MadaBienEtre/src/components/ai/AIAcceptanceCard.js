// src/components/ai/AIAcceptanceCard.js
// THÉRAPEUTE — probabilité qu'un prix soit accepté, pour une réservation
// à laquelle il participe : POST /ai/predict-acceptance?booking_id=&price=
// (le backend refuse avec 403 si le thérapeute n'est pas assigné).
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import aiService from '../../services/aiService';
import { AICard, AIButton, AIField, AIError } from './AIPrimitives';
import { toPositiveInt, toPercentNumber } from './aiHelpers';

const levelOf = (p) => {
  if (p >= 70) return { label: 'Forte chance d\'acceptation', color: colors.success, icon: '👍' };
  if (p >= 40) return { label: 'Acceptation incertaine', color: colors.warning, icon: '🤔' };
  return { label: 'Risque de refus élevé', color: colors.error, icon: '⚠️' };
};

const AIAcceptanceCard = ({ defaultBookingId = '', defaultPrice = '' }) => {
  const { colors: tc } = useTheme();
  const [bookingId, setBookingId] = useState(String(defaultBookingId || ''));
  const [price, setPrice] = useState(String(defaultPrice || ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [probability, setProbability] = useState(null);

  const run = async () => {
    const id = toPositiveInt(bookingId);
    const p = toPositiveInt(price);
    if (!id) return setError('Entrez le numéro de la réservation.');
    if (!p) return setError('Entrez un prix valide (en Ar).');

    setLoading(true);
    setError(null);
    setProbability(null);

    const result = await aiService.predictAcceptance(id, p);
    if (result.success) {
      const value = toPercentNumber(result.data?.probability);
      if (value === null) setError('Réponse inattendue du serveur.');
      else setProbability(value);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const level = probability !== null ? levelOf(probability) : null;

  return (
    <AICard
      title="Probabilité d'acceptation"
      icon="pulse-outline"
      subtitle="Estimez si le client acceptera votre prix (vos réservations uniquement)"
    >
      <View style={styles.twoCols}>
        <AIField
          style={styles.col}
          label="N° de réservation"
          value={bookingId}
          onChangeText={(t) => setBookingId(t.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholder="ex : 128"
        />
        <AIField
          style={styles.col}
          label="Prix proposé"
          value={price}
          onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          suffix="Ar"
          placeholder="ex : 45000"
        />
      </View>

      <AIError message={error} />
      <AIButton label="Prédire l'acceptation" icon="analytics-outline" onPress={run} loading={loading} />

      {level && (
        <View style={[styles.result, { borderColor: level.color + '55', backgroundColor: level.color + '10' }]}>
          <Text style={[styles.percent, { color: level.color }]}>
            {level.icon} {Math.round(probability)} %
          </Text>
          <View style={[styles.track, { backgroundColor: tc.border }]}>
            <View style={[styles.fill, { width: `${probability}%`, backgroundColor: level.color }]} />
          </View>
          <Text style={[styles.levelText, { color: tc.text }]}>{level.label}</Text>
          <Text style={[styles.hint, { color: tc.textSecondary }]}>
            Estimation indicative fournie par l'IA, à utiliser comme aide à la négociation.
          </Text>
        </View>
      )}
    </AICard>
  );
};

const styles = StyleSheet.create({
  twoCols: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  result: { borderWidth: 1, borderRadius: 14, padding: spacing.md, marginTop: spacing.md },
  percent: { fontSize: typography.fontSize.xxl, fontFamily: typography.fontFamily.bold },
  track: { height: 8, borderRadius: 4, marginVertical: spacing.sm, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  levelText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  hint: { fontSize: typography.fontSize.xs, marginTop: 4 },
});

export default AIAcceptanceCard;
