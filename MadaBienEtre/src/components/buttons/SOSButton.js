// src/components/buttons/SOSButton.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Linking,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';
import SOSService from '../../services/sosService';

const SOSButton = ({ bookingId, onSOSActivated, size = 'large' }) => {
  const { user, token } = useAuth();
  const { colors: themeColors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pulseAnim = useState(new Animated.Value(1))[0];

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

  React.useEffect(() => {
    startPulse();
    return () => pulseAnim.stopAnimation();
  }, []);

  const handleSOS = async () => {
    setModalVisible(false);
    setIsLoading(true);

    try {
      const sosService = new SOSService();
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

  const getSize = () => {
    if (size === 'small') {
      return { button: 48, icon: 24, textSize: 10 };
    }
    return { button: 64, icon: 32, textSize: 12 };
  };

  const sizeStyle = getSize();

  return (
    <>
      <TouchableOpacity
        style={[
          styles.sosButton,
          {
            width: sizeStyle.button,
            height: sizeStyle.button,
            borderRadius: sizeStyle.button / 2,
          },
        ]}
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
          {size === 'large' && (
            <Text style={[styles.sosText, { fontSize: sizeStyle.textSize }]}>SOS</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle" size={48} color={colors.error} />
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Confirmation SOS
              </Text>
            </View>

            <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
              Êtes-vous sûr de vouloir déclencher une alerte SOS ? 
              Notre équipe d'urgence sera immédiatement notifiée.
            </Text>

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
                <Text style={styles.confirmButtonText}>
                  {isLoading ? 'Envoi...' : 'Confirmer SOS'}
                </Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    borderRadius: 20,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.sm,
  },
  modalDescription: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
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