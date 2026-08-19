// src/screens/therapist/SOSScreen.js
// Même code que pour le client, adapté pour le thérapeute

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import * as Location from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import axios from 'axios';
import { API_URL } from '../../config';

const SOSScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token, user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getLocation();
    startPulseAnimation();
    return () => {
      pulseAnim.stopAnimation();
    };
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Erreur', 'Permission de localisation refusée');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleSOS = async () => {
    if (!location) {
      Alert.alert('Erreur', 'Impossible de localiser votre position');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/sos/create`,
        {
          alert_type: 'therapist',
          latitude: location.latitude,
          longitude: location.longitude,
          details: 'Alerte SOS déclenchée par le thérapeute',
          severity: 'critical',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.status === 'active') {
        setIsEmergency(true);
        Alert.alert(
          '🚨 ALERTE SOS ENVOYÉE',
          'Notre équipe d\'urgence a été notifiée. Elle vous contactera dans les plus brefs délais.',
          [
            {
              text: 'OK',
              onPress: () => {
                Linking.openURL('tel:117');
                navigation.goBack();
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('SOS error:', error);
      Alert.alert(
        'Erreur',
        'Impossible d\'envoyer l\'alerte SOS. Veuillez contacter les secours directement.',
        [
          { text: 'Appeler le 117', onPress: () => Linking.openURL('tel:117') },
          { text: 'Annuler', style: 'cancel' },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const emergencyContacts = [
    { name: 'Police', number: '117', icon: 'shield' },
    { name: 'Pompiers', number: '118', icon: 'flame' },
    { name: 'SAMU', number: '119', icon: 'medical' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="SOS - Urgence" showBack />

      <View style={styles.content}>
        <Animatable.View animation="pulse" iterationCount="infinite" duration={2000}>
          <TouchableOpacity
            style={styles.sosButtonContainer}
            onPress={handleSOS}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Animated.View style={[
              styles.sosPulse,
              {
                transform: [{ scale: pulseAnim }],
              }
            ]} />
            <LinearGradient
              colors={['#D32F2F', '#E53935']}
              style={styles.sosButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <View style={styles.sosContent}>
                  <Ionicons name="alert-circle" size={48} color="#fff" />
                  <Text style={styles.sosText}>APPUYEZ EN URGENCE</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>

        <Text style={[styles.sosDescription, { color: themeColors.textSecondary }]}>
          En appuyant sur le bouton, vous envoyez votre position GPS à notre équipe d'urgence
        </Text>

        {location && (
          <View style={[styles.locationCard, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="location" size={24} color={colors.primary} />
            <View style={styles.locationInfo}>
              <Text style={[styles.locationLabel, { color: themeColors.text }]}>
                Votre position
              </Text>
              <Text style={[styles.locationCoords, { color: themeColors.textSecondary }]}>
                Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.emergencyContacts}>
          <Text style={[styles.contactsTitle, { color: themeColors.text }]}>
            Contacts d'urgence
          </Text>
          <View style={styles.contactsGrid}>
            {emergencyContacts.map((contact) => (
              <TouchableOpacity
                key={contact.number}
                style={[styles.contactCard, { backgroundColor: themeColors.surface }]}
                onPress={() => Linking.openURL(`tel:${contact.number}`)}
              >
                <View style={styles.contactIcon}>
                  <Ionicons name={contact.icon} size={28} color={colors.error} />
                </View>
                <Text style={[styles.contactName, { color: themeColors.text }]}>
                  {contact.name}
                </Text>
                <Text style={styles.contactNumber}>{contact.number}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.tipsCard, { backgroundColor: colors.error + '10' }]}>
          <Ionicons name="bulb-outline" size={24} color={colors.error} />
          <View style={styles.tipsContent}>
            <Text style={[styles.tipsTitle, { color: colors.error }]}>
              Conseils de sécurité
            </Text>
            <Text style={[styles.tipsText, { color: themeColors.text }]}>
              • Restez calme et en sécurité
            </Text>
            <Text style={[styles.tipsText, { color: themeColors.text }]}>
              • Envoyez votre position à un proche
            </Text>
            <Text style={[styles.tipsText, { color: themeColors.text }]}>
              • Appelez les secours si nécessaire
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  sosButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
  },
  sosPulse: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.error + '40',
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 1,
  },
  sosContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  sosText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 2,
  },
  sosDescription: {
    textAlign: 'center',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  locationCoords: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  emergencyContacts: {
    marginTop: spacing.lg,
  },
  contactsTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.md,
  },
  contactsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  contactCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactIcon: {
    marginBottom: spacing.xs,
  },
  contactName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  contactNumber: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    color: colors.error,
  },
  tipsCard: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    marginBottom: 4,
  },
  tipsText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
  },
});

export default SOSScreen;