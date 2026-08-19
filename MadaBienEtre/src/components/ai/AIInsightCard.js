// src/components/ai/AIInsightCard.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const AIInsightCard = ({ insight, type = 'info' }) => {
  const { colors: themeColors } = useTheme();

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle-outline';
      case 'warning':
        return 'warning-outline';
      case 'error':
        return 'alert-circle-outline';
      default:
        return 'bulb-outline';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  const iconName = getIcon();
  const color = getColor();

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={iconName} size={24} color={color} />
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          {insight.title}
        </Text>
        <Text style={[styles.description, { color: themeColors.textSecondary }]}>
          {insight.description}
        </Text>
        
        {insight.details && (
          <View style={styles.details}>
            {insight.details.map((detail, index) => (
              <View key={index} style={styles.detailRow}>
                <Ionicons name="chevron-forward" size={14} color={color} />
                <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                  {detail}
                </Text>
              </View>
            ))}
          </View>
        )}
        
        {insight.value && (
          <View style={styles.valueContainer}>
            <Text style={[styles.valueLabel, { color: themeColors.textSecondary }]}>
              {insight.valueLabel || 'Valeur'}
            </Text>
            <Text style={[styles.value, { color: color }]}>
              {insight.value}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  description: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
    lineHeight: 20,
  },
  details: {
    marginTop: spacing.sm,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  valueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  valueLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  value: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
});

export default AIInsightCard;