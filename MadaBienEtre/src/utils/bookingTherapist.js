// src/utils/bookingTherapist.js
//
// Point d'entrée UNIQUE de tous les boutons « Réserver » (côté client) qui
// concernent un thérapeute précis : recommandations IA, accueil, publications,
// recherche/carte...
//
// Ils ouvrent tous le même formulaire (CreateBooking -> BookingScreen) avec :
//   - le thérapeute choisi (affiché en haut du formulaire),
//   - son id (la demande est alors verrouillée sur lui côté backend),
//   puis le client enchaîne sur la négociation de cette demande.
//
// Les différentes listes (IA, publications, carte) n'ont pas le même format :
// on les ramène ici à un format unique.

const first = (...values) =>
  values.find((v) => v !== undefined && v !== null && v !== '');

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const toBookingTherapist = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const user = raw.user || raw.profile || raw.account || {};

  const idValue = first(
    raw.therapist_id,
    raw.user_id,
    raw.id,
    user.id
  );
  const idNumber = Number(idValue);
  const therapistId =
    Number.isFinite(idNumber) && idNumber > 0 ? idNumber : null;

  const distanceKm = toNumber(
    first(
      raw.distance_km,
      raw.distance,
      raw.distance_meters != null ? raw.distance_meters / 1000 : undefined
    )
  );

  const online = first(raw.online, raw.available, raw.availability);

  return {
    therapist_id: therapistId,
    id: therapistId,
    fullname: String(
      first(raw.fullname, raw.name, raw.full_name, user.fullname, user.name, 'Thérapeute')
    ),
    profile_image:
      first(
        raw.profile_image,
        raw.photo,
        raw.image,
        raw.image_url,
        raw.avatar,
        raw.avatar_url,
        user.profile_image,
        user.photo,
        user.avatar,
        null
      ) || null,
    rating: toNumber(first(raw.rating, raw.average_rating)),
    total_reviews: toNumber(first(raw.total_reviews, raw.reviews, raw.review_count)),
    experience_years: toNumber(first(raw.experience_years, raw.experience)),
    base_price: toNumber(first(raw.price_suggested, raw.base_price, raw.price)),
    distance_km:
      distanceKm !== undefined && distanceKm < 900 ? distanceKm : undefined,
    reason: raw.reason || undefined,
    availability: typeof online === 'boolean' ? online : undefined,
  };
};

// Paramètres de route pour navigate('CreateBooking', ...).
export const toBookingParams = (raw, extra = {}) => {
  const therapist = toBookingTherapist(raw);
  return {
    therapist,
    therapistId: therapist?.therapist_id ?? null,
    ...extra,
  };
};

export const openBookingWithTherapist = (navigation, raw, extra = {}) =>
  navigation.navigate('CreateBooking', toBookingParams(raw, extra));
