// src/components/common/ToastBanner.js
// Toast affiché DANS la page (web + mobile), qui disparaît tout seul.
// Usage :  const { toast, showToast } = useToast();  ...  {toast}  /  showToast('success', 'Message');
import { useState, useRef, useCallback, useEffect } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../theme';

const STYLES = {
  success: { bg: '#1E8E4E', icon: 'checkmark-circle' },
  error: { bg: '#C62828', icon: 'alert-circle' },
  info: { bg: '#1E6FD9', icon: 'information-circle' },
};

export const useToast = (duration = 4000) => {
  const [data, setData] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setData(null));
  }, [anim]);

  const showToast = useCallback((type, message) => {
    if (timer.current) clearTimeout(timer.current);
    setData({ type: STYLES[type] ? type : 'info', message: String(message || '') });
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    timer.current = setTimeout(hide, duration);
  }, [anim, hide, duration]);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const toast = data ? (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: STYLES[data.type].bg }]}>
        <Ionicons name={STYLES[data.type].icon} size={22} color="#fff" />
        <Text style={styles.text}>{data.message}</Text>
        <TouchableOpacity onPress={hide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  ) : null;

  return { toast, showToast };
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 20,
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
  text: { flex: 1, color: '#fff', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },
});

export default useToast;
