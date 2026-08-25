// src/constants/massageTypeIcons.js
//
// La base de données (table massage_types, gérée depuis
// admin/MassageTypesScreen.js) ne stocke PAS de nom d'icône vectorielle :
// elle stocke une "category" (relaxant, therapeutique, sportif,
// reflexologie, prenatal, personnalise) + éventuellement une image
// réelle (icon_url / image_url) pour l'affichage détaillé.
//
// Les écrans client (SearchMassageScreen, BookingScreen,
// CreateBookingScreen) affichaient auparavant des icônes fixes codées
// en dur par type. Pour garder EXACTEMENT le même rendu visuel (petites
// puces d'icône colorées) tout en étant piloté par la vraie donnée
// PostgreSQL, on dérive l'icône depuis la "category" du type de massage
// renvoyé par l'API.
//
// Ce fichier est la SEULE source de vérité pour ce mapping : si un jour
// une catégorie change de pictogramme, on ne le modifie qu'ici.

// ============================================================
// MATERIAL COMMUNITY ICONS (utilisé par SearchMassageScreen)
// ============================================================
export const CATEGORY_ICONS_MCI = {
  relaxant: 'spa',
  therapeutique: 'bone',
  sportif: 'run',
  reflexologie: 'foot-print',
  prenatal: 'human-pregnant',
  personnalise: 'star-outline',
};

export const DEFAULT_ICON_MCI = 'spa';

export const getMassageTypeIconMCI = (category) => {
  if (!category) return DEFAULT_ICON_MCI;
  return (
    CATEGORY_ICONS_MCI[String(category).toLowerCase()] ||
    DEFAULT_ICON_MCI
  );
};

// ============================================================
// IONICONS (utilisé par CreateBookingScreen)
// ============================================================
export const CATEGORY_ICONS_IONICONS = {
  relaxant: 'flower-outline',
  therapeutique: 'medkit-outline',
  sportif: 'walk-outline',
  reflexologie: 'footsteps-outline',
  prenatal: 'heart-outline',
  personnalise: 'star-outline',
};

export const DEFAULT_ICON_IONICONS = 'flower-outline';

export const getMassageTypeIconIonicons = (category) => {
  if (!category) return DEFAULT_ICON_IONICONS;
  return (
    CATEGORY_ICONS_IONICONS[String(category).toLowerCase()] ||
    DEFAULT_ICON_IONICONS
  );
};

// ============================================================
// LABEL COURT (pour les chips de filtre) — dérivé du nom réel
// ============================================================
export const getShortName = (name) => {
  if (!name) return '';
  // "Massage Relaxant" -> "Relaxant", "Massage Pierres Chaudes" -> "Pierres Chaudes"
  const cleaned = String(name).replace(/^massage\s+/i, '').trim();
  return cleaned || name;
};
