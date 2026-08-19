// src/navigation/ClientNavigator.js

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

// ============================================================
// ÉCRANS CLIENT
// ============================================================

import HomeScreen from '../screens/client/HomeScreen';
import SearchMassageScreen from '../screens/client/SearchMassageScreen';
import BookingScreen from '../screens/client/BookingScreen';
import BookingDetailScreen from '../screens/client/BookingDetailScreen';
import ProfileScreen from '../screens/client/ProfileScreen';
import NotificationScreen from '../screens/client/NotificationScreen';
import ChatScreen from '../screens/client/ChatScreen';
import PaymentScreen from '../screens/client/PaymentScreen';
import RatingScreen from '../screens/client/RatingScreen';
import TrackingScreen from '../screens/client/TrackingScreen';
import SOSScreen from '../screens/client/SOSScreen';
import HistoryScreen from '../screens/client/HistoryScreen';
import NegotiationScreen from '../screens/client/NegotiationScreen';

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
// CONTEXT
// ============================================================

const ClientTabBarContext = createContext({
  showClientTabBar: () => {},
  hideClientTabBar: () => {},
  toggleClientTabBar: () => {},
  handleClientScroll: () => {},
  resetClientScroll: () => {},
  tabBarVisible: true,
});

export const useClientTabBar = () => {
  return useContext(ClientTabBarContext);
};

// ============================================================
// HOME STACK
// ============================================================

const HomeStack = () => {
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
        name="HomeScreen"
        component={HomeScreen}
      />

      <Stack.Screen
        name="SearchMassage"
        component={SearchMassageScreen}
      />

      <Stack.Screen
        name="CreateBooking"
        component={BookingScreen}
      />

      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
      />

      <Stack.Screen
        name="SOS"
        component={SOSScreen}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationScreen}
      />

      <Stack.Screen
        name="Chat"
        component={ChatScreen}
      />

      <Stack.Screen
        name="History"
        component={HistoryScreen}
      />

      <Stack.Screen
        name="Negotiation"
        component={NegotiationScreen}
      />

      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
      />

      <Stack.Screen
        name="Rating"
        component={RatingScreen}
      />

      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// BOOKING STACK
// ============================================================

const BookingStack = () => {
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
        name="BookingScreen"
        component={BookingScreen}
      />

      <Stack.Screen
        name="CreateBooking"
        component={BookingScreen}
      />

      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
      />

      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
      />

      <Stack.Screen
        name="Rating"
        component={RatingScreen}
      />

      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
      />

      <Stack.Screen
        name="Chat"
        component={ChatScreen}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationScreen}
      />

      <Stack.Screen
        name="History"
        component={HistoryScreen}
      />

      <Stack.Screen
        name="Negotiation"
        component={NegotiationScreen}
      />
    </Stack.Navigator>
  );
};

// ============================================================
// CHAT STACK
// ============================================================

const ChatStack = () => {
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
        name="ChatList"
        component={ChatScreen}
      />

      <Stack.Screen
        name="ChatDetail"
        component={ChatScreen}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationScreen}
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
        name="Notifications"
        component={NotificationScreen}
      />

      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
      />

      <Stack.Screen
        name="History"
        component={HistoryScreen}
      />

      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
      />

      <Stack.Screen
        name="Rating"
        component={RatingScreen}
      />

      <Stack.Screen
        name="BookingScreen"
        component={BookingScreen}
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
    case 'Accueil':
      return focused
        ? 'home'
        : 'home-outline';

    case 'Réservations':
      return focused
        ? 'calendar'
        : 'calendar-outline';

    case 'Messages':
      return focused
        ? 'chatbubbles'
        : 'chatbubbles-outline';

    case 'Profil':
      return focused
        ? 'person'
        : 'person-outline';

    default:
      return 'home-outline';
  }
};

// ============================================================
// TAB LABEL
// ============================================================

const getTabLabel = (
  routeName
) => {
  switch (routeName) {
    case 'Accueil':
      return 'Accueil';

    case 'Réservations':
      return 'Réservations';

    case 'Messages':
      return 'Messages';

    case 'Profil':
      return 'Profil';

    default:
      return routeName;
  }
};

// ============================================================
// CUSTOM TAB BAR
// ============================================================

