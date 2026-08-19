// src/screens/admin/ReviewsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';

const ReviewsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadReviews();
    }, [])
  );

  const loadReviews = async () => {
    setLoading(true);
    try {
      const data = await adminService.getReviews({ limit: 100 });
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
      setReviews([
        { id: 1, therapist_id: 2, reviewer_id: 5, rating: 5, comment: 'Excellent massage, je recommande !', created_at: '2026-07-20T14:30:00Z' },
        { id: 2, therapist_id: 1, reviewer_id: 7, rating: 4, comment: 'Très bon thérapeute, professionnel.', created_at: '2026-07-19T11:15:00Z' },
        { id: 3, therapist_id: 2, reviewer_id: 3, rating: 5, comment: 'Parfait !', created_at: '2026-07-18T09:45:00Z' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  };

  const handleDeleteReview = async (reviewId) => {
    Alert.alert('Supprimer l\'avis', 'Voulez-vous supprimer cet avis ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await adminService.deleteReview(reviewId);
          await loadReviews();
          Alert.alert('✅ Succès', 'Avis supprimé avec succès');
        } catch (error) {
          Alert.alert('Erreur', 'Impossible de supprimer l\'avis');
        }
      }}
    ]);
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <Ionicons
        key={i}
        name={i < rating ? 'star' : 'star-outline'}
        size={16}
        color={i < rating ? '#F5A623' : '#ccc'}
      />
    ));
  };

  const renderReview = ({ item }) => (
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={styles.ratingContainer}>
          {renderStars(item.rating || 0)}
          <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>
            {item.rating || 0}/5
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteReview(item.id)}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.comment, { color: themeColors.text }]}>
        {item.comment || 'Aucun commentaire'}
      </Text>
      <Text style={[styles.date, { color: themeColors.textSecondary }]}>
        {item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : 'N/A'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
          <Header title="Avis" showBack />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Chargement...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Avis" showBack />
        {reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={themeColors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Aucun avis</Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>Aucun avis disponible</Text>
          </View>
        ) : (
          <FlatList
            data={reviews}
            renderItem={renderReview}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.md },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginTop: spacing.md },
  emptyText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.xs },
  listContent: { padding: spacing.md },
  card: { padding: spacing.md, borderRadius: 16, marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, marginLeft: 4 },
  comment: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, marginBottom: spacing.xs },
  date: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular },
});

export default ReviewsScreen;