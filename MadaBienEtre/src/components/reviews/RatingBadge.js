// src/components/reviews/RatingBadge.js
// Petit badge « ★ 4,8 · 28 avis » (cartes thérapeute, en-têtes, listes).
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STAR_COLOR, formatRating } from './reviewUtils';

export default function RatingBadge({ rating = 0, count = 0, onPress, size = 13, color = '#555', style }) {
  const has = Number(count) > 0;
  const content = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, style]}>
      <Ionicons name="star" size={size + 1} color={has ? STAR_COLOR : '#C9CED6'} />
      <Text style={{ fontSize: size, color, fontWeight: '700' }}>{has ? formatRating(rating) : 'Nouveau'}</Text>
      {has && (
        <Text style={{ fontSize: size, color, opacity: 0.8 }}>
          · {count} avis
        </Text>
      )}
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  ) : (
    content
  );
}
