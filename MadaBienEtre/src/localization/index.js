// src/localization/index.js
import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

// Import des traductions
import fr from './fr.json';
import en from './en.json';

const i18n = new I18n({
  fr,
  en,
});

i18n.locale = Localization.locale;
i18n.fallbacks = true;

export default i18n;