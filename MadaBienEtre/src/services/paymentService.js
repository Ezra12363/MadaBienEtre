// src/services/paymentService.js
//
// Client API du flux de paiement + wallet + retraits.
//
// ⚠️ Aucune clé API (Vanila Pay / Stripe) ici : elles se mettent UNIQUEMENT
// dans le fichier .env du BACKEND (voir .env.paiements.EXEMPLE).
// L'application ne fait que parler à notre backend FastAPI.
import { Linking, Platform } from 'react-native';

import { buildPaymentReturnUrl } from '../utils/paymentReturn';
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
   * @param {{bookingId:number, method:'mobile_money'|'card'|'cash', provider?:string, phone?:string, cardId?:number}} p
   */
  initiate({ bookingId, method, provider, phone, cardId }) {
    return wrap(() =>
      post('/payments/initiate', {
        booking_id: bookingId,
        method,
        provider: provider || undefined,
        phone: phone || undefined,
        // Carte enregistrée (Profil > Mode de paiement). Absent = formulaire sécurisé Stripe.
        card_id: cardId || undefined,
        return_url: method === 'card' ? buildPaymentReturnUrl(bookingId) : undefined,
      })
    );
  }

  /** Le CLIENT demande le remboursement d'un paiement confirmé (l'admin est notifié). */
  requestRefund(paymentId, reason) {
    return wrap(() => post(`/payments/${paymentId}/refund-request`, { reason: reason || undefined }));
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
        // Après un « await », les navigateurs bloquent souvent window.open :
        // on bascule alors sur la même fenêtre (le fournisseur nous ramène ensuite sur l'app).
        const w = window.open(url, '_blank');
        if (!w) window.location.assign(url);
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

  /** Le CLIENT prévient le thérapeute qu'il a remis les espèces (le thérapeute doit confirmer). */
  clientSent(paymentId) {
    return wrap(() => post(`/payments/${paymentId}/client-sent`));
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
  /**
   * Toutes les infos d'un reçu pour l'écran « Reçu » (sections, QR, code-barres, liens PDF).
   * kind : 'payment' | 'withdrawal' | 'commission'
   */
  getReceiptData(kind, id, view) {
    const path =
      kind === 'withdrawal'
        ? `/wallet/withdrawals/${id}/receipt-data`
        : kind === 'commission'
        ? `/wallet/commissions/${id}/receipt-data`
        : `/payments/${id}/receipt-data`;
    return wrap(() => get(path, view && kind === 'payment' ? { view } : {}));
  }

  /**
   * Télécharge un PDF à partir de son URL signée.
   *  - Web : fetch -> Blob -> clic sur un lien « download » (aucun blocage de pop-up) ;
   *          repli : ouverture dans un nouvel onglet.
   *  - Android / iOS : fichier enregistré dans le cache puis feuille de partage
   *          (Enregistrer dans Fichiers, WhatsApp, e-mail...) ; repli : navigateur.
   */
  async savePdfFromUrl(downloadUrl, filename = 'recu.pdf') {
    if (!downloadUrl) return { success: false, error: 'Lien du reçu introuvable.' };
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          const resp = await fetch(downloadUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          const objectUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => window.URL.revokeObjectURL(objectUrl), 4000);
          return { success: true };
        } catch (e) {
          window.open(downloadUrl, '_blank');
          return { success: true };
        }
      }

      let FileSystem = null;
      let Sharing = null;
      try {
        try {
          FileSystem = require('expo-file-system/legacy');
        } catch (e) {
          FileSystem = require('expo-file-system');
        }
        Sharing = require('expo-sharing');
      } catch (e) {
        FileSystem = null;
      }
      if (!FileSystem || !FileSystem.downloadAsync) {
        await Linking.openURL(downloadUrl.replace('&download=1', ''));
        return { success: true };
      }
      const target = `${FileSystem.cacheDirectory}${filename}`;
      const dl = await FileSystem.downloadAsync(downloadUrl, target);
      if (!dl || (dl.status && dl.status >= 400)) {
        return { success: false, error: 'Le téléchargement du reçu a échoué. Réessayez.' };
      }
      if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Enregistrer / partager le reçu',
        });
      } else {
        await Linking.openURL(downloadUrl.replace('&download=1', ''));
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Impossible de télécharger le reçu.' };
    }
  }

  /** Raccourci : demande un lien frais puis télécharge. */
  async downloadPdf(linkPath, filename = 'recu.pdf', params = {}) {
    const res = await wrap(() => get(linkPath, params));
    if (!res.success) return res;
    return this.savePdfFromUrl(res.data?.download_url || res.data?.url, filename);
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
  payCommission(payload) { // method 'card' + card_id = carte enregistrée
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
