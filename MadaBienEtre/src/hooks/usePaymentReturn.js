// src/hooks/usePaymentReturn.js
//
// À placer dans l'écran d'accueil du CLIENT : quand Stripe ramène l'utilisateur dans l'app
// (web : ?payment_return=<id> ; mobile : deep link payment-return), on ouvre AUTOMATIQUEMENT
// l'écran « Paiement » de la réservation (qui vérifie le paiement côté serveur).
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';

import { parsePaymentReturn } from '../utils/paymentReturn';

export default function usePaymentReturn(navigation) {
  useEffect(() => {
    let done = false;
    const open = (bookingId) => {
      if (!bookingId || done) return;
      done = true;
      setTimeout(() => {
        navigation?.navigate?.('Payment', { bookingId, fromStripe: true });
        done = false;
      }, 250);
    };

    // WEB : paramètre dans l'adresse ; on le retire pour ne pas rouvrir l'écran au prochain rechargement
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const id = parsePaymentReturn(window.location.href);
      if (id) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('payment_return');
          url.searchParams.delete('session_id');
          window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);
        } catch (e) {
          /* ignore */
        }
        open(id);
      }
      return undefined;
    }

    // MOBILE : lien d'ouverture initial + liens reçus pendant que l'app tourne
    Linking.getInitialURL?.()
      .then((u) => open(parsePaymentReturn(u)))
      .catch(() => {});
    const sub = Linking.addEventListener?.('url', ({ url }) => open(parsePaymentReturn(url)));
    return () => sub?.remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
