// src/screens/therapist/CalendarScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import axios from 'axios';
import { API_URL } from '../../config';

LocaleConfig.locales.fr = {
  monthNames: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  monthNamesShort: ['Janv.','Févr.','Mars','Avril','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'],
  dayNames: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
  dayNamesShort: ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'],
};
LocaleConfig.defaultLocale = 'fr';

const CalendarScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [selectedBookings, setSelectedBookings] = useState([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadBookings();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: 'confirmed,in_progress,completed' },
      });
      setBookings(response.data);
      updateMarkedDates(response.data);
    } catch (error) {
      console.error('Error loading bookings:', error);
      // Données mockées
      const mockBookings = [
        { id: 1, date: '2026-07-15', time: '10:00', client: 'Marie L.', massage: 'Massage Relaxant', status: 'confirmed' },
        { id: 2, date: '2026-07-15', time: '14:30', client: 'Jean R.', massage: 'Massage Thérapeutique', status: 'confirmed' },
        { id: 3, date: '2026-07-16', time: '09:00', client: 'Sarah M.', massage: 'Massage Sportif', status: 'in_progress' },
        { id: 4, date: '2026-07-17', time: '11:00', client: 'Pierre D.', massage: 'Massage Relaxant', status: 'completed' },
      ];
      setBookings(mockBookings);
      updateMarkedDates(mockBookings);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMarkedDates = (bookingsData) => {
    const marked = {};
    bookingsData.forEach((booking) => {
      const date = booking.date || booking.scheduled_date?.split('T')[0];
      if (date) {
        if (!marked[date]) {
          marked[date] = { dots: [], selected: false };
        }
        const statusColors = {
          confirmed: '#4CAF50',
          in_progress: '#FF9800',
          completed: '#2E7D32',
        };
        marked[date].dots.push({
          color: statusColors[booking.status] || '#2196F3',
          key: booking.id,
        });
      }
    });
    // Limiter à 3 dots max
    Object.keys(marked).forEach((date) => {
      if (marked[date].dots.length > 3) {
        marked[date].dots = marked[date].dots.slice(0, 3);
      }
    });
    setMarkedDates(marked);
  };

  const onDayPress = (day) => {
    setSelectedDate(day.dateString);
    const dayBookings = bookings.filter(
      (b) => (b.date || b.scheduled_date?.split('T')[0]) === day.dateString
    );
    setSelectedBookings(dayBookings);
    
    // Mettre à jour les dates marquées
    const updated = { ...markedDates };
    Object.keys(updated).forEach((date) => {
      updated[date].selected = date === day.dateString;
      if (date === day.dateString) {
        updated[date].selectedColor = colors.primary;
      }
    });
    setMarkedDates(updated);
  };

  const getStatusColor = (status) => {
    const colorsMap = {
      pending: '#FFA726',
      confirmed: '#4CAF50',
      in_progress: '#FF9800',
      completed: '#2E7D32',
      cancelled: '#D32F2F',
    };
    return colorsMap[status] || '#999';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'En attente',
      confirmed: 'Confirmée',
      in_progress: 'En cours',
      completed: 'Terminée',
      cancelled: 'Annulée',
    };
    return labels[status] || status;
  };

  const formatTime = (time) => {
    if (!time) return '';
    return time.slice(0, 5);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement du calendrier...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Calendrier" showBack />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Calendrier */}
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={[styles.calendarCard, { backgroundColor: themeColors.surface }]}>
            <Calendar
              onDayPress={onDayPress}
              markedDates={markedDates}
              theme={{
                backgroundColor: themeColors.surface,
                calendarBackground: themeColors.surface,
                textSectionTitleColor: themeColors.textSecondary,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#fff',
                todayTextColor: colors.primary,
                dayTextColor: themeColors.text,
                textDisabledColor: themeColors.textSecondary,
                dotColor: colors.primary,
                selectedDotColor: '#fff',
                arrowColor: colors.primary,
                monthTextColor: themeColors.text,
                textDayFontFamily: typography.fontFamily.regular,
                textMonthFontFamily: typography.fontFamily.bold,
                textDayHeaderFontFamily: typography.fontFamily.medium,
                textDayFontSize: 14,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 12,
              }}
              markingType={'multi-dot'}
              enableSwipeMonths
            />
          </View>
        </Animatable.View>

        {/* Réservations du jour */}
        {selectedDate && (
          <Animatable.View animation="fadeInUp" delay={200} duration={600}>
            <View style={[styles.bookingsCard, { backgroundColor: themeColors.surface }]}>
              <View style={styles.bookingsHeader}>
                <Text style={[styles.bookingsTitle, { color: themeColors.text }]}>
                  Réservations du {new Date(selectedDate).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={[styles.bookingsCount, { color: themeColors.textSecondary }]}>
                  {selectedBookings.length} réservation(s)
                </Text>
              </View>

              {selectedBookings.length > 0 ? (
                selectedBookings.map((booking) => (
                  <TouchableOpacity
                    key={booking.id}
                    style={[styles.bookingItem, { borderBottomColor: themeColors.border }]}
                    onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
                  >
                    <View style={styles.bookingTime}>
                      <Text style={[styles.bookingTimeText, { color: themeColors.text }]}>
                        {formatTime(booking.time || booking.scheduled_date)}
                      </Text>
                    </View>
                    <View style={styles.bookingInfo}>
                      <Text style={[styles.bookingClient, { color: themeColors.text }]}>
                        {booking.client?.fullname || booking.client}
                      </Text>
                      <Text style={[styles.bookingMassage, { color: themeColors.textSecondary }]}>
                        {booking.massage_type || booking.massage}
                      </Text>
                    </View>
                    <View style={[styles.bookingStatus, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                      <Text style={[styles.bookingStatusText, { color: getStatusColor(booking.status) }]}>
                        {getStatusLabel(booking.status)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color={themeColors.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                    Aucune réservation ce jour
                  </Text>
                </View>
              )}
            </View>
          </Animatable.View>
        )}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  calendarCard: {
    borderRadius: 16,
    padding: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingsCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bookingsTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  bookingsCount: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  bookingTime: {
    width: 60,
  },
  bookingTimeText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingClient: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  bookingMassage: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  bookingStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bookingStatusText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyStateText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.sm,
  },
});

export default CalendarScreen;