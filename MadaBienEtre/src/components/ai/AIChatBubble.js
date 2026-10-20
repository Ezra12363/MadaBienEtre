// src/components/ai/AIChatBubble.js
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import useScreenLayout from '../../hooks/useScreenLayout';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const COLLAPSED_LINES = 8;

const AIChatBubble = ({
  message,
  isUser,
  timestamp,
  onSuggestionPress,
  suggestions = [],
}) => {
  const { colors: themeColors } = useTheme();
  const { bubbleMaxWidth } = useScreenLayout();
  const [isExpanded, setIsExpanded] = useState(false);

  const text = typeof message === 'string' ? message : '';
  const isLong = !isUser && text.length > 280;

  const formatTime = (date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const safeSuggestions = Array.isArray(suggestions)
    ? suggestions.filter((s) => typeof s === 'string' && s.trim())
    : [];

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.aiContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
          {
            maxWidth: bubbleMaxWidth,
            backgroundColor: isUser ? colors.primary : themeColors.surface,
            borderColor: isUser ? colors.primary : themeColors.border,
          },
        ]}
      >
        {isUser ? (
          <Text style={styles.userMessage}>{text}</Text>
        ) : (
          <>
            <View style={styles.aiHeader}>
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={13} color="#fff" />
              </View>
              <Text style={[styles.aiName, { color: colors.primary }]}>
                Assistant IA
              </Text>
            </View>

            <Text
              selectable
              style={[styles.aiMessage, { color: themeColors.text }]}
              numberOfLines={isLong && !isExpanded ? COLLAPSED_LINES : undefined}
            >
              {text}
            </Text>

            {isLong && (
              <TouchableOpacity onPress={() => setIsExpanded((v) => !v)}>
                <Text style={[styles.readMore, { color: colors.primary }]}>
                  {isExpanded ? 'Voir moins' : 'Voir plus'}
                </Text>
              </TouchableOpacity>
            )}

            {safeSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {safeSuggestions.slice(0, 4).map((suggestion, index) => (
                  <TouchableOpacity
                    key={`${suggestion}-${index}`}
                    style={[
                      styles.suggestionChip,
                      { backgroundColor: colors.primary + '12' },
                    ]}
                    onPress={() => onSuggestionPress && onSuggestionPress(suggestion)}
                  >
                    <Text style={[styles.suggestionText, { color: colors.primary }]}>
                      {suggestion}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {timestamp ? (
          <Text
            style={[
              styles.timeText,
              {
                color: isUser
                  ? 'rgba(255,255,255,0.75)'
                  : themeColors.textSecondary,
              },
            ]}
          >
            {formatTime(timestamp)}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 4, paddingHorizontal: spacing.xs },
  userContainer: { alignItems: 'flex-end' },
  aiContainer: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '88%',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  userBubble: { borderBottomRightRadius: 4 },
  aiBubble: { borderBottomLeftRadius: 4 },
  userMessage: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  aiAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
  aiMessage: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  suggestionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  suggestionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  readMore: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginTop: 4,
  },
  timeText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});

export default AIChatBubble;
