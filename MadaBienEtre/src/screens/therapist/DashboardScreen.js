// src/screens/therapist/DashboardScreen.js

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Animated,
  Dimensions,
  Platform,
  useWindowDimensions,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

import Header from '../../components/common/Header';
import { useTopNavLayout } from '../../components/common/AppNavigation';

import {
  colors,
} from '../../theme';


// ============================================================
// THÈME DU HEADER (hook local — indépendant de Header.js)
// - Web grand écran (>= 850px) : fond blanc, icônes vertes.
// - Web petit écran, Android, iOS : fond vert, icônes blanches.
// Mêmes couleurs et même seuil que components/common/Header.js
// ============================================================

const HEADER_WEB_LARGE_BREAKPOINT = 850;
const HEADER_GREEN = '#168A55';
const HEADER_GREEN_DARK = '#0B633C';

const useHeaderTheme = () => {
  const { width } = useWindowDimensions();

  const isLargeWebScreen =
    Platform.OS === 'web' &&
    width >= HEADER_WEB_LARGE_BREAKPOINT;

  return useMemo(
    () =>
      isLargeWebScreen
        ? {
            isLargeWebScreen: true,
            headerBg: '#FFFFFF',
            iconColor: HEADER_GREEN_DARK,
            backButtonBg: 'rgba(11,99,60,0.08)',
            backButtonBorder: 'rgba(11,99,60,0.18)',
          }
        : {
            isLargeWebScreen: false,
            headerBg: HEADER_GREEN,
            iconColor: '#FFFFFF',
            backButtonBg: 'rgba(255,255,255,0.18)',
            backButtonBorder: 'rgba(255,255,255,0.32)',
          },
    [isLargeWebScreen]
  );
};

// ============================================================
// CONSTANTES
// ============================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEFAULT_GREEN = '#168A55';
const _DARK_GREEN = '#0E6B43';
const _LIGHT_GREEN = '#EAF7F0';
const _SOFT_GREEN = '#F3FAF6';

const GOLD = '#F59E0B';
const RED = '#E45858';
const BLUE = '#3B82F6';


// ============================================================
// CHART
// ============================================================

let LineChart = null;

if (Platform.OS !== 'web') {
  try {
    const ChartKit = require('react-native-chart-kit');
    LineChart = ChartKit.LineChart;
  } catch (_error) {
    console.warn('react-native-chart-kit non disponible');
  }
}


// ============================================================
// HELPERS
// ============================================================

const safeColor = (value, fallback) => {
  return typeof value === 'string' && value.length > 0
    ? value
    : fallback;
};

