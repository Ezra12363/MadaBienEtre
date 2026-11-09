// src/components/common/PasswordInput.js
// ============================================================
// Champ mot de passe avec bouton « œil » : afficher / masquer.
// Pour les formulaires admin (création / modification d'un compte).
// Les écrans d'inscription et de connexion ont déjà leur propre bouton œil.
// ============================================================
import { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PasswordInput = ({
  value,
  onChangeText,
  placeholder = 'Minimum 8 caractères',
  themeColors,
  isDark = false,
  error = false,
  onBlur,
  onFocus,
  onSubmitEditing,
  returnKeyType,
  inputRef,
  style,
  testID,
}) => {
  const [visible, setVisible] = useState(false);
  const text = themeColors?.text || (isDark ? '#FFFFFF' : '#1F2937');
  const muted = themeColors?.textSecondary || '#9CA3AF';
  const border = error ? '#EF4444' : themeColors?.border || '#E0E0E0';

  return (
    <View style={[styles.wrap, { borderColor: border }, style]}>
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: text }, Platform.OS === 'web' && styles.inputWeb]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={muted}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="new-password"
        textContentType="newPassword"
        onBlur={onBlur}
        onFocus={onFocus}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        testID={testID}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        style={styles.eye}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={muted} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 8,
  },
  input: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 10 },
  inputWeb: { outlineStyle: 'none', outlineWidth: 0 },
  eye: { padding: 6 },
});

export default PasswordInput;
