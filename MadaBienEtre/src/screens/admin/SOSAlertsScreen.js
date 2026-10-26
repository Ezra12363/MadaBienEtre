// src/screens/admin/SOSAlertsScreen.js
//
// Centre d'alertes SOS (admin) : liste des alertes actives / historique.
// Un appui sur une alerte ouvre la PAGE « Détails alerte SOS » (SOSAlertDetail).
// Données RÉELLES uniquement, rafraîchies toutes les 15 s.
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import sosService from '../../services/sosService';
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  TypeBadge,
  Avatar,
  fmtDate,
  roleLabel,
} from '../../components/sos/sosAdminShared';

const POLL_MS = 15000;

const FILTERS = [
  ['all', 'Tous'],
  ['emergency', '🚨 Urgence'],
  ['client', '👤 Client'],
  ['therapist', '💆 Thérapeute'],
  ['other', '❓ Autre'],
];

const SOSAlertsScreen = () => {
  const { colors: themeColors } = useTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  // Une carte par ligne, en pleine largeur (web et mobile).
  const numColumns = 1;
  const isWide = width >= 800;

  const [tab, setTab] = useState('active'); // active | history
  const [typeFilter, setTypeFilter] = useState('all');
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
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

  // Rechargement à chaque retour sur la liste (ex : après avoir résolu une alerte).
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

  const openDetail = (item) => navigation.navigate('SOSAlertDetail', { alertId: item.id, alert: item });
  const call = (phone) => phone && Linking.openURL(`tel:${phone}`);

  const activeCount = stats?.active_alerts ?? (tab === 'active' ? alerts.length : 0);
  const toHandle = tab === 'active' ? alerts.filter((a) => !a.responded_by).length : 0;
  const shown = typeFilter === 'all' ? alerts : alerts.filter((a) => a.alert_type === typeFilter);

  const renderAlert = ({ item }) => {
    const sev = SEVERITY_COLORS[item.severity] || '#999';
    const satellite = sosService.getSatelliteLink(item.latitude, item.longitude);
    return (
      <View style={numColumns > 1 ? { flex: 1, maxWidth: `${100 / numColumns}%` } : null}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: themeColors.surface, borderLeftColor: sev }, numColumns > 1 && styles.cardGrid]}
        onPress={() => openDetail(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Avatar uri={item.user_photo} name={item.user} />
            <View style={{ flexShrink: 1, marginLeft: spacing.md }}>
              <Text style={[styles.name, { color: themeColors.text }]} numberOfLines={1}>{item.user}</Text>
              <Text style={[styles.meta, { color: themeColors.textSecondary }]}>{roleLabel(item)}</Text>
              <TypeBadge type={item.alert_type} />
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

        <View style={isWide ? styles.infoRowWide : null}>
        {item.user_phone ? (
            <Text style={[styles.infoLine, { color: themeColors.text }]} onPress={() => call(item.user_phone)}>📞 {item.user_phone}</Text>
          ) : null}
          <Text style={[styles.infoLine, { color: themeColors.text }]}>🕒 {fmtDate(item.created_at)}</Text>
          <Text style={[styles.infoLine, { color: themeColors.text }]} numberOfLines={2}>
            📍 {item.address || (item.latitude != null ? sosService.formatCoordinates(item.latitude, item.longitude) : 'Adresse non disponible')}
          </Text>
        </View>
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
            <TouchableOpacity style={[styles.quickBtn, { backgroundColor: '#2D7FF9' }]} onPress={() => Linking.openURL(satellite)}>
              <Ionicons name="map" size={14} color="#fff" />
              <Text style={styles.quickText}>Voir sur la carte</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: item.status === 'active' ? colors.success || '#27AE60' : '#888' }]}
            onPress={() => openDetail(item)}
          >
            <Ionicons name={item.status === 'active' ? 'checkmark-circle' : 'eye'} size={14} color="#fff" />
            <Text style={styles.quickText}>{item.status === 'active' ? 'Traiter' : 'Détails'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      </View>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        {FILTERS.map(([key, label]) => {
          const count = key === 'all' ? alerts.length : alerts.filter((a) => a.alert_type === key).length;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTypeFilter(key)}
              style={[styles.filterChip, typeFilter === key && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, { color: typeFilter === key ? '#fff' : themeColors.text }]}>
                {label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

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
            key={`cols-${numColumns}`}
            numColumns={numColumns}
            data={shown}
            renderItem={renderAlert}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success || '#27AE60'} />
                <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
                  {tab === 'active' ? 'Aucune alerte active' : 'Aucun historique'}
                </Text>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  {tab === 'active' ? 'Toutes les alertes ont été traitées' : 'Les alertes traitées apparaîtront ici'}
                </Text>
              </View>
            }
            contentContainerStyle={[styles.listContent, width >= 800 && { padding: spacing.lg }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            showsVerticalScrollIndicator={false}
          />
        )}
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
  listContent: { padding: spacing.md, flexGrow: 1 },
  infoRowWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg },
  cardGrid: { marginHorizontal: 6 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: { flex: 1, borderRadius: 14, paddingVertical: spacing.md, alignItems: 'center' },
  statNumber: { fontSize: 26, fontFamily: typography.fontFamily.bold },
  statLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: 12, alignItems: 'center', backgroundColor: '#8881' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.medium },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, backgroundColor: '#8881', marginRight: spacing.xs },
  filterChipActive: { backgroundColor: colors.primary },
  filterText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  errorText: { color: colors.error, marginBottom: spacing.sm, fontSize: typography.fontSize.sm },
  card: {
    padding: spacing.md, borderRadius: 16, marginBottom: spacing.sm, borderLeftWidth: 4, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  name: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semiBold },
  status: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  severityBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  severityText: { fontSize: 10, fontFamily: typography.fontFamily.medium },
  meta: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular },
  infoLine: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, marginTop: 4 },
  messageBox: { borderRadius: 10, padding: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  messageLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.medium, marginBottom: 2 },
  messageText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, lineHeight: 20 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: 8 },
  quickText: { color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
});

export default SOSAlertsScreen;
