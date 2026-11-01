// src/screens/admin/AnalyticsScreen.js
// Écran "Analyses" — TOUTES les valeurs viennent de la base de données
// (GET /stats/admin + GET /admin/statistics). Aucune donnée fictive.
import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';
import statsService from '../../services/statsService';
import {
  BarChart,
  HBars,
  StackedShare,
  formatAr,
  formatCount,
} from '../../components/charts/SimpleCharts';

const PERIODS = [
  { id: 'week', label: '7 jours' },
  { id: 'month', label: '30 jours' },
  { id: 'year', label: '12 mois' },
];

// Modes de paiement regroupés (mvola / orange / airtel => Mobile Money ; stripe / card => Carte).
const METHOD_GROUP = {
  mobile_money: 'Mobile Money',
  mvola: 'Mobile Money',
  orange_money: 'Mobile Money',
  airtel_money: 'Mobile Money',
  card: 'Carte bancaire',
  stripe: 'Carte bancaire',
  cash: 'Espèces',
  vanila_pay: 'Vanilla Pay',
};
const METHOD_COLOR = {
  'Carte bancaire': '#1F6B45',
  Espèces: '#F5A623',
  'Mobile Money': '#4A90D9',
  'Vanilla Pay': '#9B59B6',
};
const METHOD_FALLBACK = ['#E74C3C', '#4A9B9B', '#7A5CB5'];

const STATUS_META = {
  completed: { label: 'Terminées', color: '#27AE60' },
  confirmed: { label: 'Confirmées', color: '#4A90D9' },
  in_progress: { label: 'En cours', color: '#2F6DB5' },
  pending: { label: 'En attente', color: '#F5A623' },
  negotiating: { label: 'Négociation', color: '#E6C21A' },
  cancelled_by_client: { label: 'Annulées (client)', color: '#E74C3C' },
  cancelled_by_therapist: { label: 'Annulées (thérapeute)', color: '#B3261E' },
  expired: { label: 'Expirées', color: '#9E9E9E' },
};
// Ordre de la barre et de la légende (2 colonnes : gauche puis droite).
const STATUS_BAR_ORDER = ['completed', 'pending', 'confirmed', 'expired', 'cancelled_by_client', 'in_progress', 'negotiating', 'cancelled_by_therapist'];
const STATUS_LEGEND_ORDER = ['completed', 'confirmed', 'cancelled_by_client', 'negotiating', 'pending', 'expired', 'in_progress', 'cancelled_by_therapist'];

