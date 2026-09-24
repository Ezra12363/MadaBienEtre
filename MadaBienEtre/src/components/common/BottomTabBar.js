// src/components/common/BottomTabBar.js
//
// Barre de navigation EN BAS, identique sur le web et sur mobile
// (Android / iOS). Partagée par AdminNavigator, ClientNavigator et
// TherapistNavigator.
//
// Aspect : icône dans une pastille teintée, libellé, et petit
// indicateur en bas de l'onglet actif.
//
// Utilisation dans un navigator :
//
//   <Tab.Navigator
//     tabBar={(props) => (
//       <BottomTabBar
//         {...props}
//         visible={tabBarVisible}
//         getIcon={getTabIcon}
//         getLabel={getTabLabel}
//       />
//     )}
//   >

import { useEffect, useRef } from 'react';

import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme';

const ANIMATION_DURATION = 220;
const HIDE_TRANSLATE_Y = 100;

const BottomTabBar = ({
  state,
  descriptors,
  navigation,
  visible = true,
  getIcon,
  getLabel,
}) => {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useTheme();

  const bottomInset = Math.max(insets.bottom || 0, 0);
  const tabHeight = Platform.OS === 'web' ? 72 : 66 + bottomInset;

  const activeColor = colors?.primary || '#168A55';
  const inactiveColor = themeColors.textSecondary || '#7A8194';

  const borderColor =
    themeColors.border ||
    (isDark ? 'rgba(255,255,255,0.08)' : '#E7E9EF');

  // ==========================================================
  // ANIMATION (masquage / affichage au scroll)
  // ==========================================================

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const previousVisibility = useRef(true);

  useEffect(() => {
    if (previousVisibility.current === visible) {
      return;
    }

    previousVisibility.current = visible;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : HIDE_TRANSLATE_Y,
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [visible, translateY, opacity]);

  // ==========================================================
  // RENDER
  // ==========================================================

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
      <Animated.View
        style={[
          styles.bar,
          {
            height: tabHeight,
            paddingBottom:
              Platform.OS === 'web' ? 8 : bottomInset + 5,
            backgroundColor: themeColors.surface,
            borderTopColor: borderColor,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <View style={styles.inner}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;

            const label = getLabel
              ? getLabel(route.name)
              : options.tabBarLabel ?? route.name;

            const iconName = getIcon
              ? getIcon(route.name, focused)
              : focused
              ? 'ellipse'
              : 'ellipse-outline';

            const color = focused ? activeColor : inactiveColor;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={
                  options.tabBarAccessibilityLabel || label
                }
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
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
                    name={iconName}
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
                  {label}
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
      </Animated.View>
    </View>
  );
};

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

export default BottomTabBar;