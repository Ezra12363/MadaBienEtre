// src/screens/client/HistoryScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import axios from 'axios';
import { API_URL } from '../../config';

const HistoryScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const filters = [
    { id: 'all', label: 'Tous' },
    { id: 'completed', label: 'Terminés' },
    { id: 'confirmed', label: 'Confirmés' },
    { id: 'cancelled', label: 'Annulés' },
  ];

  useEffect(() => {
    loadHistory();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
      // Données mockées
      setBookings([
        {
          id: 1,
          massageType: 'Massage Relaxant',
          duration: 60,
          date: '2026-07-15T14:30:00',
          status: 'completed',
          finalPrice: 75000,
          therapist: { name: 'Sarah B.' },
        },
        {
          id: 2,
          massageType: 'Massage Sportif',
          duration: 90,
          date: '2026-07-10T10:00:00',
          status: 'confirmed',
          finalPrice: 80000,
          therapist: { name: 'Jean R.' },
        },
        {
          id: 3,
          massageType: 'Massage Thérapeutique',
          duration: 60,
          date: '2026-07-05T16:00:00',
          status: 'cancelled',
          finalPrice: 60000,
          therapist: { name: 'Marie L.' },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const getStatusInfo = (status) => {
    const map = {
      pending: { label: 'En attente', color: '#FFA726' },
      negotiating: { label: 'Négociation', color: '#2196F3' },
      confirmed: { label: 'Confirmée', color: '#4CAF50' },
      in_progress: { label: 'En cours', color: '#FF9800' },
      completed: { label: 'Terminée', color: '#2E7D32' },
      cancelled_by_client: { label: 'Annulée', color: '#D32F2F' },
      cancelled_by_therapist: { label: 'Annulée', color: '#D32F2F' },
    };
    return map[status] || map.pending;
  };

  const filteredBookings = bookings.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'completed') return b.status === 'completed';
    if (filter === 'confirmed') return b.status === 'confirmed';
    if (filter === 'cancelled') return b.status.includes('cancelled');
    return true;
  });

  const renderBookingItem = ({ item }) => {
    const statusInfo = getStatusInfo(item.status);
    return (
      <Animatable.View animation="fadeInUp" duration={600}>
        <TouchableOpacity
          style={[styles.bookingCard, { backgroundColor: themeColors.surface }]}
          onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
          activeOpacity={0.7}
        >
          <View style={styles.bookingHeader}>
            <View style={styles.bookingInfo}>
              <Text style={[styles.bookingType, { color: themeColors.text }]}>
                {item.massageType}
              </Text>
              <View style={styles.bookingMeta}>
                <Text style={[styles.bookingTherapist, { color: themeColors.textSecondary }]}>
                  {item.therapist?.name}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.bookingPrice, { color: colors.primary }]}>
              {item.finalPrice?.toLocaleString()} Ar
            </Text>
          </View>
          
          <View style={styles.bookingFooter}>
            <View style={styles.bookingDate}>
              <Ionicons name="calendar-outline" size={14} color={themeColors.textSecondary} />
              <Text style={[styles.bookingDateText, { color: themeColors.textSecondary }]}>
                {new Date(item.date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.bookingDuration}>
              <Ionicons name="time-outline" size={14} color={themeColors.textSecondary} />
              <Text style={[styles.bookingDurationText, { color: themeColors.textSecondary }]}>
                {item.duration} min
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Historique" showBack />

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.filterButton,
                filter === f.id && styles.filterButtonActive,
                { backgroundColor: themeColors.surface }
              ]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[
                styles.filterText,
                filter === f.id && styles.filterTextActive,
                { color: filter === f.id ? '#fff' : themeColors.text }
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Liste */}
      <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Chargement de l'historique...
            </Text>
          </View>
        ) : filteredBookings.length > 0 ? (
          <FlatList
            data={filteredBookings}
            renderItem={renderBookingItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={themeColors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: themeColors.text }]}>
              Aucun historique
            </Text>
            <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
              Vous n'avez pas encore de réservations
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => navigation.navigate('Booking')}
            >
              <Text style={styles.emptyStateButtonText}>Réserver maintenant</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filtersContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  filterTextActive: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  bookingCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookingInfo: {
    flex: 1,
  },
  bookingType: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  bookingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  bookingTherapist: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
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
  bookingPrice: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  bookingDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingDateText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  bookingDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingDurationText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyStateButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
});

export default HistoryScreen;