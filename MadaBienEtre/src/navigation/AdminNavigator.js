// src/navigation/AdminNavigator.js

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Easing,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import {
  typography,
  spacing,
} from '../theme';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

// ============================================================
// ÉCRANS ADMIN
// ============================================================

import DashboardScreen from '../screens/admin/DashboardScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import TherapistsScreen from '../screens/admin/TherapistsScreen';
import ApprovalsScreen from '../screens/admin/ApprovalsScreen';
import PaymentsScreen from '../screens/admin/PaymentsScreen';
import ReviewsScreen from '../screens/admin/ReviewsScreen';
import SOSAlertsScreen from '../screens/admin/SOSAlertsScreen';
import AnalyticsScreen from '../screens/admin/AnalyticsScreen';
import AIInsightsScreen from '../screens/admin/AIInsightsScreen';
import SettingsScreen from '../screens/admin/SettingsScreen';
import MassageTypesScreen from '../screens/admin/MassageTypesScreen';

// ============================================================
// NAVIGATORS
// ============================================================

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ============================================================
// CONSTANTES UX
// ============================================================

const SCROLL_THRESHOLD = 8;
const SHOW_AT_TOP = 10;
const HIDE_TRANSLATE_Y = 100;
const ANIMATION_DURATION = 240;

// ============================================================
// CONTEXT ADMIN TAB BAR
// ============================================================

const AdminTabBarContext = createContext({
  showAdminTabBar: () => {},
  hideAdminTabBar: () => {},
  toggleAdminTabBar: () => {},
  handleAdminScroll: () => {},
  resetAdminScroll: () => {},
  tabBarVisible: true,
});

export const useAdminTabBar = () => {
  return useContext(AdminTabBarContext);
};

// ============================================================
// DASHBOARD STACK
// ============================================================

