// src/navigation/ClientNavigator.js

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
  SafeAreaView,
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
import OffersScreen from '../screens/client/OffersScreen';

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

      {/* ==========================================================
          HISTORIQUE DES DEMANDES
          Route cible du bouton "Voir le demande" depuis BookingScreen.
          ========================================================== */}
      <Stack.Screen
        name="Réservations"
        component={HistoryScreen}
      />

      <Stack.Screen
        name="Negotiation"
        component={NegotiationScreen}
      />

      {/* ==========================================================
          ✅ FIXÉ : route manquante — BookingDetailScreen appelle
          navigation.navigate('Offers', { bookingId }) mais cet écran
          n'était jamais enregistré, donc la négociation ne
          s'ouvrait jamais côté client.
          ========================================================== */}
      <Stack.Screen
        name="Offers"
        component={OffersScreen}
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

      {/* ✅ FIXÉ : même route manquante que dans HomeStack */}
      <Stack.Screen
        name="Offers"
        component={OffersScreen}
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
// HISTORY STACK
// ============================================================
//
// Nouvel onglet "Historique" du client. Regroupe HistoryScreen et
// tous les écrans qu'il peut ouvrir (voir dans HistoryScreen.js :
// navigation.navigate('BookingDetail', ...) et
// navigation.navigate('CreateBooking')), pour que la navigation
// imbriquée reste cohérente que l'on soit sur cet onglet ou un autre.
// ============================================================

const HistoryStack = () => {
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
        name="HistoryScreen"
        component={HistoryScreen}
      />

      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
      />

      <Stack.Screen
        name="CreateBooking"
        component={BookingScreen}
      />

      <Stack.Screen
        name="Negotiation"
        component={NegotiationScreen}
      />

      <Stack.Screen
        name="Offers"
        component={OffersScreen}
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

    case 'Historique':
      return focused
        ? 'time'
        : 'time-outline';

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

    case 'Historique':
      return 'Historique';

    case 'Messages':
      return 'Messages';

    case 'Profil':
      return 'Profil';

    default:
      return routeName;
  }
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
    <NavBridgeProvider>
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

        <TopNavBar brandLabel="Mada Bien-être" />

        {/* ================================================== */}
        {/* TABS */}
        {/* ================================================== */}

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
          {/* HISTORIQUE */}
          {/* ================================================= */}

          <Tab.Screen
            name="Historique"
            component={
              HistoryStack
            }
            options={{
              tabBarLabel:
                'Historique',
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
    </NavBridgeProvider>
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

  });

export default ClientNavigator;