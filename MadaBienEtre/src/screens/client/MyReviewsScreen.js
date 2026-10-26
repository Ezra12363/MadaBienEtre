// src/screens/client/MyReviewsScreen.js
// Historique des avis du client + séances terminées « à évaluer ».
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme';
import Header from '../../components/common/Header';
import useResponsive from '../../hooks/useResponsive';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ReviewCard from '../../components/reviews/ReviewCard';
import { formatReviewDate } from '../../components/reviews/reviewUtils';
import ReviewAvatar from '../../components/reviews/ReviewAvatar';
import reviewService from '../../services/reviewService';

export default function MyReviewsScreen({ navigation }) {
  const { colors: c } = useTheme();
  const { containerPadding } = useResponsive();
  const [tab, setTab] = useState('given'); // given | pending
  const [reviews, setReviews] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mine, toRate] = await Promise.all([reviewService.mine(), reviewService.pending()]);
      setReviews(mine || []);
      setPending(toRate || []);
      if ((toRate || []).length > 0 && (mine || []).length === 0) setTab('pending');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openRating = (bookingId) => navigation.navigate('Rating', { bookingId });

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await reviewService.remove(toDelete.id);
      setToDelete(null);
      await load();
    } catch (e) {
      setError(e.message);
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const Tab = ({ id, label, count }) => (
    <TouchableOpacity
      onPress={() => setTab(id)}
      style={[s.tab, { backgroundColor: tab === id ? colors.primary : c.surface, borderColor: tab === id ? colors.primary : c.border || '#DDD' }]}
    >
      <Text style={{ color: tab === id ? '#fff' : c.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
      {count > 0 && (
        <View style={[s.count, { backgroundColor: tab === id ? '#ffffff33' : `${colors.primary}22` }]}>
          <Text style={{ color: tab === id ? '#fff' : colors.primary, fontSize: 11, fontWeight: '800' }}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Header title="Mes avis" showBack />
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingHorizontal: containerPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <View style={s.inner}>
            <View style={s.tabs}>
              <Tab id="given" label="Mes avis" count={reviews.length} />
              <Tab id="pending" label="À évaluer" count={pending.length} />
            </View>

            {!!error && (
              <TouchableOpacity onPress={load} style={[s.errorBox]}>
                <Text style={{ color: '#B91C1C' }}>{error} — toucher pour réessayer</Text>
              </TouchableOpacity>
            )}

            {tab === 'given' && (
              <>
                {reviews.length === 0 && !error && (
                  <View style={[s.empty, { backgroundColor: c.surface }]}>
                    <Ionicons name="star-outline" size={36} color={c.textSecondary} />
                    <Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>Vous n'avez pas encore donné d'avis</Text>
                    <Text style={{ color: c.textSecondary, textAlign: 'center', marginTop: 4, fontSize: 13 }}>
                      Après un massage terminé, notez votre thérapeute pour aider les autres clients.
                    </Text>
                  </View>
                )}
                {reviews.map((r) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    role="client"
                    showTherapist
                    showReviewer={false}
                    onEdit={() => openRating(r.booking_id)}
                    onDelete={setToDelete}
                  />
                ))}
              </>
            )}

            {tab === 'pending' && (
              <>
                {pending.length === 0 && !error && (
                  <View style={[s.empty, { backgroundColor: c.surface }]}>
                    <Ionicons name="checkmark-done-circle-outline" size={36} color={colors.primary} />
                    <Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>Tout est évalué, merci !</Text>
                  </View>
                )}
                {pending.map((p) => (
                  <View key={p.booking_id} style={[s.pendingCard, { backgroundColor: c.surface, borderColor: c.border || 'rgba(0,0,0,0.06)' }]}>
                    <ReviewAvatar photo={p.therapist_photo} name={p.therapist_name} size={46} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontWeight: '700' }} numberOfLines={1}>{p.therapist_name || 'Thérapeute'}</Text>
                      <Text style={{ color: c.textSecondary, fontSize: 12 }} numberOfLines={1}>
                        {p.massage_type_name || 'Massage'} · {formatReviewDate(p.completed_at || p.scheduled_date)}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => openRating(p.booking_id)} style={s.rateBtn}>
                      <Ionicons name="star" size={14} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Évaluer</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      )}

      <ConfirmDialog
        visible={!!toDelete}
        title="Supprimer cet avis ?"
        message="Votre note et votre commentaire seront définitivement supprimés."
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        themeColors={c}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 16, paddingBottom: 40 },
  inner: { width: '100%' },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9 },
  count: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  errorBox: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 12, marginBottom: 12 },
  empty: { alignItems: 'center', padding: 30, borderRadius: 16 },
  pendingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10 },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
});
