// src/components/common/GlobalConfirmHost.js
// Modale de confirmation de l'application (remplace window.confirm du navigateur
// et Alert.alert) pour utils/chatImage.confirmAsync().
// À monter UNE fois dans App.js : toutes les confirmations (confirmAsync / confirmAction)
// passent par cette modale, sur le web comme sur mobile.
import { useCallback, useEffect, useRef, useState } from 'react';

import ConfirmDialog from './ConfirmDialog';
import { useTheme } from '../../context/ThemeContext';
import { registerGlobalConfirmHandler } from '../../utils/chatImage';

const GlobalConfirmHost = () => {
  const { colors: themeColors } = useTheme();
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const close = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    if (resolve) resolve(result);
  }, []);

  useEffect(() => {
    const unregister = registerGlobalConfirmHandler(
      (options) =>
        new Promise((resolve) => {
          // une confirmation à la fois : la précédente est annulée
          if (resolverRef.current) resolverRef.current(false);
          resolverRef.current = resolve;
          setDialog(options);
        })
    );
    return () => {
      unregister();
      if (resolverRef.current) resolverRef.current(false);
      resolverRef.current = null;
    };
  }, []);

  return (
    <ConfirmDialog
      visible={Boolean(dialog)}
      title={dialog?.title || ''}
      message={dialog?.message || ''}
      confirmLabel={dialog?.confirmLabel || 'Confirmer'}
      cancelLabel={dialog?.cancelLabel || 'Annuler'}
      tone={dialog?.tone || 'danger'}
      icon={dialog?.icon || null}
      themeColors={themeColors}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
};

export default GlobalConfirmHost;
