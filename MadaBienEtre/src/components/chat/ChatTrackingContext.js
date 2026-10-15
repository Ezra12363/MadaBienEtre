// src/components/chat/ChatTrackingContext.js
// Permet à une bulle « position en route » (LocationMessageCard) d'ouvrir le suivi
// du client (TrackingScreen) sans faire descendre de props dans toute la chaîne
// ChatRoomView -> MessageBubble -> ChatMessageContent -> LocationMessageCard.
// Fourni par ChatRoomView UNIQUEMENT pour le client ; null pour le thérapeute.
import { createContext, useContext } from 'react';

const ChatTrackingContext = createContext(null);

export const ChatTrackingProvider = ChatTrackingContext.Provider;

// -> { openTracking({ latitude, longitude, address }) } ou null
export const useChatTracking = () => useContext(ChatTrackingContext);

export default ChatTrackingContext;
