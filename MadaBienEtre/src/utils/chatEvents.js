// src/utils/chatEvents.js
// Mini bus d'évènements : permet au chat (useChatRoom) de dire au badge
// « messages non lus » de se rafraîchir sans dépendance entre les deux.
const listeners = new Set();

export const onChatChanged = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const emitChatChanged = () => {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (_e) {
      /* un listener en erreur ne doit pas bloquer les autres */
    }
  });
};
