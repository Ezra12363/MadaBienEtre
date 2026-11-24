// src/components/common/CountBadge.js
// ============================================================
// Pastille rouge de comptage (notifications, messages, etc.) :
// UN SEUL composant pour tout l'app => même taille, même position,
// chiffre parfaitement centré (cercle pour 1 chiffre, pilule au-delà).
//
// Usage : placer <CountBadge count={n} borderColor={fondDuHeader} />
// dans un conteneur de la taille de l'icône (position: relative) :
// la pastille se colle au coin HAUT-DROIT de l'icône.
//
//   <View style={{ width: 22, height: 22 }}>
//     <Ionicons name="notifications" size={22} />
//     <CountBadge count={unread} borderColor="#1B7F3B" />
//   </View>
// ============================================================
import { Platform, StyleSheet, Text, View } from 'react-native';
import { typography } from '../../theme';

// 22 (au lieu de 18) : la zone intérieure (22 - 2 x 2 de bordure = 18) est assez
// grande pour afficher le chiffre en 12 px sans le rogner ni le tronquer (« … »).
export const BADGE_SIZE = 22;

const formatCount = (count, max) => (count > max ? `${max}+` : String(count));

const CountBadge = ({
  count,
  max = 99,
  borderColor = '#FFFFFF',
  color = '#E53935',
  size = BADGE_SIZE,
  anchored = true, // false : pastille en ligne (ex. liste), sans position absolue
  style,
}) => {
  const n = Number(count) || 0;
  if (n <= 0) return null;

  const label = formatCount(n, max);
  const chars = label.length;

  // LARGEUR EXPLICITE (et non minWidth) : une vue en position absolue dans
  // un conteneur étroit (l'icône 21x21) est sinon rétrécie => le texte était
  // tronqué en « … » sur le web et Android.
  const width = chars <= 1 ? size : chars === 2 ? size + 8 : size + 16;

  const inner = size - 4; // hauteur intérieure (bordure 2 px de chaque côté)
  const fontSize = chars >= 3 ? Math.round(inner * 0.6) : Math.round(inner * 0.68);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.badge,
        anchored && styles.anchored,
        {
          width,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderColor,
        },
        style,
      ]}
    >
      <Text
        style={[{ fontFamily: typography.fontFamily.regular }, styles.text, { fontFamily: typography.fontFamily.regular, fontSize, lineHeight: inner }]}
        numberOfLines={1}
        ellipsizeMode="clip"
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    elevation: 5,
  },
  // Coin haut-droit de l'icône : le centre de la pastille tombe sur le coin
  anchored: {
    position: 'absolute',
    top: -9,
    right: -11,
  },
  text: { fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    ...Platform.select({
      web: { whiteSpace: 'nowrap' },
      default: {},
    }),
  },
});

export default CountBadge;
