// src/components/common/DocumentPreview.js
// Aperçu d'un document : image entière (jamais rognée) ou carte PDF.
// Si l'image ne peut pas être chargée, une carte de secours s'affiche
// (au lieu d'un grand rectangle gris vide).
import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { isPdfUrl } from '../../utils/documentUtils';

const DocumentPreview = ({
  url,
  fileName,
  height = 200,
  onPress,
  themeColors = {},
  forcePdf = false,
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url) return null;

  const pdf = forcePdf || isPdfUrl(url) || isPdfUrl(fileName);
  const text = themeColors.textSecondary || '#666';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.wrapper, { height }]}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir le document"
    >
      {pdf || failed ? (
        <View style={[styles.fallback, { backgroundColor: themeColors.background || '#F5F5F5' }]}>
          <Ionicons
            name={pdf ? 'document-text-outline' : 'image-outline'}
            size={38}
            color={colors.primary}
          />
          <Text style={[styles.name, { color: themeColors.text || '#222' }]} numberOfLines={1}>
            {fileName || decodeURIComponent((url.split('?')[0].split('/').pop()) || 'Document')}
          </Text>
          <Text style={[styles.sub, { color: text }]}>
            {pdf ? 'Document PDF — appuyer pour ouvrir' : 'Aperçu indisponible — appuyer pour ouvrir'}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: url }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#F5F5F5' },
  image: { width: '100%', height: '100%' },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  name: { fontSize: 13, fontWeight: '500', maxWidth: '90%' },
  sub: { fontSize: 11 },
});

export default DocumentPreview;
