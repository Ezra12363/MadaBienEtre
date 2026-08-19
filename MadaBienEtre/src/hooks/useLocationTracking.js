// src/hooks/useLocationTracking.js
// ============================================
// ✅ "Tracking Temps Réel" — hook iray mampandeha ny fanaraha-maso
// an-tsipiriany ny localisation-n'ny mpampiasa, mandeha na
// amin'ny Web (navigator.geolocation.watchPosition) na amin'ny
// Android/iOS (expo-location watchPositionAsync).
//
// ✅ FIXÉ : nampiana "first fix" haingana (getCurrentPositionAsync /
// navigator.geolocation.getCurrentPosition) MIALOHA ny watchPosition,
// satria ny watchPositionAsync irery dia mety mandany fotoana ela be
// (10-20 segondra na mihoatra) vao mamoaka ny valiny VOALOHANY azy —
// io no antony nampiseho carte "vide"/miandry ela be teo aloha.
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * @param {Object} options
 * @param {boolean} options.enabled - Mamela/manakana ny tracking (default true)
 * @param {number} options.distanceIntervalMeters - Fahatezan'ny update (default 10m)
 * @param {number} options.timeIntervalMs - Fahatezan'ny update en temps (default 4000ms)
 * @returns {{
 *   location: {latitude:number, longitude:number, heading:number|null, speed:number|null, accuracy:number|null} | null,
 *   errorMsg: string | null,
 *   isTracking: boolean,
 *   isLocating: boolean,
 *   permissionGranted: boolean | null,
 *   startTracking: Function,
 *   stopTracking: Function,
 * }}
 */
export default function useLocationTracking({
  enabled = true,
  distanceIntervalMeters = 10,
  timeIntervalMs = 4000,
} = {}) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  // ✅ FIXÉ : "isLocating" — mampahafantatra fa mbola mandeha ny
  // fahazoana ny "first fix" (mahasoa ho an'ny spinner/loading UI, ex:
  // ao amin'ny AddressMapPickerModal, mandritra ny fiandrasana ny GPS)
  const [isLocating, setIsLocating] = useState(false);
  // ✅ FIXÉ : null = mbola tsy voafaritra (alohan'ny fangatahana),
  // true = nomena, false = nolavina — mba tsy hifangaro amin'ny
  // "false" toy ny hoe efa nolavina raha vao manomboka ny tracking.
  const [permissionGranted, setPermissionGranted] = useState(null);

  const nativeSubscription = useRef(null);
  const webWatchId = useRef(null);
  const hasFirstFixRef = useRef(false);

  const handlePosition = useCallback((coords) => {
    hasFirstFixRef.current = true;
    setIsLocating(false);
    setLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: coords.heading ?? null,
      speed: coords.speed ?? null,
      accuracy: coords.accuracy ?? null,
      timestamp: Date.now(),
    });
  }, []);

  const stopTracking = useCallback(() => {
    if (nativeSubscription.current) {
      nativeSubscription.current.remove();
      nativeSubscription.current = null;
    }
    if (webWatchId.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(webWatchId.current);
      webWatchId.current = null;
    }
    setIsTracking(false);
    setIsLocating(false);
    hasFirstFixRef.current = false;
  }, []);

  const startTracking = useCallback(async () => {
    setErrorMsg(null);
    setIsLocating(true);
    hasFirstFixRef.current = false;

    // ============================================
    // ✅ WEB : navigator.geolocation
    // ============================================
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setErrorMsg("Ny navigateur tsy manohana ny géolocalisation.");
        setIsLocating(false);
        return;
      }
      setPermissionGranted(true);

      // ✅ FIXÉ : "first fix" haingana (getCurrentPosition, one-shot)
      // mialoha ny watchPosition, mba ho vonona haingana ny valeur
      // voalohany (ilaina ho an'ny carte mba tsy hiandry ela be).
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handlePosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            accuracy: pos.coords.accuracy,
          });
        },
        () => { /* ✅ tsy manakana, ny watchPosition eo ambany no hanome valiny */ },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
      );

      webWatchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          handlePosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          if (!hasFirstFixRef.current) {
            setErrorMsg(err.message || 'Tsy afaka mahazo ny localisation.');
            setIsLocating(false);
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
      setIsTracking(true);
      return;
    }

    // ============================================
    // ✅ ANDROID / iOS : expo-location
    // ============================================
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionGranted(false);
        setErrorMsg("Alalana localisation nolavina.");
        setIsLocating(false);
        return;
      }
      setPermissionGranted(true);

      // ✅ FIXÉ : "first fix" haingana (getCurrentPositionAsync) mialoha
      // ny watchPositionAsync — io no mahatonga ny carte hahita ny
      // toerana marina AO ANATIN'NY FOTOANA FOHY, tsy miandry ny
      // "update" voalohan'ny watch izay mety ho ela.
      try {
        const quickFix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        handlePosition(quickFix.coords);
      } catch (quickFixError) {
        // ✅ tsy manakana, ny watchPositionAsync eo ambany no hanome valiny
        console.warn('⚠️ getCurrentPositionAsync (first fix) error:', quickFixError?.message);
      }

      nativeSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: timeIntervalMs,
          distanceInterval: distanceIntervalMeters,
        },
        (pos) => handlePosition(pos.coords)
      );
      setIsTracking(true);
      setIsLocating(false);
    } catch (error) {
      setErrorMsg(error.message || 'Tsy afaka manomboka ny tracking.');
      setIsLocating(false);
    }
  }, [distanceIntervalMeters, timeIntervalMs, handlePosition]);

  useEffect(() => {
    if (enabled) {
      startTracking();
    }
    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    location,
    errorMsg,
    isTracking,
    isLocating,
    permissionGranted,
    startTracking,
    stopTracking,
  };
}