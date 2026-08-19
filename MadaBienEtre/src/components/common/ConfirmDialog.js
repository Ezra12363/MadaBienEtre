// src/components/common/ConfirmDialog.js
//
// ============================================================
// CONFIRM DIALOG — Web + Android / iOS
// ============================================================
// ✅ Remplace Alert.alert()
// ✅ Compatible React Native Web
// ✅ Animation d'ouverture
// ✅ Backdrop cliquable
// ✅ Icône personnalisable
// ✅ Support danger / warning / info
// ✅ Support loading
// ✅ Responsive Web / Mobile
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../../theme';

const IS_WEB = Platform.OS === 'web';

const TONE = {
  danger: {
    bg: '#DC2626',
    icon: 'trash-outline',
  },

  warning: {
    bg: '#F59E0B',
    icon: 'warning-outline',
  },

  info: {
    bg: '#2563EB',
    icon: 'information-circle-outline',
  },

  logout: {
    bg: '#E53935',
    icon: 'log-out-outline',
  },
};

export default function ConfirmDialog({
  visible = false,
  title = 'Confirmation',
  message = '',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',

  // ✅ Nouveau :
  // permet de remplacer l'icône définie par le tone
  icon = null,

  loading = false,
  onConfirm,
  onCancel,
  themeColors,
}) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const config = TONE[tone] || TONE.danger;

  // ✅ Icône finale :
  // icon personnalisé > icône du tone
  const finalIcon = icon || config.icon;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 9,
          tension: 90,
          useNativeDriver: true,
        }),

        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.92);
      opacity.setValue(0);
    }
  }, [visible, opacity, scale]);

  const handleBackdropPress = () => {
    if (!loading && onCancel) {
      onCancel();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={handleBackdropPress}
      >
        <Animated.View
          style={[
            styles.card,

            {
              backgroundColor:
                themeColors?.surface || '#FFFFFF',

              opacity,

              transform: [
                {
                  scale,
                },
              ],
            },
          ]}
        >
          {/* =====================================================
              CONTENU DU MODAL
          ===================================================== */}

          <Pressable
            onPress={(event) => {
              // Empêche la propagation vers le backdrop
              event?.stopPropagation?.();
            }}
          >
            {/* =================================================
                ICÔNE
            ================================================= */}
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: `${config.bg}18`,
                },
              ]}
            >
              <Ionicons
                name={finalIcon}
                size={28}
                color={config.bg}
              />
            </View>

            {/* =================================================
                TITRE
            ================================================= */}
            <Text
              style={[
                styles.title,
                {
                  color:
                    themeColors?.text ||
                    '#0F172A',
                },
              ]}
            >
              {title}
            </Text>

            {/* =================================================
                MESSAGE
            ================================================= */}
            {!!message && (
              <Text
                style={[
                  styles.message,
                  {
                    color:
                      themeColors?.textSecondary ||
                      '#64748B',
                  },
                ]}
              >
                {message}
              </Text>
            )}

            {/* =================================================
                BOUTONS
            ================================================= */}
            <View style={styles.actions}>
              {/* ANNULER */}
              <TouchableOpacity
                onPress={onCancel}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                style={[
                  styles.button,
                  styles.cancelButton,
                  {
                    borderColor:
                      themeColors?.border ||
                      '#E2E8F0',

                    opacity: loading ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cancelText,
                    {
                      color:
                        themeColors?.text ||
                        '#0F172A',
                    },
                  ]}
                >
                  {cancelLabel}
                </Text>
              </TouchableOpacity>

              {/* CONFIRMER */}
              <TouchableOpacity
                onPress={onConfirm}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                style={[
                  styles.button,
                  styles.confirmButton,
                  {
                    backgroundColor: config.bg,
                    opacity: loading ? 0.7 : 1,
                  },
                ]}
              >
                {loading ? (
                  <View style={styles.loadingContent}>
                    <Animated.View
                      style={[
                        styles.loadingDot,
                        {
                          backgroundColor: '#FFFFFF',
                        },
                      ]}
                    />
                    <Text style={styles.confirmText}>
                      Traitement...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.confirmContent}>
                    <Ionicons
                      name={
                        tone === 'logout'
                          ? 'log-out-outline'
                          : 'checkmark-outline'
                      }
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text style={styles.confirmText}>
                      {confirmLabel}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ============================================================
  // BACKDROP
  // ============================================================

  backdrop: {
    flex: 1,

    backgroundColor:
      'rgba(15,23,42,0.52)',

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },

  // ============================================================
  // CARD
  // ============================================================

  card: {
    width: '100%',
    maxWidth: 400,

    borderRadius: 22,

    padding: spacing.lg,

    ...(IS_WEB
      ? {
          boxShadow:
            '0 24px 70px rgba(0,0,0,0.28)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 10,
          },
          shadowOpacity: 0.22,
          shadowRadius: 22,
          elevation: 12,
        }),
  },

  // ============================================================
  // ICON
  // ============================================================

  iconWrap: {
    width: 58,
    height: 58,

    borderRadius: 18,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: spacing.md,
  },

  // ============================================================
  // TITLE
  // ============================================================

  title: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,

    marginBottom: 7,
  },

  // ============================================================
  // MESSAGE
  // ============================================================

  message: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,

    lineHeight: 21,

    marginBottom: spacing.lg,
  },

  // ============================================================
  // ACTIONS
  // ============================================================

  actions: {
    flexDirection: 'row',

    gap: spacing.sm,

    width: '100%',
  },

  button: {
    flex: 1,

    minHeight: 46,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: spacing.sm,
  },

  // ============================================================
  // CANCEL
  // ============================================================

  cancelButton: {
    borderWidth: 1,

    backgroundColor: 'transparent',
  },

  cancelText: {
    fontSize: typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  // ============================================================
  // CONFIRM
  // ============================================================

  confirmButton: {
    borderWidth: 0,
  },

  confirmContent: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 7,
  },

  confirmText: {
    color: '#FFFFFF',

    fontSize: typography.fontSize.sm,

    fontFamily:
      typography.fontFamily.semiBold,
  },

  // ============================================================
  // LOADING
  // ============================================================

  loadingContent: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,
  },

  loadingDot: {
    width: 8,
    height: 8,

    borderRadius: 4,
  },
});