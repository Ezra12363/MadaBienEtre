// src/components/common/CinSection.js
import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

// Types acceptés par le backend pour /users/upload-cin
// (voir users.py : allowed_types = [image/jpeg, image/png, image/webp, application/pdf])
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
  const objectUrlRef = useRef(null);

  const isPdf = localPreview && localPreview.toLowerCase().split('?')[0].endsWith('.pdf');

  const cleanupObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const handleViewDocument = () => {
    if (localPreview) {
      Linking.openURL(localPreview).catch(() => {
        Alert.alert('❌ Erreur', "Impossible d'ouvrir le document.");
      });
    }
  };

  // ============================================================
  // ✅ SÉLECTION DE FICHIER — Photo OU PDF, sur Android/iOS ET Web
  // ============================================================
  const pickFile = async () => {
    try {
      cleanupObjectUrl();

      if (Platform.OS === 'web') {
        // ✅ Web : le sélecteur natif du navigateur accepte à la fois
        // les images et les PDF en un seul clic (l'utilisateur peut
        // naviguer vers ses Photos ou ses Documents librement).
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.jpg,.jpeg,.png,.webp';
          input.multiple = false;

          input.onchange = (event) => {
            const file = event.target.files?.[0];
            if (file) {
              if (file.size > MAX_FILE_SIZE) {
                Alert.alert('⚠️ Erreur', 'Le fichier est trop volumineux (max 10MB)');
                resolve(null);
                return;
              }
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
            input.value = '';
          };

          input.oncancel = () => resolve(null);
          input.click();
        });
      }

      // ✅ Android / iOS : proposer explicitement Photo OU PDF,
      // exactement comme pour le certificat professionnel.
      return new Promise((resolve) => {
        Alert.alert(
          'Ajouter le CIN',
          "Sélectionnez le type de fichier pour votre pièce d'identité",
          [
            {
              text: 'Photo / Galerie',
              onPress: async () => {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!permission.granted) {
                  Alert.alert('Permission refusée', "L'accès à la galerie est nécessaire.");
                  resolve(null);
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  // ✅ FIXÉ : plus de recadrage forcé (allowsEditing +
                  // aspect [4,3]) — une carte CIN est plus large
                  // (~1.6:1) qu'un ratio 4:3 (1.33:1), donc forcer ce
                  // ratio tronquait systématiquement les côtés gauche
                  // et droit de la carte. On garde désormais la photo
                  // entière ; l'aperçu (resizeMode="contain") l'affiche
                  // toujours en entier, quel que soit son format.
                  allowsEditing: false,
                  quality: 0.85,
                });
                if (!result.canceled && result.assets?.[0]) {
                  const asset = result.assets[0];
                  resolve({
                    uri: asset.uri,
                    name: asset.fileName || 'cin.jpg',
                    type: asset.mimeType || 'image/jpeg',
                    size: asset.fileSize || 0,
                  });
                } else {
                  resolve(null);
                }
              },
            },
            {
              text: '📄 PDF / Document',
              onPress: async () => {
                const result = await DocumentPicker.getDocumentAsync({
                  type: ['application/pdf', 'image/*'],
                  copyToCacheDirectory: true,
                });
                if (!result.canceled && result.assets?.[0]) {
                  const asset = result.assets[0];
                  if (asset.size && asset.size > MAX_FILE_SIZE) {
                    Alert.alert('⚠️ Erreur', 'Le fichier est trop volumineux (max 10MB)');
                    resolve(null);
                    return;
                  }
                  resolve({
                    uri: asset.uri,
                    name: asset.name || 'cin.pdf',
                    type: asset.mimeType || 'application/pdf',
                    size: asset.size || 0,
                  });
                } else {
                  resolve(null);
                }
              },
            },
            { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
          ],
          { cancelable: true }
        );
      });
    } catch (error) {
      console.error('❌ pickFile error:', error);
      return null;
    }
  };

  const uploadCin = async () => {
    try {
      const fileData = await pickFile();

      if (!fileData?.uri) {
        return;
      }

      setIsUploading(true);

      const formData = new FormData();

      if (Platform.OS === 'web') {
        if (fileData.file) {
          formData.append('file', fileData.file, fileData.name);
        } else {
          const response = await fetch(fileData.uri);
          const blob = await response.blob();
          formData.append('file', blob, fileData.name);
        }
      } else {
        formData.append('file', {
          uri: fileData.uri,
          type: fileData.type || 'image/jpeg',
          name: fileData.name || 'cin.jpg',
        });
      }

      // ✅ Preview locale immédiate — l'image/PDF choisi s'affiche
      // tout de suite, avant même la fin de l'upload.
      setLocalPreview(fileData.uri);
      setPreviewFileName(fileData.name);

      // ✅ uploadFile() ne fixe jamais Content-Type manuellement :
      // axios/le navigateur génèrent automatiquement le bon en-tête
      // multipart avec son boundary — indispensable pour que
      // l'upload fonctionne aussi bien sur le web que sur mobile.
      const { data, error } = await uploadFile('/users/upload-cin', formData);

      if (error) {
        setLocalPreview(cinImageUrl);
        setPreviewFileName(null);
        Alert.alert('❌ Erreur', error.message || "Impossible d'envoyer le CIN");
        return;
      }

      if (data?.identity_document_url) {
        // ✅ Remplace la preview locale (blob:// temporaire) par
        // l'URL définitive renvoyée par le serveur.
        cleanupObjectUrl();
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
      setLocalPreview(cinImageUrl);
      setPreviewFileName(null);
      Alert.alert('❌ Erreur', "Impossible d'envoyer le CIN");
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

      {/* ✅ Preview — pleinement visible (image entière, jamais rognée) */}
      {localPreview ? (
        <TouchableOpacity
          onPress={handleViewDocument}
          activeOpacity={0.85}
          style={styles.previewWrapper}
        >
          {isPdf ? (
            <View style={[styles.pdfPreview, { backgroundColor: themeColors.background }]}>
              <Ionicons name="document-text-outline" size={36} color={colors.primary} />
              <Text
                style={[styles.pdfPreviewText, { color: themeColors.text }]}
                numberOfLines={1}
              >
                {previewFileName || localPreview.split('/').pop() || 'Document PDF'}
              </Text>
              <Text style={[styles.pdfPreviewSubText, { color: themeColors.textSecondary }]}>
                Appuyer pour ouvrir
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: localPreview }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
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