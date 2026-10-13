// src/config/env.js
// Source unique de vérité pour l'URL du backend.

import Constants from 'expo-constants';

const extra =
  Constants?.expoConfig?.extra ||
  Constants?.manifest?.extra ||
  {};

const DEFAULT_API_URL = 'http://10.174.179.30:8000';

const rawApiUrl =
  extra.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.API_URL ||
  DEFAULT_API_URL;

export const API_URL = String(rawApiUrl)
  .trim()
  .replace(/\/+$/, '');

export const API_TIMEOUT = 15000;

console.log('🌐 [ENV] API_URL utilisée :', API_URL);

export default {
  API_URL,
  API_TIMEOUT,
};
