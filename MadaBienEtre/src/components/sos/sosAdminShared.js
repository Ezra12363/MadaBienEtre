// src/components/sos/sosAdminShared.js
// Constantes et petits composants partagés par la liste et le détail des alertes SOS (admin).
import { useState, useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { colors, typography } from '../../theme';
import { API_URL } from '../../config/env';

export const TYPE_LABELS = {
  client: '👤 Client',
  therapist: '💆 Thérapeute',
  emergency: '🚨 Urgence',
  other: '❓ Autre',
};
export const SEVERITY_COLORS = { low: '#4CAF50', medium: '#F5A623', high: '#E74C3C', critical: '#D32F2F' };
export const SEVERITY_LABELS = { low: '🟢 Faible', medium: '🟡 Moyenne', high: '🔴 Élevée', critical: '🔴 Critique' };
export const STATUS_LABELS = { active: '🟢 Active', resolved: '✅ Résolue', cancelled: '⚪ Annulée' };
export const STATUS_COLORS = { active: '#E74C3C', resolved: '#27AE60', cancelled: '#999' };

export const TYPE_BADGES = {
  emergency: { label: '🚨 URGENCE', bg: '#D32F2F', fg: '#fff' },
  client: { label: '👤 Alerte client', bg: '#E8F1FE', fg: '#1E6FD9' },
  therapist: { label: '💆 Alerte thérapeute', bg: '#F3E8FE', fg: '#7B2CBF' },
  other: { label: '❓ Autre', bg: '#ECECEC', fg: '#555' },
};

// Le serveur renvoie des dates UTC sans « Z » : on l'ajoute avant d'afficher.
export const fmtDate = (d) => {
  if (!d) return 'N/A';
  const base = String(d).replace(' ', 'T');
  const iso = /[zZ]$|[+-]\d\d:?\d\d$/.test(base) ? base : `${base}Z`;
  return new Date(iso).toLocaleString('fr-FR');
};

const ROLE_LABELS = { CLIENT: '👤 Client', THERAPIST: '💆 Thérapeute', ADMIN: '🛡️ Admin' };
export const roleLabel = (a) =>
  ROLE_LABELS[String(a?.user_role || '').toUpperCase()] || TYPE_LABELS[a?.alert_type] || '—';

// URL absolue d'une photo de profil. Le backend peut renvoyer :
//  - un chemin relatif (« /uploads/x.jpg » ou « uploads\\x.jpg »)
//  - une URL absolue pointant vers localhost / 127.0.0.1 (inaccessible depuis un téléphone)
export const photoUrl = (u) => {
  if (!u || typeof u !== 'string') return null;
  let v = u.trim().replace(/\\/g, '/');
  if (!v) return null;
  if (/^(data:|blob:|file:)/i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) {
    return v.replace(/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i, API_URL);
  }
  return `${API_URL}${v.startsWith('/') ? '' : '/'}${v}`;
};

// Cherche la photo de profil dans les différents champs possibles de l'alerte.
export const alertPhoto = (a) =>
  a?.user_photo ||
  a?.user_profile_photo ||
  a?.user_profile_image ||
  a?.profile_photo ||
  a?.profile_image ||
  a?.photo ||
  a?.avatar ||
  a?.user?.profile_photo ||
  a?.user?.profile_image ||
  a?.user?.photo ||
  null;

export const TypeBadge = ({ type, compact = false }) => {
  const b = TYPE_BADGES[type] || TYPE_BADGES.other;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: b.bg,
        borderRadius: 8,
        paddingHorizontal: compact ? 6 : 8,
        paddingVertical: compact ? 1 : 3,
        marginTop: compact ? 0 : 4,
      }}
    >
      <Text style={{ color: b.fg, fontSize: compact ? 10 : 11, fontFamily: typography.fontFamily.bold }}>{b.label}</Text>
    </View>
  );
};

// Photo de profil (ronde, recadrée « cover »), sinon initiale.
export const Avatar = ({ uri, name, size = 44 }) => {
  const [failed, setFailed] = useState(false);
  const url = photoUrl(uri);

  // Nouvelle photo -> on retente le chargement.
  useEffect(() => {
    setFailed(false);
  }, [url]);

  const box = { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' };
  if (url && !failed) {
    return (
      <View style={[box, { backgroundColor: '#E5E7EB' }]}>
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }
  return (
    <View style={[box, { backgroundColor: colors.primary + '25', alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.primary, fontSize: size * 0.4, fontFamily: typography.fontFamily.bold }}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};
