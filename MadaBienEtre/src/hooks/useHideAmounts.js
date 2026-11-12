// src/hooks/useHideAmounts.js
// ============================================================================
// Masquer / afficher les montants (comme l'œil d'un champ mot de passe).
//
// - État PARTAGÉ : un seul interrupteur pour tous les écrans (Solde disponible,
//   Mes gains, Total encaissé …). Si on affiche sur un écran, tout s'affiche.
// - Mémorisé (AsyncStorage) : le choix est gardé à la prochaine ouverture.
// - Par défaut : montants MASQUÉS (••••••).
//
//   const { hidden, toggle, show } = useHideAmounts();
//   <Text>{show(formatAr(w.available))}</Text>
// ============================================================================
import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'ui.hideAmounts';
export const HIDDEN_PLACEHOLDER = '••••••';

let hiddenState = true; // masqué par défaut
let loaded = false;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());

const load = async () => {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === 'false' || raw === 'true') {
      const next = raw === 'true';
      if (next !== hiddenState) {
        hiddenState = next;
        emit();
      }
    }
  } catch (_e) {
    // stockage indisponible : on garde la valeur par défaut
  }
};

const setHidden = (next) => {
  hiddenState = !!next;
  emit();
  AsyncStorage.setItem(STORAGE_KEY, String(hiddenState)).catch(() => {});
};

const subscribe = (cb) => {
  listeners.add(cb);
  load();
  return () => listeners.delete(cb);
};
const getSnapshot = () => hiddenState;

export function useHideAmounts() {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const toggle = useCallback(() => setHidden(!hiddenState), []);
  const show = useCallback((text) => (hidden ? HIDDEN_PLACEHOLDER : text), [hidden]);
  return { hidden, toggle, show };
}

export default useHideAmounts;
