// src/screens/admin/AnalyticsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';

const { width } = Dimensions.get('window');

const AnalyticsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [])
  );

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [statistics, revenue] = await Promise.all([
        adminService.getAdminStatistics().catch(() => null),
        adminService.getRevenueStats().catch(() => null)
      ]);
      setStats(statistics);
      setRevenueData(revenue);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setStats({
        period: 'month',
        new_users: 35,
        new_bookings: 89,
        revenue: 3200000,
        reviews: 45,
        average_rating: 4.7,
        completion_rate: 68.5
      });
      setRevenueData({
        total_revenue: 12500000,
        by_payment_method: [
          { method: 'mobile_money', count: 45, total: 4500000 },
          { method: 'card', count: 30, total: 5000000 },
          { method: 'vanila_pay', count: 15, total: 3000000 }
        ],
        monthly: [
          { month: 'Jan', revenue: 800000 },
          { month: 'Fév', revenue: 950000 },
          { month: 'Mar', revenue: 1100000 },
          { month: 'Avr', revenue: 1000000 },
          { month: 'Mai', revenue: 1200000 },
          { month: 'Juin', revenue: 1300000 }
        ]
      });
    } finally {
      setLoading(false);
    }
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
      <Text style={[styles.statValue, { color: themeColors.text }]}>
        {typeof value === 'number' ? value.toLocaleString() : value}
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Analyses" showBack />
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.statsGrid}>
            <StatCard icon="people-outline" label="Nouveaux utilisateurs" value={stats?.new_users || 0} color="#4A90D9" />
            <StatCard icon="calendar-outline" label="Nouvelles réservations" value={stats?.new_bookings || 0} color="#F5A623" />
            <StatCard icon="cash-outline" label="Revenus" value={(stats?.revenue || 0).toLocaleString()} color="#27AE60" />
            <StatCard icon="star-outline" label="Note moyenne" value={`⭐ ${stats?.average_rating || 0}`} color="#9B59B6" />
          </View>

          <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Taux de complétion</Text>
            <View style={styles.completionContainer}>
              <Text style={[styles.completionValue, { color: colors.primary }]}>
                {stats?.completion_rate || 0}%
              </Text>
              <View style={[styles.completionBar, { backgroundColor: themeColors.border || '#E0E0E0' }]}>
                <View style={[styles.completionFill, { width: `${stats?.completion_rate || 0}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.completionLabel, { color: themeColors.textSecondary }]}>
                Taux de complétion des réservations
              </Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Revenus mensuels</Text>
            <View style={styles.monthlyGrid}>
              {revenueData?.monthly?.map((item, index) => (
                <View key={index} style={styles.monthlyItem}>
                  <View style={[styles.monthlyBar, { height: Math.max((item.revenue / 1500000) * 100, 10), backgroundColor: colors.primary }]} />
                  <Text style={[styles.monthlyLabel, { color: themeColors.textSecondary }]}>{item.month}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Paiements par méthode</Text>
            {revenueData?.by_payment_method?.map((item, index) => (
              <View key={index} style={styles.methodRow}>
                <Text style={[styles.methodLabel, { color: themeColors.text }]}>{item.method}</Text>
                <View style={[styles.methodBar, { backgroundColor: themeColors.border || '#E0E0E0' }]}>
                  <View style={[styles.methodFill, { width: `${(item.total / (revenueData?.total_revenue || 1)) * 100}%`, backgroundColor: ['#4A90D9', '#27AE60', '#F5A623', '#E74C3C', '#9B59B6'][index % 5] }]} />
                </View>
                <Text style={[styles.methodValue, { color: themeColors.textSecondary }]}>
                  {(item.total || 0).toLocaleString()} Ar
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.footer} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
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