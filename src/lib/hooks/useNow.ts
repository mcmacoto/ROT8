'use client';

import { useSyncExternalStore } from 'react';

let currentTimestamp = typeof window !== 'undefined' ? Date.now() : 0;
const listeners = new Set<() => void>();
let intervalTimer: ReturnType<typeof setInterval> | null = null;

function updateClock() {
  currentTimestamp = Date.now();
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error in useNow listener', err);
    }
  });
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (listeners.size === 1) {
    intervalTimer = setInterval(updateClock, 1000);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
  };
}

function getSnapshot(): number {
  return currentTimestamp;
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Pure external store hook for synchronized timestamps across components.
 * Returns an immutable, cached timestamp that only updates once per second (1 Hz).
 * Complies with React 19 rules of hooks and useSyncExternalStore immutability contracts.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Exported for testing snapshot consistency
export const _internalStore = {
  getSnapshot,
  subscribe,
  updateClock,
  getListenerCount: () => listeners.size,
};
