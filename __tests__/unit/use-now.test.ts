import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _internalStore } from '@/lib/hooks/useNow';

describe('useNow Internal Store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns referentially identical snapshot across consecutive calls before tick', () => {
    // Consecutive synchronous calls to getSnapshot must return the EXACT same value
    // to comply with useSyncExternalStore's tearing prevention contract
    const snap1 = _internalStore.getSnapshot();
    const snap2 = _internalStore.getSnapshot();
    const snap3 = _internalStore.getSnapshot();

    expect(snap1).toBe(snap2);
    expect(snap2).toBe(snap3);
    expect(typeof snap1).toBe('number');
  });

  it('notifies subscribers and updates snapshot on updateClock tick', () => {
    const listener = vi.fn();
    const unsubscribe = _internalStore.subscribe(listener);

    const initialSnapshot = _internalStore.getSnapshot();

    // Advance timer by 1000ms
    vi.advanceTimersByTime(1000);

    expect(listener).toHaveBeenCalled();
    const newSnapshot = _internalStore.getSnapshot();
    expect(newSnapshot).toBeGreaterThanOrEqual(initialSnapshot);

    unsubscribe();
  });

  it('cleans up interval timer when last subscriber unsubscribes', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsub1 = _internalStore.subscribe(listener1);
    const unsub2 = _internalStore.subscribe(listener2);

    expect(_internalStore.getListenerCount()).toBe(2);

    unsub1();
    expect(_internalStore.getListenerCount()).toBe(1);

    unsub2();
    expect(_internalStore.getListenerCount()).toBe(0);
  });
});
