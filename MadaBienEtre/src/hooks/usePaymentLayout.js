// src/hooks/usePaymentLayout.js
// Mise en page adaptative Web / tablette / mobile pour les écrans « argent ».
import { useWindowDimensions } from 'react-native';

export default function usePaymentLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900; // ordinateur / tablette paysage
  const isTablet = width >= 600;
  const columns = width >= 1280 ? 4 : width >= 900 ? 3 : 2; // tuiles de chiffres
  const pad = width >= 1280 ? 32 : width >= 900 ? 24 : 16;
  return { width, isWide, isTablet, columns, pad };
}
