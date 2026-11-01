// src/components/common/LiveShareChip.js
// ============================================================
// Signal « partage de position en direct », affiché dans les en-têtes
// (Header, AppHeader, TopNavBar) du CLIENT et du THÉRAPEUTE, sur toutes
// les pages, tant que le thérapeute n'a pas arrêté le partage.
//
//   - Thérapeute : « Partage en direct »  -> ouvre la page Navigation
//   - Client     : « Thérapeute en direct » -> ouvre le suivi (Tracking)
//   - Point rouge qui pulse ; orange « Reconnexion… » si la liaison saute.
// ============================================================
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useLiveSharing } from '../../context/LiveSharingContext';

const THEMES = {
  // fond vert / foncé (Android, iOS, web étroit, TopNavBar)
  onDark: {
    bg: 'rgba(255,255,255,0.20)',
    border: 'rgba(255,255,255,0.45)',
    text: '#FFFFFF',
    dot: '#FF5252',
    warn: '#FFB74D',
  },
  // fond blanc (web large)
  onLight: {
    bg: 'rgba(211,47,47,0.10)',
    border: 'rgba(211,47,47,0.35)',
    text: '#B71C1C',
    dot: '#D32F2F',
    warn: '#E65100',
  },
};

function PulseDot({ color }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 2.4, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.halo, { backgroundColor: color, opacity, transform: [{ scale }] }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * @param {{ variant?: 'onDark'|'onLight', compact?: boolean, navigation?: object, style?: object }} props
 *  compact : point + « Direct » seulement (petits en-têtes)
 *  navigation : navigation à utiliser pour ouvrir la page (sinon useNavigation)
 */
export default function LiveShareChip({ variant = 'onDark', compact = false, navigation: navProp, style }) {
  const live = useLiveSharing();

  let hookNav = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    hookNav = useNavigation();
  } catch (_e) {
    hookNav = null;
  }
  const navigation = navProp || hookNav;

  if (!live.active) return null;

  const theme = THEMES[variant] || THEMES.onDark;
  const reconnecting = live.isTherapist && ['reconnecting', 'connecting'].includes(live.status);
  const dotColor = reconnecting ? theme.warn : theme.dot;

  const label = reconnecting
    ? 'Reconnexion…'
    : live.isTherapist
      ? compact
        ? 'Direct'
        : 'Partage en direct'
      : compact
        ? 'Direct'
        : 'Thérapeute en direct';

  const open = () => {
    if (!navigation?.navigate) return;
    try {
      if (live.isTherapist) {
        const s = live.session || {};
        const params = {
          bookingId: s.bookingId,
          clientName: s.clientName,
          clientId: s.clientId,
          clientAddress: s.clientAddress,
          clientLatitude: s.clientLatitude,
          clientLongitude: s.clientLongitude,
        };
        // « Navigation » existe dans l'onglet Demandes ; repli : pile courante
        try {
          navigation.navigate('Demandes', { screen: 'Navigation', params });
        } catch (_e) {
          navigation.navigate('Navigation', params);
        }
      } else if (live.bookingId) {
        navigation.navigate('Tracking', { bookingId: live.bookingId });
      }
    } catch (_e) {
      /* navigation indisponible depuis cet écran */
    }
  };

  const a11y = live.isTherapist
    ? 'Votre position est partagée en direct avec le client. Ouvrir la navigation.'
    : `${live.peerName || 'Votre thérapeute'} partage sa position en direct. Ouvrir le suivi.`;

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={[styles.chip, { backgroundColor: theme.bg, borderColor: theme.border }, style]}
    >
      <PulseDot color={dotColor} />
      <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.label, { color: theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    flexShrink: 0, // ne jamais être écrasé par le titre / les autres boutons
    gap: 7,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
});
