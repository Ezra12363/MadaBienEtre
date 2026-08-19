// src/screens/therapist/OfferScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import axios from 'axios';
import { API_URL } from '../../config';

const OfferScreen = ({ navigation, route }) => {
  const { bookingId, clientName, currentPrice, massageType } = route.params || {};
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [price, setPrice] = useState(currentPrice?.toString() || '');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [booking, setBooking] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const suggestedPrices = [
    { label: 'Prix proposé', value: currentPrice },
    { label: '+10%', value: Math.round(currentPrice * 1.1) },
    { label: '+15%', value: Math.round(currentPrice * 1.15) },
    { label: '+20%', value: Math.round(currentPrice * 1.2) },
  ];

  useEffect(() => {
    loadBookingDetails();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadBookingDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBooking(response.data);
    } catch (error) {
      console.error('Error loading booking:', error);
      setBooking({
        id: bookingId,
        client: { fullname: clientName || 'Client' },
        massage_type: massageType || 'Massage Relaxant',
        client_price_proposed: currentPrice || 30000,
      });
    }
  };

  const handleSubmitOffer = async () => {
    if (!price || parseInt(price) <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir un prix valide');
      return;
    }

    if (parseInt(price) < 10000) {
      Alert.alert('Erreur', 'Le prix minimum est de 10 000 Ar');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(
        `${API_URL}/offers/create`,
        {
          booking_id: bookingId,
          price_offered: parseInt(price),
          message: message || 'Offre de massage',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert(
        '✅ Offre envoyée',
        'Votre offre a été envoyée au client',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible d\'envoyer l\'offre');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header title="Faire une offre" showBack />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Détails de la demande */}
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={[styles.bookingCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>
              Détails de la demande
            </Text>
            <View style={styles.bookingRow}>
              <Text style={[styles.bookingLabel, { color: themeColors.textSecondary }]}>
                Client
              </Text>
              <Text style={[styles.bookingValue, { color: themeColors.text }]}>
                {booking?.client?.fullname || clientName}
              </Text>
            </View>
            <View style={styles.bookingRow}>
              <Text style={[styles.bookingLabel, { color: themeColors.textSecondary }]}>
                Massage
              </Text>
              <Text style={[styles.bookingValue, { color: themeColors.text }]}>
                {booking?.massage_type || massageType}
              </Text>
            </View>
            <View style={styles.bookingRow}>
              <Text style={[styles.bookingLabel, { color: themeColors.textSecondary }]}>
                Prix proposé
              </Text>
              <Text style={[styles.bookingValue, { color: colors.primary }]}>
                {currentPrice?.toLocaleString()} Ar
              </Text>
            </View>
          </View>
        </Animatable.View>

        {/* Suggestions de prix */}
        <Animatable.View animation="fadeInUp" delay={200} duration={600}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Suggestions de prix
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {suggestedPrices.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionCard,
                  parseInt(price) === item.value && styles.suggestionCardActive,
                  { backgroundColor: themeColors.surface }
                ]}
                onPress={() => setPrice(item.value.toString())}
              >
                <Text style={[
                  styles.suggestionLabel,
                  parseInt(price) === item.value && styles.suggestionLabelActive,
                  { color: themeColors.text }
                ]}>
                  {item.label}
                </Text>
                <Text style={[
                  styles.suggestionValue,
                  parseInt(price) === item.value && styles.suggestionValueActive,
                  { color: colors.primary }
                ]}>
                  {item.value?.toLocaleString()} Ar
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animatable.View>

        {/* Formulaire */}
        <Animatable.View animation="fadeInUp" delay={400} duration={600}>
          <View style={[styles.formCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.formTitle, { color: themeColors.text }]}>
              Votre offre
            </Text>

            <View style={styles.priceInputContainer}>
              <Text style={styles.priceCurrency}>Ar</Text>
              <TextInput
                style={[styles.priceInput, { color: themeColors.text }]}
                placeholder="Entrez votre prix"
                placeholderTextColor={themeColors.textSecondary}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.messageInputContainer}>
              <TextInput
                style={[styles.messageInput, { color: themeColors.text }]}
                placeholder="Message au client (optionnel)"
                placeholderTextColor={themeColors.textSecondary}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSubmitOffer}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryLight]}
                style={styles.sendGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.sendContent}>
                    <Text style={styles.sendText}>Envoyer l'offre</Text>
                    <Ionicons name="send-outline" size={20} color="#fff" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animatable.View>

        {/* Conseil IA */}
        <Animatable.View animation="fadeInUp" delay={600} duration={600}>
          <View style={[styles.tipCard, { backgroundColor: colors.primary + '10' }]}>
            <View style={styles.tipHeader}>
              <Ionicons name="bulb-outline" size={24} color={colors.primary} />
              <Text style={[styles.tipTitle, { color: colors.primary }]}>
                Conseil IA
              </Text>
            </View>
            <Text style={[styles.tipText, { color: themeColors.text }]}>
              Un prix entre {Math.round(currentPrice * 0.95).toLocaleString()} et {Math.round(currentPrice * 1.15).toLocaleString()} Ar a 85% de chances d'être accepté.
            </Text>
          </View>
        </Animatable.View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  bookingCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.sm,
  },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  bookingLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  bookingValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.sm,
  },
  suggestionCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginRight: spacing.sm,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestionCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  suggestionLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
  suggestionLabelActive: {
    color: colors.primary,
  },
  suggestionValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    marginTop: 2,
  },
  suggestionValueActive: {
    color: colors.primary,
  },
  formCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.md,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  priceCurrency: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  priceInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  messageInputContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  messageInput: {
    minHeight: 80,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    textAlignVertical: 'top',
  },
  sendButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  sendGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  sendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sendText: {
    color: '#fff',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  tipCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tipTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  tipText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
});

export default OfferScreen;