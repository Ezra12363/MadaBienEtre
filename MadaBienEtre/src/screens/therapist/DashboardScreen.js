// src/screens/therapist/DashboardScreen.js
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
  Dimensions,
  Platform,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { colors, spacing, typography } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// ✅ Import conditionnel ho an'ny LineChart (tsy ampiasaina amin'ny Web)
let LineChart = null;
if (Platform.OS !== 'web') {
  try {
    const ChartKit = require('react-native-chart-kit');
    LineChart = ChartKit.LineChart;
  } catch (e) {
    console.warn('react-native-chart-kit not available');
  }
}

const DashboardScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { user, token } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    todayBookings: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    totalBookings: 0,
    rating: 0,
    reviews: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStats({
        todayBookings: 3,
        totalEarnings: 450000,
        pendingEarnings: 120000,
        totalBookings: 42,
        rating: 4.8,
        reviews: 28,
      });
      setRecentActivities([
        { id: 1, type: 'booking', message: 'Nouvelle réservation de Marie L.', time: '10:30' },
        { id: 2, type: 'payment', message: 'Paiement reçu de Jean R. - 45 000 Ar', time: '09:15' },
        { id: 3, type: 'review', message: 'Nouvel avis 5⭐ de Sarah M.', time: 'Hier' },
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const toggleOnlineStatus = async () => {
    setIsOnline(!isOnline);
  };

  const quickActions = [
    { 
      id: 'requests', 
      icon: 'list-outline', 
      label: 'Demandes',
      color: colors.primary,
      onPress: () => navigation.navigate('Requests'),
    },
    { 
      id: 'calendar', 
      icon: 'calendar-outline', 
      label: 'Calendrier',
      color: colors.secondary || '#FF6B6B',
      onPress: () => navigation.navigate('Calendar'),
    },
    { 
      id: 'earnings', 
      icon: 'wallet-outline', 
      label: 'Gains',
      color: colors.accent || '#FF9800',
      onPress: () => navigation.navigate('Earnings'),
    },
    { 
      id: 'sos', 
      icon: 'alert-circle', 
      label: 'SOS',
      color: colors.error || '#FF0000',
      onPress: () => navigation.navigate('SOS'),
    },
  ];

  const renderQuickAction = ({ item }) => (
    <TouchableOpacity
      style={[styles.quickAction, { backgroundColor: themeColors.surface }]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: item.color + '30' }]}>
        <Ionicons name={item.icon} size={24} color={item.color} />
      </View>
      <Text style={[styles.quickActionLabel, { color: themeColors.text }]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  // ✅ Fanitsiana ny renderActivity
  const renderActivity = ({ item }) => (
    <View key={item.id} style={[styles.activityItem, { borderBottomColor: themeColors.border || '#E0E0E0' }]}>
      <View style={styles.activityIcon}>
        {item.type === 'booking' && <Ionicons name="calendar" size={20} color={colors.primary} />}
        {item.type === 'payment' && <Ionicons name="cash" size={20} color="#4CAF50" />}
        {item.type === 'review' && <Ionicons name="star" size={20} color="#FFD700" />}
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityText, { color: themeColors.text }]}>
          {item.message}
        </Text>
        <Text style={[styles.activityTime, { color: themeColors.textSecondary }]}>
          {item.time}
        </Text>
      </View>
    </View>
  );

  // ✅ ChartComponent ho an'ny Web sy Mobile
  const ChartComponent = () => {
    const chartData = {
      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      datasets: [{ data: [20000, 35000, 28000, 45000, 38000, 50000, 42000] }],
    };

    if (Platform.OS === 'web') {
      const maxValue = Math.max(...chartData.datasets[0].data);
      const barColors = ['#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#4CAF50', '#66BB6A', '#81C784'];

      return (
        <View style={styles.webChartContainer}>
          <View style={styles.webChartLabels}>
            {chartData.labels.map((label, index) => (
              <Text key={index} style={[styles.webChartLabel, { color: themeColors.textSecondary }]}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.webChartBars}>
            {chartData.datasets[0].data.map((value, index) => {
              const height = (value / maxValue) * 120;
              return (
                <View key={index} style={styles.webChartBarWrapper}>
                  <View 
                    style={[
                      styles.webChartBar,
                      { 
                        height: height,
                        backgroundColor: barColors[index] || colors.primary,
                      }
                    ]} 
                  />
                  <Text style={[styles.webChartValue, { color: themeColors.text }]}>
                    {(value / 1000).toFixed(0)}k
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    if (LineChart) {
      return (
        <LineChart
          data={chartData}
          width={width - 48}
          height={180}
          chartConfig={{
            backgroundColor: themeColors.surface,
            backgroundGradientFrom: themeColors.surface,
            backgroundGradientTo: themeColors.surface,
            decimalPlaces: 0,
            color: (opacity = 1) => colors.primary + Math.min(opacity, 1).toString(),
            labelColor: (opacity = 1) => {
              const color = themeColors.textSecondary || '#666';
              return color;
            },
            style: { borderRadius: 16 },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: colors.primary,
            },
          }}
          bezier
          style={styles.chart}
          formatYLabel={(value) => `${(value / 1000).toFixed(0)}k`}
        />
      );
    }

    return (
      <View style={styles.chartFallback}>
        <Text style={[styles.chartFallbackText, { color: themeColors.textSecondary }]}>
          Graphique non disponible
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement du tableau de bord...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Header personnalisé */}
        <View style={[styles.headerWrapper, { backgroundColor: themeColors.surface }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.navigate('Profil')}>
                <Ionicons name="menu" size={28} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: colors.primary }]}>
                Mada Bien-être
              </Text>
              <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
                Thérapeute
              </Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                onPress={() => navigation.navigate('Notifications')}
                style={styles.notificationButton}
              >
                <Ionicons name="notifications-outline" size={24} color={themeColors.text} />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          {/* Carte de statut */}
          <Animatable.View animation="fadeInDown" duration={800}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight || colors.primary]}
              style={styles.statusCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.statusContent}>
                <View>
                  <Text style={styles.statusGreeting}>Bonjour 👋</Text>
                  <Text style={styles.statusName}>{user?.fullname || 'Thérapeute'}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.statusToggle, { backgroundColor: isOnline ? '#4CAF50' : '#999' }]}
                  onPress={toggleOnlineStatus}
                >
                  <View style={[styles.statusDot, { backgroundColor: '#fff' }]} />
                  <Text style={styles.statusToggleText}>
                    {isOnline ? 'En ligne' : 'Hors ligne'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.statusStats}>
                <View style={styles.statusStat}>
                  <Text style={styles.statusStatNumber}>{stats.todayBookings}</Text>
                  <Text style={styles.statusStatLabel}>Aujourd'hui</Text>
                </View>
                <View style={styles.statusDivider} />
                <View style={styles.statusStat}>
                  <Text style={styles.statusStatNumber}>{stats.totalBookings}</Text>
                  <Text style={styles.statusStatLabel}>Total réservations</Text>
                </View>
                <View style={styles.statusDivider} />
                <View style={styles.statusStat}>
                  <Text style={styles.statusStatNumber}>{stats.rating}</Text>
                  <Text style={styles.statusStatLabel}>Note ⭐</Text>
                </View>
              </View>
            </LinearGradient>
          </Animatable.View>

          {/* Actions rapides */}
          <Animatable.View animation="fadeInUp" delay={200} duration={800}>
            <View style={styles.quickActionsContainer}>
              <FlatList
                data={quickActions}
                renderItem={renderQuickAction}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickActionsList}
              />
            </View>
          </Animatable.View>

          {/* Gains */}
          <Animatable.View animation="fadeInUp" delay={400} duration={800}>
            <View style={[styles.earningsCard, { backgroundColor: themeColors.surface }]}>
              <View style={styles.earningsHeader}>
                <Text style={[styles.earningsTitle, { color: themeColors.text }]}>
                  Gains
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Earnings')}>
                  <Text style={styles.earningsSeeAll}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.earningsGrid}>
                <View style={styles.earningsItem}>
                  <Text style={[styles.earningsLabel, { color: themeColors.textSecondary }]}>
                    Total
                  </Text>
                  <Text style={[styles.earningsValue, { color: colors.primary }]}>
                    {stats.totalEarnings.toLocaleString()} Ar
                  </Text>
                </View>
                <View style={styles.earningsItem}>
                  <Text style={[styles.earningsLabel, { color: themeColors.textSecondary }]}>
                    En attente
                  </Text>
                  <Text style={[styles.earningsValue, { color: colors.secondary || '#FF6B6B' }]}>
                    {stats.pendingEarnings.toLocaleString()} Ar
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.withdrawButton}
                onPress={() => navigation.navigate('Withdraw')}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryLight || colors.primary]}
                  style={styles.withdrawGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                  <Text style={styles.withdrawText}>Retirer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animatable.View>

          {/* Graphique des revenus */}
          <Animatable.View animation="fadeInUp" delay={600} duration={800}>
            <View style={[styles.chartCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.chartTitle, { color: themeColors.text }]}>
                Revenus des 7 derniers jours
              </Text>
              <ChartComponent />
            </View>
          </Animatable.View>

          {/* Activités récentes */}
          <Animatable.View animation="fadeInUp" delay={800} duration={800}>
            <View style={[styles.activitiesCard, { backgroundColor: themeColors.surface }]}>
              <View style={styles.activitiesHeader}>
                <Text style={[styles.activitiesTitle, { color: themeColors.text }]}>
                  Activités récentes
                </Text>
                <TouchableOpacity>
                  <Text style={styles.activitiesSeeAll}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              {recentActivities.map((item) => renderActivity({ item }))}
            </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  headerWrapper: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error || '#FF0000',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    paddingHorizontal: 4,
  },
  statusCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  statusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusGreeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  statusName: {
    color: '#fff',
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusToggleText: {
    color: '#fff',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
  statusStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  statusStat: {
    alignItems: 'center',
  },
  statusStatNumber: {
    color: '#fff',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  statusStatLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  statusDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  quickActionsContainer: {
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  quickActionsList: {
    paddingHorizontal: spacing.xs,
  },
  quickAction: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    marginRight: spacing.md,
    minWidth: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
  earningsCard: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  earningsTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  earningsSeeAll: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  earningsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  earningsItem: {
    flex: 1,
  },
  earningsLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  earningsValue: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
  },
  withdrawButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
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
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  withdrawText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  chartCard: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.sm,
  },
  chart: {
    marginVertical: spacing.xs,
    borderRadius: 16,
  },
  webChartContainer: {
    paddingVertical: spacing.md,
  },
  webChartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  webChartLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
    width: 30,
  },
  webChartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
  },
  webChartBarWrapper: {
    alignItems: 'center',
    width: 30,
  },
  webChartBar: {
    width: 24,
    borderRadius: 4,
    minHeight: 4,
  },
  webChartValue: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
    marginTop: 4,
  },
  chartFallback: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartFallbackText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  activitiesCard: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activitiesTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  activitiesSeeAll: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  activityTime: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
});

export default DashboardScreen;