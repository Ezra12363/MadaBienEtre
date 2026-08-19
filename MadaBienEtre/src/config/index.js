// src/config/index.js
import { API_URL, WS_URL, GOOGLE_MAPS_API_KEY } from '../constants';

export const config = {
  api: {
    url: API_URL,
    timeout: 30000,
  },
  websocket: {
    url: WS_URL,
    reconnectAttempts: 5,
    reconnectDelay: 3000,
  },
  maps: {
    apiKey: GOOGLE_MAPS_API_KEY,
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  upload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  },
  security: {
    passwordMinLength: 8,
    otpLength: 6,
    tokenExpiry: 1440, // minutes
  },
  features: {
    payments: true,
    ai: true,
    chat: true,
    sos: true,
    pushNotifications: true,
  },
};

export default config;