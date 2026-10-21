// src/components/admin/AdminDetailKit.js
//
// Briques communes des PAGES DE DÉTAILS admin (utilisateur, thérapeute,
// demande d'approbation). Ces pages remplacent les anciennes modales
// « Voir détails » : elles s'ouvrent comme une vraie page de la pile de
// navigation, donc la barre de navigation (TopNavBar / onglets du bas) et
// le header restent affichés correctement.
//
// Contenu :
//   - helpers : formatDate, formatMoney, getFullAddress, getLatitude/Longitude
//   - useAdminToast / AdminToast
//   - downloadAdminDocument (web + Android)
//   - DetailScaffold (header + zone défilante responsive)
//   - DetailCard, InfoGrid, InfoItem, Badge, ProfileHero, DocumentBlock,
//     ActionButton, DetailColumns
//   - AdminImageViewer (zoom plein écran d'un document)
//   - AdminConfirmDialog (confirmation, avec motif optionnel)

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme';
import Header from '../common/Header';
import { API_URL } from '../../config/env';

export const IS_WEB = Platform.OS === 'web';

/* ============================================================
   HELPERS
============================================================ */

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatMoney = (value) => {
  const number = Number(value || 0);
  return `${number.toLocaleString('fr-FR')} Ar`;
};

export const isPdfUrl = (url) =>
  typeof url === 'string' &&
  url.toLowerCase().split('?')[0].endsWith('.pdf');

/* ------------------------------------------------------------
   Adresse / coordonnées (mêmes règles que TherapistsScreen)
------------------------------------------------------------ */

export const getFullAddress = (item) => {
  if (!item) {
    return 'Adresse non renseignée';
  }

  if (
    typeof item.address === 'string' &&
    item.address.trim()
  ) {
    return item.address.trim();
  }

  if (
    item.address &&
    typeof item.address === 'object'
  ) {
    const addressObject = item.address;

    const parts = [
      addressObject.house_number,
      addressObject.number,
      addressObject.street_number,
      addressObject.street,
      addressObject.road,
      addressObject.route,
      addressObject.neighborhood,
      addressObject.quartier,
      addressObject.district,
      addressObject.commune,
      addressObject.city,
      addressObject.town,
      addressObject.village,
      addressObject.region,
      addressObject.province,
      addressObject.state,
      addressObject.postal_code,
      addressObject.country,
    ];

    const uniqueParts = [
      ...new Set(
        parts
          .filter(Boolean)
          .map((value) => String(value).trim())
          .filter(Boolean)
      ),
    ];

    if (uniqueParts.length > 0) {
      return uniqueParts.join(', ');
    }
  }

  if (
    typeof item.formatted_address === 'string' &&
    item.formatted_address.trim()
  ) {
    return item.formatted_address.trim();
  }

  const parts = [
    item.house_number,
    item.street_number,
    item.street,
    item.road,
    item.route,
    item.address_line,
    item.address_line1,
    item.address_line2,
    item.neighborhood,
    item.quartier,
    item.fokontany,
    item.district,
    item.commune,
    item.city,
    item.town,
    item.village,
    item.region,
    item.province,
    item.state,
    item.postal_code,
    item.zip_code,
    item.country,
  ];

  const uniqueParts = [
    ...new Set(
      parts
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
    ),
  ];

  if (uniqueParts.length > 0) {
    return uniqueParts.join(', ');
  }

  const fallbackParts = [
    item.location_name,
    item.location,
    item.locality,
  ];

  const fallback = fallbackParts
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (fallback.length > 0) {
    return [...new Set(fallback)].join(', ');
  }

  return 'Adresse non renseignée';
};

export const getLatitude = (item) => {
  if (!item) return null;

  const value =
    item.latitude ??
    item.lat ??
    item.location?.latitude ??
    item.last_location?.latitude ??
    item.last_location?.coordinates?.[1];

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

export const getLongitude = (item) => {
  if (!item) return null;

  const value =
    item.longitude ??
    item.lng ??
    item.lon ??
    item.location?.longitude ??
    item.last_location?.longitude ??
    item.last_location?.coordinates?.[0];

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

/* ============================================================
   TOAST
============================================================ */

export const useAdminToast = () => {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, type = 'success', duration = 3200) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, type });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { toast, showToast };
};

