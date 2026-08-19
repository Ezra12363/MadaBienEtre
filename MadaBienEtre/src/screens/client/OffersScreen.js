// src/screens/client/OffersScreen.js
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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import axios from 'axios';
import { API_URL } from '../../config';

const OffersScreen = ({ navigation, route }) => {
  const { bookingId } = route?.params || {};
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  const [offers, setOffers] = useState([]);
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, [bookingId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Charger les offres
      const offersResponse = await axios.get(`${API_URL}/offers/booking/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOffers(offersResponse.data);

      // Charger les détails de la réservation
      const bookingResponse = await axios.get(`${API_URL}/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBooking(bookingResponse.data);
    } catch (error) {
      console.error('Error loading offers:', error);
      // Données mockées
      setOffers([
        {
          id: 1,
          therapistName: 'Sarah B.',
          rating: 4.8,
          reviews: 32,
          experience: 'Confirmée',
          distance: 1.2,
          price: 75000,
          status: 'pending',
          message: 'Je serai disponible à 14h30',
        },
        {
          id: 2,
          therapistName: 'Jean R.',
          rating: 4.9,
          reviews: 45,
          experience: 'Expert',
          distance: 2.5,
          price: 80000,
          status: 'pending',
          message: 'Je propose 80 000 Ar pour un massage de qualité',
        },
        {
          id: 3,
          therapistName: 'Marie L.',
          rating: 4.7,
          reviews: 28,
          experience: 'Confirmée',
          distance: 0.8,
          price: 70000,
          status: 'pending',
          message: 'Disponible immédiatement',
        },
      ]);
      setBooking({
        id: bookingId,
        massageType: 'Massage Relaxant',
        duration: 60,
        clientPriceProposed: 80000,
        address: 'Lot III A 78, Antananarivo',
        date: '2026-07-15T14:30:00',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (offer) => {
    Alert.alert(
      'Accepter l\'offre',
      `Acceptez-vous l'offre de ${offer.therapistName} à ${offer.price.toLocaleString()} Ar ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            try {
              await axios.post(
                `${API_URL}/offers/${offer.id}/accept`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('✅ Offre acceptée', 'La réservation est confirmée !');
              navigation.navigate('BookingDetail', { bookingId });
            } catch (error) {
              Alert.alert('Erreur', 'Impossible d\'accepter l\'offre');
            }
          },
        },
      ]
    );
  };

  const handleCounter = (offer) => {
    navigation.navigate('Negotiation', {
      offerId: offer.id,
      bookingId: bookingId,
      currentPrice: offer.price,
      therapistName: offer.therapistName,
    });
  };

  const handleReject = async (offer) => {
    Alert.alert(
      'Refuser l\'offre',
      `Voulez-vous vraiment refuser l'offre de ${offer.therapistName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.post(
                `${API_URL}/offers/${offer.id}/reject`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('✅ Offre refusée');
              loadData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de refuser l\'offre');
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Chargement des offres...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Offres reçues" showBack />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Détails de la demande */}
        {booking && (
          <Animatable.View animation="fadeInDown" duration={600}>
            <View style={[styles.bookingSummary, { backgroundColor: themeColors.surface }]}>
              <View style={styles.bookingSummaryHeader}>
                <Text style={[styles.bookingSummaryTitle, { color: themeColors.text }]}>
                  Votre demande
                </Text>
                <View style={styles.bookingSummaryPrice}>
                  <Text style={styles.bookingSummaryPriceLabel}>Prix initial</Text>
                  <Text style={styles.bookingSummaryPriceValue}>
                    {booking.clientPriceProposed.toLocaleString()} Ar
                  </Text>
                </View>
              </View>
              <View style={styles.bookingSummaryDetails}>
                <Text style={[styles.bookingSummaryText, { color: themeColors.text }]}>
                  {booking.massageType} • {booking.duration} min
                </Text>
                <Text style={[styles.bookingSummaryText, { color: themeColors.textSecondary }]}>
                  📍 {booking.address}
                </Text>
              </View>
            </View>
          </Animatable.View>
        )}

        {/* Liste des offres */}
        <View style={styles.offersList}>
          <Text style={[styles.offersTitle, { color: themeColors.text }]}>
            {offers.length} offre(s) reçue(s)
          </Text>

          {offers.map((offer, index) => (
            <Animatable.View
              key={offer.id}
              animation="fadeInUp"
              delay={200 * (index + 1)}
              duration={600}
            >
              <View style={[styles.offerCard, { backgroundColor: themeColors.surface }]}>
                <View style={styles.offerHeader}>
                  <View style={styles.therapistInfo}>
                    <View style={styles.therapistAvatar}>
                      <Text style={styles.therapistAvatarText}>
                        {offer.therapistName.charAt(0)}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.therapistName, { color: themeColors.text }]}>
                        {offer.therapistName}
                      </Text>
                      <View style={styles.therapistRating}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <Text style={styles.ratingText}>{offer.rating}</Text>
                        <Text style={styles.reviewsText}>({offer.reviews} avis)</Text>
                        <View style={styles.experienceBadge}>
                          <Text style={styles.experienceBadgeText}>{offer.experience}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.distanceBadge}>
                    <Ionicons name="location-outline" size={14} color={colors.primary} />
                    <Text style={styles.distanceText}>{offer.distance} km</Text>
                  </View>
                </View>

                <View style={styles.offerPriceContainer}>
                  <Text style={[styles.offerPrice, { color: colors.primary }]}>
                    {offer.price.toLocaleString()} Ar
                  </Text>
                  {booking && (
                    <Text style={[styles.offerPriceComparison, { color: themeColors.textSecondary }]}>
                      vs {booking.clientPriceProposed.toLocaleString()} Ar
                    </Text>
                  )}
                </View>

                {offer.message && (
                  <Text style={[styles.offerMessage, { color: themeColors.textSecondary }]}>
                    "{offer.message}"
                  </Text>
                )}

                <View style={styles.offerActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(offer)}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.primaryLight]}
                      style={styles.acceptGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.acceptButtonText}>Accepter</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => handleCounter(offer)}
                  >
                    <Text style={styles.counterButtonText}>Contre-proposer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleReject(offer)}
                  >
                    <Ionicons name="close-outline" size={24} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </Animatable.View>
          ))}

          {offers.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={64} color={themeColors.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: themeColors.text }]}>
                Aucune offre pour le moment
              </Text>
              <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                Les thérapeutes à proximité vont bientôt vous répondre
              </Text>
            </View>
          )}
        </View>
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
    paddingHorizontal: spacing.md,
  },
  bookingSummary: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bookingSummaryTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  bookingSummaryPrice: {
    alignItems: 'flex-end',
  },
  bookingSummaryPriceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  bookingSummaryPriceValue: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  bookingSummaryDetails: {
    gap: 2,
  },
  bookingSummaryText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  offersList: {
    paddingBottom: spacing.xl,
  },
  offersTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.md,
  },
  offerCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  therapistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  therapistAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  therapistAvatarText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
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
  experienceBadge: {
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  experienceBadgeText: {
    fontSize: 8,
    color: colors.primary,
    fontFamily: typography.fontFamily.medium,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontFamily: typography.fontFamily.medium,
  },
  offerPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  offerPrice: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
  },
  offerPriceComparison: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  offerMessage: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  offerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  acceptGradient: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
  counterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  counterButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  rejectButton: {
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxl,
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
});

export default OffersScreen;