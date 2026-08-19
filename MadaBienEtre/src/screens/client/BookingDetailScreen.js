// src/screens/client/BookingDetailScreen.js
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
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import SOSButton from '../../components/sos/SOSButton';
import axios from 'axios';
import { API_URL } from '../../config';

const BookingDetailScreen = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBooking(response.data);
      setStatus(response.data.status);
    } catch (error) {
      console.error('Error loading booking:', error);
      // Données mockées pour le développement
      setBooking({
        id: bookingId,
        massageType: 'Massage Relaxant',
        duration: 60,
        address: 'Lot III A 78, Antananarivo',
        date: '2026-07-15T14:30:00',
        status: 'confirmed',
        clientPriceProposed: 80000,
        finalPrice: 75000,
        therapist: {
          id: 1,
          name: 'Sarah B.',
          rating: 4.8,
          reviews: 32,
          phone: '+261 34 12 345 67',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    const map = {
      pending: {
        label: 'En attente',
        color: '#FFA726',
        icon: 'time-outline',
        bg: '#FFF3E0',
      },
      negotiating: {
        label: 'Négociation',
        color: '#2196F3',
        icon: 'chatbubble-outline',
        bg: '#E3F2FD',
      },
      confirmed: {
        label: 'Confirmée',
        color: '#4CAF50',
        icon: 'checkmark-circle-outline',
        bg: '#E8F5E9',
      },
      in_progress: {
        label: 'En cours',
        color: '#FF9800',
        icon: 'sync-outline',
        bg: '#FFF3E0',
      },
      completed: {
        label: 'Terminée',
        color: '#2E7D32',
        icon: 'checkmark-done-outline',
        bg: '#E8F5E9',
      },
      cancelled_by_client: {
        label: 'Annulée',
        color: '#D32F2F',
        icon: 'close-circle-outline',
        bg: '#FFEBEE',
      },
      cancelled_by_therapist: {
        label: 'Annulée par le thérapeute',
        color: '#D32F2F',
        icon: 'close-circle-outline',
        bg: '#FFEBEE',
      },
    };
    return map[status] || map.pending;
  };

  const handleCancel = () => {
    Alert.alert(
      'Annuler la réservation',
      'Êtes-vous sûr de vouloir annuler cette réservation ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.put(
                `${API_URL}/bookings/cancel/${bookingId}`,
                { reason: 'Annulé par le client' },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('✅ Réservation annulée');
              loadBookingDetails();
            } catch (error) {
              Alert.alert('Erreur', "Impossible d'annuler la réservation");
            }
          },
        },
      ]
    );
  };

  const handleContactTherapist = () => {
    navigation.navigate('Chat', {
      bookingId: bookingId,
      therapistId: booking?.therapist?.id,
      therapistName: booking?.therapist?.name,
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement...
        </Text>
      </View>
    );
  }

  const statusInfo = getStatusInfo(status);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Détails de la réservation" showBack />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Statut */}
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={[styles.statusCard, { backgroundColor: statusInfo.bg }]}>
            <View style={styles.statusContent}>
              <Ionicons name={statusInfo.icon} size={32} color={statusInfo.color} />
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
                <Text style={[styles.statusId, { color: themeColors.textSecondary }]}>
                  #ID: {booking?.id}
                </Text>
              </View>
            </View>
            {status === 'pending' || status === 'negotiating' && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animatable.View>

        {/* Info massage */}
        <Animatable.View animation="fadeInUp" delay={200} duration={600}>
          <View style={[styles.infoCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>
              Détails du massage
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="spa-outline" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: themeColors.text }]}>
                {booking?.massageType}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: themeColors.text }]}>
                {booking?.duration} minutes
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: themeColors.text }]}>
                {booking?.address}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: themeColors.text }]}>
                {new Date(booking?.date).toLocaleString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </Animatable.View>

        {/* Prix */}
        <Animatable.View animation="fadeInUp" delay={400} duration={600}>
          <View style={[styles.infoCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>
              Informations financières
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: themeColors.textSecondary }]}>
                Prix proposé
              </Text>
              <Text style={[styles.priceValue, { color: themeColors.text }]}>
                {booking?.clientPriceProposed?.toLocaleString()} Ar
              </Text>
            </View>
            {booking?.finalPrice && (
              <View style={[styles.priceRow, styles.finalPriceRow]}>
                <Text style={[styles.priceLabel, { color: colors.primary }]}>
                  Prix final
                </Text>
                <Text style={[styles.priceValue, styles.finalPriceValue]}>
                  {booking?.finalPrice?.toLocaleString()} Ar
                </Text>
              </View>
            )}
          </View>
        </Animatable.View>

        {/* Thérapeute */}
        {booking?.therapist && (
          <Animatable.View animation="fadeInUp" delay={600} duration={600}>
            <View style={[styles.infoCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.cardTitle, { color: themeColors.text }]}>
                Thérapeute
              </Text>
              <View style={styles.therapistInfo}>
                <View style={styles.therapistAvatar}>
                  <Text style={styles.therapistAvatarText}>
                    {booking.therapist.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.therapistDetails}>
                  <Text style={[styles.therapistName, { color: themeColors.text }]}>
                    {booking.therapist.name}
                  </Text>
                  <View style={styles.therapistRating}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.ratingText}>{booking.therapist.rating}</Text>
                    <Text style={styles.reviewsText}>({booking.therapist.reviews} avis)</Text>
                  </View>
                </View>
              </View>
              <View style={styles.therapistActions}>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={handleContactTherapist}
                >
                  <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                  <Text style={styles.contactButtonText}>Contacter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.phoneButton}
                  onPress={() => Linking.openURL(`tel:${booking.therapist.phone}`)}
                >
                  <Ionicons name="call-outline" size={20} color="#fff" />
                  <Text style={styles.phoneButtonText}>Appeler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animatable.View>
        )}

        {/* Actions */}
        <Animatable.View animation="fadeInUp" delay={800} duration={600}>
          <View style={styles.actionsContainer}>
            {status === 'confirmed' || status === 'in_progress' ? (
              <>
                <TouchableOpacity
                  style={styles.trackingButton}
                  onPress={() => navigation.navigate('Tracking', { bookingId })}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primaryLight]}
                    style={styles.trackingGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="location-outline" size={20} color="#fff" />
                    <Text style={styles.trackingButtonText}>Suivre en temps réel</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {status !== 'completed' && status !== 'cancelled_by_client' && status !== 'cancelled_by_therapist' && (
                  <View style={styles.sosContainer}>
                    <SOSButton bookingId={bookingId} />
                  </View>
                )}
              </>
            ) : status === 'completed' ? (
              <TouchableOpacity
                style={styles.ratingButton}
                onPress={() => navigation.navigate('Rating', { bookingId })}
              >
                <LinearGradient
                  colors={['#FF6F00', '#FFA726']}
                  style={styles.ratingGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="star-outline" size={20} color="#fff" />
                  <Text style={styles.ratingButtonText}>Évaluer le massage</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : status === 'pending' || status === 'negotiating' ? (
              <TouchableOpacity
                style={styles.offersButton}
                onPress={() => navigation.navigate('Offers', { bookingId })}
              >
                <LinearGradient
                  colors={['#FF6F00', '#FFA726']}
                  style={styles.offersGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="pricetag-outline" size={20} color="#fff" />
                  <Text style={styles.offersButtonText}>Voir les offres</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animatable.View>

        {/* Timeline */}
        <Animatable.View animation="fadeInUp" delay={1000} duration={600}>
          <View style={[styles.timelineCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>
              Progression
            </Text>
            <View style={styles.timeline}>
              {['pending', 'confirmed', 'in_progress', 'completed'].map((step, index) => {
                const isActive = getStepIndex(status) >= index;
                const isLast = index === 3;
                return (
                  <View key={step} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[
                        styles.timelineDot,
                        isActive && styles.timelineDotActive,
                        { backgroundColor: isActive ? colors.primary : '#E0E0E0' }
                      ]}>
                        {isActive && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                      {!isLast && (
                        <View style={[
                          styles.timelineLine,
                          { backgroundColor: isActive ? colors.primary : '#E0E0E0' }
                        ]} />
                      )}
                    </View>
                    <View style={styles.timelineRight}>
                      <Text style={[
                        styles.timelineLabel,
                        isActive && styles.timelineLabelActive,
                        { color: isActive ? colors.primary : themeColors.textSecondary }
                      ]}>
                        {getStepLabel(step)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Animatable.View>
      </Animated.ScrollView>
    </View>
  );
};

const getStepIndex = (status) => {
  const steps = ['pending', 'confirmed', 'in_progress', 'completed'];
  const index = steps.indexOf(status);
  return index === -1 ? 0 : index;
};

const getStepLabel = (step) => {
  const map = {
    pending: 'Demande créée',
    confirmed: 'Réservation confirmée',
    in_progress: 'Massage en cours',
    completed: 'Massage terminé',
  };
  return map[step] || step;
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
    paddingHorizontal: spacing.md,
  },
  statusCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  statusId: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  cancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.error + '20',
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  infoCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  infoText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  priceLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  priceValue: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  finalPriceRow: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: spacing.xs,
  },
  finalPriceValue: {
    color: colors.primary,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  therapistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  therapistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  therapistAvatarText: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  therapistDetails: {
    flex: 1,
  },
  therapistName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  therapistRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.text,
  },
  reviewsText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  therapistActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  contactButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  phoneButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: spacing.xs,
  },
  phoneButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  actionsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  trackingButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  trackingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  trackingButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  sosContainer: {
    alignItems: 'center',
  },
  ratingButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  ratingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  ratingButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  offersButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  offersGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  offersButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  timelineCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  timeline: {
    marginTop: spacing.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 2,
  },
  timelineRight: {
    flex: 1,
    justifyContent: 'center',
  },
  timelineLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  timelineLabelActive: {
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default BookingDetailScreen;