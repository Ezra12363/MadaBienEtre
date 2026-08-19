// src/screens/client/AIRecommendationScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import axios from 'axios';
import { API_URL } from '../../config';

const AIRecommendationScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { token, user } = useAuth();
  
  const [symptoms, setSymptoms] = useState('');
  const [budget, setBudget] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [chatHistory, setChatHistory] = useState([
    {
      id: 1,
      type: 'ai',
      message: 'Bonjour ! Je suis votre assistant IA. Dites-moi ce que vous recherchez et je vous trouverai le massage idéal. 🧘',
    },
  ]);
  const [isChatMode, setIsChatMode] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  const quickOptions = [
    { id: 'relax', icon: 'spa', label: 'Relaxation', desc: 'Anti-stress' },
    { id: 'pain', icon: 'healing', label: 'Douleurs', desc: 'Musculaires' },
    { id: 'sport', icon: 'run', label: 'Sportif', desc: 'Récupération' },
    { id: 'pregnant', icon: 'baby-carriage', label: 'Prénatal', desc: 'Grossesse' },
  ];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const getRecommendations = async () => {
    if (!symptoms.trim()) {
      Alert.alert('Erreur', 'Veuillez décrire ce que vous cherchez');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/ai/recommend-therapist`,
        {
          user_id: user?.id,
          symptoms: symptoms,
          budget_max: parseInt(budget) || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecommendations(response.data);
      
      setChatHistory(prev => [
        ...prev,
        {
          id: Date.now(),
          type: 'user',
          message: symptoms,
        },
        {
          id: Date.now() + 1,
          type: 'ai',
          message: `J'ai trouvé ${response.data.length} thérapeutes qui correspondent à vos besoins. Voici les meilleurs !`,
        },
      ]);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      // Données mockées
      const mockRecommendations = [
        {
          therapist_id: 1,
          fullname: 'Sarah B.',
          rating: 4.8,
          total_reviews: 32,
          distance_km: 1.2,
          price_suggested: 35000,
          availability: true,
          score: 92,
          reason: 'Idéale pour vos douleurs musculaires',
          profile_image: null,
          experience_years: 5,
          base_price: 35000,
        },
        {
          therapist_id: 2,
          fullname: 'Jean R.',
          rating: 4.9,
          total_reviews: 45,
          distance_km: 2.5,
          price_suggested: 45000,
          availability: true,
          score: 88,
          reason: 'Expert en massage thérapeutique',
          profile_image: null,
          experience_years: 8,
          base_price: 40000,
        },
        {
          therapist_id: 3,
          fullname: 'Marie L.',
          rating: 4.7,
          total_reviews: 28,
          distance_km: 0.8,
          price_suggested: 30000,
          availability: false,
          score: 75,
          reason: 'Massage relaxant adapté à vos besoins',
          profile_image: null,
          experience_years: 3,
          base_price: 28000,
        },
      ];
      setRecommendations(mockRecommendations);
      setChatHistory(prev => [
        ...prev,
        {
          id: Date.now(),
          type: 'user',
          message: symptoms,
        },
        {
          id: Date.now() + 1,
          type: 'ai',
          message: 'J\'ai trouvé 3 thérapeutes qui correspondent à vos besoins. Voici les meilleurs !',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSelect = (option) => {
    const messages = {
      relax: 'Je cherche un massage relaxant pour me détendre. Avez-vous des recommandations ?',
      pain: 'J\'ai des douleurs musculaires et j\'ai besoin d\'un massage thérapeutique.',
      sport: 'Je pratique le sport et j\'ai besoin d\'un massage pour la récupération.',
      pregnant: 'Je suis enceinte et je cherche un massage prénatal adapté.',
    };
    setSymptoms(messages[option.id] || '');
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    
    setChatHistory(prev => [
      ...prev,
      { id: Date.now(), type: 'user', message: userMessage },
    ]);

    try {
      const response = await axios.post(
        `${API_URL}/chatbot/message`,
        {
          message: userMessage,
          user_id: user?.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setChatHistory(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'ai',
          message: response.data.response,
          suggestions: response.data.suggestions,
        },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'ai',
          message: 'Je suis désolé, une erreur est survenue. Veuillez réessayer.',
        },
      ]);
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderChatMessage = (item) => (
    <View style={[
      styles.chatMessage,
      item.type === 'user' ? styles.userMessage : styles.aiMessage,
    ]}>
      {item.type === 'ai' && (
        <View style={styles.aiAvatar}>
          <Ionicons name="chatbubble" size={16} color="#fff" />
        </View>
      )}
      <View style={[
        styles.messageBubble,
        item.type === 'user' ? styles.userBubble : styles.aiBubble,
        { backgroundColor: item.type === 'user' ? colors.primary : themeColors.surface }
      ]}>
        <Text style={[
          styles.messageText,
          { color: item.type === 'user' ? '#fff' : themeColors.text }
        ]}>
          {item.message}
        </Text>
        {item.suggestions && (
          <View style={styles.suggestionButtons}>
            {item.suggestions.slice(0, 3).map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => setChatInput(suggestion)}
              >
                <Text style={styles.suggestionChipText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="IA Recommandation" showBack />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Bannière IA */}
          <Animatable.View animation="fadeInDown" duration={600}>
            <LinearGradient
              colors={['#E8F5E9', '#C8E6C9']}
              style={styles.aiBanner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.aiBannerContent}>
                <Ionicons name="chatbubbles" size={32} color={colors.primary} />
                <View>
                  <Text style={styles.aiBannerTitle}>Assistant IA</Text>
                  <Text style={styles.aiBannerSubtitle}>
                    Décrivez vos besoins pour des recommandations personnalisées
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Animatable.View>

          {/* Options rapides */}
          <Animatable.View animation="fadeInUp" delay={200} duration={600}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              Que recherchez-vous ?
            </Text>
            <View style={styles.quickOptionsGrid}>
              {quickOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.quickOption, { backgroundColor: themeColors.surface }]}
                  onPress={() => handleQuickSelect(option)}
                  activeOpacity={0.7}
                >
                  <View style={styles.quickOptionIcon}>
                    <MaterialCommunityIcons name={option.icon} size={28} color={colors.primary} />
                  </View>
                  <Text style={[styles.quickOptionLabel, { color: themeColors.text }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.quickOptionDesc, { color: themeColors.textSecondary }]}>
                    {option.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animatable.View>

          {/* Chat avec l'IA */}
          <Animatable.View animation="fadeInUp" delay={400} duration={600}>
            <View style={[styles.chatContainer, { backgroundColor: themeColors.surface }]}>
              {/* Historique du chat */}
              <View style={styles.chatHistory}>
                {chatHistory.map((item) => (
                  <View key={item.id}>
                    {renderChatMessage(item)}
                  </View>
                ))}
                {isLoading && (
                  <View style={styles.aiMessage}>
                    <View style={styles.aiAvatar}>
                      <Ionicons name="chatbubble" size={16} color="#fff" />
                    </View>
                    <View style={[styles.aiBubble, { backgroundColor: themeColors.background }]}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.messageText, { color: themeColors.textSecondary }]}>
                        L'IA réfléchit...
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Input */}
              <View style={styles.chatInputContainer}>
                <TextInput
                  style={[styles.chatInput, { 
                    color: themeColors.text,
                    backgroundColor: isDark ? '#1E1E1E' : '#F5F5F5',
                  }]}
                  placeholder="Décrivez ce que vous cherchez..."
                  placeholderTextColor={themeColors.textSecondary}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.chatSendButton, !chatInput.trim() && styles.chatSendDisabled]}
                  onPress={sendChatMessage}
                  disabled={!chatInput.trim()}
                >
                  <Ionicons name="send" size={20} color={chatInput.trim() ? '#fff' : '#999'} />
                </TouchableOpacity>
              </View>
            </View>
          </Animatable.View>

          {/* Recommandations */}
          {recommendations.length > 0 && (
            <Animatable.View animation="fadeInUp" delay={600} duration={600}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                {recommendations.length} thérapeute(s) recommandé(s)
              </Text>
              {recommendations.map((therapist, index) => (
                <TouchableOpacity
                  key={therapist.therapist_id}
                  style={[styles.therapistCard, { backgroundColor: themeColors.surface }]}
                  onPress={() => navigation.navigate('Booking', { therapist })}
                  activeOpacity={0.7}
                >
                  <View style={styles.therapistCardHeader}>
                    <View style={styles.therapistAvatar}>
                      <Text style={styles.therapistAvatarText}>
                        {therapist.fullname.charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.therapistInfo}>
                      <Text style={[styles.therapistName, { color: themeColors.text }]}>
                        {therapist.fullname}
                      </Text>
                      <View style={styles.therapistRating}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <Text style={styles.ratingText}>{therapist.rating}</Text>
                        <Text style={styles.reviewsText}>({therapist.total_reviews} avis)</Text>
                      </View>
                    </View>
                    <View style={styles.therapistScore}>
                      <Text style={styles.scoreNumber}>{therapist.score}%</Text>
                      <Text style={styles.scoreLabel}>Match</Text>
                    </View>
                  </View>

                  <View style={styles.therapistDetails}>
                    <View style={styles.therapistDetail}>
                      <Ionicons name="location-outline" size={16} color={themeColors.textSecondary} />
                      <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                        {therapist.distance_km} km
                      </Text>
                    </View>
                    <View style={styles.therapistDetail}>
                      <Ionicons name="briefcase-outline" size={16} color={themeColors.textSecondary} />
                      <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                        {therapist.experience_years} ans d'expérience
                      </Text>
                    </View>
                    {therapist.availability ? (
                      <View style={[styles.availabilityBadge, { backgroundColor: '#4CAF50' + '20' }]}>
                        <Text style={styles.availabilityText}>Disponible</Text>
                      </View>
                    ) : (
                      <View style={[styles.availabilityBadge, { backgroundColor: '#D32F2F' + '20' }]}>
                        <Text style={[styles.availabilityText, styles.unavailableText]}>
                          Indisponible
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.therapistFooter}>
                    <View>
                      <Text style={styles.priceLabel}>Prix suggéré</Text>
                      <Text style={styles.priceValue}>
                        {therapist.price_suggested.toLocaleString()} Ar
                      </Text>
                    </View>
                    <View style={styles.therapistReason}>
                      <Text style={styles.reasonText}>💡 {therapist.reason}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </Animatable.View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  aiBanner: {
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  aiBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  aiBannerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  aiBannerSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  quickOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickOption: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickOptionLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
  },
  quickOptionDesc: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  chatContainer: {
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chatHistory: {
    minHeight: 100,
    maxHeight: 300,
  },
  chatMessage: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.sm,
    borderRadius: 12,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
  suggestionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  suggestionChip: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  suggestionChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontFamily: typography.fontFamily.medium,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendDisabled: {
    backgroundColor: '#ccc',
  },
  therapistCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  therapistCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  therapistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  therapistAvatarText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  therapistInfo: {
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
  therapistScore: {
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  scoreNumber: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: 8,
    color: colors.primary,
    fontFamily: typography.fontFamily.medium,
  },
  therapistDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  therapistDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  availabilityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  availabilityText: {
    fontSize: 10,
    color: '#4CAF50',
    fontFamily: typography.fontFamily.medium,
  },
  unavailableText: {
    color: '#D32F2F',
  },
  therapistFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  priceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  therapistReason: {
    flex: 1,
    marginLeft: spacing.md,
  },
  reasonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'right',
  },
});

export default AIRecommendationScreen;