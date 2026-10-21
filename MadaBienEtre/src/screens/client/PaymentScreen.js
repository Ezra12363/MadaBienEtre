// src/screens/client/PaymentScreen.js
//
// Paiement d'une réservation CONFIRMÉE.
//
//  1. Affiche le prix à payer (calculé par le serveur) ;
//  2. le client choisit : MVola / Orange Money / Airtel Money, carte bancaire,
//     ou espèces (payées à la fin du massage) ;
//  3. le BACKEND interroge le fournisseur ; l'écran « sonde » /payments/{id}/verify
//     jusqu'à la confirmation officielle — jamais sur simple déclaration ;
//  4. paiement confirmé -> reçu PDF (QR code + code-barres).
//
// Aucune donnée de carte ne transite par l'application : la carte se règle
// sur la page sécurisée du fournisseur (Stripe / Vanila Pay).
//
// MODE « MOYENS DE PAIEMENT » (depuis Profil > Moyens de paiement) :
// quand l'écran est ouvert SANS bookingId, il affiche simplement la liste
// des moyens de paiement acceptés (disponibles / bientôt disponibles),
// sans prix ni bouton « Payer ».
import { useCallback, useEffect, useRef, useState } from 'react';
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

import { Ionicons } from '@expo/vector-icons';

import Header from '../../components/common/Header';
import { useTheme } from '../../context/ThemeContext';
import paymentService from '../../services/paymentService';
import { colors } from '../../theme';

const PRIMARY = colors.primary || '#0B7A2A';
const POLL_MS = 4000;
const POLL_MAX_MS = 3 * 60 * 1000; // 3 min pour valider sur le téléphone

const formatAr = (value) => `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} Ar`;
const onlyDigits = (t) => String(t || '').replace(/[^0-9]/g, '');

// Choix proposés au client (id -> method + provider envoyés au backend)
const OPTIONS = [
  { id: 'mvola', label: 'MVola', method: 'mobile_money', provider: 'mvola', icon: '📱', hint: '034 / 038' },
  { id: 'orange_money', label: 'Orange Money', method: 'mobile_money', provider: 'orange_money', icon: '🟠', hint: '032 / 037' },
  { id: 'airtel_money', label: 'Airtel Money', method: 'mobile_money', provider: 'airtel_money', icon: '🔴', hint: '033' },
  { id: 'card', label: 'Carte bancaire', method: 'card', icon: '💳', hint: 'Formulaire sécurisé Stripe (numéro formaté automatiquement)' },
  { id: 'cash', label: 'Espèces', method: 'cash', icon: '💵', hint: 'À la fin du massage' },
];