export const AdminToast = ({ toast }) => {
  const { colors: themeColors } = useTheme();
  if (!toast) return null;

  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';
  const isInfo = toast.type === 'info';
  const toastColor = isError
    ? '#E74C3C'
    : isWarning
    ? '#F5A623'
    : isInfo
    ? '#3B82F6'
    : '#27AE60';
  const iconName = isError
    ? 'close-circle'
    : isWarning
    ? 'warning'
    : isInfo
    ? 'information-circle'
    : 'checkmark-circle';

  return (
    <View pointerEvents="none" style={styles.toastPosition}>
      <View
        style={[
          styles.toast,
          { backgroundColor: themeColors.surface, borderLeftColor: toastColor },
        ]}
      >
        <View style={[styles.toastIcon, { backgroundColor: toastColor + '15' }]}>
          <Ionicons name={iconName} size={20} color={toastColor} />
        </View>
        <Text
          numberOfLines={3}
          style={[styles.toastText, { color: themeColors.text }]}
        >
          {toast.message}
        </Text>
      </View>
    </View>
  );
};

/* ============================================================
   TÉLÉCHARGEMENT (web : fetch + blob avec le token ; mobile : Linking)
============================================================ */

const getAuthToken = async () => {
  const possibleKeys = [
    'authToken',
    'token',
    'accessToken',
    'access_token',
    'jwt',
    'userToken',
  ];

  try {
    for (const key of possibleKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object' && parsed.token) {
            return parsed.token;
          }
        } catch {
          // valeur non JSON : probablement le token brut
        }
        return value;
      }
    }
  } catch (err) {
    console.warn('Impossible de récupérer le token auth:', err);
  }

  return null;
};

