// src/screens/therapist/EarningsScreen.js
//
// Espace « argent » du thérapeute :
//   - Vue d'ensemble : chiffres clés + graphiques (gains par jour / par mois, modes de paiement) ;
//   - Gains : historique des opérations + espèces à confirmer ;
//   - Retraits : demandes envoyées à l'admin, statut, reçu PDF quand c'est payé ;
//   - Commission : frais dus à l'admin (paiements en espèces), paiement + reçu PDF.
//
// ⚠️ Le wallet n'est PAS de l'argent déjà reçu sur Mobile Money : c'est le registre
// de ce qui vous est dû. Un retrait n'est « payé » que lorsque l'admin a réellement
// fait le transfert (statut « Payé » + référence + reçu).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
import SavedCardsManager from '../../components/payment/SavedCardsManager';
import { formatAr, formatDateTime, formatShort, inRange } from '../../components/payment/paymentUtils';
import { useTheme } from '../../context/ThemeContext';
import paymentService from '../../services/paymentService';
import { colors } from '../../theme';

const PRIMARY = colors.primary || '#1F6B45';

const WITHDRAWAL_STATUS = {
  pending: { label: 'En attente', color: '#B45309', bg: '#FEF3C7' },
  processing: { label: 'En traitement', color: '#1D4ED8', bg: '#DBEAFE' },
  completed: { label: 'Payé', color: '#047857', bg: '#D1FAE5' },
  failed: { label: 'Refusé', color: '#B91C1C', bg: '#FEE2E2' },
  cancelled: { label: 'Annulé', color: '#6B7280', bg: '#F3F4F6' },
};
const COMMISSION_STATUS = {
  pending: WITHDRAWAL_STATUS.pending,
  completed: { label: 'Validé', color: '#047857', bg: '#D1FAE5' },
  rejected: WITHDRAWAL_STATUS.failed,
};

const TX_META = {
  payment: { icon: 'cash-outline', color: PRIMARY, sign: '+' },
  commission: { icon: 'pie-chart-outline', color: '#B45309', sign: '−' },
  withdrawal: { icon: 'arrow-up-circle-outline', color: '#1D4ED8', sign: '−' },
  refund: { icon: 'return-down-back-outline', color: '#B91C1C', sign: '−' },
  bonus: { icon: 'gift-outline', color: PRIMARY, sign: '+' },
  deposit: { icon: 'add-circle-outline', color: PRIMARY, sign: '+' },
};

const METHOD_NAMES = {
  mvola: 'MVola',
  orange_money: 'Orange Money',
  airtel_money: 'Airtel Money',
  stripe: 'Carte',
  vanila_pay: 'Vanila Pay',
  card: 'Carte',
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
};
const METHOD_COLORS = ['#1F6B45', '#B8924A', '#2F6DB5', '#C0562F', '#7A5CB5', '#4A9B9B'];

const COMMISSION_MODES = [
  { id: 'wallet', label: 'Depuis mon wallet', icon: 'wallet-outline' },
  { id: 'mobile_money', label: 'Mobile Money', icon: 'phone-portrait-outline' },
  { id: 'bank_transfer', label: 'Virement bancaire', icon: 'business-outline' },
  { id: 'card', label: 'Carte bancaire enregistrée', icon: 'card-outline' },
  { id: 'cash', label: 'Espèces à l’admin', icon: 'cash-outline' },
];

const TX_TYPE_OPTIONS = [
  { id: 'all', label: 'Tout' },
  { id: 'payment', label: 'Paiements reçus' },
  { id: 'commission', label: 'Commissions' },
  { id: 'withdrawal', label: 'Retraits' },
  { id: 'refund', label: 'Remboursements' },
];
const WD_STATUS_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'pending', label: 'En attente' },
  { id: 'processing', label: 'En traitement' },
  { id: 'completed', label: 'Payés' },
  { id: 'failed', label: 'Refusés' },
  { id: 'cancelled', label: 'Annulés' },
];
const CM_STATUS_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'pending', label: 'En attente' },
  { id: 'completed', label: 'Validés' },
  { id: 'rejected', label: 'Refusés' },
];
const WD_METHOD_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'bank_transfer', label: 'Banque' },
  { id: 'cash', label: 'Espèces' },
];
const CM_METHOD_OPTIONS = [{ id: 'all', label: 'Tous' }, ...COMMISSION_MODES.map((m) => ({ id: m.id, label: m.label }))];

