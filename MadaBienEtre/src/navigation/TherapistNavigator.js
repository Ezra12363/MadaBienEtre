// src/navigation/TherapistNavigator.js

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import { useTheme } from '../context/ThemeContext';

import {
  NavBridgeProvider,
  TabBarConnector,
  TopNavBar,
} from '../components/common/AppNavigation';

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

      {/* ======================================================
          NAVIGATION VERS LE CLIENT + SUIVI EN DIRECT + NÉGOCIATION
          ======================================================
          Ces 3 écrans vivent DANS le Tab.Navigator (dans chaque
          stack qui peut les ouvrir). Ainsi :
            - la tab bar du bas reste affichée, exactement
              comme sur les autres pages,
            - l'onglet actif est celui d'où l'on vient,
            - le bouton retour revient à l'écran précédent,
            - retaper sur l'onglet actif revient à la racine du
              stack.
      ====================================================== */}

      <Stack.Screen
        name="Navigation"
        component={NavigationScreen}
      />

      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
      />

      <Stack.Screen
        name="Negotiation"
        component={NegotiationScreen}
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
          NAVIGATION VERS LE CLIENT + SUIVI EN DIRECT + NÉGOCIATION
          ======================================================
          Ces 3 écrans vivent DANS le Tab.Navigator (dans chaque
          stack qui peut les ouvrir). Ainsi :
            - la tab bar du bas reste affichée, exactement
              comme sur les autres pages,
            - l'onglet actif est celui d'où l'on vient,
            - le bouton retour revient à l'écran précédent,
            - retaper sur l'onglet actif revient à la racine du
              stack.
      ====================================================== */}

      <Stack.Screen
        name="Navigation"
        component={NavigationScreen}
      />

      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
      />

      <Stack.Screen
        name="Negotiation"
        component={NegotiationScreen}
      />

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

      {/* ======================================================
          NAVIGATION VERS LE CLIENT + SUIVI EN DIRECT + NÉGOCIATION
          ======================================================
          Ces 3 écrans vivent DANS le Tab.Navigator (dans chaque
          stack qui peut les ouvrir). Ainsi :
            - la tab bar du bas reste affichée, exactement
              comme sur les autres pages,
            - l'onglet actif est celui d'où l'on vient,
            - le bouton retour revient à l'écran précédent,
            - retaper sur l'onglet actif revient à la racine du
              stack.
      ====================================================== */}

      <Stack.Screen
        name="Navigation"
        component={NavigationScreen}
      />

      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
      />

      <Stack.Screen
        name="Negotiation"
        component={NegotiationScreen}
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
    <NavBridgeProvider>

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

        <TopNavBar brandLabel="Mada Bien-être" />

        <Tab.Navigator

          tabBar={
            props => (
              <TabBarConnector
                {...props}
                visible={tabBarVisible}
                getIcon={getTabIcon}
                getLabel={getTabLabel}
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

    </NavBridgeProvider>
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


  });

// ============================================================
// ROOT STACK — Tabs + écrans "cross-tab"
//
// Navigation, Tracking et Negotiation ne sont PLUS ici : ils sont
// enregistrés dans les stacks des onglets (Tableau de bord,
// Demandes, Calendrier) pour que la tab bar du bas reste
// affichée sur ces pages.
//
// Restent ici (plein écran, sans tab bar) : TherapistChat,
// TherapistSOS.
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