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

const METHOD_NAMES = {
  mobile_money: 'Mobile Money',
  card: 'Carte bancaire',
  cash: 'Espèces',
  vanila_pay: 'Vanilla Pay',
};
const METHOD_COLORS = ['#4A90D9', '#27AE60', '#F5A623', '#9B59B6', '#E74C3C'];

const STATUS_META = {
  completed: { label: 'Terminées', color: '#27AE60' },
  confirmed: { label: 'Confirmées', color: '#4A90D9' },
  in_progress: { label: 'En cours', color: '#2F6DB5' },
  pending: { label: 'En attente', color: '#F5A623' },
  negotiating: { label: 'Négociation', color: '#F39C12' },
  cancelled_by_client: { label: 'Annulées (client)', color: '#E74C3C' },
  cancelled_by_therapist: { label: 'Annulées (thérapeute)', color: '#C0392B' },
  expired: { label: 'Expirées', color: '#9E9E9E' },
};

// Défini hors du composant : évite de remonter les graphiques (et de perdre
// la barre sélectionnée) à chaque changement d'état de l'écran.
const Section = ({ title, children, right }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
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

  const StatCard = ({ icon, label, value, color }) => (
    <View style={[styles.statCard, { backgroundColor: themeColors.surface }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.statValue, { color: themeColors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{label}</Text>
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
  const completion = Number(stats?.completion_rate ?? o.bookings?.completion_rate ?? 0);

  const monthly = o.monthly || [];
  const revenueData = monthly.map((m) => ({ label: m.label, values: { revenue: m.revenue } }));
  const activityData = monthly.map((m) => ({
    label: m.label,
    values: { bookings: m.bookings, new_users: m.new_users },
  }));
  const methodItems = (o.by_payment_method || []).map((m, i) => ({
    label: METHOD_NAMES[m.method] || m.method,
    value: m.total,
    color: METHOD_COLORS[i % METHOD_COLORS.length],
  }));
  const statusItems = Object.entries(o.bookings?.by_status || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      label: STATUS_META[k]?.label || k,
      value: v,
      color: STATUS_META[k]?.color || '#9E9E9E',
    }));
  const topTherapists = (o.top_therapists || []).map((t) => ({
    label: `${t.name} · ${t.bookings} rés.`,
    value: t.earnings,
    color: colors.primary,
  }));
  const dist = o.reviews?.distribution || {};
  const ratingItems = [5, 4, 3, 2, 1].map((n) => ({
    label: `${n} ★`,
    value: dist[String(n)] || 0,
    color: n >= 4 ? '#27AE60' : n === 3 ? '#F5A623' : '#E74C3C',
  }));

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

          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => changePeriod(p.id)}
                style={[
                  styles.periodBtn,
                  { backgroundColor: period === p.id ? colors.primary : themeColors.surface },
                ]}
              >
                <Text style={{ color: period === p.id ? '#fff' : txtSecondary, fontSize: 12 }}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.statsGrid}>
            <StatCard icon="people-outline" label="Nouveaux utilisateurs" value={formatCount(stats?.new_users)} color="#4A90D9" />
            <StatCard icon="calendar-outline" label="Nouvelles réservations" value={formatCount(stats?.new_bookings)} color="#F5A623" />
            <StatCard icon="cash-outline" label="Revenus" value={formatAr(stats?.revenue)} color="#27AE60" />
            <StatCard
              icon="star-outline"
              label={`Note moyenne (${stats?.reviews || 0} avis)`}
              value={`⭐ ${Number(stats?.average_rating || 0).toFixed(1)}`}
              color="#9B59B6"
            />
          </View>

          <Section title="Taux de complétion">
            <View style={styles.completionContainer}>
              <Text style={[styles.completionValue, { color: colors.primary }]}>{completion}%</Text>
              <View style={[styles.completionBar, { backgroundColor: gridColor }]}>
                <View
                  style={[
                    styles.completionFill,
                    { width: `${Math.min(100, Math.max(0, completion))}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
              <Text style={[styles.completionLabel, { color: txtSecondary }]}>
                Réservations terminées sur la période
              </Text>
            </View>
          </Section>

          <Section title="Revenus mensuels">
            <BarChart
              data={revenueData}
              series={[{ key: 'revenue', color: colors.primary, name: 'Revenus' }]}
              textColor={txtSecondary}
              gridColor={gridColor}
              barWidth={22}
            />
          </Section>

          <Section title="Réservations et inscriptions">
            <BarChart
              data={activityData}
              series={[
                { key: 'bookings', color: '#F5A623', name: 'Réservations terminées' },
                { key: 'new_users', color: '#4A90D9', name: 'Nouveaux comptes' },
              ]}
              format={formatCount}
              textColor={txtSecondary}
              gridColor={gridColor}
              barWidth={14}
            />
          </Section>

          <Section title="Réservations par statut">
            <StackedShare items={statusItems} textColor={txtSecondary} />
          </Section>

          <Section title="Paiements par méthode">
            <HBars items={methodItems} textColor={txtSecondary} trackColor={gridColor} />
          </Section>

          <Section title="Meilleurs thérapeutes">
            <HBars items={topTherapists} textColor={txtSecondary} trackColor={gridColor} />
          </Section>

          <Section title={`Répartition des notes (${o.reviews?.total || 0} avis)`}>
            <HBars items={ratingItems} textColor={txtSecondary} trackColor={gridColor} format={formatCount} />
          </Section>

          <View style={styles.footer} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 12, marginBottom: spacing.md },
  errorText: { flex: 1, fontSize: typography.fontSize.sm },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  container: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.md },
  statCard: { width: '48%', padding: spacing.md, borderRadius: 16, marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  statIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  statValue: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  statLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  section: { padding: spacing.md, borderRadius: 16, marginBottom: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  sectionTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold, marginBottom: spacing.md },
  completionContainer: { alignItems: 'center' },
  completionValue: { fontSize: typography.fontSize.xxl, fontFamily: typography.fontFamily.bold },
  completionBar: { width: '100%', height: 8, borderRadius: 4, marginVertical: spacing.sm },
  completionFill: { height: 8, borderRadius: 4 },
  completionLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  monthlyGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, paddingTop: spacing.md },
  monthlyItem: { alignItems: 'center', width: '12%' },
  monthlyBar: { width: 20, borderRadius: 4, minHeight: 10 },
  monthlyLabel: { fontSize: 10, fontFamily: typography.fontFamily.medium, marginTop: 4 },
  methodRow: { marginBottom: spacing.sm },
  methodLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, marginBottom: 2 },
  methodBar: { height: 6, borderRadius: 3, marginVertical: 2 },
  methodFill: { height: 6, borderRadius: 3 },
  methodValue: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular },
  footer: { height: 20 },
});

export default AnalyticsScreen;