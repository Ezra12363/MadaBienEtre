// src/app/_layout.js
import { Stack } from 'expo-router';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
// ❌ Esory vonjimaika ny NotificationProvider
// import { NotificationProvider } from '../context/NotificationContext';
import { BookingProvider } from '../context/BookingContext';
import { UserProvider } from '../context/UserContext';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <UserProvider>
              <BookingProvider>
                {/* ❌ Esory vonjimaika ny NotificationProvider */}
                <StatusBar style="auto" />
                <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="auth" options={{ headerShown: false }} />
                  <Stack.Screen name="client" options={{ headerShown: false }} />
                  <Stack.Screen name="therapist" options={{ headerShown: false }} />
                  <Stack.Screen name="admin" options={{ headerShown: false }} />
                </Stack>
              </BookingProvider>
            </UserProvider>
          </AuthProvider>
        </PaperProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}