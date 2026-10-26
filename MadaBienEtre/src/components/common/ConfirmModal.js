// src/components/common/ConfirmModal.js
// Vraie fenêtre de confirmation (web + mobile) : remplace window.confirm / Alert.alert.
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const ConfirmModal = ({
  visible,
  title,
  message,
  icon = 'help-circle',
  iconColor = colors.primary,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  confirmColor = colors.primary,
  loading = false,
  children, // contenu optionnel (ex : aperçu du message)
  onConfirm,
  onCancel,
}) => {
  const { colors: themeColors } = useTheme();
  const { width } = useWindowDimensions();
  const boxWidth = Math.min(width * 0.92, 460);

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={loading ? undefined : onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.box, { width: boxWidth, backgroundColor: themeColors.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={icon} size={38} color={iconColor} />
          </View>
          <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
          {!!message && <Text style={[styles.message, { color: themeColors.textSecondary }]}>{message}</Text>}
          {children}
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: confirmColor, opacity: loading ? 0.7 : 1 }]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{confirmText}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  box: { borderRadius: 20, padding: spacing.lg, alignItems: 'center', elevation: 12 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, textAlign: 'center' },
  message: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, width: '100%' },
  btn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: '#EEEEEE' },
  cancelText: { color: '#444', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.medium },
  confirmText: { color: '#fff', fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold },
});

export default ConfirmModal;