const compactAr = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} k`;
  return `${Math.round(n)}`;
};

// Anneau de progression en pur React Native (aucune dépendance SVG) : web + Android + iOS.
const Donut = ({ percent = 0, size = 112, thickness = 12, color, track, children }) => {
  const angle = Math.min(100, Math.max(0, Number(percent) || 0)) * 3.6;
  const half = size / 2;
  const arc = (rotate) => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: thickness,
    borderColor: 'transparent',
    borderTopColor: color,
    borderRightColor: color,
    transform: [{ rotate: `${rotate}deg` }],
  });
  const rightRot = Math.min(angle, 180) - 135;
  const leftRot = angle > 180 ? angle - 135 : 45;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: half, borderWidth: thickness, borderColor: track }} />
      {angle > 0 ? (
        <>
          <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
            <View style={[arc(rightRot), { left: -half, top: 0 }]} />
          </View>
          <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
            <View style={[arc(leftRot), { left: 0, top: 0 }]} />
          </View>
        </>
      ) : null}
      {children}
    </View>
  );
};

// Défini hors du composant : évite de remonter les graphiques (et de perdre
// la barre sélectionnée) à chaque changement d'état de l'écran.
const Section = ({ title, children, right, style }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: themeColors.surface, borderColor: themeColors.border || '#E5E7EB' }, style]}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
};

const AnalyticsScreen = () => {
  const { colors: themeColors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState(null); // /admin/statistics (période)
  const [overview, setOverview] = useState(null); // /stats/admin
  const periodRef = useRef('month');

  const loadAnalytics = useCallback(async (p = periodRef.current) => {
    setError(null);
    const [statistics, full] = await Promise.all([
      adminService.getAdminStatistics(p).catch(() => null),
      statsService.admin(6).catch(() => null),
    ]);
    if (!statistics && !full) {
      setError('Impossible de charger les statistiques. Vérifiez votre connexion et le serveur.');
    }
    setStats(statistics);
    setOverview(full);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      loadAnalytics().finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, [loadAnalytics])
  );

  const changePeriod = async (p) => {
    periodRef.current = p;
    setPeriod(p);
    const statistics = await adminService.getAdminStatistics(p).catch(() => null);
    if (statistics) setStats(statistics);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const StatCard = ({ icon, label, value, color, star }) => (
    <View style={[styles.statCard, wide && { flex: 1 }, { backgroundColor: themeColors.surface, borderColor: themeColors.border || '#E5E7EB' }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.statValue, { color: themeColors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
          {star ? <Text style={{ color: '#F5A623' }}>  ★</Text> : null}
        </Text>
        <Text style={[styles.statLabel, { color: themeColors.textSecondary }]} numberOfLines={2}>{label}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
          <Header title="Analyses" showBack />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Chargement...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const o = overview || {};
  const txtSecondary = themeColors.textSecondary;
  const gridColor = themeColors.border || '#E0E0E0';
  const completion = Math.round(Number(stats?.completion_rate ?? o.bookings?.completion_rate ?? 0));
  const periodLabel = (PERIODS.find((p) => p.id === period) || PERIODS[1]).label;

  const monthly = o.monthly || [];
  const revenueData = monthly.map((m) => ({ label: m.label, values: { revenue: m.revenue } }));
  const activityData = monthly.map((m) => ({
    label: m.label,
    values: { bookings: m.bookings, new_users: m.new_users },
  }));

  // Paiements : regroupés par mode, triés par montant décroissant
  const methodTotals = {};
  (o.by_payment_method || []).forEach((m) => {
    const label = METHOD_GROUP[m.method] || m.method;
    methodTotals[label] = (methodTotals[label] || 0) + (Number(m.total) || 0);
  });
  let fb = 0;
  const methodItems = Object.entries(methodTotals)
    .map(([label, value]) => ({ label, value, color: METHOD_COLOR[label] || METHOD_FALLBACK[fb++ % METHOD_FALLBACK.length] }))
    .sort((x, y) => y.value - x.value);

  // Statuts : barre segmentée + légende en 2 colonnes
  const byStatus = o.bookings?.by_status || {};
  const statusTotal = Object.values(byStatus).reduce((a, b) => a + (Number(b) || 0), 0);
  const statusPct = (k) => (statusTotal > 0 ? Math.round(((Number(byStatus[k]) || 0) / statusTotal) * 100) : 0);
  const knownStatuses = Object.keys(byStatus).filter((k) => Number(byStatus[k]) > 0);
  const extraStatuses = knownStatuses.filter((k) => !STATUS_BAR_ORDER.includes(k));
  const barStatuses = [...STATUS_BAR_ORDER, ...extraStatuses].filter((k) => Number(byStatus[k]) > 0);
  const legendStatuses = [...STATUS_LEGEND_ORDER, ...extraStatuses].filter((k) => Number(byStatus[k]) > 0);
  const legendSplit = Math.ceil(legendStatuses.length / 2);
  const statusColor = (k) => STATUS_META[k]?.color || '#9E9E9E';
  const statusLabel = (k) => STATUS_META[k]?.label || k;

  const topTherapists = o.top_therapists || [];
  const topMax = Math.max(1, ...topTherapists.map((t) => Number(t.earnings) || 0));
  const dist = o.reviews?.distribution || {};
  const ratingMax = Math.max(1, ...[5, 4, 3, 2, 1].map((n) => Number(dist[String(n)]) || 0));

  const periodWord = period === 'week' ? '7 jours' : period === 'year' ? '12 mois' : '30 jours';

  const StatusLegendItem = ({ k }) => (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: statusColor(k) }]} />
      <Text style={[styles.legendLabel, { color: themeColors.text }]} numberOfLines={1}>{statusLabel(k)}</Text>
      <Text style={[styles.legendPct, { color: txtSecondary }]}>{statusPct(k)} %</Text>
    </View>
  );

  const kpis = (
    <View style={wide ? styles.rowGap : styles.statsGrid}>
      <StatCard icon="people-outline" label="Nouveaux utilisateurs" value={formatCount(stats?.new_users)} color="#4A90D9" />
      <StatCard icon="calendar-outline" label="Nouvelles réservations" value={formatCount(stats?.new_bookings)} color="#F5A623" />
      <StatCard icon="cash-outline" label={`Revenus (${periodWord})`} value={formatAr(stats?.revenue)} color="#27AE60" />
      <StatCard
        icon="star-outline"
        label={`Note moyenne (${stats?.reviews || 0} avis)`}
        value={Number(stats?.average_rating || 0).toFixed(1).replace('.', ',')}
        color="#9B59B6"
        star
      />
    </View>
  );

  const completionCard = (
    <Section title="Taux de complétion" style={wide ? { flex: 1 } : null}>
      <View style={styles.completionContainer}>
        <Donut percent={completion} size={112} thickness={12} color={colors.primary} track={gridColor + '88'}>
          <Text style={[styles.completionValue, { color: colors.primary }]}>{completion} %</Text>
        </Donut>
        <Text style={[styles.completionLabel, { color: txtSecondary }]}>Réservations terminées sur la période</Text>
      </View>
    </Section>
  );

  const revenueCard = (
    <Section title="Revenus mensuels" style={wide ? { flex: 1.6 } : null}>
      <BarChart
        spread
        data={revenueData}
        series={[{ key: 'revenue', color: colors.primary, name: 'Revenus' }]}
        axisFormat={compactAr}
        textColor={txtSecondary}
        gridColor={gridColor}
        barWidth={wide ? 34 : 22}
      />
    </Section>
  );

  const activityCard = (
    <Section title="Réservations et inscriptions" style={wide ? { flex: 1.35 } : null}>
      <BarChart
        spread
        data={activityData}
        series={[
          { key: 'bookings', color: '#F5A623', name: 'Réservations terminées' },
          { key: 'new_users', color: '#4A90D9', name: 'Nouveaux comptes' },
        ]}
        format={formatCount}
        axisFormat={compactAr}
        textColor={txtSecondary}
        gridColor={gridColor}
        barWidth={wide ? 13 : 12}
      />
    </Section>
  );

  const statusCard = (
    <Section title="Réservations par statut" style={wide ? { flex: 1 } : null}>
      {barStatuses.length === 0 ? (
        <Text style={{ color: txtSecondary, fontSize: 13 }}>Aucune réservation pour le moment.</Text>
      ) : (
        <>
          <View style={styles.statusBar}>
            {barStatuses.map((k) => (
              <View key={k} style={{ flex: Number(byStatus[k]), backgroundColor: statusColor(k) }} />
            ))}
          </View>
          <View style={styles.legendCols}>
            <View style={styles.legendCol}>
              {legendStatuses.slice(0, legendSplit).map((k) => <StatusLegendItem key={k} k={k} />)}
            </View>
            <View style={styles.legendCol}>
              {legendStatuses.slice(legendSplit).map((k) => <StatusLegendItem key={k} k={k} />)}
            </View>
          </View>
        </>
      )}
    </Section>
  );

  const methodCard = (
    <Section title="Paiements par méthode" style={wide ? { flex: 1 } : null}>
      <HBars items={methodItems} textColor={themeColors.text} trackColor={gridColor + '88'} thick percent />
    </Section>
  );

  const topCard = (
    <Section title="Meilleurs thérapeutes" style={wide ? { flex: 1 } : null}>
      {topTherapists.length === 0 ? (
        <Text style={{ color: txtSecondary, fontSize: 13 }}>Aucune réservation terminée pour le moment.</Text>
      ) : (
        topTherapists.map((t, i) => (
          <View key={t.id ?? i} style={styles.topRow}>
            <View style={styles.topLine}>
              <Text style={[styles.topRank, { color: txtSecondary }]}>{i + 1}</Text>
              <Text style={[styles.topName, { color: themeColors.text }]} numberOfLines={1}>{t.name}</Text>
              <Text style={[styles.topBookings, { color: txtSecondary }]}>{t.bookings} rés.</Text>
              <Text style={[styles.topEarn, { color: themeColors.text }]}>{formatAr(t.earnings)}</Text>
            </View>
            <View style={[styles.topTrack, { backgroundColor: gridColor + '88' }]}>
              <View style={[styles.topFill, { width: `${Math.max(3, ((Number(t.earnings) || 0) / topMax) * 100)}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
        ))
      )}
    </Section>
  );

  const ratingCard = (
    <Section title={`Répartition des notes (${o.reviews?.total || 0} avis)`} style={wide ? { flex: 1 } : null}>
      {[5, 4, 3, 2, 1].map((n) => {
        const v = Number(dist[String(n)]) || 0;
        const col = n >= 4 ? '#27AE60' : n === 3 ? '#F5A623' : '#E74C3C';
        return (
          <View key={n} style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: themeColors.text }]}>{n} ★</Text>
            <View style={[styles.ratingTrack, { backgroundColor: gridColor + '88' }]}>
              <View style={[styles.ratingFill, { width: `${v > 0 ? Math.max(4, (v / ratingMax) * 100) : 0}%`, backgroundColor: col }]} />
            </View>
            <Text style={[styles.ratingCount, { color: themeColors.text }]}>{formatCount(v)}</Text>
          </View>
        );
      })}
    </Section>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Analyses" showBack />
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          contentContainerStyle={styles.scrollContent}
        >
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: themeColors.surface }]}>
              <Ionicons name="warning-outline" size={18} color="#F59E0B" />
              <Text style={[styles.errorText, { color: themeColors.text }]}>{error}</Text>
              <TouchableOpacity onPress={onRefresh}>
                <Text style={{ color: colors.primary }}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={[styles.periodBar, { backgroundColor: themeColors.surface, borderColor: gridColor }]}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => changePeriod(p.id)}
                activeOpacity={0.8}
                style={[styles.periodBtn, period === p.id && { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: period === p.id ? '#fff' : txtSecondary, fontSize: 12, fontWeight: period === p.id ? '700' : '500' }}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {kpis}

          {wide ? (
            <>
              <View style={styles.rowGap}>
                {completionCard}
                {revenueCard}
                {activityCard}
              </View>
              <View style={styles.rowGap}>
                {statusCard}
                {methodCard}
              </View>
              <View style={styles.rowGap}>
                {topCard}
                {ratingCard}
              </View>
            </>
          ) : (
            <>
              {completionCard}
              {revenueCard}
              {activityCard}
              {statusCard}
              {methodCard}
              {topCard}
              {ratingCard}
            </>
          )}

          <View style={styles.footer} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl, gap: 12 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 12 },
  errorText: { flex: 1, fontSize: typography.fontSize.sm },
  periodBar: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, padding: 3, gap: 2 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.md },
  rowGap: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexGrow: 1, flexBasis: '47%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  statIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 20, fontFamily: typography.fontFamily.bold, fontWeight: '700' },
  statLabel: { fontSize: 12.5, fontFamily: typography.fontFamily.regular, marginTop: 2 },
  section: { padding: 16, borderRadius: 16, borderWidth: 1 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontFamily: typography.fontFamily.semiBold, fontWeight: '700', marginBottom: 12 },
  completionContainer: { alignItems: 'center', paddingVertical: 8, gap: 14 },
  completionValue: { fontSize: 22, fontFamily: typography.fontFamily.bold, fontWeight: '800' },
  completionLabel: { fontSize: 12, fontFamily: typography.fontFamily.regular, textAlign: 'center' },
  statusBar: { flexDirection: 'row', height: 18, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  legendCols: { flexDirection: 'row', gap: 24 },
  legendCol: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 12.5 },
  legendPct: { fontSize: 12.5, fontWeight: '700' },
  topRow: { marginBottom: 10 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topRank: { width: 16, fontSize: 12.5, fontWeight: '700' },
  topName: { flexShrink: 1, fontSize: 13 },
  topBookings: { flex: 1, fontSize: 11.5 },
  topEarn: { fontSize: 13, fontWeight: '700' },
  topTrack: { height: 6, borderRadius: 3, marginTop: 4, marginLeft: 24 },
  topFill: { height: 6, borderRadius: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  ratingLabel: { width: 34, fontSize: 13 },
  ratingTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  ratingFill: { height: 10, borderRadius: 5 },
  ratingCount: { width: 28, textAlign: 'right', fontSize: 13, fontWeight: '700' },
  footer: { height: 20 },
});

export default AnalyticsScreen;
