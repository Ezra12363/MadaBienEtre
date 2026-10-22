// src/screens/admin/SOSAlertsScreen.js
//
// Centre d'alertes SOS (admin) : alertes actives, détail (personne, réservation,
// position, contacts d'urgence), appel, journal de suivi, résolution et historique.
// Données RÉELLES uniquement (plus de fausses alertes de démonstration).
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
  Modal,
  ScrollView,
  TextInput,
  Linking,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import sosService from '../../services/sosService';
import { notify } from '../../utils/confirm';
import MapViewWrapper from '../../components/map/MapViewWrapper';
import { MAP_TYPES } from '../../config/googleMaps';
import { API_URL } from '../../config/env';

const POLL_MS = 15000;

const TYPE_LABELS = {
  client: '👤 Client',
  therapist: '💆 Thérapeute',
  emergency: '🚨 Urgence',
  other: '❓ Autre',
};
const SEVERITY_COLORS = { low: '#4CAF50', medium: '#F5A623', high: '#E74C3C', critical: '#D32F2F' };
const SEVERITY_LABELS = { low: '🟢 Faible', medium: '🟡 Moyenne', high: '🔴 Élevée', critical: '🔴 Critique' };
const STATUS_LABELS = { active: '🟢 Active', resolved: '✅ Résolue', cancelled: '⚪ Annulée' };
const STATUS_COLORS = { active: '#E74C3C', resolved: '#27AE60', cancelled: '#999' };

const fmtDate = (d) => (d ? new Date(d.endsWith?.('Z') || /[+-]\d\d:?\d\d$/.test(d) ? d : `${d}Z`).toLocaleString('fr-FR') : 'N/A');

const ROLE_LABELS = { CLIENT: '👤 Client', THERAPIST: '💆 Thérapeute', ADMIN: '🛡️ Admin' };
const roleLabel = (a) => ROLE_LABELS[String(a?.user_role || '').toUpperCase()] || TYPE_LABELS[a?.alert_type] || '—';

