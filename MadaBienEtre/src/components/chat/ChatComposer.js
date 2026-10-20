// src/components/chat/ChatComposer.js
// Zone de saisie au style de l'application : barre blanche à bordure haute,
// bouton photo (vert) à gauche, champ arrondi, bouton d'envoi rond vert.
// « X écrit… » au-dessus. Android, iOS et Web.
//   - Web : Entrée = envoyer, Maj+Entrée = nouvelle ligne.
//   - Le champ grandit avec le texte (max ~5 lignes).
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography } from '../../theme';
import { CHAT_MAX_WIDTH, useChatSidePadding } from './chatTheme';

export const MAX_MESSAGE_LENGTH = 2000; // identique au backend (schemas/chat.py)

const MIN_INPUT_HEIGHT = 46;
const MAX_INPUT_HEIGHT = 120;

const TypingLine = ({ label, color }) => {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => setDots((d) => (d % 3) + 1), 450);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text style={[styles.typing, { color }]} numberOfLines={1}>
      {label}
      {'.'.repeat(dots)}
    </Text>
  );
};

const ChatComposer = ({ palette, value, onChangeText, onSend, onAttach, onShareLocation, typingLabel }) => {
  const insets = useSafeAreaInsets();
  const side = useChatSidePadding();
  const [height, setHeight] = useState(MIN_INPUT_HEIGHT);
  const hasText = value.trim().length > 0;

  useEffect(() => {
    if (!value) setHeight(MIN_INPUT_HEIGHT);
  }, [value]);

  const handleKeyPress = (e) => {
    if (Platform.OS !== 'web') return;
    const { key, shiftKey } = e.nativeEvent || {};
    if (key === 'Enter' && !shiftKey) {
      e.preventDefault?.();
      if (hasText) onSend();
    }
  };

  const bottomPad = Platform.OS === 'web' ? 10 : Math.max(insets.bottom, 10);

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          paddingBottom: bottomPad,
          paddingHorizontal: side,
        },
      ]}
    >
      <View style={styles.column}>
        {!!typingLabel && (
          <View style={styles.typingSlot}>
            <TypingLine label={typingLabel} color={palette.textSecondary} />
          </View>
        )}

        <View style={styles.row}>
          <TouchableOpacity
            onPress={onAttach}
            activeOpacity={0.7}
            style={styles.attach}
            accessibilityRole="button"
            accessibilityLabel="Joindre une photo"
          >
            <Ionicons name="image-outline" size={26} color={palette.primary} />
          </TouchableOpacity>

          {!!onShareLocation && (
            <TouchableOpacity
              onPress={onShareLocation}
              activeOpacity={0.7}
              style={styles.attach}
              accessibilityRole="button"
              accessibilityLabel="Partager une position"
            >
              <Ionicons name="location-outline" size={26} color={palette.primary} />
            </TouchableOpacity>
          )}

          <View
            style={[
              styles.inputBox,
              { backgroundColor: palette.inputBg, borderColor: palette.inputBorder },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                { color: palette.text, height },
                Platform.OS === 'web' && styles.inputWeb,
              ]}
              placeholder="Écrivez un message..."
              placeholderTextColor={palette.textSecondary}
              value={value}
              onChangeText={onChangeText}
              onContentSizeChange={(e) => {
                const h = e?.nativeEvent?.contentSize?.height;
                if (typeof h === 'number') {
                  setHeight(Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, Math.ceil(h) + 4)));
                }
              }}
              onKeyPress={handleKeyPress}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              textAlignVertical="center"
              autoCapitalize="sentences"
              blurOnSubmit={false}
              underlineColorAndroid="transparent"
              accessibilityLabel="Écrire un message"
            />
          </View>

          <TouchableOpacity
            onPress={onSend}
            disabled={!hasText}
            activeOpacity={0.85}
            style={[styles.send, { backgroundColor: palette.primary }, !hasText && styles.sendOff]}
            accessibilityRole="button"
            accessibilityLabel="Envoyer le message"
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {value.length > MAX_MESSAGE_LENGTH - 200 && (
          <Text
            style={[
              styles.counter,
              { color: value.length >= MAX_MESSAGE_LENGTH ? palette.danger : palette.textSecondary },
            ]}
          >
            {value.length}/{MAX_MESSAGE_LENGTH}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  column: { width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },

  typingSlot: { paddingLeft: 52, paddingBottom: 4 },
  typing: { fontSize: 12, fontStyle: 'italic', fontFamily: typography.fontFamily.regular },

  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attach: { width: 38, height: MIN_INPUT_HEIGHT, alignItems: 'center', justifyContent: 'center' },

  inputBox: {
    flex: 1,
    minHeight: MIN_INPUT_HEIGHT,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    paddingTop: Platform.OS === 'ios' ? 13 : 9,
    paddingBottom: Platform.OS === 'ios' ? 13 : 9,
    paddingHorizontal: 0,
    margin: 0,
  },
  inputWeb: { outlineStyle: 'none', outlineWidth: 0, resize: 'none', cursor: 'text' },

  send: {
    width: MIN_INPUT_HEIGHT,
    height: MIN_INPUT_HEIGHT,
    borderRadius: MIN_INPUT_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.45 },

  counter: { fontSize: 10, textAlign: 'right', marginTop: 4, fontFamily: typography.fontFamily.regular },
});

export default ChatComposer;
