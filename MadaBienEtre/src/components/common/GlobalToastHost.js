// src/components/common/GlobalToastHost.js
// Affiche les toasts émis par utils/toast.js. À monter UNE fois, tout en haut de l'app.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { subscribeToast } from '../../utils/toast';

const THEME = {
  success: { bg: '#2E8B57', icon: 'checkmark-circle' },
  error: { bg: '#C62828', icon: 'alert-circle' },
  info: { bg: '#1E6FD9', icon: 'information-circle' },
};

const GlobalToastHost = () => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' })
      .start(() => setToast(null));
  }, [anim]);

  useEffect(() => {
    const off = subscribeToast((t) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(t);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
      timer.current = setTimeout(hide, t.type === 'error' ? 5500 : 4000);
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [anim, hide]);

  if (!toast) return null;
  const look = THEME[toast.type] || THEME.info;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: Platform.OS === 'web' ? 16 : Math.max(insets.top, 24) + 8,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: look.bg }]}>
        <Ionicons name={look.icon} size={22} color="#fff" />
        <View style={styles.texts}>
          {!!toast.title && <Text style={styles.title}>{toast.title}</Text>}
          <Text style={styles.message}>{toast.message}</Text>
        </View>
        <TouchableOpacity onPress={hide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Fermer">
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 50,
    paddingHorizontal: 12,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 520,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  texts: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  message: { color: '#fff', fontSize: 13, lineHeight: 18 },
});

export default GlobalToastHost;
