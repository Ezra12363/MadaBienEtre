// src/components/payment/PaymentMethodCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const PaymentMethodCard = ({
  method,
  selected,
  onSelect,
  showProvider = true,
}) => {
  const { colors: themeColors } = useTheme();

  const getMethodIcon = (methodId) => {
    const map = {
      mobile_money: 'phone-portrait-outline',
      card: 'card-outline',
      cash: 'cash-outline',
      vanila_pay: 'shield-outline',
    };
    return map[methodId] || 'wallet-outline';
  };

  const getMethodName = (methodId) => {
    const map = {
      mobile_money: 'Mobile Money',
      card: 'Carte Bancaire',
      cash: 'Espèces',
      vanila_pay: 'Vanila Pay',
    };
    return map[methodId] || methodId;
  };

  const getMethodColor = (methodId) => {
    const map = {
      mobile_money: '#FF6F00',
      card: '#2196F3',
      cash: '#4CAF50',
      vanila_pay: '#9C27B0',
    };
    return map[methodId] || colors.primary;
  };

  const getProviderName = (provider) => {
    const map = {
      mvola: 'MVola',
      orange_money: 'Orange Money',
      airtel_money: 'Airtel Money',
      stripe: 'Stripe',
      vanila_pay: 'Vanila Pay',
    };
    return map[provider] || provider;
  };

  const iconName = getMethodIcon(method.id);
  const methodColor = getMethodColor(method.id);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: themeColors.surface },
        selected && styles.selected,
        selected && { borderColor: methodColor },
      ]}
      onPress={() => onSelect && onSelect(method)}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <View style={[styles.iconContainer, { backgroundColor: methodColor + '20' }]}>
          <Ionicons name={iconName} size={24} color={methodColor} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: themeColors.text }]}>
            {getMethodName(method.id)}
          </Text>
          {showProvider && method.provider && (
            <Text style={[styles.provider, { color: themeColors.textSecondary }]}>
              {getProviderName(method.provider)}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selected: {
    borderWidth: 2,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  provider: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});

export default PaymentMethodCard;