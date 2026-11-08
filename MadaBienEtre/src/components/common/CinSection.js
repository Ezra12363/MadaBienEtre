// src/components/common/CinSection.js
// ✅ Photo OU PDF du CIN — même flux sur Android, iOS et Web.
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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

const CinSection = ({
  cinNumber,
  onChangeCinNumber,
  cinImageUrl,
  onCinImageUploaded,
  themeColors,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState(cinImageUrl);
  const [previewFileName, setPreviewFileName] = useState(null);
  const { refreshUser } = useAuth();

  // Le profil se charge souvent APRÈS le montage : on suit la prop.
  useEffect(() => {
    if (!isUploading) setLocalPreview(cinImageUrl);
  }, [cinImageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDocument = async () => {
    const res = await openDocument(localPreview);
    if (!res.success) Alert.alert('❌ Erreur', res.error);
  };

  const uploadCin = async () => {
    const previousUrl = localPreview;
    try {
      const asset = await pickImageOrPdf({
        title: 'Ajouter le CIN',
        message: "Sélectionnez le type de fichier pour votre pièce d'identité",
      });
      if (!asset?.uri) return;

      setIsUploading(true);

      const formData = await buildDocumentFormData(asset, 'cin');

      // Aperçu local immédiat (image ou PDF)
      setLocalPreview(asset.uri);
      setPreviewFileName(asset.name || null);

      const { data, error } = await uploadFile('/users/upload-cin', formData);

      if (error) {
        setLocalPreview(previousUrl);
        setPreviewFileName(null);
        Alert.alert('❌ Erreur', error.message || "Impossible d'envoyer le CIN");
        return;
      }

      if (data?.identity_document_url) {
        setLocalPreview(data.identity_document_url);
        if (typeof onCinImageUploaded === 'function') {
          onCinImageUploaded(data.identity_document_url);
        }
        if (typeof refreshUser === 'function') {
          await refreshUser();
        }
        Alert.alert('✅ Succès', 'CIN téléchargé avec succès');
      }
    } catch (e) {
      console.error('❌ uploadCin error:', e);
      setLocalPreview(previousUrl);
      setPreviewFileName(null);
      Alert.alert('❌ Erreur', e?.message || "Impossible d'envoyer le CIN");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.inputLabel, { color: themeColors.text }]}>
        🪪 Numéro CIN
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            color: themeColors.text,
            borderColor: themeColors.border || '#E0E0E0',
          },
        ]}
        value={cinNumber}
        onChangeText={onChangeCinNumber}
        placeholder="Ex: 101 234 567 890"
        placeholderTextColor={themeColors.textSecondary}
        keyboardType="default"
      />

      {localPreview ? (
        <View style={styles.previewWrapper}>
          <DocumentPreview
            url={localPreview}
            fileName={previewFileName}
            height={220}
            onPress={handleViewDocument}
            themeColors={themeColors}
            forcePdf={/\.pdf$/i.test(previewFileName || '')}
          />
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.uploadButton}
        onPress={uploadCin}
        disabled={isUploading}
        activeOpacity={0.8}
      >
        {isUploading ? (
          <View style={styles.uploadButtonContent}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.uploadButtonText}>Envoi en cours...</Text>
          </View>
        ) : (
          <View style={styles.uploadButtonContent}>
            <Ionicons name="camera-outline" size={20} color="#fff" />
            <Text style={styles.uploadButtonText}>
              {localPreview ? 'Remplacer le CIN' : 'Uploader mon CIN'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  previewWrapper: {
    marginTop: spacing.sm,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    // ✅ Hauteur généreuse + resizeMode "contain" : l'image entière
    // est toujours visible, jamais rognée, quel que soit son format
    // (portrait ou paysage) — sur Android comme sur le web.
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  pdfPreview: {
    height: 110,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: spacing.md,
  },
  pdfPreviewText: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: '90%',
  },
  pdfPreviewSubText: {
    fontSize: 11,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: spacing.sm,
    minHeight: 48,
  },
  uploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
  },
});

export default CinSection;