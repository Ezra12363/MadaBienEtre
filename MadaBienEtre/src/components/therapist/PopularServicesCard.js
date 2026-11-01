// src/components/therapist/PopularServicesCard.js
//
// "Services les plus demandés" — THÉRAPEUTE.
// 100 % données de la base : GET /stats/therapist/services?period=day|week|month
// (séances TERMINÉES du thérapeute connecté, groupées par type de massage).
// Se recharge à chaque changement de période et quand `refreshKey` change
// (pull-to-refresh / rafraîchissement automatique du Dashboard).
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import statsService from '../../services/statsService';
import { getMassageTypeIconIonicons } from '../../constants/massageTypeIcons';

const GREEN = '#1F6B45';

const PERIODS = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
];

const fmtAr = (v) => `${Math.round(Number(v) || 0).toLocaleString('fr-FR')} Ar`;

const PopularServicesCard = ({
  title = 'Services les plus demandés',
  subtitle = 'Massages les plus réservés (réservations terminées)',
  defaultPeriod = 'month',
  refreshKey = 0,
  style,
}) => {
  const { colors: tc } = useTheme();
  const text = tc?.text || '#17221B';
  const muted = tc?.textSecondary || '#718078';
  const border = tc?.border || '#E2EBE5';
  const surface = tc?.surface || '#FFFFFF';

  const [period, setPeriod] = useState(defaultPeriod);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const rows = await statsService.therapistServices(period);
        setItems(rows);
        setError(null);
      } catch (e) {
        setError(e?.message || 'Impossible de charger les services.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [period],
  );

  // changement de période -> chargement avec spinner ; refreshKey -> rechargement silencieux
  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (refreshKey > 0) load(true);
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const max = Math.max(1, ...items.map((i) => Number(i.count) || 0));

  return (
    <View style={[styles.card, { backgroundColor: surface, borderColor: border }, style]}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 170 }}>
          <Text style={[styles.title, { color: text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text>
        </View>

        <View style={styles.periods}>
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.85}
                onPress={() => setPeriod(p.id)}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: GREEN, borderColor: GREEN }
                    : { backgroundColor: surface, borderColor: border },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? '#FFFFFF' : muted }]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={GREEN} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: muted }]}>{error}</Text>
          <TouchableOpacity onPress={() => load(false)} style={{ marginTop: 6 }}>
            <Text style={{ color: GREEN, fontSize: 12 }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="leaf-outline" size={26} color={muted} />
          <Text style={[styles.empty, { color: muted }]}>Aucune séance terminée sur cette période.</Text>
        </View>
      ) : (
        items.map((item) => {
          const count = Number(item.count) || 0;
          return (
            <View key={item.massage_type_id} style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={getMassageTypeIconIonicons(item.category)} size={15} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, { color: text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.count}>{count} réalisé(s)</Text>
                </View>
                {item.min_price ? (
                  <Text style={[styles.price, { color: muted }]}>à partir de {fmtAr(item.min_price)}</Text>
                ) : null}
                <View style={[styles.track, { backgroundColor: border }]}>
                  <View style={[styles.fill, { width: `${Math.max(3, (count / max) * 100)}%` }]} />
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 11, marginTop: 3 },
  periods: { flexDirection: 'row', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 11, fontWeight: '600' },
  center: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 6 },
  empty: { fontSize: 12, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E3F2EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 13, fontWeight: '700' },
  count: { fontSize: 12, fontWeight: '700', color: GREEN },
  price: { fontSize: 10, marginTop: 2 },
  track: { height: 6, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: GREEN },
});

export default PopularServicesCard;
