// src/components/reviews/BookingReviewSection.js
// Section « Avis » d'une réservation (détail réservation client / thérapeute / admin).
//  - client + séance terminée sans avis  -> bouton « Donner mon avis »
//  - avis existant                       -> carte avec modifier / supprimer (client) ou répondre (thérapeute)
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import reviewService from '../../services/reviewService';
import ReviewCard from './ReviewCard';
import ReviewActionModal from './ReviewActionModal';
import ConfirmDialog from '../common/ConfirmDialog';

export default function BookingReviewSection({ bookingId, status, role = 'client', navigation, style }) {
  const { colors: c } = useTheme();
  const focused = useIsFocused();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [respondOpen, setRespondOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const completed = String(status || '').toLowerCase() === 'completed';

  const load = useCallback(async () => {
    if (!bookingId || !completed) { setLoading(false); return; }
    try {
      setState(await reviewService.forBooking(bookingId));
    } catch (_e) {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId, completed]);

  useEffect(() => { if (focused) load(); }, [focused, load]);

  if (!completed) return null;
  if (loading) return <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />;
  if (!state) return null;

  const openRating = () => navigation.navigate('Rating', { bookingId });
  const review = state.review;

  const respond = async ({ text }) => {
    setBusy(true); setErr(null);
    try { await reviewService.respond(review.id, text); setRespondOpen(false); await load(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await reviewService.remove(review.id); setDelOpen(false); await load(); }
    catch (_e) { setDelOpen(false); }
    finally { setBusy(false); }
  };

  return (
    <View style={style}>
      <Text style={[s.title, { color: c.text }]}>
        {role === 'client' ? 'Mon avis' : 'Avis du client'}
      </Text>

      {!review && role === 'client' && state.can_review && (
        <TouchableOpacity onPress={openRating} style={[s.cta, { backgroundColor: c.primary }]} activeOpacity={0.85}>
          <Ionicons name="star" size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Donner mon avis</Text>
            <Text style={{ color: '#ffffffcc', fontSize: 12 }}>Notez votre massage et votre thérapeute</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {!review && role !== 'client' && (
        <View style={[s.empty, { backgroundColor: c.surface }]}>
          <Ionicons name="star-outline" size={20} color={c.textSecondary} />
          <Text style={{ color: c.textSecondary, flex: 1 }}>Le client n'a pas encore donné son avis.</Text>
        </View>
      )}

      {!!review && (
        <ReviewCard
          review={review}
          role={role}
          showReviewer={role !== 'client'}
          onEdit={role === 'client' ? openRating : undefined}
          onDelete={role === 'client' ? () => setDelOpen(true) : undefined}
          onRespond={role === 'therapist' ? () => setRespondOpen(true) : undefined}
        />
      )}

      <ReviewActionModal
        visible={respondOpen}
        title="Répondre au client"
        placeholder="Votre réponse..."
        confirmLabel="Publier"
        initialText={review?.response_from_therapist || ''}
        minLength={2}
        loading={busy}
        error={err}
        onConfirm={respond}
        onCancel={() => setRespondOpen(false)}
      />
      <ConfirmDialog
        visible={delOpen}
        title="Supprimer votre avis ?"
        message="Votre note et votre commentaire seront définitivement supprimés."
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDelOpen(false)}
        themeColors={c}
      />
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14 },
});
