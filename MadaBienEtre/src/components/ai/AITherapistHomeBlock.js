// src/components/ai/AITherapistHomeBlock.js
// THÉRAPEUTE — bloc à insérer dans le Dashboard : tarification intelligente,
// analyse du marché, probabilité d'acceptation, chatbot + services populaires.
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import AIFeatureButton from './AIFeatureButton';
import AIPopularServices from './AIPopularServices';

const TILES = [
  { tab: 'pricing', icon: 'pricetag-outline', label: 'Tarification', desc: 'Suggestion & calcul', color: '#1F6B45' },
  { tab: 'market', icon: 'stats-chart-outline', label: 'Marché', desc: 'Prix & tendances', color: '#2563EB' },
  { tab: 'acceptance', icon: 'pulse-outline', label: 'Acceptation', desc: 'Chance du prix', color: '#D97706' },
  { tab: 'chat', icon: 'chatbubbles-outline', label: 'Chatbot', desc: "Aide à l'application", color: '#7C3AED' },
];

const AITherapistHomeBlock = ({ onOpenAssistant, showPopular = true, compact = false, style }) => {
  const { colors: tc } = useTheme();
  const { width } = useWindowDimensions();
  // chevron des tuiles : seulement si la place le permet (évite de tronquer sur petit mobile)
  const showChevron = width >= 480;

  return (
    <View style={[styles.wrap, compact && { gap: 0, flex: 1 }, style]}>
      <AIFeatureButton
        onPress={() => onOpenAssistant?.('pricing')}
        title={compact ? 'Tarification intelligente IA' : '✨ Tarification intelligente IA'}
        subtitle="Fixez le bon tarif, analysez le marché et anticipez les négociations"
        compact={compact}
      />

      <View style={[styles.grid, compact && styles.gridCompact]}>
        {TILES.map((t) => (
          <TouchableOpacity
            key={t.tab}
            activeOpacity={0.85}
            onPress={() => onOpenAssistant?.(t.tab)}
            style={[styles.tile, compact && styles.tileCompact, { backgroundColor: tc.surface, borderColor: tc.border }]}
          >
            <View style={[styles.tileIcon, compact && styles.tileIconCompact, { backgroundColor: t.color + '1F' }]}>
              <Ionicons name={t.icon} size={20} color={t.color} />
            </View>
            <View style={styles.tileText}>
              <Text style={[styles.tileLabel, { color: tc.text }]} numberOfLines={1}>
                {t.label}
              </Text>
              <Text style={[styles.tileDesc, { color: tc.textSecondary }]} numberOfLines={1}>
                {t.desc}
              </Text>
            </View>
            {compact && showChevron ? (
              <Ionicons name="chevron-forward" size={16} color={tc.textSecondary} />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {showPopular ? <AIPopularServices title="Services les plus demandés" /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridCompact: { paddingHorizontal: 16, paddingVertical: 12, gap: 10, flex: 1 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.sm + 2,
  },
  tileCompact: { borderRadius: 10, minHeight: 60, paddingVertical: 8, paddingHorizontal: 12 },
  tileIconCompact: { width: 34, height: 34, borderRadius: 17 },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { flex: 1 },
  tileLabel: { fontSize: typography.fontSize.md, fontWeight: '700', fontFamily: typography.fontFamily.semiBold },
  tileDesc: { fontSize: typography.fontSize.xs },
});

export default AITherapistHomeBlock;
