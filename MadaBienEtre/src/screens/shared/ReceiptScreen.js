// src/screens/shared/ReceiptScreen.js
//
// Page « Reçu » (client, thérapeute et admin) : s'ouvre comme une page normale,
// avec le header ET la barre de navigation de l'application (jamais en modale).
//
//   navigation.navigate('Receipt', { kind: 'payment' | 'withdrawal' | 'commission',
//                                    id: <id>, view?: 'client' | 'therapist' })
//
// Le reçu affiche : statut, montant, tous les détails du paiement, le QR code de
// vérification et le code-barres. Le bouton « Télécharger le reçu (PDF) » marche
// sur Web, Android et iOS.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Header from '../../components/common/Header';
import { formatAr } from '../../components/payment/paymentUtils';
import { useTheme } from '../../context/ThemeContext';
import paymentService from '../../services/paymentService';

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
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

export default function ReceiptScreen({ route, navigation }) {
  const { kind = 'payment', id, view } = route?.params || {};
  const { colors: theme } = useTheme();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState({ ok: true, text: '' });
  const [qrFailed, setQrFailed] = useState(false);
  const [barFailed, setBarFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await paymentService.getReceiptData(kind, id, view);
    if (res.success) setData(res.data);
    else setError(res.error || 'Reçu indisponible.');
    setLoading(false);
  }, [kind, id, view]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async () => {
    if (!data) return;
    setDownloading(true);
    setNotice({ ok: true, text: '' });
    const res = await paymentService.savePdfFromUrl(data.download_url, data.pdf_name || 'recu.pdf');
    setDownloading(false);
    setNotice(
      res.success
        ? { ok: true, text: 'Reçu PDF téléchargé.' }
        : { ok: false, text: res.error || 'Échec du téléchargement.' }
    );
  };

  const goBack = () => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate?.('Home'));

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Header title="Reçu" showBack />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#B45309" />
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <TouchableOpacity style={styles.ghostBtn} onPress={load}>
            <Text style={[styles.ghostText, { color: GREEN }]}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={goBack}>
            <Text style={styles.ghostText}>Retour</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.sheet}>
            {/* En-tête */}
            <View style={styles.header}>
              <Text style={styles.company}>{data.company}</Text>
              <Text style={styles.docTitle}>{String(data.doc_title).toUpperCase()}</Text>
              <Text style={styles.docNo}>N° {data.receipt_no}</Text>
            </View>

            {/* Montant */}
            <View style={styles.amountCard}>
              <Text style={styles.amountCaption}>{String(data.amount_caption).toUpperCase()}</Text>
              <Text style={styles.amount}>{formatAr(data.amount)}</Text>
              <View style={[styles.pill, !data.status_ok && { backgroundColor: '#FBEFD5' }]}>
                <Ionicons
                  name={data.status_ok ? 'checkmark-circle' : 'time'}
                  size={13}
                  color={data.status_ok ? GREEN : '#9A6A12'}
                />
                <Text style={[styles.pillText, !data.status_ok && { color: '#9A6A12' }]}>
                  {String(data.status_label).toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Détails */}
            {(data.sections || []).map((sec) =>
              sec.rows?.length ? (
                <View key={sec.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{String(sec.title).toUpperCase()}</Text>
                  <View style={styles.sectionLine} />
                  {sec.rows.map(([label, value]) => (
                    <Row key={`${sec.title}-${label}`} label={label} value={value} />
                  ))}
                </View>
              ) : null
            )}

            {/* QR code */}
            <View style={styles.qrBox}>
              {data.qr_url && !qrFailed ? (
                <Image source={{ uri: data.qr_url }} style={styles.qr} resizeMode="contain" onError={() => setQrFailed(true)} />
              ) : (
                <View style={[styles.qr, styles.fallback]}>
                  <Ionicons name="qr-code-outline" size={56} color={GREEN_DARK} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.qrTitle}>Vérifiez ce reçu</Text>
                <Text style={styles.qrText}>Scannez le QR code pour contrôler son authenticité en ligne.</Text>
              </View>
            </View>

            {/* Code-barres */}
            <View style={styles.barBox}>
              {data.barcode_url && !barFailed ? (
                <Image source={{ uri: data.barcode_url }} style={styles.bar} resizeMode="contain" onError={() => setBarFailed(true)} />
              ) : (
                <View style={[styles.bar, styles.fallback]}>
                  <Ionicons name="barcode-outline" size={48} color={GREEN_DARK} />
                </View>
              )}
              <Text style={styles.barText}>{data.barcode_data}</Text>
            </View>

            {data.footer ? <Text style={styles.footer}>{data.footer}</Text> : null}
          </View>

          {notice.text ? (
            <Text style={[styles.notice, { color: notice.ok ? GREEN : '#B91C1C' }]}>{notice.text}</Text>
          ) : null}

          <View style={styles.actions}>
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
            <TouchableOpacity style={styles.ghostBtn} onPress={goBack}>
              <Text style={styles.ghostText}>Retour</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { fontSize: 14, textAlign: 'center', fontWeight: '400' },
  scroll: { padding: 16, paddingBottom: 40, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: LINE,
  },
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
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
  },
  qr: { width: 130, height: 130 },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F0E7', borderRadius: 8 },
  qrTitle: { color: INK, fontSize: 14, fontWeight: '400' },
  qrText: { color: MUTED, fontSize: 12, marginTop: 4, lineHeight: 17, fontWeight: '400' },
  barBox: {
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
  },
  bar: { width: '100%', maxWidth: 380, height: 84 },
  barText: { color: MUTED, fontSize: 12, marginTop: 6, letterSpacing: 1, fontWeight: '400' },
  footer: { color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 14, fontWeight: '400' },
  notice: { fontSize: 13, textAlign: 'center', marginTop: 14, fontWeight: '400' },
  actions: { width: '100%', maxWidth: 520, marginTop: 14 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '400' },
  ghostBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  ghostText: { color: MUTED, fontSize: 14, fontWeight: '400' },
});
