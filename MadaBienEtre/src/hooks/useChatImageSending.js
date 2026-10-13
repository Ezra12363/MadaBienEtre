// src/hooks/useChatImageSending.js
// Logique partagée « joindre une image » des deux ChatScreen :
// choisir -> valider -> aperçu -> confirmer -> envoi optimiste (useChatRoom).
import { useCallback, useState } from 'react';

import { pickChatImage, validateChatImage } from '../utils/chatImage';

export default function useChatImageSending({ sendImage, onError }) {
  const [pendingAsset, setPendingAsset] = useState(null);
  const [isPicking, setIsPicking] = useState(false);

  const pickImage = useCallback(async () => {
    if (isPicking) return;
    setIsPicking(true);
    try {
      const result = await pickChatImage();
      if (!result) return; // annulé
      if (result.error) {
        onError?.(result.error);
        return;
      }
      const check = validateChatImage(result.asset);
      if (!check.ok) {
        onError?.(check.error);
        return;
      }
      setPendingAsset(result.asset);
    } catch (error) {
      onError?.(error?.message || "Impossible de choisir l'image.");
    } finally {
      setIsPicking(false);
    }
  }, [isPicking, onError]);

  const cancelPreview = useCallback(() => setPendingAsset(null), []);

  const confirmSend = useCallback(async () => {
    const asset = pendingAsset;
    if (!asset) return;
    setPendingAsset(null); // la bulle « Envoi… » prend le relais
    const ok = await sendImage(asset);
    if (!ok) {
      onError?.("L'image n'a pas pu être envoyée. Appuyez sur le message pour réessayer.");
    }
  }, [pendingAsset, sendImage, onError]);

  return { pendingAsset, isPicking, pickImage, cancelPreview, confirmSend };
}
