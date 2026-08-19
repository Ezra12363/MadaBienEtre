// src/components/common/Input.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  error,
  success,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  icon,
  iconPosition = 'left',
  style,
  inputStyle,
  labelStyle,
  onFocus,
  onBlur,
  onSubmitEditing,
  returnKeyType = 'default',
  blurOnSubmit = true,
  selectionColor,
  textAlignVertical = 'center',
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const inputRef = useRef(null);

  // ✅ Amin'ny voalohany dia apetraka eo amin'ny farany ny cursor
  useEffect(() => {
    if (value && inputRef.current) {
      // ✅ Afindra any amin'ny farany ny cursor
      inputRef.current.setNativeProps({
        selection: { start: value.length, end: value.length },
      });
    }
  }, [value]);

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (onFocus) onFocus();
    
    // ✅ Rehefa mifoka dia apetraka any amin'ny farany ny cursor
    setTimeout(() => {
      if (inputRef.current && value) {
        inputRef.current.setNativeProps({
          selection: { start: value.length, end: value.length },
        });
      }
    }, 50);
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (onBlur) onBlur();
  };

  const handleChangeText = (text) => {
    if (onChangeText) {
      onChangeText(text);
    }
    // ✅ Apetraka any amin'ny farany ny cursor rehefa miova ny text
    setTimeout(() => {
      if (inputRef.current && text) {
        inputRef.current.setNativeProps({
          selection: { start: text.length, end: text.length },
        });
      }
    }, 10);
  };

  const getBorderColor = () => {
    if (error) return colors.error;
    if (success) return colors.success;
    if (isFocused) return colors.primary;
    return themeColors.border || '#E0E0E0';
  };

  const getLabelColor = () => {
    if (error) return colors.error;
    if (success) return colors.success;
    if (isFocused) return colors.primary;
    return themeColors.textSecondary;
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: getLabelColor() }, labelStyle]}>
          {label}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: getBorderColor(),
            backgroundColor: disabled ? themeColors.border : themeColors.surface || '#F5F5F5',
          },
          isFocused && styles.inputFocused,
          error && styles.inputError,
          success && styles.inputSuccess,
        ]}
      >
        {icon && iconPosition === 'left' && (
          <View style={styles.iconLeft}>{icon}</View>
        )}
        
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            { color: themeColors.text },
            multiline && styles.multilineInput,
            inputStyle,
          ]}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textSecondary}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          maxLength={maxLength}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          blurOnSubmit={blurOnSubmit}
          selectionColor={selectionColor || colors.primary}
          textAlignVertical={multiline ? 'top' : textAlignVertical}
          // ✅ Fanampiana ho an'ny cursor
          selectTextOnFocus={false}
          // ✅ Ho an'ny Android dia apetraka any amin'ny farany
          cursorColor={colors.primary}
        />
        
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>
        )}
        
        {icon && iconPosition === 'right' && (
          <View style={styles.iconRight}>{icon}</View>
        )}
      </View>
      
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {typeof error === 'string' ? error : 'Champ invalide'}
        </Text>
      )}
      
      {success && !error && (
        <Text style={[styles.successText, { color: colors.success }]}>
          {typeof success === 'string' ? success : 'Valide'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    backgroundColor: '#F5F5F5',
  },
  inputFocused: {
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputSuccess: {
    borderColor: colors.success,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    minHeight: 40,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
  },
  successText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: 4,
  },
});

export default Input;