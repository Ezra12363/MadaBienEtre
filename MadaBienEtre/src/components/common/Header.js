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
      <View style={styles.content}>
        <View style={styles.sideSlot}>
          {showBack ? (
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.8}
              style={styles.backButton}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
              accessibilityRole="button"
              accessibilityLabel="Retour"
            >
              <Ionicons
                name="arrow-back"
                size={23}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          ) : (
            leftComponent || null
          )}
        </View>

        <View style={styles.brand}>
          {showLogo ? (
            <View style={styles.logoBox}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          ) : null}

          <View style={styles.brandText}>
            <Text
              numberOfLines={1}
              style={styles.title}
            >
              {title || 'Mada Bien-être'}
            </Text>

            {subtitle ? (
              <Text
                numberOfLines={1}
                style={styles.subtitle}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.sideSlot}>
          {rightComponent || null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    width: '100%',
    paddingTop:
      Platform.OS === 'ios'
        ? 46
        : Platform.OS === 'android'
        ? 28
        : 10,
    paddingBottom: 9,
    borderBottomWidth: 1,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    zIndex: 100,
  },

  content: {
    width: '100%',
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  sideSlot: {
    width: 44,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },

  logo: {
    width: 29,
    height: 29,
  },

  brandText: {
    minWidth: 0,
    maxWidth: '75%',
    alignItems: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
  },

  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default Header;