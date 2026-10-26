// src/components/sos/sosAdminShared.js
// Constantes et petits composants partagés par la liste et le détail des alertes SOS (admin).
import { useState } from 'react';
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

export const photoUrl = (u) => {
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`;
};

export const TypeBadge = ({ type }) => {
  const b = TYPE_BADGES[type] || TYPE_BADGES.other;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: b.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 }}>
      <Text style={{ color: b.fg, fontSize: 11, fontFamily: typography.fontFamily.bold }}>{b.label}</Text>
    </View>
  );
};

// Photo de profil, sinon initiale.
export const Avatar = ({ uri, name, size = 44 }) => {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) {
    return <Image source={{ uri: photoUrl(uri) }} style={[box, { backgroundColor: '#E5E7EB' }]} onError={() => setFailed(true)} />;
  }
  return (
    <View style={[box, { backgroundColor: colors.primary + '25', alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.primary, fontSize: size * 0.4, fontFamily: typography.fontFamily.bold }}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};
