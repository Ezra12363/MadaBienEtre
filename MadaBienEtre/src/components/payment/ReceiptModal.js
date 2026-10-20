// src/components/payment/ReceiptModal.js
//
// Reçu de paiement affiché DANS l'application (thème vert / crème, sans gras),
// avec QR code de vérification et bouton « Télécharger le PDF ».
// Le PDF complet (QR + code-barres) est généré par le backend.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import paymentService from '../../services/paymentService';
import { formatAr, formatDateTime } from './paymentUtils';

const GREEN = '#1F6B45';
const GREEN_DARK = '#154A31';
const GOLD = '#B8924A';
const CREAM = '#FBF8F1';
const INK = '#2B2B2B';
const MUTED = '#8A8578';
const LINE = '#E7E1D3';

function Row({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.sectionLine} />
      {children}
    </View>
  );
}

/**
 * @param {{visible:boolean, paymentId:number, view?:'client'|'therapist', onClose:()=>void}} props
 */
export default function ReceiptModal({ visible, paymentId, view, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!paymentId) return;
    setLoading(true);
    setError('');
    setNotice('');
    const res = await paymentService.getReceiptData(paymentId, view);
    if (res.success) setData(res.data);
    else setError(res.error || 'Reçu indisponible.');
    setLoading(false);
  }, [paymentId, view]);

  useEffect(() => {
    if (visible) load();
    else setData(null);
  }, [visible, load]);

  const download = async () => {
    setDownloading(true);
    setNotice('');
    const res = await paymentService.downloadPaymentReceipt(paymentId, view);
    setDownloading(false);
    setNotice(res.success ? 'Reçu PDF prêt.' : res.error || 'Échec du téléchargement.');
  };

  const showSplit = data && data.commission_amount !== undefined && data.commission_amount !== null;

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={GREEN} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={36} color="#B45309" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.ghostBtn} onPress={load}>
                <Text style={styles.ghostText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : data ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.header}>
                <Text style={styles.company}>Mada Bien-Être</Text>
                <Text style={styles.docTitle}>REÇU DE PAIEMENT</Text>
                <Text style={styles.docNo}>N° {data.receipt_no}</Text>
              </View>

              <View style={styles.amountCard}>
                <Text style={styles.amountCaption}>MONTANT PAYÉ</Text>
                <Text style={styles.amount}>{formatAr(data.amount)}</Text>
                <View style={styles.pill}>
                  <Ionicons name="checkmark-circle" size={13} color={GREEN} />
                  <Text style={styles.pillText}>{String(data.status_label || 'Payé').toUpperCase()}</Text>
                </View>
              </View>

              <Section title="Paiement">
                <Row label="Date et heure" value={data.paid_at_label || formatDateTime(data.paid_at)} />
                <Row label="Mode de paiement" value={data.method_label} />
                <Row label="Numéro payeur" value={data.payer_phone} />
                <Row label="Transaction" value={data.transaction_id} />
              </Section>

              <Section title="Réservation">
                <Row label="Réservation" value={`#${data.booking_id}`} />
                <Row label="Service" value={data.service_name} />
                <Row label="Séance prévue" value={data.scheduled_label} />
                <Row label="Client" value={data.client_name} />
                <Row label="Thérapeute" value={data.therapist_name} />
              </Section>

              {showSplit ? (
                <Section title="Répartition">
                  <Row label={`Commission plateforme (${data.commission_rate ?? '—'} %)`} value={formatAr(data.commission_amount)} />
                  <Row label="Net thérapeute" value={formatAr(data.net_amount)} />
                  <Row
                    label="Règlement"
                    value={data.settlement === 'cash_in_hand' ? 'Espèces remises au thérapeute' : 'Crédité au wallet'}
                  />
                </Section>
              ) : null}

              <View style={styles.qrBox}>
                {data.qr_url ? (
                  <Image source={{ uri: data.qr_url }} style={styles.qr} resizeMode="contain" />
                ) : (
                  <View style={[styles.qr, styles.qrFallback]}>
                    <Ionicons name="qr-code-outline" size={46} color={GREEN_DARK} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.qrTitle}>Vérifiez ce reçu</Text>
                  <Text style={styles.qrText}>
                    Scannez le QR code pour contrôler son authenticité. Le PDF contient aussi le
                    code-barres de la transaction.
                  </Text>
                  <Text style={styles.qrRef} numberOfLines={1}>
                    Réf. {data.transaction_id}
                  </Text>
                </View>
              </View>

              {notice ? <Text style={styles.notice}>{notice}</Text> : null}

              <TouchableOpacity style={styles.primaryBtn} onPress={download} disabled={downloading} activeOpacity={0.85}>
                {downloading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#fff" />
                    <Text style={styles.primaryText}>Télécharger le reçu (PDF)</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={onClose}>
                <Text style={styles.ghostText}>Fermer</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    minHeight: 280,
    backgroundColor: CREAM,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    ...Platform.select({ web: { marginBottom: 0 }, default: {} }),
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: LINE, marginBottom: 10 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  errorText: { color: INK, fontSize: 14, textAlign: 'center', fontWeight: '400' },
  header: { backgroundColor: GREEN, borderRadius: 16, padding: 16, marginBottom: 12 },
  company: { color: '#fff', fontSize: 18, fontWeight: '400' },
  docTitle: { color: '#CFE5D8', fontSize: 11, marginTop: 6, letterSpacing: 1.2, fontWeight: '400' },
  docNo: { color: '#CFE5D8', fontSize: 12, marginTop: 2, fontWeight: '400' },
  amountCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 6,
  },
  amountCaption: { color: MUTED, fontSize: 11, letterSpacing: 1, fontWeight: '400' },
  amount: { color: GREEN_DARK, fontSize: 30, marginTop: 4, fontWeight: '400' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E3F1E8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  pillText: { color: GREEN, fontSize: 11, letterSpacing: 0.8, fontWeight: '400' },
  section: { marginTop: 14 },
  sectionTitle: { color: GOLD, fontSize: 11, letterSpacing: 1, fontWeight: '400' },
  sectionLine: { height: 1, backgroundColor: GOLD, opacity: 0.6, marginTop: 5, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    gap: 14,
  },
  rowLabel: { color: MUTED, fontSize: 13, flexShrink: 0, fontWeight: '400' },
  rowValue: { color: INK, fontSize: 14, flex: 1, textAlign: 'right', fontWeight: '400' },
  qrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 12,
  },
  qr: { width: 104, height: 104 },
  qrFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F0E7', borderRadius: 8 },
  qrTitle: { color: INK, fontSize: 14, fontWeight: '400' },
  qrText: { color: MUTED, fontSize: 12, marginTop: 4, lineHeight: 17, fontWeight: '400' },
  qrRef: { color: MUTED, fontSize: 11, marginTop: 6, fontWeight: '400' },
  notice: { color: GREEN, fontSize: 13, textAlign: 'center', marginTop: 12, fontWeight: '400' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '400' },
  ghostBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  ghostText: { color: MUTED, fontSize: 14, fontWeight: '400' },
});
