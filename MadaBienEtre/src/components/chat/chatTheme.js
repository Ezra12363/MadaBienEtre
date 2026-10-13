// src/components/chat/chatTheme.js
// Palette du chat (inspirée de la maquette : vert vif, bulles douces,
// en-tête arrondi). Clair + sombre, identique sur Android / iOS / Web.

export const CHAT_MAX_WIDTH = 760; // largeur max du contenu sur le web large

const LIGHT = {
  screenBg: '#FFFFFF',
  headerFrom: '#0BB869',
  headerTo: '#15A05F',
  headerText: '#FFFFFF',
  headerSubText: 'rgba(255,255,255,0.88)',
  headerIconBg: 'rgba(255,255,255,0.16)',

  primary: '#10B86D',
  primaryDark: '#0B8F54',
  primarySoft: '#DDFDEE',

  ownBubble: '#10B86D',
  ownText: '#FFFFFF',
  otherBubble: '#F5F5F5',
  otherText: '#1F2937',

  meta: '#9AA0A6',
  metaRead: '#10B86D',
  dateText: '#1F2937',

  inputBg: '#F5F5F7',
  inputText: '#1F2937',
  placeholder: '#9AA0A6',
  sendIdle: '#9AA0A6',

  searchBg: '#FFFFFF',
  searchText: '#1F2937',

  rowTitle: '#111827',
  rowSub: '#8A9096',
  rowDivider: '#F0F2F1',

  avatarBg: '#DDFDEE',
  avatarText: '#0B8F54',

  online: '#34D058',
  offline: '#B6BCC2',
  warning: '#F59E0B',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
};

const DARK = {
  ...LIGHT,
  screenBg: '#0F1512',
  headerFrom: '#0A9A58',
  headerTo: '#0E7F4B',

  ownBubble: '#0F9F5C',
  otherBubble: '#1D2722',
  otherText: '#F3F4F6',

  meta: '#7D8A84',
  dateText: '#E5E7EB',

  inputBg: '#1B2520',
  inputText: '#F3F4F6',
  placeholder: '#7D8A84',
  sendIdle: '#7D8A84',

  primarySoft: '#1F3329',

  rowTitle: '#F3F4F6',
  rowSub: '#8F9A95',
  rowDivider: '#1D2722',

  avatarBg: '#1F3329',
  avatarText: '#6EE7A8',

  searchBg: '#1B2520',
  searchText: '#F3F4F6',

  offline: '#55605A',
  dangerSoft: '#3A1D1F',
};

export const getChatPalette = (isDark) => (isDark ? DARK : LIGHT);

export default getChatPalette;
