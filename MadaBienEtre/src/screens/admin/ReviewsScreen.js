// src/screens/admin/ReviewsScreen.js
// ============================================================
// GESTION DES AVIS (admin)
//  - Liste de tous les avis, recherche par client / thérapeute / commentaire
//  - Filtre par note, tri, avis masqués / signalés
//  - Avis signalés : ignorer, masquer ou supprimer (motif obligatoire, consigné)
//  - Suivi des notes et du nombre d'avis de chaque thérapeute
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme';
import Header from '../../components/common/Header';
import useResponsive from '../../hooks/useResponsive';
import reviewService from '../../services/reviewService';
import ReviewCard from '../../components/reviews/ReviewCard';
import ReviewActionModal from '../../components/reviews/ReviewActionModal';
import RatingStars from '../../components/reviews/RatingStars';
import { SORT_OPTIONS, formatRating, formatReviewDate } from '../../components/reviews/reviewUtils';
import ReviewAvatar from '../../components/reviews/ReviewAvatar';
import { useDebounceValue } from './reviewsDebounce';

const IS_WEB = Platform.OS === 'web';
const VISIBILITY = [
  { key: 'visible', label: 'Visibles' },
  { key: 'hidden', label: 'Masqués' },
  { key: 'all', label: 'Tous' },
];

