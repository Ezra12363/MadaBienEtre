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
// NOTIFICATIONS
// ============================================================

import NotificationScreen from '../screens/therapist/NotificationScreen';

// ============================================================
// ÉCRANS THÉRAPEUTE
// ============================================================

import DashboardScreen from '../screens/therapist/DashboardScreen';
import OffersScreen from '../screens/therapist/OffersScreen';
import CalendarScreen from '../screens/therapist/CalendarScreen';
import EarningsScreen from '../screens/therapist/EarningsScreen';
import ProfileScreen from '../screens/therapist/ProfileScreen';

import OfferScreen from '../screens/therapist/OfferScreen';
import NegotiationScreen from '../screens/therapist/NegotiationScreen';
import NavigationScreen from '../screens/therapist/NavigationScreen';
import TrackingScreen from '../screens/therapist/TrackingScreen';

// ------------------------------------------------------------
// IMPORTANT :
// ChatScreen sy SOSScreen dia tsy navoahana teto taloha —
// izay no antony nanindronan'ny bouton "Message direct" sy
// "SOS" tao amin'ny BookingDetailScreen tany amin'ny page
// diso (na tsy nisy fiovana mihitsy). Nampidirina eto miaraka
// amin'ny anarana "TherapistChat" / "TherapistSOS" mba tsy
// hifangaro mihitsy amin'ny route mety hisy mitovy anarana
// (Chat / SOS) ao amin'ny ClientNavigator.
// ------------------------------------------------------------
import ChatScreen from '../screens/therapist/ChatScreen';
import SOSScreen from '../screens/therapist/SOSScreen';

import WithdrawScreen from '../screens/therapist/WithdrawScreen';
import AvailabilityScreen from '../screens/therapist/AvailabilityScreen';
import ReviewsScreen from '../screens/therapist/ReviewsScreen';
import UploadDocumentsScreen from '../screens/therapist/UploadDocumentsScreen';

// ============================================================
// BOOKING DETAIL
// ============================================================

import BookingDetailScreen from '../screens/therapist/BookingDetailScreen';

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
  const {
    colors: themeColors,
  } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="DashboardScreen"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor:
            themeColors.background,
        },
      }}
    >

      {/* ======================================================
          DASHBOARD
      ====================================================== */}

      <Stack.Screen
        name="DashboardScreen"
        component={DashboardScreen}
      />

      {/* ======================================================
          NOTIFICATION THÉRAPEUTE
          
          IMPORTANT :
          Nom UNIQUE pour éviter le conflit avec le
          route "Notifications" du ClientNavigator.
      ====================================================== */}

      <Stack.Screen
        name="TherapistNotifications"
        component={NotificationScreen}
      />

      {/* ======================================================
          GAINS
      ====================================================== */}

      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
      />

      {/* ======================================================
          RETRAIT
      ====================================================== */}

      <Stack.Screen
        name="Withdraw"
        component={WithdrawScreen}
      />

      {/* ======================================================
          DISPONIBILITÉ
      ====================================================== */}

      <Stack.Screen
        name="Availability"
        component={AvailabilityScreen}
      />

      {/* ======================================================
          AVIS
      ====================================================== */}

      <Stack.Screen
        name="Reviews"
        component={ReviewsScreen}
      />

      {/* ======================================================
          DOCUMENTS
      ====================================================== */}

      <Stack.Screen
        name="UploadDocuments"
        component={UploadDocumentsScreen}
      />

    </Stack.Navigator>
  );
};

// ============================================================
// REQUESTS / DEMANDES STACK
// ============================================================

const RequestsStack = () => {
  const {
    colors: themeColors,
  } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Offers"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor:
            themeColors.background,
        },
      }}
    >

      {/* ======================================================
          LISTE DES DEMANDES
      ====================================================== */}

      <Stack.Screen
        name="Offers"
        component={OffersScreen}
      />

      {/* ======================================================
          DÉTAIL OFFRE
      ====================================================== */}

      <Stack.Screen
        name="Offer"
        component={OfferScreen}
      />

      {/* ======================================================
          ⚠️ IMPORTANT — FIX NAVIGATION / TRACKING / NEGOTIATION /
          CHAT / SOS
          ======================================================
          Navigation, Tracking, Negotiation, TherapistChat sy
          TherapistSOS dia NESORINA teto (tao amin'ny stack
          "Demandes") satria ampiasain'ny BookingDetailScreen
          (izay ao amin'ny tab "Calendrier") koa ireo — raha
          mijanona ao anaty stack "Demandes" ireo écran ireo dia:
            1) mamadika automatique ny tab actif ho "Demandes"
               (satria ilay écran dia tao anaty stack "Demandes"),
            2) rehefa "retour" avy any dia tsy miverina amin'ny
               BookingDetail intsony fa mijanona/mikisaka ao
               anaty stack "Demandes",
            3) rehefa tsindriana indray ny tab "Demandes" dia ilay
               écran farany navigué (Navigation/Tracking) no
               miseho fa tsy OffersScreen.

          Noho izany dia napetraka ao amin'ny STACK ROOT (jereo
          ny "TherapistNavigator" ambany, ivelan'ny Tab.Navigator)
          ireo écran ireo, mba ho azo antenaina avy amin'ny tab
          rehetra (navigate() dia "bubble up" hatrany amin'ny
          navigator root raha tsy hita ao amin'ny stack lokaly),
          nefa tsy manova ny tab actif ary ny "retour" dia
          miverina marina amin'ny écran nahatongavana.
      ====================================================== */}

    </Stack.Navigator>
  );
};

