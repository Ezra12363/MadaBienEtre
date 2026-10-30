// src/navigation/ClientNavigator.js

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import { useTheme } from '../context/ThemeContext';
import { getLastTab, saveLastTab } from '../utils/lastTab';

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
import ConversationsScreen from '../screens/shared/ConversationsScreen';
import PaymentScreen from '../screens/client/PaymentScreen';
import RatingScreen from '../screens/client/RatingScreen';
import MyReviewsScreen from '../screens/client/MyReviewsScreen';
import TherapistReviewsScreen from '../screens/client/TherapistReviewsScreen';
import TrackingScreen from '../screens/client/TrackingScreen';
import SOSScreen from '../screens/client/SOSScreen';
import SOSAlertUserDetailScreen from '../screens/shared/SOSAlertUserDetailScreen';
import HistoryScreen from '../screens/client/HistoryScreen';
import NegotiationScreen from '../screens/client/NegotiationScreen';
import OffersScreen from '../screens/client/OffersScreen';
import AIRecommendationScreen from '../screens/client/AIRecommendationScreen';

// ✅ NOUVEAU : écran plein "Publications des thérapeutes"
import TherapistPublicationsScreen from '../screens/client/TherapistPublicationsScreen';

// ============================================================
// NAVIGATORS
// ============================================================

import ReceiptScreen from '../screens/shared/ReceiptScreen';

// Onglets valides (pour restaurer la page après actualisation du navigateur)
const CLIENT_TAB_NAMES = ['Accueil', 'Réservations', 'Historique', 'Messages', 'Profil'];

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ============================================================
// CONSTANTES UX
// ============================================================

const SCROLL_THRESHOLD = 8;
const SHOW_AT_TOP = 10;

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
// OPTIONS COMMUNES DES STACKS
// ============================================================

const useStackScreenOptions = () => {
  const { colors: themeColors } = useTheme();

  return {
    headerShown: false,
    animation: 'fade',
    contentStyle: {
      backgroundColor: themeColors.background,
    },
  };
};

// ============================================================
// ÉCRANS COMMUNS À TOUTES LES PILES
// ============================================================
//
// ✅ Barre de navigation (logo + menu + profil) toujours visible.
// Quand un écran (Tracking, Payment, Chat, ...) n'était pas déclaré dans la
// pile de l'onglet courant, React Navigation « remontait » vers le
// RootNavigator : l'écran s'ouvrait alors EN DEHORS de ClientNavigator, donc
// SANS la TopNavBar. En déclarant ces écrans dans chaque pile, ils restent à
// l'intérieur des onglets, avec le header / la barre de navigation.
// `exclude` évite les doublons avec les écrans déjà déclarés dans la pile.

const COMMON_SCREENS = [
  ['BookingDetail', BookingDetailScreen],
  ['Chat', ChatScreen],
  ['Payment', PaymentScreen],
  ['Rating', RatingScreen],
  ['MyReviews', MyReviewsScreen],
  ['TherapistReviews', TherapistReviewsScreen],
  ['Tracking', TrackingScreen],
  ['SOS', SOSScreen],
  ['SOSAlertDetail', SOSAlertUserDetailScreen],
  ['Notifications', NotificationScreen],
  ['History', HistoryScreen],
  ['Negotiation', NegotiationScreen],
  ['Offers', OffersScreen],
];

const renderCommonScreens = (exclude = []) =>
  COMMON_SCREENS.filter(([name]) => !exclude.includes(name)).map(([name, component]) => (
    <Stack.Screen key={`common-${name}`} name={name} component={component} />
  ));

// ============================================================
// HOME STACK
// ============================================================

