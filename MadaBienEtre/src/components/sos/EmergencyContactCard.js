// src/components/sos/EmergencyContactCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const EmergencyContactCard = ({ contact, onEdit, onDelete }) => {
  const { colors: themeColors } = useTheme();

  const handleCall = () => {
    if (contact.phone) {
      Linking.openURL(`tel:${contact.phone}`);
    }
  };

  const handleMessage = () => {
    if (contact.phone) {
      Linking.openURL(`sms:${contact.phone}`);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {contact.name.charAt(0)}
          </Text>
          {contact.is_primary && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>Principal</Text>
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: themeColors.text }]}>
            {contact.name}
          </Text>
          <Text style={[styles.relationship, { color: themeColors.textSecondary }]}>
            {contact.relationship || 'Contact d\'urgence'}
          </Text>
          <Text style={[styles.phone, { color: themeColors.textSecondary }]}>
            {contact.phone}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
          <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="call-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.actionLabel, { color: themeColors.text }]}>
            Appeler
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleMessage}>
          <View style={[styles.actionIcon, { backgroundColor: colors.secondary + '20' }]}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.secondary} />
          </View>
          <Text style={[styles.actionLabel, { color: themeColors.text }]}>
            Message
          </Text>
        </TouchableOpacity>

        {onEdit && (
          <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(contact)}>
            <View style={[styles.actionIcon, { backgroundColor: colors.accent + '20' }]}>
              <Ionicons name="pencil-outline" size={20} color={colors.accent} />
            </View>
            <Text style={[styles.actionLabel, { color: themeColors.text }]}>
              Modifier
            </Text>
          </TouchableOpacity>
        )}

        {onDelete && (
          <TouchableOpacity style={styles.actionButton} onPress={() => onDelete(contact)}>
            <View style={[styles.actionIcon, { backgroundColor: colors.error + '20' }]}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.error }]}>
              Supprimer
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
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
  },
  primaryBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: typography.fontFamily.medium,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  relationship: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  phone: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
});

export default EmergencyContactCard;