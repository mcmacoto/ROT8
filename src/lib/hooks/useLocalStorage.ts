'use client';

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function useLocalStorage(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key);
    },
    () => null
  );
}
