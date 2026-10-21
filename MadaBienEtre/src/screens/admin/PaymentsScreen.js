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
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import Header from '../../components/common/Header';
import { BarChart, HBars, StackedShare, StatTile, dayLabel, monthLabel } from '../../components/charts/SimpleCharts';
import { formatAr, formatShort } from '../../components/payment/paymentUtils';
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

const PaymentsScreen = ({ navigation }) => {
  const { colors: theme } = useTheme();
  const [tab, setTab] = useState('overview');
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

  const chart =
    range === 'day'
      ? (ps.daily || []).map((d) => ({ label: dayLabel(d.date), values: { gross: d.gross, commission: d.commission } }))
      : (ws.monthly || []).map((m) => ({ label: monthLabel(m.month), values: { gross: m.gross, commission: m.commission, withdrawn: m.withdrawn } }));
  const series =
    range === 'day'
      ? [
          { key: 'gross', color: PRIMARY, name: 'Encaissé' },
          { key: 'commission', color: '#B8924A', name: 'Commission' },
        ]
      : [
          { key: 'gross', color: PRIMARY, name: 'Encaissé' },
          { key: 'commission', color: '#B8924A', name: 'Commission' },
          { key: 'withdrawn', color: '#2F6DB5', name: 'Retraits payés' },
        ];
  const methodItems = Object.entries(ps.by_method || {}).map(([k, v], i) => ({ label: NAMES[k] || k, value: v, color: MCOL[i % MCOL.length] }));
  const topItems = (ps.top_therapists || []).map((t) => ({ label: t.name || `#${t.therapist_id}`, value: t.gross, color: PRIMARY }));

  const Tab = ({ id, label, badge }) => (
    <TouchableOpacity onPress={() => setTab(id)} style={[styles.tab, tab === id && { backgroundColor: PRIMARY }]}>
      <Text style={[styles.tabText, { color: tab === id ? '#fff' : theme.textSecondary }]}>{label}</Text>
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Tab id="overview" label="Aperçu" />
          <Tab id="payments" label="Paiements" />
          <Tab id="withdrawals" label="Retraits" badge={pendingW.length} />
          <Tab id="commissions" label="Commissions" badge={pendingC.length} />
          <Tab id="transactions" label="Journal" />
        </ScrollView>

        {/* ============ APERÇU ============ */}
        {tab === 'overview' ? (
          <>
            <View style={styles.tiles}>
              <StatTile label="Total encaissé" value={formatAr(sm.total_payments)} bg={theme.surface} textColor={theme.text} />
              <StatTile label="Commission plateforme" value={formatAr(sm.total_commission)} color="#B8924A" bg={theme.surface} textColor={theme.text} />
              <StatTile label="Net dû aux thérapeutes" value={formatAr(sm.total_net_therapists)} bg={theme.surface} textColor={theme.text} />
              <StatTile label="Wallets (à payer)" value={formatAr(sm.wallets_available)} color="#2F6DB5" bg={theme.surface} textColor={theme.text} />
              <StatTile label="Retraits en attente" value={formatAr(sm.withdrawals_pending)} color="#B45309" bg={theme.surface} textColor={theme.text} />
              <StatTile label="Retraits payés" value={formatAr(sm.withdrawals_paid)} color="#047857" bg={theme.surface} textColor={theme.text} />
              <StatTile label="Commission encaissée" value={formatAr(ws.commission_collected)} color="#047857" bg={theme.surface} textColor={theme.text} />
              <StatTile label="Commission due (espèces)" value={formatAr(ws.commission_due)} color="#B45309" bg={theme.surface} textColor={theme.text} sub={`dont en vérification : ${formatAr(ws.commission_in_review)}`} />
              <StatTile label="Paiements confirmés" value={`${ps.completed_payments || 0}`} bg={theme.surface} textColor={theme.text} />
              <StatTile label="En attente / échoués" value={`${ps.pending_payments || 0} / ${ps.failed_payments || 0}`} color="#B45309" bg={theme.surface} textColor={theme.text} />
            </View>

            <View style={[styles.card, card]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, txt]}>Encaissements et commission</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[['day', '30 j'], ['month', '12 mois']].map(([id, label]) => (
                    <TouchableOpacity key={id} onPress={() => setRange(id)} style={[styles.sw, range === id && { backgroundColor: PRIMARY }]}>
                      <Text style={{ color: range === id ? '#fff' : theme.textSecondary, fontSize: 12 }}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <BarChart data={chart} series={series} textColor={theme.textSecondary} gridColor={theme.border} barWidth={range === 'day' ? 7 : 11} />
            </View>

            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Répartition des encaissements</Text>
              <View style={{ height: 10 }} />
              <StackedShare
                textColor={theme.textSecondary}
                items={[
                  { label: 'Part thérapeutes', value: sm.total_net_therapists, color: PRIMARY },
                  { label: 'Commission', value: sm.total_commission, color: '#B8924A' },
                ]}
              />
            </View>

            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Par mode de paiement</Text>
              <View style={{ height: 10 }} />
              <HBars items={methodItems} textColor={theme.textSecondary} trackColor={theme.border} />
            </View>

            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Top thérapeutes (encaissements)</Text>
              <View style={{ height: 10 }} />
              <HBars items={topItems} textColor={theme.textSecondary} trackColor={theme.border} />
            </View>

            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Demandes de retrait par statut</Text>
              <View style={{ height: 10 }} />
              <HBars
                textColor={theme.textSecondary}
                trackColor={theme.border}
                items={Object.entries(ws.withdrawals_by_status || {}).map(([k, v]) => ({
                  label: `${(STATUS[k] || {}).label || k} (${v.count})`,
                  value: v.amount,
                  color: (STATUS[k] || {}).color || PRIMARY,
                }))}
              />
            </View>
          </>
        ) : null}

        {/* ============ PAIEMENTS ============ */}
        {tab === 'payments' ? (
          <View style={[styles.card, card]}>
            <Text style={[styles.cardTitle, txt]}>Paiements des clients</Text>
            {payments.length === 0 ? <Text style={[styles.empty, sub]}>Aucun paiement.</Text> : null}
            {payments.map((p) => (
              <View key={p.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, txt]}>{formatAr(p.amount)}</Text>
                  <Pill s={p.status} />
                </View>
                <Text style={[styles.rowSub, sub]}>
                  {p.client_name || 'Client'} → {p.therapist_name || 'Thérapeute'} · réservation #{p.booking_id}
                </Text>
                <Text style={[styles.rowSub, sub]}>
                  {p.method_label} · {formatShort(p.paid_at || p.created_at)}
                </Text>
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
            {shownW.length === 0 ? <Text style={[styles.empty, sub]}>Aucune demande.</Text> : null}
            {shownW.map((w) => {
              const open = w.status === 'pending' || w.status === 'processing';
              return (
                <View key={w.id} style={styles.row}>
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
                  <Text style={[styles.rowSub, sub]}>Demandé le {formatShort(w.created_at)} · Réf. {w.reference}</Text>
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
        ) : null}

        {/* ============ COMMISSIONS ============ */}
        {tab === 'commissions' ? (
          <>
            <View style={[styles.card, card]}>
              <Text style={[styles.cardTitle, txt]}>Paiements de commission à valider</Text>
              {commissions.length === 0 ? <Text style={[styles.empty, sub]}>Aucun paiement de commission.</Text> : null}
              {commissions.map((c) => (
                <View key={c.id} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowTitle, txt]}>{c.therapist_name || `Thérapeute #${c.therapist_id}`}</Text>
                    <Pill s={c.status} />
                  </View>
                  <Text style={[styles.rowTitle, { color: PRIMARY }]}>{formatAr(c.amount)}</Text>
                  <Text style={[styles.rowSub, sub]}>
                    {c.method === 'wallet' ? 'Depuis le wallet' : `${NAMES[c.provider] || c.method}${c.phone_number ? ` · ${c.phone_number}` : ''}`} · {formatShort(c.created_at)}
                  </Text>
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
          <View style={[styles.card, card]}>
            <Text style={[styles.cardTitle, txt]}>Journal des opérations</Text>
            {transactions.length === 0 ? <Text style={[styles.empty, sub]}>Aucune opération.</Text> : null}
            {transactions.map((t) => (
              <View key={t.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, txt]}>{t.user_name || `#${t.user_id}`}</Text>
                  <Text style={[styles.rowTitle, { color: PRIMARY }]}>{formatAr(t.amount)}</Text>
                </View>
                <Text style={[styles.rowSub, sub]} numberOfLines={2}>{t.description || t.type}</Text>
                <Text style={[styles.rowSub, sub]}>{formatShort(t.created_at)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12 },
  errorText: { color: '#B91C1C', flex: 1, fontSize: 13, fontWeight: '400' },
  noticeBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#D1FAE5', borderRadius: 12, padding: 12 },
  noticeText: { color: '#047857', flex: 1, fontSize: 13, fontWeight: '400' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  tabText: { fontSize: 13, fontWeight: '400' },
  badge: { backgroundColor: '#DC2626', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '400' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
