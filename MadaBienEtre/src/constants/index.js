// src/constants/index.js
export const API_URL = process.env.API_URL || 'http://10.230.25.30:8000/v1';
export const WS_URL = process.env.WS_URL || 'ws://10.230.25.30:8000/ws';

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export const APP_NAME = 'Mada Bien-être';
export const APP_VERSION = '1.0.0';

export const MASSAGE_TYPES = [
  { id: 1, name: 'Massage Relaxant', icon: 'spa', duration: [30, 45, 60, 90, 120] },
  { id: 2, name: 'Massage Thérapeutique', icon: 'healing', duration: [45, 60, 90] },
  { id: 3, name: 'Massage Sportif', icon: 'fitness', duration: [60, 90, 120] },
  { id: 4, name: 'Réflexologie', icon: 'foot-print', duration: [30, 45, 60] },
  { id: 5, name: 'Massage Prénatal', icon: 'baby', duration: [45, 60] },
  { id: 6, name: 'Pierres Chaudes', icon: 'fire', duration: [60, 90] },
  { id: 7, name: 'Shiatsu', icon: 'japanese', duration: [60, 90] },
  { id: 8, name: 'Deep Tissue', icon: 'muscle', duration: [60, 90] },
  { id: 9, name: 'Massage Suédois', icon: 'swedish', duration: [60, 90, 120] },
];

export const MIN_PRICES = {
  1: 25000,
  2: 35000,
  3: 40000,
  4: 30000,
  5: 40000,
  6: 50000,
  7: 40000,
  8: 45000,
  9: 35000,
};

export const PAYMENT_METHODS = [
  { id: 'mobile_money', label: 'Mobile Money', icon: 'phone-portrait-outline' },
  { id: 'card', label: 'Carte Bancaire', icon: 'card-outline' },
  { id: 'vanila_pay', label: 'Vanila Pay', icon: 'shield-outline' },
  { id: 'cash', label: 'Espèces', icon: 'cash-outline' },
];

export const MOBILE_MONEY_PROVIDERS = [
  { id: 'mvola', label: 'MVola', icon: '📱' },
  { id: 'orange_money', label: 'Orange Money', icon: '🟠' },
  { id: 'airtel_money', label: 'Airtel Money', icon: '🔴' },
];

export const BOOKING_STATUSES = {
  PENDING: 'pending',
  NEGOTIATING: 'negotiating',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED_BY_CLIENT: 'cancelled_by_client',
  CANCELLED_BY_THERAPIST: 'cancelled_by_therapist',
  EXPIRED: 'expired',
};

export const USER_ROLES = {
  CLIENT: 'CLIENT',
  THERAPIST: 'THERAPIST',
  ADMIN: 'ADMIN',
};

export const STORAGE_KEYS = {
  TOKEN: '@mada_token',
  REFRESH_TOKEN: '@mada_refresh_token',
  USER: '@mada_user',
  THEME: '@mada_theme',
  LANGUAGE: '@mada_language',
  ONBOARDING: '@mada_onboarding',
};

export const NOTIFICATION_TYPES = {
  BOOKING: 'booking',
  OFFER: 'offer',
  PAYMENT: 'payment',
  REVIEW: 'review',
  SOS: 'sos',
  SYSTEM: 'system',
  PROMOTION: 'promotion',
  REMINDER: 'reminder',
  CHAT: 'chat',
};

export const SOS_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};