// src/screens/therapist/DashboardScreen.js

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Animated,
  Dimensions,
  Platform,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

import {
  colors,
  spacing,
  typography,
} from '../../theme';


// ============================================================
// DIMENSIONS
// ============================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');


// ============================================================
// CHART
// ============================================================

let LineChart = null;

if (Platform.OS !== 'web') {
  try {
    const ChartKit = require('react-native-chart-kit');
    LineChart = ChartKit.LineChart;
  } catch (error) {
    console.warn(
      'react-native-chart-kit non disponible'
    );
  }
}


// ============================================================
// HELPERS
// ============================================================

const safeColor = (
  value,
  fallback
) => {
  return (
    typeof value === 'string' &&
    value.length > 0
  )
    ? value
    : fallback;
};


const hexToRgba = (
  hex,
  alpha = 0.12
) => {
  if (
    typeof hex !== 'string' ||
    !hex.startsWith('#')
  ) {
    return `rgba(30, 64, 175, ${alpha})`;
  }

  let clean = hex.replace('#', '');

  if (clean.length === 3) {
    clean = clean
      .split('')
      .map(char => char + char)
      .join('');
  }

  if (clean.length !== 6) {
    return `rgba(30, 64, 175, ${alpha})`;
  }

  const r = parseInt(
    clean.substring(0, 2),
    16
  );

  const g = parseInt(
    clean.substring(2, 4),
    16
  );

  const b = parseInt(
    clean.substring(4, 6),
    16
  );

  if (
    Number.isNaN(r) ||
    Number.isNaN(g) ||
    Number.isNaN(b)
  ) {
    return `rgba(30, 64, 175, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};


const formatPrice = value => {
  const number = Number(value || 0);

  return `${number.toLocaleString(
    'fr-FR'
  )} Ar`;
};


// ============================================================
// SCREEN
// ============================================================

const DashboardScreen = ({
  navigation,
}) => {

  const {
    colors: themeColors,
  } = useTheme();

  const {
    user,
  } = useAuth();

  const {
    unreadCount,
  } = useNotifications();


  // ==========================================================
  // COLORS
  // ==========================================================

  const primaryColor = safeColor(
    colors.primary,
    '#1E40AF'
  );

  const primaryLight = safeColor(
    colors.primaryLight,
    primaryColor
  );

  const secondaryColor = safeColor(
    colors.secondary,
    '#FF6B6B'
  );

  const accentColor = safeColor(
    colors.accent,
    '#FF9800'
  );

  const errorColor = safeColor(
    colors.error,
    '#E53935'
  );

  const backgroundColor = safeColor(
    themeColors?.background,
    '#F6F8FC'
  );

  const surfaceColor = safeColor(
    themeColors?.surface,
    '#FFFFFF'
  );

  const textColor = safeColor(
    themeColors?.text,
    '#172033'
  );

  const secondaryTextColor = safeColor(
    themeColors?.textSecondary,
    '#718096'
  );

  const borderColor = safeColor(
    themeColors?.border,
    '#E6EAF0'
  );


  // ==========================================================
  // STATE
  // ==========================================================

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isOnline,
    setIsOnline,
  ] = useState(true);

  const [
    stats,
    setStats,
  ] = useState({
    todayBookings: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    totalBookings: 0,
    rating: 0,
    reviews: 0,
  });

  const [
    recentActivities,
    setRecentActivities,
  ] = useState([]);


  const scrollY = useRef(
    new Animated.Value(0)
  ).current;


  // ==========================================================
  // LOAD DASHBOARD
  // ==========================================================

  const loadDashboardData =
    useCallback(
      async () => {

        setIsLoading(true);

        try {

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                400
              )
          );

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
              message:
                'Nouvelle réservation de Marie L.',
              time: '10:30',
            },
            {
              id: 2,
              type: 'payment',
              message:
                'Paiement reçu de Jean R. - 45 000 Ar',
              time: '09:15',
            },
            {
              id: 3,
              type: 'review',
              message:
                'Nouvel avis 5⭐ de Sarah M.',
              time: 'Hier',
            },
          ]);

        } catch (error) {

          console.error(
            'Erreur dashboard:',
            error
          );

        } finally {

          setIsLoading(false);

        }

      },
      []
    );


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadDashboardData();
  }, [
    loadDashboardData,
  ]);


  // ==========================================================
  // REFRESH
  // ==========================================================

  const onRefresh = async () => {

    setRefreshing(true);

    try {

      await loadDashboardData();

    } finally {

      setRefreshing(false);

    }
  };


  // ==========================================================
  // ONLINE STATUS
  // ==========================================================

  const toggleOnlineStatus =
    async () => {

      setIsOnline(
        current => !current
      );

    };


  // ==========================================================
  // NOTIFICATIONS
  // ==========================================================

  const openNotifications =
    useCallback(() => {

      navigation.navigate(
        'TherapistNotifications'
      );

    }, [
      navigation,
    ]);


  // ==========================================================
  // PROFILE
  // ==========================================================

  const openProfile = () => {

    navigation.navigate(
      'Profil'
    );

  };


  // ==========================================================
  // DEMANDES
  // ==========================================================

  const openDemandes = () => {

    navigation.navigate(
      'Demandes'
    );

  };


  // ==========================================================
  // QUICK ACTIONS
  // ==========================================================

  const quickActions = [

    {
      id: 'requests',
      icon: 'chatbubbles-outline',
      label: 'Demandes',
      description: 'Voir les demandes',
      color: primaryColor,
      onPress:
        openDemandes,
    },

    {
      id: 'calendar',
      icon: 'calendar-outline',
      label: 'Calendrier',
      description: 'Mes rendez-vous',
      color: secondaryColor,
      onPress: () =>
        navigation.navigate(
          'Calendrier'
        ),
    },

    {
      id: 'earnings',
      icon: 'wallet-outline',
      label: 'Gains',
      description: 'Mes revenus',
      color: accentColor,
      onPress: () =>
        navigation.navigate(
          'Gains'
        ),
    },

    {
      id: 'sos',
      icon: 'alert-circle-outline',
      label: 'SOS',
      description: 'Assistance',
      color: errorColor,
      onPress: () =>
        Alert.alert(
          'SOS',
          "La fonctionnalité SOS n'est pas encore activée."
        ),
    },

  ];


  // ==========================================================
  // QUICK ACTION ITEM
  // ==========================================================

  const renderQuickAction =
    ({
      item,
    }) => (

      <TouchableOpacity
        style={[
          styles.quickAction,
          Platform.OS === 'web' &&
            styles.quickActionWeb,
          {
            backgroundColor:
              surfaceColor,
            borderColor:
              borderColor,
          },
        ]}
        onPress={
          item.onPress
        }
        activeOpacity={0.8}
      >

        <View
          style={[
            styles.quickActionIcon,
            {
              backgroundColor:
                hexToRgba(
                  item.color,
                  0.11
                ),
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
              color:
                textColor,
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
              color:
                secondaryTextColor,
            },
          ]}
        >
          {item.description}
        </Text>

      </TouchableOpacity>

    );


  // ==========================================================
  // ACTIVITY ICON
  // ==========================================================

  const getActivityIcon =
    type => {

      if (type === 'booking') {
        return {
          name:
            'calendar-outline',
          color:
            primaryColor,
        };
      }

      if (type === 'payment') {
        return {
          name:
            'cash-outline',
          color:
            '#4CAF50',
        };
      }

      if (type === 'review') {
        return {
          name:
            'star-outline',
          color:
            '#F59E0B',
        };
      }

      return {
        name:
          'notifications-outline',
        color:
          primaryColor,
      };
    };


  // ==========================================================
  // ACTIVITY
  // ==========================================================

  const renderActivity =
    ({
      item,
      index,
    }) => {

      const activity =
        getActivityIcon(
          item.type
        );

      return (

        <View
          key={item.id}
          style={[
            styles.activityItem,
            {
              borderBottomColor:
                borderColor,
            },
          ]}
        >

          <View
            style={[
              styles.activityIcon,
              {
                backgroundColor:
                  hexToRgba(
                    activity.color,
                    0.1
                  ),
              },
            ]}
          >

            <Ionicons
              name={
                activity.name
              }
              size={19}
              color={
                activity.color
              }
            />

          </View>


          <View
            style={
              styles.activityContent
            }
          >

            <Text
              numberOfLines={2}
              style={[
                styles.activityText,
                {
                  color:
                    textColor,
                },
              ]}
            >
              {item.message}
            </Text>

            <Text
              style={[
                styles.activityTime,
                {
                  color:
                    secondaryTextColor,
                },
              ]}
            >
              {item.time}
            </Text>

          </View>

          {index === 0 && (

            <View
              style={[
                styles.newActivityBadge,
                {
                  backgroundColor:
                    hexToRgba(
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
                    color:
                      primaryColor,
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
  // CHART
  // ==========================================================

  const ChartComponent =
    () => {

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


      // ========================================================
      // WEB CHART
      // ========================================================

      if (
        Platform.OS === 'web'
      ) {

        const maxValue =
          Math.max(
            ...chartData.datasets[0].data
          );

        return (

          <View
            style={
              styles.webChartContainer
            }
          >

            <View
              style={
                styles.webChartBars
              }
            >

              {chartData
                .datasets[0]
                .data
                .map(
                  (
                    value,
                    index
                  ) => {

                    const height =
                      maxValue > 0
                        ? (
                            value /
                            maxValue
                          ) * 125
                        : 0;

                    return (

                      <View
                        key={index}
                        style={
                          styles.webChartBarWrapper
                        }
                      >

                        <Text
                          style={[
                            styles.webChartValue,
                            {
                              color:
                                secondaryTextColor,
                            },
                          ]}
                        >
                          {(
                            value /
                            1000
                          ).toFixed(0)}
                          k
                        </Text>

                        <View
                          style={[
                            styles.webChartBar,
                            {
                              height:
                                Math.max(
                                  height,
                                  5
                                ),
                              backgroundColor:
                                primaryColor,
                            },
                          ]}
                        />

                      </View>

                    );

                  }
                )}

            </View>


            <View
              style={
                styles.webChartLabels
              }
            >

              {chartData.labels.map(
                (
                  label,
                  index
                ) => (

                  <Text
                    key={index}
                    style={[
                      styles.webChartLabel,
                      {
                        color:
                          secondaryTextColor,
                      },
                    ]}
                  >
                    {label}
                  </Text>

                )
              )}

            </View>

          </View>

        );
      }


      // ========================================================
      // MOBILE CHART
      // ========================================================

      if (LineChart) {

        return (

          <LineChart
            data={
              chartData
            }
            width={
              Math.min(
                SCREEN_WIDTH - 48,
                520
              )
            }
            height={180}
            chartConfig={{
              backgroundColor:
                surfaceColor,
              backgroundGradientFrom:
                surfaceColor,
              backgroundGradientTo:
                surfaceColor,
              decimalPlaces: 0,
              color:
                () =>
                  primaryColor,
              labelColor:
                () =>
                  secondaryTextColor,
              propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke:
                  primaryColor,
              },
            }}
            bezier
            style={
              styles.chart
            }
            formatYLabel={
              value =>
                `${(
                  Number(value) /
                  1000
                ).toFixed(0)}k`
            }
          />

        );
      }


      return (

        <View
          style={
            styles.chartFallback
          }
        >

          <Ionicons
            name="bar-chart-outline"
            size={34}
            color={
              secondaryTextColor
            }
          />

          <Text
            style={[
              styles.chartFallbackText,
              {
                color:
                  secondaryTextColor,
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
            backgroundColor:
              backgroundColor,
          },
        ]}
      >

        <View
          style={[
            styles.loadingIcon,
            {
              backgroundColor:
                hexToRgba(
                  primaryColor,
                  0.1
                ),
            },
          ]}
        >

          <Ionicons
            name="sparkles-outline"
            size={30}
            color={
              primaryColor
            }
          />

        </View>

        <ActivityIndicator
          size="large"
          color={
            primaryColor
          }
          style={{
            marginTop:
              spacing.md,
          }}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color:
                secondaryTextColor,
            },
          ]}
        >
          Chargement du tableau de bord...
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
          backgroundColor:
            backgroundColor,
        },
      ]}
    >

      <View
        style={[
          styles.container,
          {
            backgroundColor:
              backgroundColor,
          },
        ]}
      >

        {/* ==================================================
            HEADER
        ================================================== */}

        <View
          style={[
            styles.headerWrapper,
            {
              backgroundColor:
                surfaceColor,
              borderBottomColor:
                borderColor,
            },
          ]}
        >

          <View
            style={
              styles.headerContent
            }
          >

            {/* PROFILE */}

            <TouchableOpacity
              onPress={
                openProfile
              }
              activeOpacity={0.75}
              style={
                styles.profileButton
              }
            >

              <View
                style={[
                  styles.profileCircle,
                  {
                    backgroundColor:
                      hexToRgba(
                        primaryColor,
                        0.1
                      ),
                  },
                ]}
              >

                <Ionicons
                  name="person-outline"
                  size={21}
                  color={
                    primaryColor
                  }
                />

              </View>

            </TouchableOpacity>


            {/* CENTER */}

            <View
              style={
                styles.headerCenter
              }
            >

              <Text
                style={[
                  styles.headerTitle,
                  {
                    color:
                      primaryColor,
                  },
                ]}
              >
                Mada Bien-être
              </Text>

              <View
                style={
                  styles.headerSubtitleRow
                }
              >

                <View
                  style={[
                    styles.headerOnlineDot,
                    {
                      backgroundColor:
                        isOnline
                          ? '#22C55E'
                          : '#94A3B8',
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.headerSubtitle,
                    {
                      color:
                        secondaryTextColor,
                    },
                  ]}
                >
                  Espace thérapeute
                </Text>

              </View>

            </View>


            {/* NOTIFICATION */}

            <TouchableOpacity
              onPress={
                openNotifications
              }
              activeOpacity={0.75}
              style={
                styles.notificationButton
              }
              accessibilityRole="button"
              accessibilityLabel="Ouvrir les notifications du thérapeute"
            >

              <View
                style={[
                  styles.notificationIconContainer,
                  {
                    backgroundColor:
                      unreadCount > 0
                        ? hexToRgba(
                            primaryColor,
                            0.1
                          )
                        : 'transparent',
                  },
                ]}
              >

                <Ionicons
                  name={
                    unreadCount > 0
                      ? 'notifications'
                      : 'notifications-outline'
                  }
                  size={24}
                  color={
                    unreadCount > 0
                      ? primaryColor
                      : textColor
                  }
                />

                {unreadCount > 0 && (

                  <View
                    style={[
                      styles.notificationBadge,
                      {
                        backgroundColor:
                          errorColor,
                      },
                    ]}
                  >

                    <Text
                      style={
                        styles.notificationBadgeText
                      }
                    >
                      {unreadCount > 99
                        ? '99+'
                        : unreadCount}
                    </Text>

                  </View>

                )}

              </View>

            </TouchableOpacity>

          </View>

        </View>


        {/* ==================================================
            MAIN SCROLL
        ================================================== */}

        <Animated.ScrollView

          showsVerticalScrollIndicator={
            false
          }

          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                onRefresh
              }
              colors={[
                primaryColor,
              ]}
              tintColor={
                primaryColor
              }
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
              useNativeDriver:
                true,
            }
          )}

          scrollEventThrottle={
            16
          }

          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'web' &&
              styles.scrollContentWeb,
          ]}
        >


          {/* ==================================================
              WELCOME / STATUS
          ================================================== */}

          <Animatable.View
            animation="fadeInDown"
            duration={500}
            style={
              styles.sectionTop
            }
          >

            <LinearGradient
              colors={[
                primaryColor,
                primaryLight,
              ]}
              style={
                styles.statusCard
              }
              start={{
                x: 0,
                y: 0,
              }}
              end={{
                x: 1,
                y: 1,
              }}
            >

              <View
                style={
                  styles.statusTop
                }
              >

                <View
                  style={
                    styles.statusIdentity
                  }
                >

                  <Text
                    style={
                      styles.statusGreeting
                    }
                  >
                    Bonjour 👋
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={
                      styles.statusName
                    }
                  >
                    {user?.fullname ||
                      'Thérapeute'}
                  </Text>

                  <Text
                    style={
                      styles.statusRole
                    }
                  >
                    Votre activité bien-être
                  </Text>

                </View>


                {/* ONLINE */}

                <TouchableOpacity
                  style={[
                    styles.statusToggle,
                    {
                      backgroundColor:
                        isOnline
                          ? 'rgba(34,197,94,0.95)'
                          : 'rgba(100,116,139,0.95)',
                    },
                  ]}
                  onPress={
                    toggleOnlineStatus
                  }
                  activeOpacity={0.85}
                >

                  <View
                    style={
                      styles.statusDot
                    }
                  />

                  <Text
                    style={
                      styles.statusToggleText
                    }
                  >
                    {isOnline
                      ? 'En ligne'
                      : 'Hors ligne'}
                  </Text>

                </TouchableOpacity>

              </View>


              {/* STATS */}

              <View
                style={
                  styles.statusStats
                }
              >

                <View
                  style={
                    styles.statusStat
                  }
                >

                  <Text
                    style={
                      styles.statusStatNumber
                    }
                  >
                    {
                      stats.todayBookings
                    }
                  </Text>

                  <Text
                    style={
                      styles.statusStatLabel
                    }
                  >
                    Aujourd'hui
                  </Text>

                </View>


                <View
                  style={
                    styles.statusDivider
                  }
                />


                <View
                  style={
                    styles.statusStat
                  }
                >

                  <Text
                    style={
                      styles.statusStatNumber
                    }
                  >
                    {
                      stats.totalBookings
                    }
                  </Text>

                  <Text
                    style={
                      styles.statusStatLabel
                    }
                  >
                    Réservations
                  </Text>

                </View>


                <View
                  style={
                    styles.statusDivider
                  }
                />


                <View
                  style={
                    styles.statusStat
                  }
                >

                  <Text
                    style={
                      styles.statusStatNumber
                    }
                  >
                    {stats.rating}
                  </Text>

                  <Text
                    style={
                      styles.statusStatLabel
                    }
                  >
                    Note ⭐
                  </Text>

                </View>

              </View>

            </LinearGradient>

          </Animatable.View>


          {/* ==================================================
              NOTIFICATION SHORTCUT
          ================================================== */}

          {unreadCount > 0 && (

            <Animatable.View
              animation="fadeInUp"
              delay={100}
              duration={450}
            >

              <TouchableOpacity
                style={[
                  styles.notificationPreview,
                  {
                    backgroundColor:
                      surfaceColor,
                    borderColor:
                      hexToRgba(
                        primaryColor,
                        0.18
                      ),
                  },
                ]}
                onPress={
                  openNotifications
                }
                activeOpacity={0.82}
              >

                <View
                  style={[
                    styles.notificationPreviewIcon,
                    {
                      backgroundColor:
                        hexToRgba(
                          primaryColor,
                          0.1
                        ),
                    },
                  ]}
                >

                  <Ionicons
                    name="notifications"
                    size={21}
                    color={
                      primaryColor
                    }
                  />

                </View>


                <View
                  style={
                    styles.notificationPreviewContent
                  }
                >

                  <Text
                    style={[
                      styles.notificationPreviewTitle,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    Vous avez{' '}
                    {unreadCount}{' '}
                    nouvelle
                    {unreadCount > 1
                      ? 's'
                      : ''}{' '}
                    notification
                    {unreadCount > 1
                      ? 's'
                      : ''}
                  </Text>

                  <Text
                    style={[
                      styles.notificationPreviewSubtitle,
                      {
                        color:
                          secondaryTextColor,
                      },
                    ]}
                  >
                    Appuyez pour consulter
                  </Text>

                </View>


                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={
                    secondaryTextColor
                  }
                />

              </TouchableOpacity>

            </Animatable.View>

          )}


          {/* ==================================================
              QUICK ACTIONS
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={150}
            duration={500}
          >

            <View
              style={
                styles.sectionHeader
              }
            >

              <View>

                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color:
                        textColor,
                    },
                  ]}
                >
                  Accès rapide
                </Text>

                <Text
                  style={[
                    styles.sectionSubtitle,
                    {
                      color:
                        secondaryTextColor,
                    },
                  ]}
                >
                  Gérez votre activité
                </Text>

              </View>

            </View>


            {/* ==================================================
                WEB = 4 CARDS FULL WIDTH
                MOBILE = HORIZONTAL LIST
            ================================================== */}

            {Platform.OS === 'web' ? (

              <View
                style={
                  styles.quickActionsGrid
                }
              >

                {quickActions.map(
                  item =>
                    <View
                      key={item.id}
                      style={
                        styles.quickActionGridItem
                      }
                    >
                      {renderQuickAction({
                        item,
                      })}
                    </View>
                )}

              </View>

            ) : (

              <FlatList
                data={
                  quickActions
                }
                renderItem={
                  renderQuickAction
                }
                keyExtractor={
                  item =>
                    item.id
                }
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.quickActionsList
                }
              />

            )}

          </Animatable.View>


          {/* ==================================================
              EARNINGS
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={250}
            duration={500}
          >

            <View
              style={[
                styles.earningsCard,
                {
                  backgroundColor:
                    surfaceColor,
                  borderColor:
                    borderColor,
                },
              ]}
            >

              <View
                style={
                  styles.cardHeader
                }
              >

                <View>

                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    Mes gains
                  </Text>

                  <Text
                    style={[
                      styles.cardSubtitle,
                      {
                        color:
                          secondaryTextColor,
                      },
                    ]}
                  >
                    Résumé de votre activité
                  </Text>

                </View>


                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate(
                      'Gains'
                    )
                  }
                  style={
                    styles.seeAllButton
                  }
                  activeOpacity={0.7}
                >

                  <Text
                    style={[
                      styles.seeAllText,
                      {
                        color:
                          primaryColor,
                      },
                    ]}
                  >
                    Voir tout
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={
                      primaryColor
                    }
                  />

                </TouchableOpacity>

              </View>


              <View
                style={
                  styles.earningsGrid
                }
              >

                <View
                  style={[
                    styles.earningsBox,
                    {
                      backgroundColor:
                        hexToRgba(
                          primaryColor,
                          0.06
                        ),
                    },
                  ]}
                >

                  <View
                    style={[
                      styles.earningsBoxIcon,
                      {
                        backgroundColor:
                          hexToRgba(
                            primaryColor,
                            0.12
                          ),
                      },
                    ]}
                  >

                    <Ionicons
                      name="wallet-outline"
                      size={20}
                      color={
                        primaryColor
                      }
                    />

                  </View>

                  <Text
                    style={[
                      styles.earningsLabel,
                      {
                        color:
                          secondaryTextColor,
                      },
                    ]}
                  >
                    Total
                  </Text>

                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      styles.earningsValue,
                      {
                        color:
                          primaryColor,
                      },
                    ]}
                  >
                    {formatPrice(
                      stats.totalEarnings
                    )}
                  </Text>

                </View>


                <View
                  style={[
                    styles.earningsBox,
                    {
                      backgroundColor:
                        hexToRgba(
                          secondaryColor,
                          0.06
                        ),
                    },
                  ]}
                >

                  <View
                    style={[
                      styles.earningsBoxIcon,
                      {
                        backgroundColor:
                          hexToRgba(
                            secondaryColor,
                            0.12
                          ),
                      },
                    ]}
                  >

                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={
                        secondaryColor
                      }
                    />

                  </View>

                  <Text
                    style={[
                      styles.earningsLabel,
                      {
                        color:
                          secondaryTextColor,
                      },
                    ]}
                  >
                    En attente
                  </Text>

                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      styles.earningsValue,
                      {
                        color:
                          secondaryColor,
                      },
                    ]}
                  >
                    {formatPrice(
                      stats.pendingEarnings
                    )}
                  </Text>

                </View>

              </View>


              <TouchableOpacity
                style={
                  styles.withdrawButton
                }
                onPress={() =>
                  navigation.navigate(
                    'Withdraw'
                  )
                }
                activeOpacity={0.85}
              >

                <LinearGradient
                  colors={[
                    primaryColor,
                    primaryLight,
                  ]}
                  style={
                    styles.withdrawGradient
                  }
                  start={{
                    x: 0,
                    y: 0,
                  }}
                  end={{
                    x: 1,
                    y: 0,
                  }}
                >

                  <Ionicons
                    name="arrow-up-circle-outline"
                    size={20}
                    color="#fff"
                  />

                  <Text
                    style={
                      styles.withdrawText
                    }
                  >
                    Retirer mes gains
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#fff"
                  />

                </LinearGradient>

              </TouchableOpacity>

            </View>

          </Animatable.View>


          {/* ==================================================
              CHART
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={350}
            duration={500}
          >

            <View
              style={[
                styles.chartCard,
                {
                  backgroundColor:
                    surfaceColor,
                  borderColor:
                    borderColor,
                },
              ]}
            >

              <View
                style={
                  styles.cardHeader
                }
              >

                <View>

                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    Revenus
                  </Text>

                  <Text
                    style={[
                      styles.cardSubtitle,
                      {
                        color:
                          secondaryTextColor,
                      },
                    ]}
                  >
                    Les 7 derniers jours
                  </Text>

                </View>

                <View
                  style={[
                    styles.chartIndicator,
                    {
                      backgroundColor:
                        hexToRgba(
                          primaryColor,
                          0.1
                        ),
                    },
                  ]}
                >

                  <View
                    style={[
                      styles.chartIndicatorDot,
                      {
                        backgroundColor:
                          primaryColor,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.chartIndicatorText,
                      {
                        color:
                          primaryColor,
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
              ACTIVITIES
          ================================================== */}

          <Animatable.View
            animation="fadeInUp"
            delay={450}
            duration={500}
          >

            <View
              style={[
                styles.activitiesCard,
                {
                  backgroundColor:
                    surfaceColor,
                  borderColor:
                    borderColor,
                },
              ]}
            >

              <View
                style={
                  styles.cardHeader
                }
              >

                <View>

                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    Activités récentes
                  </Text>

                  <Text
                    style={[
                      styles.cardSubtitle,
                      {
                        color:
                          secondaryTextColor,
                      },
                    ]}
                  >
                    Les dernières actions
                  </Text>

                </View>


                <Ionicons
                  name="pulse-outline"
                  size={22}
                  color={
                    primaryColor
                  }
                />

              </View>


              {recentActivities.length >
              0 ? (

                recentActivities.map(
                  (
                    item,
                    index
                  ) =>
                    renderActivity({
                      item,
                      index,
                    })
                )

              ) : (

                <View
                  style={
                    styles.emptyActivities
                  }
                >

                  <Ionicons
                    name="file-tray-outline"
                    size={32}
                    color={
                      secondaryTextColor
                    }
                  />

                  <Text
                    style={[
                      styles.emptyActivitiesText,
                      {
                        color:
                          secondaryTextColor,
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

          <View
            style={
              styles.dashboardFooter
            }
          >

            <Ionicons
              name="heart-outline"
              size={15}
              color={
                secondaryTextColor
              }
            />

            <Text
              style={[
                styles.dashboardFooterText,
                {
                  color:
                    secondaryTextColor,
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

const styles =
  StyleSheet.create({

    // ========================================================
    // ROOT
    // ========================================================

    safeArea: {
      flex: 1,
      width: '100%',
    },

    container: {
      flex: 1,
      width: '100%',
    },

    scrollContent: {
      paddingBottom: 40,
    },

    /*
     * WEB:
     * Le contenu utilise presque toute la largeur.
     * Les espaces gauche/droite restent petits et identiques.
     */
    scrollContentWeb: {
      paddingHorizontal: 14,
      paddingBottom: 44,
    },


    // ========================================================
    // LOADING
    // ========================================================

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal:
        spacing.lg,
    },

    loadingIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      marginTop: spacing.md,
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.regular,
      textAlign: 'center',
    },


    // ========================================================
    // HEADER
    // ========================================================

    headerWrapper: {
      paddingTop:
        Platform.OS === 'ios'
          ? 50
          : Platform.OS === 'android'
          ? 30
          : 18,

      paddingBottom:
        spacing.sm,

      borderBottomWidth: 1,

      elevation:
        Platform.OS === 'android'
          ? 3
          : 0,

      shadowOpacity:
        Platform.OS === 'ios'
          ? 0.04
          : 0,

      shadowRadius: 5,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      zIndex: 10,

      width: '100%',
    },

    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',

      paddingHorizontal:
        Platform.OS === 'web'
          ? 14
          : spacing.md,

      minHeight: 50,

      width: '100%',
    },

    profileButton: {
      width: 44,
      height: 44,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },

    profileCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerTitle: {
      fontSize:
        typography.fontSize.lg,
      fontFamily:
        typography.fontFamily.bold,
      letterSpacing: 0.2,
    },

    headerSubtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },

    headerOnlineDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: 5,
    },

    headerSubtitle: {
      fontSize:
        typography.fontSize.xs,
      fontFamily:
        typography.fontFamily.medium,
    },

    notificationButton: {
      width: 44,
      height: 44,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },

    notificationIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },

    notificationBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 19,
      height: 19,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },

    notificationBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontFamily:
        typography.fontFamily.bold,
    },


    // ========================================================
    // STATUS CARD
    // ========================================================

    sectionTop: {
      marginTop:
        Platform.OS === 'web'
          ? 14
          : spacing.md,
      width: '100%',
    },

    statusCard: {
      marginHorizontal:
        Platform.OS === 'web'
          ? 0
          : spacing.md,

      borderRadius: 24,
      padding: spacing.lg,

      elevation: 5,

      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 12,

      shadowOffset: {
        width: 0,
        height: 6,
      },

      width:
        Platform.OS === 'web'
          ? '100%'
          : undefined,
    },

    statusTop: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
    },

    statusIdentity: {
      flex: 1,
      paddingRight: spacing.md,
    },

    statusGreeting: {
      color:
        'rgba(255,255,255,0.78)',
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.medium,
    },

    statusName: {
      color: '#FFFFFF',
      fontSize:
        typography.fontSize.xl,
      fontFamily:
        typography.fontFamily.bold,
      marginTop: 2,
    },

    statusRole: {
      color:
        'rgba(255,255,255,0.68)',
      fontSize:
        typography.fontSize.xs,
      marginTop: 3,
    },

    statusToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal:
        spacing.sm,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 6,
    },

    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#FFFFFF',
    },

    statusToggleText: {
      color: '#FFFFFF',
      fontSize:
        typography.fontSize.xs,
      fontFamily:
        typography.fontFamily.bold,
    },

    statusStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-around',

      marginTop:
        spacing.lg,

      paddingTop:
        spacing.md,

      borderTopWidth: 1,

      borderTopColor:
        'rgba(255,255,255,0.18)',
    },

    statusStat: {
      flex: 1,
      alignItems: 'center',
    },

    statusStatNumber: {
      color: '#FFFFFF',
      fontSize:
        typography.fontSize.lg,
      fontFamily:
        typography.fontFamily.bold,
    },

    statusStatLabel: {
      color:
        'rgba(255,255,255,0.72)',
      fontSize:
        typography.fontSize.xs,
      marginTop: 2,
      textAlign: 'center',
    },

    statusDivider: {
      width: 1,
      height: 30,
      backgroundColor:
        'rgba(255,255,255,0.18)',
    },


    // ========================================================
    // NOTIFICATION PREVIEW
    // ========================================================

    notificationPreview: {
      marginHorizontal:
        Platform.OS === 'web'
          ? 0
          : spacing.md,

      marginTop:
        spacing.md,

      minHeight: 70,

      borderRadius: 18,
      borderWidth: 1,

      paddingHorizontal:
        spacing.md,

      paddingVertical:
        spacing.sm,

      flexDirection: 'row',
      alignItems: 'center',

      elevation: 2,

      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 5,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      width:
        Platform.OS === 'web'
          ? '100%'
          : undefined,
    },

    notificationPreviewIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    notificationPreviewContent: {
      flex: 1,
      marginHorizontal:
        spacing.sm,
    },

    notificationPreviewTitle: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.semiBold,
    },

    notificationPreviewSubtitle: {
      fontSize:
        typography.fontSize.xs,
      marginTop: 3,
    },


    // ========================================================
    // SECTION
    // ========================================================

    sectionHeader: {
      paddingHorizontal:
        Platform.OS === 'web'
          ? 0
          : spacing.md,

      marginTop:
        spacing.lg,

      marginBottom:
        spacing.sm,
    },

    sectionTitle: {
      fontSize:
        typography.fontSize.lg,
      fontFamily:
        typography.fontFamily.bold,
    },

    sectionSubtitle: {
      fontSize:
        typography.fontSize.xs,
      marginTop: 2,
    },


    // ========================================================
    // QUICK ACTIONS - MOBILE
    // ========================================================

    quickActionsList: {
      paddingHorizontal:
        spacing.md,

      paddingBottom: 2,
    },


    // ========================================================
    // QUICK ACTIONS - WEB
    // ========================================================

    /*
     * 4 cartes sur une seule ligne.
     *
     * Exemple écran 1366px:
     *
     * | card | gap | card | gap | card | gap | card |
     *
     * avec petites marges gauche/droite.
     */
    quickActionsGrid: {
      width: '100%',

      flexDirection: 'row',

      alignItems: 'stretch',

      gap: 12,

      paddingHorizontal: 0,

      paddingBottom: 2,
    },

    /*
     * Chaque élément occupe exactement la même place.
     */
    quickActionGridItem: {
      flex: 1,
      minWidth: 0,
    },


    // ========================================================
    // QUICK ACTION CARD
    // ========================================================

    quickAction: {
      width: 126,
      minHeight: 126,

      borderRadius: 18,
      borderWidth: 1,

      padding:
        spacing.sm,

      marginRight:
        spacing.sm,

      alignItems: 'center',
      justifyContent: 'center',

      elevation: 2,

      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 5,

      shadowOffset: {
        width: 0,
        height: 2,
      },
    },

    /*
     * Sur Web:
     * - width = 100%
     * - pas de marginRight
     * - hauteur homogène
     */
    quickActionWeb: {
      width: '100%',
      minHeight: 126,
      marginRight: 0,
      flex: 1,
    },

    quickActionIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,

      alignItems: 'center',
      justifyContent: 'center',

      marginBottom: 7,
    },

    quickActionLabel: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.semiBold,
      textAlign: 'center',
    },

    quickActionDescription: {
      fontSize: 10,
      marginTop: 2,
      textAlign: 'center',
    },


    // ========================================================
    // GENERIC CARDS
    // ========================================================

    earningsCard: {
      marginHorizontal:
        Platform.OS === 'web'
          ? 0
          : spacing.md,

      marginTop:
        spacing.lg,

      padding:
        spacing.md,

      borderRadius: 20,
      borderWidth: 1,

      elevation: 2,

      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 7,

      shadowOffset: {
        width: 0,
        height: 3,
      },

      width:
        Platform.OS === 'web'
          ? '100%'
          : undefined,
    },

    chartCard: {
      marginHorizontal:
        Platform.OS === 'web'
          ? 0
          : spacing.md,

      marginTop:
        spacing.md,

      padding:
        spacing.md,

      borderRadius: 20,
      borderWidth: 1,

      elevation: 2,

      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 7,

      shadowOffset: {
        width: 0,
        height: 3,
      },

      width:
        Platform.OS === 'web'
          ? '100%'
          : undefined,
    },

    activitiesCard: {
      marginHorizontal:
        Platform.OS === 'web'
          ? 0
          : spacing.md,

      marginTop:
        spacing.md,

      padding:
        spacing.md,

      borderRadius: 20,
      borderWidth: 1,

      elevation: 2,

      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 7,

      shadowOffset: {
        width: 0,
        height: 3,
      },

      width:
        Platform.OS === 'web'
          ? '100%'
          : undefined,
    },

    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom:
        spacing.md,
    },

    cardTitle: {
      fontSize:
        typography.fontSize.md,
      fontFamily:
        typography.fontFamily.bold,
    },

    cardSubtitle: {
      fontSize:
        typography.fontSize.xs,
      marginTop: 2,
    },

    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: 5,
      paddingLeft: 6,
    },

    seeAllText: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.semiBold,
    },


    // ========================================================
    // EARNINGS
    // ========================================================

    earningsGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
    },

    earningsBox: {
      flex: 1,
      borderRadius: 16,
      padding:
        spacing.sm,
      minHeight: 112,
    },

    earningsBoxIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },

    earningsLabel: {
      fontSize:
        typography.fontSize.xs,
    },

    earningsValue: {
      fontSize:
        typography.fontSize.lg,
      fontFamily:
        typography.fontFamily.bold,
      marginTop: 3,
    },

    withdrawButton: {
      borderRadius: 14,
      overflow: 'hidden',
      marginTop:
        spacing.md,

      elevation: 3,
    },

    withdrawGradient: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal:
        spacing.md,
    },

    withdrawText: {
      flex: 1,
      textAlign: 'center',
      color: '#FFFFFF',
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.bold,
    },


    // ========================================================
    // CHART
    // ========================================================

    chartIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 5,
      gap: 5,
    },

    chartIndicatorDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },

    chartIndicatorText: {
      fontSize: 10,
      fontFamily:
        typography.fontFamily.medium,
    },

    chart: {
      marginTop: 5,
      marginLeft: -15,
      borderRadius: 16,
    },

    webChartContainer: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },

    webChartBars: {
      flexDirection: 'row',
      justifyContent:
        'space-around',
      alignItems: 'flex-end',
      height: 160,
      paddingHorizontal: 4,
    },

    webChartBarWrapper: {
      alignItems: 'center',
      width: 38,
      height: 155,
      justifyContent:
        'flex-end',
    },

    webChartBar: {
      width: 26,
      borderRadius: 8,
      minHeight: 5,
    },

    webChartValue: {
      fontSize: 10,
      marginBottom: 5,
    },

    webChartLabels: {
      flexDirection: 'row',
      justifyContent:
        'space-around',
      marginTop: 8,
    },

    webChartLabel: {
      fontSize: 11,
      width: 38,
      textAlign: 'center',
    },

    chartFallback: {
      height: 150,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },

    chartFallbackText: {
      fontSize:
        typography.fontSize.sm,
    },


    // ========================================================
    // ACTIVITIES
    // ========================================================

    activityItem: {
      minHeight: 62,

      flexDirection: 'row',
      alignItems: 'center',

      paddingVertical:
        spacing.sm,

      borderBottomWidth: 1,
    },

    activityIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,

      alignItems: 'center',
      justifyContent: 'center',

      marginRight:
        spacing.sm,
    },

    activityContent: {
      flex: 1,
      paddingRight: 5,
    },

    activityText: {
      fontSize:
        typography.fontSize.sm,
      fontFamily:
        typography.fontFamily.medium,
      lineHeight: 19,
    },

    activityTime: {
      fontSize:
        typography.fontSize.xs,
      marginTop: 3,
    },

    newActivityBadge: {
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 4,
    },

    newActivityText: {
      fontSize: 9,
      fontFamily:
        typography.fontFamily.bold,
    },

    emptyActivities: {
      minHeight: 110,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },

    emptyActivitiesText: {
      fontSize:
        typography.fontSize.sm,
    },


    // ========================================================
    // FOOTER
    // ========================================================

    dashboardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',

      paddingHorizontal:
        spacing.md,

      paddingTop:
        spacing.lg,

      paddingBottom:
        spacing.md,

      gap: 5,
    },

    dashboardFooterText: {
      fontSize: 10,
      textAlign: 'center',
    },

  });


export default DashboardScreen;