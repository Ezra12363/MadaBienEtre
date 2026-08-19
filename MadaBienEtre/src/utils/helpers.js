// src/utils/helpers.js
import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

export const screenWidth = width;
export const screenHeight = height;

export const isSmallDevice = width < 375;
export const isMediumDevice = width >= 375 && width < 768;
export const isLargeDevice = width >= 768;

export const formatPrice = (price, currency = 'Ar') => {
  if (!price && price !== 0) return '0 Ar';
  return `${price.toLocaleString()} ${currency}`;
};

export const formatDate = (date, format = 'short') => {
  const d = new Date(date);
  if (format === 'short') {
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  if (format === 'long') {
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  if (format === 'time') {
    return d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (format === 'datetime') {
    return d.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toISOString();
};

export const formatTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h`;
  if (days < 7) return `${days} j`;
  if (days < 30) return `${Math.floor(days / 7)} sem`;
  return formatDate(date);
};

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const truncate = (str, length = 50, suffix = '...') => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + suffix;
};

export const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const validateEmail = (email) => {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

export const validatePhone = (phone) => {
  const regex = /^(\+261|0)[0-9]{9}$/;
  return regex.test(phone);
};

export const validatePassword = (password) => {
  const errors = [];
  if (password.length < 8) errors.push('8 caractères minimum');
  if (!/[A-Z]/.test(password)) errors.push('une majuscule');
  if (!/[a-z]/.test(password)) errors.push('une minuscule');
  if (!/[0-9]/.test(password)) errors.push('un chiffre');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('un caractère spécial');
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const getStatusColor = (status) => {
  const map = {
    pending: '#FFA726',
    negotiating: '#2196F3',
    confirmed: '#4CAF50',
    in_progress: '#FF9800',
    completed: '#2E7D32',
    cancelled: '#D32F2F',
    expired: '#757575',
  };
  return map[status] || '#757575';
};

export const getStatusLabel = (status) => {
  const map = {
    pending: 'En attente',
    negotiating: 'Négociation',
    confirmed: 'Confirmée',
    in_progress: 'En cours',
    completed: 'Terminée',
    cancelled: 'Annulée',
    expired: 'Expirée',
  };
  return map[status] || status;
};

export const getRoleLabel = (role) => {
  const map = {
    CLIENT: 'Client',
    THERAPIST: 'Thérapeute',
    ADMIN: 'Administrateur',
  };
  return map[role] || role;
};

export const getRoleColor = (role) => {
  const map = {
    CLIENT: '#2196F3',
    THERAPIST: '#4CAF50',
    ADMIN: '#D32F2F',
  };
  return map[role] || '#757575';
};

export const debounce = (func, delay = 500) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const throttle = (func, limit = 500) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

export const isEmpty = (obj) => {
  if (!obj) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return !obj;
};