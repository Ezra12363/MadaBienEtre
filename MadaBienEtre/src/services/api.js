// src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ✅ FIXÉ (BUG LEHIBE) : API_URL dia alaina AO AMIN'NY config/env.js
// IHANY, tsy hardcodé mivantana eto intsony. Io no antony nisy
// "Network Error" — ity fichier ity sy notificationService.js dia
// nampiasa IP roa SAMIHAFA (172.28.182.30 vs 192.168.1.45).
import { API_URL, API_TIMEOUT } from '../config/env';

console.log('🌐 [API CONFIG] Base URL utilisée :', API_URL);

// ✅ Création de l'instance axios
const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ============================================================
// ✅ INTERCEPTEUR DE REQUÊTE : Ajout du token
// ============================================================
api.interceptors.request.use(
  async (config) => {
    console.log(`📤 [API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    try {
      const token = await AsyncStorage.getItem('@mada_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('   🔑 Token ajouté à la requête');
      } else {
        console.log('   ℹ️ Aucun token — requête envoyée sans authentification');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du token:', error);
    }
    return config;
  },
  (error) => {
    console.error('❌ [API REQUEST ERROR]', error.message);
    return Promise.reject(error);
  }
);

// ============================================================
// ✅ INTERCEPTEUR DE RÉPONSE : Gestion des erreurs et refresh token
// ============================================================
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    console.log(`📥 [API RESPONSE] ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // ✅ FIXÉ : ny "Network Error" (tsy misy error.response mihitsy,
    // ex: backend tsy azo antenaina, IP diso, CORS) dia TSY 401, ka
    // io code teo aloha io dia efa "log" azy ho console.error mahery
    // be foana — atao "console.warn" kokoa raha tena "Network Error"
    // tsotra izy (tsy 401), mba tsy hampiseho error mena tsy misy
    // dikany isaky ny "polling" (ex: unread-count) tsy mahazo
    // connexion mandritra ny fiandrasana backend.
    if (error.response?.status !== 401 || originalRequest._retry) {
      if (!error.response) {
        console.warn(
          `🟠 [API NETWORK] ${originalRequest?.method?.toUpperCase()} ${originalRequest?.baseURL}${originalRequest?.url} — ${error.message} (vérifiez que le backend tourne et que l'IP configurée dans config/env.js est correcte et joignable depuis cet appareil/navigateur)`
        );
      } else {
        console.error(`🟠 [API ERROR] ${error.response.status}`, error.response.data);
      }
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const refreshToken = await AsyncStorage.getItem('@mada_refresh_token');
    if (!refreshToken) {
      console.log('   ℹ️ [AUTH] Requête protégée reçue en 401 sans refresh token — utilisateur non authentifié (normal si non connecté).');
      await AsyncStorage.removeItem('@mada_token');
      await AsyncStorage.removeItem('@mada_refresh_token');
      await AsyncStorage.removeItem('@mada_user');
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;

    try {
      console.log('🔄 Tentative de rafraîchissement du token...');

      const response = await axios.post(`${API_URL}/refresh-token`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;

      await AsyncStorage.setItem('@mada_token', access_token);
      if (newRefreshToken) {
        await AsyncStorage.setItem('@mada_refresh_token', newRefreshToken);
      }

      console.log('✅ Token rafraîchi avec succès');

      processQueue(null, access_token);

      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      return api(originalRequest);

    } catch (refreshError) {
      console.warn('⚠️ [AUTH] Échec du rafraîchissement du token — déconnexion locale.', refreshError.message);

      await AsyncStorage.removeItem('@mada_token');
      await AsyncStorage.removeItem('@mada_refresh_token');
      await AsyncStorage.removeItem('@mada_user');

      processQueue(refreshError, null);

      return Promise.reject(refreshError);

    } finally {
      isRefreshing = false;
    }
  }
);

// ============================================================
// ✅ FONCTIONS EXPORTÉES
// ============================================================

export const handleApiError = (error) => {
  if (error.response) {
    return {
      status: error.response.status,
      data: error.response.data,
      message:
        error.response.data?.detail ||
        error.response.data?.message ||
        'Une erreur est survenue',
    };
  } else if (error.request) {
    return {
      status: 0,
      message: `Impossible de contacter le serveur (${API_URL}). Vérifiez que votre téléphone/navigateur et le backend sont accessibles sur le même réseau.`,
    };
  } else {
    return {
      status: 0,
      message: error.message || 'Une erreur est survenue',
    };
  }
};

export const get = async (endpoint, params = {}, config = {}) => {
  try {
    const response = await api.get(endpoint, { params, ...config });
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: handleApiError(error) };
  }
};

export const post = async (endpoint, data = {}, config = {}) => {
  try {
    const response = await api.post(endpoint, data, config);
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: handleApiError(error) };
  }
};

export const put = async (endpoint, data = {}, config = {}) => {
  try {
    const response = await api.put(endpoint, data, config);
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: handleApiError(error) };
  }
};

export const del = async (endpoint, config = {}) => {
  try {
    const response = await api.delete(endpoint, config);
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: handleApiError(error) };
  }
};

export const patch = async (endpoint, data = {}, config = {}) => {
  try {
    const response = await api.patch(endpoint, data, config);
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: handleApiError(error) };
  }
};

export const uploadFile = async (endpoint, formData, config = {}) => {
  try {
    const response = await api.post(endpoint, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(config.headers || {}),
      },
    });
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: handleApiError(error) };
  }
};

export default api;