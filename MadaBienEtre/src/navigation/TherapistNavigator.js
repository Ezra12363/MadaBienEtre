// src/navigation/TherapistNavigator.js

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
  TouchableOpacity,
  View,
} from 'react-native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import { Ionicons } from '@expo/vector-icons';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import { useNotifications } from '../context/NotificationContext';

// ============================================================
// ÉCRANS THÉRAPEUTE
// ============================================================

import DashboardScreen from '../screens/therapist/DashboardScreen';
import RequestsScreen from '../screens/therapist/RequestsScreen';
import CalendarScreen from '../screens/therapist/CalendarScreen';
import EarningsScreen from '../screens/therapist/EarningsScreen';
import ProfileScreen from '../screens/therapist/ProfileScreen';
import OfferScreen from '../screens/therapist/OfferScreen';
import NegotiationScreen from '../screens/therapist/NegotiationScreen';
import NavigationScreen from '../screens/therapist/NavigationScreen';
import TrackingScreen from '../screens/therapist/TrackingScreen';
import WithdrawScreen from '../screens/therapist/WithdrawScreen';
import AvailabilityScreen from '../screens/therapist/AvailabilityScreen';
import ReviewsScreen from '../screens/therapist/ReviewsScreen';
import UploadDocumentsScreen from '../screens/therapist/UploadDocumentsScreen';

import BookingDetailScreen from '../screens/client/BookingDetailScreen';

// ============================================================
// NAVIGATORS
// ============================================================

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ============================================================
// CONSTANTES UX
// ============================================================

const SCROLL_THRESHOLD = 8;
const SHOW_AT_TOP = 10;
const HIDE_TRANSLATE_Y = 100;
const ANIMATION_DURATION = 240;

// ============================================================
// CONTEXT THÉRAPEUTE
// ============================================================

const TherapistTabBarContext = createContext({
  showTherapistTabBar: () => {},
  hideTherapistTabBar: () => {},
  toggleTherapistTabBar: () => {},
  handleTherapistScroll: () => {},
  resetTherapistScroll: () => {},
  tabBarVisible: true,
});

