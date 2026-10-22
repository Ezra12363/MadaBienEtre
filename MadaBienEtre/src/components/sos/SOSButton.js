// src/components/sos/SOSButton.js
//
// Bouton SOS. Flux :
//   1. appui  -> fenêtre de CONFIRMATION (raison + GPS) : évite les tapes accidentelles ;
//   2. confirmation -> alerte envoyée (GPS + adresse) ;
//   3. fenêtre « Alerte envoyée » : ce qui a VRAIMENT été notifié, bouton
//      « Annuler (fausse alerte) », appel direct du 117, et partage de
//      position automatique tant que l'alerte est active.
//
// ⚠️ L'application prévient l'équipe admin, la contrepartie de la réservation
// et les contacts d'urgence — PAS la police ni les secours. Le texte le dit.
import { useState, useRef, useEffect, useCallback } from 'react';
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
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import { confirmAction, notify } from '../../utils/confirm';
import sosService, { SOS_REASONS as SERVICE_REASONS } from '../../services/sosService';

// Garde-fou : si l'ancien sosService est encore en place (sans SOS_REASONS),
// le bouton ne plante plus et utilise ces valeurs par défaut.
const SOS_REASONS =
  Array.isArray(SERVICE_REASONS) && SERVICE_REASONS.length
    ? SERVICE_REASONS
    : [
        { key: 'danger', label: 'Danger immédiat', icon: 'flash', alert_type: 'emergency', severity: 'critical' },
        { key: 'threat', label: 'Menace / agression', icon: 'warning', alert_type: null, severity: 'high' },
        { key: 'other', label: 'Autre problème', icon: 'help-circle', alert_type: 'other', severity: 'medium' },
      ];

const LOCATION_SHARE_INTERVAL_MS = 30000;
const LOCATION_SHARE_MAX_MS = 30 * 60 * 1000;
const SENT_VIEW_TTL_MS = 5 * 60 * 1000;