export default function ReviewsScreen() {
  const { colors: c, isDark } = useTheme();
  const { isMobile, containerPadding } = useResponsive();
  const border = c.border || 'rgba(0,0,0,0.08)';

  const [tab, setTab] = useState('all'); // all | reports | therapists
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounceValue(search, 350);
  const [star, setStar] = useState(null);
  const [sort, setSort] = useState('recent');
  const [visibility, setVisibility] = useState('visible');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [therapistSort, setTherapistSort] = useState('rating');

  const [action, setAction] = useState(null); // { type, review?, report? }
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadSummary = useCallback(async () => {
    try {
      const data = await reviewService.adminSummary({ q: tab === 'therapists' ? debouncedSearch || undefined : undefined, sort: therapistSort });
      setSummary(data.totals);
      setTherapists(data.therapists || []);
    } catch (e) {
      setError(e.message);
    }
  }, [tab, debouncedSearch, therapistSort]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      if (tab === 'all') {
        const list = await reviewService.list({
          q: debouncedSearch || undefined,
          rating: star || undefined,
          sort,
          visibility,
          flagged: flaggedOnly ? true : undefined,
          limit: 100,
        });
        setReviews(list || []);
      } else if (tab === 'reports') {
        setReports((await reviewService.adminReports('pending')) || []);
      }
      await loadSummary();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, debouncedSearch, star, sort, visibility, flaggedOnly, loadSummary]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  /* ---------- actions de modération ---------- */
  const openAction = (type, review, report = null) => {
    setModalError(null);
    setAction({ type, review, report });
  };

  const submitAction = async ({ text }) => {
    if (!action) return;
    setBusy(true);
    setModalError(null);
    try {
      const { type, review, report } = action;
      if (type === 'hide') {
        report
          ? await reviewService.adminResolveReport(report.id, 'hide', text)
          : await reviewService.moderate(review.id, 'hide', text);
        showToast('Avis masqué. Le client a été informé.');
      } else if (type === 'delete') {
        report
          ? await reviewService.adminResolveReport(report.id, 'delete', text)
          : await reviewService.remove(review.id, text);
        showToast('Avis supprimé.');
      }
      setAction(null);
      await loadData();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (review) => {
    try {
      await reviewService.moderate(review.id, 'restore');
      showToast('Avis rétabli.');
      loadData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const dismissReport = async (report) => {
    try {
      await reviewService.adminResolveReport(report.id, 'dismiss', 'Signalement non fondé');
      showToast('Signalement ignoré.');
      loadData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  /* ---------- UI helpers ---------- */
  const columnWidth = '100%'; // une carte par ligne (web + mobile)

  const Chip = ({ label, active, onPress, icon }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, { borderColor: active ? colors.primary : border, backgroundColor: active ? `${colors.primary}18` : c.surface }]}
    >
      {!!icon && <Ionicons name={icon} size={14} color={active ? colors.primary : c.textSecondary} />}
      <Text style={{ color: active ? colors.primary : c.text, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );

  const Stat = ({ label, value, icon, color, onPress }) => (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.stat, { backgroundColor: c.surface, borderColor: border, minWidth: isMobile ? '47%' : 150 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );

  const tabs = [
    { id: 'all', label: 'Tous les avis' },
    { id: 'reports', label: 'Signalés', badge: summary?.pending_reports },
    { id: 'therapists', label: 'Suivi thérapeutes' },
  ];

  const modalConfig = useMemo(() => {
    if (!action) return {};
    const who = action.review?.reviewer_name ? ` de ${action.review.reviewer_name}` : '';
    if (action.type === 'hide')
      return { title: "Masquer l'avis", subtitle: `Avis${who}. Il n'apparaîtra plus et ne comptera plus dans la note. Le motif sera transmis au client.`, confirmLabel: 'Masquer', tone: 'danger' };
    return { title: "Supprimer l'avis", subtitle: `Avis${who}. Suppression définitive. Le motif sera transmis au client.`, confirmLabel: 'Supprimer', tone: 'danger' };
  }, [action]);

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Header title="Gestion des avis" showBack />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: containerPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={{ width: '100%' }}>
          {!!toast && (
            <View style={[s.toast, { backgroundColor: toast.type === 'error' ? '#FEE2E2' : '#E8F5E9' }]}>
              <Text style={{ color: toast.type === 'error' ? '#B91C1C' : '#1B5E20', fontWeight: '600' }}>{toast.message}</Text>
            </View>
          )}

          {/* Statistiques globales */}
          {summary && (
            <View style={s.stats}>
              <Stat icon="star" color="#F5A623" label="Note moyenne" value={summary.reviews ? formatRating(summary.average_rating) : '—'} />
              <Stat icon="chatbubbles-outline" color={colors.primary} label="Avis visibles" value={summary.reviews} onPress={() => { setTab('all'); setVisibility('visible'); setFlaggedOnly(false); }} />
              <Stat icon="flag-outline" color="#DC2626" label="Signalements en attente" value={summary.pending_reports} onPress={() => setTab('reports')} />
              <Stat icon="eye-off-outline" color="#E65100" label="Avis masqués" value={summary.hidden} onPress={() => { setTab('all'); setVisibility('hidden'); }} />
            </View>
          )}

          {/* Onglets */}
          <View style={s.tabs}>
            {tabs.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => { setTab(t.id); setSearch(''); }}
                style={[s.tab, { backgroundColor: tab === t.id ? colors.primary : c.surface, borderColor: tab === t.id ? colors.primary : border }]}
              >
                <Text style={{ color: tab === t.id ? '#fff' : c.text, fontWeight: '700', fontSize: 13 }}>{t.label}</Text>
                {!!t.badge && (
                  <View style={s.badge}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{t.badge}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Recherche */}
          {tab !== 'reports' && (
            <View style={[s.search, { backgroundColor: c.surface, borderColor: border }]}>
              <Ionicons name="search" size={18} color={c.textSecondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={tab === 'therapists' ? 'Rechercher un thérapeute...' : 'Rechercher par client, thérapeute ou commentaire...'}
                placeholderTextColor={c.textSecondary}
                style={[{ flex: 1, color: c.text, fontSize: 14 }, IS_WEB ? { outlineStyle: 'none' } : null]}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={c.textSecondary} /></TouchableOpacity>
              )}
            </View>
          )}

          {/* Filtres : tous les avis */}
          {tab === 'all' && (
            <View style={s.filters}>
              {[5, 4, 3, 2, 1].map((n) => (
                <Chip key={n} label={`${n}★`} active={star === n} onPress={() => setStar(star === n ? null : n)} />
              ))}
              <Chip icon="swap-vertical" label={SORT_OPTIONS.find((o) => o.key === sort)?.label} active onPress={() => setSort(SORT_OPTIONS[(SORT_OPTIONS.findIndex((o) => o.key === sort) + 1) % SORT_OPTIONS.length].key)} />
              {VISIBILITY.map((v) => (
                <Chip key={v.key} label={v.label} active={visibility === v.key} onPress={() => setVisibility(v.key)} />
              ))}
              <Chip icon="flag-outline" label="Signalés" active={flaggedOnly} onPress={() => setFlaggedOnly(!flaggedOnly)} />
            </View>
          )}

          {tab === 'therapists' && (
            <View style={s.filters}>
              {[{ k: 'rating', l: 'Meilleure note' }, { k: 'reviews', l: "Plus d'avis" }, { k: 'flagged', l: 'Plus signalés' }, { k: 'name', l: 'Nom' }].map((o) => (
                <Chip key={o.k} label={o.l} active={therapistSort === o.k} onPress={() => setTherapistSort(o.k)} />
              ))}
            </View>
          )}

          {!!error && (
            <TouchableOpacity onPress={loadData} style={s.errorBox}>
              <Text style={{ color: '#B91C1C' }}>{error} — toucher pour réessayer</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* ===== TOUS LES AVIS ===== */}
              {tab === 'all' && (
                <>
                  {reviews.length === 0 && !error && (
                    <View style={[s.empty, { backgroundColor: c.surface }]}>
                      <Ionicons name="star-outline" size={36} color={c.textSecondary} />
                      <Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>Aucun avis trouvé</Text>
                    </View>
                  )}
                  <View style={s.grid}>
                    {reviews.map((r) => (
                      <View key={r.id} style={{ width: columnWidth }}>
                        <ReviewCard
                          review={r}
                          role="admin"
                          showTherapist
                          onHide={(rv) => openAction('hide', rv)}
                          onRestore={restore}
                          onDelete={(rv) => openAction('delete', rv)}
                        />
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* ===== SIGNALEMENTS ===== */}
              {tab === 'reports' && (
                <>
                  {reports.length === 0 && !error && (
                    <View style={[s.empty, { backgroundColor: c.surface }]}>
                      <Ionicons name="checkmark-done-circle-outline" size={38} color={colors.primary} />
                      <Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>Aucun signalement en attente</Text>
                    </View>
                  )}
                  <View style={s.grid}>
                    {reports.map((rep) => (
                      <View key={rep.id} style={{ width: columnWidth }}>
                        <View style={[s.reportHead, { backgroundColor: isDark ? '#3A2222' : '#FEF2F2' }]}>
                          <Ionicons name="flag" size={16} color="#DC2626" />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#B91C1C', fontWeight: '800', fontSize: 13 }}>{rep.reason_label}</Text>
                            <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                              Signalé par {rep.reporter_name || '—'} ({rep.reporter_role === 'THERAPIST' ? 'thérapeute' : 'client'}) · {formatReviewDate(rep.created_at)}
                            </Text>
                            {!!rep.description && <Text style={{ color: c.text, fontSize: 13, marginTop: 4 }}>« {rep.description} »</Text>}
                          </View>
                        </View>
                        {rep.review ? (
                          <ReviewCard review={rep.review} role="admin" showTherapist />
                        ) : (
                          <Text style={{ color: c.textSecondary, marginVertical: 8 }}>Avis introuvable.</Text>
                        )}
                        <View style={s.reportActions}>
                          <TouchableOpacity onPress={() => dismissReport(rep)} style={[s.actBtn, { borderColor: border, borderWidth: 1 }]}>
                            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>Ignorer</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => openAction('hide', rep.review, rep)} style={[s.actBtn, { backgroundColor: '#E65100' }]}>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Masquer</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => openAction('delete', rep.review, rep)} style={[s.actBtn, { backgroundColor: '#DC2626' }]}>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Supprimer</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* ===== SUIVI DES THÉRAPEUTES ===== */}
              {tab === 'therapists' && (
                <>
                  {therapists.length === 0 && !error && (
                    <View style={[s.empty, { backgroundColor: c.surface }]}>
                      <Text style={{ color: c.text, fontWeight: '700' }}>Aucun thérapeute</Text>
                    </View>
                  )}
                  <View style={s.grid}>
                    {therapists.map((t) => (
                      <TouchableOpacity
                        key={t.therapist_id}
                        activeOpacity={0.8}
                        onPress={() => { setSearch(t.name || ''); setTab('all'); setVisibility('all'); }}
                        style={[s.thCard, { width: columnWidth, backgroundColor: c.surface, borderColor: border }]}
                      >
                        <ReviewAvatar photo={t.photo} name={t.name} size={48} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: c.text, fontWeight: '700' }} numberOfLines={1}>{t.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <RatingStars value={t.average_rating} size={13} />
                            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>
                              {t.total_reviews ? formatRating(t.average_rating) : 'Pas de note'}
                            </Text>
                          </View>
                          <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>
                            {t.total_reviews} avis · {t.last_month_reviews} ce mois
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          {t.flagged > 0 && <Text style={s.tagRed}>{t.flagged} signalé{t.flagged > 1 ? 's' : ''}</Text>}
                          {t.hidden > 0 && <Text style={s.tagOrange}>{t.hidden} masqué{t.hidden > 1 ? 's' : ''}</Text>}
                          <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <ReviewActionModal
        visible={!!action}
        {...modalConfig}
        placeholder="Motif (obligatoire, transmis au client)..."
        minLength={3}
        maxLength={500}
        loading={busy}
        error={modalError}
        onConfirm={submitAction}
        onCancel={() => setAction(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 12, paddingBottom: 50 },
  toast: { padding: 12, borderRadius: 12, marginBottom: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  stat: { flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 14, gap: 3 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9 },
  badge: { backgroundColor: '#DC2626', minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, height: 46, marginBottom: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  errorBox: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 12, marginBottom: 12 },
  empty: { alignItems: 'center', padding: 34, borderRadius: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  reportHead: { flexDirection: 'row', gap: 10, padding: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  reportActions: { flexDirection: 'row', gap: 8, marginTop: -4, marginBottom: 18 },
  actBtn: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  thCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  tagRed: { backgroundColor: '#FEE2E2', color: '#B91C1C', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  tagOrange: { backgroundColor: '#FFF3E0', color: '#E65100', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
});
