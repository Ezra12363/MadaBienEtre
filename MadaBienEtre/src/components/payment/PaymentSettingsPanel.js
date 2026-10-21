// src/components/payment/PaymentSettingsPanel.js
//
// Admin : paramètres de paiement (profil admin → Paramètres).
//   - commission de la plateforme (+ « appliquer à tous les thérapeutes ») ;
//   - retrait minimum et frais de retrait ;
//   - activer / désactiver chaque mode de paiement et de retrait ;
//   - informations imprimées sur les reçus ;
//   - état des passerelles Stripe / Vanila Pay (les CLÉS se mettent dans le .env du backend).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import paymentService from '../../services/paymentService';

const GREEN = '#1F6B45';

const SWITCHES = [
  ['Paiement clients', null],
  ['Mobile Money', 'mobile_money_enabled'],
  ['   MVola', 'mvola_enabled'],
  ['   Orange Money', 'orange_money_enabled'],
  ['   Airtel Money', 'airtel_money_enabled'],
  ['Carte bancaire (Stripe / Vanila Pay)', 'card_enabled'],
  ['Espèces', 'cash_enabled'],
  ['Retraits thérapeutes', null],
  ['Retrait Mobile Money', 'withdraw_mobile_money_enabled'],
  ['Retrait virement bancaire', 'withdraw_bank_enabled'],
  ['Retrait espèces', 'withdraw_cash_enabled'],
];

