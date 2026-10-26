// src/components/reviews/reviewUtils.js
import { formatMadaLong, parseApiDate } from '../../utils/madaTime';

export const STAR_COLOR = '#F5A623';

export const RATING_LABELS = ['Très déçu', 'Moyen', 'Bien', 'Très bien', 'Exceptionnel'];

export const CATEGORY_LABELS = {
  professionalism: 'Professionnalisme',
  quality: 'Qualité du massage',
  punctuality: 'Ponctualité',
  cleanliness: 'Propreté',
};

export const SORT_OPTIONS = [
  { key: 'recent', label: 'Plus récents' },
  { key: 'old', label: 'Plus anciens' },
  { key: 'best', label: 'Meilleures notes' },
  { key: 'worst', label: 'Notes les plus basses' },
];

export const formatRating = (n) => Number(n || 0).toFixed(1).replace('.', ',');

export const formatReviewDate = (iso) => {
  if (!parseApiDate(iso)) return '';
  return formatMadaLong(iso).replace(/ à .*/, '');
};

export const getInitials = (name) => {
  const parts = String(name || '?').replace(/\(.*\)/, '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
};

export const formatDistribution = (distribution = {}) =>
  [5, 4, 3, 2, 1].map((star) => ({ star, count: Number(distribution?.[star] ?? distribution?.[String(star)] ?? 0) }));
