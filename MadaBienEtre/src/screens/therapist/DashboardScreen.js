// src/screens/therapist/DashboardScreen.js
//
// Tableau de bord THÉRAPEUTE — 100 % dynamique (base de données).
//
//   GET /stats/therapist            -> cartes, gains, graphiques, activités, statut en ligne
//   GET /stats/therapist/services   -> "Services les plus demandés" (jour / semaine / mois)
//   PUT /therapists/toggle-online   -> bouton En ligne / Hors ligne (enregistré en base)
//
// Mise à jour automatique : au montage, au retour sur l'écran (focus),
// toutes les 60 s (silencieux) et par pull-to-refresh.
//
// Responsive : >= 1024 px -> disposition "bureau" (colonnes côte à côte),
// sinon -> disposition mobile (cartes empilées) comme avant.

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
  Platform,
  useWindowDimensions,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import statsService from '../../services/statsService';
import availabilityService from '../../services/availabilityService';
import { formatTimeAgo, toTimestamp } from '../../utils/timeAgo';
import {
  GridBarChart,
  HBars,
  formatCount,
} from '../../components/charts/SimpleCharts';
import AITherapistHomeBlock from '../../components/ai/AITherapistHomeBlock';
import PopularServicesCard from '../../components/therapist/PopularServicesCard';
import { useNotifications } from '../../context/NotificationContext';
import { BREAKPOINTS } from '../../hooks/useResponsive';

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
const HEADER_GREEN = '#2E8B57';
const HEADER_GREEN_DARK = '#2E8B57';

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
            backButtonBg: 'transparent',
            backButtonBorder: 'transparent',
          }
        : {
            isLargeWebScreen: false,
            headerBg: HEADER_GREEN,
            iconColor: '#FFFFFF',
            backButtonBg: 'transparent',
            backButtonBorder: 'transparent',
          },
    [isLargeWebScreen]
  );
};

// ============================================================
// CONSTANTES
// ============================================================

const DEFAULT_GREEN = '#2E8B57';

const GOLD = '#F59E0B';
const RED = '#E45858';
const BLUE = '#3B82F6';

// Écran de chargement (spinner centré + "Mada Bien-être")
const LOADING_GREEN = '#2E8B57';
const LOADING_BACKGROUND = '#F5F5F5';

// Rafraîchissement automatique silencieux (ms)
const AUTO_REFRESH_MS = 60 * 1000;

