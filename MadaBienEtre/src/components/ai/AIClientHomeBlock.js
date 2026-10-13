// src/components/ai/AIClientHomeBlock.js
// CLIENT — bloc à insérer dans HomeScreen : bouton « ✨ Assistant IA & Chatbot »,
// raccourcis, services populaires et thérapeutes recommandés.
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import AIFeatureButton from './AIFeatureButton';
import AIPopularServices from './AIPopularServices';
import AIBestTherapists from './AIBestTherapists';

const SHORTCUTS = [
  { tab: 'reco', icon: 'people-outline', label: 'Recommandations' },
  { tab: 'price', icon: 'calculator-outline', label: 'Estimer le prix' },
  { tab: 'chat', icon: 'chatbubbles-outline', label: 'Chatbot' },
];

const AIClientHomeBlock = ({ onOpenAssistant, onBookTherapist }) => {
  const { colors: tc } = useTheme();

  return (
    <View style={styles.wrap}>
      <AIFeatureButton
        onPress={() => onOpenAssistant?.('reco')}
        subtitle="Trouvez le massage idéal, estimez le prix et posez vos questions"
      />

      <View style={styles.shortcuts}>
        {SHORTCUTS.map((s) => (
          <TouchableOpacity
            key={s.tab}
            activeOpacity={0.85}
            onPress={() => onOpenAssistant?.(s.tab)}
            style={[styles.shortcut, { backgroundColor: tc.surface, borderColor: tc.border }]}
          >
            <Ionicons name={s.icon} size={20} color={colors.primary} />
            <Text style={[styles.shortcutText, { color: tc.text }]} numberOfLines={1}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <AIPopularServices title="Services populaires" />
      <AIBestTherapists
        title="Thérapeutes recommandés"
        limit={3}
        onPress={onBookTherapist}
        onBook={onBookTherapist}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 4,
  },
  shortcutText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold },
});

export default AIClientHomeBlock;
