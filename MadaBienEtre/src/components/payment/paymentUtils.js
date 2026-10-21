// src/components/payment/paymentUtils.js
// Petits utilitaires partagés par tous les écrans de paiement.
// Règle de style : AUCUN texte en gras (fontWeight 400 / 500 maximum).
import { useCallback, useEffect, useRef, useState } from 'react';

import paymentService from '../../services/paymentService';
import { formatMadaLong, formatMadaShort } from '../../utils/madaTime';

export { inRange, madaDayKey } from '../../utils/madaTime';

export const formatAr = (v) => `${Math.round(Number(v) || 0).toLocaleString('fr-FR')} Ar`;

// Toutes les dates/heures de paiement sont affichées à l'HEURE DE MADAGASCAR (UTC+3).
export const formatDateTime = (iso) => formatMadaLong(iso);

export const formatShort = (iso) => formatMadaShort(iso);

export const PAY_STATE = {
  paid: { label: 'Payé', icon: 'checkmark-circle', color: '#1F7A4D', bg: '#E3F1E8' },
  pending: { label: 'En attente', icon: 'time', color: '#B7791F', bg: '#FBEFD5' },
  refunded: { label: 'Remboursé', icon: 'return-up-back', color: '#5B6B7A', bg: '#E8EDF1' },
};

/** payment (API) ou null -> 'paid' | 'pending' | 'refunded' */
export const stateOf = (payment) => payment?.ui_state || 'pending';

const PAYABLE = ['confirmed', 'in_progress', 'completed'];

/** La réservation est-elle arrivée au stade « prix confirmé / paiement possible » ? */
export const isPayableBooking = (booking) => {
  const st = String(booking?.status || '').toLowerCase();
  return PAYABLE.includes(st);
};

export const PAYMENT_STATUS_COLORS = PAY_STATE;

/** Charge le paiement d'UNE réservation + rafraîchit à la demande. */
export function useBookingPayment(bookingId, enabled = true) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!bookingId || !enabled) return null;
    setLoading(true);
    const res = await paymentService.getBookingPayment(bookingId);
    if (alive.current) {
      setPayment(res.success ? res.data || null : null);
      setLoading(false);
    }
    return res.success ? res.data : null;
  }, [bookingId, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { payment, loading, reload, setPayment };
}

/** Charge les paiements de PLUSIEURS réservations en une requête (listes). */
export function useBatchPayments(bookingIds, enabled = true) {
  const [map, setMap] = useState({});
  const key = (bookingIds || []).filter(Boolean).join(',');

  const reload = useCallback(async () => {
    if (!enabled || !key) return;
    const res = await paymentService.getBatch(key.split(',').map(Number));
    if (res.success) setMap(res.data || {});
  }, [key, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { payments: map, reload };
}
