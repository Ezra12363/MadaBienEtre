// src/components/common/CertificateProfessionnelSection.js
// ✅ Photo OU PDF du certificat professionnel — Android, iOS et Web.
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import { uploadFile } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { pickImageOrPdf } from '../../utils/crossPlatformFilePicker';
import { buildDocumentFormData } from '../../utils/documentUtils';
import { openDocument } from '../../utils/downloadFile';
import DocumentPreview from './DocumentPreview';

const CertificateProfessionnelSection = ({
  certificateUrl,
  onCertificateUploaded,
  themeColors = {},
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState(certificateUrl);
  const [previewFileName, setPreviewFileName] = useState(null);
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (!isUploading) setLocalPreview(certificateUrl);
  }, [certificateUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDocument = async () => {
    const res = await openDocument(localPreview);
    if (!res.success) Alert.alert('❌ Erreur', res.error);
  };

  const uploadCertificate = async () => {
    const previousUrl = localPreview;
    try {
      const asset = await pickImageOrPdf({
        title: 'Certificat professionnel',
        message: 'Sélectionnez le type de fichier pour votre certificat professionnel',
      });
      if (!asset?.uri) return;

      setIsUploading(true);

      const formData = await buildDocumentFormData(asset, 'certificat');

      setLocalPreview(asset.uri);
      setPreviewFileName(asset.name || null);

      const result = await uploadFile('/users/upload-certificate-professionnel', formData);

      if (result.error) {
        setLocalPreview(previousUrl);
        setPreviewFileName(null);
        Alert.alert('❌ Erreur', result.error.message || "Impossible d'envoyer le certificat.");
        return;
      }

      const newUrl = result.data?.certificate_professionnel;

      if (newUrl) {
        setLocalPreview(newUrl);
        if (typeof onCertificateUploaded === 'function') {
          onCertificateUploaded(newUrl);
        }
        if (typeof refreshUser === 'function') {
          await refreshUser();
        }
        Alert.alert('✅ Succès', 'Certificat professionnel téléchargé avec succès.');
      } else {
        Alert.alert('⚠️ Attention', "Fichier envoyé mais l'URL n'a pas été reçue.");
      }
    } catch (error) {
      console.error('❌ uploadCertificate error:', error);
      setLocalPreview(previousUrl);
      setPreviewFileName(null);
      Alert.alert('❌ Erreur', error.message || "Une erreur est survenue lors de l'envoi.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.text }]}>Certificat professionnel</Text>
      <Text style={[styles.subLabel, { color: themeColors.textSecondary }]}>
        Diplôme, attestation ou certification (PDF, JPG, PNG - max 10MB)
      </Text>

      {localPreview ? (
        <View style={styles.previewWrapper}>
          <DocumentPreview
            url={localPreview}
            fileName={previewFileName}
            height={200}
            onPress={handleViewDocument}
            themeColors={themeColors}
            forcePdf={/\.pdf$/i.test(previewFileName || '')}
          />
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.uploadZone, { borderColor: colors.primary + '55' }]}
        onPress={uploadCertificate}
        disabled={isUploading}
        activeOpacity={0.7}
      >
        {isUploading ? (
          <View style={styles.uploadZoneContent}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.uploadZoneText, { color: colors.primary }]}>
              Envoi en cours...
            </Text>
          </View>
        ) : (
          <View style={styles.uploadZoneContent}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            <Text style={[styles.uploadZoneText, { color: colors.primary }]}>
              {localPreview ? 'Remplacer le certificat' : 'Télécharger le certificat'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 2,
  },
  subLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.sm,
  },
  previewWrapper: {
    marginBottom: spacing.sm,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  pdfPreview: {
    height: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pdfPreviewText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pdfPreviewSubText: {
    fontSize: 11,
  },
  uploadZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 43, 126, 0.04)',
  },
  uploadZoneContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  uploadZoneText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default CertificateProfessionnelSection;