const HomeStack = () => {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
      />

      {/* ✨ Assistant IA & Chatbot (recommandations, estimation, chatbot) */}
      <Stack.Screen
        name="AIRecommendation"
        component={AIRecommendationScreen}
      />

      <Stack.Screen
        name="SearchMassage"
        component={SearchMassageScreen}
      />

      {/* ==========================================================
          ✅ NOUVEAU : Publications des thérapeutes (plein écran,
          responsive web + mobile). Ouvert depuis HomeScreen via
          navigate('TherapistPublications').
          ========================================================== */}
      <Stack.Screen
        name="TherapistPublications"
        component={TherapistPublicationsScreen}
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
        name="SOSAlertDetail"
        component={SOSAlertUserDetailScreen}
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

      <Stack.Screen
        name="ChatDetail"
        component={ChatScreen}
      />
      <Stack.Screen name="MyReviews" component={MyReviewsScreen} />
      <Stack.Screen name="TherapistReviews" component={TherapistReviewsScreen} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} />
    </Stack.Navigator>
  );
};

// ============================================================
// BOOKING STACK
// ============================================================

const BookingStack = () => {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
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

      <Stack.Screen
        name="ChatDetail"
        component={ChatScreen}
      />

      {renderCommonScreens([
        'BookingDetail', 'Chat', 'Payment', 'Rating', 'Tracking',
        'Notifications', 'History', 'Negotiation', 'Offers',
      ])}
      <Stack.Screen name="Receipt" component={ReceiptScreen} />
    </Stack.Navigator>
  );
};

// ============================================================
// CHAT STACK
// ============================================================

const ChatStack = () => {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ChatList"
        component={ConversationsScreen}
      />

      <Stack.Screen
        name="ChatDetail"
        component={ChatScreen}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationScreen}
      />

      {/* ✅ Tracking / Réservation / Paiement... restent dans l'onglet Messages
          (avec la barre de navigation) quand on les ouvre depuis la discussion
          — ex. « Suivre le thérapeute en route ». */}
      {renderCommonScreens(['Notifications'])}
      <Stack.Screen name="Receipt" component={ReceiptScreen} />
    </Stack.Navigator>
  );
};

// ============================================================
// PROFILE STACK
// ============================================================

const ProfileStack = () => {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
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

      <Stack.Screen
        name="ChatDetail"
        component={ChatScreen}
      />

      {renderCommonScreens([
        'Notifications', 'BookingDetail', 'History', 'Payment', 'Rating',
      ])}
      <Stack.Screen name="Receipt" component={ReceiptScreen} />
    </Stack.Navigator>
  );
};

// ============================================================
// HISTORY STACK
// ============================================================
//
// Onglet "Historique" du client. Regroupe HistoryScreen et tous
// les écrans qu'il peut ouvrir (BookingDetail, CreateBooking, ...),
// pour que la navigation imbriquée reste cohérente que l'on soit
// sur cet onglet ou un autre.
// ============================================================

const HistoryStack = () => {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
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

      <Stack.Screen
        name="ChatDetail"
        component={ChatScreen}
      />

      {renderCommonScreens([
        'BookingDetail', 'Chat', 'Payment', 'Rating', 'Tracking',
        'Notifications', 'Negotiation', 'Offers',
      ])}
      <Stack.Screen name="Receipt" component={ReceiptScreen} />
    </Stack.Navigator>
  );
};

// ============================================================
// TAB ICONS
// ============================================================

const getTabIcon = (routeName, focused) => {
  switch (routeName) {
    case 'Accueil':
      return focused ? 'home' : 'home-outline';

    case 'Réservations':
      return focused ? 'calendar' : 'calendar-outline';

    case 'Historique':
      return focused ? 'time' : 'time-outline';

    case 'Messages':
      return focused ? 'chatbubbles' : 'chatbubbles-outline';

    case 'Profil':
      return focused ? 'person' : 'person-outline';

    default:
      return 'home-outline';
  }
};

// ============================================================
// TAB LABEL
// ============================================================

