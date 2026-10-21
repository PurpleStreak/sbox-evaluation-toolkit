import { useEffect, useState } from 'react';

/**
 * useState that remembers its value in localStorage (per-browser convenience only).
 * Storage can be unavailable (private mode, blocked site data), so every access is guarded.
 * @template T
 * @param {string} key
 * @param {T} initial
 * @returns {[T, (v: T) => void]}
 */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : /** @type {T} */ (JSON.parse(raw));
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep the in-memory value */
    }
  }, [key, value]);
  return [value, setValue];
}
