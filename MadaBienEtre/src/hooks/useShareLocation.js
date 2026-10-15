// src/hooks/useShareLocation.js
// Position GPS actuelle (expo-location) : Android, iOS et Web.
// Web : le navigateur demande l'autorisation ; il faut HTTPS (ou localhost).
import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

export default function useShareLocation() {
  /** @returns {Promise<{ok:true,latitude,longitude,accuracy}|{ok:false,reason,message}>} */
  const getCurrentPosition = useCallback(async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.isSecureContext === false) {
      return {
        ok: false,
        reason: 'insecure',
        message: 'La localisation exige une connexion HTTPS (ou localhost).',
      };
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return {
          ok: false,
          reason: 'denied',
          message: 'Autorisation de localisation refusée.',
        };
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        ok: true,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch (error) {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'Position GPS indisponible pour le moment.',
      };
    }
  }, []);

  return { getCurrentPosition };
}
