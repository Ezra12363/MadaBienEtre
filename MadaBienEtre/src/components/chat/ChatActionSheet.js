// src/components/chat/ChatActionSheet.js
// Petit menu d'actions (⋮) : feuille en bas sur mobile, carte centrée sur le
// web large. Remplace Alert.alert (inopérant avec plusieurs boutons sur web).
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { typography } from '../../theme';

/**
 * actions: [{ key, label, icon, destructive?, onPress }]
 * Chaque action ferme d'abord le menu, puis s'exécute.
 */
const ChatActionSheet = ({ visible, title, subtitle, actions = [], onClose, palette }) => {
  const { width } = useWindowDimensions();
  const centered = Platform.OS === 'web' && width >= 700;

  return (
    <Modal
      visible={Boolean(visible)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: palette.overlay }, centered && styles.backdropCentered]}
        onPress={onClose}
        accessibilityLabel="Fermer le menu"
      >
        {/* Pressable interne : un appui dans la carte ne ferme pas le menu */}
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: palette.surface, borderColor: palette.border },
            centered ? styles.sheetCentered : styles.sheetBottom,
          ]}
          onPress={() => {}}
        >
          {(!!title || !!subtitle) && (
            <View style={styles.head}>
              {!!title && (
                <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                  {title}
                </Text>
              )}
              {!!subtitle && (
                <Text style={[styles.subtitle, { color: palette.textSecondary }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              )}
            </View>
          )}

          {actions.map((action) => {
            const color = action.destructive ? palette.danger : palette.text;
            return (
              <TouchableOpacity
                key={action.key}
                activeOpacity={0.7}
                style={[styles.action, { borderTopColor: palette.border }]}
                onPress={() => {
                  onClose?.();
                  // laisse le temps au Modal de se fermer (évite un conflit avec Alert / confirm)
                  setTimeout(() => action.onPress?.(), 60);
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: action.destructive ? palette.dangerSoft : palette.primarySoft },
                  ]}
                >
                  <Ionicons
                    name={action.icon || 'ellipse-outline'}
                    size={20}
                    color={action.destructive ? palette.danger : palette.primary}
                  />
                </View>
                <Text style={[styles.actionText, { color }]}>{action.label}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.action, styles.cancel, { borderTopColor: palette.border }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
          >
            <Text style={[styles.cancelText, { color: palette.textSecondary }]}>Annuler</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropCentered: { justifyContent: 'center', alignItems: 'center' },

  sheet: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sheetBottom: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 12 },
  sheetCentered: { width: 400, maxWidth: '92%', borderRadius: 18 },

  head: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  title: { fontSize: 16, fontFamily: typography.fontFamily.semiBold, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 3, fontFamily: typography.fontFamily.regular },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 15, fontFamily: typography.fontFamily.medium, fontWeight: '600' },

  cancel: { justifyContent: 'center' },
  cancelText: { flex: 1, textAlign: 'center', fontSize: 15, fontFamily: typography.fontFamily.medium },
});

export default ChatActionSheet;
