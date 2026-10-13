// src/components/ai/AITherapistHomeBlock.js
// THÉRAPEUTE — bloc à insérer dans le Dashboard : tarification intelligente,
// analyse du marché, probabilité d'acceptation, chatbot + services populaires.
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import AIFeatureButton from './AIFeatureButton';
import AIPopularServices from './AIPopularServices';

const TILES = [
  { tab: 'pricing', icon: 'pricetag-outline', label: 'Tarification', desc: 'Suggestion & calcul' },
  { tab: 'market', icon: 'stats-chart-outline', label: 'Marché', desc: 'Prix & tendances' },
  { tab: 'acceptance', icon: 'pulse-outline', label: 'Acceptation', desc: 'Chance du prix' },
  { tab: 'chat', icon: 'chatbubbles-outline', label: 'Chatbot', desc: "Aide à l'application" },
];

const AITherapistHomeBlock = ({ onOpenAssistant }) => {
  const { colors: tc } = useTheme();

  return (
    <View style={styles.wrap}>
      <AIFeatureButton
        onPress={() => onOpenAssistant?.('pricing')}
        title="✨ Tarification intelligente IA"
        subtitle="Fixez le bon tarif, analysez le marché et anticipez les négociations"
      />

      <View style={styles.grid}>
        {TILES.map((t) => (
          <TouchableOpacity
            key={t.tab}
            activeOpacity={0.85}
            onPress={() => onOpenAssistant?.(t.tab)}
            style={[styles.tile, { backgroundColor: tc.surface, borderColor: tc.border }]}
          >
            <View style={styles.tileIcon}>
              <Ionicons name={t.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.tileText}>
              <Text style={[styles.tileLabel, { color: tc.text }]} numberOfLines={1}>
                {t.label}
              </Text>
              <Text style={[styles.tileDesc, { color: tc.textSecondary }]} numberOfLines={1}>
                {t.desc}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <AIPopularServices title="Services les plus demandés" />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.sm + 2,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { flex: 1 },
  tileLabel: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  tileDesc: { fontSize: typography.fontSize.xs },
});

export default AITherapistHomeBlock;
