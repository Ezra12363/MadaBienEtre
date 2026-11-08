// src/config/env.js
// Source unique de vérité pour l'URL du backend.

import Constants from 'expo-constants';

const extra =
  Constants?.expoConfig?.extra ||
  Constants?.manifest?.extra ||
  {};

const DEFAULT_API_URL = 'http://10.210.29.30:8000';

const rawApiUrl =
  extra.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.API_URL ||
  DEFAULT_API_URL;

export const API_URL = String(rawApiUrl)
  .trim()
  .replace(/\/+$/, '');

export const API_TIMEOUT = 15000;

// Client IDs OAuth Google (console.cloud.google.com > Identifiants).
// Même valeurs que GOOGLE_CLIENT_IDS côté backend (.env).
export const GOOGLE_WEB_CLIENT_ID =
  extra.googleWebClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
export const GOOGLE_ANDROID_CLIENT_ID =
  extra.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
export const GOOGLE_IOS_CLIENT_ID =
  extra.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

console.log('🌐 [ENV] API_URL utilisée :', API_URL);

export default {
  API_URL,
  API_TIMEOUT,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
};
