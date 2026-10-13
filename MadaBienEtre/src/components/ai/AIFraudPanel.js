// src/components/ai/AIFraudPanel.js
// ADMIN — POST /ai/fraud-detection { booking_id }.
// Le backend analyse UNE réservation à la fois : on propose donc
//  1) une analyse manuelle par n° de réservation ;
//  2) un scan des dernières réservations (10 max) pour faire ressortir
//     celles à examiner en priorité.
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import aiService from '../../services/aiService';
import adminService from '../../services/adminService';
import { AICard, AIButton, AIField, AIError, AIEmpty } from './AIPrimitives';
import AIInsightCard from './AIInsightCard';
import { toPositiveInt, toPercentNumber } from './aiHelpers';

const SCAN_LIMIT = 10;

// Lecture tolérante du résultat (le schéma exact dépend du service backend).
const readFraud = (data) => {
  if (!data || typeof data !== 'object') return { flagged: false, score: null, reasons: [] };

  const rawScore = [data.fraud_score, data.risk_score, data.score, data.probability]
    .map((v) => Number(v))
    .find((v) => Number.isFinite(v));
  const score = rawScore === undefined ? null : toPercentNumber(rawScore);

  const flagFields = [data.is_fraud, data.is_suspicious, data.suspicious, data.flagged, data.fraud_detected];
  const explicit = flagFields.find((v) => typeof v === 'boolean');
  const level = String(data.risk_level || data.level || '').toLowerCase();
  const flagged =
    explicit !== undefined
      ? explicit
      : ['high', 'medium', 'élevé', 'eleve', 'moyen'].includes(level) || (score !== null && score >= 50);

  const listSource = data.reasons || data.flags || data.indicators || data.alerts || [];
  const reasons = (Array.isArray(listSource) ? listSource : [])
    .map((r) => (typeof r === 'string' ? r : r?.message || r?.reason || r?.description || null))
    .filter(Boolean);

  return { flagged, score, reasons, level };
};

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.bookings || payload?.data || [];
};

const AIFraudPanel = () => {
  const { colors: tc } = useTheme();
  const [bookingId, setBookingId] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  const [single, setSingle] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scan, setScan] = useState(null); // { alerts, analysed }

  const check = async () => {
    const id = toPositiveInt(bookingId);
    if (!id) return setError('Entrez un numéro de réservation valide.');
    setChecking(true);
    setError(null);
    setSingle(null);
    const result = await aiService.detectFraud(id);
    if (result.success) setSingle({ id, ...readFraud(result.data) });
    else setError(result.error);
    setChecking(false);
  };

  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    setScan(null);
    try {
      const payload = await adminService.getBookings({ limit: SCAN_LIMIT });
      const bookings = toList(payload).slice(0, SCAN_LIMIT);
      if (bookings.length === 0) {
        setScan({ alerts: [], analysed: 0 });
      } else {
        const results = await Promise.all(
          bookings.map(async (b) => {
            const r = await aiService.detectFraud(b.id);
            return r.success ? { id: b.id, ...readFraud(r.data) } : null;
          })
        );
        const done = results.filter(Boolean);
        setScan({
          analysed: done.length,
          alerts: done.filter((r) => r.flagged).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
        });
        if (done.length === 0) setScanError("L'analyse n'a retourné aucun résultat.");
      }
    } catch (e) {
      setScanError('Impossible de charger les réservations à analyser.');
    }
    setScanning(false);
  };

  const renderAlert = (r, key) => (
    <AIInsightCard
      key={key}
      type={r.flagged ? 'warning' : 'success'}
      insight={{
        title: `Réservation #${r.id}`,
        description: r.flagged ? 'Activité suspecte : à vérifier.' : 'Aucun signe de fraude détecté.',
        details: r.reasons.slice(0, 4),
        value: r.score !== null ? `${Math.round(r.score)} %` : undefined,
        valueLabel: 'Score de risque',
      }}
    />
  );

  return (
    <AICard
      title="Alertes de fraude"
      icon="shield-checkmark-outline"
      subtitle="Détection d'activités suspectes sur les réservations"
    >
      <View style={styles.row}>
        <AIField
          style={styles.flex}
          label="Analyser une réservation"
          value={bookingId}
          onChangeText={(t) => setBookingId(t.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholder="N° de réservation"
        />
        <AIButton label="Analyser" onPress={check} loading={checking} style={styles.checkBtn} />
      </View>
      <AIError message={error} />
      {single && renderAlert(single, 'single')}

      <View style={[styles.divider, { backgroundColor: tc.border }]} />

      <AIButton
        variant="outline"
        icon="scan-outline"
        label={`Analyser les ${SCAN_LIMIT} dernières réservations`}
        onPress={runScan}
        loading={scanning}
      />
      <AIError message={scanError} />

      {scan && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[styles.summary, { color: tc.textSecondary }]}>
            {scan.analysed} réservation(s) analysée(s) · {scan.alerts.length} alerte(s)
          </Text>
          {scan.alerts.length === 0 ? (
            <AIEmpty icon="checkmark-circle-outline" text="Aucune réservation suspecte parmi celles analysées." />
          ) : (
            scan.alerts.map((r) => renderAlert(r, `alert-${r.id}`))
          )}
        </View>
      )}
    </AICard>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  checkBtn: { marginBottom: spacing.sm },
  divider: { height: 1, marginVertical: spacing.md },
  summary: { fontSize: typography.fontSize.sm, marginBottom: spacing.sm },
});

export default AIFraudPanel;