// Une activité de moins de 24 h reçoit le badge "Nouveau"
const NEW_ACTIVITY_MAX_AGE_MS = 24 * 60 * 60 * 1000;


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
    return `rgba(46, 139, 87, ${alpha})`;
  }

  let clean = hex.replace('#', '');

  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (clean.length !== 6) {
    return `rgba(46, 139, 87, ${alpha})`;
  }

  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  if (
    Number.isNaN(r) ||
    Number.isNaN(g) ||
    Number.isNaN(b)
  ) {
    return `rgba(46, 139, 87, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatPrice = (value) => {
  const number = Number(value || 0);

  return `${number.toLocaleString('fr-FR')} Ar`;
};

// "Juin 26" -> "Juin" (6 mois affichés : pas d'ambiguïté d'année)
const shortMonth = (label) => String(label || '').split(' ')[0];


// ============================================================
// SCREEN
// ============================================================

const DashboardScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const { user, updateProfile } = useAuth();
  const { unreadCount } = useNotifications();
  const { width: windowWidth } = useWindowDimensions();

  // Disposition "bureau" : colonnes côte à côte (>= 1024 px)
  const isWide = windowWidth >= BREAKPOINTS.desktop;
  // Marge latérale des cartes : sur natif, 14 ; sur web le
  // scrollContent applique déjà un padding horizontal.
  const sidePad = Platform.OS === 'web' ? 0 : 14;

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

  // Vert de la maquette (identique sur web, Android et iOS)
  const primaryColor = DEFAULT_GREEN;


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

  // ==========================================================
  // STATES
  // ==========================================================

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Statut en ligne : valeur initiale = celle de l'utilisateur connecté,
  // puis synchronisée avec la base à chaque chargement (data.profile).
  const [isOnline, setIsOnline] = useState(Boolean(user?.is_online));
  const [togglingOnline, setTogglingOnline] = useState(false);

  const [stats, setStats] = useState({
    todayBookings: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    totalBookings: 0,
    rating: 0,
    reviews: 0,
  });

  const [recentActivities, setRecentActivities] = useState([]);

  // Données des graphiques (GET /stats/therapist)
  const [weekly, setWeekly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [byMassageType, setByMassageType] = useState([]);
  const [loadError, setLoadError] = useState(null);

  // Incrémenté à chaque rechargement : relance la carte
  // "Services les plus demandés" (qui a son propre endpoint).
  const [refreshKey, setRefreshKey] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ==========================================================
  // CHARGEMENT DES DONNÉES
  // ==========================================================

  /*
   * isRefresh = true  -> appel silencieux (pull-to-refresh, retour sur
   *                      l'écran, minuteur automatique) : on NE touche
   *                      PAS à isLoading, donc l'écran de chargement
   *                      plein écran ne se réaffiche pas.
   * isRefresh = false -> chargement initial : isLoading passe à true
   *                      (spinner centré + "Mada Bien-être").
   */
  const loadDashboardData = useCallback(async (options = {}) => {
    const { isRefresh = false } = options;

    if (!isRefresh) {
      setIsLoading(true);
    }

    try {
      // ✅ Toutes les valeurs viennent de la base de données
      const data = await statsService.therapist(6);

      if (!isMountedRef.current) {
        return;
      }

      setStats({
        todayBookings: data?.bookings?.today || 0,
        totalEarnings: data?.earnings?.total_net || 0,
        pendingEarnings: data?.earnings?.pending || 0,
        totalBookings: data?.bookings?.total || 0,
        rating: Number(data?.rating?.average || 0)
          .toFixed(1)
          .replace('.', ','),
        reviews: data?.rating?.total_reviews || 0,
      });

      if (typeof data?.profile?.is_online === 'boolean') {
        setIsOnline(data.profile.is_online);
      }

      setWeekly(data?.weekly || []);
      setMonthly(data?.monthly || []);
      setByMassageType(data?.by_massage_type || []);

      setRecentActivities(
        (data?.recent_activities || []).map((a) => {
          const ago = formatTimeAgo(a.time);

          return {
            ...a,
            isNew:
              Date.now() - toTimestamp(a.time) <
              NEW_ACTIVITY_MAX_AGE_MS,
            time:
              !ago || ago === "À l'instant"
                ? ago || 'Récent'
                : `Il y a ${ago}`,
          };
        })
      );

      setRefreshKey((key) => key + 1);
      setLoadError(null);
    } catch (error) {
      console.error('Erreur dashboard :', error);

      if (isMountedRef.current) {
        setLoadError(
          error?.message ||
            'Impossible de charger vos statistiques.'
        );
      }
    } finally {
      if (!isRefresh && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Retour sur l'écran (après une réservation, un paiement…) -> données à jour
  useEffect(() => {
    if (!navigation?.addListener) {
      return undefined;
    }

    const unsubscribe = navigation.addListener('focus', () => {
      loadDashboardData({ isRefresh: true });
    });

    return unsubscribe;
  }, [navigation, loadDashboardData]);

  // Rafraîchissement automatique silencieux
  useEffect(() => {
    const timer = setInterval(() => {
      loadDashboardData({ isRefresh: true });
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
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
  // STATUT EN LIGNE  (enregistré en base : PUT /therapists/toggle-online)
  // ==========================================================

  const toggleOnlineStatus = async () => {
    if (togglingOnline) {
      return;
    }

    const previous = isOnline;

    // Mise à jour immédiate de l'interface, annulée si le serveur refuse
    setIsOnline(!previous);
    setTogglingOnline(true);

    try {
      const result = await availabilityService.toggleOnline();

      if (!result?.success) {
        throw new Error(result?.error || 'Erreur');
      }

      const serverValue =
        typeof result.data?.is_online === 'boolean'
          ? result.data.is_online
          : !previous;

      if (isMountedRef.current) {
        setIsOnline(serverValue);
      }

      // garde le profil local (AuthContext) cohérent avec la base
      updateProfile?.({ is_online: serverValue });
    } catch (error) {
      if (isMountedRef.current) {
        setIsOnline(previous);
      }

      Alert.alert(
        'Statut',
        error?.message ||
          'Impossible de changer votre statut pour le moment.'
      );
    } finally {
      if (isMountedRef.current) {
        setTogglingOnline(false);
      }
    }
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
  // - bureau : carte horizontale compacte (icône | texte | flèche)
  // - mobile : carte verticale (comme avant)
  // ==========================================================

  const renderQuickAction = ({ item }) => {
    if (isWide) {
      return (
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={item.onPress}
          style={[
            styles.quickActionWide,
            {
              backgroundColor: surfaceColor,
              borderColor,
            },
          ]}
        >
          <View
            style={[
              styles.quickActionWideIcon,
              {
                backgroundColor: hexToRgba(item.color, 0.13),
              },
            ]}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={item.color}
            />
          </View>

          <View style={styles.quickActionWideText}>
            <Text
              numberOfLines={1}
              style={[
                styles.quickActionLabel,
                { color: textColor },
              ]}
            >
              {item.label}
            </Text>

            <Text
              numberOfLines={1}
              style={[
                styles.quickActionDescription,
                { color: secondaryTextColor },
              ]}
            >
              {item.description}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={16}
            color={secondaryTextColor}
          />
        </TouchableOpacity>
      );
    }

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
  // isLast : pas de trait de séparation sous le dernier élément
  // d'une colonne.
  // ==========================================================

  const renderActivity = ({ item, index, isLast }) => {
    const activity = getActivityIcon(item.type);

    return (
      <View
        key={item.id ?? index}
        style={[
          styles.activityItem,
          {
            borderBottomColor: isLast
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

        {index === 0 && item.isNew && (
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
  // DONNÉES DÉRIVÉES DES GRAPHIQUES (toutes issues de la base)
  // ==========================================================

  const weeklyData = weekly.map((d) => ({
    label: d.label,
    value: Number(d.earnings) || 0,
  }));

  const monthlyEarnings = monthly.map((m) => ({
    label: shortMonth(m.label),
    value: Number(m.earnings) || 0,
  }));

  const monthlySessions = monthly.map((m) => ({
    label: shortMonth(m.label),
    value: Number(m.bookings) || 0,
  }));

  // Activités en 2 colonnes sur grand écran
  const activityColumns = useMemo(() => {
    if (!isWide) {
      return [recentActivities];
    }

    const half = Math.ceil(recentActivities.length / 2);

    return [
      recentActivities.slice(0, half),
      recentActivities.slice(half),
    ];
  }, [isWide, recentActivities]);

  // Style d'une carte placée dans une ligne à colonnes (bureau)
  const cellStyle = (flex) =>
    isWide
      ? { flex, marginHorizontal: 0, marginTop: 0, minWidth: 0 }
      : null;

  // Conteneur d'une ligne : colonnes sur bureau, pile sur mobile
  const rowStyle = [
    styles.row,
    {
      marginHorizontal: sidePad,
      flexDirection: isWide ? 'row' : 'column',
    },
  ];

  // ==========================================================
  // LOADING
  // Spinner vert centré au milieu de l'écran + texte
  // "Mada Bien-être" en dessous (affiché à l'actualisation
  // de la page / au premier chargement).
  // ==========================================================

  if (isLoading) {
    return (
      <View
        style={styles.loadingContainer}
        accessibilityRole="progressbar"
        accessibilityLabel="Chargement en cours"
      >
        <ActivityIndicator
          size={Platform.OS === 'ios' ? 'large' : 42}
          color={LOADING_GREEN}
        />

        <Text style={styles.loadingText}>
          Mada Bien-être
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
                <View style={styles.headerBellWrap}>
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
                </View>
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
            style={isWide ? styles.topSectionWide : styles.topSection}
          >
            <LinearGradient
              colors={[
                '#2E8B57',
                '#4FA06F',
                '#6DB88A',
              ]}
              start={{
                x: 0,
                y: 0.5,
              }}
              end={{
                x: 1,
                y: 0.5,
              }}
              style={[
                styles.welcomeCard,
                isWide && styles.welcomeCardWide,
              ]}
            >
              <View style={styles.welcomeDecorCircleOne} />
              <View style={styles.welcomeDecorCircleTwo} />

              <View
                style={[
                  styles.welcomeTopRow,
                  isWide && styles.welcomeTopRowWide,
                ]}
              >
                <View style={styles.welcomeIdentity}>
                  <Text style={styles.welcomeSmallText}>
                    Bonjour,
                  </Text>

                  <View style={styles.welcomeNameRow}>
                    <Text
                      numberOfLines={1}
                      style={styles.welcomeName}
                    >
                      {user?.fullname ||
                        user?.full_name ||
                        user?.name ||
                        'Thérapeute'}
                    </Text>

                    {isWide && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={toggleOnlineStatus}
                        disabled={togglingOnline}
                        style={[
                          styles.onlineToggle,
                          styles.onlineToggleInline,
                          {
                            backgroundColor: isOnline
                              ? '#FFFFFF'
                              : 'rgba(15,23,42,0.28)',
                          },
                        ]}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: isOnline }}
                      >
                        <View
                          style={[
                            styles.onlineToggleDot,
                            {
                              backgroundColor: isOnline
                                ? '#22C55E'
                                : '#CBD5E1',
                            },
                          ]}
                        />

                        <Text
                          style={[
                            styles.onlineToggleText,
                            {
                              color: isOnline
                                ? '#2E8B57'
                                : '#FFFFFF',
                            },
                          ]}
                        >
                          {isOnline
                            ? 'En ligne'
                            : 'Hors ligne'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.welcomeDescription}>
                    Voici le résumé de votre activité
                  </Text>
                </View>

                {!isWide && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={toggleOnlineStatus}
                    disabled={togglingOnline}
                    style={[
                      styles.onlineToggle,
                      {
                        backgroundColor: isOnline
                          ? 'rgba(255,255,255,0.22)'
                          : 'rgba(15,23,42,0.22)',
                      },
                    ]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: isOnline }}
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
                )}
              </View>

              <View
                style={[
                  styles.welcomeStatsRow,
                  isWide && styles.welcomeStatsRowWide,
                ]}
              >
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

                <TouchableOpacity
                  style={styles.welcomeStat}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('Reviews')}
                >
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
                    Note · {stats.reviews} avis
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animatable.View>

          {/* ==================================================
              ERREUR DE CHARGEMENT
          ================================================== */}

          {loadError ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: surfaceColor,
                  borderColor,
                },
              ]}
            >
              <Text
                style={{
                  color: secondaryTextColor,
                }}
              >
                {loadError}
              </Text>

              <TouchableOpacity
                onPress={() => loadDashboardData()}
                style={{ marginTop: 8 }}
              >
                <Text
                  style={{
                    color: primaryColor,
                  }}
                >
                  Réessayer
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ==================================================
              NOTIFICATION (nombre réel de non lues)
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
                  isWide && styles.notificationCardWide,
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
                    isWide && styles.notificationCardIconWide,
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
                    size={isWide ? 15 : 21}
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

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={isWide ? secondaryTextColor : primaryColor}
                />
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
            <View
              style={[
                styles.sectionHeader,
                isWide && styles.sectionHeaderWide,
              ]}
            >
              <View
                style={
                  isWide
                    ? styles.sectionTitleInline
                    : null
                }
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    isWide && styles.sectionTitleWide,
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
                    isWide && { marginTop: 0, marginLeft: 14 },
                    {
                      color: secondaryTextColor,
                    },
                  ]}
                >
                  Gérez votre activité en quelques clics
                </Text>
              </View>

              {!isWide && (
                <View
                  style={[
                    styles.sectionAccent,
                    {
                      backgroundColor: primaryColor,
                    },
                  ]}
                />
              )}
            </View>

            {isWide || Platform.OS === 'web' ? (
              <View
                style={[
                  styles.quickActionsGrid,
                  isWide && { marginHorizontal: sidePad },
                ]}
              >
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
              ✨ IA — TARIFICATION INTELLIGENTE  |  SERVICES LES PLUS DEMANDÉS
              Bureau : 2 colonnes. Mobile : l'un sous l'autre.
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={220}
            duration={500}
            style={[rowStyle, { marginTop: 14 }]}
          >
            {/* Wrapper SANS padding/bordure : 2 colonnes strictement égales */}
            <View style={isWide ? styles.rowColumnWide : null}>
              <View
                style={[
                  styles.aiWrapWide,
                  isWide && { flex: 1 },
                  {
                    backgroundColor: surfaceColor,
                    borderColor,
                  },
                ]}
              >
                <AITherapistHomeBlock
                  showPopular={false}
                  compact
                  onOpenAssistant={(tab) =>
                    navigation.navigate('AIAssistant', { initialTab: tab })
                  }
                />
              </View>
            </View>

            <View style={isWide ? styles.rowColumnWide : null}>
              <PopularServicesCard
                refreshKey={refreshKey}
                style={[
                  !isWide && { marginTop: 14 },
                  isWide && { flex: 1 },
                ]}
              />
            </View>
          </Animatable.View>

          {/* ==================================================
              GAINS  |  ÉVOLUTION DES REVENUS (7 derniers jours)
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={300}
            duration={500}
            style={rowStyle}
          >
            <View
              style={[
                styles.card,
                cellStyle(1),
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
                  <View style={styles.earningIcon}>
                    <Ionicons
                      name="wallet-outline"
                      size={13}
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
                  <View style={styles.earningIcon}>
                    <Ionicons
                      name="time-outline"
                      size={13}
                      color="#D97706"
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
                        color: '#B45309',
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
                style={[
                  styles.withdrawButton,
                  { backgroundColor: primaryColor },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Retirer mes gains"
              >
                <Text style={styles.withdrawText}>
                  Retirer mes gains
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.card,
                cellStyle(2),
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
              </View>

              <GridBarChart
                data={weeklyData}
                color={primaryColor}
                name="Revenus"
                height={150}
                nice
                showValues
                barWidth={isWide ? 40 : 26}
                textColor={secondaryTextColor}
                gridColor={borderColor}
              />
            </View>
          </Animatable.View>

          {/* ==================================================
              GRAPHIQUES MENSUELS (6 derniers mois) + MASSAGES
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={400}
            duration={500}
            style={rowStyle}
          >
            <View
              style={[
                styles.card,
                cellStyle(1),
                {
                  backgroundColor: surfaceColor,
                  borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: textColor,
                    marginBottom: 4,
                  },
                ]}
              >
                Mes gains (6 derniers mois)
              </Text>

              <GridBarChart
                data={monthlyEarnings}
                color={primaryColor}
                name="Gains nets"
                nice
                barWidth={isWide ? 30 : 22}
                textColor={secondaryTextColor}
                gridColor={borderColor}
              />
            </View>

            <View
              style={[
                styles.card,
                cellStyle(1),
                {
                  backgroundColor: surfaceColor,
                  borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: textColor,
                    marginBottom: 4,
                  },
                ]}
              >
                Séances terminées par mois
              </Text>

              <GridBarChart
                data={monthlySessions}
                color={BLUE}
                name="Séances"
                integer
                format={formatCount}
                barWidth={isWide ? 30 : 22}
                textColor={secondaryTextColor}
                gridColor={borderColor}
              />
            </View>

            <View
              style={[
                styles.card,
                cellStyle(1),
                {
                  backgroundColor: surfaceColor,
                  borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: textColor,
                    marginBottom: 10,
                  },
                ]}
              >
                Massages les plus demandés
              </Text>

              <HBars
                items={byMassageType.map((t) => ({
                  label: t.label,
                  value: t.count,
                  color: GOLD,
                }))}
                format={formatCount}
                textColor={textColor}
                trackColor={borderColor}
              />
            </View>
          </Animatable.View>

          {/* ==================================================
              ACTIVITÉS RÉCENTES (2 colonnes sur bureau)
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

                {!isWide && (
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
                )}
              </View>

              {recentActivities.length > 0 ? (
                <View
                  style={{
                    flexDirection: isWide ? 'row' : 'column',
                    gap: isWide ? 24 : 0,
                  }}
                >
                  {activityColumns.map((column, columnIndex) => (
                    <View
                      key={columnIndex}
                      style={isWide ? { flex: 1, minWidth: 0 } : null}
                    >
                      {column.map((item, index) =>
                        renderActivity({
                          item,
                          // le badge "Nouveau" ne concerne que la toute
                          // première activité (colonne de gauche)
                          index: columnIndex === 0 ? index : index + 1,
                          isLast: index === column.length - 1,
                        })
                      )}
                    </View>
                  ))}
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
  // ==========================================================
  // DISPOSITION BUREAU (>= 1024 px)
  // ==========================================================

  row: {
    marginTop: 12,
    gap: 12,
    alignItems: 'stretch',
  },

  topSectionWide: {
    marginTop: 10,
    width: '100%',
  },

  welcomeCardWide: {
    marginHorizontal: 0,
    minHeight: 112,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  welcomeTopRowWide: {
    flex: 1,
  },

  welcomeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
  },

  onlineToggleInline: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginTop: 4,
  },

  welcomeStatsRowWide: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
    width: 620,
    maxWidth: '55%',
  },

  notificationCardWide: {
    marginHorizontal: 0,
    marginTop: 10,
    minHeight: 46,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    elevation: 0,
    shadowOpacity: 0,
  },

  notificationCardIconWide: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },

  sectionHeaderWide: {
    marginHorizontal: 0,
    marginTop: 12,
    marginBottom: 8,
  },

  sectionTitleInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  sectionTitleWide: {
    fontSize: 14,
  },

  quickActionWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  quickActionWideIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActionWideText: {
    flex: 1,
    minWidth: 0,
  },

  aiWrapWide: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginHorizontal: 0,
  },

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
  // Spinner centré (horizontalement + verticalement) avec le
  // texte "Mada Bien-être" en dessous.
  // ==========================================================

  loadingContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: LOADING_BACKGROUND,
  },

  loadingText: {
    marginTop: 22,
    fontSize: 22,
    textAlign: 'center',
    fontWeight: '400',
    color: LOADING_GREEN,
    fontFamily: Platform.select({
      web: "'Times New Roman', Times, serif",
      ios: 'Times New Roman',
      android: 'serif',
      default: 'serif',
    }),
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
    top: -8,
    right: -9,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    backgroundColor: '#E45858',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  headerNotificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
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
    shadowColor: '#2E8B57',
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

  // 2 colonnes de largeur strictement égale (wrapper sans padding ni bordure)
  rowColumnWide: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },

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
    minHeight: 82,
    borderRadius: 10,
    borderWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  earningIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  earningLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  earningValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },

  withdrawButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },


  withdrawText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
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