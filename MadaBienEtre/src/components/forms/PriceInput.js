// src/components/forms/PriceInput.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const PriceInput = ({
  value,
  onChangeText,
  label,
  placeholder = 'Entrez un prix',
  minPrice = 0,
  maxPrice = 1000000,
  currency = 'Ar',
  suggestions = [],
  onSuggestionPress,
  error,
  disabled = false,
}) => {
  const { colors: themeColors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const formatPrice = (price) => {
    if (!price) return '';
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const parsePrice = (text) => {
    return parseInt(text.replace(/\s/g, '')) || 0;
  };

  const handleChangeText = (text) => {
    const numericValue = parsePrice(text);
    onChangeText(numericValue);
  };

  const handleSuggestionPress = (suggestion) => {
    onChangeText(suggestion);
    if (onSuggestionPress) onSuggestionPress(suggestion);
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: themeColors.text }]}>
          {label}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: error ? colors.error : isFocused ? themeColors.primary : themeColors.border,
            backgroundColor: disabled ? themeColors.border : themeColors.input,
          },
        ]}
      >
        <Text style={[styles.currency, { color: themeColors.textSecondary }]}>
          {currency}
        </Text>
        <TextInput
          style={[styles.input, { color: themeColors.text }]}
          value={value ? formatPrice(value) : ''}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textSecondary}
          keyboardType="numeric"
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>
      
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      )}
      
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionsLabel, { color: themeColors.textSecondary }]}>
            Suggestions
          </Text>
          <View style={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionChip,
                  { backgroundColor: themeColors.surface },
                ]}
                onPress={() => handleSuggestionPress(suggestion)}
              >
                <Text style={[styles.suggestionText, { color: themeColors.text }]}>
                  {formatPrice(suggestion)} {currency}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      
      {minPrice > 0 && (
        <Text style={[styles.minPriceText, { color: themeColors.textSecondary }]}>
          Prix minimum conseillé: {formatPrice(minPrice)} {currency}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  currency: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
  },
  suggestionsContainer: {
    marginTop: spacing.sm,
  },
  suggestionsLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: 4,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  suggestionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  suggestionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  minPriceText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
  },
});

export default PriceInput;