// src/utils/confirm.js
// Alert.alert avec boutons ne fait RIEN sur le web (react-native-web) :
// sur le web on utilise window.confirm, sur mobile Alert.alert.
import { Alert, Platform } from 'react-native';

export const confirmAction = ({ title, message, confirmText = 'Confirmer', cancelText = 'Annuler', destructive = false, onConfirm }) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-undef
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message || ''}`)) onConfirm && onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
};

export const notify = (title, message) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-undef
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message || ''}`);
    return;
  }
  Alert.alert(title, message);
};
