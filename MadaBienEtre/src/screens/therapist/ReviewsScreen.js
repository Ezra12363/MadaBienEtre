// src/screens/therapist/ReviewsScreen.js

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  Animated,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import axios from 'axios';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import { API_URL } from '../../config';

const PRIMARY_COLOR = colors.primary || '#168A55';
const PRIMARY_LIGHT = colors.primaryLight || '#39B878';

const getReviewerName = (review) => {
  const reviewer = review?.reviewer || review?.client || review?.user;

  return (
    reviewer?.fullname ||
    reviewer?.full_name ||
    reviewer?.name ||
    reviewer?.username ||
    `${reviewer?.first_name || ''} ${reviewer?.last_name || ''}`.trim() ||
    review?.reviewer_name ||
    review?.client_name ||
    review?.client_fullname ||
    'Client'
  );
};

const getReviewerPhoto = (review) => {
  const reviewer = review?.reviewer || review?.client || review?.user;

  const photo =
    reviewer?.profile_image ||
    reviewer?.profileImage ||
    reviewer?.profile_photo ||
    reviewer?.profilePhoto ||
    reviewer?.avatar ||
    reviewer?.avatar_url ||
    reviewer?.avatarUrl ||
    reviewer?.photo ||
    reviewer?.photo_url ||
    reviewer?.photoUrl ||
    reviewer?.image ||
    reviewer?.image_url ||
    reviewer?.imageUrl ||
    review?.client_profile_image ||
    review?.client_avatar ||
    review?.client_photo ||
    review?.profile_image ||
    review?.avatar;

  if (!photo || typeof photo !== 'string') {
    return null;
  }

  return photo;
};

const getReviewerId = (review) => {
  const reviewer = review?.reviewer || review?.client || review?.user;

  return (
    reviewer?.id ||
    reviewer?.user_id ||
    review?.reviewer_id ||
    review?.client_id ||
    review?.user_id ||
    null
  );
};

const getRating = (review) => {
  const rating = Number(
    review?.rating ??
      review?.note ??
      review?.stars ??
      0
  );

  return Math.max(0, Math.min(5, Math.round(rating)));
};

const getComment = (review) => {
  return (
    review?.comment ||
    review?.content ||
    review?.message ||
    review?.review ||
    'Aucun commentaire'
  );
};

const getResponse = (review) => {
  return (
    review?.response_from_therapist ||
    review?.therapist_response ||
    review?.response ||
    review?.reply ||
    null
  );
};

const getReviewDate = (review) => {
  return (
    review?.created_at ||
    review?.createdAt ||
    review?.date ||
    review?.updated_at ||
    null
  );
};

