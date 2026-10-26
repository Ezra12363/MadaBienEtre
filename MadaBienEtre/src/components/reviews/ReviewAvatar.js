// src/components/reviews/ReviewAvatar.js
// Photo de profil ronde (client / thérapeute) avec repli automatique sur les
// initiales si la photo est absente, anonyme ou ne se charge pas.
import { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { resolvePhotoUrl } from '../../utils/chatUi';
import { getInitials } from './reviewUtils';

export default function ReviewAvatar({ photo, name, size = 40, style }) {
  const { colors: c } = useTheme();
  const uri = resolvePhotoUrl(photo);
  const [failed, setFailed] = useState(false);

  // Nouvelle photo -> on retente le chargement
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const box = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${c.primary}22`,
  };

  return (
    <View style={[box, style]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={name ? `Photo de ${name}` : 'Photo de profil'}
        />
      ) : (
        <Text style={{ color: c.primary, fontWeight: '800', fontSize: Math.max(10, size * 0.36) }}>
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}
