// src/components/ai/AINegotiationAdvisor.js
//
// Conseiller IA de négociation (client ET thérapeute).
// Reçoit le résultat du hook useNegotiationAI(...) — aucun appel réseau
// direct ici, sauf la vérification de probabilité déclenchée par le prix
// saisi (debounce 700 ms).
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import { AICard, AIButton, AIError } from './AIPrimitives';
import { formatAr, formatPercent } from './aiHelpers';

const clamp01 = (n) => Math.max(0, Math.min(1, n));

const probabilityLevel = (p) => {
  if (p >= 70) return { label: "Forte chance d'acceptation", color: colors.success };
  if (p >= 40) return { label: 'Acceptation incertaine', color: colors.warning };
  return { label: 'Risque de refus élevé', color: colors.error };
};

const verdictFor = (role, position, gap) => {
  const abs = Math.abs(gap ?? 0);
  if (role === 'client') {
    if (position === 'above')
      return { color: colors.error, icon: 'trending-up', text: `Prix ${abs} % au-dessus du marché : une contre-offre est conseillée.` };
    if (position === 'below')
      return { color: colors.success, icon: 'thumbs-up', text: `Très bon prix : ${abs} % sous le marché. Vous pouvez accepter.` };
    return { color: colors.success, icon: 'checkmark-circle', text: 'Prix cohérent avec le marché.' };
  }
  if (position === 'below')
    return { color: colors.warning, icon: 'trending-down', text: `Offre ${abs} % sous le marché : vous pouvez contre-proposer.` };
  if (position === 'above')
    return { color: colors.success, icon: 'thumbs-up', text: `Offre ${abs} % au-dessus du marché : acceptation conseillée.` };
  return { color: colors.success, icon: 'checkmark-circle', text: 'Offre cohérente avec le marché.' };
};

/** Barre de fourchette : [min — max], repères « prix actuel », « votre prix », « prix juste ». */
const RangeBar = ({ min, max, fair, current, mine, tc }) => {
  const points = [min, max, fair, current, mine].filter((v) => Number.isFinite(v) && v > 0);
  if (points.length < 2) return null;

  const lo = Math.min(...points) * 0.92;
  const hi = Math.max(...points) * 1.08;
  const span = hi - lo || 1;
  const pos = (v) => `${clamp01((v - lo) / span) * 100}%`;

  return (
    <View style={styles.rangeWrap}>
      <View style={[styles.track, { backgroundColor: tc.border }]}>
        {Number.isFinite(min) && Number.isFinite(max) && (
          <View
            style={[
              styles.band,
              {
                left: pos(min),
                width: `${clamp01((max - min) / span) * 100}%`,
              },
            ]}
          />
        )}
        {Number.isFinite(fair) && <View style={[styles.tick, { left: pos(fair), backgroundColor: colors.primaryDark }]} />}
        {Number.isFinite(current) && current > 0 && (
          <View style={[styles.dot, { left: pos(current), backgroundColor: colors.info }]} />
        )}
        {Number.isFinite(mine) && mine > 0 && mine !== current && (
          <View style={[styles.dot, { left: pos(mine), backgroundColor: colors.secondary }]} />
        )}
      </View>

      <View style={styles.legend}>
        <LegendItem color={colors.info} label="Prix actuel" tc={tc} />
        {Number.isFinite(mine) && mine > 0 && mine !== current && (
          <LegendItem color={colors.secondary} label="Votre prix" tc={tc} />
        )}
        <LegendItem color={colors.primaryDark} label="Prix juste" tc={tc} />
      </View>
    </View>
  );
};

const LegendItem = ({ color, label, tc }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={[styles.legendText, { color: tc.textSecondary }]}>{label}</Text>
  </View>
);

/**
 * @param {object}   props
 * @param {object}   props.ai            retour de useNegotiationAI
 * @param {number}   props.currentPrice  prix sur la table
 * @param {number}   [props.inputPrice]  prix saisi dans le formulaire
 * @param {function} props.onUsePrice    (prix) => void
 */
