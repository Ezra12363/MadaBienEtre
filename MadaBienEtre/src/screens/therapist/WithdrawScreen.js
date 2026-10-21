// src/screens/therapist/WithdrawScreen.js
//
// Demande de retrait du thérapeute -> envoyée à l'admin.
//   - le solde vient du wallet RÉEL (GET /wallet/me), plus aucune valeur fictive ;
//   - frais de retrait, minimum et modes autorisés viennent des paramètres de l'admin ;
//   - Mobile Money : opérateur + numéro ; banque : nom, n° de compte, titulaire ;
//   - la demande apparaît tout de suite dans « Mes gains > Retraits » (statut En attente) ;
//     l'admin l'accepte puis la paie ; un reçu PDF (QR + code-barres) est alors disponible.
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { formatAr, formatDateTime } from '../../components/payment/paymentUtils';
import { useTheme } from '../../context/ThemeContext';
import paymentService from '../../services/paymentService';

const GREEN = '#1F6B45';

const METHODS = [
  { id: 'mobile_money', flag: 'withdraw_mobile_money_enabled', label: 'Mobile Money', icon: 'phone-portrait-outline' },
  { id: 'bank_transfer', flag: 'withdraw_bank_enabled', label: 'Virement bancaire', icon: 'business-outline' },
  { id: 'cash', flag: 'withdraw_cash_enabled', label: 'Espèces (remise en main propre)', icon: 'cash-outline' },
];
const PROVIDERS = [
  { id: 'mvola', label: 'MVola' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'airtel_money', label: 'Airtel Money' },
];

