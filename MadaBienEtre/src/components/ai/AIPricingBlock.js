// src/components/ai/AIPricingBlock.js
// THÉRAPEUTE — « Tarification intelligente » :
//  - POST /pricing/suggest   (suggestion de tarif + fourchette)
//  - POST /pricing/calculate (calcul détaillé durée/distance/demande)
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
  toPositiveInt,
  toNonNegative,
} from './aiHelpers';

const FACTOR_LABELS = {
  duration: 'Durée',
  distance: 'Distance',
  demand: 'Demande',
  history: 'Historique',
  user_history: 'Historique',
};

const AIPricingBlock = () => {
  const { colors: tc } = useTheme();
  const [type, setType] = useState(null);
  const [duration, setDuration] = useState('60');
  const [distance, setDistance] = useState('5');
  const [demand, setDemand] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggest, setSuggest] = useState(null);
  const [calc, setCalc] = useState(null);

  const run = async () => {
    const d = toPositiveInt(duration);
    const km = toNonNegative(distance);
    if (!type) return setError('Choisissez un type de massage.');
    if (!d || d > 480) return setError('Durée invalide (1 à 480 minutes).');
    if (km === null || km > 500) return setError('Distance invalide (0 à 500 km).');

    setLoading(true);
    setError(null);
    setSuggest(null);
    setCalc(null);

    const [s, c] = await Promise.all([
      aiService.suggestPrice({ massage_type_id: type.id, duration: d, distance: km }),
      aiService.calculatePrice({ massage_type: type.name, duration: d, distance: km, demand_level: demand }),
    ]);

    if (!s.success && !c.success) setError(s.error || c.error);
    if (s.success) setSuggest(s.data);
    if (c.success) setCalc(c.data);
    setLoading(false);
  };

  const factors = suggest?.factors && typeof suggest.factors === 'object' ? suggest.factors : null;

  return (
    <AICard
      title="Tarification intelligente"
      icon="pricetag-outline"
      subtitle="Suggestion de tarif et calcul du prix de la prestation"
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
          label="Distance client"
          value={distance}
          onChangeText={(t) => setDistance(t.replace(/[^0-9.,]/g, ''))}
          keyboardType="numeric"
          suffix="km"
        />
      </View>

      <Text style={[styles.label, { color: tc.textSecondary }]}>Niveau de demande (pour le calcul)</Text>
      <View style={styles.chips}>
        {DEMAND_LEVELS.map((l) => (
          <AIChip key={l.id} label={l.label} active={demand === l.id} onPress={() => setDemand(l.id)} />
        ))}
      </View>

      <AIError message={error} />
      <AIButton label="Obtenir ma suggestion" icon="sparkles" onPress={run} loading={loading} />

      {suggest && (
        <View style={[styles.box, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Text style={[styles.boxTitle, { color: tc.text }]}>Tarif suggéré</Text>
          <Text style={styles.price}>{formatAr(suggest.suggested_price)}</Text>
          <Text style={[styles.range, { color: tc.textSecondary }]}>
            Fourchette : {formatAr(suggest.min_price)} – {formatAr(suggest.max_price)}
          </Text>
          <Text style={[styles.range, { color: tc.textSecondary }]}>
            Fiabilité : {formatPercent(suggest.confidence)}
          </Text>
          {factors &&
            Object.entries(factors)
              .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
              .slice(0, 6)
              .map(([k, v]) => (
                <AIStatRow
                  key={k}
                  label={FACTOR_LABELS[k] || k.replace(/_/g, ' ')}
                  value={typeof v === 'number' ? String(Math.round(v * 100) / 100) : v}
                />
              ))}
        </View>
      )}

      {calc && (
        <View style={[styles.box, { borderColor: tc.border }]}>
          <Text style={[styles.boxTitle, { color: tc.text }]}>Calcul détaillé — {calc.massage_type}</Text>
          <AIStatRow label="Prix de base" value={formatAr(calc.breakdown?.base ?? calc.base_price)} />
          <AIStatRow label={`Durée (×${calc.duration_factor})`} value={formatAr(calc.breakdown?.duration_adjustment)} />
          <AIStatRow label={`Distance (×${calc.distance_factor})`} value={formatAr(calc.breakdown?.distance_adjustment)} />
          <AIStatRow label={`Demande (×${calc.demand_factor})`} value={formatAr(calc.breakdown?.demand_adjustment)} />
          <AIStatRow label="Prix final" value={formatAr(calc.final_price)} bold color={colors.primary} />
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
  box: { borderWidth: 1, borderRadius: 14, padding: spacing.md, marginTop: spacing.md },
  boxTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold, marginBottom: 4 },
  price: { fontSize: typography.fontSize.xxl, fontFamily: typography.fontFamily.bold, color: colors.primary },
  range: { fontSize: typography.fontSize.sm, marginTop: 2 },
});

export default AIPricingBlock;
