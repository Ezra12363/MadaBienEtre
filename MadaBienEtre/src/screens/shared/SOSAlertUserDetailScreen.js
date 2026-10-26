// src/screens/shared/SOSAlertUserDetailScreen.js
//
// Détail d'UNE alerte SOS pour le client / thérapeute qui l'a envoyée.
// Ouvert en appuyant sur la notification « Alerte SOS résolue » / « Message de l'équipe SOS » :
// statut, réponse de l'équipe, résolution, adresse et carte du lieu.
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Linking,
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

const STATUS = {
  active: { label: "En cours — l'équipe a été prévenue", color: '#E74C3C', icon: 'time' },
  resolved: { label: 'Alerte résolue', color: '#27AE60', icon: 'checkmark-circle' },
  cancelled: { label: 'Alerte annulée', color: '#999', icon: 'close-circle' },
};
const TYPE_LABELS = { emergency: '🚨 Urgence', client: '👤 Alerte client', therapist: '💆 Alerte thérapeute', other: '❓ Autre' };
const SEVERITY_LABELS = { low: '🟢 Faible', medium: '🟡 Moyenne', high: '🔴 Élevée', critical: '🔴 Critique' };

const fmtDate = (d) => {
  if (!d) return '';
  const base = String(d).replace(' ', 'T');
  const iso = /[zZ]$|[+-]\d\d:?\d\d$/.test(base) ? base : `${base}Z`;
  return new Date(iso).toLocaleString('fr-FR');
};

// Composants HORS de l'écran : sinon ils sont recréés à chaque rendu.
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

const Row = ({ label, value }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: themeColors.border || '#E8E8E8' }]}>
      <Text style={[styles.rowLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: themeColors.text }]}>{value}</Text>
    </View>
  );
};

