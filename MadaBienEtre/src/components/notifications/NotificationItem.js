// src/components/notifications/NotificationItem.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const NotificationItem = ({ notification, onPress, onDelete }) => {
  const { colors: themeColors } = useTheme();

  const getIcon = (type) => {
    const map = {
      booking: 'calendar-outline',
      offer: 'pricetag-outline',
      payment: 'card-outline',
      review: 'star-outline',
      sos: 'alert-circle-outline',
      system: 'information-circle-outline',
      promotion: 'gift-outline',
      reminder: 'time-outline',
      chat: 'chatbubble-outline',
    };
    return map[type] || 'notifications-outline';
  };

  const getColor = (type) => {
    const map = {
      booking: '#4CAF50',
      offer: '#FF6F00',
      payment: '#2196F3',
      review: '#FFD700',
      sos: '#D32F2F',
      system: '#757575',
      promotion: '#9C27B0',
      reminder: '#FF9800',
      chat: '#2196F3',
    };
    return map[type] || '#757575';
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `${minutes} min`;
    if (hours < 24) return `${hours} h`;
    if (days < 7) return `${days} j`;
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const iconName = getIcon(notification.type);
  const iconColor = getColor(notification.type);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: themeColors.surface },
        !notification.is_read && styles.unread,
      ]}
      onPress={() => onPress && onPress(notification)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={iconName} size={24} color={iconColor} />
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>
            {notification.title}
          </Text>
          <Text style={[styles.time, { color: themeColors.textSecondary }]}>
            {formatTime(notification.created_at)}
          </Text>
        </View>
        <Text style={[styles.body, { color: themeColors.textSecondary }]}>
          {notification.body}
        </Text>
        {!notification.is_read && (
          <View style={styles.unreadDot} />
        )}
      </View>

      {onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(notification)}
        >
          <Ionicons name="close" size={18} color={themeColors.textSecondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unread: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    flex: 1,
    marginRight: spacing.sm,
  },
  time: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  body: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
    lineHeight: 20,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  deleteButton: {
    padding: 4,
  },
});

export default NotificationItem;