// src/screens/therapist/ReviewsScreen.js
// « Mes avis » côté thérapeute : note moyenne, répartition, critères,
// liste des avis reçus avec tri / filtres et réponse aux commentaires.
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import useResponsive from '../../hooks/useResponsive';
import TherapistReviewsPanel from '../../components/reviews/TherapistReviewsPanel';

const ReviewsScreen = () => {
  const { colors: c } = useTheme();
  const { user } = useAuth();
  const { containerPadding } = useResponsive();

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Header title="Mes avis" showBack />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: containerPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.inner}>
          {user?.id ? (
            <TherapistReviewsPanel therapistId={user.id} mode="therapist" />
          ) : (
            <Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 40 }}>
              Profil introuvable.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 16, paddingBottom: 40 },
  inner: { width: '100%' },
});

export default ReviewsScreen;
