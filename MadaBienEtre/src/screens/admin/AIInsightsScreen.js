// src/screens/admin/AIInsightsScreen.js
//
// ADMIN — « Dashboard IA »
//   Vue d'ensemble : KPI (GET /ai/insights), prévision des revenus
//                    (GET /ai/revenue-prediction), classement des thérapeutes
//                    (GET /ai/best-therapists), services populaires.
//   Fraude         : POST /ai/fraud-detection (par réservation + scan)
//   Marché         : GET /pricing/market-analysis (selon permissions backend)
//   Chatbot        : POST /chatbot/message

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import aiService from '../../services/aiService';
import {
  AITabs,
  AICard,
  AIError,
  AILoading,
} from '../../components/ai/AIPrimitives';
import AIInsightCard from '../../components/ai/AIInsightCard';
import AIRevenueChart from '../../components/ai/AIRevenueChart';
import AIBestTherapists from '../../components/ai/AIBestTherapists';
import AIPopularServices from '../../components/ai/AIPopularServices';
import AIFraudPanel from '../../components/ai/AIFraudPanel';
import AIMarketAnalysisCard from '../../components/ai/AIMarketAnalysisCard';
import AIChatPanel from '../../components/ai/AIChatPanel';
import { formatAr } from '../../components/ai/aiHelpers';

const TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: 'speedometer-outline' },
  { id: 'fraud', label: 'Fraude', icon: 'shield-checkmark-outline' },
  { id: 'market', label: 'Marché', icon: 'stats-chart-outline' },
  { id: 'chat', label: 'Chatbot', icon: 'chatbubbles-outline' },
];

const Kpi = ({ icon, label, value, hint }) => {
  const { colors: tc } = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: tc.surface, borderColor: tc.border }]}>
      <View style={styles.kpiIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.kpiValue, { color: tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.kpiLabel, { color: tc.textSecondary }]}>{label}</Text>
      {hint ? <Text style={[styles.kpiHint, { color: tc.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
};

const AIInsightsScreen = () => {
  const { colors: themeColors } = useTheme();

  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [insights, setInsights] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [insightsError, setInsightsError] = useState(null);
  const [revenueError, setRevenueError] = useState(null);

  const load = useCallback(async () => {
    const [ins, rev] = await Promise.all([
      aiService.getAIInsights(),
      aiService.getRevenuePrediction(),
    ]);
    setInsights(ins.success ? ins.data : null);
    setInsightsError(ins.success ? null : ins.error);
    setRevenue(rev.success ? rev.data : null);
    setRevenueError(rev.success ? null : rev.error);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1); // recharge aussi classement + services
    await load();
    setRefreshing(false);
  };

  // Insights lisibles dérivés des indicateurs (aucun appel supplémentaire).
  const derived = [];
  if (insights) {
    const rate = Number(insights.completion_rate);
    if (Number.isFinite(rate) && insights.total_bookings > 0) {
      derived.push({
        type: rate >= 70 ? 'success' : rate >= 40 ? 'warning' : 'error',
        insight: {
          title: 'Taux de réalisation',
          description:
            rate >= 70
              ? 'La majorité des réservations des 30 derniers jours sont terminées.'
              : 'Beaucoup de réservations ne sont pas terminées : annulations ou réservations en attente à surveiller.',
          value: `${rate.toFixed(1)} %`,
          valueLabel: '30 derniers jours',
        },
      });
    }
  }
  if (revenue && Number.isFinite(Number(revenue.predicted_next_month))) {
    const avg = Number(revenue.average_monthly);
    const next = Number(revenue.predicted_next_month);
    if (avg > 0) {
      const delta = ((next - avg) / avg) * 100;
      derived.push({
        type: delta >= 0 ? 'success' : 'warning',
        insight: {
          title: delta >= 0 ? 'Revenus en hausse prévue' : 'Revenus en baisse prévue',
          description: `Le mois prochain est estimé à ${formatAr(next)}, soit ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} % par rapport à la moyenne mensuelle.`,
        },
      });
    }
  }

  const isOverview = tab === 'overview';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="IA & Chatbot" subtitle="Indicateurs et analyses intelligentes" showBack />

      <View style={styles.body}>
        <AITabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'chat' ? (
          <AIChatPanel role="ADMIN" />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
            refreshControl={
              isOverview ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
          >
            {isOverview && (
              <>
                {loading ? (
                  <AILoading text="Chargement des indicateurs..." />
                ) : (
                  <>
                    <AIError message={insightsError} onRetry={load} />
                    {insights && (
                      <>
                        <Text style={[styles.period, { color: themeColors.textSecondary }]}>
                          Période : 30 derniers jours
                        </Text>
                        <View style={styles.kpiGrid}>
                          <Kpi icon="cash-outline" label="Chiffre d'affaires" value={formatAr(insights.total_revenue)} />
                          <Kpi icon="calendar-outline" label="Réservations" value={String(insights.total_bookings ?? 0)} />
                          <Kpi
                            icon="checkmark-done-outline"
                            label="Taux de réalisation"
                            value={`${Number(insights.completion_rate || 0).toFixed(1)} %`}
                          />
                          <Kpi icon="receipt-outline" label="Panier moyen" value={formatAr(insights.average_booking_value)} />
                        </View>
                      </>
                    )}

                    {derived.map((d, i) => (
                      <AIInsightCard key={i} type={d.type} insight={d.insight} />
                    ))}

                    <AIError message={revenueError} onRetry={load} />
                    {revenue && <AIRevenueChart data={revenue} />}

                    <AIBestTherapists
                      key={`best-${refreshKey}`}
                      title="Classement des thérapeutes"
                      limit={10}
                      showActions={false}
                    />
                    <AIPopularServices key={`pop-${refreshKey}`} title="Services populaires" />
                  </>
                )}
              </>
            )}

            {tab === 'fraud' && (
              <>
                <AIFraudPanel />
                <AICard icon="information-circle-outline" title="À savoir">
                  <Text style={{ color: themeColors.textSecondary, fontSize: typography.fontSize.sm }}>
                    L'IA signale des réservations à vérifier ; la décision finale (blocage, suspension)
                    reste à l'administrateur.
                  </Text>
                </AICard>
              </>
            )}

            {tab === 'market' && <AIMarketAnalysisCard />}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  scroll: { paddingBottom: spacing.xxl },
  period: { fontSize: typography.fontSize.sm, marginBottom: spacing.sm },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  kpi: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiValue: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold },
  kpiLabel: { fontSize: typography.fontSize.xs, marginTop: 2 },
  kpiHint: { fontSize: typography.fontSize.xs },
});

export default AIInsightsScreen;
