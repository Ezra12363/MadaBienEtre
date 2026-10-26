// src/components/payment/SavedCardsManager.js
//
// Cartes bancaires enregistrées (Stripe) — réutilisé par :
//   - Client      : Profil > Moyens de paiement (mode « manage »)  +  écran Paiement (mode « select »)
//   - Thérapeute  : Profil > Mode de paiement (mode « manage »)    +  règlement de commission (mode « select »)
//   - Admin       : Paramètres > Paiements (mode « manage »)
//
// ⚠️ Le numéro de carte est saisi UNIQUEMENT dans le formulaire sécurisé de Stripe (nouvelle page).
// Ici on n'affiche que la marque, les 4 derniers chiffres et l'expiration.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import cardService from '../../services/cardService';
import StripeCardForm, { inlineCardFormSupported } from './StripeCardForm';

const GREEN = '#1F6B45';
const POLL_MS = 4000;
const POLL_MAX_MS = 3 * 60 * 1000;

const BRAND_COLORS = {
  visa: '#1A1F71',
  mastercard: '#EB001B',
  amex: '#2E77BC',
  discover: '#F76F20',
  jcb: '#0B7F3E',
  unionpay: '#0F6EB4',
  diners: '#0079BE',
};

const confirmAsync = (title, message, okLabel) =>
  new Promise((resolve) => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : true);
      return;
    }
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });

/**
 * @param {{
 *  mode?: 'manage'|'select',
 *  selectedId?: number|'other'|null,
 *  onSelect?: (id:number|'other'|null) => void,
 *  allowOther?: boolean,            // select : proposer « Autre carte (formulaire sécurisé) »
 *  onLoaded?: (cards:Array, info:{available:boolean, sandbox:boolean}) => void,
 *  hideTitle?: boolean,
 * }} props
 */
