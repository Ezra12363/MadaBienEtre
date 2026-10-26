// src/components/reviews/RatingSummary.js
// Note moyenne + nombre d'avis + répartition par étoiles (cliquable pour filtrer).
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import RatingStars from './RatingStars';
import { CATEGORY_LABELS, STAR_COLOR, formatDistribution, formatRating } from './reviewUtils';

export default function RatingSummary({ stats, selectedStar = null, onSelectStar, compact = false }) {
  const { colors: c, isDark } = useTheme();
  const avg = Number(stats?.average_rating ?? stats?.average ?? 0);
  const total = Number(stats?.total_reviews ?? stats?.total ?? 0);
  const rows = formatDistribution(stats?.distribution);
  const cats = Object.entries(stats?.categories || {}).filter(([, v]) => v !== null && v !== undefined);

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border || 'rgba(0,0,0,0.06)' }]}>
      <View style={[s.top, compact && { flexDirection: 'column', alignItems: 'flex-start' }]}>
        <View style={s.avgBlock}>
          <Text style={[s.avg, { color: c.text }]}>{total ? formatRating(avg) : '—'}<Text style={s.outOf}> /5</Text></Text>
          <RatingStars value={avg} size={16} />
          <Text style={[s.count, { color: c.textSecondary }]}>
            {total} avis
          </Text>
        </View>
        <View style={s.bars}>
          {rows.map(({ star, count }) => {
            const pct = total ? (count / total) * 100 : 0;
            const active = selectedStar === star;
            return (
              <TouchableOpacity
                key={star}
                disabled={!onSelectStar}
                onPress={() => onSelectStar && onSelectStar(active ? null : star)}
                style={s.row}
                activeOpacity={0.7}
              >
                <Text style={[s.rowLabel, { color: c.textSecondary }]}>{star}★</Text>
                <View style={[s.track, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#EEF2F6' }]}>
                  <View style={[s.fill, { width: `${pct}%`, backgroundColor: active ? c.primary : STAR_COLOR }]} />
                </View>
                <Text style={[s.rowCount, { color: c.textSecondary }]}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {!compact && cats.length > 0 && (
        <View style={[s.cats, { borderTopColor: c.border || 'rgba(0,0,0,0.06)' }]}>
          {cats.map(([key, value]) => (
            <View key={key} style={s.catRow}>
              <Text style={[s.catLabel, { color: c.text }]}>{CATEGORY_LABELS[key] || key}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <RatingStars value={value} size={12} />
                <Text style={[s.catValue, { color: c.textSecondary }]}>{formatRating(value)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' },
  avgBlock: { alignItems: 'center', minWidth: 96, gap: 4 },
  avg: { fontSize: 38, fontWeight: '800' },
  outOf: { fontSize: 16, fontWeight: '500', opacity: 0.6 },
  count: { fontSize: 12, marginTop: 2 },
  bars: { flex: 1, minWidth: 160, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { width: 26, fontSize: 12 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  rowCount: { width: 28, fontSize: 12, textAlign: 'right' },
  cats: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { fontSize: 13 },
  catValue: { fontSize: 12, width: 28, textAlign: 'right' },
});
