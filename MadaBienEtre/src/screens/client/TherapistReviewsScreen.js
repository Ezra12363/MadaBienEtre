// src/screens/client/TherapistReviewsScreen.js
// Profil d'avis d'un thérapeute (note moyenne, nombre d'avis, commentaires).
// route.params : { therapistId, therapistName? }
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/common/Header';
import useResponsive from '../../hooks/useResponsive';
import TherapistReviewsPanel from '../../components/reviews/TherapistReviewsPanel';

export default function TherapistReviewsScreen({ route }) {
  const { colors: c } = useTheme();
  const { containerPadding } = useResponsive();
  const therapistId = route?.params?.therapistId;
  const name = route?.params?.therapistName;

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Header title={name ? `Avis · ${name}` : 'Avis du thérapeute'} showBack />
      <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: containerPadding }]}>
        <View style={s.inner}>
          {therapistId ? (
            <TherapistReviewsPanel therapistId={therapistId} mode="public" />
          ) : (
            <Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 40 }}>Thérapeute introuvable.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 16, paddingBottom: 40 },
  inner: { width: '100%' },
});
