// src/config/env.js
// ============================================
// ✅ SEULE ET UNIQUE SOURCE DE VÉRITÉ pour API_URL dans tout le projet.
// TOUT fichier ayant besoin de l'URL du backend (api.js,
// notificationService.js, ou tout autre service) DOIT importer
// API_URL depuis CE fichier — jamais le redéfinir ailleurs.
//
// ⚠️ C'était exactement le bug de ce rapport : api.js et
// notificationService.js utilisaient chacun leur PROPRE valeur
// hardcodée pour API_URL (172.28.182.30 vs 192.168.1.45), ce qui
// causait un "Network Error" dès qu'une des deux IP n'était pas
// joignable depuis l'appareil/le navigateur utilisé.
// ============================================
import Constants from 'expo-constants';

const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};

// ✅ SOLOY ITY amin'ny IP marina an'ny ordinatorinao (ipconfig),
// ary ampio koa ao amin'ny app.config.js -> extra.apiUrl mba ho
// entin'ny build production/preview/dev samy izy.
export const API_URL = extra.apiUrl || process.env.API_URL || 'http://10.147.58.30:8000';

export const API_TIMEOUT = 15000;

console.log('🌐 [ENV] API_URL ampiasaina:', API_URL);

export default { API_URL, API_TIMEOUT };