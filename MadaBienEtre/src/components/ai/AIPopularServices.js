// src/components/ai/AIPopularServices.js
// GET /ai/popular-services (tous rôles). Affiche nom + nombre de réservations.
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import aiService from '../../services/aiService';
import { AICard, AIChip, AIError, AIEmpty, AILoading } from './AIPrimitives';
import { PERIODS, formatAr } from './aiHelpers';

const AIPopularServices = ({ title = 'Services populaires', onSelect, defaultPeriod = 'month' }) => {
  const { colors: tc } = useTheme();
  const [period, setPeriod] = useState(defaultPeriod);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await aiService.getPopularServicesNamed(period);
    if (result.success) setItems(result.data);
    else setError(result.error);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const max = Math.max(1, ...items.map((i) => Number(i.bookings_count) || 0));

  return (
    <AICard title={title} icon="flame-outline" subtitle="Massages les plus réservés (réservations terminées)">
      <View style={styles.periods}>
        {PERIODS.map((p) => (
          <AIChip key={p.id} label={p.label} active={period === p.id} onPress={() => setPeriod(p.id)} />
        ))}
      </View>

      {loading ? (
        <AILoading />
      ) : error ? (
        <AIError message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <AIEmpty text="Aucune donnée pour cette période." />
      ) : (
        items.map((item, index) => {
          const count = Number(item.bookings_count) || 0;
          return (
            <View key={`${item.massage_type_id}-${index}`} style={styles.row}>
              <View style={styles.rank}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text
                    style={[styles.name, { color: tc.text }]}
                    numberOfLines={1}
                    onPress={onSelect ? () => onSelect(item) : undefined}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.count, { color: colors.primary }]}>
                    {count} réserv.
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: tc.border }]}>
                  <View style={[styles.barFill, { width: `${(count / max) * 100}%` }]} />
                </View>
                {item.min_price ? (
                  <Text style={[styles.price, { color: tc.textSecondary }]}>
                    à partir de {formatAr(item.min_price)}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </AICard>
  );
};

const styles = StyleSheet.create({
  periods: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: colors.primary, fontSize: 12, fontFamily: typography.fontFamily.bold },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  count: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  barTrack: { height: 6, borderRadius: 3, marginTop: 5, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  price: { fontSize: typography.fontSize.xs, marginTop: 3 },
});

export default AIPopularServices;
