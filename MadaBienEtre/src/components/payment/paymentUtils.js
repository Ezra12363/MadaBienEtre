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
  paid: { label: 'Payé', icon: 'checkmark-circle', color: '#2E8B57', bg: '#E3F1E8' },
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

/** Même règle que isPayableBooking, mais à partir d'un statut déjà normalisé. */
export const isPayableStatus = (status) => PAYABLE.includes(String(status || '').toLowerCase());

// ---------------------------------------------------------------------------
// Filtres « paiement » partagés par les listes de réservations
// (client : Historique — thérapeute : Offres + page d'un client).
// Valeurs utilisées comme clé de pastille de filtre, à côté des statuts.
// ---------------------------------------------------------------------------
export const PAYMENT_FILTER_PENDING = 'payment_pending';
export const PAYMENT_FILTER_PAID = 'payment_paid';

export const PAYMENT_FILTER_LABELS = {
  [PAYMENT_FILTER_PENDING]: 'En attente de paiement',
  [PAYMENT_FILTER_PAID]: 'Payé',
};

export const isPaymentFilter = (value) => value === PAYMENT_FILTER_PENDING || value === PAYMENT_FILTER_PAID;

/**
 * Catégorie de paiement d'une réservation pour les filtres.
 *  - réservation pas encore payable (en attente, négociation, annulée, expirée…) -> null
 *  - paiement confirmé                                                            -> 'payment_paid'
 *  - paiement remboursé                                                           -> null
 *  - sinon (aucun paiement, en cours de vérification, espèces à confirmer…)       -> 'payment_pending'
 *
 * @param {string} status   statut NORMALISÉ de la réservation
 * @param {object|null} payment  paiement renvoyé par /payments/batch (ou undefined)
 */
export const paymentFilterOf = (status, payment) => {
  if (!isPayableStatus(status)) return null;
  const state = stateOf(payment);
  if (state === 'paid') return PAYMENT_FILTER_PAID;
  if (state === 'refunded') return null;
  return PAYMENT_FILTER_PENDING;
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

/**
 * Charge les paiements de PLUSIEURS réservations (listes + filtres de paiement).
 * `refreshKey` : toute valeur qui change (ex. la liste des réservations après un
 * rafraîchissement) relance le chargement, pour que le filtre « Payé / En attente
 * de paiement » reste à jour quand un client vient de payer.
 * Le backend accepte au maximum 200 ids par requête : on découpe en paquets.
 */
const BATCH_SIZE = 200;

export function useBatchPayments(bookingIds, enabled = true, refreshKey = null) {
  const [map, setMap] = useState({});
  const key = (bookingIds || []).filter(Boolean).join(',');

  const reload = useCallback(async () => {
    if (!enabled || !key) return;
    const ids = key
      .split(',')
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    const chunks = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) chunks.push(ids.slice(i, i + BATCH_SIZE));

    const results = await Promise.all(chunks.map((chunk) => paymentService.getBatch(chunk)));
    const merged = {};
    let ok = false;
    results.forEach((res) => {
      if (res?.success) {
        ok = true;
        Object.assign(merged, res.data || {});
      }
    });
    if (ok) setMap(merged);
  }, [key, enabled]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, refreshKey]);

  return { payments: map, reload };
}
