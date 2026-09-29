// src/screens/client/TherapistPost.js
// Publication d'un thérapeute (style page Facebook) — partagée entre
// HomeScreen (aperçu) et TherapistPublicationsScreen (plein écran).

import { useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Share,
} from 'react-native';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, typography } from '../../theme';
import massageTypeService from '../../services/massageTypeService';

const PRIMARY = colors.primary || '#168A55';
const PRIMARY_DARK = '#0B633C';

const MASSAGE_CATEGORY_LABELS = {
  relaxant: 'Relaxant',
  therapeutique: 'Thérapeutique',
  sportif: 'Sportif',
  reflexologie: 'Réflexologie',
  prenatal: 'Prénatal',
  personnalise: 'Personnalisé',
};

const MASSAGE_TYPE_FALLBACK_ICONS = {
  relaxant: 'spa',
  therapeutique: 'bone',
  sportif: 'run',
  reflexologie: 'foot-print',
  prenatal: 'human-pregnant',
  personnalise: 'auto-fix',
};

export const getMassageCategoryLabel = (category) => {
  const normalized = String(category || '').toLowerCase();
  return MASSAGE_CATEGORY_LABELS[normalized] || category || 'Massage';
};

const getMassageTypeFallbackIcon = (category) =>
  MASSAGE_TYPE_FALLBACK_ICONS[String(category || '').toLowerCase()] || 'spa';

/* ============================================================
   PUBLICATIONS THÉRAPEUTES (style page Facebook)
============================================================ */

const FB_BLUE = '#1877F2';
const STAR_COLOR = '#F5B301';

const CATEGORY_GRADIENTS = {
  relaxant: ['#2EAD72', '#168A55'],
  therapeutique: ['#2584D8', '#1B5FA8'],
  sportif: ['#F28A24', '#D0661A'],
  reflexologie: ['#8E5CD9', '#6A3FB0'],
  prenatal: ['#E6679A', '#C24576'],
  personnalise: ['#3FA7A0', '#2A7F79'],
};

const getCategoryGradient = (category) =>
  CATEGORY_GRADIENTS[String(category || '').toLowerCase()] || [PRIMARY, PRIMARY_DARK];

const firstOf = (...values) =>
  values.find((v) => v !== undefined && v !== null && String(v).trim() !== '');

const toBool = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    return ['true', '1', 'yes', 'oui', 'online', 'available', 'disponible'].includes(
      v.toLowerCase().trim()
    );
  }
  return false;
};

