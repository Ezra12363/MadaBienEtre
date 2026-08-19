// src/components/common/Loading.js

import React, { useEffect, useRef } from 'react';

import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, typography } from '../../theme';

const IS_WEB = Platform.OS === 'web';

/* ============================================================
   LOADING COMPONENT
============================================================ */

const Loading = ({
  size = 'large',
  text,
  fullScreen = false,
  transparent = false,
}) => {
  const { colors: themeColors, isDark } = useTheme();

  /* ==========================================================
     ANIMATIONS
  ========================================================== */

  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    /* --------------------------------------------------------
       ROTATION
    -------------------------------------------------------- */

    const rotateAnimation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    /* --------------------------------------------------------
       PULSE
    -------------------------------------------------------- */

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    /* --------------------------------------------------------
       CONTENT ENTRANCE
    -------------------------------------------------------- */

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),

      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    rotateAnimation.start();
    pulseAnimation.start();

    return () => {
      rotateAnimation.stop();
      pulseAnimation.stop();
    };
  }, [
    opacity,
    pulse,
    rotation,
    translateY,
  ]);

  const rotateInterpolation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  /* ==========================================================
     THEME COLORS
  ========================================================== */

  const backgroundColor = transparent
    ? isDark
      ? 'rgba(2, 6, 23, 0.78)'
      : 'rgba(255, 255, 255, 0.78)'
    : themeColors.background;

  const cardBackground = isDark
    ? 'rgba(255,255,255,0.055)'
    : '#FFFFFF';

  const borderColor = isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(15,23,42,0.07)';

  /* ==========================================================
     LOADING CONTENT
  ========================================================== */

  const LoadingContent = () => (
    <Animated.View
      style={[
        styles.contentWrapper,
        {
          opacity,
          transform: [
            {
              translateY,
            },
          ],
        },
      ]}
    >
      {/* ======================================================
          PREMIUM ICON
      ====================================================== */}

      <Animated.View
        style={[
          styles.iconWrapper,
          {
            transform: [
              {
                scale: pulse,
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.iconGlow,
            {
              backgroundColor: `${colors.primary}12`,
            },
          ]}
        />

        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: `${colors.primary}10`,
              borderColor: `${colors.primary}20`,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.spinnerRing,
              {
                borderTopColor: colors.primary,
                borderRightColor: `${colors.primary}25`,
                transform: [
                  {
                    rotate: rotateInterpolation,
                  },
                ],
              },
            ]}
          />

          <Ionicons
            name="sparkles-outline"
            size={24}
            color={colors.primary}
          />
        </View>
      </Animated.View>

      {/* ======================================================
          TEXT
      ====================================================== */}

      {text ? (
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              {
                color: themeColors.text,
              },
            ]}
            numberOfLines={2}
          >
            {text}
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color: themeColors.textSecondary,
              },
            ]}
          >
            Veuillez patienter...
          </Text>
        </View>
      ) : null}

      {/* ======================================================
          ACTIVITY INDICATOR
      ====================================================== */}

      <View style={styles.indicatorContainer}>
        <ActivityIndicator
          size={size}
          color={colors.primary}
        />
      </View>
    </Animated.View>
  );

  /* ==========================================================
     FULLSCREEN
  ========================================================== */

  if (fullScreen) {
    return (
      <View
        style={[
          styles.fullScreen,
          {
            backgroundColor,
          },
        ]}
        pointerEvents="auto"
      >
        {/* ----------------------------------------------------
            WEB BACKDROP
        ---------------------------------------------------- */}

        {IS_WEB && (
          <View
            style={[
              styles.webBackdrop,
              {
                backgroundColor: transparent
                  ? isDark
                    ? 'rgba(2,6,23,0.40)'
                    : 'rgba(255,255,255,0.45)'
                  : 'transparent',
              },
            ]}
          />
        )}

        {/* ----------------------------------------------------
            PREMIUM CARD
        ---------------------------------------------------- */}

        <View
          style={[
            styles.fullScreenCard,
            {
              backgroundColor: transparent
                ? cardBackground
                : 'transparent',

              borderColor: transparent
                ? borderColor
                : 'transparent',

              shadowOpacity: transparent ? 0.10 : 0,
              elevation: transparent ? 5 : 0,
            },
          ]}
        >
          <LoadingContent />
        </View>
      </View>
    );
  }

  /* ==========================================================
     INLINE LOADING
  ========================================================== */

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: 'transparent',
        },
      ]}
    >
      <LoadingContent />
    </View>
  );
};

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({

  /* ==========================================================
     FULLSCREEN
  ========================================================== */

  fullScreen: {
    position: 'absolute',

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    width: '100%',
    height: '100%',

    alignItems: 'center',
    justifyContent: 'center',

    zIndex: 99999,
    elevation: 99999,
  },

  webBackdrop: {
    position: 'absolute',

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    width: '100%',
    height: '100%',

    ...(IS_WEB
      ? {
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }
      : {}),
  },

  fullScreenCard: {
    width: IS_WEB ? 360 : '82%',
    maxWidth: 380,

    minHeight: 220,

    borderRadius: 26,
    borderWidth: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 28,
    paddingVertical: 28,

    ...(IS_WEB
      ? {
          boxShadow:
            '0px 14px 45px rgba(15, 23, 42, 0.12)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity: 0.10,
          shadowRadius: 20,
        }),
  },

  /* ==========================================================
     INLINE CONTAINER
  ========================================================== */

  container: {
    width: '100%',

    minHeight: 120,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },

  /* ==========================================================
     CONTENT
  ========================================================== */

  contentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',

    width: '100%',
  },

  /* ==========================================================
     ICON
  ========================================================== */

  iconWrapper: {
    width: 78,
    height: 78,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 18,
  },

  iconGlow: {
    position: 'absolute',

    width: 78,
    height: 78,

    borderRadius: 39,
  },

  iconCircle: {
    width: 62,
    height: 62,

    borderRadius: 20,

    borderWidth: 1,

    alignItems: 'center',
    justifyContent: 'center',

    overflow: 'hidden',
  },

  spinnerRing: {
    position: 'absolute',

    width: 62,
    height: 62,

    borderRadius: 31,

    borderWidth: 2.5,

    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },

  /* ==========================================================
     TEXT
  ========================================================== */

  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',

    maxWidth: 300,

    paddingHorizontal: 10,
  },

  title: {
    fontSize: IS_WEB ? 14 : 14,

    lineHeight: 20,

    textAlign: 'center',

    fontFamily: typography.fontFamily.semiBold,
  },

  subtitle: {
    marginTop: 4,

    fontSize: 11,

    lineHeight: 16,

    textAlign: 'center',

    fontFamily: typography.fontFamily.regular,

    opacity: 0.8,
  },

  /* ==========================================================
     ACTIVITY INDICATOR
  ========================================================== */

  indicatorContainer: {
    marginTop: 15,

    minHeight: 20,

    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Loading;