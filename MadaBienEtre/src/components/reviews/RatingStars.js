// src/components/reviews/RatingStars.js
// Étoiles en lecture seule (ou interactives si onChange est fourni).
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STAR_COLOR } from './reviewUtils';

export default function RatingStars({ value = 0, size = 16, onChange, color, emptyColor = '#C9CED6', gap = 2 }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const icon = (
          <Ionicons
            name={star <= rounded ? 'star' : 'star-outline'}
            size={size}
            color={star <= rounded ? color || STAR_COLOR : emptyColor}
          />
        );
        return onChange ? (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star)}
            hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
            accessibilityRole="button"
            accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''}`}
          >
            {icon}
          </TouchableOpacity>
        ) : (
          <View key={star}>{icon}</View>
        );
      })}
    </View>
  );
}
