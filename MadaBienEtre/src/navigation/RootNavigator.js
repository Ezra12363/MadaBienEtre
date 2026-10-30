// src/navigation/RootNavigator.js
import { useContext, useEffect, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainerRefContext } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Text, StyleSheet, Platform } from 'react-native';
import { colors, typography } from '../theme';
import { saveNavState, loadNavState } from '../utils/lastTab';

import AuthNavigator from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import TherapistNavigator from './TherapistNavigator';
import AdminNavigator from './AdminNavigator';

// Écrans communs
import SOSScreen from '../screens/client/SOSScreen';
import NotificationScreen from '../screens/client/NotificationScreen';
import ChatScreen from '../screens/client/ChatScreen';
import BookingDetailScreen from '../screens/client/BookingDetailScreen';
import PaymentScreen from '../screens/client/PaymentScreen';
import RatingScreen from '../screens/client/RatingScreen';
import MyReviewsScreen from '../screens/client/MyReviewsScreen';
import TherapistReviewsScreen from '../screens/client/TherapistReviewsScreen';
import TrackingScreen from '../screens/client/TrackingScreen';

const Stack = createNativeStackNavigator();

const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.loadingText}>Mada Bien-être</Text>
  </View>
);

// ✅ Component misaraka ho an'ny navigator tsirairay
const MainNavigator = () => {
  const { user } = useAuth();
  
  switch (user?.role) {
    case 'THERAPIST':
      return <TherapistNavigator />;
    case 'ADMIN':
      return <AdminNavigator />;
    default:
         return <ClientNavigator />;
      
  }
};

// ✅ Restaure la page exacte (avec sous-pages et paramètres) après une
// actualisation du navigateur (web) et la mémorise à chaque changement.
const usePersistNavigation = (user, isAuthenticated, isLoading) => {
  const root = useContext(NavigationContainerRefContext);
  const [restored, setRestored] = useState(Platform.OS !== 'web' || !root);
  const doneRef = useRef(false);

  // 1) Restauration (une seule fois, après connexion/chargement de la session)
  useEffect(() => {
    if (restored || doneRef.current || isLoading) return undefined;

    if (!isAuthenticated) {
      // Rien à restaurer pour l'écran de connexion
      doneRef.current = true;
      setRestored(true);
      return undefined;
    }

    const saved = loadNavState(user);
    if (!saved) {
      doneRef.current = true;
      setRestored(true);
      return undefined;
    }

    let attempts = 0;
    let timer;

    const tryRestore = () => {
      attempts += 1;

      if (root && root.isReady && root.isReady()) {
        try {
          root.resetRoot(saved);
        } catch (e) {
          // état invalide : on reste sur la page par défaut
        }
        doneRef.current = true;
        setRestored(true);
        return;
      }

      if (attempts > 20) {
        doneRef.current = true;
        setRestored(true);
        return;
      }

      timer = setTimeout(tryRestore, 50);
    };

    timer = setTimeout(tryRestore, 0);

    return () => clearTimeout(timer);
  }, [restored, isLoading, isAuthenticated, user, root]);

  // 2) Sauvegarde à chaque changement de navigation
  useEffect(() => {
    if (Platform.OS !== 'web' || !root || !restored || !isAuthenticated) {
      return undefined;
    }

    const save = () => {
      try {
        const state = root.getRootState && root.getRootState();
        const current = state?.routes?.[state.index ?? 0]?.name;
        if (state && current && current !== 'Auth') {
          saveNavState(user, state);
        }
      } catch (e) {
        // ignoré
      }
    };

    save();
    const unsubscribe = root.addListener('state', save);

    return unsubscribe;
  }, [root, restored, isAuthenticated, user]);

  return restored;
};

const RootNavigator = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const restored = usePersistNavigation(user, isAuthenticated, isLoading);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.root}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="SOS" component={SOSScreen} />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="Rating" component={RatingScreen} />
            <Stack.Screen name="MyReviews" component={MyReviewsScreen} />
            <Stack.Screen name="TherapistReviews" component={TherapistReviewsScreen} />
            <Stack.Screen name="Tracking" component={TrackingScreen} />
          </>
        )}
      </Stack.Navigator>

      {/* Écran de chargement tant que la page n'est pas restaurée (évite le flash « Accueil ») */}
      {!restored && (
        <View style={styles.overlay}>
          <LoadingScreen />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
});

export default RootNavigator;