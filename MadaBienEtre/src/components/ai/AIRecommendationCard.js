// src/components/ai/AIRecommendationCard.js
// Carte thérapeute (recommandation IA OU classement "meilleurs thérapeutes").
//
// Champs lus (tous optionnels sauf fullname) :
//   /ai/recommend-therapist : therapist_id, fullname, rating, total_reviews,
//        score, distance_km, experience_years, price_suggested, base_price,
//        availability, reason, profile_image
//   /ai/best-therapists     : id, fullname, rating, total_reviews,
//        experience_years, base_price, profile_image
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import { formatAr } from './aiHelpers';

const scoreColor = (score) => {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.error;
};

const AIRecommendationCard = ({
  therapist,
  onPress,
  onBook,
  compact = false,
  showScore = true,
  showReason = true,
  showActions = true,
  rank = null,
}) => {
  const { colors: themeColors } = useTheme();

  if (!therapist) return null;

  const score = Number(therapist.score);
  const hasScore = showScore && Number.isFinite(score) && score > 0;
  const price = therapist.price_suggested ?? therapist.base_price;
  const hasPrice = price !== undefined && price !== null && Number(price) > 0;
  const rating = Number(therapist.rating || 0);
  // Absent = considéré disponible ; seul `false` bloque la réservation.
  const available = therapist.availability !== false;
  const distance = Number(therapist.distance_km);

  const handleBook = () => (onBook || onPress)?.(therapist);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(therapist)}
      style={[
        styles.card,
        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
        compact && styles.compactCard,
      ]}
    >
      <View style={styles.header}>
        {rank ? (
          <View style={styles.rank}>
            <Text style={styles.rankText}>{rank}</Text>
          </View>
        ) : null}

        <View style={styles.avatarContainer}>
          {therapist.profile_image ? (
            <Image source={{ uri: therapist.profile_image }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {(therapist.fullname || 'T').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: themeColors.text }]} numberOfLines={1}>
            {therapist.fullname || 'Thérapeute'}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color="#FFB300" />
            <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>
              {rating.toFixed(1)} ({therapist.total_reviews || 0} avis)
            </Text>
          </View>
        </View>

        {hasScore && (
          <View
            style={[
              styles.scoreBadge,
              { borderColor: scoreColor(score), backgroundColor: scoreColor(score) + '14' },
            ]}
          >
            <Text style={[styles.scoreText, { color: scoreColor(score) }]}>
              {Math.round(score)}%
            </Text>
            <Text style={[styles.scoreLabel, { color: scoreColor(score) }]}>Match</Text>
          </View>
        )}
      </View>

      <View style={styles.details}>
        {Number.isFinite(distance) && distance > 0 && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
              {distance.toFixed(1)} km
            </Text>
          </View>
        )}
        {therapist.experience_years ? (
          <View style={styles.detailRow}>
            <Ionicons name="briefcase-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
              {therapist.experience_years} ans d'exp.
            </Text>
          </View>
        ) : null}
        {hasPrice && (
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={14} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.primary, fontFamily: typography.fontFamily.semiBold }]}>
              {formatAr(price)}
            </Text>
          </View>
        )}
      </View>

      {showReason && !!therapist.reason && (
        <View style={[styles.reasonContainer, { backgroundColor: colors.primary + '12' }]}>
          <Ionicons name="bulb-outline" size={15} color={colors.primary} />
          <Text style={[styles.reason, { color: themeColors.textSecondary }]}>
            {therapist.reason}
          </Text>
        </View>
      )}

      {!compact && showActions && (
        <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
          <View
            style={[
              styles.availabilityBadge,
              { backgroundColor: (available ? colors.success : colors.error) + '1A' },
            ]}
          >
            <View
              style={[
                styles.availabilityDot,
                { backgroundColor: available ? colors.success : colors.error },
              ]}
            />
            <Text
              style={[
                styles.availabilityText,
                { color: available ? colors.success : colors.error },
              ]}
            >
              {available ? 'Disponible' : 'Indisponible'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.bookButton,
              { backgroundColor: available ? colors.primary : '#BDBDBD' },
            ]}
            onPress={handleBook}
            disabled={!available}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={15} color="#fff" />
            <Text style={styles.bookText}>Réserver</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  compactCard: { padding: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: '#fff', fontSize: 12, fontFamily: typography.fontFamily.bold },
  avatarContainer: {},
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  info: { flex: 1 },
  name: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular },
  scoreBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  scoreText: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  scoreLabel: { fontSize: 9, fontFamily: typography.fontFamily.medium },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
  },
  reason: { flex: 1, fontSize: typography.fontSize.sm, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  availabilityDot: { width: 6, height: 6, borderRadius: 3 },
  availabilityText: { fontSize: 11, fontFamily: typography.fontFamily.medium },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  bookText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default AIRecommendationCard;