export default function PaymentSettingsPanel() {
  const { colors: theme } = useTheme();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {ok, text}

  const load = useCallback(async () => {
    setLoading(true);
    const res = await paymentService.adminGetSettings();
    if (res.success) {
      setData(res.data);
      setForm(res.data.settings || {});
    } else {
      setMsg({ ok: false, text: res.error });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const num = (k, v) => setForm((f) => ({ ...f, [k]: v.replace(',', '.') }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const payload = {
      ...form,
      platform_commission_rate: Number(form.platform_commission_rate),
      min_withdrawal: Number(form.min_withdrawal),
      withdrawal_fee_percent: Number(form.withdrawal_fee_percent),
    };
    const res = await paymentService.adminSaveSettings(payload);
    setSaving(false);
    if (!res.success) return setMsg({ ok: false, text: res.error });
    setForm(res.data.settings);
    setMsg({ ok: true, text: 'Paramètres de paiement enregistrés.' });
  };

  const applyAll = async () => {
    await save();
    const res = await paymentService.adminApplyCommission();
    setMsg(res.success ? { ok: true, text: `Commission de ${res.data.rate} % appliquée à ${res.data.updated} thérapeute(s).` } : { ok: false, text: res.error });
  };

  const box = { backgroundColor: theme.surface, borderColor: theme.border || '#E5E7EB' };
  const txt = { color: theme.text };
  const sub = { color: theme.textSecondary };

  if (loading) {
    return (
      <View style={[styles.card, box, { alignItems: 'center' }]}>
        <ActivityIndicator color={GREEN} />
      </View>
    );
  }

  const g = data?.gateways || {};
  const field = ({ label, k, suffix, keyboard = 'numeric', placeholder }) => (
    <View key={k} style={{ marginTop: 12 }}>
      <Text style={[styles.label, sub]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, txt]}
          keyboardType={keyboard}
          value={String(form[k] ?? '')}
          onChangeText={(v) => (keyboard === 'numeric' ? num(k, v) : setForm((f) => ({ ...f, [k]: v })))}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
        />
        {suffix ? <Text style={sub}>{suffix}</Text> : null}
      </View>
    </View>
  );

  const Gate = ({ name, ok, reason }) => (
    <View style={styles.gate}>
      <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={18} color={ok ? '#047857' : '#B91C1C'} />
      <Text style={[styles.gateText, txt]}>
        {name} : {ok ? 'clé configurée' : (reason || 'clé absente (.env du backend)')}
      </Text>
    </View>
  );

  return (
    <View style={[styles.card, box]}>
      <View style={styles.head}>
        <Ionicons name="wallet-outline" size={22} color={GREEN} />
        <Text style={[styles.title, txt]}>Paiements & commissions</Text>
      </View>
      <Text style={[styles.desc, sub]}>Ces réglages s’appliquent immédiatement à toute la plateforme.</Text>

      {field({ label: 'Commission de la plateforme', k: 'platform_commission_rate', suffix: '%' })}
      {field({ label: 'Retrait minimum', k: 'min_withdrawal', suffix: 'Ar' })}
      {field({ label: 'Frais de retrait', k: 'withdrawal_fee_percent', suffix: '%' })}

      {SWITCHES.map(([label, key]) =>
        key === null ? (
          <Text key={label} style={[styles.group, { color: GREEN }]}>
            {label.toUpperCase()}
          </Text>
        ) : (
          <View key={key} style={styles.switchRow}>
            <Text style={[styles.switchLabel, txt]}>{label}</Text>
            <Switch value={!!form[key]} onValueChange={(v) => setForm((f) => ({ ...f, [key]: v }))} trackColor={{ true: GREEN }} />
          </View>
        )
      )}

      <Text style={[styles.group, { color: GREEN }]}>INFORMATIONS DES REÇUS</Text>
      {field({ label: 'Nom de l’entreprise', k: 'company_name', keyboard: 'default' })}
      {field({ label: 'Téléphone', k: 'company_phone', keyboard: 'phone-pad', placeholder: '+261 34 00 000 00' })}
      {field({ label: 'E-mail', k: 'company_email', keyboard: 'email-address' })}
      {field({ label: 'Adresse', k: 'company_address', keyboard: 'default' })}
      {field({ label: 'Message en bas du reçu', k: 'receipt_footer', keyboard: 'default' })}

      <Text style={[styles.group, { color: GREEN }]}>PASSERELLES</Text>
      <Gate name="Stripe" ok={g.stripe_configured} reason={g.stripe_reason} />
      <Gate name="Vanila Pay" ok={g.vanila_configured} />
      {g.sandbox ? <Text style={styles.warn}>Mode TEST actif (PAYMENT_SANDBOX=True) : à désactiver en production.</Text> : null}
      <Text style={[styles.help, sub]}>{data?.keys_help}</Text>
      <Text style={[styles.help, sub]}>Webhook Stripe : {g.stripe_webhook_url}</Text>
      <Text style={[styles.help, sub]}>Webhook Vanila Pay : {g.vanila_webhook_url}</Text>

      {msg ? <Text style={[styles.msg, { color: msg.ok ? '#047857' : '#B91C1C' }]}>{msg.text}</Text> : null}

      <TouchableOpacity style={styles.save} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer les paramètres de paiement</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.apply} onPress={applyAll} disabled={saving}>
        <Text style={[styles.applyText, { color: GREEN }]}>Enregistrer et appliquer la commission à TOUS les thérapeutes</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '400' },
  desc: { fontSize: 12, marginTop: 4, fontWeight: '400' },
  label: { fontSize: 12, marginBottom: 6, fontWeight: '400' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, fontWeight: '400' },
  group: { fontSize: 11, letterSpacing: 1, marginTop: 20, fontWeight: '400' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  switchLabel: { fontSize: 14, fontWeight: '400', flex: 1 },
  gate: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  gateText: { fontSize: 13, fontWeight: '400' },
  warn: { color: '#B45309', fontSize: 12, marginTop: 8, fontWeight: '400' },
  help: { fontSize: 11, marginTop: 8, lineHeight: 16, fontWeight: '400' },
  msg: { fontSize: 13, marginTop: 14, fontWeight: '400' },
  save: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '400' },
  apply: { alignItems: 'center', paddingVertical: 12 },
  applyText: { fontSize: 13, fontWeight: '400', textAlign: 'center' },
});
