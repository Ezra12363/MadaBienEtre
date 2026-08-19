// src/hooks/useResponsive.js
//
// ✅ Hook responsive UNIQUE et partagé par TOUT l'admin (Dashboard,
// Users, Therapists, MassageTypes, Approvals, Reviews, Settings).
//
// Breakpoints (norme internationale) :
// - Mobile   : < 768px         → 1 colonne
// - Tablette : 768px – 1023px  → 2 colonnes
// - Desktop  : >= 1024px       → 3 colonnes (4 si >= 1400px)
//
// ⚠️ IMPORTANT — pourquoi ce hook doit être la SEULE source de vérité :
// Plusieurs écrans décidaient auparavant du layout (tableau large vs
// cartes mobiles) avec `Platform.OS === 'web'`. Résultat : sur un
// navigateur web étroit (fenêtre redimensionnée, ou site ouvert sur
// téléphone), le tableau large restait affiché avec un scroll
// horizontal forcé — l'appli ne devenait JAMAIS "version mobile" sur
// le web. Chaque écran doit donc baser sa décision de layout sur
// `isDesktop` / `isTablet` / `isMobile` (largeur RÉELLE de la
// fenêtre), jamais sur la plateforme seule.
//
// ⚠️ Pas de calc() : `calc()` est une syntaxe CSS web uniquement, elle
// ne fonctionne pas dans les styles React Native sur Android/iOS (elle
// serait silencieusement ignorée par le moteur natif). Toutes les
// largeurs sont donc calculées en JS et renvoyées en pourcentage ou en
// nombre, ce qui fonctionne identiquement sur web ET natif.
//
// ⚠️ isMobile = largeur d'écran < 768px (PAS Platform.OS). Un iPad ou
// une fenêtre web large ne sont pas "mobile" même si Platform.OS vaut
// 'ios' ou 'web'. Pour tester la plateforme (comportements natifs
// comme les animations de Modal), utilisez `isWeb` / `isNativeApp`,
// jamais `isMobile`.

import { useWindowDimensions, Platform } from 'react-native';

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
  wide: 1400,
};

export const MAX_CONTENT_WIDTH = 1200;

/**
 * @returns {Object} Propriétés responsive
 */
const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  // ── Plateforme (à utiliser seulement pour des comportements natifs
  //    réels comme l'animation d'un Modal — jamais pour le layout) ──
  const isWeb = Platform.OS === 'web';
  const isNativeApp = Platform.OS === 'ios' || Platform.OS === 'android';

  // ── Breakpoints — largeur RÉELLE de la fenêtre/écran ────────────
  const isMobile = width < BREAKPOINTS.tablet;
  const isSmallScreen = isMobile; // alias explicite
  const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isWideScreen = width >= BREAKPOINTS.wide;
  const isLargeScreen = isDesktop || isTablet; // tablette OU desktop (≥768px)

  // ── Colonnes de grille ───────────────────────────────────────────
  let columns = 1;
  if (isDesktop) {
    columns = isWideScreen ? 4 : 3;
  } else if (isTablet) {
    columns = 2;
  } else {
    columns = 1;
  }

  // ── Largeur de contenu (centré sur grand écran) ──────────────────
  // Toujours un nombre (jamais '100%') pour éviter les soucis de
  // typage de style mixte number/string sur certains composants RN.
  const contentMaxWidth = isDesktop
    ? Math.min(width, MAX_CONTENT_WIDTH)
    : width;

  // ── Espacements adaptés ───────────────────────────────────────────
  const horizontalPadding = isDesktop ? 24 : isTablet ? 16 : 12;
  const containerPadding = horizontalPadding; // alias utilisé par ReviewsScreen
  const cardPadding = isDesktop ? 20 : 16;

  // ── Typographie adaptée ────────────────────────────────────────────
  const fontSize = {
    small: isDesktop ? 14 : 12,
    medium: isDesktop ? 16 : 14,
    large: isDesktop ? 20 : 18,
    xlarge: isDesktop ? 28 : 24,
  };

  // ── Tailles de composants adaptées ─────────────────────────────────
  const buttonSize = isDesktop ? 48 : 44;
  const avatarSize = isDesktop ? 56 : 48;

  /**
   * Largeur d'une "colonne" de grille en pourcentage, SANS calc()
   * (donc valide sur web ET natif). `gapPercent` est l'écart estimé
   * entre les colonnes exprimé en % de la largeur totale — on le
   * soustrait avant de diviser pour ne pas dépasser 100%.
   *
   * Exemple : getColumnWidth() avec columns=3 → "32.67%" environ.
   */
  const getColumnWidth = (gapPercent = 2) => {
    if (columns <= 1) return '100%';
    const usable = 100 - gapPercent * (columns - 1);
    return `${(usable / columns).toFixed(2)}%`;
  };

  return {
    // Plateforme (comportements natifs uniquement, pas le layout)
    isWeb,
    isNativeApp,

    // Breakpoints — largeur réelle, à utiliser pour TOUT choix de layout
    isMobile,
    isSmallScreen,
    isTablet,
    isDesktop,
    isWideScreen,
    isLargeScreen,

    // Dimensions
    width,
    height,
    columns,
    gridColumns: columns, // alias utilisé par ReviewsScreen
    contentMaxWidth,

    // Espacements
    horizontalPadding,
    containerPadding, // alias utilisé par ReviewsScreen
    cardPadding,

    // Tailles adaptées
    fontSize,
    buttonSize,
    avatarSize,

    // Utilitaires
    getColumnWidth,
  };
};

export default useResponsive;