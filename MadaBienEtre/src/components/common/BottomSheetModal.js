// src/components/common/BottomSheetModal.js
//
// ✏️ NOUVEAU — Fenêtre modale « bottom sheet » commune (Web + Android + iOS) :
//   • s'ouvre depuis le BAS de l'écran (slide) ;
//   • ✏️ MODIFIÉ : sur le WEB elle s'affiche CENTRÉE au milieu de l'écran (fondu, largeur max 560 px) ;
//     sur Android / iOS elle reste en bas de l'écran (slide) ;
//   • fond sombre cliquable pour fermer, bouton ✕, bouton retour Android ;
//   • contenu défilable si trop haut (max 88 % de l'écran) ;
//   • zone sûre en bas (barre de gestes) respectée.
// Utilisée par « Statut du paiement » (client + thérapeute).
import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';

/**
 * @param {{
 *  visible: boolean, onClose: () => void, title?: string,
 *  right?: React.ReactNode,           // ex. badge de statut, à droite du titre
 *  maxWidth?: number, children?: React.ReactNode
 * }} props
 */
export default function BottomSheetModal({ visible, onClose, title, right, maxWidth = 560, children }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme?.() || {};
  const tc = { text: '#222', textSecondary: '#777', border: '#E5E5E5', surface: '#FFFFFF', ...(theme.colors || {}) };

  // Sur le web, un clic dans le modal ne doit pas « remonter » jusqu'à la carte parente (qui ouvrirait le détail).
  const isWeb = Platform.OS === 'web';
  const webStop = Platform.OS === 'web' ? { onClick: (e) => e.stopPropagation() } : {};

  return (
    <Modal visible={visible} transparent animationType={isWeb ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, isWeb && styles.rootWeb]} {...webStop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View
          style={[
            styles.sheet,
            isWeb && styles.sheetWeb,
            { backgroundColor: tc.surface || '#fff', maxHeight: Math.round(height * (isWeb ? 0.9 : 0.88)), maxWidth },
          ]}
        >
          {!isWeb ? <View style={styles.handle} /> : null}
          <View style={[styles.header, { borderBottomColor: tc.border }]}>
            <Text style={[styles.title, { color: tc.text }]} numberOfLines={1}>
              {title}
            </Text>
            {right ? <View style={styles.right}>{right}</View> : null}
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Ionicons name="close" size={20} color={tc.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: 16 + (isWeb ? 0 : insets?.bottom || 0) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  // ✏️ NOUVEAU : web → centrée verticalement et horizontalement, avec marge autour
  rootWeb: { justifyContent: 'center', padding: 16 },
  sheetWeb: { borderRadius: 20, maxWidth: 560 },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DA', marginTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600' },
  right: { flexShrink: 0 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F5' },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
});