const PaymentScreen = ({ navigation, route }) => {
  const { bookingId } = route.params || {};
  const { colors: theme } = useTheme();

  // Pas de réservation => simple consultation des moyens de paiement
  const methodsMode = !bookingId;

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(null);
  const [methods, setMethods] = useState(null);
  const [selected, setSelected] = useState(null);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // attente de confirmation
  const [payment, setPayment] = useState(null);
  const [instructions, setInstructions] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const mountedRef = useRef(true);
  const pollRef = useRef(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Mode consultation (Profil > Moyens de paiement) : pas de devis
    if (!bookingId) {
      const only = await paymentService.getMethods();
      if (!mountedRef.current) return;
      if (only.success) {
        setMethods(only.data);
      } else {
        setError(only.error || 'Impossible de charger les moyens de paiement.');
      }
      setLoading(false);
      return;
    }

    const [q, m] = await Promise.all([
      paymentService.getQuote(bookingId),
      paymentService.getMethods(),
    ]);
    if (!mountedRef.current) return;
    if (q.success) {
      setQuote(q.data);
      // Déjà payé : on affiche directement le reçu
      if (q.data?.payment?.status === 'completed') setPayment(q.data.payment);
    } else {
      setError(q.error);
    }
    if (m.success) setMethods(m.data);
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const isEnabled = useCallback(
    (opt) => {
      if (!methods) return false;
      if (opt.method === 'mobile_money') {
        const prov = (methods.mobile_money?.providers || []).find((p) => p.id === opt.provider);
        return !!methods.mobile_money?.enabled && (prov ? prov.enabled !== false : true);
      }
      if (opt.method === 'card') return !!methods.card?.enabled;
      return !!methods.cash?.enabled;
    },
    [methods]
  );

  const option = OPTIONS.find((o) => o.id === selected) || null;
  const amount = quote?.amount || 0;
  const isMobile = option?.method === 'mobile_money';
  const phoneOk = !isMobile || phone.length === 10;
  const canSubmit = !!option && isEnabled(option) && phoneOk && !submitting && !!quote?.can_pay;

  // ---------------------------------------------------------------- sondage
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const checkOnce = useCallback(
    async (paymentId, { cash = false } = {}) => {
      const res = await paymentService.verify(paymentId);
      if (!mountedRef.current) return;
      if (!res.success) return; // erreur réseau passagère : on réessaie
      const p = res.data;
      setPayment(p);
      if (p.status === 'completed') {
        stopPolling();
      } else if (['failed', 'cancelled'].includes(p.status)) {
        stopPolling();
        setError(
          p.status === 'failed'
            ? "Le paiement a échoué ou a été refusé. Vous n'avez pas été débité. Réessayez."
            : 'Le paiement a été annulé.'
        );
        setPayment(null);
      } else if (!cash && Date.now() - startedAtRef.current > POLL_MAX_MS) {
        stopPolling();
        setTimedOut(true);
      }
    },
    []
  );

  const startPolling = useCallback(
    (paymentId, cash) => {
      stopPolling();
      startedAtRef.current = Date.now();
      setTimedOut(false);
      pollRef.current = setInterval(() => checkOnce(paymentId, { cash }), cash ? 8000 : POLL_MS);
    },
    [checkOnce]
  );

  // ------------------------------------------------------------------ payer
  const handlePay = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const res = await paymentService.initiate({
      bookingId,
      method: option.method,
      provider: option.provider,
      phone: isMobile ? phone : undefined,
    });

    if (!mountedRef.current) return;
    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Le paiement a échoué.');
      return;
    }

    const p = res.data;
    setPayment(p);
    setInstructions(p.instructions || null);
    setPaymentUrl(p.payment_url || null);

    if (p.status === 'completed') return;

    if (p.payment_url) {
      await paymentService.openPaymentUrl(p.payment_url);
    }
    startPolling(p.id, p.method === 'cash');
  };

  const handleCancel = async () => {
    stopPolling();
    if (payment?.id) await paymentService.cancel(payment.id);
    setPayment(null);
    setInstructions(null);
    setPaymentUrl(null);
    setTimedOut(false);
  };

  // Le reçu s'ouvre sur une PAGE (header + barre de navigation), pas en modale.
  const handleReceipt = () => {
    if (!payment?.id) return;
    navigation.navigate('Receipt', { kind: 'payment', id: payment.id, view: 'client' });
  };

  const goBooking = () => navigation.navigate('BookingDetail', { bookingId });

  // ---------------------------------------------------------------- rendu
  const card = { backgroundColor: theme.surface, borderColor: theme.border || '#E5E7EB' };

  // ------------------------------------------- mode « Moyens de paiement »
  const renderMethodsList = () => (
    <>
      <View style={[styles.amountCard, card]}>
        <View style={[styles.bigIcon, { backgroundColor: `${PRIMARY}1A` }]}>
          <Ionicons name="card-outline" size={44} color={PRIMARY} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Moyens de paiement</Text>
        <Text style={[styles.muted, { color: theme.textSecondary, textAlign: 'center' }]}>
          Voici les moyens de paiement acceptés. Vous choisirez le vôtre au moment de payer une
          réservation confirmée.
        </Text>
      </View>

      <Text style={[styles.section, { color: theme.text }]}>Modes acceptés</Text>

      {OPTIONS.map((opt) => {
        const enabled = isEnabled(opt);
        return (
          <View key={opt.id} style={[styles.option, card, !enabled && { opacity: 0.55 }]}>
            <Text style={styles.optionIcon}>{opt.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: theme.text }]}>{opt.label}</Text>
              <Text style={[styles.muted, { color: theme.textSecondary }]}>{opt.hint}</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: enabled ? `${PRIMARY}1A` : '#E5E7EB' },
              ]}
            >
              <Text
                style={[styles.statusPillText, { color: enabled ? PRIMARY : '#6B7280' }]}
              >
                {enabled ? 'Disponible' : 'Bientôt'}
              </Text>
            </View>
          </View>
        );
      })}

      {methods?.sandbox ? (
        <Text style={[styles.muted, { color: '#B45309', marginTop: 10 }]}>
          ⚠️ Mode TEST actif : aucun vrai argent n'est débité.
        </Text>
      ) : null}

      <View style={[styles.notice, { backgroundColor: `${PRIMARY}14`, marginTop: 14 }]}>
        <Ionicons name="shield-checkmark" size={18} color={PRIMARY} />
        <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
          Aucune donnée de carte n'est enregistrée dans l'application : la carte se règle sur la
          page sécurisée du fournisseur.
        </Text>
      </View>
    </>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            {methodsMode ? 'Chargement des moyens de paiement…' : 'Chargement du paiement…'}
          </Text>
        </View>
      );
    }

    if (methodsMode) {
      if (!methods) {
        return (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={42} color="#D93636" />
            <Text style={[styles.title, { color: theme.text }]}>Moyens de paiement indisponibles</Text>
            {error ? (
              <Text style={[styles.muted, { color: theme.textSecondary, textAlign: 'center' }]}>
                {error}
              </Text>
            ) : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={load}>
              <Text style={styles.primaryBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return renderMethodsList();
    }

    if (!quote) {
      return (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={42} color="#D93636" />
          <Text style={[styles.title, { color: theme.text }]}>Paiement indisponible</Text>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={load}>
            <Text style={styles.primaryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ----- Paiement confirmé : reçu -----
    if (payment?.status === 'completed') {
      return (
        <View style={styles.center}>
          <View style={[styles.bigIcon, { backgroundColor: `${PRIMARY}1A` }]}>
            <Ionicons name="checkmark-circle" size={56} color={PRIMARY} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Paiement confirmé</Text>
          <Text style={styles.bigAmount}>{formatAr(payment.amount)}</Text>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            Transaction {payment.transaction_id}
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleReceipt} activeOpacity={0.85}>
            <Ionicons name="document-text-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Voir mon reçu</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={goBooking}>
            <Text style={[styles.linkText, { color: PRIMARY }]}>Retour à la réservation</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      );
    }

    // ----- En attente de confirmation -----
    if (payment && ['pending', 'processing'].includes(payment.status)) {
      const isCash = payment.method === 'cash';
      return (
        <View style={styles.center}>
          <View style={[styles.bigIcon, { backgroundColor: '#F5B6421A' }]}>
            {timedOut ? (
              <Ionicons name="time-outline" size={50} color="#F5B642" />
            ) : (
              <ActivityIndicator size="large" color="#F5B642" />
            )}
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            {isCash ? 'Paiement en espèces' : 'En attente de confirmation'}
          </Text>
          <Text style={styles.bigAmount}>{formatAr(payment.amount)}</Text>
          <Text style={[styles.muted, { color: theme.textSecondary, textAlign: 'center' }]}>
            {instructions ||
              (isCash
                ? 'Payez le thérapeute à la fin du massage. Il confirmera la réception.'
                : 'Validez le paiement sur votre téléphone.')}
          </Text>
          {payment.payment_method && !isCash ? (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {String(payment.payment_method).replace('_', ' ')}
            </Text>
          ) : null}

          {paymentUrl ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => paymentService.openPaymentUrl(paymentUrl)}
            >
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Ouvrir la page de paiement</Text>
            </TouchableOpacity>
          ) : null}

          {!isCash && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#2563EB' }]}
              onPress={() => {
                setTimedOut(false);
                startPolling(payment.id, false);
                checkOnce(payment.id);
              }}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Vérifier maintenant</Text>
            </TouchableOpacity>
          )}

          {isCash && !payment.client_sent_at ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#1F6B45' }]}
              disabled={notifying}
              onPress={async () => {
                setNotifying(true);
                const res = await paymentService.clientSent(payment.id);
                setNotifying(false);
                if (res.success) setPayment(res.data);
                else setError(res.error || 'Impossible de prévenir le thérapeute.');
              }}
            >
              {notifying ? <ActivityIndicator color="#fff" /> : <Ionicons name="paper-plane-outline" size={18} color="#fff" />}
              <Text style={styles.primaryBtnText}>J’ai remis les espèces — prévenir le thérapeute</Text>
            </TouchableOpacity>
          ) : null}
          {isCash && payment.client_sent_at ? (
            <Text style={[styles.muted, { color: '#1F6B45', textAlign: 'center' }]}>
              ✓ Votre thérapeute a été prévenu. Le paiement sera validé dès qu’il confirmera la réception.
            </Text>
          ) : null}

          {isCash ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={goBooking}>
              <Text style={styles.primaryBtnText}>Retour à la réservation</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.linkBtn} onPress={handleCancel}>
            <Text style={[styles.linkText, { color: '#D93636' }]}>Annuler ce paiement</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ----- Formulaire -----
    return (
      <>
        <View style={[styles.amountCard, card]}>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>Prix à payer</Text>
          <Text style={styles.bigAmount}>{formatAr(amount)}</Text>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            Réservation #{bookingId}
          </Text>
        </View>

        {!quote.can_pay ? (
          <View style={[styles.notice, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="information-circle" size={18} color="#B45309" />
            <Text style={styles.noticeText}>
              {quote.reason || "Le paiement n'est pas encore disponible."}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.section, { color: theme.text }]}>Mode de paiement</Text>

        {OPTIONS.map((opt) => {
          const enabled = isEnabled(opt);
          const active = selected === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.85}
              disabled={!enabled || !quote.can_pay}
              onPress={() => {
                setSelected(opt.id);
                setError(null);
              }}
              style={[
                styles.option,
                card,
                active && { borderColor: PRIMARY, backgroundColor: `${PRIMARY}0F` },
                (!enabled || !quote.can_pay) && { opacity: 0.45 },
              ]}
            >
              <Text style={styles.optionIcon}>{opt.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: theme.text }]}>{opt.label}</Text>
                <Text style={[styles.muted, { color: theme.textSecondary }]}>
                  {enabled ? opt.hint : 'Bientôt disponible'}
                </Text>
              </View>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={active ? PRIMARY : '#9CA3AF'}
              />
            </TouchableOpacity>
          );
        })}

        {isMobile ? (
          <View style={{ marginTop: 6 }}>
            <Text style={[styles.section, { color: theme.text }]}>Numéro {option.label}</Text>
            <TextInput
              value={phone}
              onChangeText={(t) => setPhone(onlyDigits(t).slice(0, 10))}
              placeholder="034 12 345 67"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              style={[styles.input, card, { color: theme.text }]}
            />
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              Vous recevrez une demande de confirmation sur ce numéro.
            </Text>
          </View>
        ) : null}

        {methods?.sandbox ? (
          <Text style={[styles.muted, { color: '#B45309', marginTop: 10 }]}>
            ⚠️ Mode TEST actif : aucun vrai argent n'est débité.
          </Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePay}
          disabled={!canSubmit}
          style={[styles.primaryBtn, { marginTop: 18 }, !canSubmit && { opacity: 0.45 }]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={17} color="#fff" />
              <Text style={styles.primaryBtnText}>
                {option?.method === 'cash' ? 'Confirmer — payer en espèces' : `Payer ${formatAr(amount)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title={methodsMode ? 'Moyens de paiement' : 'Paiement'} showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderBody()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  bigIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  bigAmount: { fontSize: 30, fontWeight: '900', color: PRIMARY, marginVertical: 2 },
  muted: { fontSize: 12.5 },
  section: { fontSize: 15, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  amountCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    gap: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  optionIcon: { fontSize: 24 },
  optionLabel: { fontSize: 15, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 6,
  },
  notice: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  noticeText: { flex: 1, fontSize: 12.5, color: '#92400E' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 22,
    backgroundColor: PRIMARY,
    alignSelf: 'stretch',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  linkBtn: { paddingVertical: 12 },
  linkText: { fontWeight: '700', fontSize: 14 },
  errorText: { color: '#D93636', fontSize: 13, marginTop: 12, textAlign: 'center' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontSize: 11.5, fontWeight: '800' },
});

export default PaymentScreen;