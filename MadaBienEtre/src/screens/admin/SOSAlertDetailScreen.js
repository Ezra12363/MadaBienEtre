// src/screens/admin/SOSAlertDetailScreen.js
//
// Page « Détails alerte SOS » (admin) : page à part entière avec header + navigation,
// responsive web / mobile (2 colonnes sur grand écran). Personne, message, adresse,
// carte satellite, contacts d'urgence, suivi, messagerie vers la personne et résolution.
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  TextInput,
  Linking,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../components/common/ToastBanner';
import MapViewWrapper from '../../components/map/MapViewWrapper';
import { MAP_TYPES } from '../../config/googleMaps';
import sosService from '../../services/sosService';
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_BADGES,
  TypeBadge,
  Avatar,
  fmtDate,
  roleLabel,
} from '../../components/sos/sosAdminShared';

// ⚠️ Ces composants DOIVENT rester hors de SOSAlertDetailScreen : définis dans le
// composant, ils seraient recréés à chaque frappe et le TextInput perdrait le focus.
const Row = ({ label, value, onPress, valueColor }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: themeColors.border || '#E8E8E8' }]}>
      <Text style={[styles.rowLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.rowValue, { color: valueColor || (onPress ? colors.primary : themeColors.text) }, onPress && styles.link]}
        onPress={onPress}
      >
        {value}
      </Text>
    </View>
  );
};

