// src/components/payment/paymentUtils.js
// Petits utilitaires partagés par tous les écrans de paiement.
// Règle de style : AUCUN texte en gras (fontWeight 400 / 500 maximum).
import { useCallback, useEffect, useRef, useState } from 'react';

import paymentService from '../../services/paymentService';

export const formatAr = (v) => `${Math.round(Number(v) || 0).toLocaleString('fr-FR')} Ar`;

// ---------------------------------------------------------------------------
// DATES — toujours en HEURE DE MADAGASCAR (UTC+3), quel que soit le fuseau du téléphone.
// Le backend envoie des dates UTC (« 2026-10-20T21:55:00Z »). Une date sans « Z » est
// considérée comme UTC (sinon JavaScript la lirait à tort en heure locale).
// ---------------------------------------------------------------------------
const MG_OFFSET_MS = 3 * 3600 * 1000;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const pad = (n) => String(n).padStart(2, '0');

export const parseUtc = (iso) => {
  if (!iso) return null;
  let str = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) str += 'T00:00:00';
  if (!/(z|[+-]\d{2}:?\d{2})$/i.test(str)) str += 'Z';
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Parties de la date en heure de Madagascar. */
export const mgParts = (iso) => {
  const d = parseUtc(iso);
  if (!d) return null;
  const m = new Date(d.getTime() + MG_OFFSET_MS);
  return {
    y: m.getUTCFullYear(),
    mo: m.getUTCMonth(),
    d: m.getUTCDate(),
    h: m.getUTCHours(),
    mi: m.getUTCMinutes(),
    ts: d.getTime(),
  };
};

/** « 21 oct. 2026 à 00:55 » */
export const formatDateTime = (iso) => {
  const p = mgParts(iso);
  return p ? `${pad(p.d)} ${MONTHS[p.mo]} ${p.y} à ${pad(p.h)}:${pad(p.mi)}` : '—';
};

/** « 21 oct., 00:55 » */
export const formatShort = (iso) => {
  const p = mgParts(iso);
  return p ? `${pad(p.d)} ${MONTHS[p.mo]}, ${pad(p.h)}:${pad(p.mi)}` : '';
};

/** Début de la journée (heure de Madagascar) en timestamp UTC, décalé de `daysAgo` jours. */
export const mgDayStart = (daysAgo = 0) => {
  const nowMg = new Date(Date.now() + MG_OFFSET_MS);
  const startMgUtc = Date.UTC(nowMg.getUTCFullYear(), nowMg.getUTCMonth(), nowMg.getUTCDate()) - daysAgo * 86400000;
  return startMgUtc - MG_OFFSET_MS;
};

/** La date iso est-elle dans la période ? period : all | today | 7d | 30d | year */
export const inPeriod = (iso, period) => {
  if (!period || period === 'all') return true;
  const d = parseUtc(iso);
  if (!d) return false;
  const t = d.getTime();
  if (period === 'today') return t >= mgDayStart(0);
  if (period === '7d') return t >= mgDayStart(6);
  if (period === '30d') return t >= mgDayStart(29);
  if (period === 'year') return t >= mgDayStart(364);
  return true;
};

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
