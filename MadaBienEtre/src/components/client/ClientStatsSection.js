// src/components/client/ClientStatsSection.js
// Statistiques de l'accueil CLIENT — valeurs réelles (GET /stats/client).
// Même mise en page que le tableau de bord thérapeute :
//   ligne 1 : "Mes dépenses" (résumé)  |  "Mes réservations" (prochain RDV + chiffres)
//   ligne 2 : dépenses 6 mois | réservations par mois | massages préférés
// Les données viennent de hooks/useClientStats (partagé avec le hero).
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatMadagascarDateTime } from '../../utils/timeAgo';
import { GridBarChart, HBars, formatAr, formatCount } from '../charts/SimpleCharts';

const BLUE = '#2F6DB5';
const GOLD = '#F59E0B';

const shortMonth = (label) => String(label || '').split(' ')[0];

const ClientStatsSection = ({
  data,
  loading = false,
  error = null,
  onRetry,
  onBook,
  isWide = false,
  primary = '#2E8B57',
  surface = '#FFFFFF',
  text = '#172019',
  textSecondary = '#737985',
  border = '#E3EAE5',
}) => {
  const card = { backgroundColor: surface, borderColor: border };
  const cell = (flex) => (isWide ? { flex, minWidth: 0 } : null);
  const rowStyle = [styles.row, { flexDirection: isWide ? 'row' : 'column' }];

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
        {onRetry ? (
          <TouchableOpacity onPress={onRetry} style={{ marginTop: 8 }}>
            <Text style={{ color: primary }}>Réessayer</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const b = data?.bookings || {};
  const sp = data?.spending || {};
  const next = data?.next_booking;
  const monthly = data?.monthly || [];

  const spentData = monthly.map((m) => ({ label: shortMonth(m.label), value: Number(m.spent) || 0 }));
  const bookingsData = monthly.map((m) => ({ label: shortMonth(m.label), value: Number(m.bookings) || 0 }));

  const tiles = [
    { label: 'Réservations', value: formatCount(b.total), color: primary },
    { label: 'Terminées', value: formatCount(b.completed), color: '#2E8B57' },
    { label: 'À venir', value: formatCount(b.upcoming), color: BLUE },
    { label: 'En attente', value: formatCount(b.pending), color: '#B45309' },
    { label: 'Panier moyen', value: formatAr(sp.average), color: primary },
  ];

  return (
    <View>
      {/* ---------- ligne 1 ---------- */}
      <View style={rowStyle}>
        <View style={[styles.card, card, cell(1)]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: text }]}>Mes dépenses</Text>
              <Text style={[styles.cardSubtitle, { color: textSecondary }]}>Résumé financier</Text>
            </View>
          </View>

          <View style={styles.boxes}>
            <View style={[styles.box, { backgroundColor: `${primary}12` }]}>
              <View style={styles.boxIcon}>
                <Ionicons name="wallet-outline" size={13} color={primary} />
              </View>
              <Text style={[styles.boxLabel, { color: textSecondary }]}>Total dépensé</Text>
              <Text style={[styles.boxValue, { color: primary }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatAr(sp.total)}
              </Text>
            </View>

            <View style={[styles.box, { backgroundColor: `${GOLD}14` }]}>
              <View style={styles.boxIcon}>
                <Ionicons name="calendar-outline" size={13} color="#D97706" />
              </View>
              <Text style={[styles.boxLabel, { color: textSecondary }]}>Ce mois</Text>
              <Text style={[styles.boxValue, { color: '#B45309' }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatAr(sp.month)}
              </Text>
            </View>
          </View>

          {onBook ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onBook}
              style={[styles.cta, { backgroundColor: primary }]}
              accessibilityRole="button"
              accessibilityLabel="Réserver un massage"
            >
              <Text style={styles.ctaText}>Réserver un massage</Text>
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.card, card, cell(2)]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: text }]}>Mes réservations</Text>
              <Text style={[styles.cardSubtitle, { color: textSecondary }]}>Votre activité sur Mada Bien-être</Text>
            </View>
          </View>

          {next ? (
            <View style={[styles.nextRow, { backgroundColor: `${primary}0F` }]}>
              <View style={styles.boxIcon}>
                <Ionicons name="calendar-outline" size={14} color={primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.nextTitle, { color: text }]}>Prochain rendez-vous</Text>
                <Text style={{ color: textSecondary, fontSize: 12 }} numberOfLines={2}>
                  {formatMadagascarDateTime(next.scheduled_date)}
                  {next.massage_type ? ` · ${next.massage_type}` : ''}
                  {next.therapist_name ? ` · ${next.therapist_name}` : ''}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.empty, { color: textSecondary }]}>Aucun rendez-vous à venir pour le moment.</Text>
          )}

          <View style={styles.tiles}>
            {tiles.map((t) => (
              <View key={t.label} style={[styles.tile, { borderColor: border }]}>
                <Text style={[styles.tileLabel, { color: textSecondary }]} numberOfLines={1}>{t.label}</Text>
                <Text style={[styles.tileValue, { color: t.color }]} numberOfLines={1} adjustsFontSizeToFit>
                  {t.value}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.foot, { color: textSecondary }]}>
            {formatCount(data?.reviews_given)} avis donné(s)
          </Text>
        </View>
      </View>

      {/* ---------- ligne 2 ---------- */}
      <View style={rowStyle}>
        <View style={[styles.card, card, cell(1)]}>
          <Text style={[styles.cardTitle, { color: text, marginBottom: 4 }]}>Mes dépenses (6 derniers mois)</Text>
          <GridBarChart
            data={spentData}
            color={primary}
            name="Dépenses"
            nice
            barWidth={isWide ? 30 : 22}
            textColor={textSecondary}
            gridColor={border}
          />
        </View>

        <View style={[styles.card, card, cell(1)]}>
          <Text style={[styles.cardTitle, { color: text, marginBottom: 4 }]}>Mes réservations par mois</Text>
          <GridBarChart
            data={bookingsData}
            color={BLUE}
            name="Réservations"
            integer
            format={formatCount}
            barWidth={isWide ? 30 : 22}
            textColor={textSecondary}
            gridColor={border}
          />
        </View>

        <View style={[styles.card, card, cell(1)]}>
          <Text style={[styles.cardTitle, { color: text, marginBottom: 10 }]}>Mes massages préférés</Text>
          <HBars
            items={(data?.by_massage_type || []).map((t) => ({ label: t.label, value: t.count, color: GOLD }))}
            format={formatCount}
            textColor={text}
            trackColor={border}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { gap: 12, alignItems: 'stretch', marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 90 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSubtitle: { fontSize: 11, marginTop: 3 },
  boxes: { flexDirection: 'row', gap: 10 },
  box: { flex: 1, minHeight: 82, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  boxIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  boxLabel: { fontSize: 11, fontWeight: '600' },
  boxValue: { fontSize: 16, fontWeight: '800', marginTop: 3 },
  cta: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 10, marginBottom: 10 },
  nextTitle: { fontSize: 13, fontWeight: '700' },
  empty: { fontSize: 12, marginBottom: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '28%', borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  tileLabel: { fontSize: 11 },
  tileValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  foot: { fontSize: 11, marginTop: 10 },
});

export default ClientStatsSection;