const normalizeReviews = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.reviews)) {
    return data.reviews;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const ReviewsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    average: 0,
    total: 0,
    distribution: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonAnimations = useRef({}).current;

  const getButtonAnimation = (reviewId) => {
    if (!buttonAnimations[reviewId]) {
      buttonAnimations[reviewId] = new Animated.Value(1);
    }

    return buttonAnimations[reviewId];
  };

  const calculateStats = useCallback((reviewsData) => {
    const total = reviewsData.length;

    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    if (total === 0) {
      setStats({
        average: 0,
        total: 0,
        distribution,
      });

      return;
    }

    let sum = 0;

    reviewsData.forEach((review) => {
      const rating = getRating(review);

      if (rating >= 1 && rating <= 5) {
        distribution[rating] += 1;
        sum += rating;
      }
    });

    setStats({
      average: sum / total,
      total,
      distribution,
    });
  }, []);

  const loadReviews = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/reviews`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const reviewsData = normalizeReviews(response.data);

      setReviews(reviewsData);
      calculateStats(reviewsData);
    } catch (error) {
      console.error(
        'Erreur lors du chargement des avis :',
        error?.response?.data || error?.message
      );

      /*
       * Aucun avis fictif n'est ajouté.
       * L'écran affiche un état vide si l'API ne répond pas.
       */
      setReviews([]);
      calculateStats([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start();
    }
  }, [token, calculateStats, fadeAnim]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleRespond = async (reviewId) => {
    const text = responseText.trim();

    if (!text) {
      Alert.alert(
        'Réponse vide',
        'Veuillez écrire une réponse avant de publier.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await axios.put(
        `${API_URL}/reviews/${reviewId}/respond`,
        {
          response: text,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      Alert.alert(
        'Réponse publiée',
        'Votre réponse a été ajoutée avec succès.'
      );

      setRespondingTo(null);
      setResponseText('');

      await loadReviews();
    } catch (error) {
      console.error(
        'Erreur lors de la réponse à l’avis :',
        error?.response?.data || error?.message
      );

      Alert.alert(
        'Erreur',
        'Impossible d’ajouter votre réponse pour le moment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenResponse = (reviewId) => {
    const animation = getButtonAnimation(reviewId);

    Animated.sequence([
      Animated.timing(animation, {
        toValue: 0.85,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(animation, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    setRespondingTo(reviewId);
    setResponseText('');
  };

  const handleCancelResponse = () => {
    setRespondingTo(null);
    setResponseText('');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
  };

  const formatDate = (date) => {
    if (!date) {
      return 'Date inconnue';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Date inconnue';
    }

    return parsedDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating) => {
    const safeRating = getRating({ rating });

    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= safeRating ? 'star' : 'star-outline'}
            size={17}
            color={
              star <= safeRating
                ? '#F59E0B'
                : isDark
                  ? '#6B7280'
                  : '#CBD5E1'
            }
            style={styles.starIcon}
          />
        ))}
      </View>
    );
  };

  const renderReviewerAvatar = (review) => {
    const reviewerName = getReviewerName(review);
    const reviewerPhoto = getReviewerPhoto(review);

    return (
      <View
        style={[
          styles.reviewerAvatarFrame,
          {
            backgroundColor: isDark
              ? '#26352E'
              : '#E8F5EE',
            borderColor: PRIMARY_COLOR,
          },
        ]}
      >
        {reviewerPhoto ? (
          <Image
            source={{ uri: reviewerPhoto }}
            style={styles.reviewerAvatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[
              styles.reviewerAvatarText,
              {
                color: PRIMARY_COLOR,
              },
            ]}
          >
            {reviewerName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
    );
  };

  const renderReviewCard = (review, index) => {
    const reviewId = review?.id || review?.review_id || index;
    const reviewerName = getReviewerName(review);
    const reviewerId = getReviewerId(review);
    const rating = getRating(review);
    const comment = getComment(review);
    const response = getResponse(review);
    const reviewDate = getReviewDate(review);
    const buttonAnimation = getButtonAnimation(reviewId);

    return (
      <Animatable.View
        key={String(reviewId)}
        animation="fadeInUp"
        delay={index * 70}
        duration={450}
        useNativeDriver
      >
        <View
          style={[
            styles.reviewCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: isDark
                ? '#303A34'
                : '#E7EEE9',
            },
          ]}
        >
          {/* En-tête de l'avis */}
          <View style={styles.reviewHeader}>
            <View style={styles.reviewerInfo}>
              {renderReviewerAvatar(review)}

              <View style={styles.reviewerDetails}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.reviewerName,
                    {
                      color: themeColors.text,
                    },
                  ]}
                >
                  {reviewerName}
                </Text>

                <View style={styles.reviewMeta}>
                  <Ionicons
                    name="calendar-outline"
                    size={12}
                    color={themeColors.textSecondary}
                  />

                  <Text
                    style={[
                      styles.reviewDate,
                      {
                        color: themeColors.textSecondary,
                      },
                    ]}
                  >
                    {formatDate(reviewDate)}
                  </Text>

                  {reviewerId && (
                    <View
                      style={[
                        styles.clientBadge,
                        {
                          backgroundColor: isDark
                            ? '#26352E'
                            : '#F0F8F3',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.clientBadgeText,
                          {
                            color: PRIMARY_COLOR,
                          },
                        ]}
                      >
                        Client
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {renderStars(rating)}
          </View>

          {/* Commentaire */}
          <Text
            style={[
              styles.reviewComment,
              {
                color: themeColors.text,
              },
            ]}
          >
            {comment}
          </Text>

          {/* Réponse déjà publiée */}
          {response ? (
            <View
              style={[
                styles.responseContainer,
                {
                  backgroundColor: isDark
                    ? '#1F3529'
                    : '#EFFAF3',
                  borderLeftColor: PRIMARY_COLOR,
                },
              ]}
            >
              <View style={styles.responseHeader}>
                <Ionicons
                  name="return-down-forward-outline"
                  size={16}
                  color={PRIMARY_COLOR}
                />

                <Text
                  style={[
                    styles.responseLabel,
                    {
                      color: PRIMARY_COLOR,
                    },
                  ]}
                >
                  Votre réponse
                </Text>
              </View>

              <Text
                style={[
                  styles.responseText,
                  {
                    color: themeColors.text,
                  },
                ]}
              >
                {response}
              </Text>
            </View>
          ) : respondingTo === reviewId ? (
            /* Formulaire de réponse */
            <View style={styles.responseInputContainer}>
              <TextInput
                style={[
                  styles.responseInput,
                  {
                    color: themeColors.text,
                    backgroundColor: isDark
                      ? '#1D2420'
                      : '#FAFCFB',
                    borderColor: isDark
                      ? '#3A4A40'
                      : '#DCE8DF',
                  },
                ]}
                placeholder="Écrire une réponse..."
                placeholderTextColor={themeColors.textSecondary}
                value={responseText}
                onChangeText={setResponseText}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />

              <View style={styles.responseActions}>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    {
                      borderColor: isDark
                        ? '#465149'
                        : '#D8E2DB',
                    },
                  ]}
                  onPress={handleCancelResponse}
                  disabled={isSubmitting}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      {
                        color: themeColors.textSecondary,
                      },
                    ]}
                  >
                    Annuler
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.publishButton,
                    {
                      backgroundColor: PRIMARY_COLOR,
                    },
                  ]}
                  onPress={() => handleRespond(reviewId)}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="send-outline"
                        size={16}
                        color="#FFFFFF"
                      />

                      <Text style={styles.publishButtonText}>
                        Publier
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Bouton Répondre animé */
            <Animated.View
              style={{
                transform: [
                  {
                    scale: buttonAnimation,
                  },
                ],
              }}
            >
              <TouchableOpacity
                style={[
                  styles.respondButton,
                  {
                    backgroundColor: isDark
                      ? '#26352E'
                      : '#EAF7EF',
                    borderColor: isDark
                      ? '#355442'
                      : '#CBEBD5',
                  },
                ]}
                onPress={() => handleOpenResponse(reviewId)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={17}
                  color={PRIMARY_COLOR}
                />

                <Text
                  style={[
                    styles.respondButtonText,
                    {
                      color: PRIMARY_COLOR,
                    },
                  ]}
                >
                  Répondre
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={15}
                  color={PRIMARY_COLOR}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </Animatable.View>
    );
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor: themeColors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={PRIMARY_COLOR}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color: themeColors.textSecondary,
            },
          ]}
        >
          Chargement des avis...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.background,
        },
      ]}
    >
      <Header
        title="Mes avis"
        showBack
      />

      <Animated.ScrollView
        style={[
          styles.scrollView,
          {
            opacity: fadeAnim,
          },
        ]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
      >
        {/* Carte des statistiques */}
        <Animatable.View
          animation="fadeInDown"
          duration={550}
          useNativeDriver
        >
          <LinearGradient
            colors={[PRIMARY_COLOR, PRIMARY_LIGHT]}
            style={styles.statsCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.statsTopRow}>
              <View style={styles.averageContainer}>
                <Text style={styles.averageValue}>
                  {stats.average.toFixed(1)}
                </Text>

                <View style={styles.averageStars}>
                  {renderStars(Math.round(stats.average))}
                </View>

                <Text style={styles.averageLabel}>
                  Note moyenne
                </Text>
              </View>

              <View style={styles.statsDivider} />

              <View style={styles.totalContainer}>
                <Text style={styles.totalValue}>
                  {stats.total}
                </Text>

                <Ionicons
                  name="chatbubbles-outline"
                  size={22}
                  color="rgba(255,255,255,0.9)"
                />

                <Text style={styles.totalLabel}>
                  Total avis
                </Text>
              </View>
            </View>

            <View style={styles.distributionContainer}>
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.distribution[rating] || 0;
                const percentage =
                  stats.total > 0
                    ? (count / stats.total) * 100
                    : 0;

                return (
                  <View
                    key={rating}
                    style={styles.distributionRow}
                  >
                    <Text style={styles.distributionLabel}>
                      {rating}
                    </Text>

                    <Ionicons
                      name="star"
                      size={13}
                      color="#FDE68A"
                    />

                    <View style={styles.distributionBar}>
                      <View
                        style={[
                          styles.distributionFill,
                          {
                            width: `${percentage}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.distributionCount}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </LinearGradient>
        </Animatable.View>

        {/* Titre de la liste */}
        <View style={styles.sectionHeader}>
          <View>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: themeColors.text,
                },
              ]}
            >
              Tous les avis
            </Text>

            <Text
              style={[
                styles.sectionSubtitle,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              Les retours de vos clients
            </Text>
          </View>

          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: isDark
                  ? '#26352E'
                  : '#EAF7EF',
              },
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                {
                  color: PRIMARY_COLOR,
                },
              ]}
            >
              {stats.total}
            </Text>
          </View>
        </View>

        {/* Liste des avis */}
        {reviews.length > 0 ? (
          reviews.map(renderReviewCard)
        ) : (
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: themeColors.surface,
                borderColor: isDark
                  ? '#303A34'
                  : '#E7EEE9',
              },
            ]}
          >
            <View
              style={[
                styles.emptyIconContainer,
                {
                  backgroundColor: isDark
                    ? '#26352E'
                    : '#EAF7EF',
                },
              ]}
            >
              <Ionicons
                name="star-outline"
                size={42}
                color={PRIMARY_COLOR}
              />
            </View>

            <Text
              style={[
                styles.emptyStateTitle,
                {
                  color: themeColors.text,
                },
              ]}
            >
              Aucun avis
            </Text>

            <Text
              style={[
                styles.emptyStateText,
                {
                  color: themeColors.textSecondary,
                },
              ]}
            >
              Les avis de vos clients apparaîtront ici
              après leurs séances.
            </Text>

            <TouchableOpacity
              style={[
                styles.refreshButton,
                {
                  backgroundColor: PRIMARY_COLOR,
                },
              ]}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Ionicons
                name="refresh-outline"
                size={17}
                color="#FFFFFF"
              />

              <Text style={styles.refreshButtonText}>
                Actualiser
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: spacing.lg,
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
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },

  statsCard: {
    borderRadius: 22,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },

  statsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  averageContainer: {
    flex: 1,
    alignItems: 'center',
  },

  averageValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: typography.fontFamily.bold,
  },

  averageStars: {
    marginTop: 3,
  },

  averageLabel: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: 5,
  },

  statsDivider: {
    width: 1,
    height: 75,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  totalContainer: {
    flex: 1,
    alignItems: 'center',
  },

  totalValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: typography.fontFamily.bold,
  },

  totalLabel: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: 5,
  },

  distributionContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
  },

  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },

  distributionLabel: {
    width: 18,
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    textAlign: 'center',
  },

  distributionBar: {
    flex: 1,
    height: 7,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 5,
    overflow: 'hidden',
  },

  distributionFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
  },

  distributionCount: {
    width: 28,
    color: 'rgba(255,255,255,0.9)',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'right',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
  },

  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: 3,
  },

  countBadge: {
    minWidth: 38,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countBadgeText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },

  reviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },

  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  reviewerInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },

  reviewerAvatarFrame: {
    width: 48,
    height: 48,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  reviewerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
  },

  reviewerAvatarText: {
    fontSize: 21,
    fontFamily: typography.fontFamily.bold,
  },

  reviewerDetails: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.sm,
  },

  reviewerName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
  },

  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },

  reviewDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginLeft: 4,
  },

  clientBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 7,
  },

  clientBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
  },

  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },

  starIcon: {
    marginLeft: 1,
  },

  reviewComment: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 23,
    marginBottom: spacing.md,
  },

  responseContainer: {
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: 2,
  },

  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },

  responseLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    marginLeft: 5,
  },

  responseText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 21,
  },

  respondButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  respondButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    marginLeft: 7,
    marginRight: 8,
  },

  responseInputContainer: {
    marginTop: 2,
  },

  responseInput: {
    minHeight: 85,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    textAlignVertical: 'top',
  },

  responseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },

  cancelButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 19,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  cancelButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },

  publishButton: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  publishButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    marginLeft: 6,
  },

  emptyState: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },

  emptyIconContainer: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },

  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.xs,
  },

  emptyStateText: {
    maxWidth: 320,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 21,
  },

  refreshButton: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },

  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    marginLeft: 7,
  },
});

export default ReviewsScreen;