const matchText = (q, ...parts) => {
  const s = String(q || '').trim().toLowerCase();
  return !s || parts.some((p) => String(p ?? '').toLowerCase().includes(s));
};

const EarningsScreen = ({ navigation, route }) => {
  const { colors: theme } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;      // web / tablette : pleine largeur, 2 colonnes
  const cols = width >= 1400 ? 3 : wide ? 2 : 1;
  const cellW = cols === 1 ? '100%' : cols === 2 ? '49.2%' : '32.5%';

  const [wallet, setWallet] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState('overview'); // overview | gains | retraits | commission
  const [range, setRange] = useState('month'); // day | month

  // modal paiement de commission
  const [cmOpen, setCmOpen] = useState(false);
  const [cm, setCm] = useState({ amount: '', method: 'wallet', provider: 'mvola', phone: '', ref: '' });
  const [cmCardId, setCmCardId] = useState(null);
  const [cmBusy, setCmBusy] = useState(false);
  const [cmError, setCmError] = useState('');

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Arrivée depuis une notification (retrait accepté / payé, commission) : bon onglet tout de suite
  const routeTab = route?.params?.tab;
  const routeTs = route?.params?.ts;
  useEffect(() => {
    if (routeTab && ['overview', 'gains', 'retraits', 'commission'].includes(routeTab)) {
      setTab(routeTab);
      setFilters(EMPTY_FILTERS);
    }
  }, [routeTab, routeTs]);

  const changeTab = (id) => {
    setTab(id);
    setFilters(EMPTY_FILTERS);
  };

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [w, s] = await Promise.all([paymentService.getMyWallet(), paymentService.myStats()]);
    if (!mountedRef.current) return;
    if (w.success) {
      setWallet(w.data);
      setError(null);
    } else {
      setError(w.error);
    }
    if (s.success) setStats(s.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const confirmCash = async (paymentId) => {
    setBusyId(paymentId);
    const res = await paymentService.confirmCash(paymentId);
    setBusyId(null);
    if (!res.success) return setError(res.error);
    load(true);
  };

  const cancelWithdrawal = async (id) => {
    setBusyId(`w${id}`);
    const res = await paymentService.cancelWithdrawal(id);
    setBusyId(null);
    if (!res.success) return setError(res.error);
    load(true);
  };

  const downloadReceipt = async (kind, id) => {
    setBusyId(`r${kind}${id}`);
    const res =
      kind === 'wd' ? await paymentService.downloadWithdrawalReceipt(id) : await paymentService.downloadCommissionReceipt(id);
    setBusyId(null);
    if (!res.success) setError(res.error);
    else setNotice('Reçu prêt.');
  };

  const submitCommission = async () => {
    setCmError('');
    const amount = Number(String(cm.amount).replace(/\s/g, ''));
    if (!amount || amount <= 0) return setCmError('Entrez un montant valide.');
    if (cm.method === 'card' && !cmCardId) return setCmError('Choisissez ou ajoutez une carte bancaire.');
    setCmBusy(true);
    const res = await paymentService.payCommission({
      amount,
      method: cm.method,
      card_id: cm.method === 'card' ? cmCardId : undefined,
      provider: cm.method === 'mobile_money' ? cm.provider : undefined,
      phone_number: cm.method === 'mobile_money' ? cm.phone : undefined,
      transfer_reference: ['wallet', 'cash', 'card'].includes(cm.method) ? undefined : cm.ref,
    });
    setCmBusy(false);
    if (!res.success) return setCmError(res.error);
    setCmOpen(false);
    setCm({ amount: '', method: 'wallet', provider: 'mvola', phone: '', ref: '' });
    if (res.data?.wallet_after) setWallet((prev) => ({ ...(prev || {}), ...res.data.wallet_after }));
    setNotice(
      res.data?.status === 'completed'
        ? 'Commission réglée depuis votre wallet.'
        : 'Paiement envoyé : l’administrateur va le valider.'
    );
    load(true);
  };

  const card = { backgroundColor: theme.surface, borderColor: theme.border || '#E5E7EB' };
  const txt = { color: theme.text };
  const sub = { color: theme.textSecondary };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Mes gains" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  const w = wallet || {};
  const s = stats || {};
  const canWithdraw = (w.available || 0) >= (w.min_withdrawal || 0) && (w.available || 0) > 0;
  const due = w.commission_due || 0;

  const chartData =
    range === 'day'
      ? (s.daily || []).map((d) => ({ label: dayLabel(d.date), values: { net: d.net, commission: d.commission } }))
      : (s.monthly || []).map((m) => ({
          label: monthLabel(m.month),
          values: { net: m.net, commission: m.commission, withdrawn: m.withdrawn },
        }));
  const chartSeries =
    range === 'day'
      ? [
          { key: 'net', color: PRIMARY, name: 'Gains nets' },
          { key: 'commission', color: '#B8924A', name: 'Commission' },
        ]
      : [
          { key: 'net', color: PRIMARY, name: 'Gains nets' },
          { key: 'commission', color: '#B8924A', name: 'Commission' },
          { key: 'withdrawn', color: '#2F6DB5', name: 'Retiré' },
        ];
  const methodItems = Object.entries(s.by_method || {}).map(([k, v], i) => ({
    label: METHOD_NAMES[k] || k,
    value: v,
    color: METHOD_COLORS[i % METHOD_COLORS.length],
  }));

  const txs = (w.transactions || []).filter(
    (t) =>
      (filters.status === 'all' || t.type === filters.status) &&
      inRange(t.created_at, filters.range) &&
      matchText(filters.q, t.description, t.type, t.amount)
  );
  const wds = (w.withdrawals || []).filter(
    (r) =>
      (filters.status === 'all' || r.status === filters.status) &&
      (filters.method === 'all' || r.method === filters.method) &&
      inRange(r.created_at, filters.range) &&
      matchText(filters.q, r.amount, r.reference, r.phone_number, r.bank_name, r.id)
  );
  const cms = (w.commission_payments || []).filter(
    (c) =>
      (filters.status === 'all' || c.status === filters.status) &&
      (filters.method === 'all' || c.method === filters.method) &&
      inRange(c.created_at, filters.range) &&
      matchText(filters.q, c.amount, c.transfer_reference, c.id)
  );

  const Tab = ({ id, label }) => (
    <TouchableOpacity
      onPress={() => changeTab(id)}
      style={[styles.tab, tab === id && { backgroundColor: PRIMARY }]}
      activeOpacity={0.8}
    >
      <Text style={[styles.tabText, { color: tab === id ? '#fff' : theme.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Mes gains" showBack />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
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

        {/* Solde */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Solde disponible</Text>
          <Text style={styles.balanceValue}>{formatAr(w.available)}</Text>
          <Text style={styles.balanceHint}>
            En attente de retrait : {formatAr(w.withdrawals_pending)} · Déjà retiré : {formatAr(w.withdrawals_paid)}
          </Text>
          <TouchableOpacity
            disabled={!canWithdraw}
            onPress={() => navigation.navigate('Withdraw')}
            style={[styles.withdrawBtn, !canWithdraw && { opacity: 0.5 }]}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color={PRIMARY} />
            <Text style={styles.withdrawText}>Demander un retrait</Text>
          </TouchableOpacity>
          {!canWithdraw ? <Text style={styles.balanceHint}>Retrait minimum : {formatAr(w.min_withdrawal)}</Text> : null}
        </View>

        {due > 0 ? (
          <TouchableOpacity style={styles.dueBox} onPress={() => changeTab('commission')} activeOpacity={0.85}>
            <Ionicons name="alert-circle-outline" size={20} color="#9A6A12" />
            <Text style={styles.dueText}>
              Commission à payer à l’administrateur : {formatAr(due)} (paiements reçus en espèces)
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9A6A12" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.tabs}>
          <Tab id="overview" label="Aperçu" />
          <Tab id="gains" label="Gains" />
          <Tab id="retraits" label="Retraits" />
          <Tab id="commission" label="Commission" />
        </View>

        {/* ================= APERÇU ================= */}
        {tab === 'overview' ? (
          <>
            <View style={styles.tiles}>
              <StatTile label="Gains nets (total)" value={formatAr(s.net_total)} bg={theme.surface} textColor={theme.text} />
              <StatTile label="Commission payée" value={formatAr(s.commission_total)} color="#B8924A" bg={theme.surface} textColor={theme.text} />
              <StatTile label="Aujourd’hui" value={formatAr(s.today)} bg={theme.surface} textColor={theme.text} />
              <StatTile label="7 derniers jours" value={formatAr(s.week)} bg={theme.surface} textColor={theme.text} />
              <StatTile label="30 derniers jours" value={formatAr(s.month)} bg={theme.surface} textColor={theme.text} />
              <StatTile label="12 derniers mois" value={formatAr(s.year)} bg={theme.surface} textColor={theme.text} />
              <StatTile label="Réservations payées" value={`${s.paid_count || 0}`} color="#047857" bg={theme.surface} textColor={theme.text} />
              <StatTile
                label="En attente de paiement"
                value={`${(s.pending_count || 0) + (s.unpaid_bookings || 0)}`}
                color="#B45309"
                bg={theme.surface}
                textColor={theme.text}
              />
            </View>

            <View style={[styles.card, card]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, txt]}>Évolution de vos gains</Text>
                <View style={styles.switch}>
                  {[
                    ['day', '30 j'],
                    ['month', '12 mois'],
                  ].map(([id, label]) => (
                    <TouchableOpacity key={id} onPress={() => setRange(id)} style={[styles.switchBtn, range === id && { backgroundColor: PRIMARY }]}>
                      <Text style={[styles.switchText, { color: range === id ? '#fff' : theme.textSecondary }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <BarChart data={chartData} series={chartSeries} textColor={theme.textSecondary} gridColor={theme.border} barWidth={range === 'day' ? 7 : 12} />
            </View>

            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Gains par mode de paiement</Text>
              <View style={{ height: 10 }} />
              <HBars items={methodItems} textColor={theme.textSecondary} trackColor={theme.border} />
            </View>

            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Où va chaque paiement client</Text>
              <View style={{ height: 10 }} />
              <StackedShare
                textColor={theme.textSecondary}
                items={[
                  { label: 'Votre part', value: s.net_total, color: PRIMARY },
                  { label: 'Commission', value: s.commission_total, color: '#B8924A' },
                ]}
              />
            </View>
          </>
        ) : null}

        {/* ================= GAINS ================= */}
        {tab === 'gains' ? (
          <>
            {(w.cash_pending || []).length > 0 ? (
              <View style={[styles.card, card]}>
                <Text style={[styles.cardTitle, txt]}>Espèces à confirmer</Text>
                {(w.cash_pending || []).map((p) => (
                  <View key={p.payment_id} style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, txt]}>Réservation #{p.booking_id}</Text>
                      <Text style={[styles.rowSub, sub]}>
                        {formatAr(p.amount)} · {formatShort(p.created_at)}
                      </Text>
                      {p.client_sent_at ? (
                        <Text style={[styles.rowSub, { color: '#B45309' }]}>
                          Le client dit avoir payé le {formatDateTime(p.client_sent_at)}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity style={styles.smallBtn} disabled={busyId === p.payment_id} onPress={() => confirmCash(p.payment_id)}>
                      {busyId === p.payment_id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.smallBtnText}>Reçu</Text>}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            <FilterBar
              value={filters}
              onChange={setFilters}
              statusOptions={TX_TYPE_OPTIONS}
              placeholder="Rechercher une opération…"
              total={(w.transactions || []).length}
              shown={txs.length}
              theme={theme}
            />
            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Historique</Text>
              {txs.length === 0 ? <Text style={[styles.empty, sub]}>Aucune opération pour ces critères.</Text> : null}
              {txs.map((t) => {
                const m = TX_META[t.type] || TX_META.payment;
                return (
                  <View key={t.id} style={styles.listRow}>
                    <Ionicons name={m.icon} size={22} color={m.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, txt]} numberOfLines={2}>{t.description || t.type}</Text>
                      <Text style={[styles.rowSub, sub]}>{formatDateTime(t.created_at)}</Text>
                    </View>
                    <Text style={[styles.rowAmount, { color: m.color }]}>
                      {m.sign}
                      {formatAr(t.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* ================= RETRAITS ================= */}
        {tab === 'retraits' ? (
          <>
          <FilterBar
            value={filters}
            onChange={setFilters}
            statusOptions={WD_STATUS_OPTIONS}
            methodOptions={WD_METHOD_OPTIONS}
            placeholder="Montant, référence, numéro…"
            total={(w.withdrawals || []).length}
            shown={wds.length}
            theme={theme}
          />
          <View style={[styles.card, card]}>
            <Text style={[styles.cardTitle, txt]}>Mes demandes de retrait</Text>
            {wds.length === 0 ? <Text style={[styles.empty, sub]}>Aucune demande de retrait pour ces critères.</Text> : null}
            <View style={styles.grid}>
            {wds.map((r) => {
              const st = WITHDRAWAL_STATUS[r.status] || WITHDRAWAL_STATUS.pending;
              return (
                <View key={r.id} style={[styles.wRow, { width: cellW }]}>
                  <View style={styles.wTop}>
                    <Text style={[styles.rowTitle, txt]}>{formatAr(r.amount)}</Text>
                    <View style={[styles.pill, { backgroundColor: st.bg }]}>
                      <Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={[styles.rowSub, sub]}>
                    {r.method === 'mobile_money' ? `Mobile Money ${r.phone_number || ''}` : r.method === 'bank_transfer' ? `Banque ${r.bank_name || ''}` : 'Espèces'}
                  </Text>
                  <Text style={[styles.rowSub, sub]}>Demandé le {formatDateTime(r.created_at)}</Text>
                  {r.processed_at ? <Text style={[styles.rowSub, sub]}>Accepté le {formatDateTime(r.processed_at)}</Text> : null}
                  {r.completed_at && r.status === 'completed' ? <Text style={[styles.rowSub, sub]}>Payé le {formatDateTime(r.completed_at)}</Text> : null}
                  {r.fee > 0 ? <Text style={[styles.rowSub, sub]}>Frais : {formatAr(r.fee)} · Net versé : {formatAr(r.net_amount)}</Text> : null}
                  {r.reference ? <Text style={[styles.rowSub, sub]}>Réf. {r.reference}</Text> : null}
                  <View style={styles.actions}>
                    {r.status === 'pending' ? (
                      <TouchableOpacity style={styles.outlineBtn} disabled={busyId === `w${r.id}`} onPress={() => cancelWithdrawal(r.id)}>
                        <Text style={styles.outlineText}>Annuler la demande</Text>
                      </TouchableOpacity>
                    ) : null}
                    {r.receipt_available ? (
                      <>
                        <TouchableOpacity style={styles.smallBtn} onPress={() => navigation.navigate('Receipt', { kind: 'withdrawal', id: r.id })}>
                          <Ionicons name="receipt-outline" size={15} color="#fff" />
                          <Text style={styles.smallBtnText}>Voir le reçu</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.outlineBtnGreen} disabled={busyId === `rwd${r.id}`} onPress={() => downloadReceipt('wd', r.id)}>
                          {busyId === `rwd${r.id}` ? <ActivityIndicator color={PRIMARY} size="small" /> : (
                            <>
                              <Ionicons name="download-outline" size={15} color={PRIMARY} />
                              <Text style={styles.outlineGreenText}>PDF</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </View>
              );
            })}
            </View>
          </View>
          </>
        ) : null}

        {/* ================= COMMISSION ================= */}
        {tab === 'commission' ? (
          <>
            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Frais de commission</Text>
              <Text style={[styles.rowSub, sub, { marginTop: 6 }]}>
                Quand un client vous paie en espèces, vous gardez l’argent mais la commission de la plateforme reste due.
              </Text>
              <View style={styles.tiles}>
                <StatTile label="À payer" value={formatAr(due)} color="#B45309" bg={theme.surface} textColor={theme.text} />
                <StatTile label="En vérification" value={formatAr(w.commission_in_review)} color="#1D4ED8" bg={theme.surface} textColor={theme.text} />
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, due <= 0 && { opacity: 0.5 }]}
                disabled={due <= 0}
                onPress={() => {
                  setCm((c) => ({ ...c, amount: String(Math.round(due)) }));
                  setCmError('');
                  setCmOpen(true);
                }}
              >
                <Ionicons name="card-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Payer ma commission</Text>
              </TouchableOpacity>
            </View>
            <FilterBar
              value={filters}
              onChange={setFilters}
              statusOptions={CM_STATUS_OPTIONS}
              methodOptions={CM_METHOD_OPTIONS}
              placeholder="Montant, référence…"
              total={(w.commission_payments || []).length}
              shown={cms.length}
              theme={theme}
            />
            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Mes paiements de commission</Text>
              {cms.length === 0 ? <Text style={[styles.empty, sub]}>Aucun paiement de commission pour ces critères.</Text> : null}
              <View style={styles.grid}>
              {cms.map((c) => {
                const st = COMMISSION_STATUS[c.status] || COMMISSION_STATUS.pending;
                return (
                  <View key={c.id} style={[styles.wRow, { width: cellW }]}>
                    <View style={styles.wTop}>
                      <Text style={[styles.rowTitle, txt]}>{formatAr(c.amount)}</Text>
                      <View style={[styles.pill, { backgroundColor: st.bg }]}>
                        <Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                    <Text style={[styles.rowSub, sub]}>
                      {c.method === 'wallet' ? 'Depuis le wallet' : c.method === 'mobile_money' ? 'Mobile Money' : c.method === 'bank_transfer' ? 'Virement' : 'Espèces'}
                    </Text>
                    <Text style={[styles.rowSub, sub]}>Soumis le {formatDateTime(c.created_at)}</Text>
                    {c.completed_at && c.status === 'completed' ? <Text style={[styles.rowSub, sub]}>Validé le {formatDateTime(c.completed_at)}</Text> : null}
                    {c.notes ? <Text style={[styles.rowSub, sub]}>{c.notes}</Text> : null}
                    {c.receipt_available ? (
                      <View style={styles.actions}>
                        <TouchableOpacity style={styles.smallBtn} onPress={() => navigation.navigate('Receipt', { kind: 'commission', id: c.id })}>
                          <Ionicons name="receipt-outline" size={15} color="#fff" />
                          <Text style={styles.smallBtnText}>Voir le reçu</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.outlineBtnGreen} disabled={busyId === `rcm${c.id}`} onPress={() => downloadReceipt('cm', c.id)}>
                          {busyId === `rcm${c.id}` ? <ActivityIndicator color={PRIMARY} size="small" /> : (
                            <>
                              <Ionicons name="download-outline" size={15} color={PRIMARY} />
                              <Text style={styles.outlineGreenText}>PDF</Text>
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
          </>
        ) : null}
      </ScrollView>

      {/* ---------- Modal paiement de commission ---------- */}
      <Modal visible={cmOpen} transparent animationType="slide" onRequestClose={() => setCmOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCmOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.surface }]} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.cardTitle, txt]}>Payer ma commission</Text>
              <Text style={[styles.rowSub, sub, { marginTop: 4 }]}>Reste à payer : {formatAr(due)}</Text>

              <Text style={[styles.label, sub]}>Montant (Ar)</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                keyboardType="numeric"
                value={cm.amount}
                onChangeText={(v) => setCm({ ...cm, amount: v })}
              />

              <Text style={[styles.label, sub]}>Comment payez-vous ?</Text>
              {COMMISSION_MODES.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.mode, { borderColor: cm.method === m.id ? PRIMARY : theme.border }]}
                  onPress={() => setCm({ ...cm, method: m.id })}
                >
                  <Ionicons name={m.icon} size={20} color={cm.method === m.id ? PRIMARY : theme.textSecondary} />
                  <Text style={[styles.modeText, { color: cm.method === m.id ? PRIMARY : theme.text }]}>{m.label}</Text>
                  {cm.method === m.id ? <Ionicons name="checkmark-circle" size={18} color={PRIMARY} /> : null}
                </TouchableOpacity>
              ))}

              {cm.method === 'mobile_money' ? (
                <>
                  <View style={styles.provRow}>
                    {[
                      ['mvola', 'MVola'],
                      ['orange_money', 'Orange'],
                      ['airtel_money', 'Airtel'],
                    ].map(([id, label]) => (
                      <TouchableOpacity key={id} style={[styles.prov, cm.provider === id && { backgroundColor: PRIMARY }]} onPress={() => setCm({ ...cm, provider: id })}>
                        <Text style={{ color: cm.provider === id ? '#fff' : theme.text, fontSize: 13 }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.label, sub]}>Numéro utilisé pour payer</Text>
                  <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} keyboardType="phone-pad" value={cm.phone} onChangeText={(v) => setCm({ ...cm, phone: v })} placeholder="034 12 345 67" placeholderTextColor={theme.placeholder} />
                </>
              ) : null}
              {cm.method === 'mobile_money' || cm.method === 'bank_transfer' ? (
                <>
                  <Text style={[styles.label, sub]}>Référence de la transaction</Text>
                  <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={cm.ref} onChangeText={(v) => setCm({ ...cm, ref: v })} placeholder="Ex. MP260101.1234.A56789" placeholderTextColor={theme.placeholder} autoCapitalize="characters" />
                  <Text style={[styles.rowSub, sub]}>Effectuez d’abord le transfert à l’administrateur, puis saisissez la référence reçue. L’admin validera ensuite.</Text>
                </>
              ) : null}
              {cm.method === 'wallet' ? (
                <View style={styles.afterBox}>
                  <Text style={[styles.rowSub, sub]}>Solde disponible : {formatAr(w.available)}</Text>
                  <Text style={[styles.afterText, { color: Number(cm.amount) > (w.available || 0) ? '#B91C1C' : PRIMARY }]}>
                    Solde après paiement : {formatAr((w.available || 0) - (Number(String(cm.amount).replace(/\s/g, '')) || 0))}
                  </Text>
                  <Text style={[styles.rowSub, sub]}>Le montant est prélevé tout de suite sur votre solde et validé immédiatement.</Text>
                </View>
              ) : null}
              {cm.method === 'card' ? (
                <View style={{ marginTop: 10 }}>
                  <SavedCardsManager mode="select" hideTitle selectedId={cmCardId} onSelect={setCmCardId} />
                  <Text style={[styles.rowSub, sub]}>La carte est débitée tout de suite par Stripe et la commission est validée immédiatement.</Text>
                </View>
              ) : null}
              {cm.method === 'cash' ? <Text style={[styles.rowSub, sub, { marginTop: 8 }]}>Remettez les espèces à l’administrateur : il validera le paiement dans l’application.</Text> : null}

              {cmError ? <Text style={styles.cmError}>{cmError}</Text> : null}

              <TouchableOpacity style={[styles.primaryBtn, { marginTop: 14 }]} onPress={submitCommission} disabled={cmBusy}>
                {cmBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Confirmer</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center', padding: 12 }} onPress={() => setCmOpen(false)}>
                <Text style={sub}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14, width: '100%', alignSelf: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  afterBox: { marginTop: 10, gap: 4, backgroundColor: '#F3F8F5', borderRadius: 10, padding: 10 },
  afterText: { fontSize: 15, fontWeight: '400' },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12 },
  errorText: { color: '#B91C1C', flex: 1, fontSize: 13, fontWeight: '400' },
  noticeBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#D1FAE5', borderRadius: 12, padding: 12 },
  noticeText: { color: '#047857', flex: 1, fontSize: 13, fontWeight: '400' },
  balanceCard: { backgroundColor: '#1F6B45', borderRadius: 18, padding: 18, gap: 6 },
  balanceLabel: { color: '#CFE5D8', fontSize: 13, fontWeight: '400' },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: '400' },
  balanceHint: { color: '#CFE5D8', fontSize: 12, fontWeight: '400' },
  withdrawBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 11, marginTop: 8 },
  withdrawText: { color: PRIMARY, fontSize: 15, fontWeight: '400' },
  dueBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FBEFD5', borderRadius: 12, padding: 12 },
  dueText: { color: '#7A540C', flex: 1, fontSize: 13, fontWeight: '400' },
  tabs: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  tabText: { fontSize: 13, fontWeight: '400' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: '400' },
  switch: { flexDirection: 'row', gap: 4 },
  switchBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  switchText: { fontSize: 12, fontWeight: '400' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDD' },
  rowTitle: { fontSize: 14, fontWeight: '400' },
  rowSub: { fontSize: 12, marginTop: 2, fontWeight: '400' },
  rowAmount: { fontSize: 14, fontWeight: '400' },
  empty: { fontSize: 13, marginTop: 10, fontWeight: '400' },
  wRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDD', gap: 3 },
  wTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '400' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  smallBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '400' },
  outlineBtn: { borderWidth: 1, borderColor: '#B91C1C', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  outlineText: { color: '#B91C1C', fontSize: 13, fontWeight: '400' },
  outlineBtnGreen: { flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  outlineGreenText: { color: PRIMARY, fontSize: 13, fontWeight: '400' },
  primaryBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 13, marginTop: 12 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '400' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '90%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
  label: { fontSize: 12, marginTop: 14, marginBottom: 6, fontWeight: '400' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '400' },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  modeText: { flex: 1, fontSize: 14, fontWeight: '400' },
  provRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  prov: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#CCC' },
  cmError: { color: '#B91C1C', fontSize: 13, marginTop: 10, fontWeight: '400' },
});

export default EarningsScreen;