const ClientTabBar = ({
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
  } = useClientTabBar();

  // ----------------------------------------------------------
  // Animation menu
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Animation show / hide
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Safe area
  // ----------------------------------------------------------

  const bottomInset =
    Math.max(
      insets.bottom || 0,
      0
    );

  // ----------------------------------------------------------
  // Hauteur
  // ----------------------------------------------------------

  const tabHeight =
    Platform.OS === 'web'
      ? 72
      : 66 + bottomInset;

  // ----------------------------------------------------------
  // Couleurs
  // ----------------------------------------------------------

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

              // ------------------------------------------------
              // PRESS
              // ------------------------------------------------

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

              // ------------------------------------------------
              // LONG PRESS
              // ------------------------------------------------

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
                  {/* ------------------------------------------ */}
                  {/* ICON */}
                  {/* ------------------------------------------ */}

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

                  {/* ------------------------------------------ */}
                  {/* LABEL */}
                  {/* ------------------------------------------ */}

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

                  {/* ------------------------------------------ */}
                  {/* ACTIVE INDICATOR */}
                  {/* ------------------------------------------ */}

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
// CLIENT NAVIGATOR
// ============================================================

const ClientNavigator = () => {
  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  // ----------------------------------------------------------
  // Etat visibilité
  // ----------------------------------------------------------

  const [
    tabBarVisible,
    setTabBarVisible,
  ] = useState(true);

  // ----------------------------------------------------------
  // Dernier scroll
  // ----------------------------------------------------------

  const lastScrollY =
    useRef(0);

  // ----------------------------------------------------------
  // Timestamp
  // ----------------------------------------------------------

  const lastScrollTime =
    useRef(0);

  // ----------------------------------------------------------
  // Animation lock
  // ----------------------------------------------------------

  const scrollDirection =
    useRef('idle');

  // ==========================================================
  // SHOW
  // ==========================================================

  const showClientTabBar =
    useCallback(() => {
      setTabBarVisible(
        true
      );
    }, []);

  // ==========================================================
  // HIDE
  // ==========================================================

  const hideClientTabBar =
    useCallback(() => {
      setTabBarVisible(
        false
      );
    }, []);

  // ==========================================================
  // TOGGLE
  // ==========================================================

  const toggleClientTabBar =
    useCallback(() => {
      setTabBarVisible(
        previous =>
          !previous
      );
    }, []);

  // ==========================================================
  // RESET
  // ==========================================================

  const resetClientScroll =
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
  // SCROLL HANDLER GLOBAL
  // ==========================================================
  //
  // currentY > previousY
  //       => scroll vers le haut
  //       => menu disparaît
  //
  // currentY < previousY
  //       => scroll vers le bas
  //       => menu apparaît
  //
  // ==========================================================

  const handleClientScroll =
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

        // -----------------------------------------------
        // Toujours visible tout en haut
        // -----------------------------------------------

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

          return;
        }

        // -----------------------------------------------
        // Delta
        // -----------------------------------------------

        const delta =
          currentY -
          lastScrollY.current;

        // -----------------------------------------------
        // Trop petit mouvement
        // -----------------------------------------------

        if (
          Math.abs(delta) <
          SCROLL_THRESHOLD
        ) {
          return;
        }

        // -----------------------------------------------
        // SCROLL VERS LE HAUT
        // -----------------------------------------------
        //
        // Finger moving up:
        // contentOffset.y augmente
        //
        // -----------------------------------------------

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

        // -----------------------------------------------
        // SCROLL VERS LE BAS
        // -----------------------------------------------
        //
        // contentOffset.y diminue
        //
        // -----------------------------------------------

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
        showClientTabBar,
        hideClientTabBar,
        toggleClientTabBar,
        handleClientScroll,
        resetClientScroll,
        tabBarVisible,
      }),
      [
        showClientTabBar,
        hideClientTabBar,
        toggleClientTabBar,
        handleClientScroll,
        resetClientScroll,
        tabBarVisible,
      ]
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <ClientTabBarContext.Provider
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
              <ClientTabBar
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
          {/* ACCUEIL */}
          {/* ================================================= */}

          <Tab.Screen
            name="Accueil"
            component={
              HomeStack
            }
            options={{
              tabBarLabel:
                'Accueil',
            }}
          />

          {/* ================================================= */}
          {/* RÉSERVATIONS */}
          {/* ================================================= */}

          <Tab.Screen
            name="Réservations"
            component={
              BookingStack
            }
            options={{
              tabBarLabel:
                'Réservations',
            }}
          />

          {/* ================================================= */}
          {/* MESSAGES */}
          {/* ================================================= */}

          <Tab.Screen
            name="Messages"
            component={
              ChatStack
            }
            options={{
              tabBarLabel:
                'Messages',
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
    </ClientTabBarContext.Provider>
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

export default ClientNavigator;