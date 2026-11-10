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
import { StyleSheet, Text, View } from 'react-native';

export const BADGE_SIZE = 18;

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
  const wide = label.length > 1;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.badge,
        anchored && styles.anchored,
        {
          minWidth: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderColor,
          paddingHorizontal: wide ? 4 : 0,
        },
        style,
      ]}
    >
      <Text
        style={[styles.text, { fontSize: size <= 18 ? 10 : 11, lineHeight: size - 4 }]}
        numberOfLines={1}
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
    top: -7,
    right: -9,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
});

export default CountBadge;
