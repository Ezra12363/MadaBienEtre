// src/utils/confirm.js
// Confirmation = modale de l'application (GlobalConfirmHost), web et mobile.
import { Alert, Platform } from 'react-native';

import { confirmAsync } from './chatImage';

export const confirmAction = ({ title, message, confirmText = 'Confirmer', cancelText = 'Annuler', destructive = false, onConfirm }) => {
  // Modale de l'application (web + mobile) au lieu de window.confirm / Alert.alert.
  confirmAsync(title, message || '', confirmText, {
    cancelLabel: cancelText,
    tone: destructive ? 'danger' : 'info',
  }).then((ok) => {
    if (ok && onConfirm) onConfirm();
  });
};

export const notify = (title, message) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-undef
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message || ''}`);
    return;
  }
  Alert.alert(title, message);
};
