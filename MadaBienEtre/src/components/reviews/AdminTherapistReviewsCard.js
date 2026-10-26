// src/components/reviews/AdminTherapistReviewsCard.js
// Résumé des avis d'un thérapeute dans les fiches admin (note, répartition, derniers avis).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import reviewService from '../../services/reviewService';
import RatingSummary from './RatingSummary';
import TherapistReviewHeader from './TherapistReviewHeader';
import ReviewCard from './ReviewCard';

export default function AdminTherapistReviewsCard({ therapistId, navigation }) {
  const { colors: c } = useTheme();
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!therapistId) return;
    try {
      setError(null);
      const [st, list] = await Promise.all([
        reviewService.therapistStats(therapistId),
        reviewService.list({ therapist_id: therapistId, visibility: 'all', limit: 3 }),
      ]);
      setStats(st);
      setReviews(list || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [therapistId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator color={c.primary} style={{ marginVertical: 14 }} />;
  if (error) {
    return (
      <TouchableOpacity onPress={load}>
        <Text style={{ color: '#B91C1C' }}>{error} — réessayer</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View>
      <TherapistReviewHeader
        name={stats?.therapist_name}
        photo={stats?.therapist_photo}
        rating={stats?.average_rating}
        count={stats?.total_reviews}
      />
      <RatingSummary stats={stats} compact />
      <View style={{ height: 12 }} />
      {reviews.length === 0 ? (
        <Text style={{ color: c.textSecondary }}>Aucun avis pour ce thérapeute.</Text>
      ) : (
        reviews.map((r) => <ReviewCard key={r.id} review={r} role="admin" />)
      )}
      <TouchableOpacity
        onPress={() => navigation?.navigate?.('Reviews')}
        style={{ alignSelf: 'flex-start', paddingVertical: 8 }}
      >
        <Text style={{ color: c.primary, fontWeight: '800' }}>Gérer tous les avis ›</Text>
      </TouchableOpacity>
    </View>
  );
}
