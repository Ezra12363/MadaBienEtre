// src/components/reviews/TherapistReviewsPanel.js
// Bloc complet « Avis » : note moyenne + répartition + filtres + liste.
//  - mode="public"    : profil d'un thérapeute vu par un client (signalement possible)
//  - mode="therapist" : mes avis reçus (réponse aux commentaires, signalement)
// Rendu dans un <View> (pas de FlatList) : peut s'intégrer dans n'importe quel ScrollView.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import reviewService, { REPORT_REASONS } from '../../services/reviewService';
import ConfirmDialog from '../common/ConfirmDialog';
import RatingSummary from './RatingSummary';
import TherapistReviewHeader from './TherapistReviewHeader';
import ReviewCard from './ReviewCard';
import ReviewActionModal from './ReviewActionModal';
import { SORT_OPTIONS } from './reviewUtils';

const PAGE = 10;

export default function TherapistReviewsPanel({ therapistId, mode = 'public', onChanged }) {
  const { colors: c, isDark } = useTheme();

  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [star, setStar] = useState(null);
  const [sort, setSort] = useState('recent');
  const [onlyComments, setOnlyComments] = useState(false);
  const [unanswered, setUnanswered] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [banner, setBanner] = useState(null);

  const [reportTarget, setReportTarget] = useState(null);
  const [respondTarget, setRespondTarget] = useState(null);
  const [removeRespTarget, setRemoveRespTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState(null);

  const load = useCallback(async () => {
    if (!therapistId) return;
    setError(null);
    try {
      const params = { rating: star || undefined, sort, limit: limit + 1 };
      const [st, list] = await Promise.all([
        reviewService.therapistStats(therapistId),
        mode === 'therapist'
          ? reviewService.received({ ...params, unanswered: unanswered || undefined })
          : reviewService.list({ ...params, therapist_id: therapistId, with_comment: onlyComments || undefined }),
      ]);
      setStats(st);
      setReviews(list || []);
    } catch (e) {
      setError(e.message || 'Impossible de charger les avis.');
    } finally {
      setLoading(false);
    }
  }, [therapistId, mode, star, sort, limit, onlyComments, unanswered]);

  useEffect(() => {
    load();
  }, [load]);

  const hasMore = reviews.length > limit;
  const shown = reviews.slice(0, limit);

  const flash = (message, type = 'success') => {
    setBanner({ message, type });
    setTimeout(() => setBanner(null), 3200);
  };

  const submitReport = async ({ text, reason }) => {
    setBusy(true);
    setModalError(null);
    try {
      const res = await reviewService.report(reportTarget.id, reason, text);
      setReportTarget(null);
      flash(res?.message || 'Signalement envoyé.');
      load();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitResponse = async ({ text }) => {
    setBusy(true);
    setModalError(null);
    try {
      await reviewService.respond(respondTarget.id, text);
      setRespondTarget(null);
      flash('Votre réponse a été publiée.');
      await load();
      onChanged && onChanged();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemoveResponse = async () => {
    setBusy(true);
    try {
      await reviewService.deleteResponse(removeRespTarget.id);
      setRemoveRespTarget(null);
      flash('Réponse retirée.');
      await load();
    } catch (e) {
      flash(e.message, 'error');
      setRemoveRespTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const cycleSort = () => {
    const i = SORT_OPTIONS.findIndex((o) => o.key === sort);
    setSort(SORT_OPTIONS[(i + 1) % SORT_OPTIONS.length].key);
    setLimit(PAGE);
  };

  const Chip = ({ label, active, onPress, icon }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        s.chip,
        { borderColor: active ? c.primary : c.border || '#DDD', backgroundColor: active ? `${c.primary}18` : 'transparent' },
      ]}
    >
      {!!icon && <Ionicons name={icon} size={14} color={active ? c.primary : c.textSecondary} />}
      <Text style={{ color: active ? c.primary : c.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ paddingVertical: 28, alignItems: 'center' }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <View>
      {!!banner && (
        <View style={[s.banner, { backgroundColor: banner.type === 'error' ? '#FEE2E2' : '#E8F5E9' }]}>
          <Text style={{ color: banner.type === 'error' ? '#B91C1C' : '#1B5E20', fontWeight: '600', fontSize: 13 }}>{banner.message}</Text>
        </View>
      )}

      <TherapistReviewHeader
        name={stats?.therapist_name}
        photo={stats?.therapist_photo}
        rating={stats?.average_rating}
        count={stats?.total_reviews}
        subtitle="Thérapeute · Mada Bien-Être"
      />

      <RatingSummary stats={stats} selectedStar={star} onSelectStar={(v) => { setStar(v); setLimit(PAGE); }} />

      {/* Filtres */}
      <View style={s.filters}>
        <Chip icon="swap-vertical" label={SORT_OPTIONS.find((o) => o.key === sort)?.label} active onPress={cycleSort} />
        {star && <Chip icon="close" label={`${star}★`} active onPress={() => setStar(null)} />}
        {mode === 'public' ? (
          <Chip icon="chatbubble-outline" label="Avec commentaire" active={onlyComments} onPress={() => { setOnlyComments(!onlyComments); setLimit(PAGE); }} />
        ) : (
          <Chip
            icon="chatbubble-ellipses-outline"
            label={`Sans réponse${stats?.unanswered ? ` (${stats.unanswered})` : ''}`}
            active={unanswered}
            onPress={() => { setUnanswered(!unanswered); setLimit(PAGE); }}
          />
        )}
      </View>

      {!!error && (
        <TouchableOpacity onPress={load} style={[s.empty, { backgroundColor: c.surface }]}>
          <Ionicons name="cloud-offline-outline" size={30} color={c.textSecondary} />
          <Text style={{ color: c.textSecondary, marginTop: 6, textAlign: 'center' }}>{error}</Text>
          <Text style={{ color: c.primary, fontWeight: '700', marginTop: 6 }}>Réessayer</Text>
        </TouchableOpacity>
      )}

      {!error && shown.length === 0 && (
        <View style={[s.empty, { backgroundColor: c.surface }]}>
          <Ionicons name="star-outline" size={34} color={c.textSecondary} />
          <Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>
            {star || onlyComments || unanswered ? 'Aucun avis pour ce filtre' : 'Aucun avis pour le moment'}
          </Text>
          <Text style={{ color: c.textSecondary, marginTop: 4, textAlign: 'center', fontSize: 13 }}>
            {mode === 'therapist'
              ? 'Les avis de vos clients apparaîtront ici après vos séances.'
              : 'Les avis apparaissent après les séances terminées.'}
          </Text>
        </View>
      )}

      {shown.map((r) => (
        <ReviewCard
          key={r.id}
          review={r}
          role={mode === 'therapist' ? 'therapist' : 'public'}
          onReport={(rv) => { setModalError(null); setReportTarget(rv); }}
          onRespond={mode === 'therapist' ? (rv) => { setModalError(null); setRespondTarget(rv); } : undefined}
          onDeleteResponse={mode === 'therapist' ? setRemoveRespTarget : undefined}
        />
      ))}

      {hasMore && (
        <TouchableOpacity onPress={() => setLimit(limit + PAGE)} style={[s.more, { borderColor: c.primary }]}>
          <Text style={{ color: c.primary, fontWeight: '700' }}>Voir plus d'avis</Text>
        </TouchableOpacity>
      )}

      <ReviewActionModal
        visible={!!reportTarget}
        title="Signaler cet avis"
        subtitle="Choisissez un motif. Notre équipe examinera l'avis."
        placeholder="Détails (facultatif)..."
        confirmLabel="Signaler"
        tone="danger"
        reasons={REPORT_REASONS}
        required={false}
        maxLength={500}
        loading={busy}
        error={modalError}
        onConfirm={submitReport}
        onCancel={() => setReportTarget(null)}
      />

      <ReviewActionModal
        visible={!!respondTarget}
        title="Répondre au client"
        subtitle="Soyez courtois et professionnel : votre réponse sera visible publiquement."
        placeholder="Votre réponse..."
        confirmLabel="Publier"
        initialText={respondTarget?.response_from_therapist || ''}
        minLength={2}
        loading={busy}
        error={modalError}
        onConfirm={submitResponse}
        onCancel={() => setRespondTarget(null)}
      />

      <ConfirmDialog
        visible={!!removeRespTarget}
        title="Retirer votre réponse ?"
        message="Votre réponse ne sera plus visible sous cet avis."
        confirmLabel="Retirer"
        tone="warning"
        loading={busy}
        onConfirm={confirmRemoveResponse}
        onCancel={() => setRemoveRespTarget(null)}
        themeColors={c}
      />
    </View>
  );
}

const s = StyleSheet.create({
  banner: { padding: 10, borderRadius: 10, marginBottom: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  empty: { alignItems: 'center', padding: 28, borderRadius: 16, marginTop: 4 },
  more: { alignSelf: 'center', borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 10, marginTop: 4, marginBottom: 8 },
});
