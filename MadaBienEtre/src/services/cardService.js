// src/services/cardService.js
//
// Cartes bancaires ENREGISTRÉES (Profil > Mode de paiement) — client, thérapeute, admin.
//
// ⚠️ Le numéro de carte n'est JAMAIS saisi dans l'application : il est saisi dans la page
// sécurisée de Stripe (ouverte par startSetup). L'application ne reçoit que la marque,
// les 4 derniers chiffres et la date d'expiration.
import { Platform } from 'react-native';

import { makeAppUrl } from '../utils/paymentReturn';

import { del, get, post, put } from './api';
import paymentService from './paymentService';

const wrap = async (fn) => {
  try {
    const response = await fn();
    if (response?.error) {
      return {
        success: false,
        error: response.error.message || 'Une erreur est survenue.',
        status: response.error.status,
      };
    }
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error?.message || 'Une erreur est survenue.' };
  }
};

class CardService {
  /** { cards: [...], available: boolean, sandbox: boolean } — synchronisé avec Stripe côté serveur */
  list() {
    return wrap(() => get('/cards'));
  }

  /**
   * Ouvre le formulaire sécurisé Stripe pour ajouter une carte.
   * Retourne { success, opened, added? } : en mode TEST une carte de démonstration est ajoutée directement.
   */
  async startSetup() {
    let returnUrl;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      returnUrl = `${window.location.origin}${window.location.pathname}`;
    } else {
      returnUrl = makeAppUrl('card-return');
    }
    const res = await wrap(() => post('/cards/setup', { return_url: returnUrl }));
    if (!res.success) return res;
    if (res.data?.added) return { success: true, opened: false, added: res.data.added };
    const opened = await paymentService.openPaymentUrl(res.data?.url);
    if (!opened) return { success: false, error: "Impossible d'ouvrir la page sécurisée Stripe." };
    return { success: true, opened: true };
  }

  /** Prépare le formulaire intégré : { client_secret, publishable_key } */
  setupIntent() {
    return wrap(() => post('/cards/setup-intent'));
  }

  setDefault(cardId) {
    return wrap(() => put(`/cards/${cardId}/default`));
  }

  remove(cardId) {
    return wrap(() => del(`/cards/${cardId}`));
  }
}

export default new CardService();