export default function SavedCardsManager({
  mode = 'manage',
  selectedId = null,
  onSelect,
  allowOther = false,
  onLoaded,
  hideTitle = false,
}) {
  const { colors: theme } = useTheme();
  const { user } = useAuth();
  const isSelect = mode === 'select';

  const [cards, setCards] = useState([]);
  const [available, setAvailable] = useState(true);
  const [sandbox, setSandbox] = useState(false);
  const [publishableKey, setPublishableKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const pollRef = useRef(null);
  const baselineRef = useRef(0);
  const startedRef = useRef(0);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      const res = await cardService.list();
      if (!mountedRef.current) return null;
      if (!silent) setLoading(false);
      if (!res.success) {
        if (!silent) setError(res.error || 'Impossible de charger vos cartes.');
        return null;
      }
      setError(res.data?.sync_error ? `Stripe : ${res.data.sync_error}` : null);
      const list = res.data?.cards || [];
      setCards(list);
      setAvailable(res.data?.available !== false);
      setSandbox(!!res.data?.sandbox);
      setPublishableKey(res.data?.publishable_key || null);
      onLoaded?.(list, { available: res.data?.available !== false, sandbox: !!res.data?.sandbox });

      // Mode sélection : on choisit automatiquement la carte par défaut.
      if (isSelect && onSelect) {
        const cur = selectedRef.current;
        const stillThere = list.some((c) => c.id === cur);
        if (cur !== 'other' && !stillThere) {
          const def = list.find((c) => c.is_default) || list[0];
          onSelect(def ? def.id : null);
        }
      }
      return list;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSelect]
  );

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [load]);

  // Retour de la page Stripe : on recharge dès que l'app / l'onglet redevient actif.
  useEffect(() => {
    const sub = AppState.addEventListener?.('change', (s) => {
      if (s === 'active') load({ silent: true });
    });
    let onFocus;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      onFocus = () => load({ silent: true });
      window.addEventListener('focus', onFocus);
    }
    return () => {
      sub?.remove?.();
      if (onFocus) window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const startPolling = () => {
    stopPolling();
    startedRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      const list = await load({ silent: true });
      if (!mountedRef.current) return;
      if (list && list.length > baselineRef.current) {
        stopPolling();
        setWaiting(false);
        if (isSelect && onSelect) {
          // la carte qui vient d'être ajoutée devient la carte choisie
          const newest = [...list].sort((a, b) => b.id - a.id)[0];
          onSelect(newest.id);
        }
      } else if (Date.now() - startedRef.current > POLL_MAX_MS) {
        stopPolling();
        setWaiting(false);
      }
    }, POLL_MS);
  };

  const handleAdd = async () => {
    setError(null);
    setBusy(true);
    baselineRef.current = cards.length;
    const res = await cardService.startSetup();
    if (!mountedRef.current) return;
    setBusy(false);
    if (!res.success) {
      setError(res.error || "Impossible d'ouvrir le formulaire sécurisé.");
      return;
    }
    if (res.added) {
      const list = await load({ silent: true });
      if (isSelect && onSelect && list?.length) onSelect(res.added.id);
      return;
    }
    setWaiting(true);
    startPolling();
  };

  // Carte enregistrée via le formulaire intégré : on recharge et, au paiement, on la sélectionne.
  const handleInlineSaved = async () => {
    const list = await load({ silent: true });
    if (isSelect && onSelect && list?.length) {
      onSelect([...list].sort((a, b) => b.id - a.id)[0].id);
    }
  };

  const handleDelete = async (card) => {
    const ok = await confirmAsync(
      'Supprimer cette carte ?',
      `${card.label} sera retirée de votre compte et de Stripe.`,
      'Supprimer'
    );
    if (!ok) return;
    setBusy(true);
    const res = await cardService.remove(card.id);
    setBusy(false);
    if (!res.success) {
      setError(res.error || 'Suppression impossible.');
      return;
    }
    if (selectedRef.current === card.id) onSelect?.(null);
    await load({ silent: true });
  };

  const handleDefault = async (card) => {
    setBusy(true);
    const res = await cardService.setDefault(card.id);
    setBusy(false);
    if (!res.success) {
      setError(res.error || 'Action impossible.');
      return;
    }
    await load({ silent: true });
  };

  const surface = { backgroundColor: theme.surface, borderColor: theme.border || '#E5E7EB' };

  // Carte affichée en grand dans le formulaire : la carte choisie (paiement) ou la carte par défaut (profil)
  const shownCard = isSelect
    ? cards.find((c) => c.id === selectedId) || null
    : cards.find((c) => c.is_default) || cards[0] || null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GREEN} />
      </View>
    );
  }

  return (
    <View>
      {!hideTitle ? (
        <View style={styles.titleRow}>
          <Ionicons name="card-outline" size={18} color={GREEN} />
          <Text style={[styles.title, { color: theme.text }]}>
            {isSelect ? 'Choisir ma carte' : 'Ma carte bancaire'}
          </Text>
        </View>
      ) : null}

      {!available ? (
        <View style={[styles.notice, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="information-circle" size={18} color="#B45309" />
          <Text style={styles.noticeText}>
            Le paiement par carte n’est pas encore configuré par l’administrateur (clés Stripe).
          </Text>
        </View>
      ) : null}

      {cards.length === 0 && available && !waiting && !error ? (
        <Text style={[styles.muted, { color: theme.textSecondary }]}>
          Aucune carte enregistrée. Ajoutez-la une seule fois : elle sera utilisée pour vos paiements par carte.
        </Text>
      ) : null}

      {shownCard ? (
        <View style={styles.visual}>
          <View style={styles.visualTop}>
            <Ionicons name="card" size={26} color="#fff" />
            <Text style={styles.visualBrand}>{shownCard.brand_label}</Text>
          </View>
          <Text style={styles.visualNumber}>•••• •••• •••• {shownCard.last4}</Text>
          <Text style={styles.visualMasked}>Numéro masqué pour votre sécurité · Statut : active</Text>
          <View style={styles.visualBottom}>
            <View style={{ flex: 1 }}>
              <Text style={styles.visualLabel}>TITULAIRE</Text>
              <Text style={styles.visualValue} numberOfLines={1}>
                {shownCard.holder_name || '—'}
              </Text>
            </View>
            <View>
              <Text style={styles.visualLabel}>EXPIRE</Text>
              <Text style={styles.visualValue}>{shownCard.exp_label || '—'}</Text>
            </View>
          </View>
          <Text style={styles.visualFoot}>
            {shownCard.funding_label}
            {shownCard.is_default ? ' · Carte par défaut' : ''}
            {shownCard.sandbox ? ' · test' : ''} · enregistrée via Stripe
          </Text>
        </View>
      ) : null}

      {cards.map((card) => {
        const active = isSelect && selectedId === card.id;
        const color = BRAND_COLORS[card.brand] || GREEN;
        return (
          <TouchableOpacity
            key={card.id}
            activeOpacity={isSelect ? 0.85 : 1}
            disabled={!isSelect}
            onPress={() => onSelect?.(card.id)}
            style={[styles.card, surface, active && { borderColor: GREEN, backgroundColor: `${GREEN}0F` }]}
          >
            <View style={[styles.brandBox, { backgroundColor: `${color}18` }]}>
              <Ionicons name="card" size={22} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { color: theme.text }]} numberOfLines={1}>
                {card.brand_label} •••• {card.last4}
              </Text>
              <Text style={[styles.muted, { color: theme.textSecondary }]}>
                {card.exp_label ? `Expire ${card.exp_label}` : ''}
                {card.is_default ? `${card.exp_label ? ' · ' : ''}Par défaut` : ''}
                {card.sandbox ? ' · carte de test' : ''}
              </Text>
            </View>
            {isSelect ? (
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={active ? GREEN : '#9CA3AF'}
              />
            ) : (
              <View style={styles.rowActions}>
                {!card.is_default ? (
                  <TouchableOpacity onPress={() => handleDefault(card)} disabled={busy} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>Par défaut</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => handleDelete(card)}
                  disabled={busy}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Supprimer la carte"
                >
                  <Ionicons name="trash-outline" size={20} color="#D93636" />
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {isSelect && allowOther && cards.length > 0 ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onSelect?.('other')}
          style={[styles.card, surface, selectedId === 'other' && { borderColor: GREEN, backgroundColor: `${GREEN}0F` }]}
        >
          <View style={[styles.brandBox, { backgroundColor: '#6B728018' }]}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#6B7280" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardLabel, { color: theme.text }]}>Une autre carte</Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>Formulaire sécurisé Stripe</Text>
          </View>
          <Ionicons
            name={selectedId === 'other' ? 'radio-button-on' : 'radio-button-off'}
            size={22}
            color={selectedId === 'other' ? GREEN : '#9CA3AF'}
          />
        </TouchableOpacity>
      ) : null}

      {waiting ? (
        <View style={[styles.notice, { backgroundColor: '#E8F3EC' }]}>
          <ActivityIndicator size="small" color={GREEN} />
          <Text style={[styles.noticeText, { color: GREEN }]}>
            Terminez l’enregistrement dans la page Stripe… la carte apparaîtra ici automatiquement.
          </Text>
          <TouchableOpacity onPress={() => load({ silent: true })}>
            <Text style={[styles.linkText, { color: GREEN }]}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {available && !sandbox && inlineCardFormSupported(publishableKey) ? (
        <StripeCardForm
          publishableKey={publishableKey}
          holderName={user?.fullname || user?.full_name || user?.name}
          onSaved={handleInlineSaved}
          title={cards.length ? 'Ajouter une autre carte' : 'Payer avec une nouvelle carte'}
          buttonLabel="Enregistrer la carte"
        />
      ) : null}

      {available && (sandbox || !inlineCardFormSupported(publishableKey)) ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleAdd}
          disabled={busy || waiting}
          style={[styles.addBtn, (busy || waiting) && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color={GREEN} /> : <Ionicons name="add-circle-outline" size={20} color={GREEN} />}
          <Text style={styles.addBtnText}>
            {cards.length ? 'Ajouter une autre carte' : 'Configurer ma carte bancaire'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {sandbox ? (
        <Text style={[styles.muted, { color: '#B45309', marginTop: 8 }]}>
          ⚠️ Mode TEST : une carte de démonstration est ajoutée, aucun vrai débit.
        </Text>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={[styles.notice, { backgroundColor: `${GREEN}14`, marginTop: 12 }]}>
        <Ionicons name="lock-closed" size={16} color={GREEN} />
        <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
          Le numéro de votre carte est saisi uniquement dans le formulaire sécurisé de Stripe. Mada Bien-Être ne
          conserve que la marque, les 4 derniers chiffres et la date d’expiration.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  visual: { backgroundColor: GREEN, borderRadius: 18, padding: 18, marginBottom: 14 },
  visualTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visualBrand: { color: '#fff', fontWeight: '800', fontSize: 15 },
  visualNumber: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 2, marginVertical: 18 },
  visualMasked: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: -10, marginBottom: 14 },
  visualBottom: { flexDirection: 'row', gap: 16 },
  visualLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, letterSpacing: 1 },
  visualValue: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 },
  visualFoot: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginTop: 12 },
  center: { paddingVertical: 20, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '800' },
  muted: { fontSize: 12.5, marginBottom: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  brandBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 15, fontWeight: '700' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallBtn: { borderWidth: 1, borderColor: GREEN, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  smallBtnText: { color: GREEN, fontSize: 11.5, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: GREEN,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addBtnText: { color: GREEN, fontSize: 15, fontWeight: '800' },
  notice: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, marginTop: 8, alignItems: 'center' },
  noticeText: { flex: 1, fontSize: 12.5, color: '#92400E', lineHeight: 17 },
  linkText: { fontWeight: '800', fontSize: 12.5 },
  errorText: { color: '#D93636', fontSize: 13, marginTop: 10 },
});
