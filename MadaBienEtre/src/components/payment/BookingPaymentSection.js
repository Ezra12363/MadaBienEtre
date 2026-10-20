// src/components/payment/BookingPaymentSection.js
//
// Bloc « Statut du paiement » à placer SOUS LE PRIX d'une réservation.
//   - repliable (toggle) : badge de statut + chevron ;
//   - client, en attente  -> bouton « Payer maintenant » ;
//   - client, payé        -> bouton « Voir le reçu » (reçu + téléchargement PDF) ;
//   - thérapeute          -> voit seulement Payé / En attente (+ montant net, mode,
//                           date et heure) et peut ouvrir le reçu ; espèces : bouton
//                           « Confirmer la réception ».
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import paymentService from '../../services/paymentService';
import PaymentStatusBadge from './PaymentStatusBadge';
import ReceiptModal from './ReceiptModal';
import { formatAr, formatDateTime, isPayableBooking, stateOf, useBookingPayment } from './paymentUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GREEN = '#1F6B45';

const bookingAmount = (b) => {
  for (const v of [b?.final_price, b?.finalPrice, b?.agreed_price, b?.therapist_initial_price, b?.client_price_proposed, b?.price]) {
    if (v !== null && v !== undefined && Number(v) > 0) return Number(v);
  }
  return 0;
};

