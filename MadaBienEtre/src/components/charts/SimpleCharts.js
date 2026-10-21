// src/components/charts/SimpleCharts.js
// Graphiques 100 % React Native (View) : aucune dépendance, marchent sur
// Web, Android et iOS. Pas de texte en gras.
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const fmtShort = (n) => {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e6) return `${(n / 1e6).toFixed(1).replace('.0', '')} M`;
  if (v >= 1e3) return `${Math.round(n / 1e3)} k`;
  return `${Math.round(n || 0)}`;
};
export const formatAr = (v) => `${Math.round(Number(v) || 0).toLocaleString('fr-FR')} Ar`;

/**
 * Histogramme groupé.
 * data: [{ label, values: { key: number } }]
 * series: [{ key, color, name }]
 */
export function BarChart({ data = [], series = [], height = 150, textColor = '#777', gridColor = '#ECECEC', barWidth = 14 }) {
  const [sel, setSel] = useState(null);
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d.values?.[s.key]) || 0)));
  const colW = Math.max(series.length * (barWidth + 2) + 10, 34);
  const empty = data.every((d) => series.every((s) => !Number(d.values?.[s.key])));

  return (
    <View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={[styles.legendText, { color: textColor }]}>{s.name}</Text>
          </View>
        ))}
      </View>
      {sel !== null && data[sel] ? (
        <Text style={[styles.tip, { color: textColor }]}>
          {data[sel].label} · {series.map((s) => `${s.name} ${formatAr(data[sel].values?.[s.key])}`).join(' · ')}
        </Text>
      ) : (
        <Text style={[styles.tip, { color: textColor }]}>{empty ? 'Aucune donnée pour le moment' : 'Touchez une barre pour le détail'}</Text>
      )}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 34, height, justifyContent: 'space-between' }}>
          {[1, 0.5, 0].map((r) => (
            <Text key={r} style={[styles.axis, { color: textColor }]}>{fmtShort(max * r)}</Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: gridColor }}>
              {data.map((d, i) => (
                <View key={`${d.label}-${i}`} style={{ width: colW, alignItems: 'center' }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 2 }}
                    onTouchEnd={() => setSel(i)}
                    // @ts-ignore (web)
                    onClick={() => setSel(i)}
                  >
                    {series.map((s) => {
                      const v = Number(d.values?.[s.key]) || 0;
                      return (
                        <View
                          key={s.key}
                          style={{
                            width: barWidth,
                            height: Math.max(v > 0 ? 3 : 0, (v / max) * (height - 4)),
                            backgroundColor: s.color,
                            borderTopLeftRadius: 4,
                            borderTopRightRadius: 4,
                            opacity: sel === null || sel === i ? 1 : 0.45,
                          }}
                        />
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {data.map((d, i) => (
                <Text key={`${d.label}-l-${i}`} style={[styles.xLabel, { width: colW, color: textColor }]} numberOfLines={1}>
                  {d.label}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

/** Barres horizontales : items = [{ label, value, color }] */
export function HBars({ items = [], textColor = '#777', trackColor = '#EFEFEF', format = formatAr }) {
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  if (!items.length) return <Text style={[styles.tip, { color: textColor }]}>Aucune donnée pour le moment</Text>;
  return (
    <View style={{ gap: 10 }}>
      {items.map((it) => (
        <View key={it.label}>
          <View style={styles.hRow}>
            <Text style={[styles.hLabel, { color: textColor }]} numberOfLines={1}>{it.label}</Text>
            <Text style={[styles.hLabel, { color: textColor }]}>{format(it.value)}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: trackColor }]}>
            <View style={[styles.fill, { width: `${Math.max(2, ((Number(it.value) || 0) / max) * 100)}%`, backgroundColor: it.color || '#1F6B45' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Répartition en une barre segmentée : items = [{label, value, color}] */
export function StackedShare({ items = [], textColor = '#777' }) {
  const total = items.reduce((a, b) => a + (Number(b.value) || 0), 0);
  if (!total) return <Text style={[styles.tip, { color: textColor }]}>Aucune donnée pour le moment</Text>;
  return (
    <View>
      <View style={styles.stack}>
        {items.map((it) => (
          <View key={it.label} style={{ flex: Math.max(0.0001, Number(it.value) || 0), backgroundColor: it.color }} />
        ))}
      </View>
      <View style={[styles.legend, { marginTop: 8 }]}>
        {items.map((it) => (
          <View key={it.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: it.color }]} />
            <Text style={[styles.legendText, { color: textColor }]}>
              {it.label} {Math.round(((Number(it.value) || 0) / total) * 100)} %
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Tuile chiffre clé */
export function StatTile({ label, value, color = '#1F6B45', icon, bg = '#fff', textColor = '#222', sub, basis = '45%' }) {
  return (
    <View style={[styles.tile, { backgroundColor: bg, flexBasis: basis }]}>
      <Text style={[styles.tileLabel, { color: textColor, opacity: 0.65 }]}>{label}</Text>
      <Text style={[styles.tileValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={[styles.tileLabel, { color: textColor, opacity: 0.55 }]}>{sub}</Text> : null}
    </View>
  );
}

export const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-');
  const names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${names[(Number(m) || 1) - 1]} ${String(y).slice(2)}`;
};
export const dayLabel = (iso) => String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7);

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: '400' },
  tip: { fontSize: 12, marginVertical: 6, fontWeight: '400' },
  axis: { fontSize: 10, fontWeight: '400' },
  xLabel: { fontSize: 10, textAlign: 'center', marginTop: 4, fontWeight: '400' },
  hRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  hLabel: { fontSize: 12, fontWeight: '400', flexShrink: 1 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  stack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: 14, padding: 14, gap: 4, borderWidth: 1, borderColor: '#EEE' },
  tileLabel: { fontSize: 12, fontWeight: '400' },
  tileValue: { fontSize: 20, fontWeight: '400' },
});
