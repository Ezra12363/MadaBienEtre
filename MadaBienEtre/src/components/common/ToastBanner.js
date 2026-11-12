// src/components/common/ToastBanner.js
// Ancien toast "dans la page" : il délègue maintenant au toast GLOBAL
// (utils/toast.js) pour que toutes les pages aient exactement le même rendu.
// Usage inchangé :  const { toast, showToast } = useToast();  ...  {toast}
import { useCallback } from 'react';
import { showToast as globalShowToast } from '../../utils/toast';

export const useToast = () => {
  const showToast = useCallback((type, message) => globalShowToast(type, '', message), []);
  // `toast` reste null : l'affichage est assuré par <GlobalToastHost /> (App.js).
  return { toast: null, showToast };
};

export default useToast;
