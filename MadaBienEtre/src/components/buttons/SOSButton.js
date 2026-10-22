// src/components/buttons/SOSButton.js
// ✅ Doublon supprimé : l'ancienne copie faisait `new SOSService()` alors que
// sosService exporte déjà une instance (TypeError au déclenchement).
// Un seul composant existe désormais : components/sos/SOSButton.js
export { default } from '../sos/SOSButton';
