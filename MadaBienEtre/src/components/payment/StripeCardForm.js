// src/components/payment/StripeCardForm.js
//
// [VERSION WEB — la version mobile est dans StripeCardForm.native.js]
// Formulaire de carte INTÉGRÉ (Stripe Elements) : « Payer avec une nouvelle carte »
//   Numéro de carte · MM/AA · CVC · Code postal
//
//  - WEB    : Stripe.js (chargé depuis js.stripe.com) -> Card Element monté dans la page.
//  - MOBILE : @stripe/stripe-react-native (CardField) si le paquet est installé
//             (nécessite un development build, pas Expo Go). Sinon le parent propose la page Stripe.
//
// ⚠️ Les données de carte vont DIRECTEMENT du champ Stripe vers Stripe. Elles ne passent jamais par notre serveur.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import cardService from '../../services/cardService';

const GREEN = '#1F6B45';

/** true si le formulaire intégré est utilisable sur cette plateforme (web : toujours, si clé Stripe). */
export const inlineCardFormSupported = (publishableKey) => !!publishableKey && Platform.OS === 'web';

const loadStripeJs = () =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Stripe.js indisponible'));
    if (window.Stripe) return resolve(window.Stripe);
    const existing = document.querySelector('script[data-stripe-js]');
    const onLoad = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error('Stripe.js indisponible')));
    if (existing) {
      existing.addEventListener('load', onLoad);
      return undefined;
    }
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.async = true;
    s.setAttribute('data-stripe-js', '1');
    s.onload = onLoad;
    s.onerror = () => reject(new Error('Impossible de charger Stripe (connexion ?).'));
    document.head.appendChild(s);
    return undefined;
  });

/* ------------------------------------------------------------------ WEB */
function WebFields({ publishableKey, holderName, onSaved, title, buttonLabel }) {
  const { colors: theme } = useTheme();
  const hostRef = useRef(null);
  const stripeRef = useRef(null);
  const elementRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let element = null;
    loadStripeJs()
      .then((Stripe) => {
        if (cancelled || !hostRef.current) return;
        const stripe = Stripe(publishableKey, { locale: 'fr' });
        stripeRef.current = stripe;
        element = stripe.elements().create('card', {
          hidePostalCode: false,
          style: {
            base: {
              fontSize: '16px',
              color: '#1f2937',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
              '::placeholder': { color: '#8792a2' },
            },
            invalid: { color: '#D93636' },
          },
        });
        const box = document.createElement('div');
        box.style.width = '100%';
        hostRef.current.appendChild(box);
        element.mount(box);
        element.on('change', (e) => setFieldError(e.error ? e.error.message : null));
        element.on('ready', () => setReady(true));
        elementRef.current = element;
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      try {
        element?.destroy();
      } catch (e) {
        /* ignore */
      }
    };
  }, [publishableKey]);

  const submit = async () => {
    if (!stripeRef.current || !elementRef.current || busy) return;
    setError(null);
    setBusy(true);
    const res = await cardService.setupIntent();
    if (!res.success) {
      setBusy(false);
      setError(res.error || 'Impossible de préparer le formulaire sécurisé.');
      return;
    }
    const { error: stripeError } = await stripeRef.current.confirmCardSetup(res.data.client_secret, {
      payment_method: {
        card: elementRef.current,
        billing_details: { name: holderName || undefined },
      },
    });
    setBusy(false);
    if (stripeError) {
      setError(stripeError.message || 'Carte refusée.');
      return;
    }
    try {
      elementRef.current.clear();
    } catch (e) {
      /* ignore */
    }
    onSaved?.();
  };

  return (
    <View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <View style={[styles.field, { borderColor: fieldError ? '#D93636' : '#E5E7EB' }]}>
        <Ionicons name="card-outline" size={22} color="#8792a2" style={{ marginRight: 8 }} />
        <View ref={hostRef} style={{ flex: 1, minHeight: 24 }} />
        {!ready && !error ? <ActivityIndicator size="small" color={GREEN} /> : null}
      </View>
      {fieldError ? <Text style={styles.err}>{fieldError}</Text> : null}
      <Text style={styles.note}>
        Champ sécurisé fourni par Stripe : les données de carte ne passent jamais par votre serveur.
      </Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={submit}
        disabled={!ready || busy}
        style={[styles.btn, (!ready || busy) && { opacity: 0.6 }]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="lock-closed" size={16} color="#fff" />}
        <Text style={styles.btnText}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * @param {{ publishableKey:string, holderName?:string, onSaved?:()=>void, title?:string, buttonLabel?:string }} props
 */
export default function StripeCardForm({
  publishableKey,
  holderName,
  onSaved,
  title = 'Payer avec une nouvelle carte',
  buttonLabel = 'Enregistrer la carte',
}) {
  const { colors: theme } = useTheme();
  if (!inlineCardFormSupported(publishableKey)) return null;

  return (
    <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border || '#E5E7EB' }]}>
      <WebFields {...{ publishableKey, holderName, onSaved, title, buttonLabel }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 8 },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  note: { fontSize: 11.5, color: '#6B7280', marginTop: 10, lineHeight: 16 },
  err: { color: '#D93636', fontSize: 12.5, marginTop: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 14,
    minHeight: 48,
    marginTop: 14,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
