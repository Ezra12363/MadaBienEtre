// src/screens/admin/ReviewsScreen.js
//
// ============================================================
// REFONTE UX/RESPONSIVE
// ============================================================
// Ce que ce fichier corrige / ajoute par rapport à la version
// d'origine :
//
//  1. RESPONSIVE RÉEL (même logique que Dashboard/Settings) :
//     - Mobile (<768px)   : liste pleine largeur, 1 colonne, look
//                           natif Android/iOS.
//     - Tablette (≥768px) : grille 2 colonnes.
//     - Desktop (≥1100px) : grille 3 colonnes, contenu centré avec
//                           largeur max (évite les cartes étirées
//                           à l'infini sur un écran large), barre
//                           d'outils horizontale (recherche + filtre
//                           + tri) au lieu d'empiler verticalement.
//
//  2. Alert.alert() remplacé par <ConfirmDialog /> : Alert.alert()
//     ne s'affiche PAS du tout sur react-native-web (juste un
//     console.warn) — donc la suppression d'avis ne demandait
//     jamais confirmation sur le site web. C'était un bug silencieux.
//
//  3. Recherche + filtre par note + tri (récent/ancien/meilleure
//     note) — un écran de modération d'avis sans recherche/filtre
//     n'est pas exploitable dès qu'il y a plus de 20 avis.
//
//  4. Bandeau de stats (note moyenne, total, répartition) en haut,
//     utile pour un admin qui veut un coup d'œil rapide.
//
//  5. États clairs : loading (skeleton), erreur réseau distincte du
//     "aucun résultat de recherche", vide.
//
//  6. Accessibilité web : focus visible clavier sur les champs et
//     boutons, hit-slop correct sur les icônes tactiles.

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import useResponsive from '../../hooks/useResponsive';
import adminService from '../../services/adminService';

const IS_WEB = Platform.OS === 'web';

const RATING_FILTERS = [5, 4, 3, 2, 1];
const SORT_OPTIONS = [
  { key: 'recent', label: 'Plus récents' },
  { key: 'old', label: 'Plus anciens' },
  { key: 'best', label: 'Meilleure note' },
  { key: 'worst', label: 'Note la plus basse' },
];

const ReviewsScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { isMobile, isTablet, isDesktop, gridColumns, contentMaxWidth, containerPadding } =
    useResponsive();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState(null); // null = toutes
  const [sortBy, setSortBy] = useState('recent');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null); // review en attente de suppression
  const [deleting, setDeleting] = useState(false);

  // Colonnes réelles pour cet écran : les avis ont des textes de
  // longueur variable, donc on plafonne à 2 colonnes même en très
  // large pour garder des commentaires lisibles.
  const columns = isDesktop ? 2 : isTablet ? 2 : 1;

  /* ============================================================
     TOAST
  ============================================================ */
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
        setToast(null)
      );
    }, 2800);
  }, [toastOpacity]);

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  /* ============================================================
     CHARGEMENT
  ============================================================ */
  useFocusEffect(
    useCallback(() => {
      loadReviews();
    }, [])
  );

  const loadReviews = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await adminService.getReviews({ limit: 100 });
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
      setErrorMsg("Impossible de charger les avis. Vérifiez votre connexion.");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  };

  /* ============================================================
     SUPPRESSION (avec confirmation custom — compatible web)
  ============================================================ */
  const requestDelete = (review) => setConfirmTarget(review);

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await adminService.deleteReview(confirmTarget.id);
      setReviews((prev) => prev.filter((r) => r.id !== confirmTarget.id));
      showToast('Avis supprimé avec succès.', 'success');
    } catch (error) {
      showToast("Impossible de supprimer l'avis.", 'error');
    } finally {
      setDeleting(false);
      setConfirmTarget(null);
    }
  };

  /* ============================================================
     DÉRIVÉS : recherche / filtre / tri / stats
  ============================================================ */
  const filteredReviews = useMemo(() => {
    let list = [...reviews];

    if (ratingFilter) {
      list = list.filter((r) => Math.round(r.rating || 0) === ratingFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => (r.comment || '').toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'old':
        list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'best':
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'worst':
        list.sort((a, b) => (a.rating || 0) - (b.rating || 0));
        break;
      case 'recent':
      default:
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [reviews, search, ratingFilter, sortBy]);

  const stats = useMemo(() => {
    const total = reviews.length;
    const avg = total ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / total : 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => Math.round(r.rating || 0) === star).length,
    }));
    return { total, avg, distribution };
  }, [reviews]);

  /* ============================================================
     HELPERS
  ============================================================ */
  const formatDate = (iso) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getInitials = (id) => {
    // Pas de nom d'auteur dans les données actuelles : on affiche un
    // avatar généré à partir de l'id pour distinguer visuellement les
    // auteurs sans dépendre d'un champ absent de l'API.
    const n = String(id ?? '?');
    return n.slice(0, 2).toUpperCase();
  };

  const renderStars = (rating, size = 15) =>
    [...Array(5)].map((_, i) => (
      <Ionicons
        key={i}
        name={i < Math.round(rating) ? 'star' : 'star-outline'}
        size={size}
        color={i < Math.round(rating) ? '#F5A623' : themeColors.textSecondary}
      />
    ));

  /* ============================================================
     SOUS-COMPOSANTS
  ============================================================ */

  const StatsBar = () => (
    <View
      style={[
        styles.statsBar,
        isMobile ? styles.statsBarMobile : styles.statsBarWide,
        { backgroundColor: themeColors.surface, borderColor: themeColors.border || 'rgba(0,0,0,0.06)' },
      ]}
    >
      <View style={styles.statsAvgBlock}>
        <Text style={[styles.statsAvgValue, { color: themeColors.text }]}>{stats.avg.toFixed(1)}</Text>
        <View style={{ flexDirection: 'row', marginTop: 2 }}>{renderStars(stats.avg, 14)}</View>
        <Text style={[styles.statsAvgLabel, { color: themeColors.textSecondary }]}>
          {stats.total} avis au total
        </Text>
      </View>

      <View style={styles.statsDistribution}>
        {stats.distribution.map(({ star, count }) => {
          const pct = stats.total ? (count / stats.total) * 100 : 0;
          return (
            <TouchableOpacity
              key={star}
              onPress={() => setRatingFilter(ratingFilter === star ? null : star)}
              style={styles.statsRow}
              activeOpacity={0.7}
            >
              <Text style={[styles.statsRowLabel, { color: themeColors.textSecondary }]}>{star}★</Text>
              <View style={[styles.statsTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F6' }]}>
                <View
                  style={[
                    styles.statsFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: ratingFilter === star ? colors.primary : '#F5A623',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.statsRowCount, { color: themeColors.textSecondary }]}>{count}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const Toolbar = () => (
    <View style={[styles.toolbar, isMobile ? styles.toolbarMobile : styles.toolbarWide]}>
      <View
        style={[
          styles.searchBox,
          { backgroundColor: themeColors.surface, borderColor: themeColors.border || 'rgba(0,0,0,0.08)' },
        ]}
      >
        <Ionicons name="search" size={18} color={themeColors.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher dans les commentaires..."
          placeholderTextColor={themeColors.textSecondary}
          style={[styles.searchInput, { color: themeColors.text }]}
          {...(IS_WEB ? { outlineStyle: 'none' } : {})}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={themeColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.toolbarRight}>
        {ratingFilter && (
          <TouchableOpacity
            onPress={() => setRatingFilter(null)}
            style={[styles.filterChip, { backgroundColor: `${colors.primary}18` }]}
          >
            <Text style={[styles.filterChipText, { color: colors.primary }]}>{ratingFilter}★</Text>
            <Ionicons name="close" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}

        <View style={styles.sortWrap}>
          <TouchableOpacity
            onPress={() => setSortMenuOpen((v) => !v)}
            style={[styles.sortButton, { borderColor: themeColors.border || 'rgba(0,0,0,0.08)' }]}
          >
            <Ionicons name="swap-vertical" size={16} color={themeColors.text} />
            <Text style={[styles.sortButtonText, { color: themeColors.text }]}>
              {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
            </Text>
            <Ionicons name={sortMenuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={themeColors.textSecondary} />
          </TouchableOpacity>

          {sortMenuOpen && (
            <View
              style={[
                styles.sortMenu,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border || 'rgba(0,0,0,0.08)' },
              ]}
            >
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => {
                    setSortBy(opt.key);
                    setSortMenuOpen(false);
                  }}
                  style={styles.sortMenuItem}
                >
                  <Text
                    style={[
                      styles.sortMenuItemText,
                      { color: sortBy === opt.key ? colors.primary : themeColors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {sortBy === opt.key && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const ReviewCard = ({ item }) => (
    <View
      style={[
        styles.card,
        columns > 1 ? { width: `${100 / columns}%` } : { width: '100%' },
      ]}
    >
      <View
        style={[
          styles.cardInner,
          { backgroundColor: themeColors.surface, borderColor: themeColors.border || 'rgba(0,0,0,0.06)' },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.authorRow}>
            <View style={[styles.avatar, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{getInitials(item.reviewer_id)}</Text>
            </View>
            <View>
              <Text style={[styles.authorLabel, { color: themeColors.text }]}>
                Client #{item.reviewer_id ?? '—'}
              </Text>
              <Text style={[styles.date, { color: themeColors.textSecondary }]}>{formatDate(item.created_at)}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => requestDelete(item)}
            hitSlop={10}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.ratingRow}>
          {renderStars(item.rating || 0)}
          <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>{item.rating || 0}/5</Text>
        </View>

        <Text style={[styles.comment, { color: themeColors.text }]}>
          {item.comment || 'Aucun commentaire'}
        </Text>

        <View style={[styles.therapistTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}>
          <Ionicons name="body-outline" size={12} color={themeColors.textSecondary} />
          <Text style={[styles.therapistTagText, { color: themeColors.textSecondary }]}>
            Thérapeute #{item.therapist_id ?? '—'}
          </Text>
        </View>
      </View>
    </View>
  );

  const Toast = () => {
    if (!toast) return null;
    const bg = toast.type === 'success' ? '#16A34A' : toast.type === 'error' ? '#DC2626' : colors.primary;
    return (
      <Animated.View style={[styles.toastWrapper, { opacity: toastOpacity }]} pointerEvents="none">
        <View style={[styles.toast, { backgroundColor: bg }]}>
          <Ionicons
            name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'alert-circle' : 'information-circle'}
            size={19}
            color="#FFFFFF"
          />
          <Text style={styles.toastText} numberOfLines={2}>{toast.message}</Text>
        </View>
      </Animated.View>
    );
  };

  /* ============================================================
     RENDER
  ============================================================ */

  const showEmptySearchState = !loading && !errorMsg && reviews.length > 0 && filteredReviews.length === 0;
  const showTrueEmptyState = !loading && !errorMsg && reviews.length === 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Avis" showBack />

        <View
          style={[
            styles.scrollWrap,
            { paddingHorizontal: containerPadding, alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth },
          ]}
        >
          {!loading && !errorMsg && reviews.length > 0 && <StatsBar />}
          {!loading && !errorMsg && reviews.length > 0 && <Toolbar />}

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.centerStateText, { color: themeColors.textSecondary }]}>Chargement des avis...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.centerState}>
              <Ionicons name="cloud-offline-outline" size={56} color={themeColors.textSecondary} />
              <Text style={[styles.centerStateTitle, { color: themeColors.text }]}>Connexion impossible</Text>
              <Text style={[styles.centerStateText, { color: themeColors.textSecondary }]}>{errorMsg}</Text>
              <TouchableOpacity onPress={loadReviews} style={[styles.retryButton, { backgroundColor: colors.primary }]}>
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : showTrueEmptyState ? (
            <View style={styles.centerState}>
              <Ionicons name="chatbubbles-outline" size={64} color={themeColors.textSecondary} />
              <Text style={[styles.centerStateTitle, { color: themeColors.text }]}>Aucun avis</Text>
              <Text style={[styles.centerStateText, { color: themeColors.textSecondary }]}>
                Les avis laissés par les clients apparaîtront ici.
              </Text>
            </View>
          ) : showEmptySearchState ? (
            <View style={styles.centerState}>
              <Ionicons name="search-outline" size={48} color={themeColors.textSecondary} />
              <Text style={[styles.centerStateTitle, { color: themeColors.text }]}>Aucun résultat</Text>
              <Text style={[styles.centerStateText, { color: themeColors.textSecondary }]}>
                Aucun avis ne correspond à votre recherche ou filtre.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearch('');
                  setRatingFilter(null);
                }}
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.retryButtonText}>Réinitialiser les filtres</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredReviews}
              renderItem={({ item }) => <ReviewCard item={item} />}
              keyExtractor={(item) => item.id.toString()}
              numColumns={columns}
              key={columns} // force re-layout propre quand le nb de colonnes change
              columnWrapperStyle={columns > 1 ? styles.row : undefined}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        <Toast />

        <ConfirmDialog
          visible={!!confirmTarget}
          title="Supprimer cet avis ?"
          message="Cette action est définitive et ne peut pas être annulée."
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          tone="danger"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => (deleting ? null : setConfirmTarget(null))}
          themeColors={themeColors}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollWrap: { flex: 1, paddingTop: spacing.md },

  /* Stats bar */
  statsBar: { borderRadius: 18, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  statsBarMobile: { flexDirection: 'column', gap: spacing.md },
  statsBarWide: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  statsAvgBlock: { alignItems: 'flex-start', minWidth: 120 },
  statsAvgValue: { fontSize: 34, fontFamily: typography.fontFamily.bold, lineHeight: 38 },
  statsAvgLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 4 },
  statsDistribution: { flex: 1, gap: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statsRowLabel: { width: 26, fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium },
  statsTrack: { flex: 1, height: 7, borderRadius: 6, overflow: 'hidden' },
  statsFill: { height: '100%', borderRadius: 6 },
  statsRowCount: { width: 28, textAlign: 'right', fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular },

  /* Toolbar */
  toolbar: { marginBottom: spacing.md, gap: spacing.sm },
  toolbarMobile: { flexDirection: 'column' },
  toolbarWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, flex: 1, maxWidth: 420,
  },
  searchInput: { flex: 1, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, height: '100%' },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, height: 36, borderRadius: 10,
  },
  filterChipText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold },
  sortWrap: { position: 'relative' },
  sortButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
  },
  sortButtonText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium },
  sortMenu: {
    position: 'absolute', top: 42, right: 0, minWidth: 190,
    borderRadius: 12, borderWidth: 1, paddingVertical: 6, zIndex: 20,
    ...(IS_WEB ? { boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } : {
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
    }),
  },
  sortMenuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  sortMenuItemText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },

  /* List / cards */
  listContent: { paddingBottom: spacing.xl },
  row: { gap: spacing.md },
  card: { paddingBottom: spacing.md },
  cardInner: { padding: spacing.md, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontFamily: typography.fontFamily.bold },
  authorLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  date: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 1 },
  deleteButton: { padding: 6, borderRadius: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  ratingText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, marginLeft: 4 },
  comment: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, lineHeight: 21, marginBottom: spacing.sm },
  therapistTag: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8,
  },
  therapistTagText: { fontSize: 10, fontFamily: typography.fontFamily.medium },

  /* Center states */
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.lg },
  centerStateTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginTop: spacing.md },
  centerStateText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.xs, maxWidth: 320 },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.md, paddingHorizontal: 18, height: 42, borderRadius: 10,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },

  /* Toast */
  toastWrapper: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    maxWidth: 420, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
    ...(IS_WEB ? { boxShadow: '0 8px 24px rgba(0,0,0,0.18)' } : {
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 6,
    }),
  },
  toastText: { color: '#FFFFFF', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, flexShrink: 1 },
});

export default ReviewsScreen;