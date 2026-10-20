// src/components/chat/chatTheme.js
// Palette du chat DÉRIVÉE du thème de l'application (ThemeContext) :
// mêmes couleurs, mêmes surfaces et mêmes bordures que les autres écrans.
// Fonctionne en clair / sombre, sur Android, iOS et Web.

import { useWindowDimensions } from 'react-native';

// ✅ Plein écran : plus de largeur maximale centrée (elle laissait des bandes
// vides à gauche/droite sur le web). Conservé pour compatibilité : '100%'.
export const CHAT_MAX_WIDTH = '100%';

// Padding latéral adapté à la largeur réelle de la fenêtre (web / Android / iOS).
export const getChatSidePadding = (width) => {
  if (width >= 1280) return 32;
  if (width >= 1024) return 28;
  if (width >= 768) return 20;
  return 16;
};

export const useChatSidePadding = () => {
  const { width } = useWindowDimensions();
  return getChatSidePadding(width);
};

// Largeur max d'une bulle de message selon l'écran.
export const getChatBubbleMaxWidth = (width) => {
  if (width >= 1024) return '62%';
  if (width >= 768) return '72%';
  return '82%';
};

export const getChatPalette = (themeColors = {}, isDark = false) => {
  const primary = themeColors.primary || '#2E7D32';
  const surface = themeColors.surface || (isDark ? '#1E1E1E' : '#FFFFFF');
  const border = themeColors.border || (isDark ? '#333333' : '#E0E0E0');
  const text = themeColors.text || (isDark ? '#FFFFFF' : '#1A1A1A');
  const textSecondary = themeColors.textSecondary || (isDark ? '#B0B0B0' : '#757575');

  return {
    screenBg: themeColors.background || (isDark ? '#121212' : '#F5F5F5'),
    surface,
    border,
    text,
    textSecondary,

    primary,
    primarySoft: isDark ? '#1F3329' : `${primary}1A`,

    ownBubble: primary,
    ownText: '#FFFFFF',
    otherBubble: surface,
    otherText: text,
    otherBorder: border,

    meta: textSecondary,
    metaRead: isDark ? '#6EE7A8' : primary,

    pillBg: isDark ? '#1B2621' : '#E3EBE6',
    pillText: textSecondary,

    inputBg: themeColors.input || (isDark ? '#2C2C2C' : '#F5F5F5'),
    inputBorder: border,
    inputText: text,
    placeholder: textSecondary,
    sendIdle: textSecondary,

    avatarBg: isDark ? '#1F3329' : `${primary}1F`,
    avatarText: isDark ? '#6EE7A8' : primary,

    online: '#22C55E',
    offline: '#9CA3AF',
    warning: '#F59E0B',
    danger: '#E53935',
    dangerSoft: isDark ? '#3A1D1F' : '#FDECEC',
    overlay: 'rgba(0,0,0,0.45)',
  };
};

export default getChatPalette;
