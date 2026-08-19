// src/components/ai/AIRecommendationCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const { width } = Dimensions.get('window');

const AIRecommendationCard = ({ 
  therapist, 
  onPress, 
  compact = false,
  showScore = true,
  showReason = true,
  showActions = true,
}) => {
  const { colors: themeColors } = useTheme();

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '⭐';
    if (hasHalf) stars += '⭐';
    for (let i = 0; i < emptyStars; i++) stars += '☆';
    
    return stars;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFA726';
    return '#D32F2F';
  };

  const scoreColor = getScoreColor(therapist.score || 0);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: themeColors.surface },
        compact && styles.compactCard,
      ]}
      onPress={() => onPress && onPress(therapist)}
      activeOpacity={0.7}
    >
      {showScore && (
        <LinearGradient
          colors={[scoreColor + '20', scoreColor + '10']}
          style={[styles.scoreBadge, { borderColor: scoreColor }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            {therapist.score || 0}%
          </Text>
          <Text style={[styles.scoreLabel, { color: scoreColor }]}>
            Match
          </Text>
        </LinearGradient>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {therapist.profile_image ? (
              <Image source={{ uri: therapist.profile_image }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarText}>
                {therapist.fullname?.charAt(0) || 'T'}
              </Text>
            )}
            {therapist.availability && (
              <View style={styles.onlineDot} />
            )}
          </View>
          <View style={styles.info}>
            <Text style={[styles.name, { color: themeColors.text }]}>
              {therapist.fullname}
            </Text>
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingStars}>
                {renderStars(therapist.rating || 0)}
              </Text>
              <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>
                {therapist.rating || 0} ({therapist.total_reviews || 0} avis)
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
              {therapist.distance_km || 0} km
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="briefcase-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
              {therapist.experience_years || 0} ans d'expérience
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.primary }]}>
              {therapist.price_suggested?.toLocaleString() || 0} Ar
            </Text>
          </View>
          {therapist.base_price && (
            <View style={styles.detailRow}>
              <Ionicons name="information-circle-outline" size={14} color={themeColors.textSecondary} />
              <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                Prix de base: {therapist.base_price.toLocaleString()} Ar
              </Text>
            </View>
          )}
        </View>

        {showReason && therapist.reason && (
          <View style={styles.reasonContainer}>
            <Ionicons name="bulb-outline" size={16} color={colors.primary} />
            <Text style={[styles.reason, { color: themeColors.textSecondary }]}>
              {therapist.reason}
            </Text>
          </View>
        )}

        {!compact && showActions && (
          <View style={styles.footer}>
            <View style={[styles.availabilityBadge, { 
              backgroundColor: therapist.availability ? '#4CAF50' + '20' : '#D32F2F' + '20' 
            }]}>
              <View style={[styles.availabilityDot, { 
                backgroundColor: therapist.availability ? '#4CAF50' : '#D32F2F' 
              }]} />
              <Text style={[styles.availabilityText, { 
                color: therapist.availability ? '#4CAF50' : '#D32F2F' 
              }]}>
                {therapist.availability ? 'Disponible' : 'Indisponible'}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.bookButton}
              onPress={() => onPress && onPress(therapist)}
              disabled={!therapist.availability}
            >
              <LinearGradient
                colors={therapist.availability ? [colors.primary, colors.primaryLight] : ['#ccc', '#ccc']}
                style={styles.bookGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.bookText, { color: therapist.availability ? '#fff' : '#999' }]}>
                  {therapist.availability ? 'Réserver' : 'Indisponible'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  compactCard: {
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  scoreBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    zIndex: 1,
  },
  scoreText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  scoreLabel: {
    fontSize: 8,
    fontFamily: typography.fontFamily.medium,
  },
  content: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
    overflow: 'hidden',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  ratingStars: {
    fontSize: typography.fontSize.sm,
  },
  ratingText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  details: {
    marginTop: spacing.sm,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
  },
  reason: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  availabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  availabilityText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
  },
  bookButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  bookGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default AIRecommendationCard;