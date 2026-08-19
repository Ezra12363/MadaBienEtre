// src/screens/client/RatingScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
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

const RatingScreen = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const { colors: themeColors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [booking, setBooking] = useState(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const ratingLabels = [
    'Très déçu',
    'Moyen',
    'Bien',
    'Très bien',
    'Exceptionnel',
  ];

  const ratingCategories = [
    { id: 'professionalism', label: 'Professionnalisme', value: 0 },
    { id: 'quality', label: 'Qualité du massage', value: 0 },
    { id: 'punctuality', label: 'Ponctualité', value: 0 },
    { id: 'cleanliness', label: 'Propreté', value: 0 },
  ];

  useEffect(() => {
    loadBooking();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadBooking = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBooking(response.data);
    } catch (error) {
      console.error('Error loading booking:', error);
      setBooking({
        id: bookingId,
        therapist: {
          id: 1,
          name: 'Sarah B.',
        },
      });
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Erreur', 'Veuillez donner une note');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/reviews`,
        {
          booking_id: bookingId,
          rating: rating,
          comment: comment,
          is_anonymous: isAnonymous,
          professionalism: ratingCategories[0].value || rating,
          quality: ratingCategories[1].value || rating,
          punctuality: ratingCategories[2].value || rating,
          cleanliness: ratingCategories[3].value || rating,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert(
        '✅ Merci pour votre avis !',
        'Votre évaluation a été enregistrée avec succès',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Home'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible d\'envoyer votre avis');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStars = (value, setValue, size = 40) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setValue(star)}
            onPressIn={() => setHoverRating(star)}
            onPressOut={() => setHoverRating(0)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={star <= (hoverRating || value) ? 'star' : 'star-outline'}
              size={size}
              color={star <= (hoverRating || value) ? '#FFD700' : '#E0E0E0'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Évaluer le massage" showBack />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Note globale */}
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={[styles.ratingCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.ratingTitle, { color: themeColors.text }]}>
              Comment était votre massage ?
            </Text>
            <Text style={[styles.ratingSubtitle, { color: themeColors.textSecondary }]}>
              {booking?.therapist?.name}
            </Text>
            
            <View style={styles.starsContainer}>
              {renderStars(rating, setRating, 48)}
            </View>
            
            {rating > 0 && (
              <Text style={[styles.ratingLabel, { color: colors.primary }]}>
                {ratingLabels[rating - 1]}
              </Text>
            )}
          </View>
        </Animatable.View>

        {/* Catégories d'évaluation */}
        <Animatable.View animation="fadeInUp" delay={200} duration={600}>
          <View style={[styles.categoriesCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.categoriesTitle, { color: themeColors.text }]}>
              Évaluation détaillée
            </Text>
            {ratingCategories.map((category, index) => (
              <View key={category.id} style={styles.categoryItem}>
                <Text style={[styles.categoryLabel, { color: themeColors.text }]}>
                  {category.label}
                </Text>
                <View style={styles.categoryStars}>
                  {renderStars(category.value, (value) => {
                    const newCategories = [...ratingCategories];
                    newCategories[index].value = value;
                    // Mettre à jour l'état
                  }, 24)}
                </View>
              </View>
            ))}
          </View>
        </Animatable.View>

        {/* Commentaire */}
        <Animatable.View animation="fadeInUp" delay={400} duration={600}>
          <View style={[styles.commentCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.commentTitle, { color: themeColors.text }]}>
              Votre commentaire
            </Text>
            <TextInput
              style={[styles.commentInput, { 
                color: themeColors.text,
                borderColor: '#E0E0E0',
                backgroundColor: isDark ? '#1E1E1E' : '#F5F5F5',
              }]}
              placeholder="Partagez votre expérience..."
              placeholderTextColor={themeColors.textSecondary}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
        </Animatable.View>

        {/* Options */}
        <Animatable.View animation="fadeInUp" delay={600} duration={600}>
          <View style={[styles.optionsCard, { backgroundColor: themeColors.surface }]}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => setIsAnonymous(!isAnonymous)}
            >
              <View style={styles.optionLeft}>
                <Ionicons 
                  name={isAnonymous ? 'checkbox-outline' : 'square-outline'} 
                  size={24} 
                  color={colors.primary} 
                />
                <Text style={[styles.optionText, { color: themeColors.text }]}>
                  Publier anonymement
                </Text>
              </View>
              {isAnonymous && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </Animatable.View>

        {/* Bouton */}
        <Animatable.View animation="fadeInUp" delay={800} duration={600}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              style={styles.submitGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Envoyer mon avis</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
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
  ratingCard: {
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
  ratingSubtitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  ratingLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  categoriesCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoriesTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  categoryLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  categoryStars: {
    flexDirection: 'row',
    gap: 2,
  },
  commentCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  commentTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semiBold,
    marginBottom: spacing.sm,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    minHeight: 120,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  optionsCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
  },
});

export default RatingScreen;