export const downloadAdminDocument = async (
  url,
  suggestedFileName = 'document.pdf',
  showToast = () => {}
) => {
  if (!url) {
    showToast('Document indisponible', 'error');
    return;
  }

  try {
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

    if (IS_WEB) {
      const token = await getAuthToken();
      const response = await fetch(fullUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Accès refusé : vous devez être connecté en tant qu'administrateur"
          );
        }
        throw new Error(`Erreur ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      let fileName = suggestedFileName;
      const disposition = response.headers.get('content-disposition');
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) fileName = match[1];
      }

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      showToast('Téléchargement démarré', 'success');
    } else {
      const canOpen = await Linking.canOpenURL(fullUrl);
      if (canOpen) {
        await Linking.openURL(fullUrl);
      } else {
        showToast('Impossible d’ouvrir le document', 'error');
      }
    }
  } catch (err) {
    console.error('Download error:', err);
    showToast(err?.message || 'Échec du téléchargement', 'error');
  }
};

/* ============================================================
   LAYOUT RESPONSIVE
============================================================ */

export const useDetailLayout = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isWide = width >= 1000;
  const padding = isMobile ? 12 : width >= 1280 ? 32 : 22;
  return { width, isMobile, isWide, padding };
};

/* ============================================================
   SCAFFOLD — header + zone défilante
   Le header passe en mode « fusionné » sur le web large (titre + retour
   dans la sous-barre de la TopNavBar), comme la page IA.
============================================================ */

export const DetailScaffold = ({
  title,
  subtitle,
  toast,
  refreshing = false,
  onRefresh,
  children,
}) => {
  const { colors: themeColors } = useTheme();
  const { padding } = useDetailLayout();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.flex, { backgroundColor: themeColors.background }]}>
        <Header title={title} subtitle={subtitle} showBack mergeWithTopNav />

        <AdminToast toast={toast} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: padding, paddingTop: padding > 20 ? 22 : 14 },
          ]}
          showsVerticalScrollIndicator={IS_WEB}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          overScrollMode="always"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          <View style={styles.pageInner}>{children}</View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export const DetailLoading = ({ text = 'Chargement...' }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.centerBox}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>{text}</Text>
    </View>
  );
};

export const DetailNotFound = ({ text, onBack }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.centerBox}>
      <Ionicons name="alert-circle-outline" size={44} color="#E74C3C" />
      <Text style={[styles.centerTitle, { color: themeColors.text }]}>{text}</Text>
      <TouchableOpacity
        onPress={onBack}
        activeOpacity={0.85}
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
      >
        <Ionicons name="arrow-back" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Retour à la liste</Text>
      </TouchableOpacity>
    </View>
  );
};

/* Grand écran : colonne gauche = `top` + `side` (profil, statut, actions),
   colonne droite = `main` (détails). Mobile : une seule colonne dans l'ordre
   top -> main -> side (les actions en bas de page). */
export const DetailColumns = ({ top, side, main }) => {
  const { isWide } = useDetailLayout();

  if (!isWide) {
    return (
      <View>
        {top}
        {main}
        {side}
      </View>
    );
  }

  return (
    <View style={styles.columns}>
      <View style={styles.columnLeft}>
        {top}
        {side}
      </View>
      <View style={styles.columnRight}>{main}</View>
    </View>
  );
};

/* ============================================================
   CARD / SECTION
============================================================ */

export const DetailCard = ({ title, icon, right, children, style, tint }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { isMobile } = useDetailLayout();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tint || themeColors.surface,
          borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)',
          padding: isMobile ? 14 : 18,
        },
        style,
      ]}
    >
      {title ? (
        <View style={styles.cardHeader}>
          {icon ? (
            <View style={[styles.cardIcon, { backgroundColor: colors.primary + '14' }]}>
              <Ionicons name={icon} size={17} color={colors.primary} />
            </View>
          ) : null}
          <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
};

export const InfoGrid = ({ children }) => <View style={styles.infoGrid}>{children}</View>;

export const InfoItem = ({ icon, label, value, valueColor, full = false }) => {
  const { colors: themeColors, isDark } = useTheme();
  const { isMobile } = useDetailLayout();
  const single = isMobile || full;

  return (
    <View
      style={[
        styles.infoItem,
        {
          width: single ? '100%' : '49%',
          backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : '#F8FAFC',
          borderColor: themeColors.border || 'rgba(15,23,42,0.06)',
        },
      ]}
    >
      {icon ? (
        <View style={styles.infoItemIcon}>
          <Ionicons name={icon} size={15} color={colors.primary} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text style={[styles.infoItemLabel, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        <Text
          style={[styles.infoItemValue, { color: valueColor || themeColors.text }]}
          selectable
        >
          {value === undefined || value === null || value === '' ? '—' : String(value)}
        </Text>
      </View>
    </View>
  );
};

/* ============================================================
   BADGE / AVATAR / PROFILE
============================================================ */

export const Badge = ({ label, color, dot = false }) => (
  <View style={[styles.badge, { backgroundColor: color + '14' }]}>
    {dot ? <View style={[styles.badgeDot, { backgroundColor: color }]} /> : null}
    <Text numberOfLines={1} style={[styles.badgeText, { color }]}>
      {label}
    </Text>
  </View>
);

export const DetailAvatar = ({ uri, name, color = colors.primary, size = 84, online }) => {
  const { colors: themeColors } = useTheme();
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const radius = size * 0.28;
  const dot = Math.max(size * 0.22, 12);

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius, backgroundColor: color + '18' }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: color + '18',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color, fontSize: size * 0.4, fontWeight: '800' }}>{initial}</Text>
        </View>
      )}

      {online !== undefined ? (
        <View
          style={{
            position: 'absolute',
            right: -dot * 0.1,
            bottom: -dot * 0.1,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            borderWidth: 2,
            borderColor: themeColors.surface || '#fff',
            backgroundColor: online ? '#27AE60' : '#999999',
          }}
        />
      ) : null}
    </View>
  );
};

export const ProfileHero = ({ avatar, name, email, badges, deleted }) => {
  const { colors: themeColors } = useTheme();
  const { isMobile } = useDetailLayout();

  return (
    <DetailCard>
      <View style={[styles.hero, isMobile && styles.heroMobile]}>
        {avatar}
        <View style={[styles.heroInfo, isMobile && styles.heroInfoMobile]}>
          <Text style={[styles.heroName, { color: themeColors.text }]} selectable>
            {name}
            {deleted ? <Text style={styles.deletedTag}> (Supprimé)</Text> : null}
          </Text>
          <Text style={[styles.heroEmail, { color: themeColors.textSecondary }]} selectable>
            {email}
          </Text>
          {badges ? <View style={styles.badgeRow}>{badges}</View> : null}
        </View>
      </View>
    </DetailCard>
  );
};

/* ============================================================
   DOCUMENT (CIN / certificat) — aperçu + zoom + téléchargement
============================================================ */

export const DocumentBlock = ({
  url,
  viewerTitle,
  fileName,
  downloadLabel = 'Télécharger',
  missingText = 'Aucun document',
  onOpen,
  onDownload,
}) => {
  const { colors: themeColors, isDark } = useTheme();

  if (!url) {
    return (
      <View style={[styles.missingBox, { backgroundColor: isDark ? 'rgba(220,38,38,0.08)' : '#FEF2F2' }]}>
        <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
        <Text style={styles.missingText}>{missingText}</Text>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => onOpen && onOpen(url, viewerTitle, fileName)}
        style={[styles.docPreview, { backgroundColor: isDark ? '#111827' : '#F1F5F9' }]}
      >
        {isPdfUrl(url) ? (
          <View style={styles.pdfBox}>
            <Ionicons name="document-text-outline" size={34} color={colors.primary} />
            <Text style={[styles.pdfText, { color: themeColors.textSecondary }]}>
              Document PDF — appuyer pour agrandir
            </Text>
          </View>
        ) : (
          <Image source={{ uri: url }} style={styles.docImage} resizeMode="contain" />
        )}

        <View style={styles.zoomBadge}>
          <Ionicons name="expand-outline" size={13} color="#fff" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onDownload && onDownload(url, fileName)}
        style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 10 }]}
      >
        <Ionicons name="download-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>{downloadLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

/* ============================================================
   BOUTONS D'ACTION
============================================================ */

export const ActionButton = ({ icon, label, color, onPress, disabled, loading }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    disabled={disabled || loading}
    style={[styles.actionButton, { backgroundColor: color, opacity: disabled ? 0.55 : 1 }]}
  >
    {loading ? (
      <ActivityIndicator size="small" color="#fff" />
    ) : (
      <Ionicons name={icon} size={18} color="#fff" />
    )}
    <Text style={styles.actionButtonText}>{label}</Text>
  </TouchableOpacity>
);

export const ActionRow = ({ children }) => <View style={styles.actionRow}>{children}</View>;

/* ============================================================
   VISIONNEUSE PLEIN ÉCRAN
============================================================ */

export const AdminImageViewer = ({ viewer, onClose, onDownload }) => {
  const visible = !!viewer?.uri;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerOverlay}>
        <View style={styles.viewerHeader}>
          <Text style={styles.viewerTitle} numberOfLines={1}>
            {viewer?.title}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.viewerClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.viewerBody}
          maximumZoomScale={3}
          minimumZoomScale={1}
        >
          {isPdfUrl(viewer?.uri) ? (
            <View style={styles.viewerPdf}>
              <Ionicons name="document-text-outline" size={64} color="#fff" />
              <Text style={styles.viewerPdfText}>
                Aperçu indisponible pour les fichiers PDF.{'\n'}Utilisez le bouton de
                téléchargement ci-dessous.
              </Text>
            </View>
          ) : (
            <Image source={{ uri: viewer?.uri }} style={styles.viewerImage} resizeMode="contain" />
          )}
        </ScrollView>

        <TouchableOpacity
          onPress={() => onDownload && onDownload(viewer?.uri, viewer?.fileName)}
          style={[styles.primaryButton, styles.viewerDownload, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Ionicons name="download-outline" size={19} color="#fff" />
          <Text style={styles.primaryButtonText}>Télécharger</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

/* ============================================================
   CONFIRMATION (module-level : le TextInput du motif ne perd jamais le focus)
============================================================ */

export const AdminConfirmDialog = ({
  visible,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  destructive = false,
  loading = false,
  withReason = false,
  reasonLabel = 'Motif',
  reasonPlaceholder = 'Saisissez le motif...',
  onConfirm,
  onCancel,
}) => {
  const { colors: themeColors } = useTheme();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const accent = destructive ? '#E74C3C' : '#27AE60';
  const canConfirm = !loading && (!withReason || reason.trim().length > 0);

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={() => !loading && onCancel()}>
      <KeyboardAvoidingView
        style={styles.dialogOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.dialog, { backgroundColor: themeColors.surface }]}>
          <View style={[styles.dialogIcon, { backgroundColor: accent + '18' }]}>
            <Ionicons
              name={destructive ? 'alert-circle' : 'checkmark-circle'}
              size={34}
              color={accent}
            />
          </View>

          <Text style={[styles.dialogTitle, { color: themeColors.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.dialogMessage, { color: themeColors.textSecondary }]}>{message}</Text>
          ) : null}

          {withReason ? (
            <View style={styles.reasonBox}>
              <Text style={[styles.reasonLabel, { color: themeColors.textSecondary }]}>{reasonLabel} *</Text>
              <TextInput
                style={[
                  styles.reasonInput,
                  { color: themeColors.text, borderColor: themeColors.border || '#E0E0E0' },
                ]}
                value={reason}
                onChangeText={(text) => setReason(String(text || '').slice(0, 500))}
                placeholder={reasonPlaceholder}
                placeholderTextColor={themeColors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>
          ) : null}

          <View style={styles.dialogButtons}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              style={[styles.dialogButton, { backgroundColor: themeColors.background }]}
            >
              <Text style={[styles.dialogButtonText, { color: themeColors.text }]}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => canConfirm && onConfirm(reason.trim())}
              disabled={!canConfirm}
              style={[styles.dialogButton, { backgroundColor: accent, opacity: canConfirm ? 1 : 0.55 }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.dialogButtonText, { color: '#fff' }]}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  safeArea: { flex: 1 },
  scroll: { flex: 1, minHeight: 0, width: '100%' },
  scrollContent: { flexGrow: 1, paddingBottom: 56 },
  pageInner: { width: '100%', maxWidth: 1120, alignSelf: 'center' },

  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  centerText: { fontSize: 14 },
  centerTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },

  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  columnLeft: { width: 340 },
  columnRight: { flex: 1, minWidth: 0 },

  card: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(15,23,42,0.05)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', lineHeight: 22 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  infoItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoItemLabel: { fontSize: 11, fontWeight: '600', lineHeight: 15 },
  infoItemValue: { fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 2 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroMobile: { flexDirection: 'column', alignItems: 'center' },
  heroInfo: { flex: 1, minWidth: 0 },
  heroInfoMobile: { alignItems: 'center', width: '100%' },
  heroName: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  heroEmail: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  deletedTag: { color: '#E74C3C', fontSize: 13, fontWeight: '700' },

  docPreview: { borderRadius: 14, overflow: 'hidden', minHeight: 150, justifyContent: 'center' },
  docImage: { width: '100%', height: 230 },
  pdfBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 38, gap: 8 },
  pdfText: { fontSize: 13 },
  zoomBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 13 },
  missingText: { flex: 1, color: '#DC2626', fontSize: 13, lineHeight: 19 },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 46,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: {
    flexGrow: 1,
    flexBasis: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    minHeight: 46,
  },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', paddingTop: Platform.OS === 'android' ? 34 : 18 },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
  viewerTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  viewerClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerBody: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  viewerImage: { width: '100%', height: 560, maxWidth: 1000 },
  viewerPdf: { alignItems: 'center', gap: 12, padding: 24 },
  viewerPdfText: { color: '#fff', textAlign: 'center', fontSize: 14, lineHeight: 21 },
  viewerDownload: { margin: 16, alignSelf: 'center' },

  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: { width: '100%', maxWidth: 440, borderRadius: 20, padding: 22, alignItems: 'center' },
  dialogIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  dialogTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', lineHeight: 24 },
  dialogMessage: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  reasonBox: { width: '100%', marginTop: 14 },
  reasonLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  reasonInput: {
    width: '100%',
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  dialogButtons: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  dialogButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dialogButtonText: { fontSize: 14, fontWeight: '700' },

  toastPosition: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
    paddingHorizontal: 16,
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  toastIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toastText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
