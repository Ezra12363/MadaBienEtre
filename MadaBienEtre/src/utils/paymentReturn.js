// src/utils/paymentReturn.js
//
// Retour automatique dans l'application après la page sécurisée Stripe.
//  - WEB    : Stripe ramène sur l'app avec  ?payment_return=<id réservation>
//  - MOBILE : Stripe -> page « Terminé » du backend -> deep link  <scheme>://payment-return?booking_id=<id>
import { Platform } from 'react-native';

let ExpoLinking = null;
try {
  // expo-linking est inclus avec Expo (expo-router / React Navigation) ; absent => pas de deep link.
  // eslint-disable-next-line global-require
  ExpoLinking = require('expo-linking');
} catch (e) {
  ExpoLinking = null;
}

export const getLinking = () => ExpoLinking;

/** Deep link mobile de l'application (ex. mada://payment-return?booking_id=5). undefined si indisponible. */
export const makeAppUrl = (path, query) => {
  try {
    if (!ExpoLinking?.createURL) return undefined;
    return ExpoLinking.createURL(path, query ? { queryParams: query } : undefined);
  } catch (e) {
    return undefined;
  }
};

/** URL de retour pour un paiement Stripe. */
export const buildPaymentReturnUrl = (bookingId) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}?payment_return=${bookingId}`;
  }
  return makeAppUrl('payment-return', { booking_id: String(bookingId) });
};

/** Extrait l'id de réservation d'une URL de retour (web ou deep link). null sinon. */
export const parsePaymentReturn = (url) => {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/[?&](?:payment_return|booking_id)=(\d+)/);
  if (!m) return null;
  if (!/payment[-_]return/.test(url)) return null;
  return Number(m[1]);
};
