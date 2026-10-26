// src/screens/shared/PaymentMethodsScreen.js
//
// Page « Mode de paiement » (Profil) pour le THÉRAPEUTE (et réutilisable par l'admin) :
// configuration de la carte bancaire via le formulaire sécurisé Stripe.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Header from '../../components/common/Header';
import SavedCardsManager from '../../components/payment/SavedCardsManager';
import { useTheme } from '../../context/ThemeContext';

const GREEN = '#1F6B45';

export default function PaymentMethodsScreen() {
  const { colors: theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Mode de paiement" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.intro, { backgroundColor: theme.surface, borderColor: theme.border || '#E5E7EB' }]}>
          <View style={[styles.icon, { backgroundColor: `${GREEN}1A` }]}>
            <Ionicons name="card-outline" size={34} color={GREEN} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Ma carte bancaire</Text>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            Enregistrez votre carte une seule fois. Elle sera proposée automatiquement quand vous choisirez
            « Carte bancaire » (par exemple pour régler votre commission).
          </Text>
        </View>
        <SavedCardsManager mode="manage" hideTitle />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  intro: { alignItems: 'center', padding: 18, borderRadius: 18, borderWidth: 1, marginBottom: 16, gap: 6 },
  icon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800' },
  muted: { fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
});
