// src/hooks/useScreenLayout.js
//
// Layout PLEIN ÉCRAN et responsive partagé par les écrans Messagerie / IA.
//
// Règle : on n'utilise PLUS de maxWidth centré (qui laissait des bandes
// vides à gauche et à droite sur le web). Le contenu occupe toute la largeur
// de la fenêtre ; seul le padding latéral s'adapte à la taille de l'écran :
//   - mobile  (< 768px)   : 12px   (Android, iOS, web étroit)
//   - tablette(768-1023)  : 20px
//   - desktop (>= 1024)   : 28px   (>= 1280 : 32px)
//
// La décision se base sur la largeur RÉELLE de la fenêtre (pas sur
// Platform.OS), donc identique sur Android, iOS et web.

import { useWindowDimensions } from 'react-native';

export const getSidePadding = (width, mobile = 12) => {
  if (width >= 1280) return 32;
  if (width >= 1024) return 28;
  if (width >= 768) return 20;
  return mobile;
};

const useScreenLayout = () => {
  const { width, height } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    sidePadding: getSidePadding(width),
    // largeur max d'une bulle de discussion (en % de la ligne)
    bubbleMaxWidth: isDesktop ? '62%' : isTablet ? '72%' : '88%',
  };
};

export default useScreenLayout;
