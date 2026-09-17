// src/components/common/TherapistBottomMenu.js
//
// ============================================================
// MENU AMBANY "STATIQUE" — ho an'ny écran ivelan'ny Tab.Navigator
// ============================================================
//
// Ny "Navigation" sy "Tracking" (NavigationScreen.js,
// TrackingScreen.js) dia napetraka tao amin'ny STACK ROOT,
// ivelan'ny Tab.Navigator (jereo TherapistNavigator.js) — mba
// tsy hamadika ny tab actif intsony rehefa miditra ao amin'ireo
// écran ireo (jereo ny fanazavana tao amin'ny fanovana teo
// aloha). Vokatr'izany anefa dia tsy miseho intsony ilay menu
// ambany (bottom tab bar) rehefa ao anaty ireo écran ireo,
// satria efitrano tsotra ("Stack.Screen" tsotra) izy ireo, fa
// tsy Tab.Screen.
//
// Ity component ity dia:
//   - Manolotra endrika MITOVY amin'ny tab bar tena izy
//     (icône + lipika + "active indicator") ho an'ny 5 tab
//     ("Tableau de bord", "Demandes", "Calendrier", "Gains",
//     "Profil"),
//   - Tsy mila "state/descriptors" avy amin'ny Tab.Navigator —
//     mandray "activeTab" (anarana tab) sy "navigation" fotsiny
//     amin'ny props,
//   - Rehefa tsindriana ny bouton, dia miverina any amin'ny tab
//     voatondro amin'ny alalan'ny
//     navigation.navigate('TherapistTabs', { screen: tabName })
//     — "TherapistTabs" no anaran'ny écran mifono ny
//     Tab.Navigator ao amin'ny stack root (jereo
//     TherapistNavigator.js) — izay tsy mamerina/mamorona
//     "instance" vaovao fa "miverina" fotsiny amin'ilay
//     Tab.Navigator efa nisy, ka tsy very ny état an'ny tab
//     hafa (ohatra: Calendrier miverina any amin'ny
//     BookingDetail raha tany izy taloha).
// ============================================================

import React from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme';

// ============================================================
// TABS — mitovy amin'ny voalaza ao amin'ny TherapistNavigator.js
// ============================================================

const TAB_ROUTES = [
  'Tableau de bord',
  'Demandes',
  'Calendrier',
  'Gains',
  'Profil',
];

const getTabIcon = (routeName, focused) => {
  switch (routeName) {
    case 'Tableau de bord':
      return focused ? 'grid' : 'grid-outline';
    case 'Demandes':
      return focused ? 'chatbubbles' : 'chatbubbles-outline';
    case 'Calendrier':
      return focused ? 'calendar' : 'calendar-outline';
    case 'Gains':
      return focused ? 'wallet' : 'wallet-outline';
    case 'Profil':
      return focused ? 'person' : 'person-outline';
    default:
      return 'grid-outline';
  }
};

// ============================================================
// COMPONENT
// ============================================================

export default function TherapistBottomMenu({
  navigation,
  activeTab,
}) {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useTheme();

  const bottomInset = Math.max(insets.bottom || 0, 0);

  const tabHeight =
    Platform.OS === 'web' ? 72 : 66 + bottomInset;

  const activeColor = colors?.primary || '#0D2B7E';
  const inactiveColor = themeColors.textSecondary || '#7A8194';

  const goToTab = (tabName) => {
    if (!navigation) return;
    if (tabName === activeTab) return;

    // ✅ Miverina any amin'ny Tab.Navigator (écran "TherapistTabs"
    // ao amin'ny stack root), amin'ilay tab voatondro — tsy
    // manova/manapotika ny état an'ny tab hafa.
    navigation.navigate('TherapistTabs', { screen: tabName });
  };

  return (
    <View
      style={[
        styles.wrapper,
        {
          height: tabHeight,
          backgroundColor: themeColors.background,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          {
            height: tabHeight,
            paddingBottom:
              Platform.OS === 'web' ? 8 : bottomInset + 5,
            backgroundColor: themeColors.surface,
            borderTopColor:
              themeColors.border ||
              (isDark ? 'rgba(255,255,255,0.08)' : '#E7E9EF'),
          },
        ]}
      >
        <View style={styles.inner}>
          {TAB_ROUTES.map((tabName) => {
            const focused = tabName === activeTab;
            const color = focused ? activeColor : inactiveColor;

            return (
              <TouchableOpacity
                key={tabName}
                accessibilityRole="button"
                accessibilityState={
                  focused ? { selected: true } : {}
                }
                accessibilityLabel={tabName}
                onPress={() => goToTab(tabName)}
                activeOpacity={0.72}
                style={styles.button}
              >
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: focused
                        ? `${activeColor}16`
                        : 'transparent',
                    },
                  ]}
                >
                  <Ionicons
                    name={getTabIcon(tabName, focused)}
                    size={focused ? 23 : 22}
                    color={color}
                  />
                </View>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    {
                      color,
                      fontWeight: focused ? '700' : '500',
                    },
                  ]}
                >
                  {tabName}
                </Text>

                {focused ? (
                  <View
                    style={[
                      styles.activeIndicator,
                      { backgroundColor: activeColor },
                    ]}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    overflow: 'hidden',
  },

  bar: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },

  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },

  button: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 5,
    paddingHorizontal: 2,
  },

  iconContainer: {
    width: 42,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  label: {
    fontSize: Platform.OS === 'web' ? 11 : 10,
    lineHeight: 14,
    textAlign: 'center',
    includeFontPadding: false,
    maxWidth: 100,
  },

  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 24,
    height: 3,
    borderRadius: 3,
  },
});