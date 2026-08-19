// src/components/sos/SOSButton.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Linking,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import sosService from '../../services/sosService';

const SOSButton = ({
  bookingId,
  onSOSActivated,
  size = 'large',
  showText = true,
  variant = 'full', // full, compact, icon
}) => {
  const { user, token } = useAuth();
  const { colors: themeColors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    startPulse();
    return () => pulseAnim.stopAnimation();
  }, []);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const getSize = () => {
    if (size === 'small') {
      return { button: 48, icon: 24, textSize: 10, padding: 8 };
    }
    return { button: 64, icon: 32, textSize: 12, padding: 12 };
  };

  const sizeStyle = getSize();

  const handleSOS = async () => {
    setModalVisible(false);
    setIsLoading(true);

    try {
      const result = await sosService.createSOSAlert({
        booking_id: bookingId,
        alert_type: 'emergency',
        details: 'Alerte SOS déclenchée',
        severity: 'critical',
      });

      if (result.success) {
        Alert.alert(
          '🚨 Alerte SOS envoyée',
          'Notre équipe a été informée et vous contacte dans les plus brefs délais.',
          [
            { 
              text: 'OK', 
              onPress: () => onSOSActivated && onSOSActivated() 
            },
          ]
        );
      } else {
        Alert.alert(
          'Erreur',
          'Impossible d\'envoyer l\'alerte SOS. Veuillez contacter les secours directement.',
          [
            { text: 'Appeler le 117', onPress: () => Linking.openURL('tel:117') },
            { text: 'Annuler', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Impossible d\'envoyer l\'alerte SOS.',
        [
          { text: 'Appeler le 117', onPress: () => Linking.openURL('tel:117') },
          { text: 'Annuler', style: 'cancel' },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderFullButton = () => (
    <TouchableOpacity
      style={[styles.sosButton, { width: sizeStyle.button, height: sizeStyle.button, borderRadius: sizeStyle.button / 2 }]}
      onPress={() => setModalVisible(true)}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: sizeStyle.button,
            height: sizeStyle.button,
            borderRadius: sizeStyle.button / 2,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <LinearGradient
        colors={['#D32F2F', '#E53935']}
        style={[
          styles.sosGradient,
          {
            width: sizeStyle.button - 4,
            height: sizeStyle.button - 4,
            borderRadius: (sizeStyle.button - 4) / 2,
          },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="alert-circle" size={sizeStyle.icon} color="#fff" />
        {showText && (
          <Text style={[styles.sosText, { fontSize: sizeStyle.textSize }]}>SOS</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderCompactButton = () => (
    <TouchableOpacity
      style={[styles.compactButton, { backgroundColor: colors.error }]}
      onPress={() => setModalVisible(true)}
      activeOpacity={0.7}
    >
      <Ionicons name="alert-circle" size={20} color="#fff" />
      {showText && <Text style={styles.compactText}>SOS</Text>}
    </TouchableOpacity>
  );

  const renderIconButton = () => (
    <TouchableOpacity
      style={[styles.iconButton, { backgroundColor: colors.error }]}
      onPress={() => setModalVisible(true)}
      activeOpacity={0.7}
    >
      <Ionicons name="alert-circle" size={24} color="#fff" />
    </TouchableOpacity>
  );

  const renderButton = () => {
    switch (variant) {
      case 'compact':
        return renderCompactButton();
      case 'icon':
        return renderIconButton();
      default:
        return renderFullButton();
    }
  };

  return (
    <>
      {renderButton()}

      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: themeColors.surface }]}>
            {/* Animation du pulse */}
            <View style={styles.modalHeader}>
              <Animated.View
                style={[
                  styles.modalPulse,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <View style={styles.modalIcon}>
                <Ionicons name="alert-circle" size={48} color={colors.error} />
              </View>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                🚨 Alerte SOS
              </Text>
            </View>

            <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
              Êtes-vous sûr de vouloir déclencher une alerte SOS ? 
              Notre équipe d'urgence sera immédiatement notifiée avec votre position GPS.
            </Text>

            <View style={styles.modalInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                  Position GPS envoyée
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                  Réponse immédiate
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="shield-outline" size={16} color={colors.primary} />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                  Sécurisé et confidentiel
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleSOS}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmer SOS</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.emergencyCall}
              onPress={() => Linking.openURL('tel:117')}
            >
              <Text style={styles.emergencyCallText}>
                📞 Appeler les secours (117)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  sosButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: colors.error + '40',
  },
  sosGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  sosText: {
    color: '#fff',
    fontFamily: typography.fontFamily.bold,
    marginTop: 2,
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    gap: spacing.xs,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  compactText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    borderRadius: 24,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 400,
    position: 'relative',
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
    position: 'relative',
  },
  modalPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.error + '10',
  },
  modalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
  },
  modalDescription: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  modalInfo: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  confirmButton: {
    backgroundColor: colors.error,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
  },
  emergencyCall: {
    marginTop: spacing.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  emergencyCallText: {
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
});

export default SOSButton;