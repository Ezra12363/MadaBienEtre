// src/screens/admin/PaymentsScreen.js
//
// Admin — centre financier :
//   Aperçu       : chiffres clés + graphiques (encaissements, commission, retraits, modes) ;
//   Paiements    : tous les paiements clients, reçu CLIENT et reçu THÉRAPEUTE (PDF) ;
//   Retraits     : validation des demandes des thérapeutes (accepter → payer avec la
//                  référence du transfert RÉEL → reçu PDF, ou refuser) ;
//   Commissions  : commissions dues + paiements de commission à valider ;
//   Transactions : journal de toutes les opérations.
//
// Règle : un retrait ne passe à « Payé » qu'après le transfert RÉEL (référence obligatoire).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import Header from '../../components/common/Header';
import { BarChart, HBars, StackedShare, StatTile, dayLabel, monthLabel } from '../../components/charts/SimpleCharts';
import FilterBar, { EMPTY_FILTERS } from '../../components/payment/FilterBar';
import { formatAr, formatDateTime, formatShort, inRange } from '../../components/payment/paymentUtils';
import { useTheme } from '../../context/ThemeContext';
import paymentService from '../../services/paymentService';
import { colors } from '../../theme';

const PRIMARY = colors.primary || '#1F6B45';

const STATUS = {
  pending: { label: 'En attente', color: '#B45309', bg: '#FEF3C7' },
  processing: { label: 'Accepté — à payer', color: '#1D4ED8', bg: '#DBEAFE' },
  completed: { label: 'Payé', color: '#047857', bg: '#D1FAE5' },
  failed: { label: 'Refusé', color: '#B91C1C', bg: '#FEE2E2' },
  rejected: { label: 'Refusé', color: '#B91C1C', bg: '#FEE2E2' },
  cancelled: { label: 'Annulé', color: '#6B7280', bg: '#F3F4F6' },
  refunded: { label: 'Remboursé', color: '#5B6B7A', bg: '#E8EDF1' },
};
const NAMES = { mvola: 'MVola', orange_money: 'Orange Money', airtel_money: 'Airtel Money', stripe: 'Carte (Stripe)', vanila_pay: 'Vanila Pay', card: 'Carte', cash: 'Espèces', mobile_money: 'Mobile Money' };
const MCOL = ['#1F6B45', '#B8924A', '#2F6DB5', '#C0562F', '#7A5CB5', '#4A9B9B'];

const Pill = ({ s }) => {
  const st = STATUS[s] || STATUS.pending;
  return (
    <View style={[styles.pill, { backgroundColor: st.bg }]}>
      <Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text>
    </View>
  );
};

const PAY_STATUS_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'pending', label: 'En attente' },
  { id: 'processing', label: 'En cours' },
  { id: 'completed', label: 'Payés' },
  { id: 'failed', label: 'Échoués' },
  { id: 'cancelled', label: 'Annulés' },
  { id: 'refunded', label: 'Remboursés' },
];
const PAY_METHOD_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'card', label: 'Carte' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'cash', label: 'Espèces' },
];
const WD_METHOD_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'bank_transfer', label: 'Banque' },
  { id: 'cash', label: 'Espèces' },
];
const CM_STATUS_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'pending', label: 'À valider' },
  { id: 'completed', label: 'Validés' },
  { id: 'rejected', label: 'Refusés' },
];
const CM_METHOD_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'bank_transfer', label: 'Virement' },
  { id: 'cash', label: 'Espèces' },
];
const matchText = (q, ...parts) => {
  const s = String(q || '').trim().toLowerCase();
  return !s || parts.some((x) => String(x ?? '').toLowerCase().includes(s));
};

