// src/screens/therapist/AIAssistantScreen.js
//
// THÉRAPEUTE — « ✨ Assistant IA »
//   Tarification : suggestion de tarif + calcul du prix (/pricing/suggest, /pricing/calculate)
//   Marché       : analyse du marché + services populaires (/pricing/market-analysis, /ai/popular-services)
//   Acceptation  : probabilité d'acceptation du prix (/ai/predict-acceptance)
//   Chatbot      : aide à l'utilisation de l'application (/chatbot/message)
//
// Params de route optionnels :
//   { initialTab: 'pricing' | 'market' | 'acceptance' | 'chat',
//     bookingId, price }   // pré-remplissent l'onglet Acceptation

import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';
import Header from '../../components/common/Header';
import useScreenLayout from '../../hooks/useScreenLayout';
import { AITabs } from '../../components/ai/AIPrimitives';
import AIPricingBlock from '../../components/ai/AIPricingBlock';
import AIMarketAnalysisCard from '../../components/ai/AIMarketAnalysisCard';
import AIPopularServices from '../../components/ai/AIPopularServices';
import AIAcceptanceCard from '../../components/ai/AIAcceptanceCard';
import AIChatPanel from '../../components/ai/AIChatPanel';

const TABS = [
  { id: 'pricing', label: 'Tarification', icon: 'pricetag-outline' },
  { id: 'market', label: 'Marché', icon: 'stats-chart-outline' },
  { id: 'acceptance', label: 'Acceptation', icon: 'pulse-outline' },
  { id: 'chat', label: 'Chatbot', icon: 'chatbubbles-outline' },
];

const AIAssistantScreen = ({ route }) => {
  const { colors: themeColors } = useTheme();
  const { sidePadding } = useScreenLayout();
  const params = route?.params || {};

  const [tab, setTab] = useState(
    TABS.some((t) => t.id === params.initialTab) ? params.initialTab : 'pricing'
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="Assistant IA"
        subtitle="Tarification intelligente"
        showBack
      />

      <View style={[styles.body, { paddingHorizontal: sidePadding }]}>
        <AITabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'chat' ? (
          <AIChatPanel role="THERAPIST" />
        ) : (
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            scrollEnabled
            bounces
            alwaysBounceVertical
            overScrollMode="always"
            contentContainerStyle={styles.scroll}
          >
            {tab === 'pricing' && <AIPricingBlock />}

            {tab === 'market' && (
              <>
                <AIMarketAnalysisCard />
                <AIPopularServices title="Services les plus demandés" />
              </>
            )}

            {tab === 'acceptance' && (
              <AIAcceptanceCard
                defaultBookingId={params.bookingId}
                defaultPrice={params.price}
              />
            )}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // minHeight: 0 est INDISPENSABLE sur le web : sans lui, un parent flex
  // grandit avec son contenu au lieu de laisser le ScrollView défiler.
  container: { flex: 1, minHeight: 0 },
  body: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingTop: spacing.md,
  },
  // Le ScrollView occupe tout l'espace restant sous les onglets et défile
  // verticalement (haut <-> bas) sur Android, iOS et web.
  scrollView: { flex: 1, minHeight: 0, width: '100%' },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
});

export default AIAssistantScreen;
