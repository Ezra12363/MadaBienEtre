// src/hooks/useShareToChat.js
// Partage dans la messagerie, utilisé par l'historique client, le suivi client
// et la navigation thérapeute :
//   shareBooking(bookingId, peer)       -> adresse + informations de la réservation
//   shareLivePosition(bookingId, pos, peer) -> position GPS actuelle (thérapeute en route)
//   shareBookingAndPosition(bookingId, pos, peer)
//                                       -> adresse/infos + position « en route » (thérapeute)
// Après un partage réussi : modale « Voir la conversation » qui ouvre la messagerie.
import { useCallback, useRef, useState } from 'react';

import ChatConfirmHost from '../components/chat/ChatConfirmHost';
import chatService from '../services/chatService';
import { confirmAsync } from '../utils/chatImage';
import { notifyInfo } from '../utils/chatUi';

const newClientId = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function useShareToChat({ navigation, role = 'client' }) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // ✅ FIX : côté client, l'écran de discussion « ChatDetail » vit dans l'onglet
  // « Messages » (ChatStack). Depuis l'onglet Historique / Accueil / Profil,
  // navigate('ChatDetail') ne trouvait aucune route -> la conversation ne
  // s'ouvrait jamais. On cible donc explicitement l'onglet Messages.
  const openChat = useCallback(
    (bookingId, peer = {}) => {
      const params = {
        bookingId,
        otherUserId: peer.id ?? undefined,
        otherName: peer.name || undefined,
        otherPhoto: peer.photo || undefined,
      };

      if (role === 'therapist') {
        navigation?.navigate?.('TherapistChat', params);
        return;
      }

      navigation?.navigate?.('Messages', {
        screen: 'ChatDetail',
        params,
        // la liste des conversations reste sous la discussion (bouton retour)
        initial: false,
      });
    },
    [navigation, role]
  );

  const run = useCallback(
    async (bookingId, peer, send, doneTitle) => {
      if (busyRef.current || !bookingId) return false;
      busyRef.current = true;
      setBusy(true);
      try {
        const res = await send();
        if (!res.success) {
          notifyInfo('Partage impossible', res.error || 'Réessayez dans un instant.');
          return false;
        }
        // Modale affichée IMMÉDIATEMENT après le partage
        const open = await confirmAsync(
          doneTitle,
          'Le message a été envoyé dans la messagerie.',
          'Voir la conversation',
          { tone: 'info', cancelLabel: 'Rester ici', icon: 'chatbubbles-outline' }
        );
        if (open) openChat(bookingId, peer);
        return true;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [openChat]
  );

  const sendLive = (bookingId, position) =>
    chatService.sendLocation(bookingId, {
      latitude: position.latitude,
      longitude: position.longitude,
      address: position.address || null,
      locationType: 'live', // « live » = thérapeute en route
      clientId: newClientId(),
    });

  const shareBooking = useCallback(
    (bookingId, peer) =>
      run(bookingId, peer, () => chatService.shareBooking(bookingId), 'Réservation partagée ✓'),
    [run]
  );

  const shareLivePosition = useCallback(
    (bookingId, position, peer) =>
      run(bookingId, peer, () => sendLive(bookingId, position), 'Position en route partagée ✓'),
    [run]
  );

  // Thérapeute : partager l'adresse de la réservation ET sa position en route.
  // Le client reçoit les deux messages ; la position en route ouvre le suivi
  // (TrackingScreen) au toucher.
  const shareBookingAndPosition = useCallback(
    (bookingId, position, peer) =>
      run(
        bookingId,
        peer,
        async () => {
          const first = await chatService.shareBooking(bookingId);
          if (!first.success) return first;
          const hasPos =
            position && Number.isFinite(position.latitude) && Number.isFinite(position.longitude);
          if (!hasPos) return first;
          const second = await sendLive(bookingId, position);
          // l'adresse est partie : on ne fait pas échouer tout le partage
          return second.success ? second : first;
        },
        'Adresse et position en route partagées ✓'
      ),
    [run]
  );

  return {
    busy,
    shareBooking,
    shareLivePosition,
    shareBookingAndPosition,
    host: <ChatConfirmHost />,
  };
}
