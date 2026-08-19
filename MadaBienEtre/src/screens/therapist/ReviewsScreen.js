// src/screens/therapist/ReviewsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import axios from 'axios';
import { API_URL } from '../../config';

const ReviewsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    average: 0,
    total: 0,
    distribution: {},
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseText, setResponseText] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadReviews();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReviews(response.data);
      calculateStats(response.data);
    } catch (error) {
      console.error('Error loading reviews:', error);
      // Données mockées
      const mockReviews = [
        {
          id: 1,
          rating: 5,
          comment: 'Excellent massage, je me sens relaxé ! Sarah est très professionnelle.',
          reviewer: { fullname: 'Marie L.' },
          created_at: '2026-07-15T10:00:00',
          response_from_therapist: null,
        },
        {
          id: 2,
          rating: 4,
          comment: 'Très bon massage, un peu cher mais qualité au rendez-vous.',
          reviewer: { fullname: 'Jean R.' },
          created_at: '2026-07-14T14:30:00',
          response_from_therapist: 'Merci Jean pour votre retour !',
        },
        {
          id: 3,
          rating: 5,
          comment: 'Incroyable ! Je recommande vivement Sarah.',
          reviewer: { fullname: 'Sarah M.' },
          created_at: '2026-07-13T09:00:00',
          response_from_therapist: null,
        },
        {
          id: 4,
          rating: 4,
          comment: 'Massage relaxant parfait pour se détendre.',
          reviewer: { fullname: 'Pierre D.' },
          created_at: '2026-07-12T11:00:00',
          response_from_therapist: null,
        },
      ];
      setReviews(mockReviews);
      calculateStats(mockReviews);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (reviewsData) => {
    const total = reviewsData.length;
    if (total === 0) {
      setStats({ average: 0, total: 0, distribution: {} });
      return;
    }
    const sum = reviewsData.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / total;
    const distribution = {};
    for (let i = 1; i <= 5; i++) {
      distribution[i] = reviewsData.filter((r) => r.rating === i).length;
    }
    setStats({ average, total, distribution });
  };

  const handleRespond = async (reviewId) => {
    if (!responseText.trim()) {
      Alert.alert('Erreur', 'Veuillez écrire une réponse');
      return;
    }

    try {
      await axios.put(
        `${API_URL}/reviews/${reviewId}/respond`,
        { response: responseText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert('✅ Réponse ajoutée', 'Votre réponse a été publiée');
      setRespondingTo(null);
      setResponseText('');
      loadReviews();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ajouter la réponse');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating) => {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Mes avis" showBack />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Statistiques */}
        <Animatable.View animation="fadeInDown" duration={600}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            style={styles.statsCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.average.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Note moyenne</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total avis</Text>
              </View>
            </View>
            <View style={styles.distributionContainer}>
              {[5, 4, 3, 2, 1].map((rating) => (
                <View key={rating} style={styles.distributionRow}>
                  <Text style={styles.distributionLabel}>{rating}⭐</Text>
                  <View style={styles.distributionBar}>
                    <View
                      style={[
                        styles.distributionFill,
                        {
                          width: `${stats.total > 0 ? (stats.distribution[rating] || 0) / stats.total * 100 : 0}%`,
                          backgroundColor: rating >= 4 ? colors.success : rating >= 3 ? colors.warning : colors.error,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.distributionCount}>{stats.distribution[rating] || 0}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Animatable.View>

        {/* Liste des avis */}
        <Animatable.View animation="fadeInUp" delay={200} duration={600}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Tous les avis
          </Text>

          {reviews.length > 0 ? (
            reviews.map((review, index) => (
              <View
                key={review.id}
                style={[styles.reviewCard, { backgroundColor: themeColors.surface }]}
              >
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={styles.reviewerAvatar}>
                      <Text style={styles.reviewerAvatarText}>
                        {review.reviewer?.fullname?.charAt(0) || 'C'}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.reviewerName, { color: themeColors.text }]}>
                        {review.reviewer?.fullname || 'Client'}
                      </Text>
                      <Text style={[styles.reviewDate, { color: themeColors.textSecondary }]}>
                        {formatDate(review.created_at)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reviewRating}>{renderStars(review.rating)}</Text>
                </View>

                <Text style={[styles.reviewComment, { color: themeColors.text }]}>
                  {review.comment}
                </Text>

                {review.response_from_therapist ? (
                  <View style={[styles.responseContainer, { backgroundColor: colors.primary + '10' }]}>
                    <Text style={[styles.responseLabel, { color: colors.primary }]}>
                      Votre réponse :
                    </Text>
                    <Text style={[styles.responseText, { color: themeColors.text }]}>
                      {review.response_from_therapist}
                    </Text>
                  </View>
                ) : (
                  respondingTo === review.id ? (
                    <View style={styles.responseInputContainer}>
                      <TextInput
                        style={[styles.responseInput, { 
                          color: themeColors.text,
                          borderColor: '#E0E0E0',
                        }]}
                        placeholder="Écrire une réponse..."
                        placeholderTextColor={themeColors.textSecondary}
                        value={responseText}
                        onChangeText={setResponseText}
                        multiline
                      />
                      <View style={styles.responseActions}>
                        <TouchableOpacity
                          style={styles.responseCancel}
                          onPress={() => {
                            setRespondingTo(null);
                            setResponseText('');
                          }}
                        >
                          <Text style={styles.responseCancelText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.responseSubmit}
                          onPress={() => handleRespond(review.id)}
                        >
                          <Text style={styles.responseSubmitText}>Publier</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.respondButton}
                      onPress={() => setRespondingTo(review.id)}
                    >
                      <Text style={styles.respondButtonText}>Répondre</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={64} color={themeColors.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: themeColors.text }]}>
                Aucun avis
              </Text>
              <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
                Les avis de vos clients apparaîtront ici
              </Text>
            </View>
          )}
        </Animatable.View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  statsCard: {
    borderRadius: 20,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: typography.fontSize.xxxl,
    fontFamily: typography.fontFamily.bold,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  distributionContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  distributionLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    width: 40,
  },
  distributionBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distributionFill: {
    height: '100%',
    borderRadius: 3,
  },
  distributionCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    width: 30,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  reviewCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  reviewerName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },
  reviewDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  reviewRating: {
    fontSize: typography.fontSize.md,
  },
  reviewComment: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  responseContainer: {
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.xs,
  },
  responseLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 2,
  },
  responseText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
  respondButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
  },
  respondButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  responseInputContainer: {
    marginTop: spacing.sm,
  },
  responseInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    minHeight: 60,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    textAlignVertical: 'top',
  },
  responseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  responseCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  responseCancelText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  responseSubmit: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  responseSubmitText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  emptyState: {
    alignItems: 'center',
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
});

export default ReviewsScreen;