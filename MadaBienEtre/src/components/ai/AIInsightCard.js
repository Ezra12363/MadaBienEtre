// src/components/ai/AIInsightCard.js
// Carte d'insight / alerte.
// insight = { title, description, details?: string[], value?, valueLabel? }
// type    = 'info' | 'success' | 'warning' | 'error'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const ICONS = {
  success: 'checkmark-circle-outline',
  warning: 'warning-outline',
  error: 'alert-circle-outline',
  info: 'bulb-outline',
};

const COLORS = {
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  info: colors.primary,
};

const AIInsightCard = ({ insight, type = 'info', onPress, actionLabel }) => {
  const { colors: themeColors } = useTheme();

  if (!insight) return null;

  const color = COLORS[type] || COLORS.info;
  const iconName = ICONS[type] || ICONS.info;
  const hasValue =
    insight.value !== undefined && insight.value !== null && insight.value !== '';
  const details = Array.isArray(insight.details) ? insight.details : [];

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
          borderLeftColor: color,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={iconName} size={22} color={color} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          {insight.title}
        </Text>
        {insight.description ? (
          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            {insight.description}
          </Text>
        ) : null}

        {details.length > 0 && (
          <View style={styles.details}>
            {details.map((detail, index) => (
              <View key={`${detail}-${index}`} style={styles.detailRow}>
                <Ionicons name="chevron-forward" size={13} color={color} />
                <Text
                  style={[styles.detailText, { color: themeColors.textSecondary }]}
                >
                  {detail}
                </Text>
              </View>
            ))}
          </View>
        )}

        {hasValue && (
          <View style={[styles.valueContainer, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.valueLabel, { color: themeColors.textSecondary }]}>
              {insight.valueLabel || 'Valeur'}
            </Text>
            <Text style={[styles.value, { color }]}>{String(insight.value)}</Text>
          </View>
        )}

        {onPress && actionLabel ? (
          <Text style={[styles.action, { color }]}>{actionLabel} →</Text>
        ) : null}
      </View>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: { flex: 1 },
  title: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  description: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
    lineHeight: 19,
  },
  details: { marginTop: spacing.sm, gap: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detailText: {
    flex: 1,
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
  },
  valueLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  value: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  action: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default AIInsightCard;
