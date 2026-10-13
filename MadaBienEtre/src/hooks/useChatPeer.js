// src/hooks/useChatPeer.js
// Interlocuteur d'une conversation (nom, photo, en ligne ?) pour l'en-tête du
// chat. Source : GET /chat/peer/{booking_id} (réservé aux deux participants).
// Si l'endpoint est absent / en erreur, on retombe sur les paramètres de
// navigation : le chat fonctionne toujours, seul « Actif maintenant » manque.
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

import { API_URL } from '../config/env';
import { cleanToken } from '../utils/wsUrl';
import { resolvePhotoUrl } from '../utils/chatUi';

const REFRESH_MS = 30000;

export default function useChatPeer({ bookingId, token, fallbackName, fallbackPhoto, fallbackId }) {
  const [peer, setPeer] = useState({
    id: fallbackId ?? null,
    name: fallbackName || '',
    photo: resolvePhotoUrl(fallbackPhoto),
    isOnline: null, // null = inconnu (on n'affiche rien)
  });
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Les paramètres de navigation peuvent arriver après le premier rendu
  useEffect(() => {
    setPeer((prev) => ({
      ...prev,
      id: prev.id ?? fallbackId ?? null,
      name: prev.name || fallbackName || '',
      photo: prev.photo || resolvePhotoUrl(fallbackPhoto),
    }));
  }, [fallbackId, fallbackName, fallbackPhoto]);

  useEffect(() => {
    if (!bookingId || !token) return undefined;
    let stopped = false;

    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/chat/peer/${bookingId}`, {
          headers: { Authorization: `Bearer ${cleanToken(token)}` },
          timeout: 10000,
        });
        if (stopped || !aliveRef.current || !res?.data) return;
        const d = res.data;
        setPeer((prev) => ({
          id: d.id ?? prev.id,
          name: d.fullname || prev.name,
          photo: resolvePhotoUrl(d.profile_image) || prev.photo,
          isOnline: typeof d.is_online === 'boolean' ? d.is_online : prev.isOnline,
        }));
      } catch (_e) {
        /* endpoint absent ou réseau coupé : on garde les valeurs actuelles */
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [bookingId, token]);

  return peer;
}
