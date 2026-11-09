// Bibliothèque d'emojis (sans dépendance) : un emoji par caractère/groupe.
const split = (s) => {
  const out = [];
  Array.from(s).forEach((ch) => {
    const last = out[out.length - 1];
    if (last !== undefined && (ch === '\uFE0F' || ch === '\u200D' || last.endsWith('\u200D'))) out[out.length - 1] = last + ch;
    else out.push(ch);
  });
  return out;
};

export const EMOJI_CATEGORIES = [
  { key: 'smileys', icon: '😀', label: 'Visages', emojis: split('😀😃😄😁😆😅😂🤣🙂😉😊😇🥰😍🤩😘😗😚😋😛😜🤪😝🤗🤭🤔😐😑😶🙄😏😴😌😎🤓🥳😕😟🙁😮😯😲😳🥺😢😭😤😠😡🤯😱😨😰😥😓🤒🤕🤢🥵🥶') },
  { key: 'gestes', icon: '👍', label: 'Gestes', emojis: split('👍👎👌✌️🤞🤟🤘🤙👈👉👆👇☝️✋🤚🖐️🖖👋🤝🙏👏🙌👐🤲💪🦾✍️💅🙇💆💇🚶🏃💃🕺') },
  { key: 'coeurs', icon: '❤️', label: 'Cœurs', emojis: split('❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝✨⭐🌟💫🔥🎉🎊🎁🏆🥇') },
  { key: 'nature', icon: '🌴', label: 'Nature', emojis: split('🌴🌿🍃🌸🌺🌻🌼🌷🪷🌹🌞🌙⭐🌈☁️🌧️⚡❄️🌊🐒🦎🐢🐠🦋🐝🐦🐕🐈🐄🐓') },
  { key: 'food', icon: '🍵', label: 'Repas', emojis: split('🍵☕🍺🍷🥤🍚🍜🍲🍛🍞🧀🥚🍗🍖🥩🥗🍌🍍🥭🍉🍓🍊🍋🥥🍰🍫🍪🍦') },
  { key: 'voyage', icon: '🚗', label: 'Lieux', emojis: split('🚗🚕🏍️🚲🚌🛵✈️🏠🏢🏥🏖️⛰️📍🗺️⏰📅📱💻📷🔔💰💳🧾📦✅❌⚠️❓❗') },
];

export const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏', '🔥', '👎'];
