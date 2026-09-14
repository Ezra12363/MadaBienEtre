// src/components/common/Header.js
//
// ✅ Header commun harmonisé sur le style de HomeScreen.js :
//    - Même fond (vert PRIMARY) + même bordure basse (PRIMARY_DARK)
//    - Même logo rond blanc + même typo (titre gras / sous-titre léger)
//    - Bouton latéral gauche : flèche retour (showBack) ou bouton
//      personnalisé (leftComponent), sinon un espace vide de la même
//      largeur pour garder le bloc central parfaitement centré.
//    - Bouton latéral droit : composant personnalisé (rightComponent)
//      ou un espace vide de la même largeur.
//
// Toutes les pages qui utilisent <Header title="..." showBack /> ou
// <Header title="..." rightComponent={...} /> gardent exactement la
// même API : seul le rendu visuel change pour correspondre à
// HomeScreen.

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors, typography } from '../../theme';

/* ============================================================
   THEME — identique à HomeScreen.js
============================================================ */

const PRIMARY = colors.primary || '#168A55';
const PRIMARY_DARK = '#0B633C';

const Header = ({
  title,
  subtitle,
  showBack = false,
  onBackPress,
  leftComponent,
  rightComponent,
  showLogo = true,
}) => {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }

    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  };

  /* ==========================================================
     SLOT GAUCHE
  ========================================================== */

  const renderLeftSlot = () => {
    if (showBack) {
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleBack}
          style={styles.sideButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      );
    }

    if (leftComponent) {
      return (
        <View style={styles.sideSlot}>
          {leftComponent}
        </View>
      );
    }

    return <View style={styles.sideSlotEmpty} />;
  };

  /* ==========================================================
     SLOT DROIT
  ========================================================== */

  const renderRightSlot = () => {
    if (rightComponent) {
      return (
        <View style={styles.sideSlot}>
          {rightComponent}
        </View>
      );
    }

    return <View style={styles.sideSlotEmpty} />;
  };

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: PRIMARY,
          borderBottomColor: PRIMARY_DARK,
        },
      ]}
    >
      <View style={styles.headerContent}>
        {renderLeftSlot()}

        <View style={styles.headerBrand}>
          {showLogo && (
            <View style={styles.headerLogo}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.headerLogoImage}
                resizeMode="contain"
              />
            </View>
          )}

          <View style={styles.headerBrandTexts}>
            <Text
              numberOfLines={1}
              style={styles.headerTitle}
            >
              {title || 'Mada Bien-être'}
            </Text>

            {!!subtitle && (
              <Text
                numberOfLines={1}
                style={styles.headerSubtitle}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {renderRightSlot()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop:
      Platform.OS === 'ios'
        ? 48
        : Platform.OS === 'android'
          ? 30
          : 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },

  headerContent: {
    minHeight: 48,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  /* Boutons latéraux : même largeur des deux côtés pour garder
     le bloc central parfaitement centré. */
  sideButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },

  sideSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sideSlotEmpty: {
    width: 40,
    height: 40,
  },

  headerBrand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  headerLogo: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },

  headerLogoImage: {
    width: 30,
    height: 30,
  },

  headerBrandTexts: {
    flexShrink: 1,
    alignItems: 'center',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
  },

  headerSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 8,
    marginTop: 2,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
  },
});

export default Header;