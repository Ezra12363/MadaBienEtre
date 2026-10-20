// src/screens/client/AIRecommendationScreen.js
//
// CLIENT — « ✨ Assistant IA & Chatbot »
//   Onglet 1 : Recommandations (POST /ai/recommend-therapist) + services populaires
//   Onglet 2 : Estimation du prix (predict-price, pricing/suggest, pricing/calculate)
//   Onglet 3 : Chatbot (POST /chatbot/message)
//
// Params de route optionnels : { initialTab: 'reco' | 'price' | 'chat' }
//
// ✅ Corrige l'ancien bug : `setHasSearched(true)` était appelé alors que le
// state `hasSearched` n'était pas déclaré (ReferenceError à la recherche IA).

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import Header from '../../components/common/Header';
import useScreenLayout from '../../hooks/useScreenLayout';
import aiService from '../../services/aiService';
import {
  AICard,
  AIButton,
  AIField,
  AIError,
  AIEmpty,
  AITabs,
} from '../../components/ai/AIPrimitives';
import AIRecommendationCard from '../../components/ai/AIRecommendationCard';
import AIPopularServices from '../../components/ai/AIPopularServices';
import AIBestTherapists from '../../components/ai/AIBestTherapists';
import AIPriceEstimateCard from '../../components/ai/AIPriceEstimateCard';
import AIChatPanel from '../../components/ai/AIChatPanel';
import { toPositiveInt } from '../../components/ai/aiHelpers';

const TABS = [
  { id: 'reco', label: 'Recommandations', icon: 'sparkles-outline' },
  { id: 'price', label: 'Estimation', icon: 'calculator-outline' },
  { id: 'chat', label: 'Chatbot', icon: 'chatbubbles-outline' },
];

const QUICK_OPTIONS = [
  {
    id: 'relax',
    icon: 'spa',
    label: 'Relaxation',
    desc: 'Anti-stress',
    text: 'Je cherche un massage relaxant pour me détendre, je suis stressé(e) et fatigué(e).',
  },
  {
    id: 'pain',
    icon: 'bandage',
    label: 'Douleurs',
    desc: 'Musculaires',
    text: "J'ai des douleurs musculaires au dos et à la nuque, j'ai besoin d'un massage thérapeutique.",
  },
  {
    id: 'sport',
    icon: 'run',
    label: 'Sportif',
    desc: 'Récupération',
    text: "Je pratique le sport et j'ai besoin d'un massage pour la récupération.",
  },
  {
    id: 'pregnant',
    icon: 'baby-carriage',
    label: 'Prénatal',
    desc: 'Grossesse',
    text: 'Je suis enceinte et je cherche un massage prénatal adapté.',
  },
];

const AIRecommendationScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const { sidePadding } = useScreenLayout();
  const { user } = useAuth();

  const initialTab = TABS.some((t) => t.id === route?.params?.initialTab)
    ? route.params.initialTab
    : 'reco';

  const [tab, setTab] = useState(initialTab);
  const [symptoms, setSymptoms] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [hasSearched, setHasSearched] = useState(false); // ← state manquant
  const scrollRef = useRef(null);

  const openBooking = useCallback(
    (therapist) => {
      const id = therapist?.therapist_id ?? therapist?.id;
      try {
        navigation.navigate('CreateBooking', { therapist, therapistId: id });
      } catch (e) {
        Alert.alert('Réservation', "Impossible d'ouvrir la réservation pour le moment.");
      }
    },
    [navigation]
  );

  const search = async () => {
    const text = symptoms.trim();
    if (!text) {
      setError('Décrivez votre besoin (ou choisissez une option rapide).');
      return;
    }
    if (!user?.id) {
      setError('Veuillez vous reconnecter.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await aiService.recommendTherapists({
      user_id: user.id,
      symptoms: text,
      budget_max: toPositiveInt(budget),
    });

    if (result.success) {
      setRecommendations(Array.isArray(result.data) ? result.data : []);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 360, animated: true }), 250);
    } else {
      setRecommendations([]);
      setError(result.error);
    }
    setHasSearched(true);
    setLoading(false);
  };

  const noResult = hasSearched && !loading && !error && recommendations.length === 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="✨ Assistant IA" subtitle="Recommandations, prix et chatbot" showBack />

      <View style={[styles.body, { paddingHorizontal: sidePadding }]}>
        <AITabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'chat' ? (
          <AIChatPanel role="CLIENT" />
        ) : (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            {tab === 'reco' && (
              <>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Que recherchez-vous ?
                </Text>
                <View style={styles.quickGrid}>
                  {QUICK_OPTIONS.map((o) => (
                    <TouchableOpacity
                      key={o.id}
                      activeOpacity={0.85}
                      onPress={() => setSymptoms(o.text)}
                      style={[
                        styles.quick,
                        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                      ]}
                    >
                      <View style={styles.quickIcon}>
                        <MaterialCommunityIcons name={o.icon} size={24} color={colors.primary} />
                      </View>
                      <Text style={[styles.quickLabel, { color: themeColors.text }]}>{o.label}</Text>
                      <Text style={[styles.quickDesc, { color: themeColors.textSecondary }]}>{o.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <AICard title="Décrivez votre besoin" icon="create-outline">
                  <AIField
                    value={symptoms}
                    onChangeText={setSymptoms}
                    placeholder="Ex : douleurs au dos, besoin de me détendre..."
                    multiline
                  />
                  <AIField
                    label="Budget maximum (facultatif)"
                    value={budget}
                    onChangeText={(t) => setBudget(t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    suffix="Ar"
                    placeholder="ex : 50000"
                  />
                  <AIError message={error} />
                  <AIButton
                    label="Trouver mon thérapeute"
                    icon="sparkles"
                    onPress={search}
                    loading={loading}
                  />
                </AICard>

                {recommendations.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                      {recommendations.length} thérapeute(s) recommandé(s)
                    </Text>
                    {recommendations.map((t, i) => (
                      <AIRecommendationCard
                        key={t.therapist_id ?? t.id ?? i}
                        therapist={t}
                        onPress={openBooking}
                        onBook={openBooking}
                      />
                    ))}
                  </>
                )}

                {noResult && (
                  <AIEmpty
                    icon="search-outline"
                    text="Aucun thérapeute trouvé pour le moment. Essayez d'augmenter votre budget ou de reformuler votre besoin."
                  />
                )}

                <AIPopularServices title="Services populaires" />
                <AIBestTherapists
                  title="Thérapeutes les mieux notés"
                  limit={5}
                  onPress={openBooking}
                  onBook={openBooking}
                />
              </>
            )}

            {tab === 'price' && (
              <AIPriceEstimateCard
                onReserve={(res) =>
                  navigation.navigate('CreateBooking', {
                    massageType: res?.type,
                    estimatedPrice: res?.suggest?.suggested_price ?? res?.calc?.final_price,
                  })
                }
              />
            )}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    flex: 1,
    width: '100%',
    paddingTop: spacing.md,
  },
  scroll: { paddingBottom: spacing.xxl },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.sm,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  quick: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 130,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.sm + 2,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quickLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
  quickDesc: { fontSize: typography.fontSize.xs },
});

export default AIRecommendationScreen;
