// src/components/chat/ChatComposer.js
// « X est en train d'écrire… » + champ de saisie (icône d'envoi à l'intérieur)
// + bouton « + » vert clair pour joindre une photo. Android, iOS et Web.
//   - Web : Entrée = envoyer, Maj+Entrée = nouvelle ligne.
//   - Le champ grandit avec le texte (max ~5 lignes).
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography } from '../../theme';
import { CHAT_MAX_WIDTH } from './chatTheme';

export const MAX_MESSAGE_LENGTH = 2000; // identique au backend (schemas/chat.py)

const MIN_INPUT_HEIGHT = 46;
const MAX_INPUT_HEIGHT = 120;

const TypingLine = ({ label, color }) => {
  const [dots, setDots] = useState(2);

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

const ChatComposer = ({
  palette,
  value,
  onChangeText,
  onSend,
  onAttach,
  typingLabel,
  disabled = false,
}) => {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(MIN_INPUT_HEIGHT);
  const hasText = value.trim().length > 0;

  // Champ vidé après l'envoi : on revient à la hauteur de départ
  useEffect(() => {
    if (!value) setHeight(MIN_INPUT_HEIGHT);
  }, [value]);

  const handleKeyPress = (e) => {
    if (Platform.OS !== 'web') return;
    const { key, shiftKey } = e.nativeEvent || {};
    if (key === 'Enter' && !shiftKey) {
      e.preventDefault?.();
      if (hasText && !disabled) onSend();
    }
  };

  const bottomPad = Platform.OS === 'web' ? 14 : Math.max(insets.bottom, 12);

  return (
    <View style={[styles.wrap, { backgroundColor: palette.screenBg, paddingBottom: bottomPad }]}>
      <View style={styles.column}>
        <View style={styles.typingSlot}>
          {!!typingLabel && <TypingLine label={typingLabel} color={palette.meta} />}
        </View>

        <View style={styles.row}>
          <View style={[styles.inputBox, { backgroundColor: palette.inputBg }]}>
            <TextInput
              style={[
                styles.input,
                { color: palette.inputText, height },
                Platform.OS === 'web' && styles.inputWeb,
              ]}
              placeholder="Écrivez votre message"
              placeholderTextColor={palette.placeholder}
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

            <TouchableOpacity
              onPress={onSend}
              disabled={!hasText || disabled}
              activeOpacity={0.7}
              style={styles.sendButton}
              accessibilityRole="button"
              accessibilityLabel="Envoyer le message"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={hasText ? 'paper-plane' : 'paper-plane-outline'}
                size={22}
                color={hasText ? palette.primary : palette.sendIdle}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={onAttach}
            activeOpacity={0.8}
            style={[styles.plusButton, { backgroundColor: palette.primarySoft }]}
            accessibilityRole="button"
            accessibilityLabel="Joindre une photo"
          >
            <Ionicons name="add" size={30} color={palette.primary} />
          </TouchableOpacity>
        </View>

        {value.length > MAX_MESSAGE_LENGTH - 200 && (
          <Text
            style={[
              styles.counter,
              { color: value.length >= MAX_MESSAGE_LENGTH ? palette.danger : palette.meta },
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
  wrap: { paddingHorizontal: 16, paddingTop: 2 },
  column: { width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },

  typingSlot: { minHeight: 22, justifyContent: 'center', paddingLeft: 4, paddingBottom: 2 },
  typing: { fontSize: 12, fontFamily: typography.fontFamily.regular },

  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },

  inputBox: {
    flex: 1,
    minHeight: MIN_INPUT_HEIGHT,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 16,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    paddingTop: Platform.OS === 'ios' ? 13 : 9,
    paddingBottom: Platform.OS === 'ios' ? 13 : 9,
    paddingHorizontal: 0,
    margin: 0,
  },
  inputWeb: { outlineStyle: 'none', outlineWidth: 0, resize: 'none', cursor: 'text' },

  sendButton: { width: 40, height: MIN_INPUT_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  plusButton: {
    width: MIN_INPUT_HEIGHT,
    height: MIN_INPUT_HEIGHT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  counter: { fontSize: 10, textAlign: 'right', marginTop: 4, fontFamily: typography.fontFamily.regular },
});

export default ChatComposer;
