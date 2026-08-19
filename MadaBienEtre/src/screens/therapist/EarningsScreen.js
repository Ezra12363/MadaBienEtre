// src/screens/therapist/EarningsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import axios from 'axios';
import { API_URL } from '../../config';

const EarningsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  // ✅ Ataovy azo antoka fa misy ny sanda rehetra
  const [earnings, setEarnings] = useState({
    total: 0,
    pending: 0,
    available: 0,
    today: 0,
    week: 0,
    month: 0,
    year: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('month');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const periods = [
    { id: 'day', label: 'Jour' },
    { id: 'week', label: 'Semaine' },
    { id: 'month', label: 'Mois' },
    { id: 'year', label: 'Année' },
  ];

  useEffect(() => {
    loadEarnings();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [period]);

  const loadEarnings = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/therapists/earnings`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { period },
      });
      // ✅ Ataovy azo antoka fa misy ny sanda rehetra
      const data = response.data || {};
      setEarnings({
        total: data.total || 0,
        pending: data.pending || 0,
        available: data.available || 0,
        today: data.today || 0,
        week: data.week || 0,
        month: data.month || 0,
        year: data.year || 0,
      });
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (error) {
      console.error('Error loading earnings:', error);
      // ✅ Données mockées
      setEarnings({
        total: 450000,
        pending: 120000,
        available: 330000,
        today: 45000,
        week: 180000,
        month: 450000,
        year: 1250000,
      });
      setTransactions([
        { id: 1, description: 'Massage Relaxant - Marie L.', amount: 35000, date: '2026-07-15', status: 'completed' },
        { id: 2, description: 'Massage Thérapeutique - Jean R.', amount: 45000, date: '2026-07-14', status: 'completed' },
        { id: 3, description: 'Massage Sportif - Sarah M.', amount: 50000, date: '2026-07-13', status: 'pending' },
        { id: 4, description: 'Massage Relaxant - Pierre D.', amount: 35000, date: '2026-07-12', status: 'completed' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEarnings();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    return status === 'completed' ? '#4CAF50' : '#FFC107';
  };

  const getStatusLabel = (status) => {
    return status === 'completed' ? '✅ Reçu' : '⏳ En attente';
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Mes gains" showBack />

        <Animated.ScrollView
          style={[styles.scrollView, { opacity: fadeAnim }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Résumé des gains */}
          <Animatable.View animation="fadeInDown" duration={600}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight || colors.primary]}
              style={styles.totalCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.totalLabel}>Gain total</Text>
              <Text style={styles.totalAmount}>
                {earnings.total ? earnings.total.toLocaleString() : '0'} Ar
              </Text>
              <View style={styles.totalDetails}>
                <View style={styles.totalDetail}>
                  <Text style={styles.totalDetailValue}>
                    {earnings.available ? earnings.available.toLocaleString() : '0'} Ar
                  </Text>
                  <Text style={styles.totalDetailLabel}>Disponible</Text>
                </View>
                <View style={styles.totalDivider} />
                <View style={styles.totalDetail}>
                  <Text style={[styles.totalDetailValue, { color: '#FFC107' }]}>
                    {earnings.pending ? earnings.pending.toLocaleString() : '0'} Ar
                  </Text>
                  <Text style={styles.totalDetailLabel}>En attente</Text>
                </View>
              </View>
            </LinearGradient>
          </Animatable.View>

          {/* Périodes */}
          <View style={styles.periodsContainer}>
            {periods.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.periodButton,
                  period === p.id && styles.periodButtonActive,
                  { backgroundColor: themeColors.surface }
                ]}
                onPress={() => setPeriod(p.id)}
              >
                <Text style={[
                  styles.periodText,
                  period === p.id && styles.periodTextActive,
                  { color: period === p.id ? '#fff' : themeColors.text }
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Gains par période */}
          <Animatable.View animation="fadeInUp" delay={200} duration={600}>
            <View style={[styles.periodEarnings, { backgroundColor: themeColors.surface }]}>
              <View style={styles.periodEarningsRow}>
                <View style={styles.periodEarningsItem}>
                  <Text style={[styles.periodEarningsLabel, { color: themeColors.textSecondary }]}>
                    Aujourd'hui
                  </Text>
                  <Text style={[styles.periodEarningsValue, { color: themeColors.text }]}>
                    {earnings.today ? earnings.today.toLocaleString() : '0'} Ar
                  </Text>
                </View>
                <View style={styles.periodEarningsItem}>
                  <Text style={[styles.periodEarningsLabel, { color: themeColors.textSecondary }]}>
                    Cette semaine
                  </Text>
                  <Text style={[styles.periodEarningsValue, { color: themeColors.text }]}>
                    {earnings.week ? earnings.week.toLocaleString() : '0'} Ar
                  </Text>
                </View>
              </View>
              <View style={styles.periodEarningsRow}>
                <View style={styles.periodEarningsItem}>
                  <Text style={[styles.periodEarningsLabel, { color: themeColors.textSecondary }]}>
                    Ce mois
                  </Text>
                  <Text style={[styles.periodEarningsValue, { color: colors.primary }]}>
                    {earnings.month ? earnings.month.toLocaleString() : '0'} Ar
                  </Text>
                </View>
                <View style={styles.periodEarningsItem}>
                  <Text style={[styles.periodEarningsLabel, { color: themeColors.textSecondary }]}>
                    Cette année
                  </Text>
                  <Text style={[styles.periodEarningsValue, { color: themeColors.text }]}>
                    {earnings.year ? earnings.year.toLocaleString() : '0'} Ar
                  </Text>
                </View>
              </View>
            </View>
          </Animatable.View>

          {/* Bouton retrait */}
          <Animatable.View animation="fadeInUp" delay={400} duration={600}>
            <TouchableOpacity
              style={styles.withdrawButton}
              onPress={() => navigation.navigate('Withdraw')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryLight || colors.primary]}
                style={styles.withdrawGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="arrow-up-outline" size={20} color="#fff" />
                <Text style={styles.withdrawText}>Retirer de l'argent</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>

          {/* Historique des transactions */}
          <Animatable.View animation="fadeInUp" delay={600} duration={600}>
            <View style={styles.transactionsHeader}>
              <Text style={[styles.transactionsTitle, { color: themeColors.text }]}>
                Historique des transactions
              </Text>
            </View>

            {transactions.length > 0 ? (
              transactions.map((item) => (
                <View
                  key={item.id}
                  style={[styles.transactionItem, { backgroundColor: themeColors.surface }]}
                >
                  <View style={styles.transactionLeft}>
                    <View style={[styles.transactionIcon, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                      <Ionicons 
                        name={item.status === 'completed' ? 'checkmark' : 'time-outline'} 
                        size={20} 
                        color={getStatusColor(item.status)} 
                      />
                    </View>
                    <View>
                      <Text style={[styles.transactionDescription, { color: themeColors.text }]}>
                        {item.description}
                      </Text>
                      <Text style={[styles.transactionDate, { color: themeColors.textSecondary }]}>
                        {item.date}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={[
                      styles.transactionAmount,
                      { color: getStatusColor(item.status) }
                    ]}>
                      +{item.amount ? item.amount.toLocaleString() : '0'} Ar
                    </Text>
                    <Text style={[styles.transactionStatus, { color: getStatusColor(item.status) }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color={themeColors.textSecondary} />
                <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                  Aucune transaction pour le moment
                </Text>
              </View>
            )}
          </Animatable.View>
        </Animated.ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  totalCard: {
    borderRadius: 20,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  totalAmount: {
    color: '#fff',
    fontSize: typography.fontSize.xxxl,
    fontFamily: typography.fontFamily.bold,
    marginVertical: spacing.xs,
  },
  totalDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  totalDetail: {
    alignItems: 'center',
  },
  totalDetailValue: {
    color: '#fff',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  totalDetailLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  totalDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  periodsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  periodTextActive: {
    color: '#fff',
  },
  periodEarnings: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  periodEarningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  },
  periodEarningsItem: {
    alignItems: 'center',
  },
  periodEarningsLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  periodEarningsValue: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  withdrawButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  withdrawGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  withdrawText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  transactionsTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDescription: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  transactionDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  transactionStatus: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.sm,
  },
});

export default EarningsScreen;