const Card = ({ title, icon, children }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      {title ? (
        <View style={styles.cardTitleRow}>
          {icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
};

const SOSAlertDetailScreen = ({ route, navigation }) => {
  const { colors: themeColors } = useTheme();
  const { toast, showToast } = useToast();
  const { width } = useWindowDimensions();
  const isWide = width >= 900; // web / tablette : pleine largeur en 2 colonnes
  const isXL = width >= 1500; // très grand écran : colonnes plus aérées
  const alertId = route?.params?.alertId ?? route?.params?.alert?.id;

  const [d, setD] = useState(route?.params?.alert || null);
  const [loading, setLoading] = useState(!route?.params?.alert);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [geoAddress, setGeoAddress] = useState(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    if (!alertId) return;
    const r = await sosService.getSOSAdminDetail(alertId);
    if (!mounted.current) return;
    if (r.success) {
      setD(r.data);
      setError(null);
      if (!r.data.address && r.data.latitude != null) {
        sosService.getAddress(r.data.latitude, r.data.longitude).then((a) => mounted.current && setGeoAddress(a));
      }
    } else {
      setError(r.error || "Impossible de charger l'alerte");
    }
    setLoading(false);
  }, [alertId]);

  useFocusEffect(
    useCallback(() => {
      load();
      // rafraîchissement auto tant que l'alerte est active (position, annulation...)
      const timer = setInterval(load, 15000);
      return () => clearInterval(timer);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('SOSAlerts'));
  const call = (phone) => phone && Linking.openURL(`tel:${phone}`);
  const openUrl = (url) => url && Linking.openURL(url);

  const addNote = async () => {
    const text = note.trim();
    if (!text) return;
    setBusy(true);
    const r = await sosService.addSOSNote(alertId, text);
    setBusy(false);
    if (!r.success) return showToast('error', r.error);
    setNote('');
    showToast('success', 'Note enregistrée.');
    load();
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    const r = await sosService.sendSOSMessage(alertId, text);
    setBusy(false);
    if (!r.success) return showToast('error', r.error);
    setMessage('');
    showToast('success', `Message envoyé : ${d?.user || 'la personne'} a reçu une notification.`);
    load();
  };

  const doResolve = async () => {
    setBusy(true);
    const r = await sosService.closeSOSAlert(alertId, note.trim(), message.trim());
    setBusy(false);
    setConfirmVisible(false);
    if (!r.success) return showToast('error', r.error || "Impossible de résoudre l'alerte");
    setNote('');
    setMessage('');
    showToast('success', 'Alerte résolue — la personne a été notifiée.');
    load();
  };

  const sev = SEVERITY_COLORS[d?.severity] || '#999';
  const address = d?.address || geoAddress;
  const isActive = d?.status === 'active';
  const hasPos = d?.latitude != null && d?.longitude != null;
  const satelliteUrl = hasPos ? sosService.getSatelliteLink(d.latitude, d.longitude) : null;

  const left = d && (
    <View style={isWide ? styles.colLeft : null}>
      <Card>
        <View style={styles.personRow}>
          <Avatar uri={d.user_photo} name={d.user} size={64} />
          <View style={{ marginLeft: spacing.md, flexShrink: 1 }}>
            <Text style={[styles.personName, { color: themeColors.text }]}>{d.user || '—'}</Text>
            <Text style={[styles.meta, { color: themeColors.textSecondary }]}>{roleLabel(d)}</Text>
            <TypeBadge type={d.alert_type} />
          </View>
        </View>
        <View style={[styles.sevBanner, { backgroundColor: sev + '20' }]}>
          <Ionicons name="alert-circle" size={22} color={sev} />
          <Text style={[styles.sevText, { color: sev }]}>Gravité : {SEVERITY_LABELS[d.severity] || d.severity}</Text>
        </View>
        {d.details ? (
          <View style={[styles.messageBox, { backgroundColor: sev + '12' }]}>
            <Text style={[styles.messageLabel, { color: themeColors.textSecondary }]}>Message de {d.user} :</Text>
            <Text style={[styles.messageText, { color: themeColors.text }]}>{d.details}</Text>
          </View>
        ) : null}
        <View style={styles.actionsRow}>
          {d.user_phone ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => call(d.user_phone)}>
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={styles.actionText}>Appeler</Text>
            </TouchableOpacity>
          ) : null}
          {satelliteUrl ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2D7FF9' }]} onPress={() => openUrl(satelliteUrl)}>
              <Ionicons name="map" size={18} color="#fff" />
              <Text style={styles.actionText}>Google Maps (satellite)</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Card>

      <Card title="Informations" icon="information-circle-outline">
        <Row label="Téléphone" value={d.user_phone || '—'} onPress={d.user_phone ? () => call(d.user_phone) : undefined} />
        {d.user_email ? <Row label="Email" value={d.user_email} /> : null}
        <Row label="Type d'alerte" value={(TYPE_BADGES[d.alert_type] || TYPE_BADGES.other).label} />
        <Row label="Statut" value={STATUS_LABELS[d.status] || d.status} valueColor={STATUS_COLORS[d.status]} />
        <Row label="Date et heure" value={fmtDate(d.created_at)} />
        <Row label="Adresse" value={address || 'Adresse non disponible'} />
        <Row label="Coordonnées" value={hasPos ? sosService.formatCoordinates(d.latitude, d.longitude) : 'Non disponible'} />
        {d.booking ? (
          <Row label="Réservation" value={`#${d.booking.id} (${d.booking.status})`} />
        ) : d.booking_id ? (
          <Row label="Réservation" value={`#${d.booking_id}`} />
        ) : null}
        {d.booking?.address ? <Row label="Adresse de la résa" value={d.booking.address} /> : null}
        {d.responder ? <Row label="Pris en charge par" value={d.responder} /> : null}
        {d.resolved_at ? <Row label="Résolue le" value={fmtDate(d.resolved_at)} /> : null}
        {d.cancelled_at ? <Row label="Annulée le" value={fmtDate(d.cancelled_at)} /> : null}
      </Card>

      <Card title="Lieu de l'incident" icon="location-outline">
        {hasPos ? (
          <View style={styles.mapBox}>
            <MapViewWrapper
              style={[styles.map, isWide && { height: 440 }]}
              initialRegion={{ latitude: Number(d.latitude), longitude: Number(d.longitude), latitudeDelta: 0.004, longitudeDelta: 0.004 }}
              mapType={MAP_TYPES.hybrid}
              showUserLocation={false}
              trackUserLocation={false}
              gestureHandling="cooperative"
              markers={[
                {
                  id: `sos-${d.id}`,
                  coordinate: { latitude: Number(d.latitude), longitude: Number(d.longitude) },
                  title: `${d.user || 'SOS'} — ${fmtDate(d.created_at)}`,
                  description: address || sosService.formatCoordinates(d.latitude, d.longitude),
                  pinColor: '#D32F2F',
                },
              ]}
            />
            <View style={styles.mapCaption}>
              <Avatar uri={d.user_photo} name={d.user} size={34} />
              <View style={{ marginLeft: spacing.sm, flexShrink: 1 }}>
                <Text style={styles.mapCaptionName} numberOfLines={1}>{d.user} · {fmtDate(d.created_at)}</Text>
                <Text style={styles.mapCaptionAddr} numberOfLines={2}>
                  {address || sosService.formatCoordinates(d.latitude, d.longitude)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={[styles.meta, { color: themeColors.textSecondary }]}>Position GPS non disponible pour cette alerte.</Text>
        )}
      </Card>
    </View>
  );

  const right = d && (
    <View style={isWide ? styles.colRight : null}>
      {isActive ? (
        <Card title={`Message à ${d.user || 'la personne'}`} icon="chatbubble-ellipses-outline">
          <TextInput
            style={[styles.input, { color: themeColors.text, borderColor: themeColors.border || '#E0E0E0' }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Ex : Nous avons bien reçu votre alerte, un agent vous appelle..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#2D7FF9', opacity: message.trim() && !busy ? 1 : 0.5 }]}
            onPress={sendMessage}
            disabled={!message.trim() || busy}
          >
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.btnText}>Envoyer le message (sans résoudre)</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
            Si vous cliquez sur « Résoudre », ce texte est aussi envoyé comme message final.
          </Text>
        </Card>
      ) : null}

      {d.emergency_contacts?.length > 0 && (
        <Card title="Contacts d'urgence" icon="people-outline">
          {d.emergency_contacts.map((c) => (
            <TouchableOpacity key={c.id} style={styles.contactRow} onPress={() => call(c.phone)}>
              <Ionicons name="call-outline" size={16} color={colors.primary} />
              <Text style={[styles.contactText, { color: themeColors.text }]}>
                {c.name}{c.relationship ? ` (${c.relationship})` : ''}{c.is_primary ? ' ★' : ''} — {c.phone}
              </Text>
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {d.safety_checks?.length > 0 && (
        <Card title="Safety checks" icon="shield-checkmark-outline">
          {d.safety_checks.map((c) => (
            <Text key={c.id} style={[styles.contactText, { color: themeColors.textSecondary, marginBottom: 4 }]}>
              {c.check_type} — {c.status}{c.checked_at ? ` (${fmtDate(c.checked_at)})` : ''}
            </Text>
          ))}
        </Card>
      )}

      <Card title="Suivi / actions menées" icon="clipboard-outline">
        <Text style={[styles.notes, { color: themeColors.textSecondary }]}>
          {d.response_notes || 'Aucune action enregistrée.'}
        </Text>
        {isActive ? (
          <>
            <TextInput
              style={[styles.input, { color: themeColors.text, borderColor: themeColors.border || '#E0E0E0' }]}
              value={note}
              onChangeText={setNote}
              placeholder="Ex : personne jointe par téléphone, intervention en cours..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: note.trim() && !busy ? 1 : 0.5 }]}
              onPress={addNote}
              disabled={!note.trim() || busy}
            >
              <Text style={styles.btnText}>Enregistrer la note</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </Card>

      {isActive ? (
        <TouchableOpacity
          style={[styles.resolveBtn, { backgroundColor: colors.success || '#27AE60', opacity: busy ? 0.6 : 1 }]}
          onPress={() => setConfirmVisible(true)}
          disabled={busy}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.resolveText}>Résoudre l'alerte</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.doneBox, { backgroundColor: (STATUS_COLORS[d.status] || '#999') + '18' }]}>
          <Ionicons name={d.status === 'resolved' ? 'checkmark-circle' : 'close-circle'} size={22} color={STATUS_COLORS[d.status] || '#999'} />
          <Text style={[styles.doneText, { color: STATUS_COLORS[d.status] || '#999' }]}>
            {d.status === 'resolved' ? 'Alerte résolue' : 'Alerte annulée par la personne'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title={`Détails alerte SOS${alertId ? ` #${alertId}` : ''}`} showBack onBackPress={goBack} />
        {toast}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !d ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
            <Text style={[styles.meta, { color: themeColors.text, marginTop: spacing.sm }]}>{error || 'Alerte introuvable'}</Text>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, marginTop: spacing.md, paddingHorizontal: spacing.lg }]} onPress={goBack}>
              <Text style={styles.btnText}>Retour</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, isWide && { padding: isXL ? spacing.xl : spacing.lg }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          >
            <View style={[styles.inner, isWide && styles.innerWide]}>
              {left}
              {right}
            </View>
          </ScrollView>
        )}

        <ConfirmModal
          visible={confirmVisible}
          title="Résoudre cette alerte ?"
          message={`Confirmez-vous que la situation de ${d?.user || 'la personne'} est traitée ?`}
          icon="checkmark-circle"
          iconColor="#27AE60"
          confirmText="Oui, résoudre"
          confirmColor="#27AE60"
          loading={busy}
          onConfirm={doResolve}
          onCancel={() => setConfirmVisible(false)}
        >
          <View style={[styles.preview, { backgroundColor: themeColors.background }]}>
            <Text style={[styles.previewLabel, { color: themeColors.textSecondary }]}>
              Message envoyé à {d?.user || 'la personne'} :
            </Text>
            <Text style={[styles.previewText, { color: themeColors.text }]}>
              {message.trim() || "Votre alerte SOS a été traitée par l'équipe Mada Bien-être. (message par défaut)"}
            </Text>
          </View>
        </ConfirmModal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl * 2 },
  inner: { width: '100%' },
  innerWide: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  colLeft: { flex: 1, flexBasis: 0, minWidth: 0 },
  colRight: { flex: 1, flexBasis: 0, minWidth: 0 },
  card: {
    borderRadius: 16, padding: spacing.md, marginBottom: spacing.md, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  cardTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
  personRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  personName: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold },
  meta: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  sevBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 10 },
  sevText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
  messageBox: { borderRadius: 10, padding: spacing.sm, marginTop: spacing.sm },
  messageLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, marginBottom: 2 },
  messageText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, lineHeight: 22 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 12 },
  actionText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, gap: spacing.md },
  rowLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  rowValue: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, flexShrink: 1, textAlign: 'right' },
  link: { textDecorationLine: 'underline' },
  mapBox: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E0E0' },
  map: { height: 320, width: '100%' },
  mapCaption: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: '#000000AA' },
  mapCaptionName: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  mapCaptionAddr: { color: '#eee', fontSize: typography.fontSize.xs },
  input: { borderWidth: 1, borderRadius: 12, padding: spacing.sm, minHeight: 70, textAlignVertical: 'top', fontSize: typography.fontSize.sm },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: spacing.sm, marginTop: spacing.sm },
  btnText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  hint: { fontSize: typography.fontSize.xs, marginTop: 6 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  contactText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, flexShrink: 1 },
  notes: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, lineHeight: 20, marginBottom: spacing.sm },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.md, borderRadius: 14 },
  resolveText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
  doneBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.md, borderRadius: 14 },
  doneText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
  preview: { width: '100%', borderRadius: 12, padding: spacing.sm, marginTop: spacing.md },
  previewLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, marginBottom: 2 },
  previewText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, lineHeight: 20 },
});

export default SOSAlertDetailScreen;
