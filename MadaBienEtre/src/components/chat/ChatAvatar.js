// src/components/chat/ChatAvatar.js
// Avatar rond (comme les autres écrans) : photo, sinon initiale sur fond vert doux.
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { typography } from '../../theme';
import { getInitial } from '../../utils/chatUi';

const ChatAvatar = ({ uri, name, size = 48, palette, style }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[box, styles.image, style]}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[box, styles.fallback, { backgroundColor: palette.avatarBg }, style]}>
      <Text style={[styles.initial, { color: palette.avatarText, fontSize: size * 0.4 }]}>
        {getInitial(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: { backgroundColor: '#E5E7EB' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: typography.fontFamily.bold, fontWeight: '700' },
});

export default ChatAvatar;
