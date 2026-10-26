// src/screens/client/RatingScreen.js
// Donner / modifier son avis après une séance terminée.
//  - note globale 1..5 (obligatoire)
//  - critères détaillés (professionnalisme, qualité, ponctualité, propreté)
//  - commentaire libre, option « publier anonymement »
//  - route.params : { bookingId } (création) — l'écran détecte tout seul si un avis existe (modification)
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing } from '../../theme';
import Header from '../../components/common/Header';
import useResponsive from '../../hooks/useResponsive';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import RatingStars from '../../components/reviews/RatingStars';
import ReviewAvatar from '../../components/reviews/ReviewAvatar';
import { CATEGORY_LABELS, RATING_LABELS, formatReviewDate } from '../../components/reviews/reviewUtils';
import reviewService from '../../services/reviewService';
import api from '../../services/api';

const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);
const MAX_COMMENT = 1000;

const RatingScreen = ({ navigation, route }) => {
  const bookingId = route?.params?.bookingId;
  const { colors: c, isDark } = useTheme();
  const { containerPadding } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [booking, setBooking] = useState(null);
  const [existing, setExisting] = useState(null); // avis déjà publié
  const [canReview, setCanReview] = useState(false);

  const [rating, setRating] = useState(0);
  const [cats, setCats] = useState({});
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [done, setDone] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const goBack = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

  const load = useCallback(async () => {
    if (!bookingId) {
      setLoadError('Réservation introuvable.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [state, bookingRes] = await Promise.all([
        reviewService.forBooking(bookingId),
        api.get(`/bookings/${bookingId}`).then((r) => r.data).catch(() => null),
      ]);
      setBooking(bookingRes);
      setCanReview(!!state.can_review);
      if (state.review) {
        const r = state.review;
        setExisting(r);
        setRating(r.rating || 0);
        setComment(r.comment || '');
        setIsAnonymous(!!r.is_anonymous);
        setCats(
          CATEGORY_KEYS.reduce((acc, k) => ({ ...acc, [k]: r[k] || 0 }), {})
        );
      }
    } catch (e) {
      setLoadError(e.message || 'Impossible de charger la séance.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const isEdit = !!existing;
  const readOnly = isEdit && !existing.can_edit;
  const therapistName = booking?.therapist_name || existing?.therapist_name || 'votre thérapeute';

  const submit = async () => {
    if (!rating) {
      setFormError('Veuillez choisir une note de 1 à 5 étoiles.');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        rating,
        comment: comment.trim() || null,
        is_anonymous: isAnonymous,
      };
      CATEGORY_KEYS.forEach((k) => {
        if (cats[k]) payload[k] = cats[k];
      });

      if (isEdit) await reviewService.update(existing.id, payload);
      else await reviewService.create({ booking_id: Number(bookingId), ...payload });

      setDone(isEdit ? 'Votre avis a été modifié.' : 'Merci pour votre avis ! Il est maintenant visible sur le profil du thérapeute.');
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      await reviewService.remove(existing.id);
      setConfirmDelete(false);
      setDone('Votre avis a été supprimé.');
    } catch (e) {
      setConfirmDelete(false);
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const card = [s.card, { backgroundColor: c.surface }];

  /* ---------- états spéciaux ---------- */
  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: c.background }]}>
        <Header title="Mon avis" showBack />
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[s.container, { backgroundColor: c.background }]}>
        <Header title="Mon avis" showBack />
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={46} color="#DC2626" />
          <Text style={[s.msg, { color: c.text }]}>{loadError}</Text>
          <TouchableOpacity onPress={load} style={[s.linkBtn, { borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[s.container, { backgroundColor: c.background }]}>
        <Header title="Mon avis" showBack />
        <View style={s.center}>
          <View style={s.doneBox}>
            <View style={s.successCircle}><Ionicons name="checkmark" size={44} color="#fff" /></View>
            <Text style={[s.msg, s.doneText, { color: c.text }]}>{done}</Text>
            <TouchableOpacity onPress={goBack} activeOpacity={0.85} style={s.doneBtn}>
              <LinearGradient colors={[colors.primary, colors.primaryLight]} style={s.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.primaryText}>Terminer</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (!isEdit && !canReview) {
    return (
      <View style={[s.container, { backgroundColor: c.background }]}>
        <Header title="Mon avis" showBack />
        <View style={s.center}>
          <Ionicons name="time-outline" size={46} color={c.textSecondary} />
          <Text style={[s.msg, { color: c.text }]}>
            Vous pourrez donner votre avis une fois la séance terminée.
          </Text>
          <TouchableOpacity onPress={goBack} style={[s.linkBtn, { borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ---------- formulaire ---------- */
  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Header title={isEdit ? 'Modifier mon avis' : 'Évaluer le massage'} showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingHorizontal: containerPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.inner}>
            {isEdit && (
              <View style={[s.notice, { backgroundColor: readOnly ? '#FFF3E0' : '#E8F5E9' }]}>
                <Ionicons name={readOnly ? 'lock-closed-outline' : 'information-circle-outline'} size={18} color={readOnly ? '#E65100' : '#2E7D32'} />
                <Text style={{ flex: 1, color: readOnly ? '#8D4B00' : '#1B5E20', fontSize: 12.5 }}>
                  {readOnly
                    ? `Cet avis ne peut plus être modifié (délai de ${existing.edit_window_days} jours dépassé ou avis masqué).`
                    : `Publié le ${formatReviewDate(existing.created_at)} · modifiable pendant ${existing.edit_window_days} jours.`}
                </Text>
              </View>
            )}

            {/* Note globale */}
            <View style={[card, { alignItems: 'center' }]}>
              <ReviewAvatar
                photo={booking?.therapist_photo_url || booking?.therapist_photo || existing?.therapist_photo}
                name={therapistName}
                size={72}
                style={{ marginBottom: spacing.sm }}
              />
              <Text style={[s.title, { color: c.text }]}>Comment était votre massage ?</Text>
              <Text style={[s.subtitle, { color: c.textSecondary }]}>
                {therapistName}
                {booking?.massage_type_name ? ` · ${booking.massage_type_name}` : ''}
              </Text>
              <View style={{ marginVertical: spacing.md }}>
                <RatingStars value={rating} size={44} gap={6} onChange={readOnly ? undefined : setRating} />
              </View>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15, minHeight: 20 }}>
                {rating > 0 ? `${rating}/5 · ${RATING_LABELS[rating - 1]}` : 'Touchez une étoile pour noter'}
              </Text>
            </View>

            {/* Critères */}
            <View style={card}>
              <Text style={[s.section, { color: c.text }]}>Évaluation détaillée <Text style={{ fontWeight: '400', color: c.textSecondary }}>(facultatif)</Text></Text>
              {CATEGORY_KEYS.map((k) => (
                <View key={k} style={s.catRow}>
                  <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>{CATEGORY_LABELS[k]}</Text>
                  <RatingStars
                    value={cats[k] || 0}
                    size={24}
                    onChange={readOnly ? undefined : (v) => setCats((p) => ({ ...p, [k]: p[k] === v ? 0 : v }))}
                  />
                </View>
              ))}
            </View>

            {/* Commentaire */}
            <View style={card}>
              <Text style={[s.section, { color: c.text }]}>Votre commentaire</Text>
              <TextInput
                style={[s.input, { color: c.text, borderColor: c.border || '#E0E0E0', backgroundColor: isDark ? '#1E1E1E' : '#F5F5F5' }]}
                placeholder="Qualité du massage, propreté, ponctualité, comportement du thérapeute..."
                placeholderTextColor={c.textSecondary}
                value={comment}
                onChangeText={(t) => setComment(t.slice(0, MAX_COMMENT))}
                editable={!readOnly}
                multiline
                textAlignVertical="top"
              />
              <Text style={{ color: c.textSecondary, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{comment.length}/{MAX_COMMENT}</Text>

              <TouchableOpacity
                disabled={readOnly}
                onPress={() => setIsAnonymous(!isAnonymous)}
                style={s.anon}
                activeOpacity={0.7}
              >
                <Ionicons name={isAnonymous ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 14 }}>Publier anonymement</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 12 }}>Votre nom ne sera pas affiché publiquement.</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Aperçu */}
            {rating > 0 && (
              <View style={[card, { borderWidth: 1, borderColor: `${colors.primary}55` }]}>
                <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>APERÇU DE VOTRE AVIS</Text>
                <RatingStars value={rating} size={18} />
                {!!comment.trim() && <Text style={{ color: c.text, marginTop: 8, lineHeight: 20 }}>« {comment.trim()} »</Text>}
                <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 8 }}>
                  {isAnonymous ? 'Client anonyme' : 'Vous'} · Après une séance terminée
                </Text>
              </View>
            )}

            {!!formError && (
              <View style={[s.notice, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={{ flex: 1, color: '#B91C1C', fontSize: 13 }}>{formError}</Text>
              </View>
            )}

            {!readOnly && (
              <TouchableOpacity style={s.primaryBtn} onPress={submit} disabled={saving} activeOpacity={0.85}>
                <LinearGradient colors={[colors.primary, colors.primaryLight]} style={s.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{isEdit ? 'Enregistrer les modifications' : 'Envoyer mon avis'}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {isEdit && existing.can_delete && (
              <TouchableOpacity onPress={() => setConfirmDelete(true)} style={s.deleteBtn} disabled={saving}>
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={{ color: '#DC2626', fontWeight: '700' }}>Supprimer mon avis</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmDelete}
        title="Supprimer votre avis ?"
        message="Votre note et votre commentaire seront définitivement supprimés."
        confirmLabel="Supprimer"
        loading={saving}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
        themeColors={c}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40, paddingTop: spacing.sm },
  inner: { width: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  msg: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  card: { borderRadius: 16, padding: spacing.md, marginBottom: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, marginTop: 3, textAlign: 'center' },
  section: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 120, fontSize: 14 },
  anon: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: spacing.md },
  primaryBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  grad: { paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  deleteBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', padding: 14, marginTop: 6 },
  linkBtn: { borderWidth: 1.5, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 10, marginTop: 6 },
  // écran de confirmation : tout est centré, bouton aligné au centre du texte
  doneBox: { width: '100%', maxWidth: 420, alignItems: 'center', alignSelf: 'center', gap: 16 },
  doneText: { fontWeight: '800', fontSize: 18, textAlign: 'center', lineHeight: 26, alignSelf: 'stretch' },
  doneBtn: { alignSelf: 'stretch', borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  successCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});

export default RatingScreen;
