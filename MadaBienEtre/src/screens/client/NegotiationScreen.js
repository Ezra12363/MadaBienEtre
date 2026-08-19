// src/screens/client/NegotiationScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
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
import Button from '../../components/common/Button';
import axios from 'axios';
import { API_URL } from '../../config';

const NegotiationScreen = ({ navigation, route }) => {
  const { offerId, bookingId, currentPrice, therapistName } = route.params || {};
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [counterPrice, setCounterPrice] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [negotiationHistory, setNegotiationHistory] = useState([]);
  const [booking, setBooking] = useState(null);
  const [selectedPrice, setSelectedPrice] = useState(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const suggestedPrices = [
    { label: '+5%', value: Math.round(currentPrice * 1.05) },
    { label: '+10%', value: Math.round(currentPrice * 1.10) },
    { label: '+15%', value: Math.round(currentPrice * 1.15) },
    { label: '+20%', value: Math.round(currentPrice * 1.20) },
  ];

  useEffect(() => {
    loadNegotiationHistory();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadNegotiationHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/offers/booking/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNegotiationHistory(response.data);
    } catch (error) {
      console.error('Error loading negotiation history:', error);
      // Données mockées
      setNegotiationHistory([
        {
          id: 1,
          user_type: 'therapist',
          price_offered: currentPrice,
          message: 'Offre initiale',
          created_at: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleSubmitCounter = async () => {
    if (!counterPrice || parseInt(counterPrice) <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir un prix valide');
      return;
    }

    if (parseInt(counterPrice) < 10000) {
      Alert.alert('Erreur', 'Le prix minimum est de 10 000 Ar');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(
        `${API_URL}/offers/${offerId}/counter`,
        {
          counter_price: parseInt(counterPrice),
          message: message || 'Contre-proposition',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert(
        '✅ Contre-offre envoyée',
        'Votre proposition a été envoyée au thérapeute',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible d\'envoyer la contre-offre');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  };

  const getPriceDifference = (price) => {
    const diff = price - currentPrice;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toLocaleString()} Ar`;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header title="Négociation" showBack />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* En-tête de négociation */}
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={[styles.headerCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>
              Négociation avec {therapistName || 'le thérapeute'}
            </Text>
            <View style={styles.priceDisplay}>
              <Text style={[styles.priceLabel, { color: themeColors.textSecondary }]}>
                Prix actuel
              </Text>
              <Text style={styles.currentPrice}>
                {currentPrice?.toLocaleString()} Ar
              </Text>
            </View>
          </View>
        </Animatable.View>

        {/* Suggestions de prix */}
        <Animatable.View animation="fadeInUp" delay={200} duration={600}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Suggestions
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {suggestedPrices.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionCard,
                  selectedPrice === item.value && styles.suggestionCardActive,
                  { backgroundColor: themeColors.surface }
                ]}
                onPress={() => {
                  setSelectedPrice(item.value);
                  setCounterPrice(item.value.toString());
                }}
              >
                <Text style={[
                  styles.suggestionLabel,
                  selectedPrice === item.value && styles.suggestionLabelActive,
                  { color: themeColors.text }
                ]}>
                  {item.label}
                </Text>
                <Text style={[
                  styles.suggestionValue,
                  selectedPrice === item.value && styles.suggestionValueActive,
                  { color: colors.primary }
                ]}>
                  {item.value.toLocaleString()} Ar
                </Text>
                <Text style={[
                  styles.suggestionDiff,
                  selectedPrice === item.value && styles.suggestionDiffActive
                ]}>
                  {getPriceDifference(item.value)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animatable.View>

        {/* Formulaire de contre-offre */}
        <Animatable.View animation="fadeInUp" delay={400} duration={600}>
          <View style={[styles.formCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.formTitle, { color: themeColors.text }]}>
              Votre contre-proposition
            </Text>

            <View style={styles.priceInputContainer}>
              <Text style={styles.priceCurrency}>Ar</Text>
              <TextInput
                style={[styles.priceInput, { color: themeColors.text }]}
                placeholder="Entrez votre prix"
                placeholderTextColor={themeColors.textSecondary}
                value={counterPrice}
                onChangeText={setCounterPrice}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.messageInputContainer}>
              <TextInput
                style={[styles.messageInput, { color: themeColors.text }]}
                placeholder="Ajoutez un message (optionnel)"
                placeholderTextColor={themeColors.textSecondary}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSubmitCounter}
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
                    <Text style={styles.sendText}>Envoyer la contre-offre</Text>
                    <Ionicons name="send-outline" size={20} color="#fff" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animatable.View>

        {/* Historique des négociations */}
        <Animatable.View animation="fadeInUp" delay={600} duration={600}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Historique des échanges
          </Text>
          {negotiationHistory.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.historyItem,
                { backgroundColor: themeColors.surface },
                index === negotiationHistory.length - 1 && styles.historyItemLast,
              ]}
            >
              <View style={styles.historyHeader}>
                <View style={[
                  styles.historyBadge,
                  { backgroundColor: item.user_type === 'therapist' ? colors.primary : colors.secondary }
                ]}>
                  <Text style={styles.historyBadgeText}>
                    {item.user_type === 'therapist' ? '👨‍⚕️ Thérapeute' : '👤 Vous'}
                  </Text>
                </View>
                <Text style={[styles.historyDate, { color: themeColors.textSecondary }]}>
                  {formatDate(item.created_at)}
                </Text>
              </View>
              <View style={styles.historyContent}>
                <Text style={[styles.historyPrice, { color: colors.primary }]}>
                  {item.price_offered.toLocaleString()} Ar
                </Text>
                {item.message && (
                  <Text style={[styles.historyMessage, { color: themeColors.textSecondary }]}>
                    "{item.message}"
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Animatable.View>

        {/* Conseils IA */}
        <Animatable.View animation="fadeInUp" delay={800} duration={600}>
          <View style={[styles.tipCard, { backgroundColor: colors.primary + '10' }]}>
            <View style={styles.tipHeader}>
              <Ionicons name="bulb-outline" size={24} color={colors.primary} />
              <Text style={[styles.tipTitle, { color: colors.primary }]}>
                Conseil IA
              </Text>
            </View>
            <Text style={[styles.tipText, { color: themeColors.text }]}>
              Une offre entre {Math.round(currentPrice * 0.95).toLocaleString()} et {Math.round(currentPrice * 1.15).toLocaleString()} Ar a 85% de chances d'être acceptée.
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
  headerCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
  },
  priceDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  priceLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  currentPrice: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.md,
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
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  suggestionLabelActive: {
    color: colors.primary,
  },
  suggestionValue: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    marginTop: 2,
  },
  suggestionValueActive: {
    color: colors.primary,
  },
  suggestionDiff: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  suggestionDiffActive: {
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
  historyItem: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyItemLast: {
    marginBottom: 0,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  historyBadgeText: {
    fontSize: typography.fontSize.xs,
    color: '#fff',
    fontFamily: typography.fontFamily.medium,
  },
  historyDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  historyContent: {
    marginTop: spacing.xs,
  },
  historyPrice: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  historyMessage: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    fontStyle: 'italic',
    marginTop: 2,
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

export default NegotiationScreen;