const WithdrawScreen = ({ navigation }) => {
  const { colors: theme } = useTheme();

  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(null);
  const [provider, setProvider] = useState('mvola');
  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await paymentService.getMyWallet();
    if (res.success) {
      setWallet(res.data);
      setError('');
    } else {
      setError(res.error || 'Impossible de charger votre solde.');
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const available = Number(wallet?.available || 0);
  const minWithdrawal = Number(wallet?.min_withdrawal || 0);
  const feePercent = Number(wallet?.withdrawal_fee_percent || 0);
  const cfg = wallet?.payment_config || {};
  const allowed = METHODS.filter((m) => cfg[m.flag] !== false);

  const value = Number(String(amount).replace(/[^0-9.]/g, '')) || 0;
  const fee = Math.round((value * feePercent) / 100);
  const net = Math.max(value - fee, 0);

  const validate = () => {
    if (!value || value <= 0) return 'Saisissez un montant valide.';
    if (value < minWithdrawal) return `Retrait minimum : ${formatAr(minWithdrawal)}.`;
    if (value > available) return `Solde insuffisant (disponible : ${formatAr(available)}).`;
    if (!method) return 'Choisissez un mode de retrait.';
    if (method === 'mobile_money' && String(phone).replace(/\D/g, '').length < 9) {
      return 'Saisissez le numéro Mobile Money qui recevra l’argent.';
    }
    if (method === 'bank_transfer' && (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim())) {
      return 'Remplissez tous les champs bancaires.';
    }
    return '';
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSubmitting(true);
    const payload = { amount: value, method };
    if (method === 'mobile_money') {
      payload.provider = provider;
      payload.phone_number = phone.trim();
    }
    if (method === 'bank_transfer') {
      payload.bank_name = bankName.trim();
      payload.account_number = accountNumber.trim();
      payload.account_holder = accountHolder.trim();
    }
    const res = await paymentService.requestWithdrawal(payload);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || 'La demande a échoué. Réessayez.');
      return;
    }
    // Le montant est DÉJÀ déduit du solde disponible : on met l'affichage à jour tout de suite.
    if (res.data?.wallet_after) setWallet((prev) => ({ ...(prev || {}), ...res.data.wallet_after }));
    setDone(res.data);
  };

  const txt = { color: theme.text };
  const sub = { color: theme.textSecondary };
  const box = { backgroundColor: theme.surface, borderColor: theme.border || '#E5E7EB' };
  const input = { color: theme.text, borderColor: theme.border || '#D1D5DB' };

  if (done) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Header title="Retrait d'argent" showBack />
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={64} color={GREEN} />
          <Text style={[styles.title, txt]}>Demande envoyée</Text>
          <Text style={[styles.centerText, sub]}>
            {formatAr(done.amount)} sont bloqués sur votre wallet. L’administrateur va accepter puis payer votre
            demande ; vous serez notifié et le reçu PDF sera disponible dans « Mes gains &gt; Retraits ».
          </Text>
          <Text style={[styles.centerText, sub]}>Référence : {done.reference}</Text>
          {done.created_at ? <Text style={[styles.centerText, sub]}>Demandé le {formatDateTime(done.created_at)} (heure de Madagascar)</Text> : null}
          <Text style={[styles.title, txt]}>Nouveau solde disponible : {formatAr(available)}</Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => {
              try {
                navigation.navigate('EarningsScreen', { tab: 'retraits', ts: Date.now() });
              } catch (e) {
                navigation.goBack();
              }
            }}
          >
            <Text style={styles.primaryText}>Voir mes retraits</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Retrait d'argent" showBack />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.balance}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <Text style={styles.balanceValue}>{formatAr(available)}</Text>
            <Text style={styles.balanceHint}>
              Minimum {formatAr(minWithdrawal)}
              {feePercent > 0 ? ` · frais ${feePercent} %` : ''}
            </Text>
            {value > 0 ? (
              <View style={styles.afterRow}>
                <Text style={styles.balanceHint}>Solde après cette demande</Text>
                <Text style={[styles.afterValue, value > available && { color: '#FECACA' }]}>{formatAr(available - value)}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.card, box]}>
            <Text style={[styles.label, sub]}>Montant à retirer (Ar)</Text>
            <TextInput
              style={[styles.input, input]}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="Ex. 50000"
              placeholderTextColor={theme.placeholder}
            />
            <TouchableOpacity onPress={() => setAmount(String(Math.floor(available)))}>
              <Text style={[styles.link, { color: GREEN }]}>Tout retirer</Text>
            </TouchableOpacity>
            {value > 0 && feePercent > 0 ? (
              <Text style={[styles.hint, sub]}>
                Frais : {formatAr(fee)} · Vous recevrez : {formatAr(net)}
              </Text>
            ) : null}
          </View>

          <View style={[styles.card, box]}>
            <Text style={[styles.label, sub]}>Mode de retrait</Text>
            {allowed.length === 0 ? (
              <Text style={[styles.hint, sub]}>Les retraits sont momentanément désactivés par l’administrateur.</Text>
            ) : null}
            {allowed.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.mode, { borderColor: method === m.id ? GREEN : theme.border || '#D1D5DB' }]}
                onPress={() => setMethod(m.id)}
                activeOpacity={0.85}
              >
                <Ionicons name={m.icon} size={20} color={method === m.id ? GREEN : theme.textSecondary} />
                <Text style={[styles.modeText, { color: method === m.id ? GREEN : theme.text }]}>{m.label}</Text>
                {method === m.id ? <Ionicons name="checkmark-circle" size={18} color={GREEN} /> : null}
              </TouchableOpacity>
            ))}

            {method === 'mobile_money' ? (
              <>
                <View style={styles.provRow}>
                  {PROVIDERS.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.prov, provider === p.id && { backgroundColor: GREEN, borderColor: GREEN }]}
                      onPress={() => setProvider(p.id)}
                    >
                      <Text style={{ color: provider === p.id ? '#fff' : theme.text, fontSize: 13 }}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.label, sub]}>Numéro qui reçoit l’argent</Text>
                <TextInput
                  style={[styles.input, input]}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="034 12 345 67"
                  placeholderTextColor={theme.placeholder}
                />
              </>
            ) : null}

            {method === 'bank_transfer' ? (
              <>
                <Text style={[styles.label, sub]}>Banque</Text>
                <TextInput style={[styles.input, input]} value={bankName} onChangeText={setBankName} placeholder="BNI, BOA, BFV..." placeholderTextColor={theme.placeholder} />
                <Text style={[styles.label, sub]}>Numéro de compte</Text>
                <TextInput style={[styles.input, input]} value={accountNumber} onChangeText={setAccountNumber} keyboardType="numbers-and-punctuation" placeholderTextColor={theme.placeholder} />
                <Text style={[styles.label, sub]}>Titulaire du compte</Text>
                <TextInput style={[styles.input, input]} value={accountHolder} onChangeText={setAccountHolder} placeholderTextColor={theme.placeholder} />
              </>
            ) : null}

            {method === 'cash' ? (
              <Text style={[styles.hint, sub]}>L’administrateur vous remettra l’argent en main propre.</Text>
            ) : null}
          </View>

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={GREEN} />
            <Text style={[styles.noticeText, sub]}>
              Le montant est bloqué dès l’envoi de la demande. S’il est refusé ou annulé, il revient sur votre solde.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primary, (submitting || allowed.length === 0) && { opacity: 0.6 }]}
            onPress={submit}
            disabled={submitting || allowed.length === 0}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Envoyer la demande à l’admin</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  centerText: { fontSize: 14, textAlign: 'center', lineHeight: 20, fontWeight: '400' },
  title: { fontSize: 20, fontWeight: '400' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  afterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.4)' },
  afterValue: { color: '#fff', fontSize: 18, fontWeight: '400' },
  balance: { backgroundColor: GREEN, borderRadius: 18, padding: 18 },
  balanceLabel: { color: '#CFE5D8', fontSize: 13, fontWeight: '400' },
  balanceValue: { color: '#fff', fontSize: 30, marginTop: 4, fontWeight: '400' },
  balanceHint: { color: '#CFE5D8', fontSize: 12, marginTop: 4, fontWeight: '400' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  label: { fontSize: 12, marginTop: 10, marginBottom: 6, fontWeight: '400' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, fontWeight: '400' },
  link: { fontSize: 13, marginTop: 8, fontWeight: '400' },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17, fontWeight: '400' },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  modeText: { flex: 1, fontSize: 14, fontWeight: '400' },
  provRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  prov: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#CCC' },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '400' },
  error: { color: '#B91C1C', fontSize: 13, fontWeight: '400' },
  primary: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minWidth: 200, paddingHorizontal: 18 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '400' },
  ghost: { alignItems: 'center', paddingVertical: 12 },
});

export default WithdrawScreen;
