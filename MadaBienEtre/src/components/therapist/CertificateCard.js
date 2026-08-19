import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  colors,
  spacing,
  typography,
} from '../../theme';

import therapistService from '../../services/therapistService';

// ✅ Import pour récupérer le token
import { useAuth } from '../../context/AuthContext';


const CertificateCard = () => {

  const { token } = useAuth();  // <-- Récupérer le token

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    verification,
    setVerification,
  ] = useState(null);


  // ==========================================================
  // CHARGER
  // ==========================================================

  const loadVerification = useCallback(
    async () => {

      setLoading(true);

      try {

        const result =
          await therapistService
            .getMyVerificationStatus();

        if (result.success) {

          setVerification(
            result.data
          );

        } else {

          setVerification(null);
        }

      } catch (error) {

        console.error(
          'CertificateCard:',
          error
        );

        setVerification(null);

      } finally {

        setLoading(false);
      }

    },
    []
  );


  useEffect(() => {
    loadVerification();
  }, [loadVerification]);


  // ==========================================================
  // DOWNLOAD — AVEC TOKEN DANS L'URL
  // ==========================================================

  const handleDownload = async () => {

    try {

      // ✅ Récupérer le baseUrl depuis les variables d'environnement
      const baseUrl =
        process.env.EXPO_PUBLIC_API_URL ||
        'http://localhost:8000';

      // ✅ S'assurer que le baseUrl n'a pas de slash à la fin
      const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

      const relativeUrl =
        therapistService
          .getCertificateDownloadUrl();

      // ✅ Construire l'URL complète avec le token
      const url =
        `${cleanBaseUrl}${relativeUrl}?token=${token}`;

      console.log('📥 Téléchargement du certificat:', url);

      // ✅ Vérifier que le token existe
      if (!token) {
        Alert.alert(
          'Erreur d\'authentification',
          'Vous devez être connecté pour télécharger votre certificat.'
        );
        return;
      }

      if (Platform.OS === 'web') {

        // ✅ Web : ouvrir dans un nouvel onglet
        window.open(
          url,
          '_blank',
          'noopener,noreferrer'
        );

      } else {

        // ✅ Mobile : vérifier si l'URL peut être ouverte
        const canOpen = await Linking.canOpenURL(url);
        
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert(
            'Erreur',
            'Impossible d\'ouvrir le lien. Vérifiez votre connexion internet.'
          );
        }
      }

    } catch (error) {

      console.error(
        '❌ Download certificate:',
        error
      );

      Alert.alert(
        'Erreur de téléchargement',
        'Une erreur est survenue lors du téléchargement du certificat. Veuillez réessayer.'
      );
    }
  };


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <View
        style={[
          styles.card,
          styles.loadingCard,
        ]}
      >
        <ActivityIndicator
          size="small"
          color={colors.primary}
        />

        <Text style={styles.loadingText}>
          Vérification du certificat...
        </Text>
      </View>
    );
  }


  if (!verification) {
    return null;
  }


  // ==========================================================
  // PENDING
  // ==========================================================

  if (
    verification.status ===
    'pending'
  ) {

    return (
      <View
        style={[
          styles.card,
          styles.pendingCard,
        ]}
      >

        <View style={styles.iconCircle}>
          <Ionicons
            name="time-outline"
            size={28}
            color="#F5A623"
          />
        </View>

        <Text
          style={styles.pendingTitle}
        >
          Vérification en cours
        </Text>

        <Text
          style={styles.pendingText}
        >
          Votre dossier est actuellement
          examiné par notre équipe
          d'administration.
        </Text>

      </View>
    );
  }


  // ==========================================================
  // REJECTED
  // ==========================================================

  if (
    verification.status ===
    'rejected'
  ) {

    return (
      <View
        style={[
          styles.card,
          styles.rejectedCard,
        ]}
      >

        <View style={styles.iconCircle}>
          <Ionicons
            name="close-circle-outline"
            size={28}
            color="#E53935"
          />
        </View>

        <Text
          style={styles.rejectedTitle}
        >
          Profil non validé
        </Text>

        {verification.rejection_reason && (
          <Text
            style={styles.rejectedText}
          >
            Motif :{' '}
            {verification.rejection_reason}
          </Text>
        )}

      </View>
    );
  }


  // ==========================================================
  // APPROVED
  // ==========================================================

  return (
    <View
      style={[
        styles.card,
        styles.approvedCard,
      ]}
    >

      <View style={styles.approvedHeader}>

        <View
          style={[
            styles.iconCircle,
            styles.approvedIcon,
          ]}
        >

          <Ionicons
            name="checkmark-circle"
            size={30}
            color="#00C853"
          />

        </View>

        <View style={styles.approvedHeaderText}>

          <Text
            style={styles.approvedTitle}
          >
            Profil vérifié
          </Text>

          <Text
            style={styles.approvedSubtitle}
          >
            Votre compte professionnel
            a été validé.
          </Text>

        </View>

      </View>


      {verification.certificate && (

        <View style={styles.certificateBox}>

          <View style={styles.certificateIcon}>

            <Ionicons
              name="document-text-outline"
              size={24}
              color={colors.primary}
            />

          </View>

          <View style={styles.certificateInfo}>

            <Text
              style={styles.certificateLabel}
            >
              Certificat professionnel
            </Text>

            <Text
              style={styles.certificateNumber}
            >
              {
                verification
                  .certificate
                  .number
              }
            </Text>

            <Text
              style={styles.certificateDate}
            >
              Délivré le{' '}
              {new Date(
                verification
                  .certificate
                  .issued_at
              ).toLocaleDateString(
                'fr-FR'
              )}
            </Text>

          </View>

        </View>
      )}


      {verification.certificate && (

        <TouchableOpacity
          style={styles.downloadButton}
          onPress={handleDownload}
          activeOpacity={0.85}
        >

          <Ionicons
            name="download-outline"
            size={20}
            color="#FFFFFF"
          />

          <Text
            style={styles.downloadText}
          >
            Télécharger le certificat
          </Text>

        </TouchableOpacity>
      )}

    </View>
  );
};