const AINegotiationAdvisor = ({ ai, currentPrice, inputPrice, onUsePrice, style }) => {
  const { colors: tc } = useTheme();
  const role = ai?.role || 'client';

  // Probabilité du prix saisi (ou, à défaut, du prix recommandé).
  const target = inputPrice > 0 ? inputPrice : ai?.recommendedPrice;
  const checkRef = useRef(ai?.checkAcceptance);
  checkRef.current = ai?.checkAcceptance;

  useEffect(() => {
    if (!(target > 0)) return undefined;
    const timer = setTimeout(() => checkRef.current?.(target), 700);
    return () => clearTimeout(timer);
  }, [target]);

  if (!ai) return null;

  const { loading, error, pricing, market, acceptance, position, gapPercent, recommendedPrice, action } = ai;

  // Chargement initial
  if (loading && !pricing) {
    return (
      <AICard title="Conseiller IA" icon="sparkles" subtitle="Analyse du marché en cours…" style={style}>
        <ActivityIndicator color={colors.primary} />
      </AICard>
    );
  }

  // Aucune donnée exploitable
  if (!pricing?.fair) {
    return (
      <AICard title="Conseiller IA" icon="sparkles" style={style}>
        <AIError message={error || 'Estimation IA indisponible pour cette réservation.'} onRetry={ai.refresh} />
      </AICard>
    );
  }

  const verdict = verdictFor(role, position, gapPercent);
  const level = acceptance.probability !== null ? probabilityLevel(acceptance.probability) : null;
  const canUseRecommended = recommendedPrice > 0 && recommendedPrice !== Math.round(currentPrice);

  return (
    <AICard
      title="Conseiller IA"
      icon="sparkles"
      subtitle={
        ai.context?.massageName
          ? `${ai.context.massageName} · ${ai.context.duration} min`
          : 'Aide à la négociation'
      }
      style={style}
    >
      {/* Verdict */}
      <View style={[styles.verdict, { backgroundColor: verdict.color + '14', borderColor: verdict.color + '40' }]}>
        <Ionicons name={verdict.icon} size={18} color={verdict.color} />
        <Text style={[styles.verdictText, { color: tc.text }]}>{verdict.text}</Text>
      </View>

      {/* Prix juste + fourchette */}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: tc.textSecondary }]}>Prix juste estimé</Text>
          <Text style={styles.fair}>{formatAr(pricing.fair)}</Text>
        </View>
        {pricing.confidence !== null && (
          <View style={styles.right}>
            <Text style={[styles.label, { color: tc.textSecondary }]}>Fiabilité</Text>
            <Text style={[styles.value, { color: tc.text }]}>{formatPercent(pricing.confidence)}</Text>
          </View>
        )}
      </View>

      {pricing.min && pricing.max ? (
        <Text style={[styles.range, { color: tc.textSecondary }]}>
          Fourchette : {formatAr(pricing.min)} – {formatAr(pricing.max)}
        </Text>
      ) : null}

      <RangeBar
        min={pricing.min}
        max={pricing.max}
        fair={pricing.fair}
        current={Number(currentPrice)}
        mine={Number(inputPrice)}
        tc={tc}
      />

      {/* Analyse du marché (thérapeute uniquement) */}
      {role === 'therapist' && market && market.total_bookings > 0 ? (
        <View style={[styles.market, { borderColor: tc.border }]}>
          <Ionicons name="stats-chart-outline" size={15} color={colors.primary} />
          <Text style={[styles.marketText, { color: tc.textSecondary }]}>
            Marché : moyenne {formatAr(market.average_price)} sur {market.total_bookings} massage
            {market.total_bookings > 1 ? 's' : ''} terminé{market.total_bookings > 1 ? 's' : ''}
          </Text>
        </View>
      ) : null}

      {/* Prix recommandé */}
      {recommendedPrice > 0 && (
        <View style={styles.recoRow}>
          <View style={styles.flex}>
            <Text style={[styles.label, { color: tc.textSecondary }]}>
              {action === 'accept' ? 'Offre acceptable' : 'Contre-offre conseillée'}
            </Text>
            <Text style={[styles.value, { color: colors.primary }]}>{formatAr(recommendedPrice)}</Text>
          </View>
          {canUseRecommended && onUsePrice ? (
            <AIButton
              label="Utiliser"
              icon="flash-outline"
              onPress={() => onUsePrice(recommendedPrice)}
              style={styles.useBtn}
            />
          ) : null}
        </View>
      )}

      {/* Probabilité d'acceptation */}
      {target > 0 && (
        <View style={[styles.proba, { borderColor: tc.border }]}>
          <Text style={[styles.label, { color: tc.textSecondary }]}>
            Probabilité d'acceptation à {formatAr(target)}
          </Text>

          {acceptance.loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.alignStart} />
          ) : level ? (
            <>
              <Text style={[styles.probaValue, { color: level.color }]}>
                {Math.round(acceptance.probability)} %
              </Text>
              <View style={[styles.probaTrack, { backgroundColor: tc.border }]}>
                <View
                  style={[
                    styles.probaFill,
                    { width: `${acceptance.probability}%`, backgroundColor: level.color },
                  ]}
                />
              </View>
              <Text style={[styles.probaLabel, { color: tc.text }]}>{level.label}</Text>
            </>
          ) : acceptance.error ? (
            <TouchableOpacity onPress={() => ai.checkAcceptance(target)}>
              <Text style={[styles.errorText, { color: colors.error }]}>
                {acceptance.error} · Réessayer
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <Text style={[styles.disclaimer, { color: tc.textSecondary }]}>
        Estimation indicative fournie par l'IA, à utiliser comme aide à la décision.
      </Text>
    </AICard>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  alignStart: { alignSelf: 'flex-start', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  label: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
  value: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold },
  fair: { fontSize: typography.fontSize.xxl, fontFamily: typography.fontFamily.bold, color: colors.primary },
  range: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, marginTop: 2 },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
  },
  verdictText: { flex: 1, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, lineHeight: 18 },
  rangeWrap: { marginTop: spacing.md, marginBottom: spacing.xs },
  track: { height: 8, borderRadius: 4, position: 'relative' },
  band: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4, backgroundColor: colors.primary + '55' },
  tick: { position: 'absolute', top: -4, width: 3, height: 16, borderRadius: 2, marginLeft: -1 },
  dot: {
    position: 'absolute',
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: typography.fontFamily.regular },
  market: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  marketText: { flex: 1, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular },
  recoRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  useBtn: { paddingHorizontal: spacing.md },
  proba: { borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.sm },
  probaValue: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, marginTop: 2 },
  probaTrack: { height: 8, borderRadius: 4, marginVertical: 6, overflow: 'hidden' },
  probaFill: { height: 8, borderRadius: 4 },
  probaLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  errorText: { fontSize: typography.fontSize.sm, marginTop: 4 },
  disclaimer: { fontSize: 11, marginTop: spacing.sm },
});

export default AINegotiationAdvisor;
