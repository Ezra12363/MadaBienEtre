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
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import Header from '../../components/common/Header';
import MaskedField, { FormSummary } from '../../components/common/MaskedField';
import {
  maskAmount,
  maskBankAccount,
  maskFullname,
  maskLabel,
  maskMgPhone,
  parseAmount,
  rules,
} from '../../utils/inputMasks';
import { formatAr, formatDateTime } from '../../components/payment/paymentUtils';
import HideAmountsToggle from '../../components/common/HideAmountsToggle';
import { useHideAmounts } from '../../hooks/useHideAmounts';
import { useTheme } from '../../context/ThemeContext';
import paymentService from '../../services/paymentService';

const GREEN = '#2E8B57';

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
  const { show } = useHideAmounts();

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
  const [submitted, setSubmitted] = useState(false);
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

  const value = parseAmount(amount);
  const fee = Math.round((value * feePercent) / 100);
  const net = Math.max(value - fee, 0);

  // Règles par champ (masque + message d'erreur rouge / état valide vert)
  const validateAmount = (v) => {
    const base = rules.amount({ min: 1, label: 'Le montant' })(v);
    if (base) return base;
    const n = parseAmount(v);
    if (minWithdrawal && n < minWithdrawal) return `Retrait minimum : ${formatAr(minWithdrawal)}.`;
    if (n > available) return `Solde insuffisant (disponible : ${formatAr(available)}).`;
    return '';
  };
  const validateBankName = (v) => rules.minLen(2, 'Le nom de la banque')(v) || rules.required('Le nom de la banque')(v);

  const fieldErrors = {};
  const amountErr = validateAmount(amount);
  if (amountErr) fieldErrors.amount = amountErr;
  if (!method) fieldErrors.method = 'Choisissez un mode de retrait.';
  if (method === 'mobile_money') {
    const e = rules.mgPhone(phone);
    if (e) fieldErrors.phone = e;
  }
  if (method === 'bank_transfer') {
    const e1 = validateBankName(bankName);
    const e2 = rules.bankAccount(accountNumber);
    const e3 = rules.fullname(accountHolder);
    if (e1) fieldErrors.bankName = e1;
    if (e2) fieldErrors.accountNumber = e2;
    if (e3) fieldErrors.accountHolder = e3;
  }

  const submit = async () => {
    setSubmitted(true);
    const problem = Object.values(fieldErrors)[0];
    if (problem) {
      setError('');
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.balanceLabel}>Solde disponible</Text>
              <HideAmountsToggle color="#FFFFFF" />
            </View>
            <Text style={styles.balanceValue}>{show(formatAr(available))}</Text>
            <Text style={styles.balanceHint}>
              Minimum {formatAr(minWithdrawal)}
              {feePercent > 0 ? ` · frais ${feePercent} %` : ''}
            </Text>
            {value > 0 ? (
              <View style={styles.afterRow}>
                <Text style={styles.balanceHint}>Solde après cette demande</Text>
                <Text style={[styles.afterValue, value > available && { color: '#FECACA' }]}>{show(formatAr(available - value))}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.card, box]}>
            <MaskedField
              label="Montant à retirer"
              value={amount}
              onChangeText={setAmount}
              mask={maskAmount}
              validate={validateAmount}
              showErrors={submitted}
              keyboardType="numeric"
              placeholder="Ex. 50 000"
              suffix="Ar"
              successText="Montant valide"
              textColor={theme.text}
              surfaceColor={theme.surface}
              style={{ marginBottom: 4 }}
            />
            <TouchableOpacity onPress={() => setAmount(maskAmount(String(Math.floor(available))))}>
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
                <MaskedField
                  label="Numéro qui reçoit l’argent"
                  value={phone}
                  onChangeText={setPhone}
                  mask={maskMgPhone}
                  validate={rules.mgPhone}
                  showErrors={submitted}
                  keyboardType="phone-pad"
                  placeholder="034 12 345 67"
                  icon="call-outline"
                  successText="Numéro valide"
                  textColor={theme.text}
                  surfaceColor={theme.surface}
                  style={{ marginTop: 10 }}
                />
              </>
            ) : null}

            {method === 'bank_transfer' ? (
              <>
                <MaskedField
                  label="Banque"
                  value={bankName}
                  onChangeText={setBankName}
                  mask={maskLabel(40)}
                  validate={validateBankName}
                  showErrors={submitted}
                  placeholder="BNI, BOA, BFV..."
                  autoCapitalize="characters"
                  successText="Banque valide"
                  textColor={theme.text}
                  surfaceColor={theme.surface}
                  style={{ marginTop: 10 }}
                />
                <MaskedField
                  label="Numéro de compte"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  mask={maskBankAccount}
                  validate={rules.bankAccount}
                  showErrors={submitted}
                  keyboardType="numeric"
                  placeholder="0000 0000 0000"
                  successText="Numéro de compte valide"
                  textColor={theme.text}
                  surfaceColor={theme.surface}
                />
                <MaskedField
                  label="Titulaire du compte"
                  value={accountHolder}
                  onChangeText={setAccountHolder}
                  mask={maskFullname}
                  validate={rules.fullname}
                  showErrors={submitted}
                  autoCapitalize="words"
                  placeholder="Nom et prénom du titulaire"
                  successText="Nom valide"
                  textColor={theme.text}
                  surfaceColor={theme.surface}
                />
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

          {/* Résumé SOUS le formulaire : rouge s'il reste des erreurs, vert si tout est valide */}
          <FormSummary errors={fieldErrors} show={submitted} successText="Formulaire valide : la demande peut être envoyée." />
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
