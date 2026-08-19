// src/components/cards/BookingCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const BookingCard = ({ booking, onPress, compact = false }) => {
  const { colors: themeColors } = useTheme();

  const getStatusColor = (status) => {
    const map = {
      pending: '#FFA726',
      negotiating: '#2196F3',
      confirmed: '#4CAF50',
      in_progress: '#FF9800',
      completed: '#2E7D32',
      cancelled_by_client: '#D32F2F',
      cancelled_by_therapist: '#D32F2F',
      expired: '#757575',
    };
    return map[status] || '#757575';
  };

  const getStatusLabel = (status) => {
    const map = {
      pending: 'En attente',
      negotiating: 'Négociation',
      confirmed: 'Confirmée',
      in_progress: 'En cours',
      completed: 'Terminée',
      cancelled_by_client: 'Annulée',
      cancelled_by_therapist: 'Annulée',
      expired: 'Expirée',
    };
    return map[status] || status;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColor = getStatusColor(booking.status);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: themeColors.surface },
        compact && styles.compactCard,
      ]}
      onPress={() => onPress && onPress(booking)}
      activeOpacity={0.7}
    >
      {!compact && (
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={[styles.massageType, { color: themeColors.text }]}>
              {booking.massage_type || 'Massage'}
            </Text>
            {!compact && (
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {getStatusLabel(booking.status)}
                </Text>
              </View>
            )}
          </View>
          {booking.final_price && (
            <Text style={[styles.price, { color: colors.primary }]}>
              {booking.final_price.toLocaleString()} Ar
            </Text>
          )}
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
              {booking.client?.fullname || 'Client'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
              {formatDate(booking.scheduled_date || booking.created_at)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
              {booking.scheduled_duration_minutes || 60} min
            </Text>
          </View>
        </View>

        {compact && (
          <View style={styles.compactStatus}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.compactStatusText, { color: statusColor }]}>
              {getStatusLabel(booking.status)}
            </Text>
          </View>
        )}
      </View>

      {!compact && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onPress && onPress(booking)}
          >
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Voir détails
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
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
  statusIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
  },
  content: {
    padding: spacing.md,
    paddingLeft: spacing.md + 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  massageType: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
  },
  price: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  details: {
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
  compactStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compactStatusText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
});

export default BookingCard;