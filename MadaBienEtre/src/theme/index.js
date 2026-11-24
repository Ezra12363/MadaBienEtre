// src/theme/index.js
import { Platform } from 'react-native';
import { DefaultTheme, configureFonts } from 'react-native-paper';

export const colors = {
  primary: '#2E8B57',
  primaryLight: '#4FA06F',
  primaryDark: '#247447',
  secondary: '#FF6F00',
  secondaryLight: '#FFA726',
  accent: '#00897B',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceLight: '#FAFAFA',
  error: '#D32F2F',
  success: '#2E8B57',
  warning: '#F57C00',
  info: '#1976D2',
  text: '#1A1A1A',
  textSecondary: '#757575',
  textLight: '#FFFFFF',
  border: '#E0E0E0',
  shadow: 'rgba(0,0,0,0.1)',
  card: '#FFFFFF',
  input: '#F5F5F5',
  placeholder: '#999999',
  disabled: '#BDBDBD',
  divider: '#EEEEEE',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// ============================================================
// POLICE UNIQUE DU PROJET : TIMES NEW ROMAN
//  - Web  : Times New Roman (repli : Tinos / Liberation Serif / Times / serif)
//  - iOS  : Times New Roman (police système d'iOS)
//  - Android : Times New Roman n'existe pas sur Android ; on embarque
//    Tinos (clone métrique de Times New Roman, licence Apache 2.0),
//    chargé dans App.js sous les noms « Tinos-Regular » / « Tinos-Bold ».
// Toutes les familles passent par typography.fontFamily : pour changer de
// police dans toute l'application, il suffit de modifier ce bloc.
// ============================================================
export const WEB_FONT_STACK =
  "'Times New Roman', Times, Tinos, 'Liberation Serif', serif";

const ANDROID_FONT = {
  regular: 'Tinos-Regular',
  medium: 'Tinos-Regular',
  light: 'Tinos-Regular',
  semiBold: 'Tinos-Bold',
  bold: 'Tinos-Bold',
};

export const pickFont = (weight = 'regular') =>
  Platform.select({
    web: WEB_FONT_STACK,
    ios: 'Times New Roman',
    android: ANDROID_FONT[weight] || ANDROID_FONT.regular,
    default: WEB_FONT_STACK,
  });

export const typography = {
  fontFamily: {
    regular: pickFont('regular'),
    medium: pickFont('medium'),
    semiBold: pickFont('semiBold'),
    bold: pickFont('bold'),
    light: pickFont('light'),
  },
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
  },
  lineHeight: {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
    xxl: 32,
    xxxl: 40,
    display: 48,
  },
};

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const theme = {
  ...DefaultTheme,
  fonts: configureFonts({ config: { fontFamily: pickFont('regular') } }),
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    accent: colors.accent,
    background: colors.background,
    surface: colors.surface,
    error: colors.error,
    text: colors.text,
  },
  roundness: 12,
};

export default {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
  theme,
};