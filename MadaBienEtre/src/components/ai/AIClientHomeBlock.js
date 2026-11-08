// src/components/ai/AIClientHomeBlock.js
// CLIENT — bloc de l'accueil : bannière « Assistant IA & Chatbot » + raccourcis.
// Même rendu que AITherapistHomeBlock (bannière dégradée + tuiles 2 x 2).
// Props :
//   showPopular / showBest : afficher aussi "Services populaires" / "Thérapeutes
//   recommandés" (true par défaut, ancien comportement). Sur l'accueil client
//   ils sont affichés à part, dans la mise en page en colonnes.
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';
import AIFeatureButton from './AIFeatureButton';
import AIPopularServices from './AIPopularServices';
import AIBestTherapists from './AIBestTherapists';

const SHORTCUTS = [
  { tab: 'reco', icon: 'people-outline', label: 'Recommandations', desc: 'Massage idéal pour vous', color: '#2E8B57' },
  { tab: 'price', icon: 'calculator-outline', label: 'Estimer le prix', desc: 'Tarif juste & calcul', color: '#2563EB' },
  { tab: 'chat', icon: 'chatbubbles-outline', label: 'Chatbot', desc: "Aide à l'application", color: '#7C3AED' },
];

const AIClientHomeBlock = ({
  onOpenAssistant,
  onBookTherapist,
  showPopular = true,
  showBest = true,
  compact = false,
}) => {
  const { colors: tc } = useTheme();
  const { width } = useWindowDimensions();
  const showChevron = width >= 480;

  return (
    <View style={[styles.wrap, compact && { gap: 0, flex: 1 }]}>
      <AIFeatureButton
        onPress={() => onOpenAssistant?.('reco')}
        title={compact ? 'Assistant IA & Chatbot' : undefined}
        subtitle="Trouvez le massage idéal, estimez le prix et posez vos questions"
        compact={compact}
      />

      <View style={[styles.shortcuts, compact && styles.shortcutsCompact]}>
        {SHORTCUTS.map((s, index) => (
          <TouchableOpacity
            key={s.tab}
            activeOpacity={0.85}
            onPress={() => onOpenAssistant?.(s.tab)}
            style={[
              styles.shortcut,
              compact && styles.shortcutCompact,
              // 3 tuiles : la dernière occupe toute la largeur (grille 2 colonnes)
              compact && index === SHORTCUTS.length - 1 && { flexBasis: '100%' },
              { backgroundColor: tc.surface, borderColor: tc.border },
            ]}
          >
            <View style={[styles.icon, compact && styles.iconCompact, { backgroundColor: s.color + '1F' }]}>
              <Ionicons name={s.icon} size={20} color={s.color} />
            </View>

            {compact ? (
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.label, { color: tc.text }]} numberOfLines={1}>{s.label}</Text>
                <Text style={[styles.desc, { color: tc.textSecondary }]} numberOfLines={1}>{s.desc}</Text>
              </View>
            ) : (
              <Text style={[styles.shortcutText, { color: tc.text }]} numberOfLines={1}>{s.label}</Text>
            )}

            {compact && showChevron ? (
              <Ionicons name="chevron-forward" size={16} color={tc.textSecondary} />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {showPopular ? <AIPopularServices title="Services populaires" /> : null}
      {showBest ? (
        <AIBestTherapists
          title="Thérapeutes recommandés"
          limit={3}
          onPress={onBookTherapist}
          onBook={onBookTherapist}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  shortcutsCompact: { flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 12, gap: 10, flex: 1 },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 4,
  },
  shortcutCompact: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    gap: 10,
    borderRadius: 10,
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  iconCompact: { width: 34, height: 34, borderRadius: 17 },
  label: { fontSize: typography.fontSize.md, fontWeight: '700' },
  desc: { fontSize: typography.fontSize.xs },
  shortcutText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold },
});

export default AIClientHomeBlock;
