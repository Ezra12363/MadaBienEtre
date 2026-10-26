// src/screens/admin/reviewsDebounce.js
import { useEffect, useState } from 'react';

/** Retarde la valeur de recherche pour éviter un appel API à chaque frappe. */
export function useDebounceValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
