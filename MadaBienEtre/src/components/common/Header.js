import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors, typography } from '../../theme';

/* =========================================================
   COLORS — thème RESPONSIVE du header
   ---------------------------------------------------------
   - WEB + GRAND ÉCRAN (>= WEB_LARGE_BREAKPOINT)  :
       fond BLANC, texte/icônes en VERT.
   - WEB + PETIT ÉCRAN (< WEB_LARGE_BREAKPOINT),
     ANDROID, iOS :
       fond VERT, texte/icônes en BLANC.
   Le contraste texte/bouton reste toujours net, quelle que
   soit la taille de l'écran ou la plateforme.
========================================================= */

const GREEN = colors.primary || '#168A55';
const GREEN_DARK = '#0B633C';

// Doit correspondre au seuil "isMobile" utilisé ailleurs
// dans l'application (ex: OffersScreen) pour rester cohérent.
const WEB_LARGE_BREAKPOINT = 850;

const getHeaderColors = isLargeWebScreen => {
  if (isLargeWebScreen) {
    // ---- WEB / GRAND ÉCRAN : fond blanc, texte/icônes verts ----
    return {
      headerBg: '#FFFFFF',
      borderColor: '#E3E7E4',

      titleColor: GREEN_DARK,
      subtitleColor: 'rgba(11,99,60,0.65)',
      iconColor: GREEN_DARK,

      backButtonBg: 'rgba(11,99,60,0.08)',
      backButtonBorder: 'rgba(11,99,60,0.18)',

      logoBoxBg: 'rgba(11,99,60,0.08)',
    };
  }

  // ---- PETIT ÉCRAN WEB, ANDROID, iOS : fond vert, texte/icônes blancs ----
  return {
    headerBg: GREEN,
    borderColor: GREEN_DARK,

    titleColor: '#FFFFFF',
    subtitleColor: 'rgba(255,255,255,0.80)',
    iconColor: '#FFFFFF',

    backButtonBg: 'rgba(255,255,255,0.18)',
    backButtonBorder: 'rgba(255,255,255,0.32)',

    logoBoxBg: 'rgba(255,255,255,0.18)',
  };
};

const Header = ({
  title,
  subtitle,
  showBack = false,
  onBackPress,
  leftComponent,
  rightComponent,
  showLogo = false,
}) => {
  const navigation = useNavigation();

  // ✅ Largeur réelle de la fenêtre — permet de savoir si on est
  // sur un "grand écran" web (ordinateur) ou un "petit écran"
  // (web mobile, ou app Android/iOS).
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';

  const isLargeWebScreen =
    isWeb && width >= WEB_LARGE_BREAKPOINT;

  const HEADER_COLORS = getHeaderColors(isLargeWebScreen);

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
          backgroundColor: HEADER_COLORS.headerBg,
          borderBottomColor: HEADER_COLORS.borderColor,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.sideSlot}>
          {showBack ? (
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.8}
              style={[
                styles.backButton,
                {
                  backgroundColor: HEADER_COLORS.backButtonBg,
                  borderColor: HEADER_COLORS.backButtonBorder,
                },
              ]}
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
                color={HEADER_COLORS.iconColor}
              />
            </TouchableOpacity>
          ) : (
            leftComponent || null
          )}
        </View>

        <View style={styles.brand}>
          {showLogo ? (
            <View
              style={[
                styles.logoBox,
                {
                  backgroundColor: HEADER_COLORS.logoBoxBg,
                },
              ]}
            >
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
              style={[
                styles.title,
                {
                  color: HEADER_COLORS.titleColor,
                },
              ]}
            >
              {title || 'Mada Bien-être'}
            </Text>

            {subtitle ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.subtitle,
                  {
                    color: HEADER_COLORS.subtitleColor,
                  },
                ]}
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

    shadowOpacity: 0.08,

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

    borderWidth: 1,
  },

  brand: {
    flex: 1,

    minWidth: 0,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  logoBox: {
    width: 32,
    height: 32,

    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 8,

    overflow: 'hidden',
  },

  logo: {
    width: 24,
    height: 24,
  },

  brandText: {
    minWidth: 0,

    maxWidth: '75%',

    alignItems: 'center',
  },

  title: {
    fontSize: 15,

    fontWeight: '800',

    fontFamily:
      typography.fontFamily.bold,

    textAlign: 'center',
  },

  subtitle: {
    fontSize: 9,

    marginTop: 2,

    textAlign: 'center',

    fontFamily:
      typography.fontFamily.regular,
  },
});

export default Header;