// src/components/reviews/TherapistReviewHeader.js
// En-tête de profil : photo du thérapeute + nom + note moyenne.
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import ReviewAvatar from './ReviewAvatar';
import RatingBadge from './RatingBadge';

export default function TherapistReviewHeader({ name, photo, rating, count, subtitle, style }) {
  const { colors: c } = useTheme();
  return (
    <View style={[s.row, { backgroundColor: c.surface, borderColor: c.border || 'rgba(0,0,0,0.06)' }, style]}>
      <ReviewAvatar photo={photo} name={name} size={64} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{name || 'Thérapeute'}</Text>
        {!!subtitle && <Text style={{ color: c.textSecondary, fontSize: 12 }} numberOfLines={1}>{subtitle}</Text>}
        <RatingBadge rating={rating} count={count} size={13} color={c.textSecondary} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  name: { fontSize: 17, fontWeight: '800' },
});
