// src/components/common/Button.js
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const Button = ({
  title,
  onPress,
  variant = 'primary', // primary, secondary, outline, danger, success, ghost
  size = 'medium', // small, medium, large
  isLoading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  gradient = true,
}) => {
  const { colors: themeColors } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          button: { backgroundColor: themeColors.primaryLight },
          text: { color: '#fff' },
        };
      case 'outline':
        return {
          button: { 
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: themeColors.primary,
          },
          text: { color: themeColors.primary },
        };
      case 'danger':
        return {
          button: { backgroundColor: colors.error },
          text: { color: '#fff' },
        };
      case 'success':
        return {
          button: { backgroundColor: colors.success },
          text: { color: '#fff' },
        };
      case 'ghost':
        return {
          button: { backgroundColor: 'transparent' },
          text: { color: themeColors.text },
        };
      default:
        return {
          button: { backgroundColor: themeColors.primary },
          text: { color: '#fff' },
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          button: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minHeight: 32 },
          text: { fontSize: typography.fontSize.sm },
        };
      case 'large':
        return {
          button: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, minHeight: 56 },
          text: { fontSize: typography.fontSize.lg },
        };
      default:
        return {
          button: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 44 },
          text: { fontSize: typography.fontSize.md },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator color={variant === 'outline' ? themeColors.primary : '#fff'} size="small" />;
    }

    const content = (
      <>
        {icon && iconPosition === 'left' && <View style={styles.iconContainer}>{icon}</View>}
        <Text
          style={[
            styles.text,
            variantStyles.text,
            sizeStyles.text,
            disabled && styles.disabledText,
            textStyle,
          ]}
        >
          {title}
        </Text>
        {icon && iconPosition === 'right' && <View style={styles.iconContainer}>{icon}</View>}
      </>
    );

    if (gradient && variant === 'primary') {
      return (
        <LinearGradient
          colors={[themeColors.primary, themeColors.primaryLight]}
          style={[styles.button, styles.gradientButton, sizeStyles.button]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.contentContainer}>{content}</View>
        </LinearGradient>
      );
    }

    return (
      <View style={[styles.button, variantStyles.button, sizeStyles.button, style]}>
        <View style={styles.contentContainer}>{content}</View>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientButton: {
    borderRadius: 12,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginHorizontal: 4,
  },
  text: {
    fontFamily: typography.fontFamily.semiBold,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.6,
  },
  fullWidth: {
    width: '100%',
  },
});

export default Button;