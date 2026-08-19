// src/hooks/useResponsive.js
import { useWindowDimensions, Platform } from 'react-native';

/**
 * ✅ Hook responsive pour adapter l'interface selon la taille de l'écran
 * 
 * Breakpoints (norme internationale) :
 * - Mobile : < 768px (1 colonne)
 * - Tablette : 768px - 1024px (2 colonnes)
 * - Desktop : > 1024px (3-4 colonnes)
 * 
 * @returns {Object} Propriétés responsive
 */
const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  
  // ✅ Détection des plateformes
  const isWeb = Platform.OS === 'web';
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';
  
  // ✅ Breakpoints (taille en pixels)
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  const isLargeScreen = isDesktop || isTablet;
  const isSmallScreen = width < 768;
  
  // ✅ Nombre de colonnes pour les grilles
  let columns = 1;
  if (isDesktop) {
    columns = width >= 1400 ? 4 : 3;
  } else if (isTablet) {
    columns = 2;
  } else {
    columns = 1;
  }
  
  // ✅ Largeur maximale du contenu (centré sur grand écran)
  const contentMaxWidth = isDesktop ? 1200 : isTablet ? 720 : '100%';
  
  // ✅ Padding horizontal adapté
  const horizontalPadding = isDesktop ? 24 : isTablet ? 16 : 12;
  
  // ✅ Taille des polices adaptée
  const fontSize = {
    small: isDesktop ? 14 : 12,
    medium: isDesktop ? 16 : 14,
    large: isDesktop ? 20 : 18,
    xlarge: isDesktop ? 28 : 24,
  };
  
  // ✅ Taille des composants
  const buttonSize = isDesktop ? 48 : 44;
  const avatarSize = isDesktop ? 56 : 48;
  const cardPadding = isDesktop ? 20 : 16;
  
  return {
    // ✅ Breakpoints
    isTablet,
    isDesktop,
    isLargeScreen,
    isSmallScreen,
    isWeb,
    isMobile,
    
    // ✅ Dimensions
    width,
    height,
    columns,
    contentMaxWidth,
    horizontalPadding,
    
    // ✅ Tailles adaptées
    fontSize,
    buttonSize,
    avatarSize,
    cardPadding,
    
    // ✅ Utilitaires pour les styles conditionnels
    getColumnWidth: (gap = 12) => {
      if (isDesktop) return `calc(${100 / columns}% - ${gap}px)`;
      if (isTablet) return `calc(50% - ${gap}px)`;
      return '100%';
    },
  };
};

export default useResponsive;