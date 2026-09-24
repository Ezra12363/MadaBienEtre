// src/screens/client/PaymentScreen.js
//
// ============================================================
// FIX ANDROID + WEB
// ============================================================
//
// 1. BUG PRIX : le backend renvoie "final_price" (snake_case),
//    pas "finalPrice". L'ancien code lisait booking.finalPrice
//    qui est TOUJOURS undefined => le montant affiché et envoyé
//    au paiement était faux. Corrigé avec une chaîne de repli
//    (final_price -> therapist_initial_price ->
//    client_price_proposed -> price -> amount du paramètre).
//
// 2. Alert.alert AVEC PLUSIEURS BOUTONS NE FONCTIONNE PAS SUR
//    WEB (react-native-web ne supporte pas les callbacks
//    onPress par bouton). Le "onPress" de navigation après un
//    paiement réussi ne se déclenchait donc jamais sur Web.
//    => Remplacé par une modale interne (FeedbackModal) qui
//    fonctionne à l'identique sur Android ET sur Web.
//
// 3. Clavier : comportement KeyboardAvoidingView adapté par
//    plateforme (iOS: padding, Android/Web: rien de spécial,
//    on laisse le ScrollView gérer).
//
// 4. Champs numériques (téléphone, carte, CVV, expiration)
//    filtrés manuellement, car "keyboardType" ne bloque PAS la
//    saisie de lettres sur le Web.
//
// 5. Écran de chargement tant que la réservation n'est pas
//    chargée, pour éviter d'afficher un montant à 0 Ar le temps
//    du fetch (fréquent sur Web où le premier rendu est rapide).
//
// 6. Bouton "Payer" désactivé (grisé) tant que le formulaire
//    n'est pas valide, sur les deux plateformes.
// ============================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
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

// ============================================================
// HELPERS
// ============================================================

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

const formatAr = (value) => `${Math.round(toNumber(value)).toLocaleString('fr-FR')} Ar`;

const onlyDigits = (text) => String(text || '').replace(/[^0-9]/g, '');

const extractErrorMessage = (error, fallback = 'Une erreur est survenue.') => {
  // Erreur réseau (pas de réponse du serveur) — fréquent sur Web (CORS, offline...).
  if (!error?.response) {
    if (error?.message === 'Network Error') {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion internet.';
    }
    return error?.message || fallback;
  }

  const data = error.response.data;

  if (typeof data?.detail === 'string') return data.detail;

  if (Array.isArray(data?.detail)) {
    return data.detail.map((d) => d?.msg || d?.message || String(d)).join(', ');
  }

  if (typeof data?.message === 'string') return data.message;

  return fallback;
};

// Anthracite -> vert clair de secours si "colors.primaryLight" n'existe pas
// dans le thème (évite un crash / dégradé cassé du LinearGradient).
const GRADIENT_END_COLOR = colors.primaryLight || colors.primary;

// ============================================================
// FEEDBACK MODAL
//
// Remplace Alert.alert() pour les résultats de paiement et les
// erreurs de validation : fonctionne de façon identique sur
// Android ET sur Web (contrairement à Alert.alert, dont les
// callbacks de bouton ne se déclenchent pas de manière fiable
// sur react-native-web).
// ============================================================

