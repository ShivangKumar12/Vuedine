import { useEffect, useState } from 'react';

/**
 * Minimal store factory — pub/sub + React hook.
 *
 * We use this instead of pulling in Zustand/Redux because the dashboard's
 * cross-cutting state is tiny (auth, active branch). When the surface grows
 * past 3 stores or needs middleware, swap to Zustand.
 *
 *   const counter = createStore(0);
 *   counter.set((n) => n + 1);
 *   const value = counter.use();
 */
export type Store<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: (value: T) => void) => () => void;
  use: () => T;
};

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(value: T) => void>();

  const get = () => state;

  const set: Store<T>['set'] = (next) => {
    const computed = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
    if (Object.is(computed, state)) return;
    state = computed;
    listeners.forEach((l) => l(state));
  };

  const subscribe: Store<T>['subscribe'] = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const use = (): T => {
    const [snap, setSnap] = useState(state);
    useEffect(() => {
      const off = subscribe((v) => setSnap(v));
      // Re-read after mount in case state changed between hook and effect.
      setSnap(state);
      return off;
    }, []);
    return snap;
  };

  return { get, set, subscribe, use };
}
