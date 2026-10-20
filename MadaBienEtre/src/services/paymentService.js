// src/services/paymentService.js
//
// Client API du flux de paiement + wallet + retraits.
//
// ⚠️ Aucune clé API (Vanila Pay / Stripe) ici : elles se mettent UNIQUEMENT
// dans le fichier .env du BACKEND (voir .env.paiements.EXEMPLE).
// L'application ne fait que parler à notre backend FastAPI.
import { Linking, Platform } from 'react-native';

import { get, post, put } from './api';

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

class PaymentService {
  // ---------- Client ----------
  /** Moyens de paiement disponibles (MVola, Orange, Airtel, carte, espèces) */
  getMethods() {
    return wrap(() => get('/payments/methods'));
  }

  /** Prix à payer + « peut-on payer maintenant ? » (réservation confirmée) */
  getQuote(bookingId) {
    return wrap(() => get(`/payments/quote/${bookingId}`));
  }

  /**
   * Démarre un paiement. Le montant est calculé PAR LE SERVEUR.
   * @param {{bookingId:number, method:'mobile_money'|'card'|'cash', provider?:string, phone?:string}} p
   */
  initiate({ bookingId, method, provider, phone }) {
    return wrap(() =>
      post('/payments/initiate', {
        booking_id: bookingId,
        method,
        provider: provider || undefined,
        phone: phone || undefined,
      })
    );
  }

  /** Le backend interroge le fournisseur ; seul lui peut passer le statut à « completed » */
  verify(paymentId) {
    return wrap(() => post(`/payments/${paymentId}/verify`));
  }

  cancel(paymentId) {
    return wrap(() => post(`/payments/${paymentId}/cancel`));
  }

  getHistory() {
    return wrap(() => get('/payments/history'));
  }

  getBookingPayment(bookingId) {
    return wrap(() => get(`/payments/booking/${bookingId}`));
  }