const hexToRgba = (hex, alpha = 0.12) => {
  if (
    typeof hex !== 'string' ||
    !hex.startsWith('#')
  ) {
    return `rgba(22, 138, 85, ${alpha})`;
  }

  let clean = hex.replace('#', '');

  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (clean.length !== 6) {
    return `rgba(22, 138, 85, ${alpha})`;
  }

  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  if (
    Number.isNaN(r) ||
    Number.isNaN(g) ||
    Number.isNaN(b)
  ) {
    return `rgba(22, 138, 85, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatPrice = (value) => {
  const number = Number(value || 0);

  return `${number.toLocaleString('fr-FR')} Ar`;
};


// ============================================================
// SCREEN
// ============================================================

const DashboardScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  // Web large : TopNavBar (AppNavigation.js) affiche déjà le profil,
  // les notifications et les messages tout en haut — on ne les
  // duplique pas ici. Android / iOS : jamais concerné (isMerged est
  // toujours false hors web), donc RIEN ne change pour eux.
  const { isMerged } = useTopNavLayout();

  // Thème du header (fond blanc + icônes vertes sur grand écran web,
  // fond vert + icônes blanches sur petit écran / Android / iOS).
  const headerTheme = useHeaderTheme();

  // ==========================================================
  // COULEURS
  // ==========================================================

  const primaryColor = safeColor(
    colors?.primary,
    DEFAULT_GREEN
  );

  const primaryLight = safeColor(
    colors?.primaryLight,
    '#43B581'
  );

  const backgroundColor = safeColor(
    themeColors?.background,
    '#F5F8F6'
  );

  const surfaceColor = safeColor(
    themeColors?.surface,
    '#FFFFFF'
  );

  const textColor = safeColor(
    themeColors?.text,
    '#17221B'
  );

  const secondaryTextColor = safeColor(
    themeColors?.textSecondary,
    '#718078'
  );

  const borderColor = safeColor(
    themeColors?.border,
    '#E2EBE5'
  );

  const _isDark =
    backgroundColor.toLowerCase() === '#121212' ||
    backgroundColor.toLowerCase() === '#000000';

  // ==========================================================
  // STATES
  // ==========================================================

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const [stats, setStats] = useState({
    todayBookings: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    totalBookings: 0,
    rating: 0,
    reviews: 0,
  });

  const [recentActivities, setRecentActivities] = useState([]);

  const scrollY = useRef(new Animated.Value(0)).current;

  // ==========================================================
  // CHARGEMENT DES DONNÉES
  // ==========================================================

  /*
   * isRefresh = true  -> appel déclenché par le pull-to-refresh
   *                      (RefreshControl) : on NE touche PAS à
   *                      isLoading, donc l'écran plein écran avec
   *                      le logo (voir plus bas) ne se réaffiche
   *                      pas ; seul le spinner natif du
   *                      RefreshControl tourne, sans logo.
   * isRefresh = false -> chargement initial (premier montage) :
   *                      isLoading passe à true, ce qui affiche
   *                      l'écran logo + spinner ci-dessous.
   */
  const loadDashboardData = useCallback(async (options = {}) => {
    const { isRefresh = false } = options;

    if (!isRefresh) {
      setIsLoading(true);
    }

    try {
      await new Promise((resolve) => {
        setTimeout(resolve, 400);
      });

      /*
       * Ces données peuvent ensuite être remplacées
       * par les vraies données de ton API.
       */
      setStats({
        todayBookings: 3,
        totalEarnings: 450000,
        pendingEarnings: 120000,
        totalBookings: 42,
        rating: 4.8,
        reviews: 28,
      });

      setRecentActivities([
        {
          id: 1,
          type: 'booking',
          message: 'Nouvelle réservation de Marie L.',
          time: '10:30',
        },
        {
          id: 2,
          type: 'payment',
          message: 'Paiement reçu de Jean R. - 45 000 Ar',
          time: '09:15',
        },
        {
          id: 3,
          type: 'review',
          message: 'Nouvel avis 5 étoiles de Sarah M.',
          time: 'Hier',
        },
      ]);
    } catch (error) {
      console.error('Erreur dashboard :', error);
    } finally {
      if (!isRefresh) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await loadDashboardData({ isRefresh: true });
    } finally {
      setRefreshing(false);
    }
  };

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const openNotifications = useCallback(() => {
    navigation.navigate('TherapistNotifications');
  }, [navigation]);

  const openProfile = useCallback(() => {
    navigation.navigate('Profil');
  }, [navigation]);

  const openDemandes = useCallback(() => {
    navigation.navigate('Demandes');
  }, [navigation]);

  const openCalendar = useCallback(() => {
    navigation.navigate('Calendrier');
  }, [navigation]);

  const openEarnings = useCallback(() => {
    navigation.navigate('Gains');
  }, [navigation]);

  // ==========================================================
  // STATUT EN LIGNE
  // ==========================================================

  const toggleOnlineStatus = () => {
    setIsOnline((current) => !current);
  };

  // ==========================================================
  // ACTIONS RAPIDES
  // ==========================================================

  const quickActions = [
    {
      id: 'requests',
      icon: 'chatbubbles-outline',
      label: 'Demandes',
      description: 'Réservations',
      color: primaryColor,
      onPress: openDemandes,
    },
    {
      id: 'calendar',
      icon: 'calendar-outline',
      label: 'Calendrier',
      description: 'Mes rendez-vous',
      color: BLUE,
      onPress: openCalendar,
    },
    {
      id: 'earnings',
      icon: 'wallet-outline',
      label: 'Gains',
      description: 'Mes revenus',
      color: GOLD,
      onPress: openEarnings,
    },
    {
      id: 'sos',
      icon: 'headset-outline',
      label: 'Assistance',
      description: 'Besoin d’aide',
      color: RED,
      onPress: () => {
        Alert.alert(
          'Assistance',
          "La fonctionnalité d'assistance sera bientôt disponible."
        );
      },
    },
  ];

  // ==========================================================
  // RENDER ACTION RAPIDE
  // ==========================================================

  const renderQuickAction = ({ item }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={item.onPress}
        style={[
          styles.quickAction,
          Platform.OS === 'web' && styles.quickActionWeb,
          {
            backgroundColor: surfaceColor,
            borderColor,
          },
        ]}
      >
        <View
          style={[
            styles.quickActionIconWrapper,
            {
              backgroundColor: hexToRgba(item.color, 0.11),
            },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={24}
            color={item.color}
          />
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.quickActionLabel,
            {
              color: textColor,
            },
          ]}
        >
          {item.label}
        </Text>

        <Text
          numberOfLines={1}
          style={[
            styles.quickActionDescription,
            {
              color: secondaryTextColor,
            },
          ]}
        >
          {item.description}
        </Text>

        <View
          style={[
            styles.quickActionArrow,
            {
              backgroundColor: hexToRgba(item.color, 0.08),
            },
          ]}
        >
          <Ionicons
            name="arrow-forward"
            size={13}
            color={item.color}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // ==========================================================
  // ICONES ACTIVITÉS
  // ==========================================================

  const getActivityIcon = (type) => {
    if (type === 'booking') {
      return {
        name: 'calendar-outline',
        color: primaryColor,
      };
    }

    if (type === 'payment') {
      return {
        name: 'cash-outline',
        color: '#22A06B',
      };
    }

    if (type === 'review') {
      return {
        name: 'star-outline',
        color: GOLD,
      };
    }

    return {
      name: 'notifications-outline',
      color: primaryColor,
    };
  };

  // ==========================================================
  // ACTIVITÉ
  // ==========================================================

  const renderActivity = ({ item, index }) => {
    const activity = getActivityIcon(item.type);

    return (
      <View
        key={item.id ?? index}
        style={[
          styles.activityItem,
          {
            borderBottomColor:
              index === recentActivities.length - 1
                ? 'transparent'
                : borderColor,
          },
        ]}
      >
        <View
          style={[
            styles.activityIconWrapper,
            {
              backgroundColor: hexToRgba(
                activity.color,
                0.1
              ),
            },
          ]}
        >
          <Ionicons
            name={activity.name}
            size={19}
            color={activity.color}
          />
        </View>

        <View style={styles.activityContent}>
          <Text
            numberOfLines={2}
            style={[
              styles.activityText,
              {
                color: textColor,
              },
            ]}
          >
            {item.message}
          </Text>

          <View style={styles.activityTimeRow}>
            <Ionicons
              name="time-outline"
              size={12}
              color={secondaryTextColor}
            />

            <Text
              style={[
                styles.activityTime,
                {
                  color: secondaryTextColor,
                },
              ]}
            >
              {item.time}
            </Text>
          </View>
        </View>

        {index === 0 && (
          <View
            style={[
              styles.newActivityBadge,
              {
                backgroundColor: hexToRgba(
                  primaryColor,
                  0.1
                ),
              },
            ]}
          >
            <Text
              style={[
                styles.newActivityText,
                {
                  color: primaryColor,
                },
              ]}
            >
              Nouveau
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ==========================================================
  // GRAPHIQUE
  // ==========================================================

  const ChartComponent = () => {
    const chartData = {
      labels: [
        'Lun',
        'Mar',
        'Mer',
        'Jeu',
        'Ven',
        'Sam',
        'Dim',
      ],
      datasets: [
        {
          data: [
            20000,
            35000,
            28000,
            45000,
            38000,
            50000,
            42000,
          ],
        },
      ],
    };

    if (Platform.OS === 'web') {
      const maxValue = Math.max(
        ...chartData.datasets[0].data
      );

      return (
        <View style={styles.webChartContainer}>
          <View style={styles.webChartBars}>
            {chartData.datasets[0].data.map(
              (value, index) => {
                const height =
                  maxValue > 0
                    ? (value / maxValue) * 130
                    : 0;

                return (
                  <View
                    key={index}
                    style={styles.webChartBarWrapper}
                  >
                    <Text
                      style={[
                        styles.webChartValue,
                        {
                          color: secondaryTextColor,
                        },
                      ]}
                    >
                      {(value / 1000).toFixed(0)}k
                    </Text>

                    <View
                      style={[
                        styles.webChartBar,
                        {
                          height: Math.max(height, 7),
                          backgroundColor: primaryColor,
                        },
                      ]}
                    />
                  </View>
                );
              }
            )}
          </View>

          <View style={styles.webChartLabels}>
            {chartData.labels.map((label, index) => (
              <Text
                key={index}
                style={[
                  styles.webChartLabel,
                  {
                    color: secondaryTextColor,
                  },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
        </View>
      );
    }

    if (LineChart) {
      return (
        <LineChart
          data={chartData}
          width={Math.min(SCREEN_WIDTH - 46, 560)}
          height={185}
          chartConfig={{
            backgroundColor: surfaceColor,
            backgroundGradientFrom: surfaceColor,
            backgroundGradientTo: surfaceColor,
            decimalPlaces: 0,
            color: () => primaryColor,
            labelColor: () => secondaryTextColor,
            propsForDots: {
              r: '5',
              strokeWidth: '2',
              stroke: primaryColor,
            },
            propsForBackgroundLines: {
              stroke: borderColor,
              strokeDasharray: '',
            },
          }}
          bezier
          withInnerLines
          withOuterLines={false}
          style={styles.chart}
          formatYLabel={(value) =>
            `${(Number(value) / 1000).toFixed(0)}k`
          }
        />
      );
    }

    return (
      <View style={styles.chartFallback}>
        <Ionicons
          name="bar-chart-outline"
          size={34}
          color={secondaryTextColor}
        />

        <Text
          style={[
            styles.chartFallbackText,
            {
              color: secondaryTextColor,
            },
          ]}
        >
          Graphique non disponible
        </Text>
      </View>
    );
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor,
          },
        ]}
      >
        <Text
          style={[
            styles.loadingText,
            {
              color: secondaryTextColor,
            },
          ]}
        >
          Préparation de votre espace...
        </Text>
      </View>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor,
          },
        ]}
      >
        {/* ==================================================
            HEADER (composant partagé : components/common/Header.js)
            - gauche  : bouton profil
            - centre  : titre + sous-titre
            - droite  : bouton notifications (badge non lues)
        ================================================== */}

        <Header
          title="Mada Bien-être"
          subtitle="Espace thérapeute"
          leftComponent={
            isMerged ? null : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openProfile}
                style={[
                  styles.headerButtonCircle,
                  {
                    backgroundColor: headerTheme.backButtonBg,
                    borderColor: headerTheme.backButtonBorder,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le profil"
              >
                <Ionicons
                  name="person-outline"
                  size={21}
                  color={headerTheme.iconColor}
                />
              </TouchableOpacity>
            )
          }
          rightComponent={
            isMerged ? null : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openNotifications}
                style={[
                  styles.headerButtonCircle,
                  {
                    backgroundColor: headerTheme.backButtonBg,
                    borderColor: headerTheme.backButtonBorder,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les notifications"
              >
                <Ionicons
                  name={
                    unreadCount > 0
                      ? 'notifications'
                      : 'notifications-outline'
                  }
                  size={23}
                  color={headerTheme.iconColor}
                />

                {unreadCount > 0 && (
                  <View
                    style={[
                      styles.headerNotificationBadge,
                      { borderColor: headerTheme.headerBg },
                    ]}
                  >
                    <Text
                      style={styles.headerNotificationText}
                    >
                      {unreadCount > 99
                        ? '99+'
                        : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          }
        />

        {/* ==================================================
            CONTENU SCROLLABLE
        ================================================== */}

        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[primaryColor]}
              tintColor={primaryColor}
            />
          }
          onScroll={Animated.event(
            [
              {
                nativeEvent: {
                  contentOffset: {
                    y: scrollY,
                  },
                },
              },
            ],
            {
              // Le driver natif n'existe pas sur le web
              useNativeDriver: Platform.OS !== 'web',
            }
          )}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'web' &&
              styles.scrollContentWeb,
          ]}
        >
          {/* ==================================================
              CARTE D’ACCUEIL
          ================================================== */}

          <Animatable.View
            animation="fadeInDown"
            duration={550}
            style={styles.topSection}
          >
            <LinearGradient
              colors={[
                primaryColor,
                primaryLight,
                '#58B986',
              ]}
              start={{
                x: 0,
                y: 0,
              }}
              end={{
                x: 1,
                y: 1,
              }}
              style={styles.welcomeCard}
            >
              <View style={styles.welcomeDecorCircleOne} />
              <View style={styles.welcomeDecorCircleTwo} />

              <View style={styles.welcomeTopRow}>
                <View style={styles.welcomeIdentity}>
                  <Text style={styles.welcomeSmallText}>
                    Bonjour 👋
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={styles.welcomeName}
                  >
                    {user?.fullname ||
                      user?.full_name ||
                      user?.name ||
                      'Thérapeute'}
                  </Text>

                  <Text style={styles.welcomeDescription}>
                    Voici le résumé de votre activité
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={toggleOnlineStatus}
                  style={[
                    styles.onlineToggle,
                    {
                      backgroundColor: isOnline
                        ? 'rgba(255,255,255,0.22)'
                        : 'rgba(15,23,42,0.22)',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.onlineToggleDot,
                      {
                        backgroundColor: isOnline
                          ? '#B7F7D1'
                          : '#CBD5E1',
                      },
                    ]}
                  />

                  <Text style={styles.onlineToggleText}>
                    {isOnline
                      ? 'En ligne'
                      : 'Hors ligne'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.welcomeStatsRow}>
                <View style={styles.welcomeStat}>
                  <Text style={styles.welcomeStatValue}>
                    {stats.todayBookings}
                  </Text>

                  <Text style={styles.welcomeStatLabel}>
                    Aujourd’hui
                  </Text>
                </View>

                <View style={styles.welcomeStatDivider} />

                <View style={styles.welcomeStat}>
                  <Text style={styles.welcomeStatValue}>
                    {stats.totalBookings}
                  </Text>

                  <Text style={styles.welcomeStatLabel}>
                    Réservations
                  </Text>
                </View>

                <View style={styles.welcomeStatDivider} />

                <View style={styles.welcomeStat}>
                  <View style={styles.ratingValueRow}>
                    <Text style={styles.welcomeStatValue}>
                      {stats.rating}
                    </Text>

                    <Ionicons
                      name="star"
                      size={16}
                      color="#FFE08A"
                    />
                  </View>

                  <Text style={styles.welcomeStatLabel}>
                    Note moyenne
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Animatable.View>

          {/* ==================================================
              NOTIFICATION
          ================================================== */}

          {unreadCount > 0 && (
            <Animatable.View
              animation="fadeInUp"
              delay={100}
              duration={450}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openNotifications}
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: surfaceColor,
                    borderColor: hexToRgba(
                      primaryColor,
                      0.2
                    ),
                  },
                ]}
              >
                <View
                  style={[
                    styles.notificationCardIcon,
                    {
                      backgroundColor: hexToRgba(
                        primaryColor,
                        0.1
                      ),
                    },
                  ]}
                >
                  <Ionicons
                    name="notifications"
                    size={21}
                    color={primaryColor}
                  />
                </View>

                <View style={styles.notificationCardContent}>
                  <Text
                    style={[
                      styles.notificationCardTitle,
                      {
                        color: textColor,
                      },
                    ]}
                  >
                    {unreadCount} notification
                    {unreadCount > 1 ? 's' : ''} non lue
                    {unreadCount > 1 ? 's' : ''}
                  </Text>

                  <Text
                    style={[
                      styles.notificationCardSubtitle,
                      {
                        color: secondaryTextColor,
                      },
                    ]}
                  >
                    Consultez vos nouvelles demandes
                  </Text>
                </View>

                <View
                  style={[
                    styles.notificationCardArrow,
                    {
                      backgroundColor: hexToRgba(
                        primaryColor,
                        0.08
                      ),
                    },
                  ]}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={primaryColor}
                  />
                </View>
              </TouchableOpacity>
            </Animatable.View>
          )}

          {/* ==================================================
              ACCÈS RAPIDE
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={150}
            duration={500}
          >
            <View style={styles.sectionHeader}>
              <View>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: textColor,
                    },
                  ]}
                >
                  Accès rapide
                </Text>

                <Text
                  style={[
                    styles.sectionSubtitle,
                    {
                      color: secondaryTextColor,
                    },
                  ]}
                >
                  Gérez votre activité en quelques clics
                </Text>
              </View>

              <View
                style={[
                  styles.sectionAccent,
                  {
                    backgroundColor: primaryColor,
                  },
                ]}
              />
            </View>

            {Platform.OS === 'web' ? (
              <View style={styles.quickActionsGrid}>
                {quickActions.map((item) => (
                  <View
                    key={item.id}
                    style={styles.quickActionGridItem}
                  >
                    {renderQuickAction({ item })}
                  </View>
                ))}
              </View>
            ) : (
              <FlatList
                data={quickActions}
                renderItem={renderQuickAction}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={
                  styles.quickActionsList
                }
              />
            )}
          </Animatable.View>

          {/* ==================================================
              GAINS
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={250}
            duration={500}
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: surfaceColor,
                  borderColor,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: textColor,
                      },
                    ]}
                  >
                    Mes gains
                  </Text>

                  <Text
                    style={[
                      styles.cardSubtitle,
                      {
                        color: secondaryTextColor,
                      },
                    ]}
                  >
                    Résumé financier
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={openEarnings}
                  style={styles.seeAllButton}
                >
                  <Text
                    style={[
                      styles.seeAllText,
                      {
                        color: primaryColor,
                      },
                    ]}
                  >
                    Voir tout
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={15}
                    color={primaryColor}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.earningsGrid}>
                <View
                  style={[
                    styles.earningBox,
                    {
                      backgroundColor: hexToRgba(
                        primaryColor,
                        0.07
                      ),
                      borderColor: hexToRgba(
                        primaryColor,
                        0.12
                      ),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.earningIcon,
                      {
                        backgroundColor: hexToRgba(
                          primaryColor,
                          0.14
                        ),
                      },
                    ]}
                  >
                    <Ionicons
                      name="wallet-outline"
                      size={21}
                      color={primaryColor}
                    />
                  </View>

                  <Text
                    style={[
                      styles.earningLabel,
                      {
                        color: secondaryTextColor,
                      },
                    ]}
                  >
                    Total gagné
                  </Text>

                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      styles.earningValue,
                      {
                        color: primaryColor,
                      },
                    ]}
                  >
                    {formatPrice(stats.totalEarnings)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.earningBox,
                    {
                      backgroundColor: hexToRgba(
                        GOLD,
                        0.07
                      ),
                      borderColor: hexToRgba(
                        GOLD,
                        0.14
                      ),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.earningIcon,
                      {
                        backgroundColor: hexToRgba(
                          GOLD,
                          0.14
                        ),
                      },
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={21}
                      color={GOLD}
                    />
                  </View>

                  <Text
                    style={[
                      styles.earningLabel,
                      {
                        color: secondaryTextColor,
                      },
                    ]}
                  >
                    En attente
                  </Text>

                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      styles.earningValue,
                      {
                        color: GOLD,
                      },
                    ]}
                  >
                    {formatPrice(stats.pendingEarnings)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  navigation.navigate('Withdraw');
                }}
                style={styles.withdrawButton}
              >
                <LinearGradient
                  colors={[
                    primaryColor,
                    primaryLight,
                  ]}
                  start={{
                    x: 0,
                    y: 0,
                  }}
                  end={{
                    x: 1,
                    y: 0,
                  }}
                  style={styles.withdrawGradient}
                >
                  <Ionicons
                    name="arrow-up-circle-outline"
                    size={21}
                    color="#FFFFFF"
                  />

                  <Text style={styles.withdrawText}>
                    Retirer mes gains
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#FFFFFF"
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animatable.View>

          {/* ==================================================
              GRAPHIQUE
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={350}
            duration={500}
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: surfaceColor,
                  borderColor,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: textColor,
                      },
                    ]}
                  >
                    Évolution des revenus
                  </Text>

                  <Text
                    style={[
                      styles.cardSubtitle,
                      {
                        color: secondaryTextColor,
                      },
                    ]}
                  >
                    Activité des 7 derniers jours
                  </Text>
                </View>

                <View
                  style={[
                    styles.chartLegend,
                    {
                      backgroundColor: hexToRgba(
                        primaryColor,
                        0.09
                      ),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.chartLegendDot,
                      {
                        backgroundColor: primaryColor,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.chartLegendText,
                      {
                        color: primaryColor,
                      },
                    ]}
                  >
                    Revenus
                  </Text>
                </View>
              </View>

              <ChartComponent />
            </View>
          </Animatable.View>

          {/* ==================================================
              ACTIVITÉS RÉCENTES
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={450}
            duration={500}
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: surfaceColor,
                  borderColor,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: textColor,
                      },
                    ]}
                  >
                    Activités récentes
                  </Text>

                  <Text
                    style={[
                      styles.cardSubtitle,
                      {
                        color: secondaryTextColor,
                      },
                    ]}
                  >
                    Les dernières actions
                  </Text>
                </View>

                <View
                  style={[
                    styles.activityHeaderIcon,
                    {
                      backgroundColor: hexToRgba(
                        primaryColor,
                        0.1
                      ),
                    },
                  ]}
                >
                  <Ionicons
                    name="pulse-outline"
                    size={20}
                    color={primaryColor}
                  />
                </View>
              </View>

              {recentActivities.length > 0 ? (
                <View>
                  {recentActivities.map((item, index) =>
                    renderActivity({
                      item,
                      index,
                    })
                  )}
                </View>
              ) : (
                <View style={styles.emptyActivities}>
                  <Ionicons
                    name="file-tray-outline"
                    size={34}
                    color={secondaryTextColor}
                  />

                  <Text
                    style={[
                      styles.emptyActivitiesText,
                      {
                        color: secondaryTextColor,
                      },
                    ]}
                  >
                    Aucune activité récente
                  </Text>
                </View>
              )}
            </View>
          </Animatable.View>

          {/* ==================================================
              FOOTER
          ================================================== */}

          <View style={styles.footer}>
            <View
              style={[
                styles.footerIcon,
                {
                  backgroundColor: hexToRgba(
                    primaryColor,
                    0.09
                  ),
                },
              ]}
            >
              <Ionicons
                name="heart"
                size={14}
                color={primaryColor}
              />
            </View>

            <Text
              style={[
                styles.footerText,
                {
                  color: secondaryTextColor,
                },
              ]}
            >
              Prenez soin de vos clients avec Mada Bien-être
            </Text>
          </View>
        </Animated.ScrollView>
      </View>
    </View>
  );
};


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
  },

  container: {
    flex: 1,
    width: '100%',
  },

  scrollContent: {
    paddingBottom: 42,
  },

  scrollContentWeb: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },

  // ==========================================================
  // LOADING
  // ==========================================================

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingLogoContainer: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 4,
  },

  loadingLogo: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
  },

  loadingIndicator: {
    marginTop: 22,
  },

  loadingText: {
    marginTop: 14,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },

  // ==========================================================
  // BOUTONS DU HEADER (profil / notifications)
  // Le header lui-même vient de components/common/Header.js
  // ==========================================================

  headerButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 138, 85, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(22, 138, 85, 0.28)',
  },

  headerNotificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: '#E45858',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  headerNotificationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  // ==========================================================
  // WELCOME CARD
  // ==========================================================

  topSection: {
    marginTop: 16,
    width: '100%',
  },

  welcomeCard: {
    marginHorizontal: Platform.OS === 'web' ? 0 : 14,
    minHeight: 215,
    borderRadius: 26,
    padding: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#0B5D3A',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },

  welcomeDecorCircleOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -75,
    top: -75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  welcomeDecorCircleTwo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    left: -65,
    bottom: -70,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  welcomeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  welcomeIdentity: {
    flex: 1,
    paddingRight: 12,
  },

  welcomeSmallText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },

  welcomeName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },

  welcomeDescription: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 5,
  },

  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  onlineToggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  onlineToggleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  welcomeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },

  welcomeStat: {
    flex: 1,
    alignItems: 'center',
  },

  welcomeStatValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },

  ratingValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  welcomeStatLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },

  welcomeStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ==========================================================
  // NOTIFICATION CARD
  // ==========================================================

  notificationCard: {
    marginHorizontal: Platform.OS === 'web' ? 0 : 14,
    marginTop: 14,
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },

  notificationCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationCardContent: {
    flex: 1,
    marginHorizontal: 11,
  },

  notificationCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },

  notificationCardSubtitle: {
    fontSize: 11,
    marginTop: 4,
  },

  notificationCardArrow: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ==========================================================
  // SECTIONS
  // ==========================================================

  sectionHeader: {
    marginHorizontal: Platform.OS === 'web' ? 0 : 14,
    marginTop: 23,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
  },

  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },

  sectionAccent: {
    width: 35,
    height: 5,
    borderRadius: 5,
  },

  // ==========================================================
  // QUICK ACTIONS
  // ==========================================================

  quickActionsList: {
    paddingHorizontal: 14,
    paddingBottom: 3,
  },

  quickActionsGrid: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingBottom: 3,
  },

  quickActionGridItem: {
    flex: 1,
    minWidth: 0,
  },

  quickAction: {
    width: 142,
    minHeight: 151,
    borderRadius: 21,
    borderWidth: 1,
    padding: 13,
    marginRight: 10,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },

  quickActionWeb: {
    width: '100%',
    minHeight: 145,
    marginRight: 0,
    flex: 1,
  },

  quickActionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  quickActionLabel: {
    fontSize: 14,
    fontWeight: '800',
  },

  quickActionDescription: {
    fontSize: 11,
    marginTop: 4,
  },

  quickActionArrow: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 25,
    height: 25,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ==========================================================
  // GENERIC CARD
  // ==========================================================

  card: {
    marginHorizontal: Platform.OS === 'web' ? 0 : 14,
    marginTop: 16,
    padding: 16,
    borderRadius: 23,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 7,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
  },

  cardSubtitle: {
    fontSize: 11,
    marginTop: 4,
  },

  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingLeft: 8,
  },

  seeAllText: {
    fontSize: 12,
    fontWeight: '800',
  },

  // ==========================================================
  // GAINS
  // ==========================================================

  earningsGrid: {
    flexDirection: 'row',
    gap: 10,
  },

  earningBox: {
    flex: 1,
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },

  earningIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  earningLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  earningValue: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 5,
  },

  withdrawButton: {
    marginTop: 13,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
  },

  withdrawGradient: {
    minHeight: 51,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 9,
  },

  withdrawText: {
    flex: 1,
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
  },

  // ==========================================================
  // CHART
  // ==========================================================

  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 5,
  },

  chartLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  chartLegendText: {
    fontSize: 10,
    fontWeight: '700',
  },

  chart: {
    marginTop: 2,
    marginLeft: -16,
    borderRadius: 18,
  },

  webChartContainer: {
    paddingTop: 4,
    paddingBottom: 2,
  },

  webChartBars: {
    height: 165,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },

  webChartBarWrapper: {
    width: 38,
    height: 160,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  webChartValue: {
    fontSize: 10,
    marginBottom: 6,
  },

  webChartBar: {
    width: 26,
    minHeight: 7,
    borderRadius: 9,
  },

  webChartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 9,
  },

  webChartLabel: {
    width: 38,
    textAlign: 'center',
    fontSize: 11,
  },

  chartFallback: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  chartFallbackText: {
    fontSize: 13,
  },

  // ==========================================================
  // ACTIVITÉS
  // ==========================================================

  activityHeaderIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityItem: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
  },

  activityIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  activityContent: {
    flex: 1,
    paddingRight: 5,
  },

  activityText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },

  activityTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },

  activityTime: {
    fontSize: 11,
  },

  newActivityBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  newActivityText: {
    fontSize: 9,
    fontWeight: '800',
  },

  emptyActivities: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  emptyActivitiesText: {
    fontSize: 13,
  },

  // ==========================================================
  // FOOTER
  // ==========================================================

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 25,
    paddingBottom: 14,
    gap: 7,
  },

  footerIcon: {
    width: 25,
    height: 25,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footerText: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default DashboardScreen;