const SOSButton = ({
  bookingId,
  onSOSActivated,
  size = 'large',
  showText = true,
  variant = 'full', // full, compact, icon, hero
}) => {
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reasonKey, setReasonKey] = useState('danger');
  const [sent, setSent] = useState(null); // réponse du serveur une fois l'alerte envoyée
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shareTimer = useRef(null);
  const shareStartedAt = useRef(0);
  const sentAt = useRef(0);

  useEffect(() => {
    startPulse();
    return () => {
      pulseAnim.stopAnimation();
      stopSharing();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopSharing = () => {
    if (shareTimer.current) {
      clearInterval(shareTimer.current);
      shareTimer.current = null;
    }
  };

  // Partage de position : renvoie la dernière position toutes les 30 s
  // pendant l'alerte active (max 30 min).
  const startSharing = useCallback((sosId) => {
    stopSharing();
    shareStartedAt.current = Date.now();
    shareTimer.current = setInterval(() => {
      if (Date.now() - shareStartedAt.current > LOCATION_SHARE_MAX_MS) {
        stopSharing();
        return;
      }
      sosService.shareLocation(sosId).then((r) => {
        // 409 = alerte résolue/annulée côté serveur : on arrête.
        if (!r.success && /non active|déjà/i.test(r.error || '')) stopSharing();
      });
    }, LOCATION_SHARE_INTERVAL_MS);
  }, []);

  const getSize = () => {
    if (size === 'small') return { button: 48, icon: 24, textSize: 10, padding: 8 };
    return { button: 64, icon: 32, textSize: 12, padding: 12 };
  };
  const sizeStyle = getSize();

  const openModal = () => {
    // Alerte envoyée il y a moins de 5 min : on rouvre son suivi (annulation possible).
    // Au-delà, on repart sur un nouveau déclenchement.
    if (sent && Date.now() - sentAt.current > SENT_VIEW_TTL_MS) {
      setSent(null);
    }
    setReasonKey('danger');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const handleSOS = async () => {
    const reason = SOS_REASONS.find((r) => r.key === reasonKey) || SOS_REASONS[0];
    setIsLoading(true);
    try {
      const result = await sosService.createSOSAlert({
        booking_id: bookingId || undefined,
        alert_type: reason.alert_type || sosService.alertTypeForRole(user?.role),
        details: `Alerte SOS : ${reason.label}`,
        severity: reason.severity,
      });

      if (result.success) {
        sentAt.current = Date.now();
        setSent(result.data);
        startSharing(result.data.sos_id);
        if (onSOSActivated) onSOSActivated(result.data);
      } else {
        setModalVisible(false);
        Alert.alert(
          'Erreur',
          "Impossible d'envoyer l'alerte SOS. Veuillez contacter les secours directement.",
          [
            { text: 'Appeler le 117', onPress: () => Linking.openURL('tel:117') },
            { text: 'Annuler', style: 'cancel' },
          ]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAlert = () => {
    if (!sent) return;
    confirmAction({
      title: "Annuler l'alerte ?",
      message: "C'est une fausse alerte ? L'équipe sera prévenue de l'annulation.",
      confirmText: "Oui, j'annule",
      cancelText: 'Non, garder',
      destructive: true,
      onConfirm: async () => {
        setIsLoading(true);
        const r = await sosService.cancelSOSAlert(sent.sos_id, 'Fausse alerte');
        setIsLoading(false);
        if (r.success) {
          stopSharing();
          setSent(null);
          setModalVisible(false);
          notify('Alerte annulée', "L'équipe a été informée de l'annulation.");
        } else {
          notify('Erreur', r.error || "Impossible d'annuler l'alerte");
        }
      },
    });
  };

  const finishSent = () => {
    // Fermer sans annuler : l'alerte reste active, le partage de position continue.
    // (`sent` est conservé : rouvrir le bouton permet d'annuler pendant 5 min.)
    setModalVisible(false);
  };

  const renderFullButton = () => (
    <TouchableOpacity
      style={[styles.sosButton, { width: sizeStyle.button, height: sizeStyle.button, borderRadius: sizeStyle.button / 2 }]}
      onPress={openModal}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Bouton SOS urgence"
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
        {showText && <Text style={[styles.sosText, { fontSize: sizeStyle.textSize }]}>SOS</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderCompactButton = () => (
    <TouchableOpacity
      style={[styles.compactButton, { backgroundColor: colors.error }]}
      onPress={openModal}
      activeOpacity={0.7}
    >
      <Ionicons name="alert-circle" size={20} color="#fff" />
      {showText && <Text style={styles.compactText}>SOS</Text>}
    </TouchableOpacity>
  );

  const renderIconButton = () => (
    <TouchableOpacity
      style={[styles.iconButton, { backgroundColor: colors.error }]}
      onPress={openModal}
      activeOpacity={0.7}
    >
      <Ionicons name="alert-circle" size={24} color="#fff" />
    </TouchableOpacity>
  );

  const renderHeroButton = () => (
    <TouchableOpacity
      style={styles.heroContainer}
      onPress={openModal}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Déclencher une alerte SOS"
    >
      <Animated.View style={[styles.heroPulse, { transform: [{ scale: pulseAnim }] }]} />
      <LinearGradient
        colors={['#D32F2F', '#E53935']}
        style={styles.heroButton}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {sent ? (
          <View style={styles.heroContent}>
            <Ionicons name="checkmark-circle" size={48} color="#fff" />
            <Text style={styles.heroText}>ALERTE ENVOYÉE</Text>
          </View>
        ) : (
          <View style={styles.heroContent}>
            <Ionicons name="alert-circle" size={48} color="#fff" />
            <Text style={styles.heroText}>APPUYEZ EN URGENCE</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderButton = () => {
    switch (variant) {
      case 'hero':
        return renderHeroButton();
      case 'compact':
        return renderCompactButton();
      case 'icon':
        return renderIconButton();
      default:
        return renderFullButton();
    }
  };

  const renderConfirm = () => (
    <>
      <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
        Que se passe-t-il ? Notre équipe sera notifiée avec votre position GPS.
      </Text>

      <View style={styles.reasonsRow}>
        {SOS_REASONS.map((r) => {
          const active = r.key === reasonKey;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.reasonChip, active && styles.reasonChipActive]}
              onPress={() => setReasonKey(r.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={r.icon} size={20} color={active ? colors.error : themeColors.textSecondary} />
              <Text style={[styles.reasonText, { color: active ? colors.error : themeColors.text }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.modalInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
            Position GPS et adresse envoyées
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="people-outline" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
            Admin, contacts d'urgence{bookingId ? ' et votre réservation' : ''} prévenus
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="shield-outline" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
            Vous pourrez annuler en cas de fausse alerte
          </Text>
        </View>
      </View>

      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, styles.cancelButton]}
          onPress={closeModal}
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
    </>
  );

  const renderSent = () => (
    <>
      <View style={styles.sentBox}>
        <View style={styles.sentLine}>
          <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
          <Text style={[styles.sentText, { color: themeColors.text }]}>
            {sent.duplicate
              ? 'Une alerte est déjà active : elle a été renvoyée à notre équipe.'
              : 'Alerte enregistrée et transmise à notre équipe.'}
          </Text>
        </View>
        {sent.notified_admins > 0 && (
          <View style={styles.sentLine}>
            <Ionicons name="people" size={18} color={colors.primary} />
            <Text style={[styles.sentText, { color: themeColors.textSecondary }]}>
              {sent.notified_admins} administrateur(s) notifié(s)
            </Text>
          </View>
        )}
        {sent.notified_contacts > 0 && (
          <View style={styles.sentLine}>
            <Ionicons name="call" size={18} color={colors.primary} />
            <Text style={[styles.sentText, { color: themeColors.textSecondary }]}>
              {sent.notified_contacts} contact(s) d'urgence prévenu(s)
            </Text>
          </View>
        )}
        {sent.notified_counterpart && (
          <View style={styles.sentLine}>
            <Ionicons name="person" size={18} color={colors.primary} />
            <Text style={[styles.sentText, { color: themeColors.textSecondary }]}>
              L'autre personne de la réservation a été prévenue
            </Text>
          </View>
        )}
        <View style={styles.sentLine}>
          <Ionicons name="navigate" size={18} color={colors.primary} />
          <Text style={[styles.sentText, { color: themeColors.textSecondary }]}>
            Votre position est partagée tant que l'alerte est active
          </Text>
        </View>
      </View>

      <View style={styles.warnBox}>
        <Text style={styles.warnText}>
          ⚠️ La police et les secours ne sont PAS prévenus automatiquement. En danger
          immédiat, appelez le 117 vous-même.
        </Text>
      </View>

      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, styles.cancelButton]}
          onPress={handleCancelAlert}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <Text style={styles.cancelButtonText}>Fausse alerte</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalButton, styles.confirmButton]}
          onPress={() => Linking.openURL('tel:117')}
        >
          <Text style={styles.confirmButtonText}>📞 Appeler le 117</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.emergencyCall} onPress={finishSent}>
        <Text style={styles.emergencyCallText}>Fermer</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <>
      {renderButton()}

      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={sent ? finishSent : closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modalHeader}>
              <Animated.View style={[styles.modalPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.modalIcon}>
                <Ionicons
                  name={sent ? 'checkmark-circle' : 'alert-circle'}
                  size={48}
                  color={sent ? '#27AE60' : colors.error}
                />
              </View>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                {sent ? 'Alerte SOS envoyée' : '🚨 Alerte SOS'}
              </Text>
            </View>

            {sent ? renderSent() : renderConfirm()}

            {!sent && (
              <TouchableOpacity style={styles.emergencyCall} onPress={() => Linking.openURL('tel:117')}>
                <Text style={styles.emergencyCallText}>📞 Appeler les secours (117)</Text>
              </TouchableOpacity>
            )}
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

  heroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
  },
  heroPulse: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.error + '40',
  },
  heroButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 1,
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  reasonsRow: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  reasonChipActive: {
    borderColor: colors.error,
    backgroundColor: colors.error + '12',
  },
  reasonText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.medium,
  },
  sentBox: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sentLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sentText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
  warnBox: {
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: '#FFF4E5',
    marginBottom: spacing.md,
  },
  warnText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: '#8A5A00',
    lineHeight: 18,
  },
});

export default SOSButton;