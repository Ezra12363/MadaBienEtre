// src/screens/client/PaymentScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
import Button from '../../components/common/Button';
import axios from 'axios';
import { API_URL } from '../../config';

const PaymentScreen = ({ navigation, route }) => {
  const { bookingId, amount } = route.params || {};
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [booking, setBooking] = useState(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const paymentMethods = [
    { id: 'mobile_money', name: 'Mobile Money', icon: 'phone-portrait-outline' },
    { id: 'card', name: 'Carte Bancaire', icon: 'card-outline' },
    { id: 'vanila_pay', name: 'Vanila Pay', icon: 'shield-outline' },
  ];

  const mobileProviders = [
    { id: 'mvola', name: 'MVola', icon: '📱' },
    { id: 'orange_money', name: 'Orange Money', icon: '🟠' },
    { id: 'airtel_money', name: 'Airtel Money', icon: '🔴' },
  ];

  useEffect(() => {
    loadBooking();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadBooking = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBooking(response.data);
    } catch (error) {
      console.error('Error loading booking:', error);
      setBooking({
        id: bookingId,
        finalPrice: amount || 75000,
      });
    }
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      Alert.alert('Erreur', 'Veuillez sélectionner un mode de paiement');
      return;
    }

    if (selectedMethod === 'mobile_money') {
      if (!mobileMoneyProvider) {
        Alert.alert('Erreur', 'Veuillez sélectionner un opérateur');
        return;
      }
      if (!phoneNumber || phoneNumber.length < 10) {
        Alert.alert('Erreur', 'Veuillez saisir un numéro de téléphone valide');
        return;
      }
    }

    if (selectedMethod === 'card') {
      if (!cardNumber || cardNumber.length < 16) {
        Alert.alert('Erreur', 'Veuillez saisir un numéro de carte valide');
        return;
      }
      if (!expiryDate) {
        Alert.alert('Erreur', 'Veuillez saisir la date d\'expiration');
        return;
      }
      if (!cvv || cvv.length < 3) {
        Alert.alert('Erreur', 'Veuillez saisir le CVV');
        return;
      }
    }

    setIsLoading(true);
    try {
      let endpoint = '';
      let payload = {};

      if (selectedMethod === 'mobile_money') {
        endpoint = `${API_URL}/payments/mobile-money`;
        payload = {
          booking_id: bookingId,
          amount: booking?.finalPrice || amount,
          phone: phoneNumber,
          provider: mobileMoneyProvider,
        };
      } else if (selectedMethod === 'card') {
        endpoint = `${API_URL}/payments/card`;
        payload = {
          booking_id: bookingId,
          amount: booking?.finalPrice || amount,
          card_number: cardNumber,
          expiry_date: expiryDate,
          cvv: cvv,
        };
      } else if (selectedMethod === 'vanila_pay') {
        endpoint = `${API_URL}/payments/vanila-pay`;
        payload = {
          booking_id: bookingId,
          amount: booking?.finalPrice || amount,
        };
      }

      const response = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.status === 'completed') {
        Alert.alert(
          '✅ Paiement réussi',
          'Votre paiement a été effectué avec succès',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('BookingDetail', { bookingId }),
            },
          ]
        );
      } else {
        Alert.alert(
          '⏳ Paiement en attente',
          'Votre paiement est en cours de validation',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('BookingDetail', { bookingId }),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Erreur lors du paiement');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\s/g, '');
    const formatted = cleaned.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  const formatExpiryDate = (text) => {
    const cleaned = text.replace(/\//g, '');
    if (cleaned.length >= 2) {
      setExpiryDate(cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4));
    } else {
      setExpiryDate(cleaned);
    }
  };

  const totalAmount = booking?.finalPrice || amount || 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header title="Paiement" showBack />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Montant */}
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={[styles.amountCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.amountLabel, { color: themeColors.textSecondary }]}>
              Montant à payer
            </Text>
            <Text style={styles.amountValue}>
              {totalAmount.toLocaleString()} Ar
            </Text>
            <Text style={[styles.amountSubtext, { color: themeColors.textSecondary }]}>
              Réservation #{bookingId}
            </Text>
          </View>
        </Animatable.View>

        {/* Méthodes de paiement */}
        <Animatable.View animation="fadeInUp" delay={200} duration={600}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Mode de paiement
          </Text>
          <View style={styles.methodsGrid}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodCard,
                  selectedMethod === method.id && styles.methodCardActive,
                  { backgroundColor: themeColors.surface }
                ]}
                onPress={() => setSelectedMethod(method.id)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.methodIcon,
                  selectedMethod === method.id && styles.methodIconActive,
                  { backgroundColor: selectedMethod === method.id ? colors.primary + '20' : 'transparent' }
                ]}>
                  <Ionicons 
                    name={method.icon} 
                    size={28} 
                    color={selectedMethod === method.id ? colors.primary : themeColors.textSecondary} 
                  />
                </View>
                <Text style={[
                  styles.methodName,
                  selectedMethod === method.id && styles.methodNameActive,
                  { color: selectedMethod === method.id ? colors.primary : themeColors.text }
                ]}>
                  {method.name}
                </Text>
                {selectedMethod === method.id && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animatable.View>

        {/* Formulaire Mobile Money */}
        {selectedMethod === 'mobile_money' && (
          <Animatable.View animation="fadeInUp" delay={400} duration={600}>
            <View style={[styles.formCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.formTitle, { color: themeColors.text }]}>
                Sélectionnez votre opérateur
              </Text>
              <View style={styles.providersContainer}>
                {mobileProviders.map((provider) => (
                  <TouchableOpacity
                    key={provider.id}
                    style={[
                      styles.providerButton,
                      mobileMoneyProvider === provider.id && styles.providerButtonActive,
                      { backgroundColor: themeColors.surface }
                    ]}
                    onPress={() => setMobileMoneyProvider(provider.id)}
                  >
                    <Text style={styles.providerIcon}>{provider.icon}</Text>
                    <Text style={[
                      styles.providerName,
                      mobileMoneyProvider === provider.id && styles.providerNameActive,
                      { color: themeColors.text }
                    ]}>
                      {provider.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                  Numéro de téléphone
                </Text>
                <View style={[styles.inputContainer, { borderColor: '#E0E0E0' }]}>
                  <Text style={styles.countryCode}>+261</Text>
                  <TextInput
                    style={[styles.input, { color: themeColors.text }]}
                    placeholder="34 00 000 00"
                    placeholderTextColor={themeColors.textSecondary}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>
          </Animatable.View>
        )}

        {/* Formulaire Carte Bancaire */}
        {selectedMethod === 'card' && (
          <Animatable.View animation="fadeInUp" delay={400} duration={600}>
            <View style={[styles.formCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.formTitle, { color: themeColors.text }]}>
                Informations de la carte
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                  Numéro de carte
                </Text>
                <View style={[styles.inputContainer, { borderColor: '#E0E0E0' }]}>
                  <Ionicons name="card-outline" size={20} color={themeColors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: themeColors.text }]}
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor={themeColors.textSecondary}
                    value={cardNumber}
                    onChangeText={formatCardNumber}
                    keyboardType="number-pad"
                    maxLength={19}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.rowInput, styles.halfInput]}>
                  <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                    Date d'expiration
                  </Text>
                  <View style={[styles.inputContainer, { borderColor: '#E0E0E0' }]}>
                    <TextInput
                      style={[styles.input, { color: themeColors.text }]}
                      placeholder="MM/AA"
                      placeholderTextColor={themeColors.textSecondary}
                      value={expiryDate}
                      onChangeText={formatExpiryDate}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                </View>

                <View style={[styles.rowInput, styles.halfInput]}>
                  <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                    CVV
                  </Text>
                  <View style={[styles.inputContainer, { borderColor: '#E0E0E0' }]}>
                    <TextInput
                      style={[styles.input, { color: themeColors.text }]}
                      placeholder="***"
                      placeholderTextColor={themeColors.textSecondary}
                      value={cvv}
                      onChangeText={setCvv}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                    />
                  </View>
                </View>
              </View>
            </View>
          </Animatable.View>
        )}

        {/* Bouton de paiement */}
        <Animatable.View animation="fadeInUp" delay={600} duration={600}>
          <TouchableOpacity
            style={styles.payButton}
            onPress={handlePayment}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              style={styles.payGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.payContent}>
                  <Text style={styles.payText}>
                    Payer {totalAmount.toLocaleString()} Ar
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>

        {/* Sécurité */}
        <Animatable.View animation="fadeInUp" delay={800} duration={600}>
          <View style={styles.securityContainer}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <Text style={[styles.securityText, { color: themeColors.textSecondary }]}>
              Paiement sécurisé • Chiffré SSL
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
  amountCard: {
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  amountValue: {
    fontSize: typography.fontSize.xxxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  amountSubtext: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  methodsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  methodCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  methodCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  methodIconActive: {
    backgroundColor: colors.primary + '20',
  },
  methodName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  methodNameActive: {
    color: colors.primary,
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  formCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  providersContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  providerButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  providerButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  providerIcon: {
    fontSize: 24,
  },
  providerName: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    marginTop: 2,
  },
  providerNameActive: {
    color: colors.primary,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  countryCode: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowInput: {
    flex: 1,
  },
  halfInput: {
    flex: 0.5,
  },
  payButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  payGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  payContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  payText: {
    color: '#fff',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  securityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  securityText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
});

export default PaymentScreen;