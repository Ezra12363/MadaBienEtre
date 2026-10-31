// src/components/client/LockedTherapistCard.js
//
// Carte « Thérapeute choisi » affichée EN HAUT du formulaire de réservation
// quand le client a appuyé sur « Réserver » depuis une carte thérapeute
// (recommandation IA, classement...). La demande est alors verrouillée sur ce
// thérapeute : lui seul la reçoit et négocie avec le client.
//
// Champs lus (tous optionnels sauf le nom) :
//   fullname | name, profile_image | photo | avatar, rating, total_reviews,
//   experience_years, price_suggested | base_price, distance_km, reason,
//   availability

import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import { formatAr } from '../ai/aiHelpers';

const Stat = ({ icon, text, color, bg }) => (
  <View style={[styles.stat, { backgroundColor: bg }]}>
    <Ionicons name={icon} size={14} color={color} />
    <Text style={[styles.statText, { color }]} numberOfLines={1}>
      {text}
    </Text>
  </View>
);

const LockedTherapistCard = ({ therapist }) => {
  const { colors: tc, isDark } = useTheme();
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : colors.primary + '12';

  if (!therapist) return null;

  const name = therapist.fullname || therapist.name || 'Thérapeute';
  const photo =
    therapist.profile_image || therapist.photo || therapist.avatar || null;
  const rating = Number(therapist.rating);
  const reviews = Number(therapist.total_reviews);
  const years = Number(therapist.experience_years);
  const distance = Number(therapist.distance_km);
  const price = therapist.price_suggested ?? therapist.base_price;
  const hasPrice = price !== undefined && price !== null && Number(price) > 0;
  const offline = therapist.availability === false;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tc.surface, borderColor: colors.primary },
      ]}
    >
      <View style={styles.badge}>
        <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
        <Text style={styles.badgeText}>Thérapeute choisi</Text>
      </View>

      <View style={styles.row}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={[styles.name, { color: tc.text }]} numberOfLines={1}>
            {name}
          </Text>

          <View style={styles.stats}>
            {Number.isFinite(rating) && rating > 0 ? (
              <Stat
                icon="star"
                color={colors.warning || '#F5A623'}
                bg={pillBg}
                text={`${rating.toFixed(1)}${
                  Number.isFinite(reviews) && reviews > 0
                    ? ` (${reviews})`
                    : ''
                }`}
              />
            ) : null}
            {Number.isFinite(years) && years > 0 ? (
              <Stat
                icon="ribbon-outline"
                color={tc.textSecondary}
                bg={pillBg}
                text={`${years} an${years > 1 ? 's' : ''} d'expérience`}
              />
            ) : null}
            {Number.isFinite(distance) && distance > 0 ? (
              <Stat
                icon="location-outline"
                color={tc.textSecondary}
                bg={pillBg}
                text={`${distance.toFixed(1)} km`}
              />
            ) : null}
            {hasPrice ? (
              <Stat
                icon="pricetag-outline"
                color={tc.textSecondary}
                bg={pillBg}
                text={`dès ${formatAr(price)}`}
              />
            ) : null}
          </View>
        </View>
      </View>

      {therapist.reason ? (
        <Text style={[styles.reason, { color: tc.textSecondary }]}>
          {therapist.reason}
        </Text>
      ) : null}

      <Text style={[styles.note, { color: tc.textSecondary }]}>
        {offline
          ? 'Ce thérapeute est actuellement hors ligne : il verra votre demande à sa prochaine connexion. '
          : ''}
        Complétez le formulaire ci-dessous : votre demande sera envoyée
        uniquement à ce thérapeute, puis vous négocierez le prix avec lui.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: spacing.md + 4,
    width: '100%',
    overflow: 'hidden',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: spacing.md,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fontFamily.semiBold,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.primary + '40',
  },
  avatarFallback: {
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontSize: typography.fontSize.xl || 20,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statText: { fontSize: 13, fontWeight: '600' },
  reason: { fontSize: typography.fontSize.sm, marginTop: spacing.md },
  note: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
    paddingTop: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.primary + '30',
  },
});

export default LockedTherapistCard;
