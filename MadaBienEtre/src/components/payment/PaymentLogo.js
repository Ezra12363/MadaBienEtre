// src/components/payment/PaymentLogo.js
//
// Vignette d'un moyen de paiement : logo officiel (voir
// src/constants/paymentLogos.js) ou, à défaut, icône générique.
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import PAYMENT_LOGOS from '../../constants/paymentLogos';

// Icônes génériques (carte, espèces) + repli des opérateurs mobile money
const FALLBACK = {
  mvola: { icon: 'phone-portrait-outline', color: '#2E8B57' },
  orange_money: { icon: 'phone-portrait-outline', color: '#2E8B57' },
  airtel_money: { icon: 'phone-portrait-outline', color: '#2E8B57' },
  card: { icon: 'card', color: '#1D6FD1' },
  cash: { icon: 'cash', color: '#2E8B57' },
};

const PaymentLogo = ({ id, size = 44 }) => {
  const logo = PAYMENT_LOGOS[id];
  const fb = FALLBACK[id] || FALLBACK.card;
  const radius = Math.round(size * 0.24);

  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: radius },
        logo ? styles.boxLogo : { backgroundColor: `${fb.color}14` },
      ]}
    >
      {logo ? (
        <Image
          source={logo}
          style={{ width: size - 6, height: size - 6 }}
          resizeMode="contain"
          accessibilityLabel={id}
        />
      ) : (
        <Ionicons name={fb.icon} size={Math.round(size * 0.55)} color={fb.color} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boxLogo: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
});

export default PaymentLogo;
