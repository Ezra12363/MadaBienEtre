// src/screens/therapist/WithdrawScreen.js
import React, { useState, useRef, useEffect } from 'react';
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

const WithdrawScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(null);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(330000);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const methods = [
    { id: 'bank_transfer', label: 'Virement bancaire', icon: 'business-outline' },
    { id: 'mobile_money', label: 'Mobile Money', icon: 'phone-portrait-outline' },
    { id: 'cash', label: 'Espèces', icon: 'cash-outline' },
  ];

  useEffect(() => {
    loadBalance();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadBalance = async () => {
    try {
      const response = await axios.get(`${API_URL}/therapists/earnings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailableBalance(response.data.available || 0);
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir un montant valide');
      return;
    }

    if (parseFloat(amount) > availableBalance) {
      Alert.alert('Erreur', 'Solde insuffisant');
      return;
    }

    if (!method) {
      Alert.alert('Erreur', 'Veuillez sélectionner une méthode de retrait');
      return;
    }

    if (method === 'bank_transfer' && (!bankName || !accountNumber || !accountHolder)) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs bancaires');
      return;
    }

    if (method === 'mobile_money' && !phoneNumber) {
      Alert.alert('Erreur', 'Veuillez saisir votre numéro de téléphone');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/withdrawals/create`,
        {
          amount: parseFloat(amount),
          method: method,
          bank_name: bankName,
          account_number: accountNumber,
          account_holder: accountHolder,
          phone_number: phoneNumber,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert(
        '✅ Demande de retrait envoyée',
        'Votre demande sera traitée dans les 24 à 48 heures',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible d\'effectuer le retrait');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header title="Retrait d'argent" showBack />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Solde disponible */}
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={[styles.balanceCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.balanceLabel, { color: themeColors.textSecondary }]}>
              Solde disponible
            </Text>
            <Text style={styles.balanceAmount}>
              {availableBalance.toLocaleString()} Ar
            </Text>
            <Text style={[styles.balanceSubtext, { color: themeColors.textSecondary }]}>
              Montant maximum retirable
            </Text>
          </View>
        </Animatable.View>

        {/* Montant */}
        <Animatable.View animation="fadeInUp" delay={200} duration={600}>
          <View style={[styles.formCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.formTitle, { color: themeColors.text }]}>
              Montant à retirer
            </Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.amountCurrency}>Ar</Text>
              <TextInput
                style={[styles.amountInput, { color: themeColors.text }]}
                placeholder="0"
                placeholderTextColor={themeColors.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={styles.maxButton}
              onPress={() => setAmount(availableBalance.toString())}
            >
              <Text style={styles.maxButtonText}>Montant maximum</Text>
            </TouchableOpacity>
          </View>
        </Animatable.View>

        {/* Méthodes de retrait */}
        <Animatable.View animation="fadeInUp" delay={400} duration={600}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Méthode de retrait
          </Text>
          {methods.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.methodCard,
                method === m.id && styles.methodCardActive,
                { backgroundColor: themeColors.surface }
              ]}
              onPress={() => setMethod(m.id)}
            >
              <View style={styles.methodLeft}>
                <View style={[styles.methodIcon, { backgroundColor: method === m.id ? colors.primary + '20' : 'transparent' }]}>
                  <Ionicons name={m.icon} size={24} color={method === m.id ? colors.primary : themeColors.textSecondary} />
                </View>
                <Text style={[styles.methodLabel, { color: method === m.id ? colors.primary : themeColors.text }]}>
                  {m.label}
                </Text>
              </View>
              <View style={[styles.methodRadio, method === m.id && styles.methodRadioActive]}>
                {method === m.id && <View style={styles.methodRadioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </Animatable.View>

        {/* Détails selon la méthode */}
        {method === 'bank_transfer' && (
          <Animatable.View animation="fadeInUp" delay={600} duration={600}>
            <View style={[styles.detailsCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.detailsTitle, { color: themeColors.text }]}>
                Coordonnées bancaires
              </Text>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                  Nom de la banque
                </Text>
                <TextInput
                  style={[styles.input, { color: themeColors.text, borderColor: '#E0E0E0' }]}
                  placeholder="Ex: BNI Madagascar"
                  placeholderTextColor={themeColors.textSecondary}
                  value={bankName}
                  onChangeText={setBankName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                  Numéro de compte
                </Text>
                <TextInput
                  style={[styles.input, { color: themeColors.text, borderColor: '#E0E0E0' }]}
                  placeholder="Ex: 1234567890"
                  placeholderTextColor={themeColors.textSecondary}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                  Titulaire du compte
                </Text>
                <TextInput
                  style={[styles.input, { color: themeColors.text, borderColor: '#E0E0E0' }]}
                  placeholder="Nom complet"
                  placeholderTextColor={themeColors.textSecondary}
                  value={accountHolder}
                  onChangeText={setAccountHolder}
                />
              </View>
            </View>
          </Animatable.View>
        )}

        {method === 'mobile_money' && (
          <Animatable.View animation="fadeInUp" delay={600} duration={600}>
            <View style={[styles.detailsCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.detailsTitle, { color: themeColors.text }]}>
                Numéro Mobile Money
              </Text>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.text }]}>
                  Numéro de téléphone
                </Text>
                <TextInput
                  style={[styles.input, { color: themeColors.text, borderColor: '#E0E0E0' }]}
                  placeholder="Ex: 034 00 000 00"
                  placeholderTextColor={themeColors.textSecondary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </Animatable.View>
        )}

        {/* Bouton */}
        <Animatable.View animation="fadeInUp" delay={800} duration={600}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleWithdraw}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              style={styles.submitGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Demander le retrait</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>

        {/* Frais */}
        <Animatable.View animation="fadeInUp" delay={1000} duration={600}>
          <View style={styles.feesCard}>
            <Ionicons name="information-circle-outline" size={20} color={themeColors.textSecondary} />
            <Text style={[styles.feesText, { color: themeColors.textSecondary }]}>
              Frais de retrait: 0 Ar • Délai: 24-48h
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
  balanceCard: {
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  balanceAmount: {
    fontSize: typography.fontSize.xxxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  balanceSubtext: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  amountCurrency: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
  },
  maxButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  maxButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.sm,
  },
  methodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  methodCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  methodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodRadioActive: {
    borderColor: colors.primary,
  },
  methodRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  detailsCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailsTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  feesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  feesText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
});

export default WithdrawScreen;