const PaymentsScreen = ({ navigation, route }) => {
  const { colors: theme } = useTheme();
  const { width } = useWindowDimensions();
  const cols = width >= 1500 ? 3 : width >= 900 ? 2 : 1;       // pleine largeur web : 2-3 colonnes
  const cellW = cols === 1 ? '100%' : cols === 2 ? '49.3%' : '32.5%';
  const wide = width >= 900;
  const [gridW, setGridW] = useState(0); // largeur réelle de la grille (aperçu) pour aligner les 3 colonnes
  const [tab, setTab] = useState('overview');
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Arrivée depuis une notification (paiement / retrait / commission) : bon onglet directement
  const routeTab = route?.params?.tab;
  const routeTs = route?.params?.ts;
  useEffect(() => {
    if (routeTab && ['overview', 'payments', 'withdrawals', 'commissions', 'transactions'].includes(routeTab)) {
      setTab(routeTab);
      setFilters(EMPTY_FILTERS);
    }
  }, [routeTab, routeTs]);
  const [range, setRange] = useState('month');
  const [summary, setSummary] = useState(null);
  const [pstats, setPstats] = useState(null);
  const [wstats, setWstats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [dues, setDues] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wFilter, setWFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [refs, setRefs] = useState({});
  const [reasons, setReasons] = useState({});

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [a, b, c, d, e, f, g, h] = await Promise.all([
      paymentService.adminSummary(),
      paymentService.adminStats(),
      paymentService.adminWalletStats(),
      paymentService.adminPayments(),
      paymentService.adminWithdrawals(),
      paymentService.adminCommissions(),
      paymentService.adminCommissionsDue(),
      paymentService.adminTransactions(),
    ]);
    if (!alive.current) return;
    if (a.success) setSummary(a.data);
    if (b.success) setPstats(b.data);
    if (c.success) setWstats(c.data);
    if (d.success) setPayments(d.data || []);
    if (e.success) setWithdrawals(e.data || []);
    if (f.success) setCommissions(f.data || []);
    if (g.success) setDues(g.data || []);
    if (h.success) setTransactions(h.data || []);
    const firstErr = [a, b, c, d, e].find((r) => !r.success);
    setError(firstErr ? firstErr.error : null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const act = async (key, fn, okMsg) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.success) return setError(res.error);
    setError(null);
    if (okMsg) setNotice(okMsg);
    load(true);
  };

  const receiptPdf = async (key, fn) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.success) setError(res.error);
  };

  const card = { backgroundColor: theme.surface, borderColor: theme.border || '#E5E7EB' };
  const txt = { color: theme.text };
  const sub = { color: theme.textSecondary };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Paiements & retraits" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  const sm = summary || {};
  const ps = pstats || {};
  const ws = wstats || {};
  const pendingW = withdrawals.filter((w) => w.status === 'pending' || w.status === 'processing');
  const pendingC = commissions.filter((c) => c.status === 'pending');
  const shownW = wFilter === 'all' ? withdrawals : wFilter === 'pending' ? pendingW : withdrawals.filter((w) => w.status === wFilter);

  const fPayments = payments.filter(
    (p) =>
      (filters.status === 'all' || p.status === filters.status) &&
      (filters.method === 'all' || p.method === filters.method) &&
      inRange(p.paid_at || p.created_at, filters.range) &&
      matchText(filters.q, p.client_name, p.therapist_name, p.booking_id, p.id, p.amount, p.method_label)
  );
  const fWithdrawals = shownW.filter(
    (w) =>
      (filters.method === 'all' || w.method === filters.method) &&
      inRange(w.created_at, filters.range) &&
      matchText(filters.q, w.therapist_name, w.amount, w.reference, w.phone_number, w.id)
  );
  const fCommissions = commissions.filter(
    (c) =>
      (filters.status === 'all' || c.status === filters.status) &&
      (filters.method === 'all' || c.method === filters.method) &&
      inRange(c.created_at, filters.range) &&
      matchText(filters.q, c.therapist_name, c.amount, c.transfer_reference, c.id)
  );
  const fTransactions = transactions.filter(
    (t) => inRange(t.created_at, filters.range) && matchText(filters.q, t.user_name, t.description, t.type, t.amount)
  );

  const chart =
    range === 'day'
      ? (ps.daily || []).map((d) => ({ label: dayLabel(d.date), values: { gross: d.gross, commission: d.commission } }))
      : (ws.monthly || []).map((m) => ({ label: monthLabel(m.month), values: { gross: m.gross, commission: m.commission, withdrawn: m.withdrawn } }));
  const series =
    range === 'day'
      ? [
          { key: 'gross', color: PRIMARY, name: 'Encaissé', short: 'Encaissé' },
          { key: 'commission', color: '#B8924A', name: 'Commission', short: 'Comm.' },
        ]
      : [
          { key: 'gross', color: PRIMARY, name: 'Encaissé', short: 'Encaissé' },
          { key: 'commission', color: '#B8924A', name: 'Commission', short: 'Comm.' },
          { key: 'withdrawn', color: '#2F6DB5', name: 'Retraits payés', short: 'Retraits' },
        ];
  const methodItems = Object.entries(ps.by_method || {}).map(([k, v], i) => ({ label: NAMES[k] || k, value: v, color: MCOL[i % MCOL.length] }));
  const topItems = (ps.top_therapists || []).map((t) => ({ label: t.name || `#${t.therapist_id}`, value: t.gross, color: PRIMARY }));

  const Tab = ({ id, label, badge }) => (
    <TouchableOpacity
      onPress={() => { setTab(id); setFilters(EMPTY_FILTERS); }}
      activeOpacity={0.8}
      style={[styles.tab, wide && { flex: 1, justifyContent: 'center' }, tab === id && { backgroundColor: PRIMARY }]}
    >
      <Text style={[styles.tabText, { color: tab === id ? '#fff' : theme.textSecondary, fontWeight: tab === id ? '700' : '500' }]} numberOfLines={1}>{label}</Text>
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  // ---------- Aperçu : valeurs dérivées (aucune nouvelle donnée API) ----------
  const goTab = (id) => { setTab(id); setFilters(EMPTY_FILTERS); };
  const compact = (v) => {
    const n = Number(v) || 0;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} M`;
    if (n >= 1e3) return `${Math.round(n / 1e3)} k`;
    return `${Math.round(n)}`;
  };
  const netT = Number(sm.total_net_therapists) || 0;
  const commT = Number(sm.total_commission) || 0;
  const splitTotal = netT + commT;
  const pctTherapists = splitTotal > 0 ? Math.round((netT / splitTotal) * 100) : 0;
  const pctCommission = splitTotal > 0 ? 100 - pctTherapists : 0;
  const pendingPayCount = ps.pending_payments || 0;
  const failedPayCount = ps.failed_payments || 0;
  const wdToPay = pendingW.length;
  const commDue = Number(ws.commission_due) || 0;

  // Modes de paiement regroupés : Carte / Mobile Money (détail par opérateur) / autres
  const MOBILE = ['mvola', 'orange_money', 'airtel_money'];
  const CARD = ['stripe', 'card'];
  const methodGroups = (() => {
    const by = ps.by_method || {};
    const mobile = MOBILE.filter((k) => Number(by[k])).map((k) => ({ label: NAMES[k] || k, value: Number(by[k]) }));
    const groups = [];
    const cardVal = CARD.reduce((acc, k) => acc + (Number(by[k]) || 0), 0);
    if (cardVal) groups.push({ label: 'Carte', value: cardVal, color: PRIMARY });
    const mobileGeneric = Number(by.mobile_money) || 0;
    if (mobile.length || mobileGeneric) {
      groups.push({
        label: 'Mobile Money',
        value: mobile.reduce((a, b) => a + b.value, 0) + mobileGeneric,
        color: '#7A5CB5',
        children: mobile.sort((x, y) => y.value - x.value),
      });
    }
    Object.entries(by)
      .filter(([k]) => !MOBILE.includes(k) && !CARD.includes(k) && k !== 'mobile_money' && Number(by[k]))
      .forEach(([k, v], i) => groups.push({ label: k === 'cash' ? 'Espèces' : NAMES[k] || k, value: Number(v), color: k === 'cash' ? '#4A9B9B' : MCOL[(i + 3) % MCOL.length] }));
    return groups.sort((x, y) => y.value - x.value);
  })();

  const statusCard = (
    <View style={[styles.card, card, wide && { flex: 1 }]}>
      <Text style={[styles.cardTitle, txt]}>Demandes de retrait par statut</Text>
      <View style={{ height: 10 }} />
      <HBars
        thick
        textColor={theme.text}
        trackColor={theme.border}
        items={Object.entries(ws.withdrawals_by_status || {}).map(([k, v]) => ({
          label: `${(STATUS[k] || {}).label || k} (${v.count})`,
          value: v.amount,
          color: (STATUS[k] || {}).color || PRIMARY,
        }))}
      />
    </View>
  );

  const tabsNode = wide ? (
    <View style={[styles.tabsBar, card]}>
      <Tab id="overview" label="Aperçu" />
      <Tab id="payments" label="Paiements" badge={pendingPayCount} />
      <Tab id="withdrawals" label="Retraits" badge={pendingW.length} />
      <Tab id="commissions" label="Commissions" badge={pendingC.length} />
      <Tab id="transactions" label="Journal" />
    </View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      <Tab id="overview" label="Aperçu" />
      <Tab id="payments" label="Paiements" badge={pendingPayCount} />
      <Tab id="withdrawals" label="Retraits" badge={pendingW.length} />
      <Tab id="commissions" label="Commissions" badge={pendingC.length} />
      <Tab id="transactions" label="Journal" />
    </ScrollView>
  );

  const Todo = ({ icon, color, bg, count, title, subtitle, onPress }) =>
    wide ? (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.todoCard, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.todoTitle, { color }]}>{count} {title}</Text>
          <Text style={[styles.todoSub, { color }]}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.todoRow, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[styles.todoRowText, { color }]} numberOfLines={2}>{count} {title}{subtitle ? ` ${subtitle}` : ''}</Text>
        <Ionicons name="chevron-forward" size={18} color={color} />
      </TouchableOpacity>
    );

  const Kpi = ({ label, value, color }) => (
    <View style={[styles.kpiCard, card]}>
      <Text style={[styles.kpiLabel, { color: theme.textSecondary }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.kpiValue, { color: color || theme.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );

  const totalCard = (
    <View style={styles.totalCard}>
      <Text style={styles.totalLabel}>Total encaissé</Text>
      <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>{formatAr(sm.total_payments)}</Text>
      <View style={styles.splitBar}>
        <View style={{ flex: Math.max(0.0001, pctTherapists), backgroundColor: '#FFFFFF' }} />
        <View style={{ flex: Math.max(0.0001, pctCommission), backgroundColor: '#B8924A' }} />
      </View>
      <View style={styles.splitLegend}>
        <Text style={styles.totalSmall}>Thérapeutes {pctTherapists} %</Text>
        <Text style={styles.totalSmall}>Commission {pctCommission} %</Text>
      </View>
      {wide ? <Text style={[styles.totalSmall, { marginTop: 6 }]}>{ps.completed_payments || 0} paiements confirmés</Text> : null}
    </View>
  );

  const GAP = 12;
  const colW = wide && gridW > 0 ? (gridW - 2 * GAP) / 3 : null;
  const colStyle = colW ? { width: colW } : { flex: 1 };
  const spanStyle = colW ? { width: colW * 2 + GAP } : { flex: 2 };

  const kpis = [
    <Kpi key="c" label={wide ? 'Commission plateforme' : 'Commission'} value={formatAr(sm.total_commission)} color="#9A6A12" />,
    <Kpi key="n" label={wide ? 'Net dû aux thérapeutes' : 'Net thérapeutes'} value={formatAr(sm.total_net_therapists)} />,
    <Kpi key="w" label="Wallets à payer" value={formatAr(sm.wallets_available)} color="#2F6DB5" />,
    <Kpi key="r" label="Retraits payés" value={formatAr(sm.withdrawals_paid)} color="#047857" />,
  ];

  const kpiGrid = wide ? (
    <View style={{ gap: GAP, flex: 1 }}>
      <View style={styles.gridRow}>{kpis[0]}{kpis[1]}</View>
      <View style={styles.gridRow}>{kpis[2]}{kpis[3]}</View>
    </View>
  ) : (
    <View style={styles.kpiGrid}>{kpis}</View>
  );

  const chartCard = (
    <View style={[styles.card, card, wide && { flex: 1 }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, txt]}>{wide ? 'Encaissements et commission' : 'Encaissements'}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[['day', '30 j'], ['month', '12 mois']].map(([id, label]) => (
            <TouchableOpacity key={id} onPress={() => setRange(id)} style={[styles.sw, range === id && { backgroundColor: PRIMARY }]}>
              <Text style={{ color: range === id ? '#fff' : theme.textSecondary, fontSize: 12 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <BarChart
        modern
        data={chart}
        series={series}
        format={compact}
        axisFormat={compact}
        textColor={theme.textSecondary}
        gridColor={theme.border}
        barWidth={range === 'day' ? 7 : 11}
      />
    </View>
  );

  const methodCard = (
    <View style={[styles.card, card, wide && { flex: 1 }]}>
      <Text style={[styles.cardTitle, txt]}>Par mode de paiement</Text>
      <View style={{ height: 10 }} />
      <HBars items={methodGroups} textColor={theme.text} trackColor={theme.border} thick percent={wide} percentOnly={!wide} />
    </View>
  );

  const commissionCard = (
    <View style={[styles.card, card, wide && { flex: 1 }]}>
      <Text style={[styles.cardTitle, txt]}>Commission</Text>
      <View style={{ height: 10 }} />
      {[
        ['Encaissée', formatAr(ws.commission_collected), '#047857'],
        ['Due (espèces)', formatAr(ws.commission_due), '#B45309'],
        ['En vérification', formatAr(ws.commission_in_review), theme.text],
      ].map(([label, value, color]) => (
        <View key={label} style={styles.commRow}>
          <Text style={[styles.commLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.commValue, { color }]}>{value}</Text>
        </View>
      ))}
    </View>
  );

  const topCard = (
    <View style={[styles.card, card, wide && { flex: 1 }]}>
      <Text style={[styles.cardTitle, txt]}>Top thérapeutes</Text>
      <View style={{ height: 10 }} />
      <HBars items={topItems} textColor={theme.text} trackColor={theme.border} thick />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Paiements & retraits" showBack />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={PRIMARY} />}
      >
        {error ? (
          <TouchableOpacity style={styles.errorBox} onPress={() => setError(null)}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </TouchableOpacity>
        ) : null}
        {notice ? (
          <TouchableOpacity style={styles.noticeBox} onPress={() => setNotice(null)}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#047857" />
            <Text style={styles.noticeText}>{notice}</Text>
          </TouchableOpacity>
        ) : null}

        {tabsNode}

        {/* ============ APERÇU ============ */}
        {tab === 'overview' ? (
          <>
            <Text style={[styles.sectionTitle, txt]}>À traiter maintenant</Text>
            <View
              style={wide ? styles.todoRowWrap : { gap: 8 }}
              onLayout={(e) => wide && setGridW(e.nativeEvent.layout.width)}
            >
              <Todo icon="hourglass-outline" color="#7A540C" bg="#FBEFD5" count={pendingPayCount} title={`paiement${pendingPayCount > 1 ? 's' : ''}`} subtitle="en attente" onPress={() => goTab('payments')} />
              <Todo icon="alert-circle-outline" color="#991B1B" bg="#FDE2E2" count={failedPayCount} title={`paiement${failedPayCount > 1 ? 's' : ''}`} subtitle="échoués" onPress={() => goTab('payments')} />
              {wide || wdToPay > 0 ? (
                <Todo icon="checkmark-circle-outline" color="#166534" bg="#DDF3E3" count={wdToPay} title={`retrait${wdToPay > 1 ? 's' : ''}`} subtitle="à payer" onPress={() => goTab('withdrawals')} />
              ) : null}
              {!wide && commDue > 0 ? (
                <Todo icon="pricetag-outline" color="#7A540C" bg="#FBEFD5" count={formatAr(commDue)} title="commission" subtitle="due" onPress={() => goTab('commissions')} />
              ) : null}
            </View>

            {wide ? (
              <>
                {/* Grille alignée sur 3 colonnes égales */}
                <View style={styles.gridRow}>
                  <View style={colStyle}>{totalCard}</View>
                  <View style={[spanStyle, { flexDirection: 'row' }]}>{kpiGrid}</View>
                </View>

                <View style={styles.gridRow}>
                  <View style={spanStyle}>{chartCard}</View>
                  <View style={colStyle}>{methodCard}</View>
                </View>

                <View style={styles.gridRow}>
                  <View style={colStyle}>{commissionCard}</View>
                  <View style={colStyle}>{topCard}</View>
                  <View style={colStyle}>{statusCard}</View>
                </View>
              </>
            ) : (
              <>
                {totalCard}
                {kpiGrid}
                {chartCard}
                {methodCard}
                {commissionCard}
                {topCard}
                {statusCard}
              </>
            )}

            {Number(sm.withdrawals_pending) > 0 ? (
              <Text style={[styles.empty, { color: theme.textSecondary, marginTop: 0 }]}>
                Retraits en attente de paiement : {formatAr(sm.withdrawals_pending)}
              </Text>
            ) : null}
          </>
        ) : null}

        {/* ============ PAIEMENTS ============ */}
        {tab === 'payments' ? (
          <>
          <FilterBar value={filters} onChange={setFilters} statusOptions={PAY_STATUS_OPTIONS} methodOptions={PAY_METHOD_OPTIONS}
            placeholder="Client, thérapeute, n° réservation, montant…" total={payments.length} shown={fPayments.length} theme={theme} />
          <View style={[styles.card, card]}>
            <Text style={[styles.cardTitle, txt]}>Paiements des clients</Text>
            {fPayments.length === 0 ? <Text style={[styles.empty, sub]}>Aucun paiement pour ces critères.</Text> : null}
            <View style={styles.grid}>
            {fPayments.map((p) => (
              <View key={p.id} style={[styles.row, { width: cellW }]}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, txt]}>{formatAr(p.amount)}</Text>
                  <Pill s={p.status} />
                </View>
                <Text style={[styles.rowSub, sub]}>
                  {p.client_name || 'Client'} → {p.therapist_name || 'Thérapeute'} · réservation #{p.booking_id}
                </Text>
                <Text style={[styles.rowSub, sub]}>
                  {p.method_label}
                </Text>
                <Text style={[styles.rowSub, sub]}>Initié le {formatDateTime(p.created_at)}</Text>
                {p.status === 'completed' ? <Text style={[styles.rowSub, sub]}>Payé le {formatDateTime(p.paid_at || p.completed_at)} (Madagascar)</Text> : null}
                {p.awaiting_confirmation ? (
                  <Text style={[styles.rowSub, { color: '#B45309' }]}>Client : « argent remis » le {formatDateTime(p.client_sent_at)} — attend la confirmation du thérapeute</Text>
                ) : null}
                {p.status === 'completed' ? (
                  <>
                    <Text style={[styles.rowSub, sub]}>
                      Commission {formatAr(p.commission_amount)} ({p.commission_rate}%) · Net thérapeute {formatAr(p.net_amount)}
                    </Text>
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => navigation.navigate('Receipt', { kind: 'payment', id: p.id, view: 'client' })}>
                        <Ionicons name="receipt-outline" size={15} color="#fff" />
                        <Text style={styles.smallBtnText}>Reçu client</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => navigation.navigate('Receipt', { kind: 'payment', id: p.id, view: 'therapist' })}>
                        <Ionicons name="receipt-outline" size={15} color="#fff" />
                        <Text style={styles.smallBtnText}>Reçu thérapeute</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.outlineBtn} disabled={busy === `pp${p.id}`} onPress={() => receiptPdf(`pp${p.id}`, () => paymentService.downloadPaymentReceipt(p.id, 'client'))}>
                        <Ionicons name="download-outline" size={15} color={PRIMARY} />
                        <Text style={[styles.outlineText, { color: PRIMARY }]}>PDF</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </View>
            ))}
            </View>
          </View>
          </>
        ) : null}

        {/* ============ RETRAITS ============ */}
        {tab === 'withdrawals' ? (
          <View style={[styles.card, card]}>
            <Text style={[styles.cardTitle, txt]}>Demandes de retrait des thérapeutes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 10 }}>
              {[['pending', 'À traiter'], ['completed', 'Payés'], ['failed', 'Refusés'], ['all', 'Tous']].map(([id, label]) => (
                <TouchableOpacity key={id} onPress={() => setWFilter(id)} style={[styles.sw, wFilter === id && { backgroundColor: PRIMARY }]}>
                  <Text style={{ color: wFilter === id ? '#fff' : theme.textSecondary, fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <FilterBar value={filters} onChange={setFilters} methodOptions={WD_METHOD_OPTIONS}
              placeholder="Thérapeute, montant, référence, numéro…" total={shownW.length} shown={fWithdrawals.length} theme={theme} />
            {fWithdrawals.length === 0 ? <Text style={[styles.empty, sub]}>Aucune demande pour ces critères.</Text> : null}
            <View style={styles.grid}>
            {fWithdrawals.map((w) => {
              const open = w.status === 'pending' || w.status === 'processing';
              return (
                <View key={w.id} style={[styles.row, { width: cellW }]}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowTitle, txt]}>{w.therapist_name || `Thérapeute #${w.therapist_id}`}</Text>
                    <Pill s={w.status} />
                  </View>
                  <Text style={[styles.rowTitle, { color: PRIMARY }]}>{formatAr(w.amount)}</Text>
                  {w.fee > 0 ? <Text style={[styles.rowSub, sub]}>Frais {formatAr(w.fee)} · à verser {formatAr(w.net_amount)}</Text> : null}
                  <Text style={[styles.rowSub, sub]}>
                    {w.method === 'mobile_money'
                      ? `${NAMES[w.provider] || 'Mobile Money'} · ${w.phone_number || ''}`
                      : w.method === 'bank_transfer'
                      ? `${w.bank_name || ''} · ${w.account_number || ''} · ${w.account_holder || ''}`
                      : 'Espèces'}
                  </Text>
                  <Text style={[styles.rowSub, sub]}>Demandé le {formatDateTime(w.created_at)} (Madagascar) · Réf. {w.reference}</Text>
                  {w.processed_at ? <Text style={[styles.rowSub, sub]}>Accepté le {formatDateTime(w.processed_at)}</Text> : null}
                  {w.completed_at && w.status === 'completed' ? <Text style={[styles.rowSub, sub]}>Payé le {formatDateTime(w.completed_at)}</Text> : null}
                  {w.notes ? <Text style={[styles.rowSub, sub]}>{w.notes}</Text> : null}

                  {open ? (
                    <View style={{ marginTop: 8, gap: 8 }}>
                      {w.status === 'pending' ? (
                        <TouchableOpacity style={styles.smallBtn} disabled={busy === `a${w.id}`} onPress={() => act(`a${w.id}`, () => paymentService.adminApproveWithdrawal(w.id), 'Demande acceptée.')}>
                          {busy === `a${w.id}` ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.smallBtnText}>Accepter la demande</Text>}
                        </TouchableOpacity>
                      ) : null}
                      <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                        placeholder="Référence du transfert effectué"
                        placeholderTextColor={theme.placeholder}
                        value={refs[w.id] || ''}
                        onChangeText={(v) => setRefs({ ...refs, [w.id]: v })}
                        autoCapitalize="characters"
                      />
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: '#047857' }]}
                        disabled={busy === `c${w.id}`}
                        onPress={() => act(`c${w.id}`, () => paymentService.adminCompleteWithdrawal(w.id, refs[w.id] || ''), 'Retrait payé — reçu généré.')}
                      >
                        {busy === `c${w.id}` ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.smallBtnText}>Marquer payé (après transfert)</Text>}
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                        placeholder="Motif du refus (optionnel)"
                        placeholderTextColor={theme.placeholder}
                        value={reasons[w.id] || ''}
                        onChangeText={(v) => setReasons({ ...reasons, [w.id]: v })}
                      />
                      <TouchableOpacity style={styles.outlineBtn} disabled={busy === `r${w.id}`} onPress={() => act(`r${w.id}`, () => paymentService.adminRejectWithdrawal(w.id, reasons[w.id]), 'Demande refusée.')}>
                        <Text style={styles.outlineText}>Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {w.receipt_available ? (
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => navigation.navigate('Receipt', { kind: 'withdrawal', id: w.id })}>
                        <Ionicons name="receipt-outline" size={15} color="#fff" />
                        <Text style={styles.smallBtnText}>Voir le reçu</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.outlineBtn} disabled={busy === `rw${w.id}`} onPress={() => receiptPdf(`rw${w.id}`, () => paymentService.downloadWithdrawalReceipt(w.id))}>
                        {busy === `rw${w.id}` ? <ActivityIndicator color={PRIMARY} size="small" /> : (
                          <>
                            <Ionicons name="download-outline" size={15} color={PRIMARY} />
                            <Text style={[styles.outlineText, { color: PRIMARY }]}>PDF</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}
            </View>
          </View>
        ) : null}

        {/* ============ COMMISSIONS ============ */}
        {tab === 'commissions' ? (
          <>
            <FilterBar value={filters} onChange={setFilters} statusOptions={CM_STATUS_OPTIONS} methodOptions={CM_METHOD_OPTIONS}
              placeholder="Thérapeute, montant, référence…" total={commissions.length} shown={fCommissions.length} theme={theme} />
            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Paiements de commission à valider</Text>
              {fCommissions.length === 0 ? <Text style={[styles.empty, sub]}>Aucun paiement de commission pour ces critères.</Text> : null}
              <View style={styles.grid}>
              {fCommissions.map((c) => (
                <View key={c.id} style={[styles.row, { width: cellW }]}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowTitle, txt]}>{c.therapist_name || `Thérapeute #${c.therapist_id}`}</Text>
                    <Pill s={c.status} />
                  </View>
                  <Text style={[styles.rowTitle, { color: PRIMARY }]}>{formatAr(c.amount)}</Text>
                  <Text style={[styles.rowSub, sub]}>
                    {c.method === 'wallet' ? 'Depuis le wallet' : `${NAMES[c.provider] || c.method}${c.phone_number ? ` · ${c.phone_number}` : ''}`}
                  </Text>
                  <Text style={[styles.rowSub, sub]}>Soumis le {formatDateTime(c.created_at)} (Madagascar)</Text>
                  {c.completed_at && c.status === 'completed' ? <Text style={[styles.rowSub, sub]}>Validé le {formatDateTime(c.completed_at)}</Text> : null}
                  {c.transfer_reference ? <Text style={[styles.rowSub, sub]}>Réf. du thérapeute : {c.transfer_reference}</Text> : null}
                  {c.status === 'pending' ? (
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#047857' }]} disabled={busy === `ca${c.id}`} onPress={() => act(`ca${c.id}`, () => paymentService.adminApproveCommission(c.id), 'Commission validée — reçu généré.')}>
                        {busy === `ca${c.id}` ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.smallBtnText}>Valider</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.outlineBtn} disabled={busy === `cr${c.id}`} onPress={() => act(`cr${c.id}`, () => paymentService.adminRejectCommission(c.id, 'Transfert non retrouvé'), 'Paiement refusé.')}>
                        <Text style={styles.outlineText}>Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {c.receipt_available ? (
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => navigation.navigate('Receipt', { kind: 'commission', id: c.id })}>
                        <Ionicons name="receipt-outline" size={15} color="#fff" />
                        <Text style={styles.smallBtnText}>Voir le reçu</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.outlineBtn} disabled={busy === `rc${c.id}`} onPress={() => receiptPdf(`rc${c.id}`, () => paymentService.downloadCommissionReceipt(c.id))}>
                        <Ionicons name="download-outline" size={15} color={PRIMARY} />
                        <Text style={[styles.outlineText, { color: PRIMARY }]}>PDF</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))}
              </View>
            </View>
            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Commission encore due par thérapeute</Text>
              {dues.length === 0 ? <Text style={[styles.empty, sub]}>Aucune commission due.</Text> : null}
              {dues.map((d) => (
                <View key={d.therapist_id} style={[styles.rowTop, { paddingVertical: 8 }]}>
                  <Text style={[styles.rowTitle, txt]}>{d.therapist_name || `#${d.therapist_id}`}</Text>
                  <Text style={[styles.rowTitle, { color: '#B45309' }]}>{formatAr(d.due)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ============ JOURNAL ============ */}
        {tab === 'transactions' ? (
          <>
          <FilterBar value={filters} onChange={setFilters} placeholder="Utilisateur, description, montant…" total={transactions.length} shown={fTransactions.length} theme={theme} />
          <View style={[styles.card, card]}>
            <Text style={[styles.cardTitle, txt]}>Journal des opérations</Text>
            {fTransactions.length === 0 ? <Text style={[styles.empty, sub]}>Aucune opération pour ces critères.</Text> : null}
            <View style={styles.grid}>
            {fTransactions.map((t) => (
              <View key={t.id} style={[styles.row, { width: cellW }]}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, txt]}>{t.user_name || `#${t.user_id}`}</Text>
                  <Text style={[styles.rowTitle, { color: PRIMARY }]}>{formatAr(t.amount)}</Text>
                </View>
                <Text style={[styles.rowSub, sub]} numberOfLines={2}>{t.description || t.type}</Text>
                <Text style={[styles.rowSub, sub]}>{formatDateTime(t.created_at)}</Text>
              </View>
            ))}
            </View>
          </View>
          </>
        ) : null}
      </ScrollView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14, width: '100%', alignSelf: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14 },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12 },
  errorText: { color: '#B91C1C', flex: 1, fontSize: 13, fontWeight: '400' },
  noticeBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#D1FAE5', borderRadius: 12, padding: 12 },
  noticeText: { color: '#047857', flex: 1, fontSize: 13, fontWeight: '400' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  tabText: { fontSize: 13, fontWeight: '400' },
  badge: { backgroundColor: '#DC2626', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '400' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tabsBar: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  todoRowWrap: { flexDirection: 'row', gap: 12 },
  todoCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  todoTitle: { fontSize: 14, fontWeight: '700' },
  todoSub: { fontSize: 13, fontWeight: '400' },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  todoRowText: { flex: 1, fontSize: 14, fontWeight: '700' },
  kpiWrap: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  totalCard: { backgroundColor: '#1F6B45', borderRadius: 18, padding: 18, gap: 6, flex: 1, justifyContent: 'center' },
  totalLabel: { color: '#CFE5D8', fontSize: 12, fontWeight: '600' },
  totalValue: { color: '#fff', fontSize: 28, fontWeight: '800' },
  splitBar: { flexDirection: 'row', height: 9, borderRadius: 5, overflow: 'hidden', marginTop: 6 },
  splitLegend: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  totalSmall: { color: '#fff', fontSize: 12, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flexGrow: 1, flexBasis: '46%', borderWidth: 1, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, gap: 4, justifyContent: 'center' },
  kpiLabel: { fontSize: 12, fontWeight: '500' },
  kpiValue: { fontSize: 18, fontWeight: '700' },
  rowCards: { flexDirection: 'row', gap: 14, alignItems: 'stretch' },
  gridRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  commRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  commLabel: { fontSize: 13, fontWeight: '500' },
  commValue: { fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: '400' },
  sw: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  empty: { fontSize: 13, marginTop: 10, fontWeight: '400' },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDD', gap: 3 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 14, fontWeight: '400', flexShrink: 1 },
  rowSub: { fontSize: 12, fontWeight: '400' },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '400' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  smallBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '400' },
  outlineBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B91C1C', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  outlineText: { color: '#B91C1C', fontSize: 13, fontWeight: '400' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontWeight: '400' },
});

export default PaymentsScreen;
