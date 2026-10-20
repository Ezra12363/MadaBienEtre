// src/components/payment/PaymentStatusBadge.js
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PAY_STATE } from './paymentUtils';

export default function PaymentStatusBadge({ state = 'pending', small = false, style }) {
  const meta = PAY_STATE[state] || PAY_STATE.pending;
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }, small && styles.small, style]}>
      <Ionicons name={meta.icon} size={small ? 11 : 13} color={meta.color} />
      <Text style={[styles.text, { color: meta.color }, small && styles.textSmall]}>{meta.label}</Text>
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
