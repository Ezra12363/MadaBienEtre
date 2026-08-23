// src/components/common/CertificateProfessionnelSection.js
// ============================================================
// ✅ SECTION : CERTIFICAT PROFESSIONNEL (upload par le thérapeute)
// ============================================================
// Permet au thérapeute d'uploader son certificat professionnel
// (diplôme, attestation, certification) directement depuis le
// formulaire de mise à jour du profil.
//
// Ce document est distinct du certificat officiel généré
// automatiquement par la plateforme après validation admin.
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import therapistService from '../../services/therapistService';
import { useAuth } from '../../context/AuthContext';
// ✅ Sélecteur de fichier multi-plateforme (corrige l'upload sur le web)
import { pickImageOrPdf } from '../../utils/crossPlatformFilePicker';

// ============================================================
// BUILD FORMDATA (identique au pattern utilisé pour le CIN)
// ============================================================
const buildFileFormData = async (asset, fieldName, defaultBaseName) => {
  const formData = new FormData();

  const sourceName = asset?.name || asset?.uri || '';
  const uriParts = sourceName.split('.');
  const rawExt = (uriParts[uriParts.length - 1] || 'jpg').split('?')[0].toLowerCase();
  const ext = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(rawExt) ? rawExt : 'jpg';
  const mimeType =
    asset?.mimeType || (ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`);
  const filename = `${defaultBaseName}.${ext}`;

  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error('Impossible de lire le fichier sélectionné.');
    }
    const blob = await response.blob();
    formData.append(fieldName, blob, filename);
  } else {
    formData.append(fieldName, {
      uri: asset.uri,
      type: mimeType,
      name: filename,
    });
  }

  return formData;
};

const CertificateProfessionnelSection = ({
  certificateUrl,
  onCertificateUploaded,
  themeColors = {},
}) => {
  const [isUploading, setIsUploading] = useState(false);
  // ✅ Permet de synchroniser immédiatement l'utilisateur connecté
  // (AuthContext) après l'upload, pour que le certificat ne
  // "disparaisse" plus du profil tant que l'utilisateur n'a pas
  // cliqué sur "Enregistrer".
  const { refreshUser } = useAuth();

  const isPdf = certificateUrl && certificateUrl.toLowerCase().endsWith('.pdf');

  const handleViewDocument = () => {
    if (certificateUrl) {
      Linking.openURL(certificateUrl).catch(() => {
        Alert.alert('❌ Erreur', "Impossible d'ouvrir le document.");
      });
    }
  };

  const pickAndUploadCertificate = async () => {
    try {
      // ✅ Fonctionne aussi bien sur Android/iOS (choix Photo/PDF via
      // Alert) que sur le web (sélecteur de fichiers natif du
      // navigateur) — voir crossPlatformFilePicker.js
      const asset = await pickImageOrPdf({
        title: 'Ajouter le certificat professionnel',
        message: 'Choisissez la source du fichier',
      });

      if (!asset?.uri) {
        return;
      }

      setIsUploading(true);

      const formData = await buildFileFormData(asset, 'file', 'certificate_professionnel');
      const result = await therapistService.uploadCertificateProfessionnel(formData);

      if (!result.success) {
        Alert.alert('❌ Erreur', result.error || "Impossible d'envoyer le certificat professionnel.");
        return;
      }

      const newUrl = result.data?.certificate_professionnel || result.data?.url;

      if (newUrl && typeof onCertificateUploaded === 'function') {
        onCertificateUploaded(newUrl);
      }

      // ✅ Resynchronise l'utilisateur connecté (AuthContext) tout de
      // suite après l'upload, pour que le certificat reste visible
      // dans le profil même sans cliquer sur "Enregistrer", et après
      // une déconnexion / reconnexion.
      if (typeof refreshUser === 'function') {
        await refreshUser();
      }

      Alert.alert('✅ Succès', 'Votre certificat professionnel a été téléchargé avec succès.');
    } catch (error) {
      console.error('❌ pickAndUploadCertificate:', error);
      Alert.alert('❌ Erreur', "Une erreur est survenue lors de l'envoi du certificat professionnel.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.text }]}>Certificat professionnel</Text>
      <Text style={[styles.subLabel, { color: themeColors.textSecondary }]}>
        Diplôme, attestation ou certification professionnelle (JPG, PNG ou PDF)
      </Text>

      {certificateUrl ? (
        <TouchableOpacity onPress={handleViewDocument} activeOpacity={0.85} style={styles.previewWrapper}>
          {isPdf ? (
            <View style={[styles.pdfPreview, { backgroundColor: themeColors.background }]}>
              <Ionicons name="document-text-outline" size={30} color={colors.primary} />
              <Text style={[styles.pdfPreviewText, { color: themeColors.textSecondary }]}>
                Document PDF — Appuyer pour ouvrir
              </Text>
            </View>
          ) : (
            <Image source={{ uri: certificateUrl }} style={styles.previewImage} resizeMode="cover" />
          )}
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.uploadZone, { borderColor: colors.primary + '55' }]}
        onPress={pickAndUploadCertificate}
        disabled={isUploading}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          certificateUrl ? 'Remplacer le certificat professionnel' : 'Télécharger le certificat professionnel'
        }
      >
        {isUploading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={styles.uploadZoneContent}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            <Text style={[styles.uploadZoneText, { color: colors.primary }]}>
              {certificateUrl ? 'Remplacer le certificat' : 'Télécharger le certificat'}
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
  },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  pdfPreview: {
    height: 90,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pdfPreviewText: {
    fontSize: 11,
  },
  uploadZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadZoneContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadZoneText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default CertificateProfessionnelSection;