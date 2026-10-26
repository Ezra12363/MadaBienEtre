// src/components/payment/StripeCardForm.native.js
//
// [VERSION MOBILE — la version web est dans StripeCardForm.js]
// Formulaire de carte INTÉGRÉ (Stripe CardField) : Numéro de carte · MM/AA · CVC · Code postal.
// Nécessite @stripe/stripe-react-native + development build (pas Expo Go).
// ⚠️ Les données de carte vont DIRECTEMENT du champ Stripe vers Stripe (jamais par notre serveur).
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import cardService from '../../services/cardService';

const GREEN = '#1F6B45';

let StripeRN = null;
try {
  // eslint-disable-next-line global-require
  StripeRN = require('@stripe/stripe-react-native');
} catch (e) {
  StripeRN = null;
}

export const inlineCardFormSupported = (publishableKey) => !!publishableKey && !!StripeRN;

function NativeFields({ holderName, onSaved, title, buttonLabel }) {
  const { colors: theme } = useTheme();
  const { CardField, useConfirmSetupIntent } = StripeRN;
  const { confirmSetupIntent } = useConfirmSetupIntent();
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!complete || busy) return;
    setError(null);
    setBusy(true);
    const res = await cardService.setupIntent();
    if (!res.success) {
      setBusy(false);
      setError(res.error || 'Impossible de préparer le formulaire sécurisé.');
      return;
    }
    const { error: stripeError } = await confirmSetupIntent(res.data.client_secret, {
      paymentMethodType: 'Card',
      paymentMethodData: { billingDetails: { name: holderName || undefined } },
    });
    setBusy(false);
    if (stripeError) {
      setError(stripeError.message || 'Carte refusée.');
      return;
    }
    onSaved?.();
  };

  return (
    <View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <CardField
        postalCodeEnabled
        placeholders={{ number: 'Numéro de carte', expiration: 'MM/AA', cvc: 'CVC', postalCode: 'Code postal' }}
        cardStyle={{ backgroundColor: '#FFFFFF', textColor: '#1f2937', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 12 }}
        style={{ width: '100%', height: 52, marginVertical: 6 }}
        onCardChange={(d) => setComplete(!!d?.complete)}
      />
      <Text style={styles.note}>
        Champ sécurisé fourni par Stripe : les données de carte ne passent jamais par votre serveur.
      </Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={submit}
        disabled={!complete || busy}
        style={[styles.btn, (!complete || busy) && { opacity: 0.6 }]}
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
      <StripeRN.StripeProvider publishableKey={publishableKey}>
        <NativeFields {...{ holderName, onSaved, title, buttonLabel }} />
      </StripeRN.StripeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 8 },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
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
