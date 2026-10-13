// src/components/ai/AIRevenueChart.js
// ADMIN — GET /ai/revenue-prediction : revenus mensuels + prévision du mois suivant.
// Graphique en barres sans dépendance externe (fonctionne web + Android).
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import { AICard, AIEmpty, AIStatRow } from './AIPrimitives';
import { formatAr } from './aiHelpers';

const CHART_HEIGHT = 140;

const monthLabel = (raw) => {
  const text = String(raw || '');
  const m = text.match(/(\d{4})-(\d{2})/);
  if (!m) return text.slice(0, 7);
  const names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return names[Number(m[2]) - 1] || m[2];
};

const compact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
  return String(Math.round(v));
};

const AIRevenueChart = ({ data }) => {
  const { colors: tc } = useTheme();

  const months = Array.isArray(data?.monthly_data) ? data.monthly_data : [];
  const predicted = Number(data?.predicted_next_month);
  const hasPrediction = Number.isFinite(predicted) && months.length > 0;

  const bars = [
    ...months.map((m) => ({ label: monthLabel(m.month), value: Number(m.revenue) || 0, predicted: false })),
    ...(hasPrediction ? [{ label: 'Prévu', value: predicted, predicted: true }] : []),
  ];
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <AICard
      title="Prévision des revenus"
      icon="trending-up-outline"
      subtitle="6 derniers mois + estimation du mois prochain"
    >
      {bars.length === 0 ? (
        <AIEmpty text="Pas encore de revenus terminés à analyser." />
      ) : (
        <>
          <View style={styles.chart}>
            {bars.map((b, i) => (
              <View key={`${b.label}-${i}`} style={styles.barCol}>
                <Text style={[styles.barValue, { color: tc.textSecondary }]}>{compact(b.value)}</Text>
                <View style={styles.barArea}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(4, (b.value / max) * CHART_HEIGHT),
                        backgroundColor: b.predicted ? colors.accent : colors.primary,
                        opacity: b.predicted ? 0.75 : 1,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: tc.textSecondary }]} numberOfLines={1}>
                  {b.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.legend}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendText, { color: tc.textSecondary }]}>Réel</Text>
            <View style={[styles.dot, { backgroundColor: colors.accent, marginLeft: spacing.md }]} />
            <Text style={[styles.legendText, { color: tc.textSecondary }]}>Prévision</Text>
          </View>

          <AIStatRow label="Prévision mois prochain" value={formatAr(data?.predicted_next_month)} bold color={colors.primary} />
          <AIStatRow label="Moyenne mensuelle" value={formatAr(data?.average_monthly)} />
          <AIStatRow label="Total 6 mois" value={formatAr(data?.total_6_months)} />
        </>
      )}
    </AICard>
  );
};

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: spacing.sm },
  barCol: { flex: 1, alignItems: 'center' },
  barArea: { height: CHART_HEIGHT, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar: { width: '70%', maxWidth: 38, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barValue: { fontSize: 10, marginBottom: 3 },
  barLabel: { fontSize: 10, marginTop: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  legendText: { fontSize: typography.fontSize.xs },
});

export default AIRevenueChart;
