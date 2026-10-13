// src/components/ai/AISearchPanel.js
//
// Panneau IA de l'écran « Recherche massage ».
// Pur affichage : toute la logique réseau est dans useAISearch().
import { View, Text, Switch, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import { formatAr, formatPercent } from './aiHelpers';

const AISearchPanel = ({
  ai,
  aiSortActive,
  onToggleSort,
  massageTypeName,
  duration,
  onPickPopular,
  style,
}) => {
  const { colors: tc } = useTheme();
  if (!ai) return null;

  const {
    estimate,
    estimateLoading,
    estimateError,
    rankingLoading,
    rankingError,
    rankingCount,
    popular,
    popularLoading,
    refresh,
  } = ai;

  const hasEstimate = estimate && Number.isFinite(estimate.price) && estimate.price > 0;

  return (
    <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }, style]}>
      {/* En-tête + interrupteur */}
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: tc.text }]}>Assistant IA</Text>
          <Text style={[styles.subtitle, { color: tc.textSecondary }]}>
            Classe les thérapeutes selon vos critères
          </Text>
        </View>
        <Switch
          value={!!aiSortActive}
          onValueChange={onToggleSort}
          trackColor={{ false: tc.border, true: colors.primary + '88' }}
          thumbColor={aiSortActive ? colors.primary : '#f4f3f4'}
        />
      </View>

      {/* Statut du classement */}
      {aiSortActive && (
        <View style={styles.statusRow}>
          {rankingLoading ? (
            <>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.statusText, { color: tc.textSecondary }]}>
                L'IA classe les thérapeutes…
              </Text>
            </>
          ) : rankingError ? (
            <>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={[styles.statusText, { color: tc.text }]} numberOfLines={2}>
                {rankingError}
              </Text>
              <TouchableOpacity onPress={refresh}>
                <Text style={styles.retry}>Réessayer</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[styles.statusText, { color: tc.textSecondary }]}>
                {rankingCount > 0
                  ? `${rankingCount} thérapeute${rankingCount > 1 ? 's' : ''} classé${rankingCount > 1 ? 's' : ''} par compatibilité`
                  : 'Aucun thérapeute à classer pour le moment'}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Estimation du prix */}
      {massageTypeName ? (
        <View style={[styles.estimate, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Text style={[styles.estimateLabel, { color: tc.textSecondary }]}>
            Prix estimé · {massageTypeName} · {duration} min
          </Text>
          {estimateLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.alignStart} />
          ) : hasEstimate ? (
            <>
              <Text style={styles.estimatePrice}>{formatAr(estimate.price)}</Text>
              {Number.isFinite(estimate.min) && Number.isFinite(estimate.max) ? (
                <Text style={[styles.estimateRange, { color: tc.textSecondary }]}>
                  Fourchette : {formatAr(estimate.min)} – {formatAr(estimate.max)}
                  {Number.isFinite(estimate.confidence)
                    ? ` · fiabilité ${formatPercent(estimate.confidence)}`
                    : ''}
                </Text>
              ) : null}
            </>
          ) : estimateError ? (
            <Text style={[styles.estimateRange, { color: colors.error }]}>{estimateError}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.hint, { color: tc.textSecondary }]}>
          Choisissez un type de massage pour voir son prix estimé.
        </Text>
      )}

      {/* Massages les plus demandés */}
      {(popularLoading || popular.length > 0) && (
        <View style={styles.popular}>
          <Text style={[styles.popularTitle, { color: tc.textSecondary }]}>
            Les plus demandés ce mois-ci
          </Text>
          {popularLoading && popular.length === 0 ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.alignStart} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {popular.map((row, index) => (
                <TouchableOpacity
                  key={`${row.massage_type_id}-${index}`}
                  activeOpacity={0.8}
                  onPress={() => onPickPopular?.(row)}
                  style={[styles.chip, { borderColor: tc.border, backgroundColor: tc.background }]}
                >
                  <Ionicons name="flame-outline" size={13} color={colors.secondary} />
                  <Text style={[styles.chipText, { color: tc.text }]} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={[styles.chipCount, { color: tc.textSecondary }]}>
                    {row.bookings_count}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignStart: { alignSelf: 'flex-start', marginTop: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
  subtitle: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  statusText: { flex: 1, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  retry: { color: colors.primary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  estimate: { borderWidth: 1, borderRadius: 12, padding: spacing.sm, marginTop: spacing.md },
  estimateLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  estimatePrice: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colors.primary },
  estimateRange: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 2 },
  hint: { fontSize: typography.fontSize.sm, marginTop: spacing.sm },
  popular: { marginTop: spacing.md },
  popularTitle: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, marginBottom: 6 },
  chips: { gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 200,
  },
  chipText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, flexShrink: 1 },
  chipCount: { fontSize: 11, fontFamily: typography.fontFamily.regular },
});

export default AISearchPanel;