const SOSAlertUserDetailScreen = ({ route, navigation }) => {
  const { colors: themeColors } = useTheme();
  const { toast, showToast } = useToast();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const alertId = route?.params?.alertId ?? route?.params?.sosId;

  const [a, setA] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [geoAddress, setGeoAddress] = useState(null);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    if (!alertId) {
      setError('Alerte introuvable');
      setLoading(false);
      return;
    }
    const r = await sosService.getSOSAlert(alertId);
    if (!mounted.current) return;
    if (r.success) {
      setA(r.data);
      setError(null);
      if (!r.data.address && r.data.latitude != null) {
        sosService.getAddress(r.data.latitude, r.data.longitude).then((x) => mounted.current && setGeoAddress(x));
      }
    } else {
      setError(r.error || "Impossible de charger l'alerte");
    }
    setLoading(false);
  }, [alertId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 15000);
      return () => clearInterval(timer);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : null);

  const doCancel = async () => {
    setBusy(true);
    const r = await sosService.cancelSOSAlert(alertId, 'Fausse alerte');
    setBusy(false);
    setCancelVisible(false);
    if (r.success) {
      showToast('success', "Alerte annulée : l'équipe a été informée.");
      load();
    } else {
      showToast('error', r.error);
    }
  };

  const st = STATUS[a?.status] || STATUS.active;
  const address = a?.address || geoAddress;
  const hasPos = a?.latitude != null && a?.longitude != null;

  const left = a && (
    <View style={isWide ? styles.col : null}>
      <View style={[styles.statusBanner, { backgroundColor: st.color + '18', borderColor: st.color }]}>
        <Ionicons name={st.icon} size={30} color={st.color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          {a.status === 'resolved' && (
            <Text style={[styles.statusSub, { color: themeColors.textSecondary }]}>
              {a.resolved_by ? `Par ${a.resolved_by}` : ''}{a.resolved_at ? ` le ${fmtDate(a.resolved_at)}` : ''}
            </Text>
          )}
        </View>
      </View>

      <Card title="Mon alerte" icon="alert-circle-outline">
        <Row label="Envoyée le" value={fmtDate(a.created_at)} />
        <Row label="Type" value={TYPE_LABELS[a.alert_type] || a.alert_type} />
        <Row label="Gravité" value={SEVERITY_LABELS[a.severity] || a.severity} />
        {a.booking_id ? <Row label="Réservation" value={`#${a.booking_id}`} /> : null}
        <Row label="Adresse" value={address || 'Adresse non disponible'} />
        {a.details ? (
          <View style={styles.detailsBox}>
            <Text style={[styles.detailsLabel, { color: themeColors.textSecondary }]}>Mon message :</Text>
            <Text style={[styles.detailsText, { color: themeColors.text }]}>{a.details}</Text>
          </View>
        ) : null}
      </Card>

      {hasPos && (
        <Card title="Lieu de l'alerte" icon="location-outline">
          <View style={styles.mapBox}>
            <MapViewWrapper
              style={[styles.map, isWide && { height: 360 }]}
              initialRegion={{ latitude: Number(a.latitude), longitude: Number(a.longitude), latitudeDelta: 0.004, longitudeDelta: 0.004 }}
              mapType={MAP_TYPES.hybrid}
              showUserLocation={false}
              trackUserLocation={false}
              gestureHandling="cooperative"
              markers={[
                {
                  id: `sos-${a.id}`,
                  coordinate: { latitude: Number(a.latitude), longitude: Number(a.longitude) },
                  title: `Alerte SOS — ${fmtDate(a.created_at)}`,
                  description: address || sosService.formatCoordinates(a.latitude, a.longitude),
                  pinColor: '#D32F2F',
                },
              ]}
            />
          </View>
          <TouchableOpacity
            style={styles.mapLink}
            onPress={() => Linking.openURL(sosService.getSatelliteLink(a.latitude, a.longitude))}
          >
            <Ionicons name="map" size={16} color="#2D7FF9" />
            <Text style={styles.mapLinkText}>Ouvrir dans Google Maps (satellite)</Text>
          </TouchableOpacity>
        </Card>
      )}
    </View>
  );

  const right = a && (
    <View style={isWide ? styles.col : null}>
      <Card title="Réponse de l'équipe" icon="chatbubble-ellipses-outline">
        {a.messages?.length > 0 ? (
          a.messages.map((m, i) => (
            <View key={i} style={styles.reply}>
              <Text style={[styles.replyText, { color: themeColors.text }]}>{m.text}</Text>
              <Text style={[styles.replyMeta, { color: themeColors.textSecondary }]}>
                {m.author} · {fmtDate(`${m.date}:00`)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.empty, { color: themeColors.textSecondary }]}>
            {a.status === 'active'
              ? "Notre équipe a reçu votre alerte et va vous répondre ici et par notification."
              : 'Aucun message de l\'équipe pour cette alerte.'}
          </Text>
        )}
      </Card>

      {a.status === 'resolved' && (
        <View style={styles.resolvedBox}>
          <Ionicons name="shield-checkmark" size={22} color="#27AE60" />
          <Text style={styles.resolvedText}>
            Votre problème a été traité{a.resolved_by ? ` par ${a.resolved_by}` : ''}. Si la situation persiste, vous pouvez
            envoyer une nouvelle alerte SOS.
          </Text>
        </View>
      )}

      {a.status === 'active' && (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelVisible(true)}>
          <Text style={styles.cancelBtnText}>C'est une fausse alerte — annuler</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL('tel:117')}>
        <Ionicons name="call" size={18} color="#fff" />
        <Text style={styles.callBtnText}>Appeler les secours (117)</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title={`Alerte SOS${alertId ? ` #${alertId}` : ''}`} showBack onBackPress={goBack} />
        {toast}

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : !a ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
            <Text style={{ color: themeColors.text, marginTop: spacing.sm }}>{error || 'Alerte introuvable'}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, isWide && { padding: spacing.lg }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          >
            <View style={isWide ? styles.wide : null}>
              {left}
              {right}
            </View>
          </ScrollView>
        )}

        <ConfirmModal
          visible={cancelVisible}
          title="Annuler l'alerte ?"
          message="C'est une fausse alerte ? L'équipe sera prévenue de l'annulation."
          icon="help-circle"
          iconColor="#E74C3C"
          confirmText="Oui, j'annule"
          cancelText="Non, garder"
          confirmColor="#E74C3C"
          loading={busy}
          onConfirm={doCancel}
          onCancel={() => setCancelVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl * 2 },
  wide: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  col: { flex: 1, flexBasis: 0, minWidth: 0 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 14, borderWidth: 1, marginBottom: spacing.md },
  statusText: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  statusSub: { fontSize: typography.fontSize.sm, marginTop: 2 },
  card: { borderRadius: 16, padding: spacing.md, marginBottom: spacing.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  cardTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, gap: spacing.md },
  rowLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  rowValue: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, flexShrink: 1, textAlign: 'right' },
  detailsBox: { marginTop: spacing.sm },
  detailsLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, marginBottom: 2 },
  detailsText: { fontSize: typography.fontSize.sm, lineHeight: 20 },
  mapBox: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E0E0' },
  map: { height: 240, width: '100%' },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  mapLinkText: { color: '#2D7FF9', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  reply: { backgroundColor: '#2D7FF912', borderRadius: 10, padding: spacing.sm, marginBottom: spacing.sm },
  replyText: { fontSize: typography.fontSize.md, lineHeight: 22 },
  replyMeta: { fontSize: typography.fontSize.xs, marginTop: 4 },
  empty: { fontSize: typography.fontSize.sm, lineHeight: 20 },
  resolvedBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: '#27AE6015', marginBottom: spacing.md },
  resolvedText: { flex: 1, color: '#1E8E4E', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, lineHeight: 20 },
  cancelBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: 10, borderWidth: 1, borderColor: '#999', marginBottom: spacing.md },
  cancelBtnText: { fontSize: typography.fontSize.sm, color: '#666', fontFamily: typography.fontFamily.medium },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D32F2F', padding: spacing.md, borderRadius: 14 },
  callBtnText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
});

export default SOSAlertUserDetailScreen;
