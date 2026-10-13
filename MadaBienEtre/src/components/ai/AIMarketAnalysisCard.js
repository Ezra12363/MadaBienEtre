// src/components/ai/AIMarketAnalysisCard.js
// THÉRAPEUTE / ADMIN — GET /pricing/market-analysis
// ⚠️ Le backend utilise get_current_therapist : si l'admin reçoit un 403,
// le message d'erreur est affiché tel quel (à ajuster côté backend).
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import aiService from '../../services/aiService';
import {
  AICard,
  AIChip,
  AIError,
  AIEmpty,
  AILoading,
  AIStatRow,
  AIMassageTypePicker,
} from './AIPrimitives';
import { formatAr } from './aiHelpers';

const AIMarketAnalysisCard = () => {
  const { colors: tc } = useTheme();
  const [type, setType] = useState(null); // null = tous
  const [useFilter, setUseFilter] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await aiService.getMarketAnalysis(useFilter && type ? type.id : null);
    if (result.success) setData(result.data);
    else setError(result.error);
    setLoading(false);
  }, [useFilter, type]);

  useEffect(() => {
    load();
  }, [load]);

  const distribution = Array.isArray(data?.price_distribution) ? data.price_distribution : [];
  const maxCount = Math.max(1, ...distribution.map((d) => Number(d.count) || 0));

  return (
    <AICard
      title="Analyse du marché"
      icon="stats-chart-outline"
      subtitle="Prix des réservations terminées (données agrégées)"
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <AIChip label="Tous les massages" active={!useFilter} onPress={() => setUseFilter(false)} />
        <AIChip label="Par type" active={useFilter} onPress={() => setUseFilter(true)} />
      </ScrollView>
      {useFilter && <AIMassageTypePicker value={type} onChange={setType} label="Filtrer par type" />}

      {loading ? (
        <AILoading />
      ) : error ? (
        <AIError message={error} onRetry={load} />
      ) : !data || !data.total_bookings ? (
        <AIEmpty text="Pas encore assez de réservations terminées pour analyser le marché." />
      ) : (
        <>
          <View style={styles.kpis}>
            <View style={[styles.kpi, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatAr(data.average_price)}</Text>
              <Text style={[styles.kpiLabel, { color: tc.textSecondary }]}>Prix moyen</Text>
            </View>
            <View style={[styles.kpi, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>{data.total_bookings}</Text>
              <Text style={[styles.kpiLabel, { color: tc.textSecondary }]}>Réservations</Text>
            </View>
          </View>
          <AIStatRow label="Prix minimum" value={formatAr(data.min_price)} />
          <AIStatRow label="Prix maximum" value={formatAr(data.max_price)} />

          <Text style={[styles.sub, { color: tc.text }]}>Répartition des prix</Text>
          {distribution.map((d, i) => {
            const count = Number(d.count) || 0;
            return (
              <View key={`${d.range}-${i}`} style={styles.distRow}>
                <Text style={[styles.distLabel, { color: tc.textSecondary }]} numberOfLines={1}>
                  {d.range}
                </Text>
                <View style={[styles.track, { backgroundColor: tc.border }]}>
                  <View style={[styles.fill, { width: `${(count / maxCount) * 100}%` }]} />
                </View>
                <Text style={[styles.distCount, { color: tc.text }]}>{count}</Text>
              </View>
            );
          })}
        </>
      )}
    </AICard>
  );
};

const styles = StyleSheet.create({
  filterRow: { gap: spacing.sm, marginBottom: spacing.sm },
  kpis: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  kpi: { flex: 1, borderRadius: 12, padding: spacing.md, alignItems: 'center' },
  kpiValue: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  kpiLabel: { fontSize: typography.fontSize.xs, marginTop: 2 },
  sub: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold, marginTop: spacing.md, marginBottom: 4 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  distLabel: { width: 110, fontSize: typography.fontSize.xs },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  distCount: { width: 28, textAlign: 'right', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
});

export default AIMarketAnalysisCard;
