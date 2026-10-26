// src/components/reviews/ReviewCard.js
// Carte d'avis réutilisable (client, thérapeute, admin, public).
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import RatingStars from './RatingStars';
import ReviewAvatar from './ReviewAvatar';
import { CATEGORY_LABELS, formatReviewDate } from './reviewUtils';

const Action = ({ icon, label, onPress, color }) => (
  <TouchableOpacity onPress={onPress} style={s.action} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
    <Ionicons name={icon} size={15} color={color} />
    <Text style={[s.actionText, { color }]}>{label}</Text>
  </TouchableOpacity>
);

export default function ReviewCard({
  review,
  role = 'public', // client | therapist | admin | public
  showTherapist = false,
  showReviewer = true,
  onEdit,
  onDelete,
  onReport,
  onRespond,
  onDeleteResponse,
  onHide,
  onRestore,
}) {
  const { colors: c, isDark } = useTheme();
  if (!review) return null;

  const border = c.border || 'rgba(0,0,0,0.06)';
  const cats = Object.keys(CATEGORY_LABELS).filter((k) => review[k]);
  const hidden = !!review.is_hidden;
  const hasActions =
    (review.can_edit && onEdit) ||
    (review.can_respond && onRespond && !!review.comment) ||
    (review.can_respond && onDeleteResponse && !!review.response_from_therapist) ||
    (review.can_report && onReport) ||
    (role === 'admin' && ((!hidden && onHide) || (hidden && onRestore))) ||
    (review.can_delete && onDelete);

  return (
    <View
      style={[
        s.card,
        { backgroundColor: c.surface, borderColor: hidden ? '#F59E0B' : review.is_flagged && role === 'admin' ? '#EF4444' : border },
        hidden && { opacity: 0.92 },
      ]}
    >
      {/* En-tête */}
      <View style={s.header}>
        {showTherapist && !showReviewer ? (
          <ReviewAvatar photo={review.therapist_photo} name={review.therapist_name} size={44} />
        ) : (
          <ReviewAvatar photo={review.reviewer_photo} name={review.reviewer_name} size={44} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
            {showTherapist && !showReviewer ? review.therapist_name || 'Thérapeute' : review.reviewer_name || 'Client'}
          </Text>
          <Text style={[s.meta, { color: c.textSecondary }]} numberOfLines={1}>
            {formatReviewDate(review.created_at)}
            {review.edited_at ? ' · modifié' : ''}
            {review.massage_type_name ? ` · ${review.massage_type_name}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <RatingStars value={review.rating} size={15} />
          <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '700' }}>{review.rating}/5</Text>
        </View>
      </View>

      {/* Thérapeute concerné */}
      {showTherapist && showReviewer && !!review.therapist_name && (
        <View style={s.line}>
          <ReviewAvatar photo={review.therapist_photo} name={review.therapist_name} size={22} />
          <Text style={[s.lineText, { color: c.textSecondary }]}>Thérapeute : {review.therapist_name}</Text>
        </View>
      )}

      {/* Badges */}
      <View style={s.badges}>
        {review.is_verified && (
          <View style={[s.badge, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="checkmark-circle" size={12} color="#2E7D32" />
            <Text style={[s.badgeText, { color: '#2E7D32' }]}>Séance terminée</Text>
          </View>
        )}
        {review.is_anonymous && role !== 'public' && (
          <View style={[s.badge, { backgroundColor: isDark ? '#333' : '#EEE' }]}>
            <Ionicons name="eye-off-outline" size={12} color="#666" />
            <Text style={[s.badgeText, { color: '#666' }]}>Anonyme</Text>
          </View>
        )}
        {hidden && (
          <View style={[s.badge, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="eye-off" size={12} color="#E65100" />
            <Text style={[s.badgeText, { color: '#E65100' }]}>Masqué</Text>
          </View>
        )}
        {role === 'admin' && review.pending_reports > 0 && (
          <View style={[s.badge, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="flag" size={12} color="#DC2626" />
            <Text style={[s.badgeText, { color: '#DC2626' }]}>
              {review.pending_reports} signalement{review.pending_reports > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Commentaire */}
      {!!review.comment && <Text style={[s.comment, { color: c.text }]}>{review.comment}</Text>}

      {/* Critères */}
      {cats.length > 0 && (
        <View style={s.cats}>
          {cats.map((k) => (
            <View key={k} style={[s.catPill, { backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6' }]}>
              <Text style={{ color: c.textSecondary, fontSize: 11 }}>
                {CATEGORY_LABELS[k]} · {review[k]}/5
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Motif de masquage (admin / auteur) */}
      {hidden && !!review.hidden_reason && (
        <View style={[s.reasonBox, { backgroundColor: '#FFF8E1' }]}>
          <Text style={{ color: '#8D6E00', fontSize: 12 }}>
            <Text style={{ fontWeight: '700' }}>Motif de modération : </Text>
            {review.hidden_reason}
          </Text>
        </View>
      )}

      {/* Réponse du thérapeute */}
      {!!review.response_from_therapist && (
        <View style={[s.response, { backgroundColor: isDark ? '#1F2A22' : '#F1F8F2', borderLeftColor: c.primary }]}>
          <Text style={{ color: c.primary, fontSize: 12, fontWeight: '800', marginBottom: 2 }}>
            Réponse du thérapeute
            {review.therapist_responded_at ? ` · ${formatReviewDate(review.therapist_responded_at)}` : ''}
          </Text>
          <Text style={{ color: c.text, fontSize: 13, lineHeight: 19 }}>{review.response_from_therapist}</Text>
        </View>
      )}

      {/* Actions */}
      {hasActions && (
      <View style={[s.actions, { borderTopColor: border }]}>
        {review.can_edit && onEdit && <Action icon="create-outline" label="Modifier" color={c.primary} onPress={() => onEdit(review)} />}
        {review.can_respond && onRespond && !!review.comment && (
          <Action
            icon="chatbubble-outline"
            label={review.response_from_therapist ? 'Modifier ma réponse' : 'Répondre'}
            color={c.primary}
            onPress={() => onRespond(review)}
          />
        )}
        {review.can_respond && onDeleteResponse && !!review.response_from_therapist && (
          <Action icon="close-circle-outline" label="Retirer ma réponse" color="#6B7280" onPress={() => onDeleteResponse(review)} />
        )}
        {review.can_report && onReport && <Action icon="flag-outline" label="Signaler" color="#B45309" onPress={() => onReport(review)} />}
        {role === 'admin' && !hidden && onHide && <Action icon="eye-off-outline" label="Masquer" color="#E65100" onPress={() => onHide(review)} />}
        {role === 'admin' && hidden && onRestore && <Action icon="eye-outline" label="Rétablir" color="#2E7D32" onPress={() => onRestore(review)} />}
        {review.can_delete && onDelete && <Action icon="trash-outline" label="Supprimer" color="#DC2626" onPress={() => onDelete(review)} />}
      </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  lineText: { fontSize: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  comment: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  catPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reasonBox: { marginTop: 10, padding: 8, borderRadius: 8 },
  response: { marginTop: 10, padding: 10, borderRadius: 10, borderLeftWidth: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, fontWeight: '700' },
});
