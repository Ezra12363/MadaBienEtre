// src/components/chat/ChatBubble.js
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const ChatBubble = ({
  message,
  isOwn,
  timestamp,
  avatar,
  onLongPress,
  showAvatar = true,
}) => {
  const { colors: themeColors, isDark } = useTheme();

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageStatus = () => {
    const statusMap = {
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      failed: '⚠️',
    };
    return statusMap[message.status] || '';
  };

  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <Image
            source={{ uri: message.content }}
            style={styles.imageMessage}
            resizeMode="cover"
          />
        );
      case 'location':
        return (
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={20} color={colors.primary} />
            <Text style={[styles.locationText, { color: themeColors.text }]}>
              {message.content}
            </Text>
          </View>
        );
      default:
        return (
          <Text style={[
            styles.messageText,
            isOwn ? styles.ownText : styles.otherText,
            { color: isOwn ? '#fff' : themeColors.text }
          ]}>
            {message.content}
          </Text>
        );
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isOwn ? styles.ownContainer : styles.otherContainer,
      ]}
      onLongPress={() => onLongPress && onLongPress(message)}
      activeOpacity={0.7}
    >
      {!isOwn && showAvatar && (
        <View style={styles.avatarContainer}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <Text style={styles.defaultAvatarText}>
                {message.senderName?.charAt(0) || '?'}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={[
        styles.bubble,
        isOwn ? styles.ownBubble : styles.otherBubble,
        { backgroundColor: isOwn ? colors.primary : themeColors.surface },
      ]}>
        {!isOwn && message.senderName && (
          <Text style={[styles.senderName, { color: themeColors.textSecondary }]}>
            {message.senderName}
          </Text>
        )}
        
        {renderContent()}

        <View style={styles.timeContainer}>
          <Text style={[
            styles.timeText,
            { color: isOwn ? 'rgba(255,255,255,0.7)' : themeColors.textSecondary }
          ]}>
            {formatTime(message.createdAt || Date.now())}
          </Text>
          {isOwn && message.status && (
            <Text style={[
              styles.statusText,
              { color: isOwn ? 'rgba(255,255,255,0.7)' : themeColors.textSecondary }
            ]}>
              {getMessageStatus()}
            </Text>
          )}
        </View>
      </View>

      {isOwn && showAvatar && (
        <View style={styles.avatarContainer}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <Text style={styles.defaultAvatarText}>
                {message.senderName?.charAt(0) || 'M'}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
  },
  ownContainer: {
    justifyContent: 'flex-end',
  },
  otherContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginHorizontal: 4,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  defaultAvatar: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultAvatarText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  bubble: {
    maxWidth: '80%',
    padding: spacing.sm,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ownBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 2,
  },
  messageText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
  ownText: {
    color: '#fff',
  },
  otherText: {
    color: colors.text,
  },
  imageMessage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginVertical: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: 4,
  },
  locationText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
});

export default ChatBubble;