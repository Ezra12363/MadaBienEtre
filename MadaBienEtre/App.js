// src/App.js
import { useEffect, useState } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { View, ActivityIndicator, Platform } from 'react-native';

// Contexts
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { NotificationProvider } from './src/context/NotificationContext'; // ✅ Import tsara
import { BookingProvider } from './src/context/BookingContext';
import { UserProvider } from './src/context/UserContext';
import { MessengerProvider } from './src/context/MessengerContext';

// Toast global (remplace window.alert / Alert.alert d'information)
import GlobalToastHost from './src/components/common/GlobalToastHost';
import GlobalConfirmHost from './src/components/common/GlobalConfirmHost';
import { installGlobalAlertOverrides } from './src/utils/toast';

// Navigation
import RootNavigator from './src/navigation/RootNavigator';

// Theme
import { theme } from './src/theme';

installGlobalAlertOverrides();

// Web : police de base de la page + cartes Leaflet (qui ont leur propre font).
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'app-global-font';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent =
      "html,body,#root,.leaflet-container,.leaflet-popup-content,.leaflet-tooltip{font-family:'Times New Roman',Times,Tinos,'Liberation Serif',serif;}" +
      "input,textarea,select,button{font-family:inherit;}";
    document.head.appendChild(el);
  }
}

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          // Tinos = clone métrique de Times New Roman (utilisé sur Android,
          // et en repli sur web si Times New Roman n'est pas installé).
          'Tinos-Regular': require('./assets/fonts/Tinos-Regular.ttf'),
          'Tinos-Bold': require('./assets/fonts/Tinos-Bold.ttf'),
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (_e) {
        //console.warn('Error loading assets:', _e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <UserProvider>
              <BookingProvider>
                <NotificationProvider>
                  <MessengerProvider>
                    <NavigationContainer>
                      <StatusBar style="auto" />
                      <RootNavigator />
                    </NavigationContainer>
                    <GlobalToastHost />
                    <GlobalConfirmHost />
                  </MessengerProvider>
                </NotificationProvider>
              </BookingProvider>
            </UserProvider>
          </AuthProvider>
        </PaperProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}