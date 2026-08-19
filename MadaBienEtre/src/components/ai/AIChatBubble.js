// src/components/ai/AIChatBubble.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const AIChatBubble = ({ 
  message, 
  isUser, 
  timestamp, 
  onSuggestionPress,
  suggestions = [],
}) => {
  const { colors: themeColors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = () => {
    if (isUser) {
      return (
        <Text style={[styles.userMessage, { color: '#fff' }]}>
          {message}
        </Text>
      );
    }

    return (
      <>
        <View style={styles.aiHeader}>
          <View style={styles.aiAvatar}>
            <Ionicons name="chatbubble" size={16} color="#fff" />
          </View>
          <Text style={[styles.aiName, { color: colors.primary }]}>
            Assistant IA
          </Text>
        </View>

        <Text style={[styles.aiMessage, { color: themeColors.text }]}>
          {message}
        </Text>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.suggestionChip, { backgroundColor: themeColors.background }]}
                onPress={() => onSuggestionPress && onSuggestionPress(suggestion)}
              >
                <Text style={[styles.suggestionText, { color: colors.primary }]}>
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {message.length > 200 && (
          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
            <Text style={[styles.readMore, { color: colors.primary }]}>
              {isExpanded ? 'Voir moins' : 'Voir plus'}
            </Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.aiContainer,
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.aiBubble,
        { backgroundColor: isUser ? colors.primary : themeColors.surface },
      ]}>
        {renderContent()}
        <Text style={[
          styles.timeText,
          { color: isUser ? 'rgba(255,255,255,0.7)' : themeColors.textSecondary }
        ]}>
          {formatTime(timestamp || Date.now())}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  userMessage: {
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
    width: 24,
    height: 24,
    borderRadius: 12,
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
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
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