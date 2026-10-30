// src/utils/lastTab.js
//
// Mémorise le dernier onglet (page) ouvert dans chaque navigateur
// (client / thérapeute / admin) afin de rester sur la même page après
// une actualisation du navigateur (F5 / bouton "Actualiser") sur le web.
//
// - Web uniquement (sessionStorage). Sur mobile natif : aucun effet.
// - Utilise sessionStorage : survit au rafraîchissement, mais est vidé
//   à la fermeture de l'onglet du navigateur.

import { Platform } from 'react-native';

const PREFIX = 'mada:lastTab:';

const getStorage = () => {
  try {
    if (Platform.OS !== 'web') return null;
    if (typeof window === 'undefined') return null;
    return window.sessionStorage || null;
  } catch (e) {
    return null;
  }
};

/**
 * Retourne le dernier onglet mémorisé pour `scope`
 * (ex: 'client', 'therapist', 'admin'), ou undefined s'il n'existe pas
 * ou s'il ne fait pas partie des onglets valides.
 */
export const getLastTab = (scope, validNames = []) => {
  const storage = getStorage();
  if (!storage) return undefined;

  try {
    const value = storage.getItem(PREFIX + scope);
    if (value && validNames.includes(value)) {
      return value;
    }
  } catch (e) {
    // ignoré
  }

  return undefined;
};

/** Mémorise l'onglet courant pour `scope`. */
export const saveLastTab = (scope, name) => {
  const storage = getStorage();
  if (!storage || !name) return;

  try {
    storage.setItem(PREFIX + scope, name);
  } catch (e) {
    // ignoré
  }
};

/** Efface tous les onglets mémorisés (à appeler à la déconnexion). */
export const clearLastTabs = () => {
  const storage = getStorage();
  if (!storage) return;

  try {
    Object.keys(storage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => storage.removeItem(key));
  } catch (e) {
    // ignoré
  }
};

// ============================================================
// État COMPLET de la navigation (page + sous-pages + paramètres)
// ============================================================

const NAV_KEY = PREFIX + 'navState';
const MAX_SIZE = 200 * 1024;

// Ne garde que l'essentiel (index, nom, params, sous-état) : pas de `key`
const compactState = (state) => {
  if (!state || !Array.isArray(state.routes)) return undefined;

  return {
    index: typeof state.index === 'number' ? state.index : state.routes.length - 1,
    routes: state.routes.map((route) => {
      const item = { name: route.name };
      if (route.params !== undefined) item.params = route.params;
      const child = compactState(route.state);
      if (child) item.state = child;
      return item;
    }),
  };
};

// Clé basée sur le rôle (le profil peut changer après /users/me ; la
// déconnexion efface de toute façon l'état mémorisé).
export const buildUserKey = (user) => String(user?.role ?? '');

export const saveNavState = (user, rootState) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    const state = compactState(rootState);
    if (!state) return;

    const json = JSON.stringify({ user: buildUserKey(user), state });
    if (json.length > MAX_SIZE) return;

    storage.setItem(NAV_KEY, json);
  } catch (e) {
    // ignoré (params non sérialisables, quota...)
  }
};

export const loadNavState = (user) => {
  const storage = getStorage();
  if (!storage) return undefined;

  try {
    const raw = storage.getItem(NAV_KEY);
    if (!raw) return undefined;

    const data = JSON.parse(raw);
    if (data?.user !== buildUserKey(user)) return undefined;

    return data.state;
  } catch (e) {
    return undefined;
  }
};