export const useTherapistTabBar = () => {
  return useContext(TherapistTabBarContext);
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
          backgroundColor: themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="DashboardScreen"
        component={DashboardScreen}
      />

      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
      />

      <Stack.Screen
        name="Withdraw"
        component={WithdrawScreen}
      />

      <Stack.Screen
        name="Availability"
        component={AvailabilityScreen}
      />

      <Stack.Screen
        name="Reviews"
        component={ReviewsScreen}
      />

      <Stack.Screen
        name="UploadDocuments"
        component={UploadDocumentsScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// REQUESTS STACK
// ============================================================

const RequestsStack = () => {
  const { colors: themeColors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="RequestsScreen"
        component={RequestsScreen}
      />

      <Stack.Screen
        name="Offer"
        component={OfferScreen}
      />

      <Stack.Screen
        name="Negotiation"
        component={NegotiationScreen}
      />

      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
      />

      <Stack.Screen
        name="Navigation"
        component={NavigationScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// CALENDAR STACK
// ============================================================

const CalendarStack = () => {
  const { colors: themeColors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="CalendarScreen"
        component={CalendarScreen}
      />

      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// EARNINGS STACK
// ============================================================

const EarningsStack = () => {
  const { colors: themeColors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="EarningsScreen"
        component={EarningsScreen}
      />

      <Stack.Screen
        name="Withdraw"
        component={WithdrawScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// PROFILE STACK
// ============================================================

const ProfileStack = () => {
  const { colors: themeColors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: themeColors.background,
        },
      }}
    >
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
      />

      <Stack.Screen
        name="UploadDocuments"
        component={UploadDocumentsScreen}
      />

      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
      />

      <Stack.Screen
        name="Availability"
        component={AvailabilityScreen}
      />

      <Stack.Screen
        name="Reviews"
        component={ReviewsScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// TAB ICONS
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

    case 'Demandes':
      return focused
        ? 'chatbubbles'
        : 'chatbubbles-outline';

    case 'Calendrier':
      return focused
        ? 'calendar'
        : 'calendar-outline';

    case 'Gains':
      return focused
        ? 'wallet'
        : 'wallet-outline';

    case 'Profil':
      return focused
        ? 'person'
        : 'person-outline';

    default:
      return 'grid-outline';
  }
};

// ============================================================
// TAB LABEL
// ============================================================

const getTabLabel = (
  routeName
) => {
  switch (routeName) {
    case 'Tableau de bord':
      return 'Tableau de bord';

    case 'Demandes':
      return 'Demandes';

    case 'Calendrier':
      return 'Calendrier';

    case 'Gains':
      return 'Gains';

    case 'Profil':
      return 'Profil';

    default:
      return routeName;
  }
};

// ============================================================
// CUSTOM THERAPIST TAB BAR
// ============================================================

const TherapistTabBar = ({
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
  } = useTherapistTabBar();

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
  // SHOW / HIDE ANIMATION
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
  // TAB HEIGHT
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

  // ==========================================================
  // RENDER
  // ==========================================================

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

              // ==================================================
              // PRESS
              // ==================================================

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

              // ==================================================
              // LONG PRESS
              // ==================================================

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
// THERAPIST NAVIGATOR
// ============================================================

const TherapistNavigator = () => {
  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const { unreadCount } =
    useNotifications();

  // ==========================================================
  // TAB BAR VISIBILITY
  // ==========================================================

  const [
    tabBarVisible,
    setTabBarVisible,
  ] = useState(true);

  // ==========================================================
  // LAST SCROLL
  // ==========================================================

  const lastScrollY =
    useRef(0);

  // ==========================================================
  // LAST SCROLL TIME
  // ==========================================================

  const lastScrollTime =
    useRef(0);

  // ==========================================================
  // SCROLL DIRECTION
  // ==========================================================

  const scrollDirection =
    useRef('idle');

  // ==========================================================
  // SHOW
  // ==========================================================

  const showTherapistTabBar =
    useCallback(() => {
      setTabBarVisible(
        true
      );
    }, []);

  // ==========================================================
  // HIDE
  // ==========================================================

  const hideTherapistTabBar =
    useCallback(() => {
      setTabBarVisible(
        false
      );
    }, []);

  // ==========================================================
  // TOGGLE
  // ==========================================================

  const toggleTherapistTabBar =
    useCallback(() => {
      setTabBarVisible(
        previous =>
          !previous
      );
    }, []);

  // ==========================================================
  // RESET SCROLL
  // ==========================================================

  const resetTherapistScroll =
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
  // GLOBAL SCROLL HANDLER
  // ==========================================================

  const handleTherapistScroll =
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
        //
        // contentOffset.y augmente
        // => menu disparaît
        //

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
        //
        // contentOffset.y diminue
        // => menu apparaît
        //

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
        showTherapistTabBar,
        hideTherapistTabBar,
        toggleTherapistTabBar,
        handleTherapistScroll,
        resetTherapistScroll,
        tabBarVisible,
      }),
      [
        showTherapistTabBar,
        hideTherapistTabBar,
        toggleTherapistTabBar,
        handleTherapistScroll,
        resetTherapistScroll,
        tabBarVisible,
      ]
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <TherapistTabBarContext.Provider
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
              <TherapistTabBar
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
          {/* TABLEAU DE BORD */}
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
          {/* DEMANDES */}
          {/* ================================================= */}

          <Tab.Screen
            name="Demandes"
            component={
              RequestsStack
            }
            options={{
              tabBarLabel:
                'Demandes',
            }}
          />

          {/* ================================================= */}
          {/* CALENDRIER */}
          {/* ================================================= */}

          <Tab.Screen
            name="Calendrier"
            component={
              CalendarStack
            }
            options={{
              tabBarLabel:
                'Calendrier',
            }}
          />

          {/* ================================================= */}
          {/* GAINS */}
          {/* ================================================= */}

          <Tab.Screen
            name="Gains"
            component={
              EarningsStack
            }
            options={{
              tabBarLabel:
                'Gains',
            }}
          />

          {/* ================================================= */}
          {/* PROFIL */}
          {/* ================================================= */}

          <Tab.Screen
            name="Profil"
            component={
              ProfileStack
            }
            options={{
              tabBarLabel:
                'Profil',
            }}
          />
        </Tab.Navigator>
      </SafeAreaView>
    </TherapistTabBarContext.Provider>
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

export default TherapistNavigator;