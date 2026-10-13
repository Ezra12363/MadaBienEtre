// src/components/ai/AIPriceEstimateCard.js
// CLIENT — « Estimation du prix » avant réservation.
//  - POST /ai/predict-price   (estimation IA)
//  - POST /pricing/suggest    (suggestion + fourchette, historique du client)
//  - POST /pricing/calculate  (détail du calcul)
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import aiService from '../../services/aiService';
import {
  AICard,
  AIButton,
  AIChip,
  AIField,
  AIError,
  AIStatRow,
  AIMassageTypePicker,
} from './AIPrimitives';
import {
  DEMAND_LEVELS,
  formatAr,
  formatPercent,
  pickNumber,
  toPositiveInt,
  toNonNegative,
} from './aiHelpers';

const AIPriceEstimateCard = ({ onReserve }) => {
  const { colors: tc } = useTheme();
  const [type, setType] = useState(null);
  const [duration, setDuration] = useState('60');
  const [distance, setDistance] = useState('3');
  const [demand, setDemand] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const estimate = async () => {
    const d = toPositiveInt(duration);
    const km = toNonNegative(distance);
    if (!type) return setError('Choisissez un type de massage.');
    if (!d || d > 480) return setError('Durée invalide (1 à 480 minutes).');
    if (km === null || km > 500) return setError('Distance invalide (0 à 500 km).');

    setLoading(true);
    setError(null);
    setResult(null);

    // Les 3 appels sont indépendants : un échec n'empêche pas les autres.
    const [ai, suggest, calc] = await Promise.all([
      aiService.predictPrice({ massage_type: type.name, duration: d, distance: km, demand_level: demand }),
      aiService.suggestPrice({ massage_type_id: type.id, duration: d, distance: km }),
      aiService.calculatePrice({ massage_type: type.name, duration: d, distance: km, demand_level: demand }),
    ]);

    if (!ai.success && !suggest.success && !calc.success) {
      setError(ai.error || suggest.error || calc.error || "Impossible d'estimer le prix.");
    } else {
      setResult({
        ai: ai.success ? ai.data : null,
        suggest: suggest.success ? suggest.data : null,
        calc: calc.success ? calc.data : null,
        type,
        duration: d,
        distance: km,
      });
    }
    setLoading(false);
  };

  // Prix principal : suggestion IA > estimation IA > calcul.
  const mainPrice = result
    ? pickNumber(result.suggest, ['suggested_price']) ??
      pickNumber(result.ai, ['predicted_price', 'price', 'suggested_price', 'estimated_price']) ??
      pickNumber(result.calc, ['final_price'])
    : null;
  const minPrice = result
    ? pickNumber(result.suggest, ['min_price']) ?? pickNumber(result.ai, ['min_price'])
    : null;
  const maxPrice = result
    ? pickNumber(result.suggest, ['max_price']) ?? pickNumber(result.ai, ['max_price'])
    : null;
  const confidence = result
    ? pickNumber(result.suggest, ['confidence']) ?? pickNumber(result.ai, ['confidence'])
    : null;

  return (
    <AICard
      title="Estimation du prix"
      icon="calculator-outline"
      subtitle="Estimez le coût avant de réserver"
    >
      <AIMassageTypePicker value={type} onChange={setType} />

      <View style={styles.twoCols}>
        <AIField
          style={styles.col}
          label="Durée"
          value={duration}
          onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          suffix="min"
        />
        <AIField
          style={styles.col}
          label="Distance"
          value={distance}
          onChangeText={(t) => setDistance(t.replace(/[^0-9.,]/g, ''))}
          keyboardType="numeric"
          suffix="km"
        />
      </View>

      <Text style={[styles.label, { color: tc.textSecondary }]}>Demande actuelle</Text>
      <View style={styles.chips}>
        {DEMAND_LEVELS.map((l) => (
          <AIChip key={l.id} label={l.label} active={demand === l.id} onPress={() => setDemand(l.id)} />
        ))}
      </View>

      <AIError message={error} />

      <AIButton
        label="Estimer le prix"
        icon="sparkles"
        onPress={estimate}
        loading={loading}
        style={{ marginTop: spacing.sm }}
      />

      {result && (
        <View style={[styles.result, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          {mainPrice !== null && (
            <>
              <Text style={[styles.resultLabel, { color: tc.textSecondary }]}>Prix estimé</Text>
              <Text style={styles.resultPrice}>{formatAr(mainPrice)}</Text>
            </>
          )}
          {minPrice !== null && maxPrice !== null && (
            <Text style={[styles.range, { color: tc.textSecondary }]}>
              Fourchette : {formatAr(minPrice)} – {formatAr(maxPrice)}
            </Text>
          )}
          {confidence !== null && (
            <Text style={[styles.range, { color: tc.textSecondary }]}>
              Fiabilité : {formatPercent(confidence)}
            </Text>
          )}

          {result.calc?.breakdown && (
            <View style={styles.breakdown}>
              <AIStatRow label="Prix de base" value={formatAr(result.calc.breakdown.base)} />
              <AIStatRow label="Ajustement durée" value={formatAr(result.calc.breakdown.duration_adjustment)} />
              <AIStatRow label="Ajustement distance" value={formatAr(result.calc.breakdown.distance_adjustment)} />
              <AIStatRow label="Ajustement demande" value={formatAr(result.calc.breakdown.demand_adjustment)} />
              <AIStatRow label="Total calculé" value={formatAr(result.calc.final_price)} bold color={colors.primary} />
            </View>
          )}

          {onReserve && (
            <AIButton
              label="Réserver ce massage"
              icon="calendar-outline"
              onPress={() => onReserve(result)}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>
      )}
    </AICard>
  );
};

const styles = StyleSheet.create({
  twoCols: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  label: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, marginBottom: 4 },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  result: { borderWidth: 1, borderRadius: 14, padding: spacing.md, marginTop: spacing.md },
  resultLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  resultPrice: { fontSize: typography.fontSize.xxl, fontFamily: typography.fontFamily.bold, color: colors.primary },
  range: { fontSize: typography.fontSize.sm, marginTop: 2 },
  breakdown: { marginTop: spacing.sm, paddingTop: spacing.sm },
});

export default AIPriceEstimateCard;