const toList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === 'string' ? x : firstOf(x?.name, x?.title, x?.label)))
      .filter(Boolean)
      .map(String);
  }
  if (typeof value === 'string') {
    return value.split(/[,;|\n]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
};

const timeAgo = (value) => {
  if (!value) return '';
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return '';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `il y a ${mo} mois` : `il y a ${Math.floor(mo / 12)} an(s)`;
};

const fmtAr = (price) =>
  price || price === 0 ? `${Number(price).toLocaleString('fr-FR')} Ar` : '';

// Normalise un thérapeute renvoyé par l'API en "publication"
export const normalizeTherapistPost = (raw, index, massageTypes) => {
  const user = raw?.user || raw?.profile || raw?.account || {};
  const name = String(
    firstOf(
      raw?.name, raw?.fullname, raw?.full_name, raw?.display_name,
      user?.name, user?.fullname,
      [raw?.first_name || user?.first_name, raw?.last_name || user?.last_name].filter(Boolean).join(' '),
      'Thérapeute'
    )
  );

  const rawSpecs = firstOf(raw?.specialties, raw?.specialities, raw?.skills_massage, raw?.services, []);
  const specialties = (Array.isArray(rawSpecs) ? rawSpecs : toList(rawSpecs).map((n) => ({ name: n })))
    .map((s) => {
      if (typeof s === 'string') return { id: null, name: s, category: null, imageUrl: null };
      const nm = firstOf(s?.name, s?.title, s?.label);
      if (!nm) return null;
      const match = massageTypes.find(
        (m) => (s?.id != null && String(m.id) === String(s.id)) || m.name === nm
      );
      const category = String(firstOf(s?.category, s?.massage_category, match?.category, '') || '').toLowerCase() || null;
      return {
        id: s?.id ?? match?.id ?? null,
        name: String(nm),
        category,
        imageUrl:
          (firstOf(s?.image_url, s?.icon_url) &&
            massageTypeService.getMassageImageUrl(firstOf(s?.image_url, s?.icon_url))) ||
          match?.imageUrl ||
          null,
      };
    })
    .filter(Boolean);

  const apiCategories = firstOf(raw?.categories);
  const categories = Array.isArray(apiCategories)
    ? apiCategories.map((c) => String(c).toLowerCase())
    : Array.from(new Set(specialties.map((s) => s.category).filter(Boolean)));

  const skills = toList(firstOf(raw?.skills, raw?.competences, raw?.expertise, raw?.certifications));
  const languages = toList(firstOf(raw?.languages, raw?.langues, raw?.spoken_languages));
  const certifications = toList(firstOf(raw?.certifications, raw?.diplomas, raw?.diplomes, raw?.education));

  return {
    id: firstOf(raw?.id, raw?.therapist_id, raw?.user_id, user?.id, `t-${index}`),
    name,
    photo: firstOf(
      raw?.image, raw?.image_url, raw?.photo, raw?.photo_url, raw?.avatar, raw?.avatar_url,
      raw?.profile_image, raw?.profile_image_url,
      user?.image, user?.image_url, user?.photo, user?.avatar, user?.avatar_url, null
    ),
    cover: firstOf(raw?.cover, raw?.cover_image, raw?.cover_url, raw?.banner, null),
    bio: String(
      firstOf(raw?.bio, raw?.about, raw?.biography, raw?.description, raw?.presentation, raw?.a_propos, raw?.about_me, '') || ''
    ),
    rating: Math.max(0, Math.min(5, Number(firstOf(raw?.rating, raw?.average_rating, raw?.avg_rating, 0)) || 0)),
    reviews: Math.max(0, Math.round(Number(firstOf(raw?.reviews, raw?.review_count, raw?.reviews_count, raw?.total_reviews, 0)) || 0)),
    experience: Math.max(0, Math.round(Number(firstOf(raw?.experience, raw?.experience_years, raw?.years_experience, 0)) || 0)),
    sessions: Math.max(0, Math.round(Number(firstOf(raw?.total_sessions, raw?.sessions_count, raw?.completed_bookings, raw?.bookings_count, 0)) || 0)),
    price: Number(firstOf(raw?.price, raw?.starting_price, raw?.base_price, raw?.hourly_rate, raw?.min_price, raw?.recommended_price, 0)) || 0,
    distance: (() => {
      const d = Number(firstOf(raw?.distance, raw?.distance_km, raw?.distance_meters != null ? raw.distance_meters / 1000 : undefined));
      return Number.isFinite(d) ? d : null;
    })(),
    address: String(firstOf(raw?.address, raw?.full_address, raw?.location_name, raw?.quartier, raw?.neighborhood, user?.address, '') || ''),
    phone: firstOf(raw?.phone, raw?.phone_number, raw?.telephone, raw?.mobile, user?.phone, null),
    online: toBool(
      firstOf(
        raw?.available_now,
        raw?.is_online != null && raw?.is_available != null
          ? toBool(raw.is_online) && toBool(raw.is_available)
          : undefined,
        raw?.is_available, raw?.available, raw?.is_online, false
      )
    ),
    verified: toBool(firstOf(raw?.is_verified, raw?.verified, raw?.kyc_verified, false)),
    coordinate: (() => {
      const lat = Number(firstOf(raw?.latitude, raw?.lat, raw?.current_latitude));
      const lon = Number(firstOf(raw?.longitude, raw?.lng, raw?.current_longitude));
      return Number.isFinite(lat) && Number.isFinite(lon) ? { latitude: lat, longitude: lon } : null;
    })(),
    updatedAt: firstOf(raw?.updated_at, raw?.created_at, null),
    specialties,
    categories,
    skills,
    languages,
    certifications,
    raw,
  };
};

/* ---------- Image d'un type de massage (avec repli dégradé + icône) ---------- */
const PostMassageTile = ({ spec, style, overlay, textSize = 11 }) => {
  const [failed, setFailed] = useState(false);
  const gradient = getCategoryGradient(spec?.category);
  const icon = getMassageTypeFallbackIcon(spec?.category);

  return (
    <View style={[postStyles.tile, style]}>
      {spec?.imageUrl && !failed ? (
        <Image
          source={{ uri: spec.imageUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={postStyles.tileIconWrap}>
            <MaterialCommunityIcons name={icon} size={38} color="rgba(255,255,255,0.9)" />
          </View>
        </LinearGradient>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.62)']}
        style={postStyles.tileShade}
        pointerEvents="none"
      />
      <Text numberOfLines={1} style={[postStyles.tileLabel, { fontSize: textSize }]}>
        {spec?.name}
      </Text>

      {overlay ? (
        <View style={postStyles.tileMore}>
          <Text style={postStyles.tileMoreText}>{overlay}</Text>
        </View>
      ) : null}
    </View>
  );
};

/* ---------- Mosaïque façon Facebook : images des types de massage ---------- */
const MEDIA_HEIGHT = 286; // même hauteur de média pour toutes les publications
const MOSAIC_HEIGHT = 96;

const PostMedia = ({ specialties }) => {
  // Aucun type de massage : bloc de remplacement de même hauteur
  if (!specialties || specialties.length === 0) {
    return (
      <PostMassageTile
        spec={{ name: 'Soins de massage', category: null }}
        style={{ height: MEDIA_HEIGHT }}
        textSize={13}
      />
    );
  }

  const withImg = specialties.filter((s) => s.imageUrl);
  const list = (withImg.length ? withImg : specialties).slice(0, 5);
  const extra = Math.max(0, specialties.length - list.length);
  const rest = list.slice(1, 5);

  // Un seul type : une seule grande image (même hauteur totale)
  if (rest.length === 0) {
    return <PostMassageTile spec={list[0]} style={{ height: MEDIA_HEIGHT }} textSize={13} />;
  }

  return (
    <View style={{ height: MEDIA_HEIGHT }}>
      <PostMassageTile
        spec={list[0]}
        style={{ height: MEDIA_HEIGHT - MOSAIC_HEIGHT - 2 }}
        textSize={13}
      />
      <View style={postStyles.mosaicRow}>
        {rest.map((s, i) => (
          <PostMassageTile
            key={`${s.name}-${i}`}
            spec={s}
            style={{ flex: 1, height: MOSAIC_HEIGHT }}
            overlay={i === rest.length - 1 && extra > 0 ? `+${extra}` : null}
            textSize={9.5}
          />
        ))}
      </View>
    </View>
  );
};

/* ---------- Publication d'un thérapeute ---------- */
export const TherapistPost = ({ post, isDark, surface, border, text, textSecondary, onOpen, onBook, onToast, flush = false, fill = false }) => {
  const [expanded, setExpanded] = useState(false);

  const subtle = isDark ? '#242832' : '#F0F2F5';
  const bio =
    post.bio ||
    `Massothérapeute professionnel${post.experience ? ` avec ${post.experience} an${post.experience > 1 ? 's' : ''} d'expérience` : ''}. ` +
      (post.specialties.length
        ? `Je propose : ${post.specialties.map((s) => s.name).join(', ')}.`
        : 'Contactez-moi pour en savoir plus sur mes soins.');
  const longBio = bio.length > 110;
  const shownBio = bio;

  const ago = timeAgo(post.updatedAt);

  const handleCall = () => {
    if (post.phone) Linking.openURL(`tel:${post.phone}`).catch(() => {});
    else onToast?.('Numéro non renseigné', 'warning');
  };

  const handleShare = () => {
    Share.share({
      message: `${post.name} — ${post.rating.toFixed(1)}★ (${post.reviews} avis)${
        post.specialties.length ? ' · ' + post.specialties.map((s) => s.name).join(', ') : ''
      }`,
    }).catch(() => {});
  };

  const stats = [
    post.experience > 0 && { icon: 'briefcase-outline', label: `${post.experience} an${post.experience > 1 ? 's' : ''} d'expérience` },
    post.sessions > 0 && { icon: 'checkmark-done-outline', label: `${post.sessions} séances` },
    post.languages.length > 0 && { icon: 'language-outline', label: post.languages.join(', ') },
    post.certifications.length > 0 && { icon: 'ribbon-outline', label: post.certifications.slice(0, 2).join(', ') },
  ].filter(Boolean);

  return (
    <View
      style={[
        postStyles.card,
        { backgroundColor: surface, borderColor: border },
        flush && { borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0 },
        fill && { flex: 1 },
      ]}
    >
      <View style={fill ? { flex: 1 } : undefined}>
      {/* ===== EN-TÊTE : photo de profil + nom + infos ===== */}
      <View style={postStyles.header}>
        <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={postStyles.avatarWrap}>
          {post.photo ? (
            <Image source={{ uri: post.photo }} style={postStyles.avatar} />
          ) : (
            <View style={[postStyles.avatar, postStyles.avatarFallback]}>
              <Text style={postStyles.avatarInitial}>{post.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View
            style={[
              postStyles.onlineDot,
              { backgroundColor: post.online ? '#31A24C' : '#A0A5AD', borderColor: surface },
            ]}
          />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={postStyles.headerInfo}>
          <View style={postStyles.nameRow}>
            <Text numberOfLines={1} style={[postStyles.name, { color: text }]}>{post.name}</Text>
            {post.verified && <Ionicons name="checkmark-circle" size={15} color={FB_BLUE} style={{ marginLeft: 4 }} />}
          </View>
          <View style={postStyles.metaRow}>
            <Text numberOfLines={1} style={[postStyles.metaText, { color: textSecondary }]}>
              Massothérapeute{ago ? ` · ${ago}` : ''}
            </Text>
            <Ionicons name="earth" size={11} color={textSecondary} style={{ marginLeft: 4 }} />
          </View>
          {!!post.address && (
            <View style={postStyles.metaRow}>
              <Ionicons name="location-outline" size={11} color={textSecondary} />
              <Text numberOfLines={1} style={[postStyles.metaText, { color: textSecondary, marginLeft: 3, flexShrink: 1 }]}>
                {post.address}
                {post.distance != null && post.distance < 900 ? ` · ${post.distance.toFixed(1)} km` : ''}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={[postStyles.statusPill, { backgroundColor: post.online ? '#E7F6EA' : subtle }]}>
          <View style={[postStyles.statusDot, { backgroundColor: post.online ? '#31A24C' : '#A0A5AD' }]} />
          <Text style={[postStyles.statusText, { color: post.online ? '#1E7F37' : textSecondary }]}>
            {post.online ? 'En ligne' : 'Hors ligne'}
          </Text>
        </View>
      </View>

      {/* ===== TEXTE : mombamomba (à propos) ===== */}
      <View style={postStyles.textBlock}>
        <Text
          numberOfLines={expanded ? undefined : 3}
          style={[postStyles.bio, { color: text }, !expanded && { minHeight: 54 }]}
        >
          {shownBio}
        </Text>
        {longBio && (
          <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
            <Text style={[postStyles.moreLink, { color: textSecondary }]}>
              {expanded ? 'Voir moins' : 'Voir plus'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Fahaizana / infos clés */}
        {stats.length > 0 && (
          <View style={[postStyles.statsBox, fill && { minHeight: 64 }]}>
            {stats.map((s, i) => (
              <View key={`${post.id}-st-${i}`} style={postStyles.statLine}>
                <Ionicons name={s.icon} size={14} color={PRIMARY} />
                <Text numberOfLines={2} style={[postStyles.statText, { color: text }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Fahaizana (compétences) en hashtags */}
        {post.skills.length > 0 && (
          <Text numberOfLines={2} style={[postStyles.hashtags, fill && { minHeight: 34 }]}>
            {post.skills.slice(0, 8).map((s) => `#${s.replace(/[^\p{L}\p{N}]+/gu, '')}`).join('  ')}
          </Text>
        )}
      </View>

      {/* ===== MÉDIA : images des types de massage ===== */}
      <PostMedia specialties={post.specialties} />

      {/* ===== TYPES DE MASSAGE + CATÉGORIES ===== */}
      {(post.specialties.length > 0 || post.categories.length > 0) && (
        <View style={[postStyles.tagsBlock, fill && { minHeight: 92 }]}>
          {post.specialties.length > 0 && (
            <View style={postStyles.tagsRow}>
              {post.specialties.map((s, i) => (
                <View key={`${post.id}-sp-${i}`} style={[postStyles.tag, { backgroundColor: subtle }]}>
                  <MaterialCommunityIcons
                    name={getMassageTypeFallbackIcon(s.category)}
                    size={12}
                    color={PRIMARY}
                  />
                  <Text style={[postStyles.tagText, { color: text }]}>{s.name}</Text>
                </View>
              ))}
            </View>
          )}
          {post.categories.length > 0 && (
            <View style={[postStyles.tagsRow, { marginTop: 6 }]}>
              {post.categories.map((c) => (
                <View key={`${post.id}-c-${c}`} style={[postStyles.catTag, { borderColor: `${PRIMARY}40`, backgroundColor: `${PRIMARY}10` }]}>
                  <MaterialCommunityIcons name={getMassageTypeFallbackIcon(c)} size={11} color={PRIMARY} />
                  <Text style={postStyles.catTagText}>{getMassageCategoryLabel(c)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ===== COMPTEURS (style réactions Facebook) ===== */}
      <View style={postStyles.counters}>
        <View style={postStyles.counterLeft}>
          <View style={postStyles.starBubble}>
            <Ionicons name="star" size={10} color="#FFFFFF" />
          </View>
          <Text style={[postStyles.counterText, { color: textSecondary }]}>
            {post.rating.toFixed(1).replace('.', ',')} · {post.reviews} avis
          </Text>
        </View>
        {post.price > 0 && (
          <Text style={[postStyles.priceText, { color: PRIMARY }]}>
            dès {fmtAr(post.price)}
          </Text>
        )}
      </View>

      </View>

      {/* ===== BARRE D'ACTIONS ===== */}
      <View style={[postStyles.actions, { borderTopColor: border }]}>
        <TouchableOpacity activeOpacity={0.7} style={postStyles.actionBtn} onPress={onBook}>
          <Ionicons name="calendar-outline" size={18} color={PRIMARY} />
          <Text style={[postStyles.actionText, { color: PRIMARY }]}>Réserver</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={postStyles.actionBtn} onPress={handleCall}>
          <Ionicons name="call-outline" size={18} color={textSecondary} />
          <Text style={[postStyles.actionText, { color: textSecondary }]}>Appeler</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={postStyles.actionBtn} onPress={onOpen}>
          <Ionicons name="person-circle-outline" size={19} color={textSecondary} />
          <Text style={[postStyles.actionText, { color: textSecondary }]}>Profil</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={postStyles.actionBtn} onPress={handleShare}>
          <Ionicons name="arrow-redo-outline" size={18} color={textSecondary} />
          <Text style={[postStyles.actionText, { color: textSecondary }]}>Partager</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const postStyles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },

  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingTop: 12 },
  avatarWrap: { position: 'relative', marginRight: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: '#E3F1E7', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: PRIMARY, fontSize: 19, fontFamily: typography.fontFamily.bold },
  onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  headerInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { flexShrink: 1, fontSize: 14, fontFamily: typography.fontFamily.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaText: { fontSize: 10, fontFamily: typography.fontFamily.regular },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 9, fontFamily: typography.fontFamily.bold },

  textBlock: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  bio: { fontSize: 12, lineHeight: 18, fontFamily: typography.fontFamily.regular },
  moreLink: { fontSize: 11, marginTop: 3, fontFamily: typography.fontFamily.semiBold },
  statsBox: { marginTop: 10, gap: 5 },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statText: { flex: 1, fontSize: 11, fontFamily: typography.fontFamily.medium },
  hashtags: { marginTop: 9, fontSize: 11, lineHeight: 17, color: FB_BLUE, fontFamily: typography.fontFamily.medium },

  tile: { overflow: 'hidden', backgroundColor: '#DDE5E0', justifyContent: 'flex-end' },
  tileIconWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 54 },
  tileLabel: { color: '#FFFFFF', paddingHorizontal: 9, paddingBottom: 7, fontFamily: typography.fontFamily.bold },
  tileMore: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  tileMoreText: { color: '#FFFFFF', fontSize: 20, fontFamily: typography.fontFamily.bold },
  mosaicRow: { flexDirection: 'row', gap: 2, marginTop: 2 },

  tagsBlock: { paddingHorizontal: 12, paddingTop: 11 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14 },
  tagText: { fontSize: 10, fontFamily: typography.fontFamily.medium },
  catTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 14, borderWidth: 1 },
  catTagText: { color: PRIMARY, fontSize: 9.5, fontFamily: typography.fontFamily.semiBold },

  counters: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10 },
  counterLeft: { flexDirection: 'row', alignItems: 'center' },
  starBubble: { width: 18, height: 18, borderRadius: 9, backgroundColor: STAR_COLOR, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  counterText: { fontSize: 11, fontFamily: typography.fontFamily.regular },
  priceText: { fontSize: 12, fontFamily: typography.fontFamily.bold },

  actions: { flexDirection: 'row', borderTopWidth: 1, marginHorizontal: 8, paddingVertical: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 8 },
  actionText: { fontSize: 11, fontFamily: typography.fontFamily.semiBold },

  emptyBox: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 11, fontFamily: typography.fontFamily.regular, textAlign: 'center' },
});


// Nombre de colonnes selon la largeur (identique Home + écran plein)
export const getPostColumns = (width) => {
  if (width >= 1100) return 3;
  if (width >= 768) return 2;
  return 1;
};

// Grille de publications : cartes côte à côte, MÊME HAUTEUR par rangée
export const TherapistPostGrid = ({ posts, columns = 1, gap = 8, renderPost }) => {
  const rows = [];
  for (let i = 0; i < posts.length; i += columns) {
    rows.push(posts.slice(i, i + columns));
  }

  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={{ flexDirection: 'row', alignItems: 'stretch', gap }}
        >
          {row.map((post) => (
            <View key={String(post.id)} style={{ flex: 1, minWidth: 0 }}>
              {renderPost(post)}
            </View>
          ))}
          {Array.from({ length: columns - row.length }).map((_, i) => (
            <View key={`filler-${i}`} style={{ flex: 1, minWidth: 0 }} />
          ))}
        </View>
      ))}
    </View>
  );
};

export default TherapistPost;