const DashboardStack = () => {
  const { colors: themeColors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor:
            themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
      />

      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
      />

      <Stack.Screen
        name="AIInsights"
        component={AIInsightsScreen}
      />

      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
      />

      <Stack.Screen
        name="SOSAlerts"
        component={SOSAlertsScreen}
      />

      <Stack.Screen
        name="Payments"
        component={PaymentsScreen}
      />

      <Stack.Screen
        name="Reviews"
        component={ReviewsScreen}
      />

      <Stack.Screen
        name="Users"
        component={UsersScreen}
      />

      <Stack.Screen
        name="Therapists"
        component={TherapistsScreen}
      />

      <Stack.Screen
        name="Approvals"
        component={ApprovalsScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// USERS STACK
// ============================================================

const UsersStack = () => {
  const { colors: themeColors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor:
            themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="UsersMain"
        component={UsersScreen}
      />

      <Stack.Screen
        name="Therapists"
        component={TherapistsScreen}
      />

      <Stack.Screen
        name="Approvals"
        component={ApprovalsScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// MANAGEMENT STACK
// ============================================================

const ManagementStack = () => {
  const { colors: themeColors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor:
            themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="ManagementMain"
        component={ManagementScreen}
      />

      <Stack.Screen
        name="Therapists"
        component={TherapistsScreen}
      />

      <Stack.Screen
        name="Approvals"
        component={ApprovalsScreen}
      />

      <Stack.Screen
        name="Payments"
        component={PaymentsScreen}
      />

      <Stack.Screen
        name="Reviews"
        component={ReviewsScreen}
      />

      <Stack.Screen
        name="SOSAlerts"
        component={SOSAlertsScreen}
      />

      <Stack.Screen
        name="MassageTypes"
        component={MassageTypesScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// ANALYTICS STACK
// ============================================================

const AnalyticsStack = () => {
  const { colors: themeColors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor:
            themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="AnalyticsMain"
        component={AnalyticsScreen}
      />

      <Stack.Screen
        name="AIInsights"
        component={AIInsightsScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// SETTINGS STACK
// ============================================================

const SettingsStack = () => {
  const { colors: themeColors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor:
            themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// MANAGEMENT SCREEN
// ============================================================

const ManagementScreen = ({
  navigation,
}) => {
  const {
    colors: themeColors,
  } = useTheme();

  const {
    handleAdminScroll,
  } = useAdminTabBar();

  const menuItems = [
    {
      id: 'Therapists',
      icon: 'fitness-outline',
      label: 'Thérapeutes',
      color: '#4CAF50',
    },
    {
      id: 'Approvals',
      icon: 'checkmark-circle-outline',
      label: 'Approbations',
      color: '#F5A623',
    },
    {
      id: 'Payments',
      icon: 'cash-outline',
      label: 'Paiements',
      color: '#2196F3',
    },
    {
      id: 'Reviews',
      icon: 'star-outline',
      label: 'Avis',
      color: '#9B59B6',
    },
    {
      id: 'SOSAlerts',
      icon: 'alert-circle-outline',
      label: 'Alertes SOS',
      color: '#E74C3C',
    },
    {
      id: 'MassageTypes',
      icon: 'fitness-outline',
      label: 'Types de massage',
      color: '#4A90D9',
    },
  ];

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            themeColors.background,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor:
              themeColors.surface,

            borderBottomColor:
              themeColors.border ||
              '#E0E0E0',
          },
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            {
              color:
                themeColors.text,
            },
          ]}
        >
          Gestion
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.menuContent
        }
        onScroll={
          handleAdminScroll
        }
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={
          false
        }
      >
        {menuItems.map(
          (item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                {
                  backgroundColor:
                    themeColors.surface,
                },
              ]}
              onPress={() =>
                navigation.navigate(
                  item.id
                )
              }
              activeOpacity={0.72}
            >
              <View
                style={[
                  styles.menuIcon,
                  {
                    backgroundColor:
                      `${item.color}20`,
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
                style={[
                  styles.menuLabel,
                  {
                    color:
                      themeColors.text,
                  },
                ]}
              >
                {item.label}
              </Text>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={
                  themeColors.textSecondary
                }
              />
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================
// ICONS
// ============================================================

const getTabIcon = (
  routeName,
  focused
) => {
  switch (routeName) {
    case 'Tableau de bord':
      return focused
        ? 'grid'
        : 'grid-outline';

    case 'Utilisateurs':
      return focused
        ? 'people'
        : 'people-outline';

    case 'Gestion':
      return focused
        ? 'settings'
        : 'settings-outline';

    case 'Analyses':
      return focused
        ? 'bar-chart'
        : 'bar-chart-outline';

    case 'Paramètres':
      return focused
        ? 'options'
        : 'options-outline';

    default:
      return 'grid-outline';
  }
};

// ============================================================
// LABELS
// ============================================================

const getTabLabel = (
  routeName
) => {
  switch (routeName) {
    case 'Tableau de bord':
      return 'Tableau de bord';

    case 'Utilisateurs':
      return 'Utilisateurs';

    case 'Gestion':
      return 'Gestion';

    case 'Analyses':
      return 'Analyses';

    case 'Paramètres':
      return 'Paramètres';

    default:
      return routeName;
  }
};

// ============================================================
// CUSTOM ADMIN TAB BAR
// ============================================================

const AdminTabBar = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets =
    useSafeAreaInsets();

  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const {
    tabBarVisible,
  } = useAdminTabBar();

  // ==========================================================
  // ANIMATION
  // ==========================================================

  const translateY =
    useRef(
      new Animated.Value(0)
    ).current;

  const opacity =
    useRef(
      new Animated.Value(1)
    ).current;

  const previousVisibility =
    useRef(true);

  // ==========================================================
  // SHOW / HIDE
  // ==========================================================

  useEffect(() => {
    if (
      previousVisibility.current ===
      tabBarVisible
    ) {
      return;
    }

    previousVisibility.current =
      tabBarVisible;

    Animated.parallel([
      Animated.timing(
        translateY,
        {
          toValue:
            tabBarVisible
              ? 0
              : HIDE_TRANSLATE_Y,

          duration:
            ANIMATION_DURATION,

          easing:
            Easing.out(
              Easing.cubic
            ),

          useNativeDriver: true,
        }
      ),

      Animated.timing(
        opacity,
        {
          toValue:
            tabBarVisible
              ? 1
              : 0,

          duration:
            ANIMATION_DURATION,

          easing:
            Easing.out(
              Easing.cubic
            ),

          useNativeDriver: true,
        }
      ),
    ]).start();
  }, [
    tabBarVisible,
    translateY,
    opacity,
  ]);

  // ==========================================================
  // SAFE AREA
  // ==========================================================

  const bottomInset =
    Math.max(
      insets.bottom || 0,
      0
    );

  // ==========================================================
  // HEIGHT
  // ==========================================================

  const tabHeight =
    Platform.OS === 'web'
      ? 72
      : 66 + bottomInset;

  // ==========================================================
  // COLORS
  // ==========================================================

  const activeColor =
    colors.primary ||
    '#0D2B7E';

  const inactiveColor =
    themeColors.textSecondary ||
    '#7A8194';

  return (
    <View
      style={[
        styles.tabBarWrapper,
        {
          height: tabHeight,
          backgroundColor:
            themeColors.background,
        },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.tabBar,
          {
            height: tabHeight,

            paddingBottom:
              Platform.OS === 'web'
                ? 8
                : bottomInset + 5,

            backgroundColor:
              themeColors.surface,

            borderTopColor:
              themeColors.border ||
              (
                isDark
                  ? 'rgba(255,255,255,0.08)'
                  : '#E7E9EF'
              ),

            shadowColor:
              '#000000',

            transform: [
              {
                translateY,
              },
            ],

            opacity,
          },
        ]}
      >
        <View
          style={
            styles.tabBarInner
          }
        >
          {state.routes.map(
            (
              route,
              index
            ) => {
              const {
                options,
              } =
                descriptors[
                  route.key
                ];

              const focused =
                state.index ===
                index;

              const iconName =
                getTabIcon(
                  route.name,
                  focused
                );

              const label =
                getTabLabel(
                  route.name
                );

              const color =
                focused
                  ? activeColor
                  : inactiveColor;

              // =================================================
              // PRESS
              // =================================================

              const onPress =
                () => {
                  const event =
                    navigation.emit(
                      {
                        type:
                          'tabPress',

                        target:
                          route.key,

                        canPreventDefault:
                          true,
                      }
                    );

                  if (
                    !focused &&
                    !event.defaultPrevented
                  ) {
                    navigation.navigate(
                      route.name
                    );
                  }
                };

              // =================================================
              // LONG PRESS
              // =================================================

              const onLongPress =
                () => {
                  navigation.emit(
                    {
                      type:
                        'tabLongPress',

                      target:
                        route.key,
                    }
                  );
                };

              return (
                <TouchableOpacity
                  key={
                    route.key
                  }

                  accessibilityRole="button"

                  accessibilityState={
                    focused
                      ? {
                          selected:
                            true,
                        }
                      : {}
                  }

                  accessibilityLabel={
                    options
                      .tabBarAccessibilityLabel ||
                    label
                  }

                  testID={
                    options
                      .tabBarButtonTestID
                  }

                  onPress={
                    onPress
                  }

                  onLongPress={
                    onLongPress
                  }

                  activeOpacity={
                    0.72
                  }

                  style={
                    styles.tabButton
                  }
                >
                  {/* ========================================== */}
                  {/* ICON */}
                  {/* ========================================== */}

                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor:
                          focused
                            ? `${activeColor}16`
                            : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        iconName
                      }
                      size={
                        focused
                          ? 23
                          : 22
                      }
                      color={
                        color
                      }
                    />
                  </View>

                  {/* ========================================== */}
                  {/* LABEL */}
                  {/* ========================================== */}

                  <Animated.Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.tabLabel,
                      {
                        color,

                        fontWeight:
                          focused
                            ? '700'
                            : '500',
                      },
                    ]}
                  >
                    {label}
                  </Animated.Text>

                  {/* ========================================== */}
                  {/* ACTIVE INDICATOR */}
                  {/* ========================================== */}

                  {focused && (
                    <View
                      style={[
                        styles.activeIndicator,
                        {
                          backgroundColor:
                            activeColor,
                        },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            }
          )}
        </View>
      </Animated.View>
    </View>
  );
};

// ============================================================
// ADMIN NAVIGATOR
// ============================================================

const AdminNavigator = () => {
  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  // ==========================================================
  // VISIBILITY
  // ==========================================================

  const [
    tabBarVisible,
    setTabBarVisible,
  ] = useState(true);

  // ==========================================================
  // SCROLL
  // ==========================================================

  const lastScrollY =
    useRef(0);

  const lastScrollTime =
    useRef(0);

  const scrollDirection =
    useRef('idle');

  // ==========================================================
  // SHOW
  // ==========================================================

  const showAdminTabBar =
    useCallback(() => {
      setTabBarVisible(
        true
      );
    }, []);

  // ==========================================================
  // HIDE
  // ==========================================================

  const hideAdminTabBar =
    useCallback(() => {
      setTabBarVisible(
        false
      );
    }, []);

  // ==========================================================
  // TOGGLE
  // ==========================================================

  const toggleAdminTabBar =
    useCallback(() => {
      setTabBarVisible(
        previous =>
          !previous
      );
    }, []);

  // ==========================================================
  // RESET
  // ==========================================================

  const resetAdminScroll =
    useCallback(() => {
      lastScrollY.current =
        0;

      lastScrollTime.current =
        0;

      scrollDirection.current =
        'idle';

      setTabBarVisible(
        true
      );
    }, []);

  // ==========================================================
  // SCROLL HANDLER
  // ==========================================================

  const handleAdminScroll =
    useCallback(
      (event) => {
        if (
          !event ||
          !event.nativeEvent
        ) {
          return;
        }

        const currentY =
          event.nativeEvent
            .contentOffset?.y || 0;

        // ====================================================
        // TOP
        // ====================================================

        if (
          currentY <=
          SHOW_AT_TOP
        ) {
          if (
            !tabBarVisible
          ) {
            setTabBarVisible(
              true
            );
          }

          lastScrollY.current =
            currentY;

          scrollDirection.current =
            'idle';

          return;
        }

        // ====================================================
        // DELTA
        // ====================================================

        const delta =
          currentY -
          lastScrollY.current;

        // ====================================================
        // SMALL MOVEMENT
        // ====================================================

        if (
          Math.abs(delta) <
          SCROLL_THRESHOLD
        ) {
          return;
        }

        // ====================================================
        // SCROLL UP
        // ====================================================

        if (
          delta > 0
        ) {
          if (
            scrollDirection.current !==
            'up'
          ) {
            scrollDirection.current =
              'up';

            setTabBarVisible(
              false
            );
          }
        }

        // ====================================================
        // SCROLL DOWN
        // ====================================================

        else if (
          delta < 0
        ) {
          if (
            scrollDirection.current !==
            'down'
          ) {
            scrollDirection.current =
              'down';

            setTabBarVisible(
              true
            );
          }
        }

        lastScrollY.current =
          currentY;

        lastScrollTime.current =
          Date.now();
      },
      [
        tabBarVisible,
      ]
    );

  // ==========================================================
  // CONTEXT
  // ==========================================================

  const contextValue =
    useMemo(
      () => ({
        showAdminTabBar,
        hideAdminTabBar,
        toggleAdminTabBar,
        handleAdminScroll,
        resetAdminScroll,
        tabBarVisible,
      }),
      [
        showAdminTabBar,
        hideAdminTabBar,
        toggleAdminTabBar,
        handleAdminScroll,
        resetAdminScroll,
        tabBarVisible,
      ]
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <AdminTabBarContext.Provider
      value={
        contextValue
      }
    >
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >
        {/* ================================================== */}
        {/* STATUS BAR */}
        {/* ================================================== */}

        <StatusBar
          barStyle={
            isDark
              ? 'light-content'
              : 'dark-content'
          }
          backgroundColor={
            themeColors.background
          }
          translucent={
            false
          }
        />

        {/* ================================================== */}
        {/* TABS */}
        {/* ================================================== */}

        <Tab.Navigator
          tabBar={
            props => (
              <AdminTabBar
                {...props}
              />
            )
          }
          screenOptions={{
            headerShown:
              false,

            lazy: true,

            tabBarHideOnKeyboard:
              true,

            sceneStyle: {
              backgroundColor:
                themeColors.background,
            },

            freezeOnBlur:
              false,
          }}
        >
          {/* ================================================= */}
          {/* DASHBOARD */}
          {/* ================================================= */}

          <Tab.Screen
            name="Tableau de bord"
            component={
              DashboardStack
            }
            options={{
              tabBarLabel:
                'Tableau de bord',
            }}
          />

          {/* ================================================= */}
          {/* UTILISATEURS */}
          {/* ================================================= */}

          <Tab.Screen
            name="Utilisateurs"
            component={
              UsersStack
            }
            options={{
              tabBarLabel:
                'Utilisateurs',
            }}
          />

          {/* ================================================= */}
          {/* GESTION */}
          {/* ================================================= */}

          <Tab.Screen
            name="Gestion"
            component={
              ManagementStack
            }
            options={{
              tabBarLabel:
                'Gestion',
            }}
          />

          {/* ================================================= */}
          {/* ANALYSES */}
          {/* ================================================= */}

          <Tab.Screen
            name="Analyses"
            component={
              AnalyticsStack
            }
            options={{
              tabBarLabel:
                'Analyses',
            }}
          />

          {/* ================================================= */}
          {/* PARAMÈTRES */}
          {/* ================================================= */}

          <Tab.Screen
            name="Paramètres"
            component={
              SettingsStack
            }
            options={{
              tabBarLabel:
                'Paramètres',
            }}
          />
        </Tab.Navigator>
      </SafeAreaView>
    </AdminTabBarContext.Provider>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

    // ========================================================
    // CONTAINER
    // ========================================================

    container: {
      flex: 1,
    },

    // ========================================================
    // MANAGEMENT HEADER
    // ========================================================

    header: {
      paddingHorizontal:
        spacing.lg,

      paddingVertical:
        spacing.md,

      borderBottomWidth: 1,
    },

    headerTitle: {
      fontSize:
        typography.fontSize.xl,

      fontFamily:
        typography.fontFamily.bold,
    },

    // ========================================================
    // MANAGEMENT MENU
    // ========================================================

    menuContent: {
      padding:
        spacing.md,

      paddingBottom:
        spacing.xl,
    },

    menuItem: {
      flexDirection:
        'row',

      alignItems:
        'center',

      padding:
        spacing.md,

      borderRadius:
        12,

      marginBottom:
        spacing.sm,

      shadowColor:
        '#000',

      shadowOffset: {
        width: 0,
        height: 1,
      },

      shadowOpacity:
        0.05,

      shadowRadius:
        2,

      elevation: 1,
    },

    menuIcon: {
      width: 44,

      height: 44,

      borderRadius: 22,

      justifyContent:
        'center',

      alignItems:
        'center',

      marginRight:
        spacing.md,
    },

    menuLabel: {
      flex: 1,

      fontSize:
        typography.fontSize.md,

      fontFamily:
        typography.fontFamily.medium,
    },

    // ========================================================
    // TAB WRAPPER
    // ========================================================

    tabBarWrapper: {
      width: '100%',

      overflow: 'hidden',
    },

    // ========================================================
    // TAB BAR
    // ========================================================

    tabBar: {
      width: '100%',

      borderTopWidth:
        StyleSheet.hairlineWidth,

      elevation: 12,

      shadowOffset: {
        width: 0,
        height: -3,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 8,
    },

    // ========================================================
    // INNER
    // ========================================================

    tabBarInner: {
      flex: 1,

      flexDirection:
        'row',

      alignItems:
        'stretch',

      justifyContent:
        'space-around',

      paddingHorizontal:
        6,
    },

    // ========================================================
    // BUTTON
    // ========================================================

    tabButton: {
      flex: 1,

      minWidth: 0,

      alignItems:
        'center',

      justifyContent:
        'center',

      position:
        'relative',

      paddingTop: 5,

      paddingHorizontal: 2,
    },

    // ========================================================
    // ICON
    // ========================================================

    iconContainer: {
      width: 42,

      height: 32,

      borderRadius: 16,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom: 2,
    },

    // ========================================================
    // LABEL
    // ========================================================

    tabLabel: {
      fontSize:
        Platform.OS ===
        'web'
          ? 11
          : 10,

      lineHeight: 14,

      textAlign:
        'center',

      includeFontPadding:
        false,

      maxWidth: 100,
    },

    // ========================================================
    // ACTIVE INDICATOR
    // ========================================================

    activeIndicator: {
      position:
        'absolute',

      bottom: 0,

      width: 24,

      height: 3,

      borderRadius: 3,
    },
  });

export default AdminNavigator;