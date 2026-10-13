// src/components/ai/AIPrimitives.js
// Briques UI communes (thème vert, clair/sombre, web + Android).

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import massageTypeService from '../../services/massageTypeService';

const font = typography.fontFamily;

// ------------------------------------------------------------
// AICard
// ------------------------------------------------------------
export const AICard = ({ title, subtitle, icon, right, children, style }) => {
  const { colors: tc } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tc.surface, borderColor: tc.border },
        style,
      ]}
    >
      {(title || right) && (
        <View style={styles.cardHeader}>
          {icon ? (
            <View style={styles.cardIcon}>
              <Ionicons name={icon} size={18} color={colors.primary} />
            </View>
          ) : null}
          <View style={styles.flex}>
            {title ? (
              <Text style={[styles.cardTitle, { color: tc.text }]}>{title}</Text>
            ) : null}
            {subtitle ? (
              <Text style={[styles.cardSubtitle, { color: tc.textSecondary }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
};

// ------------------------------------------------------------
// AIButton
// ------------------------------------------------------------
export const AIButton = ({
  label,
  icon,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // primary | outline
  style,
}) => {
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={inactive}
      style={[
        styles.button,
        isPrimary
          ? { backgroundColor: inactive ? '#9DB8A0' : colors.primary }
          : {
              backgroundColor: 'transparent',
              borderWidth: 1.5,
              borderColor: colors.primary,
              opacity: inactive ? 0.5 : 1,
            },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? '#fff' : colors.primary} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={17}
              color={isPrimary ? '#fff' : colors.primary}
            />
          ) : null}
          <Text
            style={[
              styles.buttonText,
              { color: isPrimary ? '#fff' : colors.primary },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// ------------------------------------------------------------
// AIChip
// ------------------------------------------------------------
export const AIChip = ({ label, active, onPress, icon }) => {
  const { colors: tc } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: tc.surface, borderColor: tc.border },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active ? '#fff' : colors.primary}
          style={{ marginRight: 4 }}
        />
      ) : null}
      <Text
        style={[
          styles.chipText,
          { color: active ? '#fff' : tc.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ------------------------------------------------------------
// AIField
// ------------------------------------------------------------
export const AIField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  suffix,
  multiline = false,
  style,
}) => {
  const { colors: tc, isDark } = useTheme();
  return (
    <View style={[styles.fieldWrap, style]}>
      {label ? (
        <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.fieldBox,
          {
            backgroundColor: isDark ? '#2C2C2C' : '#F5F5F5',
            borderColor: tc.border,
          },
        ]}
      >
        <TextInput
          style={[
            styles.fieldInput,
            { color: tc.text },
            multiline && styles.fieldMultiline,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tc.textSecondary}
          keyboardType={keyboardType}
          multiline={multiline}
        />
        {suffix ? (
          <Text style={[styles.fieldSuffix, { color: tc.textSecondary }]}>
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

// ------------------------------------------------------------
// AITabs
// ------------------------------------------------------------
export const AITabs = ({ tabs, active, onChange }) => {
  const { colors: tc } = useTheme();
  return (
    <View style={[styles.tabs, { backgroundColor: tc.surface, borderColor: tc.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.85}
              onPress={() => onChange(tab.id)}
              style={[
                styles.tab,
                isActive && { backgroundColor: colors.primary },
              ]}
            >
              {tab.icon ? (
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? '#fff' : tc.textSecondary}
                />
              ) : null}
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? '#fff' : tc.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ------------------------------------------------------------
// AIError / AIEmpty / AILoading
// ------------------------------------------------------------
export const AIError = ({ message, onRetry }) => {
  const { colors: tc } = useTheme();
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
      <Text style={[styles.errorText, { color: tc.text }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry}>
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export const AIEmpty = ({ text, icon = 'sparkles-outline' }) => {
  const { colors: tc } = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={tc.textSecondary} />
      <Text style={[styles.emptyText, { color: tc.textSecondary }]}>{text}</Text>
    </View>
  );
};

export const AILoading = ({ text }) => {
  const { colors: tc } = useTheme();
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} />
      {text ? (
        <Text style={[styles.emptyText, { color: tc.textSecondary }]}>{text}</Text>
      ) : null}
    </View>
  );
};

// ------------------------------------------------------------
// AIStatRow : ligne libellé / valeur
// ------------------------------------------------------------
export const AIStatRow = ({ label, value, bold, color }) => {
  const { colors: tc } = useTheme();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: tc.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          { color: color || tc.text },
          bold && { fontFamily: font.bold },
        ]}
      >
        {value}
      </Text>
    </View>
  );
};

// ------------------------------------------------------------
// AIMassageTypePicker : types de massage actifs (tous rôles)
// onChange(type) reçoit l'objet complet { id, name, min_price, ... }
// ------------------------------------------------------------
export const AIMassageTypePicker = ({ value, onChange, label = 'Type de massage' }) => {
  const { colors: tc } = useTheme();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await massageTypeService.getActiveMassageTypes();
      setTypes(list);
      if (list.length > 0 && !value) onChange?.(list[0]);
    } catch (e) {
      setError('Impossible de charger les types de massage.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{label}</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start' }} />
      ) : error ? (
        <AIError message={error} onRetry={load} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {types.map((t) => (
            <AIChip
              key={t.id}
              label={t.name}
              active={value?.id === t.id}
              onPress={() => onChange?.(t)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: typography.fontSize.lg, fontFamily: font.bold },
  cardSubtitle: { fontSize: typography.fontSize.sm, fontFamily: font.regular },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  buttonText: { fontSize: typography.fontSize.md, fontFamily: font.semiBold },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: typography.fontSize.sm, fontFamily: font.medium },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  fieldWrap: { marginBottom: spacing.sm },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: font.medium,
    marginBottom: 4,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  fieldInput: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontFamily: font.regular,
    paddingVertical: 10,
    minHeight: 44,
  },
  fieldMultiline: { minHeight: 70, textAlignVertical: 'top' },
  fieldSuffix: { fontSize: typography.fontSize.sm, fontFamily: font.medium },
  tabs: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabsContent: { gap: 4 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabText: { fontSize: typography.fontSize.sm, fontFamily: font.semiBold },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error + '14',
    borderRadius: 10,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  errorText: { flex: 1, fontSize: typography.fontSize.sm, fontFamily: font.regular },
  retryText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontFamily: font.semiBold,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  emptyText: {
    fontSize: typography.fontSize.sm,
    fontFamily: font.regular,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  statLabel: { fontSize: typography.fontSize.sm, fontFamily: font.regular },
  statValue: { fontSize: typography.fontSize.md, fontFamily: font.semiBold },
});
