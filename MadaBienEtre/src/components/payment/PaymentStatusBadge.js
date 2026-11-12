// src/components/payment/PaymentStatusBadge.js
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PAY_STATE } from './paymentUtils';
import { useTheme } from '../../context/ThemeContext';

// Mode sombre : texte éclairci (le fond devient une teinte translucide)
const DARK_TEXT = {
  '#2E8B57': '#5FD08C',
  '#B7791F': '#F5B14C',
  '#5B6B7A': '#B8C4CF',
};

export default function PaymentStatusBadge({ state = 'pending', small = false, style }) {
  const meta = PAY_STATE[state] || PAY_STATE.pending;
  const isDark = !!useTheme?.()?.isDark;
  const color = isDark ? DARK_TEXT[meta.color] || meta.color : meta.color;
  const bg = isDark ? `${meta.color}33` : meta.bg;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, small && styles.small, style]}>
      <Ionicons name={meta.icon} size={small ? 11 : 13} color={color} />
      <Text style={[styles.text, { color }, small && styles.textSmall]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  small: { paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 12, fontWeight: '400', letterSpacing: 0.2 },
  textSmall: { fontSize: 11 },
});
