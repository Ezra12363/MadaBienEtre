// src/components/ai/AIFeatureButton.js
// Bouton / bannière MISE EN AVANT "✨ Assistant IA & Chatbot".
// variant="banner" : grande carte dégradée vert (accueil, dashboards)
// variant="fab"    : bouton flottant rond en bas à droite
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '../../theme';
import { AI_GRADIENT } from './aiHelpers';

const AIFeatureButton = ({
  onPress,
  variant = 'banner',
  title = '✨ Assistant IA & Chatbot',
  subtitle = 'Recommandations, estimation de prix et réponses instantanées',
  bottom = 24,
  right = 20,
}) => {
  if (variant === 'fab') {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        accessibilityLabel="Ouvrir l'assistant IA"
        style={[styles.fab, { bottom, right }]}
      >
        <LinearGradient
          colors={AI_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Ionicons name="sparkles" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <LinearGradient
        colors={AI_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.bannerIcon}>
          <Ionicons name="sparkles" size={24} color={colors.primary} />
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>{title}</Text>
          <Text style={styles.bannerSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="arrow-forward-circle" size={28} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 18,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bannerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1 },
  bannerTitle: {
    color: '#fff',
    fontSize: typography.fontSize.lg,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AIFeatureButton;