const getTabLabel = (routeName) => {
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
  // Etat visibilité de la barre d'onglets
  // ----------------------------------------------------------

  // Page (onglet) à rouvrir après une actualisation du navigateur
  const [initialTab] = useState(() =>
    getLastTab('client', CLIENT_TAB_NAMES)
  );

  const [tabBarVisible, setTabBarVisible] = useState(true);

  // Dernière position de scroll
  const lastScrollY = useRef(0);

  // Timestamp du dernier scroll
  const lastScrollTime = useRef(0);

  // Direction courante : 'idle' | 'up' | 'down'
  const scrollDirection = useRef('idle');

  // ==========================================================
  // SHOW / HIDE / TOGGLE / RESET
  // ==========================================================

  const showClientTabBar = useCallback(() => {
    setTabBarVisible(true);
  }, []);

  const hideClientTabBar = useCallback(() => {
    setTabBarVisible(false);
  }, []);

  const toggleClientTabBar = useCallback(() => {
    setTabBarVisible((previous) => !previous);
  }, []);

  const resetClientScroll = useCallback(() => {
    lastScrollY.current = 0;
    lastScrollTime.current = 0;
    scrollDirection.current = 'idle';

    setTabBarVisible(true);
  }, []);

  // ==========================================================
  // SCROLL HANDLER GLOBAL
  // ==========================================================
  //
  // currentY > previousY  => scroll vers le haut => menu disparaît
  // currentY < previousY  => scroll vers le bas  => menu apparaît
  //
  // ==========================================================

  const handleClientScroll = useCallback(
    (event) => {
      if (!event || !event.nativeEvent) {
        return;
      }

      const currentY =
        event.nativeEvent.contentOffset?.y || 0;

      // Toujours visible tout en haut
      if (currentY <= SHOW_AT_TOP) {
        if (!tabBarVisible) {
          setTabBarVisible(true);
        }

        lastScrollY.current = currentY;

        return;
      }

      const delta = currentY - lastScrollY.current;

      // Mouvement trop petit : on ignore
      if (Math.abs(delta) < SCROLL_THRESHOLD) {
        return;
      }

      if (delta > 0) {
        // Contenu qui monte => on cache la barre
        if (scrollDirection.current !== 'up') {
          scrollDirection.current = 'up';

          setTabBarVisible(false);
        }
      } else if (delta < 0) {
        // Contenu qui redescend => on montre la barre
        if (scrollDirection.current !== 'down') {
          scrollDirection.current = 'down';

          setTabBarVisible(true);
        }
      }

      lastScrollY.current = currentY;
      lastScrollTime.current = Date.now();
    },
    [tabBarVisible]
  );

  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const contextValue = useMemo(
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
    <ClientTabBarContext.Provider value={contextValue}>
      <NavBridgeProvider>
        <SafeAreaView
          style={[
            styles.container,
            {
              backgroundColor: themeColors.background,
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
            backgroundColor={themeColors.background}
            translucent={false}
          />

          <TopNavBar brandLabel="Mada Bien-être" />

          {/* ================================================== */}
          {/* TABS */}
          {/* ================================================== */}

          <Tab.Navigator
            initialRouteName={initialTab}
            screenListeners={({ route }) => ({
              focus: () => saveLastTab('client', route.name),
            })}
            tabBar={(props) => (
              <TabBarConnector
                {...props}
                visible={tabBarVisible}
                getIcon={getTabIcon}
                getLabel={getTabLabel}
              />
            )}
            screenOptions={{
              headerShown: false,
              lazy: true,
              tabBarHideOnKeyboard: true,
              sceneStyle: {
                backgroundColor: themeColors.background,
              },
              freezeOnBlur: false,
            }}
          >
            {/* ACCUEIL */}
            <Tab.Screen
              name="Accueil"
              component={HomeStack}
              options={{ tabBarLabel: 'Accueil' }}
            />

            {/* RÉSERVATIONS */}
            <Tab.Screen
              name="Réservations"
              component={BookingStack}
              options={{ tabBarLabel: 'Réservations' }}
            />

            {/* HISTORIQUE */}
            <Tab.Screen
              name="Historique"
              component={HistoryStack}
              options={{ tabBarLabel: 'Historique' }}
            />

            {/* MESSAGES */}
            <Tab.Screen
              name="Messages"
              component={ChatStack}
              options={{ tabBarLabel: 'Messages' }}
            />

            {/* PROFIL */}
            <Tab.Screen
              name="Profil"
              component={ProfileStack}
              options={{ tabBarLabel: 'Profil' }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ClientNavigator;