const FeedbackModal = ({ visible, type, title, message, onClose }) => {
  const config = {
    success: { icon: 'checkmark-circle', color: colors.primary },
    pending: { icon: 'time-outline', color: '#F5B642' },
    error: { icon: 'alert-circle', color: '#D93636' },
  }[type] || { icon: 'information-circle', color: colors.primary };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={feedbackStyles.overlay}>
        <View style={feedbackStyles.card}>
          <View style={[feedbackStyles.iconCircle, { backgroundColor: `${config.color}1A` }]}>
            <Ionicons name={config.icon} size={30} color={config.color} />
          </View>

          <Text style={feedbackStyles.title}>{title}</Text>
          {message ? <Text style={feedbackStyles.message}>{message}</Text> : null}

          <TouchableOpacity
            style={[feedbackStyles.button, { backgroundColor: config.color }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={feedbackStyles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const feedbackStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#1C1C1C', textAlign: 'center' },
  message: {
    fontSize: 13,
    color: '#7A7A7A',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  button: {
    marginTop: 20,
    minWidth: 140,
    minHeight: 46,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});

// ============================================================
// SCREEN
// ============================================================

const PaymentScreen = ({ navigation, route }) => {
  const { bookingId, amount } = route.params || {};
  const { colors: themeColors } = useTheme();
  const { token } = useAuth();

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type, title, message, onClose }

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

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

  // ==========================================================
  // FEEDBACK HELPER
  // ==========================================================

  const showFeedback = useCallback((type, title, message, onCloseExtra) => {
    setFeedback({
      type,
      title,
      message,
      onClose: () => {
        setFeedback(null);
        if (typeof onCloseExtra === 'function') onCloseExtra();
      },
    });
  }, []);

  // ==========================================================
  // LOAD BOOKING
  // ==========================================================

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setIsBookingLoading(false);
      return;
    }

    try {
      setIsBookingLoading(true);

      const response = await axios.get(`${API_URL}/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (mountedRef.current) {
        setBooking(response.data);
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      // Repli : on garde au moins le montant transmis en paramètre de
      // navigation pour ne pas bloquer l'écran de paiement.
      if (mountedRef.current) {
        setBooking({ id: bookingId, final_price: amount || 0 });
      }
    } finally {
      if (mountedRef.current) setIsBookingLoading(false);
    }
  }, [bookingId, amount, token]);

  useEffect(() => {
    loadBooking();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================
  // MONTANT — chaîne de repli sur les vrais champs backend
  // (le backend renvoie "final_price", pas "finalPrice")
  // ==========================================================

  const totalAmount = useMemo(() => {
    const value =
      booking?.final_price ??
      booking?.finalPrice ??
      booking?.therapist_initial_price ??
      booking?.client_price_proposed ??
      booking?.price ??
      amount ??
      0;

    return toNumber(value, 0);
  }, [booking, amount]);

  // ==========================================================
  // SANITIZED INPUTS (fonctionne aussi sur Web, où keyboardType
  // ne filtre pas réellement les caractères saisis)
  // ==========================================================

  const handlePhoneChange = (text) => {
    setPhoneNumber(onlyDigits(text).slice(0, 10));
  };

  const handleCardNumberChange = (text) => {
    const digits = onlyDigits(text).slice(0, 16);
    const formatted = digits.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  const handleExpiryChange = (text) => {
    const digits = onlyDigits(text).slice(0, 4);
    if (digits.length >= 3) {
      setExpiryDate(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setExpiryDate(digits);
    }
  };

  const handleCvvChange = (text) => {
    setCvv(onlyDigits(text).slice(0, 4));
  };

  // ==========================================================
  // VALIDATION
  // ==========================================================

  const isFormValid = useMemo(() => {
    if (!selectedMethod || totalAmount <= 0) return false;

    if (selectedMethod === 'mobile_money') {
      return !!mobileMoneyProvider && phoneNumber.length >= 9;
    }

    if (selectedMethod === 'card') {
      return (
        cardNumber.replace(/\s/g, '').length >= 16 &&
        /^\d{2}\/\d{2}$/.test(expiryDate) &&
        cvv.length >= 3
      );
    }

    // vanila_pay n'a pas de champ supplémentaire.
    return true;
  }, [selectedMethod, mobileMoneyProvider, phoneNumber, cardNumber, expiryDate, cvv, totalAmount]);

  // ==========================================================
  // PAYMENT
  // ==========================================================

  const handlePayment = async () => {
    if (isLoading) return;

    if (!selectedMethod) {
      showFeedback('error', 'Mode de paiement requis', 'Veuillez sélectionner un mode de paiement.');
      return;
    }

    if (totalAmount <= 0) {
      showFeedback('error', 'Montant invalide', 'Le montant à payer est introuvable ou invalide.');
      return;
    }

    if (selectedMethod === 'mobile_money') {
      if (!mobileMoneyProvider) {
        showFeedback('error', 'Opérateur requis', 'Veuillez sélectionner un opérateur Mobile Money.');
        return;
      }
      if (phoneNumber.length < 9) {
        showFeedback('error', 'Numéro invalide', 'Veuillez saisir un numéro de téléphone valide.');
        return;
      }
    }

    if (selectedMethod === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 16) {
        showFeedback('error', 'Carte invalide', 'Veuillez saisir un numéro de carte à 16 chiffres.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
        showFeedback('error', 'Date invalide', "Veuillez saisir une date d'expiration valide (MM/AA).");
        return;
      }
      if (cvv.length < 3) {
        showFeedback('error', 'CVV invalide', 'Veuillez saisir un CVV valide.');
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
          amount: totalAmount,
          phone: phoneNumber,
          provider: mobileMoneyProvider,
        };
      } else if (selectedMethod === 'card') {
        endpoint = `${API_URL}/payments/card`;
        payload = {
          booking_id: bookingId,
          amount: totalAmount,
          card_number: cardNumber.replace(/\s/g, ''),
          expiry_date: expiryDate,
          cvv,
        };
      } else if (selectedMethod === 'vanila_pay') {
        endpoint = `${API_URL}/payments/vanila-pay`;
        payload = {
          booking_id: bookingId,
          amount: totalAmount,
        };
      }

      const response = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const status = response?.data?.status;

      if (status === 'completed') {
        showFeedback(
          'success',
          'Paiement réussi',
          'Votre paiement a été effectué avec succès.',
          () => navigation.navigate('BookingDetail', { bookingId })
        );
      } else {
        showFeedback(
          'pending',
          'Paiement en attente',
          'Votre paiement est en cours de validation.',
          () => navigation.navigate('BookingDetail', { bookingId })
        );
      }
    } catch (error) {
      console.error('Payment error:', error);
      showFeedback('error', 'Échec du paiement', extractErrorMessage(error, 'Erreur lors du paiement.'));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  // ==========================================================
  // LOADING SCREEN (évite un montant à 0 Ar affiché brièvement)
  // ==========================================================

  if (isBookingLoading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Paiement" showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Chargement du paiement...
          </Text>
        </View>
      </View>
    );
  }

  // ==========================================================
  // MAIN
  // ==========================================================

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Header title="Paiement" showBack />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Montant */}
          <Animatable.View animation="fadeInDown" duration={500} useNativeDriver={Platform.OS !== 'web'}>
            <View style={[styles.amountCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.amountLabel, { color: themeColors.textSecondary }]}>
                Montant à payer
              </Text>
              <Text style={styles.amountValue}>{formatAr(totalAmount)}</Text>
              <Text style={[styles.amountSubtext, { color: themeColors.textSecondary }]}>
                Réservation #{bookingId}
              </Text>
            </View>
          </Animatable.View>

          {/* Méthodes de paiement */}
          <Animatable.View
            animation="fadeInUp"
            delay={150}
            duration={500}
            useNativeDriver={Platform.OS !== 'web'}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Mode de paiement</Text>
            <View style={styles.methodsGrid}>
              {paymentMethods.map((method) => {
                const active = selectedMethod === method.id;
                return (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.methodCard,
                      active && styles.methodCardActive,
                      { backgroundColor: themeColors.surface },
                    ]}
                    onPress={() => setSelectedMethod(method.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.methodIcon,
                        { backgroundColor: active ? `${colors.primary}20` : 'transparent' },
                      ]}
                    >
                      <Ionicons
                        name={method.icon}
                        size={26}
                        color={active ? colors.primary : themeColors.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.methodName,
                        { color: active ? colors.primary : themeColors.text },
                      ]}
                      numberOfLines={2}
                    >
                      {method.name}
                    </Text>
                    {active ? (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animatable.View>

          {/* Formulaire Mobile Money */}
          {selectedMethod === 'mobile_money' ? (
            <Animatable.View
              animation="fadeInUp"
              delay={200}
              duration={500}
              useNativeDriver={Platform.OS !== 'web'}
            >
              <View style={[styles.formCard, { backgroundColor: themeColors.surface }]}>
                <Text style={[styles.formTitle, { color: themeColors.text }]}>
                  Sélectionnez votre opérateur
                </Text>

                <View style={styles.providersContainer}>
                  {mobileProviders.map((provider) => {
                    const active = mobileMoneyProvider === provider.id;
                    return (
                      <TouchableOpacity
                        key={provider.id}
                        style={[
                          styles.providerButton,
                          active && styles.providerButtonActive,
                          { backgroundColor: themeColors.surface },
                        ]}
                        onPress={() => setMobileMoneyProvider(provider.id)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.providerIcon}>{provider.icon}</Text>
                        <Text
                          style={[
                            styles.providerName,
                            { color: active ? colors.primary : themeColors.text },
                          ]}
                        >
                          {provider.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
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
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                </View>
              </View>
            </Animatable.View>
          ) : null}

          {/* Formulaire Carte Bancaire */}
          {selectedMethod === 'card' ? (
            <Animatable.View
              animation="fadeInUp"
              delay={200}
              duration={500}
              useNativeDriver={Platform.OS !== 'web'}
            >
              <View style={[styles.formCard, { backgroundColor: themeColors.surface }]}>
                <Text style={[styles.formTitle, { color: themeColors.text }]}>
                  Informations de la carte
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.text }]}>Numéro de carte</Text>
                  <View style={[styles.inputContainer, { borderColor: '#E0E0E0' }]}>
                    <Ionicons name="card-outline" size={20} color={themeColors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: themeColors.text }]}
                      placeholder="1234 5678 9012 3456"
                      placeholderTextColor={themeColors.textSecondary}
                      value={cardNumber}
                      onChangeText={handleCardNumberChange}
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
                        onChangeText={handleExpiryChange}
                        keyboardType="number-pad"
                        maxLength={5}
                      />
                    </View>
                  </View>

                  <View style={[styles.rowInput, styles.halfInput]}>
                    <Text style={[styles.inputLabel, { color: themeColors.text }]}>CVV</Text>
                    <View style={[styles.inputContainer, { borderColor: '#E0E0E0' }]}>
                      <TextInput
                        style={[styles.input, { color: themeColors.text }]}
                        placeholder="***"
                        placeholderTextColor={themeColors.textSecondary}
                        value={cvv}
                        onChangeText={handleCvvChange}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                      />
                    </View>
                  </View>
                </View>
              </View>
            </Animatable.View>
          ) : null}

          {/* Bouton de paiement */}
          <Animatable.View
            animation="fadeInUp"
            delay={250}
            duration={500}
            useNativeDriver={Platform.OS !== 'web'}
          >
            <TouchableOpacity
              style={[styles.payButton, !isFormValid && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={isLoading || !isFormValid}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primary, GRADIENT_END_COLOR]}
                style={styles.payGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.payContent}>
                    <Text style={styles.payText}>Payer {formatAr(totalAmount)}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>

          {/* Sécurité */}
          <View style={styles.securityContainer}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <Text style={[styles.securityText, { color: themeColors.textSecondary }]}>
              Paiement sécurisé • Chiffré SSL
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <FeedbackModal
        visible={!!feedback}
        type={feedback?.type}
        title={feedback?.title}
        message={feedback?.message}
        onClose={() => {
          if (feedback?.onClose) feedback.onClose();
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: typography.fontSize?.sm || 12,
    fontFamily: typography.fontFamily?.regular,
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
    marginTop: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  amountLabel: {
    fontSize: typography.fontSize?.sm || 12,
    fontFamily: typography.fontFamily?.regular,
  },
  amountValue: {
    fontSize: typography.fontSize?.xxxl || 28,
    fontFamily: typography.fontFamily?.bold,
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  amountSubtext: {
    fontSize: typography.fontSize?.sm || 12,
    fontFamily: typography.fontFamily?.regular,
  },
  sectionTitle: {
    fontSize: typography.fontSize?.lg || 16,
    fontFamily: typography.fontFamily?.bold,
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
    minHeight: 96,
    justifyContent: 'center',
  },
  methodCardActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  methodIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  methodName: {
    fontSize: typography.fontSize?.sm || 12,
    fontFamily: typography.fontFamily?.medium,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
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
    fontSize: typography.fontSize?.md || 14,
    fontFamily: typography.fontFamily?.semiBold,
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
    backgroundColor: `${colors.primary}10`,
  },
  providerIcon: {
    fontSize: 22,
  },
  providerName: {
    fontSize: typography.fontSize?.xs || 10,
    fontFamily: typography.fontFamily?.medium,
    marginTop: 2,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize?.sm || 12,
    fontFamily: typography.fontFamily?.medium,
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
    fontSize: typography.fontSize?.md || 14,
    fontFamily: typography.fontFamily?.medium,
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize?.md || 14,
    fontFamily: typography.fontFamily?.regular,
    // Evite le contour de focus bleu par défaut du navigateur sur Web.
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
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
  payButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
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
    fontSize: typography.fontSize?.lg || 16,
    fontFamily: typography.fontFamily?.bold,
  },
  securityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  securityText: {
    fontSize: typography.fontSize?.sm || 12,
    fontFamily: typography.fontFamily?.regular,
  },
});

export default PaymentScreen;