// src/components/client/ClientStatsSection.js
// Statistiques de l'accueil CLIENT — valeurs réelles (GET /stats/client).
// Se recharge à chaque changement de `refreshKey` (pull-to-refresh) et
// quand l'écran reprend le focus.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import statsService from '../../services/statsService';
import { formatMadagascarDateTime } from '../../utils/timeAgo';
import {
  BarChart,
  HBars,
  StatTile,
  formatAr,
  formatCount,
} from '../charts/SimpleCharts';

const ClientStatsSection = ({
  refreshKey = 0,
  primary = '#1F6B45',
  surface = '#FFFFFF',
  text = '#172019',
  textSecondary = '#737985',
  border = '#E3EAE5',
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await statsService.client(6);
      if (!mounted.current) return;
      setData(res);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(e?.message || 'Impossible de charger vos statistiques.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Pull-to-refresh de l'accueil (le 1er chargement est fait par useFocusEffect)
  useEffect(() => {
    if (refreshKey > 0) load();
  }, [load, refreshKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const card = { backgroundColor: surface, borderColor: border };

  if (loading && !data) {
    return (
      <View style={[styles.card, card, styles.center]}>
        <ActivityIndicator color={primary} />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.card, card]}>
        <Text style={{ color: textSecondary }}>{error}</Text>
        <TouchableOpacity onPress={load} style={{ marginTop: 8 }}>
          <Text style={{ color: primary }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const b = data?.bookings || {};
  const sp = data?.spending || {};
  const next = data?.next_booking;
  const monthly = data?.monthly || [];

  return (
    <View>
      <View style={styles.header}>
        <Ionicons name="stats-chart-outline" size={18} color={primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: text }]}>Mes statistiques</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Votre activité sur Mada Bien-être</Text>
        </View>
      </View>

      {next ? (
        <View style={[styles.card, card, styles.nextRow]}>
          <View style={[styles.nextIcon, { backgroundColor: `${primary}1A` }]}>
            <Ionicons name="calendar-outline" size={20} color={primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: text }]}>Prochain rendez-vous</Text>
            <Text style={{ color: textSecondary, fontSize: 12 }} numberOfLines={2}>
              {formatMadagascarDateTime(next.scheduled_date)}
              {next.massage_type ? ` · ${next.massage_type}` : ''}
              {next.therapist_name ? ` · ${next.therapist_name}` : ''}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.tiles}>
        <StatTile label="Réservations" value={formatCount(b.total)} color={primary} bg={surface} textColor={text} />
        <StatTile label="Terminées" value={formatCount(b.completed)} color="#2E7D32" bg={surface} textColor={text} />
        <StatTile label="À venir" value={formatCount(b.upcoming)} color="#2F6DB5" bg={surface} textColor={text} />
        <StatTile label="En attente" value={formatCount(b.pending)} color="#B45309" bg={surface} textColor={text} />
        <StatTile label="Total dépensé" value={formatAr(sp.total)} color={primary} bg={surface} textColor={text} sub={`Ce mois : ${formatAr(sp.month)}`} />
        <StatTile label="Panier moyen" value={formatAr(sp.average)} color={primary} bg={surface} textColor={text} sub={`${formatCount(data?.reviews_given)} avis donné(s)`} />
      </View>

      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, { color: text }]}>Mes dépenses (6 derniers mois)</Text>
        <BarChart
          data={monthly.map((m) => ({ label: m.label, values: { spent: m.spent } }))}
          series={[{ key: 'spent', color: primary, name: 'Dépenses' }]}
          textColor={textSecondary}
          gridColor={border}
          barWidth={22}
        />
      </View>

      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, { color: text }]}>Mes réservations par mois</Text>
        <BarChart
          data={monthly.map((m) => ({ label: m.label, values: { bookings: m.bookings } }))}
          series={[{ key: 'bookings', color: '#2F6DB5', name: 'Réservations' }]}
          format={formatCount}
          textColor={textSecondary}
          gridColor={border}
          barWidth={22}
        />
      </View>

      {(data?.by_massage_type || []).length > 0 ? (
        <View style={[styles.card, card]}>
          <Text style={[styles.cardTitle, { color: text }]}>Mes massages préférés</Text>
          <View style={{ height: 10 }} />
          <HBars
            items={data.by_massage_type.map((t) => ({ label: t.label, value: t.count, color: primary }))}
            format={formatCount}
            textColor={textSecondary}
            trackColor={border}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '400' },
  subtitle: { fontSize: 12, fontWeight: '400' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 90 },
  cardTitle: { fontSize: 14, fontWeight: '400', marginBottom: 6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

export default ClientStatsSection;