// ============================================================
// CALENDAR STACK
// ============================================================

const CalendarStack = () => {
  const {
    colors: themeColors,
  } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="CalendarScreen"
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
  const {
    colors: themeColors,
  } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="EarningsScreen"
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
  const {
    colors: themeColors,
  } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="ProfileScreen"
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
// CUSTOM TAB BAR
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
  // ANIMATION
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

          useNativeDriver:
            true,
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

          useNativeDriver:
            true,
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
    colors?.primary ||
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
          height:
            tabHeight,

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
            height:
              tabHeight,

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

              const onPress =
                () => {

                  const event =
                    navigation.emit({
                      type:
                        'tabPress',

                      target:
                        route.key,

                      canPreventDefault:
                        true,
                    });

                  if (
                    !focused &&
                    !event.defaultPrevented
                  ) {

                    navigation.navigate(
                      route.name
                    );
                  }
                };

              const onLongPress =
                () => {

                  navigation.emit({
                    type:
                      'tabLongPress',

                    target:
                      route.key,
                  });

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

                  <Animated.Text
                    numberOfLines={1}
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

const TherapistTabsScreen = () => {

  const {
    colors: themeColors,
    isDark,
  } = useTheme();

  const [
    tabBarVisible,
    setTabBarVisible,
  ] = useState(true);

  const lastScrollY =
    useRef(0);

  const lastScrollTime =
    useRef(0);

  const scrollDirection =
    useRef('idle');

  // ==========================================================
  // SHOW
  // ==========================================================

  const showTherapistTabBar =
    useCallback(() => {

      setTabBarVisible(true);

    }, []);

  // ==========================================================
  // HIDE
  // ==========================================================

  const hideTherapistTabBar =
    useCallback(() => {

      setTabBarVisible(false);

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
  // RESET
  // ==========================================================

  const resetTherapistScroll =
    useCallback(() => {

      lastScrollY.current =
        0;

      lastScrollTime.current =
        0;

      scrollDirection.current =
        'idle';

      setTabBarVisible(true);

    }, []);

  // ==========================================================
  // SCROLL
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

        if (
          currentY <=
          SHOW_AT_TOP
        ) {

          if (
            !tabBarVisible
          ) {

            setTabBarVisible(true);

          }

          lastScrollY.current =
            currentY;

          scrollDirection.current =
            'idle';

          return;
        }

        const delta =
          currentY -
          lastScrollY.current;

        if (
          Math.abs(delta) <
          SCROLL_THRESHOLD
        ) {
          return;
        }

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

        } else if (
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

      <View
        style={[
          styles.container,
          {
            backgroundColor:
              themeColors.background,
          },
        ]}
      >

        <StatusBar
          barStyle={
            isDark
              ? 'light-content'
              : 'dark-content'
          }

          backgroundColor={
            themeColors.background
          }

          translucent={false}
        />

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

            lazy:
              true,

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

      </View>

    </TherapistTabBarContext.Provider>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
    },

    tabBarWrapper: {
      width: '100%',
      overflow: 'hidden',
    },

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

    tabButton: {
      flex: 1,

      minWidth: 0,

      alignItems:
        'center',

      justifyContent:
        'center',

      position:
        'relative',

      paddingTop:
        5,

      paddingHorizontal:
        2,
    },

    iconContainer: {
      width: 42,

      height: 32,

      borderRadius: 16,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom:
        2,
    },

    tabLabel: {
      fontSize:
        Platform.OS === 'web'
          ? 11
          : 10,

      lineHeight:
        14,

      textAlign:
        'center',

      includeFontPadding:
        false,

      maxWidth:
        100,
    },

    activeIndicator: {
      position:
        'absolute',

      bottom:
        0,

      width:
        24,

      height:
        3,

      borderRadius:
        3,
    },

  });

// ============================================================
// ROOT STACK — Tabs + écrans "cross-tab"
//
// FIX : Navigation, Tracking, TherapistChat, TherapistSOS dia
// tonga eto (ivelan'ny Tab.Navigator) mba azo antsoina avy
// amin'ny tab na stack rehetra (Calendrier, Demandes, sns.)
// nefa:
//   - tsy mamadika ny tab actif eo amin'ny tab bar,
//   - ny bouton "retour" (Header.js -> navigation.goBack())
//     dia miverina marina any amin'ny écran nahatongavana
//     (ohatra: BookingDetailScreen), fa tsy any amin'ny
//     page d'accueil,
//   - rehefa tsindriana indray ny tab "Demandes" dia
//     OffersScreen foana no miseho, satria ny stack "Demandes"
//     tsy voakasik'ireo écran ireo intsony.
// ============================================================

const TherapistNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="TherapistTabs"
        component={TherapistTabsScreen}
      />

      <Stack.Screen
        name="Navigation"
        component={NavigationScreen}
      />

      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
      />

      {/* ✅ FIX : Negotiation dia écran ROOT izao (nesorina tao
          amin'ny stack "Demandes"), toy ny Navigation sy Tracking —
          mba tsy hamadika ny tab actif rehefa antsoina avy amin'ny
          tab "Calendrier" (BookingDetailScreen). */}
      <Stack.Screen
        name="Negotiation"
        component={NegotiationScreen}
      />

      <Stack.Screen
        name="TherapistChat"
        component={ChatScreen}
      />

      <Stack.Screen
        name="TherapistSOS"
        component={SOSScreen}
      />
    </Stack.Navigator>
  );
};

export default TherapistNavigator;