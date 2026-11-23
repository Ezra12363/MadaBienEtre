// src/hooks/useBottomInset.js
// ============================================================
// Marge à réserver SOUS la barre de saisie du chat.
//
// Android 15+ / Expo 56 (edge-to-edge) : l'application passe SOUS la barre
// de navigation système (boutons ◀ ● ■ ou geste). Sans marge, le champ
// « Écrire un message… » est recouvert par ces boutons.
//
//  - clavier fermé : on réserve la hauteur de la barre système (insets.bottom)
//  - clavier ouvert : le clavier recouvre déjà la barre système -> 0
//  - Web / iOS sans encoche : petit minimum esthétique
//  - ÉCRAN AVEC BARRE D'ONGLETS EN BAS (Accueil / Réservations / Messages...) :
//    la BottomTabBar réserve DÉJÀ la zone système (insets.bottom). Ajouter
//    insets.bottom sous le champ créait un grand vide entre la saisie et la
//    barre d'onglets -> on ne garde alors que le petit minimum.
// ============================================================
import { useContext, useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

export const useBottomInset = (minimum = 8) => {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // undefined hors d'un Tab.Navigator ; > 0 quand une barre d'onglets est
  // affichée sous l'écran ; 0 quand elle est masquée (menu fusionné en haut
  // sur grand écran web).
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const hasBottomTabBar = typeof tabBarHeight === 'number' && tabBarHeight > 0;

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (Platform.OS === 'web') return minimum;
  if (hasBottomTabBar) return minimum;
  return keyboardOpen ? minimum : Math.max(insets.bottom, minimum);
};

export default useBottomInset;
