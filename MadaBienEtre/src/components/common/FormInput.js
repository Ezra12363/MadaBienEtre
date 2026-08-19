// src/components/common/FormInput.js
import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

const FormInput = memo(
  ({
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    isDark,
    secureTextEntry,
    showToggle,
    onToggleSecure,
    keyboardType = 'default',
    autoCapitalize = 'sentences',
    autoCorrect = true,
    returnKeyType = 'next',
    maxLength,
    onSubmitEditing,
    clearable = false,
    error = null,
  }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [selection, setSelection] = useState(undefined);

    const inputRef = useRef(null);
    const isUserTypingRef = useRef(false);

    const handleFocus = useCallback(() => setIsFocused(true), []);
    const handleBlur = useCallback(() => setIsFocused(false), []);

    const handleChangeText = useCallback(
      (text) => {
        isUserTypingRef.current = true;
        onChangeText(text);
      },
      [onChangeText]
    );

    const handleSelectionChange = useCallback((e) => {
      if (!isUserTypingRef.current) {
        setSelection(e.nativeEvent.selection);
      }
    }, []);

    useEffect(() => {
      if (Platform.OS === 'web' && isUserTypingRef.current) {
        const cursorPos = value ? value.length : 0;
        setSelection({ start: cursorPos, end: cursorPos });
        isUserTypingRef.current = false;
      }
    }, [value]);

    const handleClear = useCallback(() => {
      onChangeText('');
      setSelection({ start: 0, end: 0 });
      setTimeout(() => inputRef.current?.focus(), 0);
    }, [onChangeText]);

    return (
      <View style={styles.inputGroup}>
        {label ? (
          <Text style={[styles.label, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
            {label}
          </Text>
        ) : null}

        <View
          style={[
            styles.inputWrapper,
            isFocused && styles.inputFocused,
            error && styles.inputError,
            { borderColor: error ? colors.error : isDark ? '#333' : '#E0E0E0' },
          ]}
        >
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={isFocused ? colors.primary : '#999'}
              style={styles.inputIcon}
            />
          )}

          <TextInput
            ref={inputRef}
            style={[styles.input, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}
            placeholder={placeholder}
            placeholderTextColor={isDark ? '#666' : '#999'}
            value={value}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSelectionChange={handleSelectionChange}
            selection={Platform.OS === 'web' ? selection : undefined}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            returnKeyType={returnKeyType}
            maxLength={maxLength}
            onSubmitEditing={onSubmitEditing}
            selectionColor={colors.primary}
            underlineColorAndroid="transparent"
            blurOnSubmit={returnKeyType === 'done'}
          />

          {showToggle && (
            <TouchableOpacity onPress={onToggleSecure} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons
                name={secureTextEntry ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          )}

          {clearable && value?.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }
);

FormInput.displayName = 'FormInput';

const styles = StyleSheet.create({
  inputGroup: { marginBottom: spacing.md },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
  },
  inputFocused: { borderColor: colors.primary, borderWidth: 2 },
  inputError: { borderWidth: 2 },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    outlineStyle: 'none',
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default FormInput;