const photoUrl = (u) => {
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`;
};

// Photo de profil, sinon initiale.
const Avatar = ({ uri, name, size = 44 }) => {
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

const SOSAlertsScreen = () => {
  const { colors: themeColors } = useTheme();
  const [tab, setTab] = useState('active'); // active | history
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(null); // alerte (liste)
  const [detail, setDetail] = useState(null); // détail complet
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [geoAddress, setGeoAddress] = useState(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async (currentTab, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [list, st] = await Promise.all([
      currentTab === 'active' ? sosService.getActiveSOSAlerts() : sosService.getSOSHistory({ limit: 100 }),
      sosService.getSOSStats(),
    ]);
    if (!mounted.current) return;
    if (list.success) {
      setAlerts(Array.isArray(list.data) ? list.data : []);
      setError(null);
    } else {
      setError(list.error || 'Impossible de charger les alertes');
    }
    if (st.success) setStats(st.data);
    setLoading(false);
  }, []);

  // Rechargement à l'ouverture + rafraîchissement auto toutes les 15 s (alertes actives).
  useFocusEffect(
    useCallback(() => {
      load(tab);
      const timer = setInterval(() => load(tab, { silent: true }), POLL_MS);
      return () => clearInterval(timer);
    }, [tab, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(tab, { silent: true });
    setRefreshing(false);
  };

  const openDetail = async (item) => {
    setSelected(item);
    setDetail(null);
    setNote('');
    setMessage('');
    setGeoAddress(null);
    setDetailLoading(true);
    const r = await sosService.getSOSAdminDetail(item.id);
    if (!mounted.current) return;
    setDetailLoading(false);
    if (r.success) {
      setDetail(r.data);
      const a = r.data;
      if (!a.address && a.latitude != null) {
        sosService.getAddress(a.latitude, a.longitude).then((addr) => mounted.current && setGeoAddress(addr));
      }
    } else notify('Erreur', r.error);
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
  };

  const refreshDetail = async (id) => {
    const r = await sosService.getSOSAdminDetail(id);
    if (r.success && mounted.current) setDetail(r.data);
  };

  const addNote = async () => {
    const text = note.trim();
    if (!text || !selected) return;
    setBusy(true);
    const r = await sosService.addSOSNote(selected.id, text);
    setBusy(false);
    if (!r.success) return notify('Erreur', r.error);
    setNote('');
    await refreshDetail(selected.id);
    load(tab, { silent: true });
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || !selected) return;
    setBusy(true);
    const r = await sosService.sendSOSMessage(selected.id, text);
    setBusy(false);
    if (!r.success) return notify('Erreur', r.error);
    setMessage('');
    notify('✅ Message envoyé', `${selected.user || 'La personne'} a reçu une notification.`);
    await refreshDetail(selected.id);
    load(tab, { silent: true });
  };

  const doResolve = async (id, pendingNote, pendingMessage) => {
    setBusy(true);
    const r = await sosService.closeSOSAlert(id, pendingNote, pendingMessage);
    setBusy(false);
    if (!r.success) {
      notify('Erreur', r.error || "Impossible de résoudre l'alerte");
      return;
    }
    closeDetail();
    load(tab, { silent: true });
    notify('✅ Alerte résolue', 'La personne a été notifiée.');
  };

  const resolve = () => {
    if (!selected) return;
    const id = selected.id;
    const pendingNote = note.trim();
    const pendingMessage = message.trim();
    const body = pendingMessage
      ? `Votre message sera envoyé à ${selected.user || 'la personne'} :\n\n« ${pendingMessage} »`
      : "La personne recevra la notification par défaut « alerte traitée ». Vous pouvez d'abord lui écrire un message.";
    // Alert.alert à boutons est ignoré sur le web : on y utilise confirm().
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-undef
      if (window.confirm(`Résoudre l'alerte ?\n\n${body}`)) doResolve(id, pendingNote, pendingMessage);
      return;
    }
    Alert.alert("Résoudre l'alerte", body, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Résoudre', onPress: () => doResolve(id, pendingNote, pendingMessage) },
    ]);
  };

  const call = (phone) => phone && Linking.openURL(`tel:${phone}`);
  const openMap = (url) => url && Linking.openURL(url);

  const activeCount = stats?.active_alerts ?? (tab === 'active' ? alerts.length : 0);
  const toHandle = tab === 'active' ? alerts.filter((a) => !a.responded_by).length : 0;

  const renderAlert = ({ item }) => {
    const sev = SEVERITY_COLORS[item.severity] || '#999';
    const satellite = sosService.getSatelliteLink(item.latitude, item.longitude);
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: themeColors.surface, borderLeftColor: sev, borderLeftWidth: 4 }]}
        onPress={() => openDetail(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Avatar uri={item.user_photo} name={item.user} />
            <View style={{ flexShrink: 1, marginLeft: spacing.md }}>
              <Text style={[styles.alertType, { color: themeColors.text }]} numberOfLines={1}>{item.user}</Text>
              <Text style={[styles.meta, { color: themeColors.textSecondary }]}>{roleLabel(item)}</Text>
            </View>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: sev + '20' }]}>
            <Text style={[styles.severityText, { color: sev }]}>{SEVERITY_LABELS[item.severity] || item.severity}</Text>
          </View>
        </View>

        <Text style={[styles.status, { color: STATUS_COLORS[item.status], marginTop: 6 }]}>
          {STATUS_LABELS[item.status] || item.status}
          {item.status === 'active' && !item.responded_by ? '  ·  À traiter' : ''}
        </Text>

        {item.user_phone ? (
          <Text style={[styles.infoLine, { color: themeColors.text }]} onPress={() => call(item.user_phone)}>
            📞 {item.user_phone}
          </Text>
        ) : null}
        <Text style={[styles.infoLine, { color: themeColors.text }]}>🕒 {fmtDate(item.created_at)}</Text>
        <Text style={[styles.infoLine, { color: themeColors.text }]} numberOfLines={2}>
          📍 {item.address || (item.latitude != null ? sosService.formatCoordinates(item.latitude, item.longitude) : 'Adresse non disponible')}
        </Text>
        {item.details ? (
          <View style={[styles.messageBox, { backgroundColor: sev + '12' }]}>
            <Text style={[styles.messageLabel, { color: themeColors.textSecondary }]}>Message de {item.user} :</Text>
            <Text style={[styles.messageText, { color: themeColors.text }]} numberOfLines={3}>{item.details}</Text>
          </View>
        ) : null}
        {item.booking_id ? (
          <Text style={[styles.meta, { color: themeColors.textSecondary, marginTop: 4 }]}>Réservation #{item.booking_id}</Text>
        ) : null}

        <View style={styles.quickRow}>
          {item.user_phone ? (
            <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.primary }]} onPress={() => call(item.user_phone)}>
              <Ionicons name="call" size={14} color="#fff" />
              <Text style={styles.quickText}>Appeler</Text>
            </TouchableOpacity>
          ) : null}
          {satellite ? (
            <TouchableOpacity style={[styles.quickBtn, { backgroundColor: '#2D7FF9' }]} onPress={() => openMap(satellite)}>
              <Ionicons name="map" size={14} color="#fff" />
              <Text style={styles.quickText}>Voir sur la carte</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: item.status === 'active' ? colors.success : '#888' }]} onPress={() => openDetail(item)}>
            <Ionicons name={item.status === 'active' ? 'checkmark-circle' : 'eye'} size={14} color="#fff" />
            <Text style={styles.quickText}>{item.status === 'active' ? 'Traiter' : 'Détails'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const header = (
    <View>
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: '#E74C3C15' }]}>
          <Text style={[styles.statNumber, { color: '#E74C3C' }]}>{String(activeCount).padStart(2, '0')}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Alertes actives</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#F5A62315' }]}>
          <Text style={[styles.statNumber, { color: '#F5A623' }]}>{String(toHandle).padStart(2, '0')}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>À traiter</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#27AE6015' }]}>
          <Text style={[styles.statNumber, { color: '#27AE60' }]}>{stats?.resolved_alerts ?? '–'}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Résolues</Text>
        </View>
      </View>
      <View style={styles.tabs}>
        {[['active', 'Actives'], ['history', 'Historique']].map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, { color: tab === key ? '#fff' : themeColors.text }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  const Row = ({ label, value, onPress, valueColor }) => (
    <View style={[styles.modalInfoRow, { borderBottomColor: themeColors.border || '#E0E0E0' }]}>
      <Text style={[styles.modalInfoLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.modalInfoValue, { color: valueColor || (onPress ? colors.primary : themeColors.text) }, onPress && styles.link]}
        onPress={onPress}
      >
        {value}
      </Text>
    </View>
  );

  const d = detail || selected;
  const sevColor = SEVERITY_COLORS[d?.severity] || '#999';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Centre d'alertes SOS" showBack />
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Chargement...</Text>
          </View>
        ) : (
          <FlatList
            data={alerts}
            renderItem={renderAlert}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
                  {tab === 'active' ? 'Aucune alerte active' : 'Aucun historique'}
                </Text>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  {tab === 'active' ? 'Toutes les alertes ont été traitées' : 'Les alertes traitées apparaîtront ici'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetail}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: themeColors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>Détails alerte SOS #{selected?.id}</Text>
                <TouchableOpacity onPress={closeDetail}>
                  <Ionicons name="close" size={24} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              {selected && (
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={[styles.modalSeverity, { backgroundColor: sevColor + '20' }]}>
                    <Ionicons name="alert-circle" size={32} color={sevColor} />
                    <Text style={[styles.modalSeverityText, { color: sevColor }]}>{SEVERITY_LABELS[d.severity] || d.severity}</Text>
                  </View>

                  {detailLoading && <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.sm }} />}

                  <View style={styles.personRow}>
                    <Avatar uri={d.user_photo} name={d.user} size={56} />
                    <View style={{ marginLeft: spacing.md, flexShrink: 1 }}>
                      <Text style={[styles.personName, { color: themeColors.text }]}>{d.user || '—'}</Text>
                      <Text style={[styles.meta, { color: themeColors.textSecondary }]}>{roleLabel(d)}</Text>
                    </View>
                  </View>

                  {d.details ? (
                    <View style={[styles.messageBox, { backgroundColor: sevColor + '12' }]}>
                      <Text style={[styles.messageLabel, { color: themeColors.textSecondary }]}>Message de {d.user} :</Text>
                      <Text style={[styles.messageText, { color: themeColors.text }]}>{d.details}</Text>
                    </View>
                  ) : null}

                  <View style={styles.modalInfo}>
                    <Row label="Téléphone" value={d.user_phone || '—'} onPress={d.user_phone ? () => call(d.user_phone) : undefined} />
                    <Row label="Statut" value={STATUS_LABELS[d.status] || d.status} valueColor={STATUS_COLORS[d.status]} />
                    <Row label="Date et heure" value={fmtDate(d.created_at)} />
                    <Row label="Adresse" value={d.address || geoAddress || 'Adresse non disponible'} />
                    <Row
                      label="Coordonnées"
                      value={d.latitude != null ? sosService.formatCoordinates(d.latitude, d.longitude) : 'Non disponible'}
                    />
                    {d.booking ? (
                      <Row label="Réservation" value={`#${d.booking.id} (${d.booking.status})`} />
                    ) : d.booking_id ? (
                      <Row label="Réservation" value={`#${d.booking_id}`} />
                    ) : null}
                    {d.responder ? <Row label="Pris en charge par" value={d.responder} /> : null}
                    {d.resolved_at ? <Row label="Résolue le" value={fmtDate(d.resolved_at)} /> : null}
                  </View>

                  {d.latitude != null && d.longitude != null ? (
                    <View style={styles.mapBox}>
                      <MapViewWrapper
                        style={styles.map}
                        initialRegion={{
                          latitude: Number(d.latitude),
                          longitude: Number(d.longitude),
                          latitudeDelta: 0.004,
                          longitudeDelta: 0.004,
                        }}
                        mapType={MAP_TYPES.hybrid}
                        showUserLocation={false}
                        trackUserLocation={false}
                        gestureHandling="cooperative"
                        markers={[
                          {
                            id: `sos-${d.id}`,
                            coordinate: { latitude: Number(d.latitude), longitude: Number(d.longitude) },
                            title: `${d.user || 'SOS'} — ${fmtDate(d.created_at)}`,
                            description: d.address || geoAddress || sosService.formatCoordinates(d.latitude, d.longitude),
                            pinColor: '#D32F2F',
                          },
                        ]}
                      />
                      <View style={styles.mapCaption}>
                        <Avatar uri={d.user_photo} name={d.user} size={32} />
                        <View style={{ marginLeft: spacing.sm, flexShrink: 1 }}>
                          <Text style={styles.mapCaptionName} numberOfLines={1}>{d.user} · {fmtDate(d.created_at)}</Text>
                          <Text style={styles.mapCaptionAddr} numberOfLines={2}>
                            {d.address || geoAddress || sosService.formatCoordinates(d.latitude, d.longitude)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.meta, { color: themeColors.textSecondary, marginBottom: spacing.md }]}>
                      Position GPS non disponible pour cette alerte.
                    </Text>
                  )}

                  <View style={styles.actionsRow}>
                    {d.user_phone ? (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => call(d.user_phone)}>
                        <Ionicons name="call" size={18} color="#fff" />
                        <Text style={styles.actionText}>Appeler</Text>
                      </TouchableOpacity>
                    ) : null}
                    {d.latitude != null ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#2D7FF9' }]}
                        onPress={() => openMap(sosService.getSatelliteLink(d.latitude, d.longitude))}
                      >
                        <Ionicons name="map" size={18} color="#fff" />
                        <Text style={styles.actionText}>Google Maps (satellite)</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {detail?.emergency_contacts?.length > 0 && (
                    <View style={styles.block}>
                      <Text style={[styles.blockTitle, { color: themeColors.text }]}>Contacts d'urgence</Text>
                      {detail.emergency_contacts.map((c) => (
                        <TouchableOpacity key={c.id} style={styles.contactRow} onPress={() => call(c.phone)}>
                          <Ionicons name="call-outline" size={16} color={colors.primary} />
                          <Text style={[styles.contactText, { color: themeColors.text }]}>
                            {c.name}{c.relationship ? ` (${c.relationship})` : ''}{c.is_primary ? ' ★' : ''} — {c.phone}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {detail?.safety_checks?.length > 0 && (
                    <View style={styles.block}>
                      <Text style={[styles.blockTitle, { color: themeColors.text }]}>Safety checks</Text>
                      {detail.safety_checks.map((c) => (
                        <Text key={c.id} style={[styles.contactText, { color: themeColors.textSecondary }]}>
                          {c.check_type} — {c.status}{c.checked_at ? ` (${fmtDate(c.checked_at)})` : ''}
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={styles.block}>
                    <Text style={[styles.blockTitle, { color: themeColors.text }]}>Suivi / actions menées</Text>
                    <Text style={[styles.notes, { color: themeColors.textSecondary }]}>
                      {d.response_notes || 'Aucune action enregistrée.'}
                    </Text>
                    {d.status === 'active' && (
                      <>
                        <TextInput
                          style={[styles.noteInput, { color: themeColors.text, borderColor: themeColors.border || '#E0E0E0' }]}
                          value={note}
                          onChangeText={setNote}
                          placeholder="Ex : personne jointe par téléphone, intervention en cours..."
                          placeholderTextColor="#999"
                          multiline
                          maxLength={500}
                        />
                        <TouchableOpacity
                          style={[styles.noteBtn, { opacity: note.trim() && !busy ? 1 : 0.5 }]}
                          onPress={addNote}
                          disabled={!note.trim() || busy}
                        >
                          <Text style={styles.noteBtnText}>Enregistrer la note</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>

                  {d.status === 'active' && (
                    <View style={styles.block}>
                      <Text style={[styles.blockTitle, { color: themeColors.text }]}>
                        Message à {d.user || 'la personne'}
                      </Text>
                      <TextInput
                        style={[styles.noteInput, { color: themeColors.text, borderColor: themeColors.border || '#E0E0E0' }]}
                        value={message}
                        onChangeText={setMessage}
                        placeholder="Ex : Nous avons bien reçu votre alerte, un agent vous appelle..."
                        placeholderTextColor="#999"
                        multiline
                        maxLength={500}
                      />
                      <TouchableOpacity
                        style={[styles.noteBtn, { backgroundColor: '#2D7FF9', opacity: message.trim() && !busy ? 1 : 0.5 }]}
                        onPress={sendMessage}
                        disabled={!message.trim() || busy}
                      >
                        <Text style={styles.noteBtnText}>Envoyer le message (sans résoudre)</Text>
                      </TouchableOpacity>
                      <Text style={[styles.meta, { color: themeColors.textSecondary, marginTop: 6 }]}>
                        Le texte ci-dessus est aussi envoyé comme message final si vous cliquez sur « Résoudre ».
                      </Text>
                    </View>
                  )}

                  {d.status === 'active' && (
                    <TouchableOpacity
                      style={[styles.modalResolveButton, { backgroundColor: colors.success, opacity: busy ? 0.6 : 1 }]}
                      onPress={resolve}
                      disabled={busy}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.modalResolveText}>Résoudre l'alerte</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.md },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl },
  emptyTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginTop: spacing.md },
  emptyText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.xs },
  listContent: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: { flex: 1, borderRadius: 14, paddingVertical: spacing.md, alignItems: 'center' },
  statNumber: { fontSize: 26, fontFamily: typography.fontFamily.bold },
  statLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: 12, alignItems: 'center', backgroundColor: '#8881' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.medium },
  errorText: { color: colors.error, marginBottom: spacing.sm, fontSize: typography.fontSize.sm },
  card: { padding: spacing.md, borderRadius: 16, marginBottom: spacing.sm, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  alertType: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  status: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  severityBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  severityText: { fontSize: 10, fontFamily: typography.fontFamily.medium },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginTop: 6, flexWrap: 'wrap' },
  meta: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular },
  date: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 4 },
  infoLine: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, marginTop: 4 },
  messageBox: { borderRadius: 10, padding: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  messageLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, marginBottom: 2 },
  messageText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, lineHeight: 20 },
  personRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  personName: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  mapBox: { borderRadius: 14, overflow: 'hidden', marginBottom: spacing.md, borderWidth: 1, borderColor: '#E0E0E0' },
  map: { height: 240, width: '100%' },
  mapCaption: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: '#000000AA' },
  mapCaptionName: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  mapCaptionAddr: { color: '#eee', fontSize: typography.fontSize.xs },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: 8 },
  quickText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { borderRadius: 20, padding: spacing.lg, width: '94%', maxWidth: 440, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  modalSeverity: { alignItems: 'center', padding: spacing.md, borderRadius: 12, marginBottom: spacing.md },
  modalSeverityText: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, marginTop: spacing.xs },
  modalInfo: { marginBottom: spacing.md },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, gap: spacing.md },
  modalInfoLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  modalInfoValue: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, flexShrink: 1, textAlign: 'right' },
  link: { textDecorationLine: 'underline' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, borderRadius: 12 },
  actionText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  block: { marginBottom: spacing.md },
  blockTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, marginBottom: spacing.xs },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  contactText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, flexShrink: 1 },
  notes: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, lineHeight: 20, marginBottom: spacing.sm },
  noteInput: { borderWidth: 1, borderRadius: 12, padding: spacing.sm, minHeight: 60, textAlignVertical: 'top', fontSize: typography.fontSize.sm },
  noteBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  noteBtnText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  modalResolveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: 12, gap: 8, marginBottom: spacing.sm },
  modalResolveText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
});

export default SOSAlertsScreen;
