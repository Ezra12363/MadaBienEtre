// src/components/common/CinSection.js
import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography } from '../../theme';
import { uploadFile } from '../../services/api';

const CinSection = ({
  cinNumber,
  onChangeCinNumber,
  cinImageUrl,
  onCinImageUploaded,
  themeColors,
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const pickCinImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Erreur', 'Permission de galerie refusée');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled) {
      setIsUploading(true);
      try {
        const asset = result.assets[0];
        const uriParts = asset.uri.split('.');
        const fileExtension = uriParts[uriParts.length - 1] || 'jpg';
        const mimeType = asset.mimeType || `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
        const filename = `cin.${fileExtension}`;

        let fileToSend;

        if (Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          fileToSend = new File([blob], filename, { type: mimeType });
        } else {
          fileToSend = {
            uri: asset.uri,
            type: mimeType,
            name: filename,
          };
        }

        const formData = new FormData();
        formData.append('file', fileToSend);

        const { data, error } = await uploadFile('/users/upload-cin', formData);

        if (error) {
          Alert.alert('Erreur', error.message || "Impossible d'envoyer le CIN");
          return;
        }

        if (data?.identity_document_url) {
          onCinImageUploaded(data.identity_document_url);
          Alert.alert('✅ Succès', 'Document CIN téléchargé avec succès');
        }
      } catch (e) {
        console.error('❌ Error uploading CIN:', e);
        Alert.alert('Erreur', "Impossible d'envoyer le CIN");
      } finally {
        setIsUploading(false);
      }
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

      <TouchableOpacity
        style={styles.uploadButton}
        onPress={pickCinImage}
        disabled={isUploading}
        activeOpacity={0.8}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.uploadButtonText}>
              {cinImageUrl ? 'Remplacer la photo du CIN' : 'Uploader mon CIN (photo)'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {cinImageUrl && (
        <Image
          source={{ uri: cinImageUrl }}
          style={styles.preview}
          resizeMode="contain"
        />
      )}
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
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: spacing.sm,
    minHeight: 44,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: typography.fontFamily.semiBold,
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: spacing.sm,
    backgroundColor: '#f5f5f5',
  },
});

export default CinSection;