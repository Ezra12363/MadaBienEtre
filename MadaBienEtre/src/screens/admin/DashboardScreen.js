// src/screens/admin/DashboardScreen.js

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Animated,
  Pressable,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTopNavLayout } from '../../components/common/AppNavigation';
import { colors, typography } from '../../theme';
import Header from '../../components/common/Header';
import AIFeatureButton from '../../components/ai/AIFeatureButton';
import adminService from '../../services/adminService';
import statsService from '../../services/statsService';
import {
  BarChart,
  HBars,
  StackedShare,
  formatAr,
  formatCount,
} from '../../components/charts/SimpleCharts';

const IS_WEB = Platform.OS === 'web';

const STATUS_LABELS = {
  completed: { label: 'Terminées', color: '#16A34A' },
  confirmed: { label: 'Confirmées', color: '#3B82F6' },
  in_progress: { label: 'En cours', color: '#2F6DB5' },
  pending: { label: 'En attente', color: '#F59E0B' },
  negotiating: { label: 'Négociation', color: '#F39C12' },
  cancelled_by_client: { label: 'Annulées (client)', color: '#E53935' },
  cancelled_by_therapist: { label: 'Annulées (thérapeute)', color: '#C0392B' },
  expired: { label: 'Expirées', color: '#9E9E9E' },
};

/* ============================================================
   DASHBOARD SCREEN
============================================================ */

const DashboardScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { unreadCount = 0 } = useNotifications() || {};

  // Web large : TopNavBar (AppNavigation.js) affiche déjà le profil
  // et les notifications tout en haut — on ne les duplique pas ici.
  // Android / iOS : jamais concerné (isMerged est toujours false hors
  // web), donc RIEN ne change pour eux — même comportement que les
  // dashboards Thérapeute et Client.
  const { isMerged } = useTopNavLayout();

  const { width: windowWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dashboardData, setDashboardData] = useState(null);
  const [stats, setStats] = useState(null);

  // Graphiques (GET /stats/admin) : séries mensuelles, statuts, top thérapeutes
  const [overview, setOverview] = useState(null);

  // Statistiques des utilisateurs (déplacées depuis UsersScreen)
  const [userStats, setUserStats] = useState(null);
  const [showUserStats, setShowUserStats] = useState(true);

  const [error, setError] = useState(null);

  /* ============================================================
     RESPONSIVE
  ============================================================ */

  /*
    LARGE WEB:
    >= 1200px => 4 cards

    SMALL/MEDIUM WEB:
    < 1200px => 2 cards

    MOBILE:
    => 2 cards

    Très petite largeur:
    => toujours 2 cartes, mais largeur réduite.
  */

  const isLargeScreen = windowWidth >= 1200;

  const columns = isLargeScreen ? 4 : 2;

  // Actions rapides : 3 colonnes sur grand écran, 1 colonne (liste) sinon.
  const quickColumns = windowWidth >= 900 ? 3 : 1;
  const quickWidth =
    quickColumns === 3 ? '32%' : '100%';

  const cardGap = IS_WEB
    ? windowWidth >= 1200
      ? 16
      : 12
    : 10;

  /*
    Calcul de largeur sans utiliser calc().
    Cela évite plusieurs problèmes React Native Web.
  */
  const cardWidth =
    columns === 4
      ? `${(100 - (columns - 1) * 1.35) / columns}%`
      : `${(100 - (columns - 1) * 2) / columns}%`;

  /* ============================================================
     TOAST
  ============================================================ */

  const [toast, setToast] = useState(null);

  const toastOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const toastTranslateY = useRef(
    new Animated.Value(-25)
  ).current;

  const toastTimer = useRef(null);

  const showToast = useCallback(
    (message, type = 'info') => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }

      setToast({
        message,
        type,
      });

      toastOpacity.stopAnimation();
      toastTranslateY.stopAnimation();

      toastOpacity.setValue(0);
      toastTranslateY.setValue(-25);

      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),

        Animated.spring(toastTranslateY, {
          toValue: 0,
          tension: 90,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      toastTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),

          Animated.timing(toastTranslateY, {
            toValue: -15,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setToast(null);
        });
      }, 3200);
    },
    [toastOpacity, toastTranslateY]
  );

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  /* ============================================================
     LOAD DASHBOARD
  ============================================================ */

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const [dashboard, statistics, userStatistics, fullOverview] =
        await Promise.all([
          adminService
            .getAdminDashboard()
            .catch((e) => {
              console.error(
                'Dashboard error:',
                e
              );
              return null;
            }),

          adminService
            .getAdminStatistics()
            .catch((e) => {
              console.error(
                'Statistics error:',
                e
              );
              return null;
            }),

          adminService
            .getUserStats()
            .catch((e) => {
              console.error(
                'User statistics error:',
                e
              );
              return null;
            }),

          statsService
            .admin(6)
            .catch((e) => {
              console.error(
                'Overview statistics error:',
                e
              );
              return null;
            }),
        ]);

      setOverview(fullOverview);

      setUserStats(
        userStatistics &&
          typeof userStatistics === 'object'
          ? userStatistics
          : {}
      );

      if (dashboard) {
        setDashboardData(dashboard);
      } else {
        setDashboardData({});

        setError(
          'Vérifiez votre connexion Internet et la disponibilité du serveur.'
        );

        showToast(
          'Impossible de charger les données du tableau de bord.',
          'error'
        );
      }

      if (statistics) {
        setStats(statistics);
      } else {
        setStats({});
      }
    } catch (err) {
      console.error(
        'Erreur chargement dashboard:',
        err
      );

      setDashboardData({});
      setStats({});
      setUserStats({});
      setOverview(null);

      setError(
        'Une erreur est survenue lors du chargement du tableau de bord.'
      );

      showToast(
        'Erreur lors du chargement du tableau de bord.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     REFRESH
  ============================================================ */

  const onRefresh = async () => {
    setRefreshing(true);

    await loadDashboard();

    setRefreshing(false);

    showToast(
      'Tableau de bord actualisé.',
      'success'
    );
  };

  /* ============================================================
     NAVIGATION
  ============================================================ */

  const navigateTo = (screen, label) => {
    if (screen) {
      navigation.navigate(screen);
      return;
    }

    showToast(
      `${label} sera disponible prochainement.`,
      'info'
    );
  };

  // Pas de "Profil" chez l'admin (voir les onglets du Tab.Navigator) :
  // le bouton gauche du header ouvre donc les Paramètres, l'écran le
  // plus proche d'un profil pour ce rôle.
  const openProfile = useCallback(() => {
    navigation.navigate('Paramètres');
  }, [navigation]);

  const openNotifications = useCallback(() => {
    navigation.navigate('AdminNotifications');
  }, [navigation]);

  /* ============================================================
     FORMAT
  ============================================================ */

  const formatNumber = (value) => {
    const number = Number(value || 0);

    return number.toLocaleString('fr-FR');
  };

  const formatMoney = (value) => {
    return `${formatNumber(value)} Ar`;
  };

  // Style commun des cartes de graphiques
  const chartCardStyle = {
    backgroundColor: themeColors.surface,
    borderColor: isDark
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(15,23,42,0.06)',
    padding: 16,
    marginBottom: 14,
  };

  const chartTitleStyle = {
    color: themeColors.text,
    fontSize: 14,
    marginBottom: 10,
  };

  /* ============================================================
     TOAST COMPONENT
  ============================================================ */

  const Toast = () => {
    if (!toast) return null;

    const typeConfig = {
      success: {
        icon: 'checkmark-circle',
        background: '#16A34A',
      },

      error: {
        icon: 'alert-circle',
        background: '#DC2626',
      },

      warning: {
        icon: 'warning',
        background: '#F59E0B',
      },

      info: {
        icon: 'information-circle',
        background: colors.primary,
      },
    };

    const config =
      typeConfig[toast.type] ||
      typeConfig.info;

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toastWrapper,
          {
            opacity: toastOpacity,
            transform: [
              {
                translateY:
                  toastTranslateY,
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.toast,
            {
              backgroundColor:
                config.background,
            },
          ]}
        >
          <Ionicons
            name={config.icon}
            size={21}
            color="#FFFFFF"
          />

          <Text
            style={styles.toastText}
            numberOfLines={3}
          >
            {toast.message}
          </Text>
        </View>
      </Animated.View>
    );
  };

  /* ============================================================
     STAT CARD
  ============================================================ */

  const StatCard = ({
    icon,
    label,
    value,
    color,
    subtitle,
    onPress,
  }) => {
    const [hovered, setHovered] =
      useState(false);

    return (
      <Pressable
        onPress={onPress}
        onHoverIn={() => {
          if (IS_WEB) {
            setHovered(true);
          }
        }}
        onHoverOut={() => {
          if (IS_WEB) {
            setHovered(false);
          }
        }}
        style={[
          styles.statCard,

          {
            width: cardWidth,
            backgroundColor:
              themeColors.surface,

            borderColor: isDark
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(15,23,42,0.07)',

            marginBottom: cardGap,
          },

          hovered && IS_WEB
            ? styles.statCardHover
            : null,
        ]}
      >
        <View style={styles.statCardTop}>
          <View
            style={[
              styles.statIcon,
              {
                backgroundColor: `${color}18`,
              },
            ]}
          >
            <Ionicons
              name={icon}
              size={23}
              color={color}
            />
          </View>

          <View
            style={[
              styles.statArrow,
              {
                backgroundColor: `${color}12`,
              },
            ]}
          >
            <Ionicons
              name="arrow-up-outline"
              size={14}
              color={color}
            />
          </View>
        </View>

        <View style={styles.statCardBody}>
          <Text
            style={[
              styles.statValue,
              {
                color: themeColors.text,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {typeof value === 'number'
              ? formatNumber(value)
              : value}
          </Text>

          <Text
            style={[
              styles.statLabel,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>

          {subtitle ? (
            <Text
              style={[
                styles.statSubtitle,
                {
                  color,
                },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  /* ============================================================
     QUICK ACTION
  ============================================================ */

  const QuickAction = ({
    icon,
    label,
    description,
    color,
    screen,
  }) => {
    const [hovered, setHovered] =
      useState(false);

    return (
      <Pressable
        onPress={() =>
          navigateTo(screen, label)
        }
        onHoverIn={() => {
          if (IS_WEB) {
            setHovered(true);
          }
        }}
        onHoverOut={() => {
          if (IS_WEB) {
            setHovered(false);
          }
        }}
        style={[
          styles.quickAction,

          {
            width: quickWidth,
            backgroundColor:
              themeColors.surface,

            borderColor: isDark
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(15,23,42,0.07)',

            marginBottom: cardGap,
          },

          hovered && IS_WEB
            ? styles.quickActionHover
            : null,
        ]}
      >
        <View
          style={[
            styles.quickIcon,
            {
              backgroundColor: `${color}16`,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={23}
            color={color}
          />
        </View>

        <View style={styles.quickContent}>
          <Text
            style={[
              styles.quickLabel,
              {
                color: themeColors.text,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>

          <Text
            style={[
              styles.quickDescription,
              {
                color:
                  themeColors.textSecondary,
              },
            ]}
            numberOfLines={2}
          >
            {description}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={17}
          color={themeColors.textSecondary}
        />
      </Pressable>
    );
  };

  /* ============================================================
     SECTION HEADER
  ============================================================ */

  const SectionHeader = ({
    title,
    subtitle,
    icon,
  }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon && (
          <View
            style={[
              styles.sectionIcon,
              {
                backgroundColor:
                  `${colors.primary}12`,
              },
            ]}
          >
            <Ionicons
              name={icon}
              size={18}
              color={colors.primary}
            />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: themeColors.text,
              },
            ]}
          >
            {title}
          </Text>

          {subtitle ? (
            <Text
              style={[
                styles.sectionSubtitle,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  /* ============================================================
     STATISTIQUES UTILISATEURS (déplacées depuis UsersScreen)
  ============================================================ */

  const renderUserStats = () => {
    const us = userStats || {};

    const num = (v) => Number(v || 0);

    const total = num(
      us.total ?? dashboardData?.users?.total
    );
    const therapistsCount = num(
      us.therapists ??
        dashboardData?.users?.therapists
    );
    const activeCount = num(us.active);
    const verifiedCount = num(
      us.verified_therapists
    );

    const percent = (part, whole) =>
      whole > 0
        ? Math.min(
            100,
            Math.round((part / whole) * 100)
          )
        : 0;

    // Chaque catégorie = une carte séparée.
    const groups = [
      {
        key: 'users',
        title: 'Utilisateurs',
        subtitle: 'Répartition par rôle',
        icon: 'people-outline',
        color: '#3B82F6',
        perRow: 3,
        items: [
          {
            key: 'clients',
            icon: 'person-outline',
            label: 'Clients',
            value: num(us.clients),
            color: '#0EA5E9',
            screen: 'UsersScreen',
          },
          {
            key: 'therapists',
            icon: 'fitness-outline',
            label: 'Thérapeutes',
            value: therapistsCount,
            color: '#16A34A',
            screen: 'Therapists',
          },
          {
            key: 'admins',
            icon: 'shield-checkmark-outline',
            label: 'Admins',
            value: num(us.admins),
            color: '#E53935',
            screen: 'UsersScreen',
          },
        ],
      },
      {
        key: 'accounts',
        title: 'Statut des comptes',
        subtitle: 'Activité de la plateforme',
        icon: 'pulse-outline',
        color: '#16A34A',
        perRow: 3,
        items: [
          {
            key: 'active',
            icon: 'checkmark-circle-outline',
            label: 'Actifs',
            value: activeCount,
            color: '#22C55E',
            screen: 'UsersScreen',
          },
          {
            key: 'inactive',
            icon: 'close-circle-outline',
            label: 'Inactifs',
            value: num(us.inactive),
            color: '#EF4444',
            screen: 'UsersScreen',
          },
          {
            key: 'new',
            icon: 'trending-up-outline',
            label: 'Nouveaux (7j)',
            value: num(us.new_users_last_week),
            color: '#F59E0B',
            screen: 'UsersScreen',
          },
        ],
        progress: {
          label: "Taux d'activité",
          value: percent(activeCount, total),
          color: '#22C55E',
        },
      },
      {
        key: 'therapists',
        title: 'Thérapeutes',
        subtitle: 'Vérification et disponibilité',
        icon: 'fitness-outline',
        color: '#8B5CF6',
        perRow: 2,
        items: [
          {
            key: 'verified',
            icon: 'ribbon-outline',
            label: 'Vérifiés',
            value: verifiedCount,
            color: '#10B981',
            screen: 'Therapists',
          },
          {
            key: 'online',
            icon: 'wifi-outline',
            label: 'En ligne',
            value: num(us.online_therapists),
            color: '#6366F1',
            screen: 'Therapists',
          },
        ],
        progress: {
          label: 'Taux de vérification',
          value: percent(
            verifiedCount,
            therapistsCount
          ),
          color: '#10B981',
        },
      },
    ];

    // Grand écran : 3 cartes côte à côte. Sinon : empilées.
    const groupWidth =
      windowWidth >= 900 ? '33.3333%' : '100%';

    const borderColor = isDark
      ? 'rgba(255,255,255,0.07)'
      : 'rgba(15,23,42,0.07)';

    return (
      <View style={styles.userStatsSection}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            setShowUserStats((v) => !v)
          }
          style={styles.userStatsHeader}
          accessibilityRole="button"
          accessibilityLabel={
            showUserStats
              ? 'Masquer les statistiques'
              : 'Afficher les statistiques'
          }
        >
          <View
            style={[
              styles.sectionIcon,
              {
                backgroundColor: `${colors.primary}12`,
              },
            ]}
          >
            <Ionicons
              name="stats-chart-outline"
              size={18}
              color={colors.primary}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[
                styles.sectionTitle,
                { color: themeColors.text },
              ]}
              numberOfLines={1}
            >
              Statistiques des utilisateurs
            </Text>

            <Text
              style={[
                styles.sectionSubtitle,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              Vue détaillée des comptes de la
              plateforme
            </Text>
          </View>

          <View
            style={[
              styles.userStatsToggle,
              {
                backgroundColor: `${colors.primary}10`,
              },
            ]}
          >
            {windowWidth >= 520 ? (
              <Text
                style={[
                  styles.userStatsToggleText,
                  { color: colors.primary },
                ]}
              >
                {showUserStats
                  ? 'Masquer'
                  : 'Afficher'}
              </Text>
            ) : null}

            <Ionicons
              name={
                showUserStats
                  ? 'chevron-up'
                  : 'chevron-down'
              }
              size={18}
              color={colors.primary}
            />
          </View>
        </TouchableOpacity>

        {showUserStats && (
          <View style={styles.userGroupsRow}>
            {groups.map((group) => (
              <View
                key={group.key}
                style={[
                  styles.userGroupWrap,
                  { width: groupWidth },
                ]}
              >
                <View
                  style={[
                    styles.userGroupCard,
                    {
                      backgroundColor:
                        themeColors.surface,
                      borderColor,
                    },
                  ]}
                >
                  {/* En-tête de la carte */}
                  <View
                    style={styles.userGroupHeader}
                  >
                    <View
                      style={[
                        styles.userGroupIcon,
                        {
                          backgroundColor: `${group.color}16`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={group.icon}
                        size={20}
                        color={group.color}
                      />
                    </View>

                    <View
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <Text
                        style={[
                          styles.userGroupTitle,
                          {
                            color:
                              themeColors.text,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {group.title}
                      </Text>

                      <Text
                        style={[
                          styles.userGroupSubtitle,
                          {
                            color:
                              themeColors.textSecondary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {group.subtitle}
                      </Text>
                    </View>
                  </View>

                  {/* Tuiles */}
                  <View style={styles.userTilesGrid}>
                    {group.items.map((item) => (
                      <View
                        key={item.key}
                        style={{
                          width: `${
                            100 / group.perRow
                          }%`,
                          padding: 4,
                        }}
                      >
                        <Pressable
                          onPress={() =>
                            navigateTo(
                              item.screen,
                              item.label
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.userStatTile,
                            {
                              backgroundColor: `${item.color}0F`,
                              borderColor: `${item.color}22`,
                              opacity: pressed
                                ? 0.85
                                : 1,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.userStatIcon,
                              {
                                backgroundColor: `${item.color}22`,
                              },
                            ]}
                          >
                            <Ionicons
                              name={item.icon}
                              size={18}
                              color={item.color}
                            />
                          </View>

                          <Text
                            style={[
                              styles.userStatValue,
                              {
                                color:
                                  themeColors.text,
                              },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {formatNumber(
                              item.value
                            )}
                          </Text>

                          <Text
                            style={[
                              styles.userStatLabel,
                              {
                                color:
                                  themeColors.textSecondary,
                              },
                            ]}
                            numberOfLines={2}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>

                  {/* Barre de progression (si applicable) */}
                  {group.progress ? (
                    <View
                      style={
                        styles.userProgressBlock
                      }
                    >
                      <View
                        style={
                          styles.userProgressRow
                        }
                      >
                        <Text
                          style={[
                            styles.userProgressLabel,
                            {
                              color:
                                themeColors.textSecondary,
                            },
                          ]}
                        >
                          {group.progress.label}
                        </Text>

                        <Text
                          style={[
                            styles.userProgressValue,
                            {
                              color:
                                group.progress
                                  .color,
                            },
                          ]}
                        >
                          {group.progress.value}%
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.userProgressTrack,
                          {
                            backgroundColor:
                              isDark
                                ? 'rgba(255,255,255,0.08)'
                                : '#E5EAF4',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.userProgressBar,
                            {
                              width: `${group.progress.value}%`,
                              backgroundColor:
                                group.progress
                                  .color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor:
                themeColors.background,
            },
          ]}
        >
        <Header
          title="Tableau de bord"
          leftComponent={
            isMerged ? null : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openProfile}
                style={styles.headerButtonCircle}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les paramètres"
              >
                <Ionicons
                  name="settings-outline"
                  size={21}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )
          }
          rightComponent={
            isMerged ? null : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openNotifications}
                style={styles.headerButtonCircle}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les notifications"
              >
                <View style={styles.headerBellWrap}>
                  <Ionicons
                    name={
                      unreadCount > 0
                        ? 'notifications'
                        : 'notifications-outline'
                    }
                    size={23}
                    color="#FFFFFF"
                  />

                  {unreadCount > 0 && (
                    <View style={styles.headerNotificationBadge}>
                      <Text style={styles.headerNotificationText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )
          }
        />

          <View style={styles.loadingContainer}>
            <View
              style={[
                styles.loadingIcon,
                {
                  backgroundColor:
                    `${colors.primary}12`,
                },
              ]}
            >
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />
            </View>

            <Text
              style={[
                styles.loadingTitle,
                {
                  color:
                    themeColors.text,
                },
              ]}
            >
              Chargement du tableau de bord
            </Text>

            <Text
              style={[
                styles.loadingText,
                {
                  color:
                    themeColors.textSecondary,
                },
              ]}
            >
              Récupération des dernières données...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* ============================================================
     MAIN
  ============================================================ */

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            themeColors.background,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >
        <Header
          title="Tableau de bord"
          leftComponent={
            isMerged ? null : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openProfile}
                style={styles.headerButtonCircle}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les paramètres"
              >
                <Ionicons
                  name="settings-outline"
                  size={21}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )
          }
          rightComponent={
            isMerged ? null : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openNotifications}
                style={styles.headerButtonCircle}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les notifications"
              >
                <View style={styles.headerBellWrap}>
                  <Ionicons
                    name={
                      unreadCount > 0
                        ? 'notifications'
                        : 'notifications-outline'
                    }
                    size={23}
                    color="#FFFFFF"
                  />

                  {unreadCount > 0 && (
                    <View style={styles.headerNotificationBadge}>
                      <Text style={styles.headerNotificationText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )
          }
        />

        <Toast />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,

            {
              paddingHorizontal: IS_WEB
                ? windowWidth >= 1200
                  ? 30
                  : 18
                : 12,
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* ====================================================
              PAGE HEADER
          ==================================================== */}

          <View style={styles.pageHeader}>
            <View style={styles.pageHeaderLeft}>
              <Text
                style={[
                  styles.pageTitle,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                Vue d'ensemble
              </Text>

              <Text
                style={[
                  styles.pageSubtitle,
                  {
                    color:
                      themeColors.textSecondary,
                  },
                ]}
              >
                Suivez l'activité de votre
                plateforme en temps réel.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.refreshButton,
                {
                  backgroundColor:
                    themeColors.surface,

                  borderColor: isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(15,23,42,0.07)',
                },
              ]}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color={colors.primary}
              />

              {windowWidth >= 430 ||
              IS_WEB ? (
                <Text
                  style={[
                    styles.refreshText,
                    {
                      color:
                        themeColors.text,
                    },
                  ]}
                >
                  Actualiser
                </Text>
              ) : null}
            </TouchableOpacity>
          </View>

          {/* ====================================================
              ERROR
          ==================================================== */}

          {error && (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: isDark
                    ? 'rgba(245,158,11,0.10)'
                    : '#FFF7E6',

                  borderColor: isDark
                    ? 'rgba(245,158,11,0.25)'
                    : '#F5D48A',
                },
              ]}
            >
              <View style={styles.errorIcon}>
                <Ionicons
                  name="warning-outline"
                  size={19}
                  color="#F59E0B"
                />
              </View>

              <Text
                style={[
                  styles.errorText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {error}
              </Text>

              <TouchableOpacity
                onPress={loadDashboard}
                style={styles.errorRetry}
              >
                <Text
                  style={[
                    styles.errorRetryText,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  Réessayer
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ====================================================
              SOS
          ==================================================== */}

          {dashboardData?.sos?.active >
            0 && (
            <TouchableOpacity
              style={styles.sosAlert}
              onPress={() =>
                navigation.navigate(
                  'SOSAlerts'
                )
              }
              activeOpacity={0.85}
            >
              <View style={styles.sosIcon}>
                <Ionicons
                  name="alert-circle"
                  size={24}
                  color="#FFFFFF"
                />
              </View>

              <View style={styles.sosContent}>
                <Text
                  style={styles.sosTitle}
                >
                  Alerte SOS active
                </Text>

                <Text
                  style={styles.sosText}
                >
                  {
                    dashboardData.sos
                      .active
                  }{' '}
                  alerte(s) nécessitent
                  votre attention.
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          )}

          {/* ====================================================
              ✨ IA & CHATBOT — accès bien visible (Android, iOS, web)
              Sur le web large, le même accès existe aussi dans la
              TopNavBar (icône étincelles).
          ==================================================== */}

          <View style={styles.aiBannerWrap}>
            <AIFeatureButton
              title="✨ IA & Chatbot"
              subtitle="KPI, prévisions, fraude et assistant intelligent"
              onPress={() => navigateTo('AIInsights', 'IA & Chatbot')}
            />
          </View>

          {/* ====================================================
              STATISTIQUES
          ==================================================== */}

          <SectionHeader
            title="Indicateurs principaux"
            subtitle="Résumé de l'activité"
            icon="analytics-outline"
          />

          <View
            style={[
              styles.grid,
              {
                columnGap:
                  columns === 4
                    ? '1.35%'
                    : '2%',
              },
            ]}
          >
            <StatCard
              icon="people-outline"
              label="Utilisateurs"
              value={
                dashboardData?.users
                  ?.total || 0
              }
              color="#3B82F6"
              subtitle="Comptes enregistrés"
              onPress={() =>
                navigation.navigate(
                  'UsersScreen'
                )
              }
            />

            <StatCard
              icon="calendar-outline"
              label="Réservations"
              value={
                dashboardData?.bookings
                  ?.total || 0
              }
              color="#F59E0B"
              subtitle="Total enregistré"
              onPress={() =>
                showToast(
                  'Gestion des réservations disponible depuis le menu.',
                  'info'
                )
              }
            />

            <StatCard
              icon="cash-outline"
              label="Revenus"
              value={formatMoney(
                dashboardData?.revenue
                  ?.total || 0
              )}
              color="#E53935"
              subtitle="Revenus cumulés"
              onPress={() =>
                navigation.navigate(
                  'Payments'
                )
              }
            />

            <StatCard
              icon="today-outline"
              label="Revenu du jour"
              value={formatMoney(
                dashboardData?.revenue
                  ?.today || 0
              )}
              color="#8B5CF6"
              subtitle="Encaissé aujourd'hui"
              onPress={() =>
                navigation.navigate(
                  'Payments'
                )
              }
            />
          </View>

          {/* ====================================================
              STATISTIQUES DES UTILISATEURS (déplacées depuis UsersScreen)
          ==================================================== */}

          {renderUserStats()}

          {/* ====================================================
              QUICK ACTIONS
          ==================================================== */}

          <SectionHeader
            title="Actions rapides"
            subtitle="Accès direct aux fonctionnalités d'administration"
            icon="flash-outline"
          />

          <View
            style={[
              styles.quickGrid,
              {
                columnGap:
                  quickColumns === 3
                    ? '2%'
                    : 0,
              },
            ]}
          >
            <QuickAction
              icon="person-add-outline"
              label="Approbations"
              description="Valider les nouveaux thérapeutes"
              color="#3B82F6"
              screen="Approvals"
            />

            <QuickAction
              icon="stats-chart-outline"
              label="Statistiques"
              description="Analyser les performances"
              color="#16A34A"
              screen="Analytics"
            />

            <QuickAction
              icon="chatbubbles-outline"
              label="Avis"
              description="Consulter les retours clients"
              color="#F59E0B"
              screen="Reviews"
            />

          </View>

          {/* ====================================================
              DETAIL STATISTICS
          ==================================================== */}

          {stats && (
            <>
              <SectionHeader
                title="Analyse détaillée"
                subtitle={`Période : ${
                  stats.period ||
                  'month'
                }`}
                icon="bar-chart-outline"
              />

              <View
                style={[
                  styles.detailCard,
                  {
                    backgroundColor:
                      themeColors.surface,

                    borderColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(15,23,42,0.06)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.detailGrid,
                    {
                      columnGap:
                        columns === 4
                          ? '0%'
                          : '0%',
                    },
                  ]}
                >
                  <DetailItem
                    value={
                      stats.new_users ||
                      0
                    }
                    label="Nouveaux utilisateurs"
                    color="#3B82F6"
                    themeColors={
                      themeColors
                    }
                    columns={columns}
                  />

                  <DetailItem
                    value={
                      stats.new_bookings ||
                      0
                    }
                    label="Nouvelles réservations"
                    color="#16A34A"
                    themeColors={
                      themeColors
                    }
                    columns={columns}
                  />

                  <DetailItem
                    value={formatMoney(
                      stats.revenue || 0
                    )}
                    label="Revenus (période)"
                    color="#E53935"
                    themeColors={
                      themeColors
                    }
                    columns={columns}
                  />

                  <DetailItem
                    value={`⭐ ${
                      stats.average_rating ||
                      0
                    }`}
                    label={`Note moyenne (${
                      stats.reviews ||
                      0
                    } avis)`}
                    color="#F59E0B"
                    themeColors={
                      themeColors
                    }
                    columns={columns}
                  />
                </View>

                <View
                  style={[
                    styles.completionCard,
                    {
                      backgroundColor:
                        isDark
                          ? 'rgba(59,130,246,0.08)'
                          : '#F5F8FF',
                    },
                  ]}
                >
                  <View
                    style={
                      styles.completionHeader
                    }
                  >
                    <View>
                      <Text
                        style={[
                          styles.completionLabel,
                          {
                            color:
                              themeColors.textSecondary,
                          },
                        ]}
                      >
                        Taux de complétion
                      </Text>

                      <Text
                        style={[
                          styles.completionValue,
                          {
                            color:
                              colors.primary,
                          },
                        ]}
                      >
                        {stats.completion_rate ||
                          0}
                        %
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.completionIcon,
                        {
                          backgroundColor:
                            `${colors.primary}14`,
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-done-outline"
                        size={22}
                        color={
                          colors.primary
                        }
                      />
                    </View>
                  </View>

                  <View
                    style={[
                      styles.progressTrack,
                      {
                        backgroundColor:
                          isDark
                            ? 'rgba(255,255,255,0.08)'
                            : '#E5EAF4',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Number(
                                stats.completion_rate ||
                                  0
                              )
                            )
                          )}%`,
                          backgroundColor:
                            colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </>
          )}

          {/* ====================================================
              GRAPHIQUES (données réelles de la base)
          ==================================================== */}

          {overview && (
            <>
              <SectionHeader
                title="Graphiques"
                subtitle="Évolution sur les 6 derniers mois"
                icon="trending-up-outline"
              />

              <View
                style={[
                  styles.detailCard,
                  chartCardStyle,
                ]}
              >
                <Text style={chartTitleStyle}>
                  Revenus mensuels
                </Text>
                <BarChart
                  data={(overview.monthly || []).map((m) => ({
                    label: m.label,
                    values: { revenue: m.revenue },
                  }))}
                  series={[
                    {
                      key: 'revenue',
                      color: colors.primary,
                      name: 'Revenus',
                    },
                  ]}
                  textColor={themeColors.textSecondary}
                  gridColor={themeColors.border || '#ECECEC'}
                  barWidth={22}
                />
              </View>

              <View
                style={[
                  styles.detailCard,
                  chartCardStyle,
                ]}
              >
                <Text style={chartTitleStyle}>
                  Réservations & nouveaux comptes
                </Text>
                <BarChart
                  data={(overview.monthly || []).map((m) => ({
                    label: m.label,
                    values: {
                      bookings: m.bookings,
                      new_users: m.new_users,
                    },
                  }))}
                  series={[
                    {
                      key: 'bookings',
                      color: '#F59E0B',
                      name: 'Réservations terminées',
                    },
                    {
                      key: 'new_users',
                      color: '#3B82F6',
                      name: 'Nouveaux comptes',
                    },
                  ]}
                  format={formatCount}
                  textColor={themeColors.textSecondary}
                  gridColor={themeColors.border || '#ECECEC'}
                />
              </View>

              <View
                style={[
                  styles.detailCard,
                  chartCardStyle,
                ]}
              >
                <Text style={chartTitleStyle}>
                  Réservations par statut
                </Text>
                <StackedShare
                  textColor={themeColors.textSecondary}
                  items={Object.entries(
                    overview.bookings?.by_status || {}
                  )
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => ({
                      label: STATUS_LABELS[k]?.label || k,
                      value: v,
                      color: STATUS_LABELS[k]?.color || '#9E9E9E',
                    }))}
                />
              </View>

              <View
                style={[
                  styles.detailCard,
                  chartCardStyle,
                ]}
              >
                <Text style={chartTitleStyle}>
                  Meilleurs thérapeutes
                </Text>
                <HBars
                  textColor={themeColors.textSecondary}
                  trackColor={themeColors.border || '#EFEFEF'}
                  items={(overview.top_therapists || []).map((t) => ({
                    label: `${t.name} · ${t.bookings} rés.`,
                    value: t.earnings,
                    color: colors.primary,
                  }))}
                  format={formatAr}
                />
              </View>
            </>
          )}

          <View style={styles.footer} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

/* ============================================================
   DETAIL ITEM
============================================================ */

const DetailItem = ({
  value,
  label,
  color,
  themeColors,
  columns,
}) => (
  <View
    style={[
      styles.detailItem,
      {
        width:
          columns === 4
            ? '25%'
            : '50%',

        borderBottomColor:
          themeColors.border ||
          'rgba(15,23,42,0.06)',
      },
    ]}
  >
    <View
      style={[
        styles.detailDot,
        {
          backgroundColor: color,
        },
      ]}
    />

    <View
      style={styles.detailItemContent}
    >
      <Text
        style={[
          styles.detailValue,
          {
            color: themeColors.text,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>

      <Text
        style={[
          styles.detailLabel,
          {
            color:
              themeColors.textSecondary,
          },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  </View>
);

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
    width: '100%',
  },

  /* ==========================================================
     HEADER — bouton profil/paramètres + notifications
  ========================================================== */

  headerButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,

  },

  // Conteneur de la cloche : même taille que l'icône (23px)
  headerBellWrap: {
    width: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerNotificationBadge: {
    position: 'absolute',
    top: -7,
    left: 15,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#E53935',
    borderWidth: 1.5,
    borderColor: colors.primary || '#168A55',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerNotificationText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },

  /* ==========================================================
     TOAST
  ========================================================== */

  toastWrapper: {
    position: 'absolute',

    top: IS_WEB ? 20 : 14,

    left: 0,
    right: 0,

    alignItems: 'center',
    justifyContent: 'center',

    zIndex: 99999,
    elevation: 99999,

    pointerEvents: 'none',
  },

  toast: {
    minWidth: IS_WEB ? 320 : '76%',
    maxWidth: IS_WEB ? 540 : '92%',

    minHeight: 50,

    paddingHorizontal: 17,
    paddingVertical: 12,

    borderRadius: 15,

    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.22,
    shadowRadius: 14,

    elevation: 12,
  },

  toastText: {
    flex: 1,

    marginLeft: 10,

    color: '#FFFFFF',

    fontSize: 13,

    fontFamily:
      typography.fontFamily.semiBold,

    lineHeight: 18,
  },

  /* ==========================================================
     SCROLL
  ========================================================== */

  scrollContent: {
    width: '100%',

    paddingTop: IS_WEB
      ? 22
      : 12,

    paddingBottom: 45,
  },

  /* ==========================================================
     PAGE HEADER
  ========================================================== */

  aiBannerWrap: {
    width: '100%',
    marginBottom: 6,
  },

  pageHeader: {
    width: '100%',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    marginBottom: 22,
  },

  pageHeaderLeft: {
    flex: 1,

    paddingRight: 12,
  },

  pageTitle: {
    fontSize: IS_WEB ? 28 : 22,

    fontFamily:
      typography.fontFamily.bold,

    letterSpacing: -0.5,
  },

  pageSubtitle: {
    marginTop: 5,

    fontSize: 13,

    lineHeight: 18,

    fontFamily:
      typography.fontFamily.regular,
  },

  refreshButton: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 7,

    paddingHorizontal: 13,
    paddingVertical: 10,

    borderRadius: 11,

    borderWidth: 1,
  },

  refreshText: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  /* ==========================================================
     ERROR
  ========================================================== */

  errorBanner: {
    width: '100%',

    minHeight: 54,

    borderRadius: 13,

    borderWidth: 1,

    paddingHorizontal: 13,

    marginBottom: 20,

    flexDirection: 'row',
    alignItems: 'center',
  },

  errorIcon: {
    width: 34,
    height: 34,

    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(245,158,11,0.12)',
  },

  errorText: {
    flex: 1,

    marginLeft: 10,

    fontSize: 12,

    lineHeight: 17,

    fontFamily:
      typography.fontFamily.medium,
  },

  errorRetry: {
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  errorRetryText: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily.bold,
  },

  /* ==========================================================
     SECTION
  ========================================================== */

  sectionHeader: {
    width: '100%',

    marginTop: 5,
    marginBottom: 12,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionIcon: {
    width: 36,
    height: 36,

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  sectionTitle: {
    fontSize: 16,

    fontFamily:
      typography.fontFamily.bold,
  },

  sectionSubtitle: {
    marginTop: 2,

    fontSize: 11,

    lineHeight: 15,

    fontFamily:
      typography.fontFamily.regular,
  },

  /* ==========================================================
     GRID
  ========================================================== */

  grid: {
    width: '100%',

    flexDirection: 'row',
    flexWrap: 'wrap',

    marginBottom: 10,
  },

  /* ==========================================================
     STAT CARD
  ========================================================== */

  statCard: {
    flexGrow: 0,
    flexShrink: 0,

    minHeight: 154,

    padding: 17,

    borderRadius: 18,

    borderWidth: 1,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.04,

    shadowRadius: 9,

    elevation: 2,

    ...(IS_WEB
      ? {
          transitionProperty:
            'transform, box-shadow',
          transitionDuration: '180ms',
          transitionTimingFunction:
            'ease',
        }
      : {}),
  },

  statCardHover: IS_WEB
    ? {
        transform: [
          {
            translateY: -3,
          },
        ],

        shadowOpacity: 0.10,

        shadowRadius: 15,

        elevation: 5,
      }
    : {},

  statCardTop: {
    width: '100%',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',
  },

  statIcon: {
    width: 44,
    height: 44,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',
  },

  statArrow: {
    width: 28,
    height: 28,

    borderRadius: 8,

    alignItems: 'center',
    justifyContent: 'center',
  },

  statCardBody: {
    marginTop: 18,
  },

  statValue: {
    fontSize: IS_WEB ? 25 : 21,

    fontFamily:
      typography.fontFamily.bold,

    letterSpacing: -0.4,
  },

  statLabel: {
    marginTop: 4,

    fontSize: 12,

    fontFamily:
      typography.fontFamily.medium,
  },

  statSubtitle: {
    marginTop: 7,

    fontSize: 10,

    fontFamily:
      typography.fontFamily.medium,
  },

  /* ==========================================================
     REVENUE
  ========================================================== */

  revenueCard: {
    width: '100%',

    minHeight: 88,

    paddingHorizontal: 18,
    paddingVertical: 15,

    borderRadius: 17,

    borderWidth: 1,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    marginBottom: 22,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.035,

    shadowRadius: 8,

    elevation: 1,
  },

  revenueLeft: {
    flex: 1,

    flexDirection: 'row',

    alignItems: 'center',

    paddingRight: 8,
  },

  revenueIcon: {
    width: 44,
    height: 44,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 12,
  },

  revenueLabel: {
    fontSize: 11,

    fontFamily:
      typography.fontFamily.medium,
  },

  revenueValue: {
    marginTop: 3,

    fontSize: 21,

    fontFamily:
      typography.fontFamily.bold,
  },

  revenueBadge: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 5,

    paddingHorizontal: 9,
    paddingVertical: 6,

    borderRadius: 9,
  },

  revenueBadgeText: {
    fontSize: 10,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  /* ==========================================================
     SOS
  ========================================================== */

  sosAlert: {
    width: '100%',

    minHeight: 70,

    paddingHorizontal: 15,
    paddingVertical: 12,

    backgroundColor: '#DC2626',

    borderRadius: 15,

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 22,

    shadowColor: '#DC2626',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.20,

    shadowRadius: 8,

    elevation: 4,
  },

  sosIcon: {
    width: 42,
    height: 42,

    borderRadius: 12,

    backgroundColor:
      'rgba(255,255,255,0.15)',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  sosContent: {
    flex: 1,
  },

  sosTitle: {
    color: '#FFFFFF',

    fontSize: 13,

    fontFamily:
      typography.fontFamily.bold,
  },

  sosText: {
    marginTop: 2,

    color:
      'rgba(255,255,255,0.85)',

    fontSize: 11,

    lineHeight: 15,

    fontFamily:
      typography.fontFamily.regular,
  },

  /* ==========================================================
     QUICK ACTION
  ========================================================== */

  quickGrid: {
    width: '100%',

    flexDirection: 'row',

    flexWrap: 'wrap',

    marginBottom: 10,
  },

  quickAction: {
    minHeight: 108,

    padding: 14,

    borderRadius: 16,

    borderWidth: 1,

    flexDirection: 'row',

    alignItems: 'center',

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.035,

    shadowRadius: 8,

    elevation: 1,

    ...(IS_WEB
      ? {
          transitionProperty:
            'transform, box-shadow',
          transitionDuration: '180ms',
          transitionTimingFunction:
            'ease',
        }
      : {}),
  },

  quickActionHover: IS_WEB
    ? {
        transform: [
          {
            translateY: -3,
          },
        ],

        shadowOpacity: 0.09,

        shadowRadius: 14,

        elevation: 5,
      }
    : {},

  quickIcon: {
    width: 43,
    height: 43,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  quickContent: {
    flex: 1,

    minWidth: 0,
  },

  quickLabel: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily.bold,
  },

  quickDescription: {
    fontSize: 10,

    lineHeight: 14,

    marginTop: 3,

    fontFamily:
      typography.fontFamily.regular,
  },

  /* ==========================================================
     DETAIL
  ========================================================== */

  detailCard: {
    width: '100%',

    borderRadius: 18,

    borderWidth: 1,

    padding: 17,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.035,

    shadowRadius: 8,

    elevation: 1,
  },

  detailGrid: {
    width: '100%',

    flexDirection: 'row',

    flexWrap: 'wrap',
  },

  detailItem: {
    minHeight: 75,

    paddingHorizontal: 9,
    paddingVertical: 10,

    flexDirection: 'row',

    alignItems: 'center',
  },

  detailDot: {
    width: 7,
    height: 7,

    borderRadius: 4,

    marginRight: 9,
  },

  detailItemContent: {
    flex: 1,

    minWidth: 0,
  },

  detailValue: {
    fontSize: 17,

    fontFamily:
      typography.fontFamily.bold,
  },

  detailLabel: {
    marginTop: 3,

    fontSize: 10,

    lineHeight: 14,

    fontFamily:
      typography.fontFamily.regular,
  },

  /* ==========================================================
     COMPLETION
  ========================================================== */

  completionCard: {
    width: '100%',

    marginTop: 12,

    padding: 15,

    borderRadius: 14,
  },

  completionHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',
  },

  completionLabel: {
    fontSize: 11,

    fontFamily:
      typography.fontFamily.medium,
  },

  completionValue: {
    marginTop: 2,

    fontSize: 24,

    fontFamily:
      typography.fontFamily.bold,
  },

  completionIcon: {
    width: 42,
    height: 42,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',
  },

  progressTrack: {
    width: '100%',

    height: 7,

    borderRadius: 10,

    marginTop: 13,

    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',

    borderRadius: 10,
  },

  /* ==========================================================
     STATISTIQUES UTILISATEURS
  ========================================================== */

  userStatsSection: {
    width: '100%',

    marginBottom: 12,
  },

  userStatsHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    minHeight: 44,

    marginBottom: 10,
  },

  userStatsToggle: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 5,

    paddingHorizontal: 10,
    paddingVertical: 8,

    borderRadius: 10,

    marginLeft: 8,
  },

  userStatsToggleText: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  // Les 3 cartes (catégories) : séparées, chacune avec son espace.
  userGroupsRow: {
    width: 'auto',

    flexDirection: 'row',

    flexWrap: 'wrap',

    marginHorizontal: -6,
  },

  userGroupWrap: {
    padding: 6,
  },

  userGroupCard: {
    flex: 1,

    borderRadius: 18,

    borderWidth: 1,

    padding: IS_WEB ? 16 : 13,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.04,

    shadowRadius: 9,

    elevation: 2,
  },

  userGroupHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 10,
  },

  userGroupIcon: {
    width: 42,
    height: 42,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  userGroupTitle: {
    fontSize: 15,

    fontFamily:
      typography.fontFamily.bold,
  },

  userGroupSubtitle: {
    marginTop: 2,

    fontSize: 11,

    fontFamily:
      typography.fontFamily.regular,
  },

  userTilesGrid: {
    width: 'auto',

    flexDirection: 'row',

    flexWrap: 'wrap',

    marginHorizontal: -4,
  },

  userStatTile: {
    minHeight: 104,

    borderRadius: 14,

    borderWidth: 1,

    paddingVertical: 12,
    paddingHorizontal: 6,

    alignItems: 'center',

    justifyContent: 'center',
  },

  userStatIcon: {
    width: 36,
    height: 36,

    borderRadius: 18,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 7,
  },

  userStatValue: {
    fontSize: IS_WEB ? 22 : 19,

    maxWidth: '100%',

    fontFamily:
      typography.fontFamily.bold,
  },

  userStatLabel: {
    marginTop: 3,

    fontSize: 11,

    lineHeight: 14,

    textAlign: 'center',

    fontFamily:
      typography.fontFamily.medium,
  },

  userProgressBlock: {
    marginTop: 'auto',

    paddingTop: 10,
  },

  userProgressRow: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },

  userProgressLabel: {
    fontSize: 11,

    fontFamily:
      typography.fontFamily.medium,
  },

  userProgressValue: {
    fontSize: 12,

    fontFamily:
      typography.fontFamily.bold,
  },

  userProgressTrack: {
    width: '100%',

    height: 6,

    borderRadius: 10,

    marginTop: 7,

    overflow: 'hidden',
  },

  userProgressBar: {
    height: '100%',

    borderRadius: 10,
  },

  /* ==========================================================
     LOADING
  ========================================================== */

  loadingContainer: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 68,
    height: 68,

    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingTitle: {
    marginTop: 18,

    fontSize: 16,

    fontFamily:
      typography.fontFamily.bold,

    textAlign: 'center',
  },

  loadingText: {
    marginTop: 5,

    fontSize: 12,

    fontFamily:
      typography.fontFamily.regular,

    textAlign: 'center',
  },

  footer: {
    height: 25,
  },
});

export default DashboardScreen;