function Line({ label, value, tc }) {
  if (!value) return null;
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, { color: tc.textSecondary }]}>{label}</Text>
      <Text style={[styles.lineValue, { color: tc.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * @param {{
 *  booking: object, role: 'client'|'therapist', navigation?: object,
 *  payment?: object|null,          // si déjà chargé par useBatchPayments
 *  onChanged?: () => void,         // appelé après un changement (ex. espèces confirmées)
 *  defaultOpen?: boolean, style?: object
 * }} props
 */
export default function BookingPaymentSection({ booking, role = 'client', navigation, payment: preloaded, onChanged, defaultOpen = false, style }) {
  const theme = useTheme?.() || {};
  const tc = { text: '#222', textSecondary: '#777', border: '#E5E5E5', card: '#FFFFFF', ...(theme.colors || {}) };

  const isTherapist = role === 'therapist';
  const payable = isPayableBooking(booking);
  const hasPreloaded = preloaded !== undefined;
  const { payment: fetched, reload } = useBookingPayment(booking?.id, payable && !hasPreloaded);
  const payment = hasPreloaded ? preloaded : fetched;

  const [open, setOpen] = useState(defaultOpen);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Rafraîchir quand on revient de l'écran de paiement.
  useEffect(() => {
    if (!navigation?.addListener) return undefined;
    const unsub = navigation.addListener('focus', () => {
      if (!hasPreloaded) reload();
      onChanged?.();
    });
    return unsub;
  }, [navigation, reload, hasPreloaded, onChanged]);

  const state = stateOf(payment);
  const amount = payment?.amount || bookingAmount(booking);
  const view = isTherapist ? 'therapist' : 'client';

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  const confirmCash = () => {
    const run = async () => {
      setBusy(true);
      const res = await paymentService.confirmCash(payment.id);
      setBusy(false);
      if (!res.success) {
        Alert.alert('Paiement', res.error || 'Impossible de confirmer.');
        return;
      }
      if (!hasPreloaded) await reload();
      onChanged?.();
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm("Confirmer que vous avez bien reçu les espèces ?")) run();
      return;
    }
    Alert.alert('Espèces reçues ?', 'Confirmez uniquement si le client vous a bien remis la somme.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Oui, reçu', onPress: run },
    ]);
  };

  const pending = state === 'pending';
  const cashWaiting = payment?.method === 'cash' && ['pending', 'processing'].includes(payment?.status);

  const summary = useMemo(() => {
    if (state === 'paid') return isTherapist ? 'Le client a payé' : 'Paiement effectué';
    if (state === 'refunded') return 'Paiement remboursé';
    if (payment?.status === 'processing') return 'Paiement en cours de vérification';
    return isTherapist ? 'Le client n’a pas encore payé' : 'Paiement à effectuer';
  }, [state, payment, isTherapist]);

  if (!booking || !payable) return null;

  return (
    <View style={[styles.wrap, { borderColor: tc.border, backgroundColor: tc.card }, style]}>
      <TouchableOpacity style={styles.head} onPress={toggle} activeOpacity={0.8}>
        <View style={styles.headLeft}>
          <Ionicons name="wallet-outline" size={18} color={GREEN} />
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.title, { color: tc.text }]}>Statut du paiement</Text>
            <Text style={[styles.sub, { color: tc.textSecondary }]} numberOfLines={1}>
              {summary}
            </Text>
          </View>
        </View>
        <View style={styles.headRight}>
          <PaymentStatusBadge state={state} />
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={tc.textSecondary} />
        </View>
      </TouchableOpacity>

      {open ? (
        <View style={[styles.body, { borderTopColor: tc.border }]}>
          <Line tc={tc} label={pending ? 'Montant à payer' : isTherapist ? 'Montant payé par le client' : 'Montant payé'} value={formatAr(amount)} />
          {!pending ? <Line tc={tc} label="Mode de paiement" value={payment?.method_label} /> : null}
          {state === 'paid' ? <Line tc={tc} label="Date et heure du paiement" value={formatDateTime(payment?.paid_at || payment?.completed_at)} /> : null}
          {isTherapist && state === 'paid' && payment?.net_amount ? (
            <>
              <Line tc={tc} label={`Commission (${payment.commission_rate ?? '—'} %)`} value={formatAr(payment.commission_amount)} />
              <Line tc={tc} label="Votre part nette" value={formatAr(payment.net_amount)} />
            </>
          ) : null}

          {/* ----- Actions ----- */}
          {state === 'paid' ? (
            <TouchableOpacity style={styles.primary} onPress={() => setReceiptOpen(true)} activeOpacity={0.85}>
              <Ionicons name="receipt-outline" size={18} color="#fff" />
              <Text style={styles.primaryText}>{isTherapist ? 'Voir le reçu du client' : 'Voir le reçu'}</Text>
            </TouchableOpacity>
          ) : null}

          {pending && !isTherapist ? (
            <TouchableOpacity
              style={styles.primary}
              onPress={() => navigation?.navigate?.('Payment', { bookingId: booking.id })}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={styles.primaryText}>{cashWaiting ? 'Modifier le mode de paiement' : 'Payer maintenant'}</Text>
            </TouchableOpacity>
          ) : null}

          {pending && !isTherapist && cashWaiting ? (
            <Text style={[styles.hint, { color: tc.textSecondary }]}>
              Espèces choisies : le thérapeute confirmera la réception à la fin du massage.
            </Text>
          ) : null}

          {pending && isTherapist && cashWaiting ? (
            <TouchableOpacity style={styles.primary} onPress={confirmCash} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="cash-outline" size={18} color="#fff" />}
              <Text style={styles.primaryText}>Confirmer la réception des espèces</Text>
            </TouchableOpacity>
          ) : null}

          {pending && isTherapist && !cashWaiting ? (
            <Text style={[styles.hint, { color: tc.textSecondary }]}>
              Le reçu sera disponible dès que le client aura payé.
            </Text>
          ) : null}
        </View>
      ) : null}

      <ReceiptModal visible={receiptOpen} paymentId={payment?.id} view={view} onClose={() => setReceiptOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 14, marginTop: 10, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 8 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '400' },
  sub: { fontSize: 12, marginTop: 1, fontWeight: '400' },
  body: { borderTopWidth: 1, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, gap: 12 },
  lineLabel: { fontSize: 13, fontWeight: '400', flexShrink: 0 },
  lineValue: { fontSize: 14, fontWeight: '400', flex: 1, textAlign: 'right' },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '400' },
  hint: { fontSize: 12, marginTop: 10, lineHeight: 17, fontWeight: '400' },
});
