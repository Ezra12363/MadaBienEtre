// src/screens/admin/AIInsightsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';

const { width } = Dimensions.get('window');

const AIInsightsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  
  // États
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Données IA
  const [insights, setInsights] = useState(null);
  const [popularServices, setPopularServices] = useState([]);
  const [bestTherapists, setBestTherapists] = useState([]);
  const [revenuePrediction, setRevenuePrediction] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const periods = [
    { id: 'day', label: 'Jour' },
    { id: 'week', label: 'Semaine' },
    { id: 'month', label: 'Mois' },
    { id: 'year', label: 'Année' },
  ];

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================

  useFocusEffect(
    useCallback(() => {
      loadAIInsights();
    }, [selectedPeriod])
  );

  const loadAIInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📤 Chargement des insights IA...');
      
      const [insightData, popular, best, prediction] = await Promise.all([
        adminService.getAIInsights().catch((e) => {
          console.error('❌ Error getAIInsights:', e);
          return null;
        }),
        adminService.getPopularServices().catch((e) => {
          console.error('❌ Error getPopularServices:', e);
          return [];
        }),
        adminService.getBestTherapists().catch((e) => {
          console.error('❌ Error getBestTherapists:', e);
          return [];
        }),
        adminService.getRevenuePrediction().catch((e) => {
          console.error('❌ Error getRevenuePrediction:', e);
          return null;
        })
      ]);
      
      console.log('✅ Insights chargés:', insightData);
      console.log('✅ Services populaires:', popular?.length);
      console.log('✅ Meilleurs thérapeutes:', best?.length);
      console.log('✅ Prédiction revenus:', prediction);
      
      setInsights(insightData || {
        period: selectedPeriod,
        total_bookings: 0,
        completion_rate: 0,
        total_revenue: 0,
        average_booking_value: 0
      });
      
      setPopularServices(popular || []);
      setBestTherapists(best || []);
      setRevenuePrediction(prediction || {
        predicted_next_month: 0,
        total_6_months: 0,
        average_monthly: 0,
        monthly_data: []
      });
      
    } catch (error) {
      console.error('❌ Error loading AI insights:', error);
      setError('Impossible de charger les insights IA');
      
      // Données mockées en cas d'erreur
      setInsights({
        period: selectedPeriod,
        total_bookings: 89,
        completion_rate: 68.5,
        total_revenue: 3200000,
        average_booking_value: 35955
      });
      setPopularServices([
        { massage_type_id: 1, bookings_count: 25 },
        { massage_type_id: 2, bookings_count: 18 },
        { massage_type_id: 3, bookings_count: 12 },
        { massage_type_id: 4, bookings_count: 8 },
      ]);
      setBestTherapists([
        { id: 1, fullname: 'Jean Rakoto', rating: 4.8, total_reviews: 25, experience_years: 5, base_price: 45000 },
        { id: 2, fullname: 'Sarah Randria', rating: 4.5, total_reviews: 18, experience_years: 3, base_price: 40000 },
        { id: 3, fullname: 'Hery Rabe', rating: 4.2, total_reviews: 12, experience_years: 2, base_price: 35000 },
      ]);
      setRevenuePrediction({
        predicted_next_month: 4500000,
        total_6_months: 18000000,
        average_monthly: 3000000,
        monthly_data: [
          { month: 'Jan', revenue: 800000 },
          { month: 'Fév', revenue: 950000 },
          { month: 'Mar', revenue: 1100000 },
          { month: 'Avr', revenue: 1050000 },
          { month: 'Mai', revenue: 1200000 },
          { month: 'Juin', revenue: 1300000 },
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAIInsights();
    setRefreshing(false);
  };

  // ============================================================
  // FONCTIONS UTILITAIRES
  // ============================================================

  const formatPrice = (price) => {
    if (!price) return '0 Ar';
    return price.toLocaleString() + ' Ar';
  };

  const getServiceName = (id) => {
    const names = {
      1: 'Massage Suédois',
      2: 'Deep Tissue',
      3: 'Shiatsu',
      4: 'Réflexologie',
      5: 'Massage Sportif',
      6: 'Massage Prénatal',
      7: 'Pierres Chaudes'
    };
    return names[id] || `Service #${id}`;
  };

  const getServiceIcon = (id) => {
    const icons = {
      1: '😌',
      2: '💪',
      3: '👆',
      4: '🦶',
      5: '🏃',
      6: '🤰',
      7: '🔥'
    };
    return icons[id] || '💆';
  };

  // ============================================================
  // RENDU DES COMPOSANTS
  // ============================================================

  // ✅ Carte d'insight principal
  const InsightCard = ({ icon, label, value, color, subtitle }) => (
    <View style={[styles.insightCard, { backgroundColor: themeColors.surface }]}>
      <View style={[styles.insightIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.insightValue, { color: themeColors.text }]}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text style={[styles.insightLabel, { color: themeColors.textSecondary }]}>
        {label}
      </Text>
      {subtitle && (
        <Text style={[styles.insightSubtitle, { color: themeColors.textSecondary }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  // ✅ Carte de service populaire
  const PopularServiceItem = ({ item, index }) => (
    <View style={[styles.popularItem, { 
      backgroundColor: themeColors.surface,
      borderBottomColor: themeColors.border || '#E8ECF1' 
    }]}>
      <View style={styles.popularLeft}>
        <View style={[styles.popularRank, { 
          backgroundColor: index === 0 ? '#F5A62320' : colors.primary + '20' 
        }]}>
          <Text style={[styles.popularRankText, { 
            color: index === 0 ? '#F5A623' : colors.primary 
          }]}>
            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
          </Text>
        </View>
        <View style={styles.popularInfo}>
          <Text style={[styles.popularName, { color: themeColors.text }]}>
            {getServiceIcon(item.massage_type_id)} {getServiceName(item.massage_type_id)}
          </Text>
          <Text style={[styles.popularCount, { color: themeColors.textSecondary }]}>
            {item.bookings_count} réservations
          </Text>
        </View>
      </View>
      <View style={[styles.popularBar, { backgroundColor: themeColors.border || '#E8ECF1' }]}>
        <View style={[styles.popularFill, { 
          width: `${Math.min((item.bookings_count / (popularServices[0]?.bookings_count || 1)) * 100, 100)}%`,
          backgroundColor: index === 0 ? '#F5A623' : colors.primary 
        }]} />
      </View>
    </View>
  );

  // ✅ Carte du meilleur thérapeute
  const BestTherapistItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.therapistItem, { 
        backgroundColor: themeColors.surface,
        borderBottomColor: themeColors.border || '#E8ECF1',
        borderLeftColor: index === 0 ? '#F5A623' : colors.primary,
        borderLeftWidth: 4,
      }]}
      onPress={() => navigation.navigate('TherapistDetail', { therapistId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.therapistLeft}>
        <View style={[styles.therapistRank, { 
          backgroundColor: index === 0 ? '#F5A62320' : colors.primary + '20' 
        }]}>
          <Text style={[styles.therapistRankText, { 
            color: index === 0 ? '#F5A623' : colors.primary 
          }]}>
            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
          </Text>
        </View>
        <View style={styles.therapistInfo}>
          <Text style={[styles.therapistName, { color: themeColors.text }]}>
            {item.fullname}
          </Text>
          <View style={styles.therapistTags}>
            <View style={[styles.therapistTag, { backgroundColor: '#F5A62320' }]}>
              <Ionicons name="star" size={12} color="#F5A623" />
              <Text style={[styles.therapistTagText, { color: '#F5A623' }]}>
                {item.rating || 0}
              </Text>
            </View>
            <View style={[styles.therapistTag, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.therapistTagText, { color: colors.primary }]}>
                {item.total_reviews || 0} avis
              </Text>
            </View>
            <View style={[styles.therapistTag, { backgroundColor: '#27AE6020' }]}>
              <Text style={[styles.therapistTagText, { color: '#27AE60' }]}>
                {item.experience_years || 0} ans
              </Text>
            </View>
          </View>
        </View>
      </View>
      <Text style={[styles.therapistPrice, { color: colors.primary }]}>
        {formatPrice(item.base_price)}
      </Text>
    </TouchableOpacity>
  );

  // ✅ Graphique des revenus mensuels
  const RevenueChart = () => {
    const data = revenuePrediction?.monthly_data || [];
    if (data.length === 0) return null;
    
    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
    
    return (
      <View style={[styles.chartContainer, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.chartTitle, { color: themeColors.text }]}>
          📊 Évolution des revenus
        </Text>
        <View style={styles.chartBars}>
          {data.map((item, index) => {
            const height = (item.revenue / maxRevenue) * 150;
            return (
              <View key={index} style={styles.chartBarWrapper}>
                <Text style={[styles.chartBarValue, { color: themeColors.textSecondary }]}>
                  {(item.revenue / 1000).toFixed(0)}k
                </Text>
                <View style={[styles.chartBar, { 
                  height: Math.max(height, 20),
                  backgroundColor: index === data.length - 1 ? '#4A90D9' : '#4A90D960' 
                }]} />
                <Text style={[styles.chartBarLabel, { color: themeColors.textSecondary }]}>
                  {item.month}
                </Text>
              </View>
            );
          })}
        </View>
        {revenuePrediction?.predicted_next_month && (
          <View style={styles.predictionContainer}>
            <View style={[styles.predictionBadge, { backgroundColor: '#4A90D920' }]}>
              <Ionicons name="trending-up" size={16} color="#4A90D9" />
              <Text style={[styles.predictionText, { color: '#4A90D9' }]}>
                Prédiction mois prochain: {formatPrice(revenuePrediction.predicted_next_month)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
          <Header title="IA Insights" showBack />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Chargement des insights IA...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="IA Insights" showBack />

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: '#E74C3C20', borderColor: '#E74C3C' }]}>
            <Ionicons name="alert-circle" size={20} color="#E74C3C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ScrollView
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={[colors.primary]} 
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* ✅ Période selector */}
          <View style={styles.periodContainer}>
            {periods.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.periodButton,
                  selectedPeriod === p.id && styles.periodButtonActive,
                  { 
                    backgroundColor: selectedPeriod === p.id ? colors.primary : themeColors.surface,
                  }
                ]}
                onPress={() => setSelectedPeriod(p.id)}
              >
                <Text style={[
                  styles.periodButtonText,
                  { 
                    color: selectedPeriod === p.id ? '#fff' : themeColors.text,
                    fontFamily: selectedPeriod === p.id ? typography.fontFamily.bold : typography.fontFamily.medium,
                  }
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ✅ Statistiques principales */}
          <View style={styles.insightsGrid}>
            <InsightCard
              icon="calendar-outline"
              label="Réservations"
              value={insights?.total_bookings || 0}
              color="#4A90D9"
              subtitle={`Période: ${selectedPeriod}`}
            />
            <InsightCard
              icon="stats-chart-outline"
              label="Taux complétion"
              value={`${insights?.completion_rate || 0}%`}
              color="#27AE60"
            />
            <InsightCard
              icon="cash-outline"
              label="Revenus"
              value={formatPrice(insights?.total_revenue || 0)}
              color="#F5A623"
            />
            <InsightCard
              icon="trending-up-outline"
              label="Panier moyen"
              value={formatPrice(insights?.average_booking_value || 0)}
              color="#9B59B6"
            />
          </View>

          {/* ✅ Graphique des revenus */}
          <RevenueChart />

          {/* ✅ Services populaires */}
          {popularServices.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                🔥 Services populaires
              </Text>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                Les massages les plus demandés par les clients
              </Text>
              {popularServices.map((item, index) => (
                <PopularServiceItem key={index} item={item} index={index} />
              ))}
            </View>
          )}

          {/* ✅ Meilleurs thérapeutes */}
          {bestTherapists.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                🏆 Meilleurs thérapeutes
              </Text>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                Classement basé sur les notes et avis des clients
              </Text>
              {bestTherapists.map((item, index) => (
                <BestTherapistItem key={index} item={item} index={index} />
              ))}
            </View>
          )}

          {/* ✅ Statistiques supplémentaires */}
          {revenuePrediction && (
            <View style={[styles.summaryContainer, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.summaryTitle, { color: themeColors.text }]}>
                📈 Résumé des prédictions
              </Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#27AE60' }]}>
                    {formatPrice(revenuePrediction.total_6_months || 0)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                    6 derniers mois
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#4A90D9' }]}>
                    {formatPrice(revenuePrediction.average_monthly || 0)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                    Moyenne mensuelle
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#F5A623' }]}>
                    {formatPrice(revenuePrediction.predicted_next_month || 0)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                    Prédiction mois prochain
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.footer} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: spacing.md, 
    fontSize: typography.fontSize.md 
  },
  
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: '#E74C3C',
    fontFamily: typography.fontFamily.medium,
  },
  
  periodContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  periodButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  periodButtonActive: {
    borderColor: colors.primary,
  },
  periodButtonText: {
    fontSize: typography.fontSize.sm,
  },
  
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  insightCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  insightValue: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  insightLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  insightSubtitle: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  
  chartContainer: {
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chartTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.md,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 180,
    paddingVertical: spacing.sm,
  },
  chartBarWrapper: {
    alignItems: 'center',
    width: '10%',
  },
  chartBarValue: {
    fontSize: 8,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 2,
  },
  chartBar: {
    width: 16,
    borderRadius: 4,
    minHeight: 10,
  },
  chartBarLabel: {
    fontSize: 9,
    fontFamily: typography.fontFamily.medium,
    marginTop: 4,
  },
  predictionContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  predictionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    gap: 6,
  },
  predictionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
  
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.sm,
  },
  
  popularItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    marginBottom: 2,
  },
  popularLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  popularRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  popularRankText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
  },
  popularInfo: {
    flex: 1,
  },
  popularName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  popularCount: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  popularBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    width: '100%',
  },
  popularFill: {
    height: 4,
    borderRadius: 2,
  },
  
  therapistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    marginBottom: 2,
  },
  therapistLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  therapistRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  therapistRankText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
  },
  therapistInfo: {
    flex: 1,
  },
  therapistName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  therapistTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  therapistTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  therapistTagText: {
    fontSize: 9,
    fontFamily: typography.fontFamily.medium,
  },
  therapistPrice: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  
  summaryContainer: {
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  
  footer: { height: 20 },
});

export default AIInsightsScreen;