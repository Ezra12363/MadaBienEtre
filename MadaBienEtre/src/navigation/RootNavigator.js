// src/navigation/RootNavigator.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

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

const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
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
          <Stack.Screen name="Tracking" component={TrackingScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
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