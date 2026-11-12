// src/components/common/HideAmountsToggle.js
// Bouton « œil » pour masquer / afficher tous les montants de l'application.
// Même logique visuelle que l'œil d'un mot de passe.
//
//   <HideAmountsToggle color="#fff" />          // sur fond vert
//   <HideAmountsToggle color={primaryColor} />  // sur carte claire / sombre
import { memo } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useHideAmounts } from '../../hooks/useHideAmounts';

const HideAmountsToggle = ({ color = '#FFFFFF', size = 20, style }) => {
  const { hidden, toggle } = useHideAmounts();
  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={hidden ? 'Afficher les montants' : 'Masquer les montants'}
      style={style}
    >
      <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={size} color={color} />
    </TouchableOpacity>
  );
};

export default memo(HideAmountsToggle);
