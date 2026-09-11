// src/components/common/CertificateProfessionnelSection.js
import React, { useState, useRef } from 'react';
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
import { uploadFile } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const CertificateProfessionnelSection = ({
  certificateUrl,
  onCertificateUploaded,
  themeColors = {},
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState(certificateUrl);
  const { refreshUser } = useAuth();
  const objectUrlRef = useRef(null);

  const isPdf = localPreview && localPreview.toLowerCase().endsWith('.pdf');

  const handleViewDocument = () => {
    if (localPreview) {
      Linking.openURL(localPreview).catch(() => {
        Alert.alert('❌ Erreur', "Impossible d'ouvrir le document.");
      });
    }
  };

  // ✅ Nettoyer les URLs objet pour éviter les memory leaks
  const cleanupObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  // ✅ Sélection de fichier multi-plateforme
  const pickFile = async () => {
    try {
      // ✅ Nettoyer l'ancienne URL objet avant d'en créer une nouvelle
      cleanupObjectUrl();

      if (Platform.OS === 'web') {
        // ✅ Web: input file natif
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.jpg,.jpeg,.png,.webp';
          input.multiple = false;
          
          input.onchange = (event) => {
            const file = event.target.files?.[0];
            if (file) {
              // ✅ Vérifier la taille du fichier (max 10MB)
              if (file.size > 10 * 1024 * 1024) {
                Alert.alert('⚠️ Erreur', 'Le fichier est trop volumineux (max 10MB)');
                resolve(null);
                return;
              }
              
              // ✅ Créer l'URL objet et la stocker pour nettoyage ultérieur
              const fileUrl = URL.createObjectURL(file);
              objectUrlRef.current = fileUrl;
              
              resolve({
                uri: fileUrl,
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                file: file,
              });
            } else {
              resolve(null);
            }
            // ✅ Nettoyer l'input après utilisation
            input.value = '';
          };

          // ✅ Gérer l'annulation
          input.oncancel = () => {
            resolve(null);
          };

          input.click();
        });
      } else if (Platform.OS === 'android' || Platform.OS === 'ios') {
        // ✅ Sur mobile: utiliser DocumentPicker pour PDF et ImagePicker pour les photos
        // Afficher un choix pour l'utilisateur
        return new Promise((resolve) => {
          Alert.alert(
            'Choisir un fichier',
            'Sélectionnez le type de fichier pour votre certificat professionnel',
            [
              {
                text: 'Photo / Image',
                onPress: async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: false,
                    quality: 0.8,
                  });
                  
                  if (!result.canceled && result.assets?.[0]) {
                    const asset = result.assets[0];
                    resolve({
                      uri: asset.uri,
                      name: asset.fileName || 'certificat.jpg',
                      type: asset.mimeType || 'image/jpeg',
                      size: asset.fileSize || 0,
                    });
                  } else {
                    resolve(null);
                  }
                },
              },
              {
                text: 'PDF / Document',
                onPress: async () => {
                  const result = await DocumentPicker.getDocumentAsync({
                    type: ['application/pdf', 'image/*'],
                    copyToCacheDirectory: true,
                  });
                  
                  if (!result.canceled && result.assets?.[0]) {
                    const asset = result.assets[0];
                    // ✅ Vérifier la taille
                    if (asset.size && asset.size > 10 * 1024 * 1024) {
                      Alert.alert('⚠️ Erreur', 'Le fichier est trop volumineux (max 10MB)');
                      resolve(null);
                      return;
                    }
                    resolve({
                      uri: asset.uri,
                      name: asset.name || 'certificat.pdf',
                      type: asset.mimeType || 'application/pdf',
                      size: asset.size || 0,
                    });
                  } else {
                    resolve(null);
                  }
                },
              },
              {
                text: 'Annuler',
                style: 'cancel',
                onPress: () => resolve(null),
              },
            ],
            { cancelable: true }
          );
        });
      } else {
        return null;
      }
    } catch (error) {
      console.error('❌ pickFile error:', error);
      return null;
    }
  };

  const uploadCertificate = async () => {
    try {
      const fileData = await pickFile();

      if (!fileData?.uri) {
        return;
      }

      setIsUploading(true);

      const formData = new FormData();

      if (Platform.OS === 'web') {
        // ✅ Web: utiliser le fichier directement
        if (fileData.file) {
          formData.append('file', fileData.file, fileData.name);
        } else {
          // Fallback: récupérer le blob
          const response = await fetch(fileData.uri);
          const blob = await response.blob();
          formData.append('file', blob, fileData.name);
        }
      } else {
        // ✅ Mobile: utiliser l'URI
        formData.append('file', {
          uri: fileData.uri,
          type: fileData.type || 'application/octet-stream',
          name: fileData.name || 'certificat.pdf',
        });
      }

      // ✅ Afficher une preview locale immédiatement
      setLocalPreview(fileData.uri);

      // ✅ Upload avec gestion d'erreur améliorée
      const result = await uploadFile('/users/upload-certificate-professionnel', formData);

      if (result.error) {
        // ✅ Si erreur, revenir à l'ancienne URL
        setLocalPreview(certificateUrl);
        Alert.alert('❌ Erreur', result.error.message || "Impossible d'envoyer le certificat.");
        return;
      }

      const newUrl = result.data?.certificate_professionnel;

      if (newUrl) {
        // ✅ Nettoyer le blob:// temporaire, remplacé par l'URL
        // définitive du serveur.
        cleanupObjectUrl();
        // ✅ Mettre à jour avec l'URL finale du serveur
        setLocalPreview(newUrl);
        if (typeof onCertificateUploaded === 'function') {
          onCertificateUploaded(newUrl);
        }
        // ✅ Rafraîchir l'utilisateur
        if (typeof refreshUser === 'function') {
          await refreshUser();
        }
        Alert.alert('✅ Succès', 'Certificat professionnel téléchargé avec succès.');
      } else {
        // ✅ Si pas d'URL dans la réponse, garder la preview locale
        Alert.alert('⚠️ Attention', 'Fichier envoyé mais l\'URL n\'a pas été reçue.');
      }
    } catch (error) {
      console.error('❌ uploadCertificate error:', error);
      // ✅ Revenir à l'ancienne URL en cas d'erreur
      setLocalPreview(certificateUrl);
      Alert.alert('❌ Erreur', error.message || "Une erreur est survenue lors de l'envoi.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReplaceCertificate = () => {
    // ✅ Nettoyer l'ancienne URL objet avant de remplacer
    cleanupObjectUrl();
    uploadCertificate();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.text }]}>Certificat professionnel</Text>
      <Text style={[styles.subLabel, { color: themeColors.textSecondary }]}>
        Diplôme, attestation ou certification (PDF, JPG, PNG - max 10MB)
      </Text>

      {localPreview ? (
        <TouchableOpacity 
          onPress={handleViewDocument} 
          activeOpacity={0.85} 
          style={styles.previewWrapper}
        >
          {isPdf ? (
            <View style={[styles.pdfPreview, { backgroundColor: themeColors.background }]}>
              <Ionicons name="document-text-outline" size={40} color={colors.primary} />
              <Text style={[styles.pdfPreviewText, { color: themeColors.textSecondary }]}>
                {localPreview.split('/').pop() || 'Document PDF'}
              </Text>
              <Text style={[styles.pdfPreviewSubText, { color: themeColors.textSecondary }]}>
                Appuyer pour ouvrir
              </Text>
            </View>
          ) : (
            <Image source={{ uri: localPreview }} style={styles.previewImage} resizeMode="cover" />
          )}
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.uploadZone, { borderColor: colors.primary + '55' }]}
        onPress={handleReplaceCertificate}
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