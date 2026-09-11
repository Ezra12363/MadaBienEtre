// src/components/common/AppHeader.js
// ============================================================
// MADA BIEN-ÊTRE — APP HEADER
// HEADER FIXE — ANDROID / IOS / WEB
// ============================================================

import React from 'react';

import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/* =========================================================
   COLORS
========================================================= */

export const HEADER_COLORS = {
  primary: '#2E7D32',
  primaryDark: '#164B2A',
  primaryMid: '#1F6B38',

  white: '#FFFFFF',

  headerBg: '#2E7D32',

  logoBoxBg: 'rgba(255,255,255,0.18)',

  backButtonBg: 'rgba(255,255,255,0.16)',
  backButtonBgPressed: 'rgba(255,255,255,0.28)',

  subtitle: 'rgba(255,255,255,0.85)',

  border: 'rgba(255,255,255,0.14)',
};

/* =========================================================
   COMPONENT
========================================================= */

export default function AppHeader({
  navigation,
  showBack = false,
  onBack,
  title = 'Mada Bien-être',
  subtitle = 'Votre bien-être, notre priorité',
  onLogoPress,
  rightContent = null,
  transparent = false,
  manageStatusBar = true,
}) {
  const { width } = useWindowDimensions();

  /* ---------------------------------------------------------
     RESPONSIVE
  --------------------------------------------------------- */

  const isMobile = width < 850;
  const isTablet = width >= 850 && width < 1100;

  /* ---------------------------------------------------------
     BACK
  --------------------------------------------------------- */

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  /* =========================================================
     HEADER CONTENT
  ========================================================= */

  const HeaderContent = (
    <View
      style={[
        styles.headerInner,

        isMobile && styles.headerInnerMobile,

        isTablet && styles.headerInnerTablet,
      ]}
    >
      {/* =====================================================
          LEFT — BACK BUTTON
      ===================================================== */}

      {showBack ? (
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backButton,

            isMobile && styles.backButtonMobile,

            pressed && styles.backButtonPressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={HEADER_COLORS.white}
          />
        </Pressable>
      ) : (
        <View
          style={[
            styles.sidePlaceholder,

            isMobile && styles.sidePlaceholderMobile,
          ]}
        />
      )}

      {/* =====================================================
          CENTER — LOGO + TEXT
      ===================================================== */}

      <Pressable
        onPress={onLogoPress}
        disabled={!onLogoPress}
        style={[
          styles.centerLogoContainer,

          isMobile && styles.centerLogoContainerMobile,
        ]}
      >
        {/* LOGO */}

        <View
          style={[
            styles.logoBox,

            isMobile && styles.logoBoxMobile,
          ]}
        >
          <Image
            source={require('../../../assets/logo.png')}
            style={[
              styles.logo,

              isMobile && styles.logoMobile,
            ]}
            resizeMode="contain"
          />
        </View>

        {/* TEXT */}

        <View
          style={[
            styles.logoTexts,

            isMobile && styles.logoTextsMobile,
          ]}
        >
          <Text
            style={[
              styles.logoTitle,

              isMobile && styles.logoTitleMobile,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.logoSubtitle,

              isMobile && styles.logoSubtitleMobile,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>

      {/* =====================================================
          RIGHT — ACTIONS
      ===================================================== */}

      {rightContent ? (
        <View
          style={[
            styles.rightContent,

            isMobile && styles.rightContentMobile,
          ]}
        >
          {rightContent}
        </View>
      ) : (
        <View
          style={[
            styles.sidePlaceholder,

            isMobile && styles.sidePlaceholderMobile,
          ]}
        />
      )}
    </View>
  );

  /* =========================================================
     RETURN
  ========================================================= */

  return (
    <View
      style={[
        styles.header,

        transparent && styles.headerTransparent,
      ]}
    >
      {/* =====================================================
          STATUS BAR
      ===================================================== */}

      {manageStatusBar && (
        <StatusBar
          barStyle="light-content"
          backgroundColor={HEADER_COLORS.primaryDark}
          translucent={false}
        />
      )}

      {/* =====================================================
          SAFE AREA
      ===================================================== */}

      {Platform.OS === 'web' ? (
        HeaderContent
      ) : (
        <SafeAreaView
          edges={['top']}
          style={[
            styles.safeArea,

            transparent && styles.safeAreaTransparent,
          ]}
        >
          {HeaderContent}
        </SafeAreaView>
      )}
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({

  /* =======================================================
     HEADER FIXE
  ======================================================= */

  header: {
    position: 'absolute',

    top: 0,
    left: 0,
    right: 0,

    width: '100%',

    backgroundColor: HEADER_COLORS.headerBg,

    borderBottomWidth: 1,

    borderBottomColor: HEADER_COLORS.border,

    zIndex: 9999,

    elevation: 20,

    ...Platform.select({
      web: {
        position: 'sticky',

        top: 0,

        boxShadow: '0px 4px 14px rgba(0,0,0,0.15)',
      },

      default: {
        shadowColor: '#000',

        shadowOffset: {
          width: 0,
          height: 3,
        },

        shadowOpacity: 0.16,

        shadowRadius: 7,
      },
    }),
  },

  /* =======================================================
     SAFE AREA
  ======================================================= */

  safeArea: {
    width: '100%',

    backgroundColor: HEADER_COLORS.headerBg,
  },

  safeAreaTransparent: {
    backgroundColor: 'transparent',
  },

  /* =======================================================
     TRANSPARENT HEADER
  ======================================================= */

  headerTransparent: {
    backgroundColor: 'transparent',

    borderBottomWidth: 0,

    elevation: 0,

    ...Platform.select({
      web: {
        boxShadow: 'none',
      },

      default: {
        shadowColor: 'transparent',

        shadowOpacity: 0,

        shadowRadius: 0,
      },
    }),
  },

  /* =======================================================
     HEADER INNER
  ======================================================= */

  headerInner: {
    width: '100%',

    maxWidth: 1280,

    minHeight: 76,

    alignSelf: 'center',

    paddingHorizontal: 20,

    paddingVertical: 8,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    position: 'relative',
  },

  /* =======================================================
     MOBILE
  ======================================================= */

  headerInnerMobile: {
    minHeight: 68,

    paddingHorizontal: 14,

    paddingVertical: 6,
  },

  /* =======================================================
     TABLET
  ======================================================= */

  headerInnerTablet: {
    paddingHorizontal: 22,
  },

  /* =======================================================
     CENTER LOGO CONTAINER
  ======================================================= */

  centerLogoContainer: {
    position: 'absolute',

    left: 0,

    right: 0,

    top: 0,

    bottom: 0,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 70,

    zIndex: 2,
  },

  centerLogoContainerMobile: {
    paddingHorizontal: 55,
  },

  /* =======================================================
     LOGO BOX
  ======================================================= */

  logoBox: {
    width: 50,

    height: 50,

    borderRadius: 14,

    backgroundColor: HEADER_COLORS.logoBoxBg,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 10,
  },

  logoBoxMobile: {
    width: 44,

    height: 44,

    borderRadius: 13,

    marginRight: 8,
  },

  /* =======================================================
     LOGO
  ======================================================= */

  logo: {
    width: 38,

    height: 38,
  },

  logoMobile: {
    width: 32,

    height: 32,
  },

  /* =======================================================
     TEXT
  ======================================================= */

  logoTexts: {
    justifyContent: 'center',

    alignItems: 'flex-start',

    flexShrink: 1,

    maxWidth: 230,
  },

  logoTextsMobile: {
    maxWidth: 170,
  },

  logoTitle: {
    color: HEADER_COLORS.white,

    fontSize: 18,

    fontWeight: '800',

    lineHeight: 22,

    textAlign: 'left',
  },

  logoTitleMobile: {
    fontSize: 16,

    lineHeight: 19,
  },

  logoSubtitle: {
    marginTop: 2,

    color: HEADER_COLORS.subtitle,

    fontSize: 10,

    lineHeight: 13,

    textAlign: 'left',
  },

  logoSubtitleMobile: {
    fontSize: 9,

    lineHeight: 11,
  },

  /* =======================================================
     BACK BUTTON
  ======================================================= */

  backButton: {
    width: 44,

    height: 44,

    borderRadius: 13,

    backgroundColor: HEADER_COLORS.backButtonBg,

    alignItems: 'center',

    justifyContent: 'center',

    zIndex: 10,

    elevation: 3,
  },

  backButtonMobile: {
    width: 40,

    height: 40,

    borderRadius: 12,
  },

  backButtonPressed: {
    backgroundColor: HEADER_COLORS.backButtonBgPressed,

    transform: [
      {
        scale: 0.96,
      },
    ],
  },

  /* =======================================================
     LEFT / RIGHT PLACEHOLDER
     
     Ity no mitazona équilibre mba tsy hiova toerana
     ny logo na misy bouton retour na tsia.
  ======================================================= */

  sidePlaceholder: {
    width: 44,

    height: 44,

    zIndex: 1,
  },

  sidePlaceholderMobile: {
    width: 40,

    height: 40,
  },

  /* =======================================================
     RIGHT CONTENT
  ======================================================= */

  rightContent: {
    minWidth: 44,

    minHeight: 44,

    alignItems: 'center',

    justifyContent: 'center',

    flexDirection: 'row',

    gap: 10,

    zIndex: 10,
  },

  rightContentMobile: {
    minWidth: 40,

    minHeight: 40,

    gap: 7,
  },
});