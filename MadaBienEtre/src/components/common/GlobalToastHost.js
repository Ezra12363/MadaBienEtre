// src/components/common/GlobalToastHost.js
// ============================================================================
// Affiche les toasts émis par utils/toast.js.
// À monter UNE seule fois, tout en haut de l'app (App.js).
//
//  - WEB uniquement : même position (haut, centré) et même design sur toutes
//    les pages. La couleur dépend de l'action :
//        success -> vert      error / delete -> rouge
//        warning -> orange    info           -> bleu
//  - Android / iOS : ne rend rien (aucun toast sur l'application mobile).
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { subscribeToast, TOAST_ENABLED } from '../../utils/toast';

export const TOAST_THEME = {
  success: { bg: '#2E8B57', icon: 'checkmark-circle', label: 'Succès' },
  error: { bg: '#D32F2F', icon: 'alert-circle', label: 'Erreur' },
  delete: { bg: '#D32F2F', icon: 'trash', label: 'Suppression' },
  warning: { bg: '#F57C00', icon: 'warning', label: 'Attention' },
  info: { bg: '#1976D2', icon: 'information-circle', label: 'Information' },
};

const DURATION = { error: 5500, delete: 4000, warning: 5000, success: 3800, info: 4000 };

const GlobalToastHost = () => {
  const [toast, setToast] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: false }).start(() => setToast(null));
  }, [anim]);

  useEffect(() => {
    if (!TOAST_ENABLED) return undefined;
    const off = subscribeToast((t) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(t);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
      timer.current = setTimeout(hide, t.duration || DURATION[t.type] || 4000);
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [anim, hide]);

  // Application Android / iOS : aucun toast
  if (Platform.OS !== 'web' || !toast) return null;
  const look = TOAST_THEME[toast.type] || TOAST_THEME.info;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: look.bg }]}>
        <View style={styles.iconBubble}>
          <Ionicons name={look.icon} size={20} color="#fff" />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title}>{toast.title || look.label}</Text>
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
    position: 'fixed',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    paddingHorizontal: 12,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  texts: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  message: { color: '#fff', fontSize: 13, lineHeight: 18 },
});

export default GlobalToastHost;
