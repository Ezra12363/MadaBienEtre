// src/components/rating/StarRating.js
import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const StarRating = ({
  rating = 0,
  onRatingChange,
  size = 40,
  maxStars = 5,
  showLabel = true,
  readonly = false,
  disabled = false,
}) => {
  const { colors: themeColors } = useTheme();
  const [hoverRating, setHoverRating] = useState(0);
  const [currentRating, setCurrentRating] = useState(rating);

  const ratingLabels = [
    'Très déçu',
    'Moyen',
    'Bien',
    'Très bien',
    'Exceptionnel',
  ];

  const handleRating = (star) => {
    if (disabled || readonly) return;
    setCurrentRating(star);
    setHoverRating(0);
    if (onRatingChange) onRatingChange(star);
  };

  const handleHover = (star) => {
    if (disabled || readonly) return;
    setHoverRating(star);
  };

  const displayRating = hoverRating || currentRating || rating;

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {Array.from({ length: maxStars }, (_, index) => {
          const starNumber = index + 1;
          const isFilled = starNumber <= displayRating;
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleRating(starNumber)}
              onPressIn={() => handleHover(starNumber)}
              onPressOut={() => handleHover(0)}
              disabled={disabled || readonly}
              activeOpacity={0.7}
              style={styles.starButton}
            >
              <Ionicons
                name={isFilled ? 'star' : 'star-outline'}
                size={size}
                color={isFilled ? '#FFD700' : themeColors.textSecondary}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {showLabel && displayRating > 0 && (
        <Text style={[styles.label, { color: colors.primary }]}>
          {ratingLabels[displayRating - 1]}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  starButton: {
    padding: 2,
  },
  label: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
    marginTop: spacing.xs,
  },
});

export default StarRating;