const styles = StyleSheet.create({

  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
  },

  loadingCard: {
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },

  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666666',
  },

  pendingCard: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
    alignItems: 'center',
  },

  rejectedCard: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
    alignItems: 'center',
  },

  approvedCard: {
    backgroundColor: '#F1FFF6',
    borderColor: '#B9F6CA',
  },

  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  approvedIcon: {
    backgroundColor: '#E8F5E9',
  },

  pendingTitle: {
    marginTop: 10,
    fontSize: 16,
    fontFamily:
      typography.fontFamily.bold,
    color: '#F5A623',
  },

  pendingText: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 19,
    color: '#795548',
  },

  rejectedTitle: {
    marginTop: 10,
    fontSize: 16,
    fontFamily:
      typography.fontFamily.bold,
    color: '#E53935',
  },

  rejectedText: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#B71C1C',
  },

  approvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  approvedHeaderText: {
    flex: 1,
    marginLeft: 12,
  },

  approvedTitle: {
    fontSize: 17,
    fontFamily:
      typography.fontFamily.bold,
    color: '#087F23',
  },

  approvedSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    color: '#388E3C',
  },

  certificateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },

  certificateIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      colors.primary + '12',
  },

  certificateInfo: {
    flex: 1,
    marginLeft: 12,
  },

  certificateLabel: {
    fontSize: 11,
    color: '#777777',
  },

  certificateNumber: {
    marginTop: 3,
    fontSize: 15,
    fontFamily:
      typography.fontFamily.bold,
    color: colors.primary,
  },

  certificateDate: {
    marginTop: 3,
    fontSize: 10,
    color: '#888888',
  },

  downloadButton: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },

  downloadText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily:
      typography.fontFamily.semiBold,
  },

});


export default CertificateCard;