  /** Ouvre le reçu PDF (QR + code-barres) dans le navigateur / lecteur PDF */
  async openReceipt(paymentId) {
    const res = await wrap(() => get(`/payments/${paymentId}/receipt-link`));
    if (!res.success) return res;
    const url = res.data?.url;
    if (!url) return { success: false, error: 'Lien du reçu introuvable.' };

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: "Impossible d'ouvrir le reçu." };
    }
  }

  /** Ouvre la page de paiement sécurisée (carte : Stripe / Vanila Pay) */
  async openPaymentUrl(url) {
    if (!url) return false;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // ---------- Thérapeute ----------
  getMyWallet() {
    return wrap(() => get('/wallet/me'));
  }

  confirmCash(paymentId) {
    return wrap(() => post(`/payments/${paymentId}/confirm-cash`));
  }

  requestWithdrawal(payload) {
    return wrap(() => post('/wallet/withdrawals', payload));
  }

  cancelWithdrawal(withdrawalId) {
    return wrap(() => post(`/wallet/withdrawals/${withdrawalId}/cancel`));
  }

  // ---------- Admin ----------
  adminSummary() {
    return wrap(() => get('/wallet/admin/summary'));
  }

  adminPayments(status) {
    return wrap(() => get('/payments/admin/payments', status && status !== 'all' ? { status } : {}));
  }

  adminStats() {
    return wrap(() => get('/payments/admin/stats'));
  }

  adminTransactions() {
    return wrap(() => get('/wallet/admin/transactions'));
  }

  adminWithdrawals(status) {
    return wrap(() => get('/wallet/admin/withdrawals', status && status !== 'all' ? { status } : {}));
  }

  adminApproveWithdrawal(id) {
    return wrap(() => post(`/wallet/admin/withdrawals/${id}/approve`));
  }

  adminCompleteWithdrawal(id, transferReference) {
    return wrap(() =>
      post(`/wallet/admin/withdrawals/${id}/complete`, { transfer_reference: transferReference })
    );
  }

  adminRejectWithdrawal(id, reason) {
    return wrap(() => post(`/wallet/admin/withdrawals/${id}/reject`, { reason: reason || '' }));
  }
  // ---------- Statuts de paiement en liste (historique, offres, groupes) ----------
  /** { [bookingId]: payment } pour plusieurs réservations en UNE requête */
  getBatch(bookingIds = []) {
    const ids = [...new Set((bookingIds || []).filter(Boolean))];
    if (!ids.length) return Promise.resolve({ success: true, data: {} });
    return wrap(() => get('/payments/batch', { booking_ids: ids.join(',') }));
  }

  // ---------- Reçus ----------
  /** Toutes les infos du reçu (affichage dans l'app + QR). view: client | therapist (admin) */
  getReceiptData(paymentId, view) {
    return wrap(() => get(`/payments/${paymentId}/receipt-data`, view ? { view } : {}));
  }

  /**
   * Télécharge (ou ouvre) un PDF à partir d'une route « receipt-link ».
   * Web : le navigateur télécharge. Android / iOS : fichier enregistré puis
   * feuille de partage (Enregistrer dans Fichiers, WhatsApp, e-mail...).
   */
  async downloadPdf(linkPath, filename = 'recu.pdf', params = {}) {
    const res = await wrap(() => get(linkPath, params));
    if (!res.success) return res;
    const { download_url: downloadUrl, url } = res.data || {};
    if (!downloadUrl && !url) return { success: false, error: 'Lien du reçu introuvable.' };
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(downloadUrl || url, '_blank');
        return { success: true };
      }
      let FileSystem;
      let Sharing;
      try {
        try {
          FileSystem = require('expo-file-system/legacy');
        } catch (e) {
          FileSystem = require('expo-file-system');
        }
        Sharing = require('expo-sharing');
      } catch (e) {
        await Linking.openURL(url || downloadUrl);
        return { success: true };
      }
      const target = `${FileSystem.cacheDirectory}${filename}`;
      const dl = await FileSystem.downloadAsync(downloadUrl || url, target);
      if (dl?.status && dl.status >= 400) {
        return { success: false, error: 'Le téléchargement du reçu a échoué.' };
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Enregistrer / partager le reçu',
        });
      } else {
        await Linking.openURL(url || downloadUrl);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: "Impossible de télécharger le reçu." };
    }
  }

  downloadPaymentReceipt(paymentId, view) {
    return this.downloadPdf(
      `/payments/${paymentId}/receipt-link`,
      `recu-MBE-${String(paymentId).padStart(6, '0')}.pdf`,
      view ? { view } : {}
    );
  }

  downloadWithdrawalReceipt(withdrawalId) {
    return this.downloadPdf(`/wallet/withdrawals/${withdrawalId}/receipt-link`, `recu-retrait-${withdrawalId}.pdf`);
  }

  downloadCommissionReceipt(commissionId) {
    return this.downloadPdf(`/wallet/commissions/${commissionId}/receipt-link`, `recu-commission-${commissionId}.pdf`);
  }

  // ---------- Thérapeute : statistiques, commissions ----------
  myStats() {
    return wrap(() => get('/wallet/me/stats'));
  }

  myCommissions() {
    return wrap(() => get('/wallet/commissions'));
  }

  /** @param {{amount:number, method:'wallet'|'mobile_money'|'bank_transfer'|'cash', provider?:string, phone_number?:string, transfer_reference?:string}} payload */
  payCommission(payload) {
    return wrap(() => post('/wallet/commissions/pay', payload));
  }

  // ---------- Admin : stats, commissions, paramètres ----------
  adminWalletStats() {
    return wrap(() => get('/wallet/admin/stats'));
  }

  adminCommissions(status) {
    return wrap(() => get('/wallet/admin/commissions', status && status !== 'all' ? { status } : {}));
  }

  adminCommissionsDue() {
    return wrap(() => get('/wallet/admin/commissions/due'));
  }

  adminApproveCommission(id) {
    return wrap(() => post(`/wallet/admin/commissions/${id}/approve`));
  }

  adminRejectCommission(id, reason) {
    return wrap(() => post(`/wallet/admin/commissions/${id}/reject`, { reason: reason || '' }));
  }

  adminGetSettings() {
    return wrap(() => get('/wallet/admin/settings'));
  }

  adminSaveSettings(values) {
    return wrap(() => put('/wallet/admin/settings', values));
  }

  adminApplyCommission() {
    return wrap(() => post('/wallet/admin/settings/apply-commission'));
  }
}

export default new PaymentService();
