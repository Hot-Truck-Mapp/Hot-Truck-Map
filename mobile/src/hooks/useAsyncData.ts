import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

type State<T> = { key: string | null; data: T | undefined; error: boolean };
type Updater<T> = T | ((prev: T | undefined) => T);

/**
 * Loads a screen's data and loads it again whenever `key` changes.
 *
 * `fetcher` is a plain async function that returns the data rather than
 * setting state itself, so state is only ever set from the promise's
 * callbacks — never synchronously inside the effect. Encode everything the
 * fetch depends on in `key` (e.g. `${truckId}:${range}`); pass `null` to wait
 * (e.g. until the operator's truck has loaded).
 *
 * `reload()` re-fetches in place and resolves when done — for pull-to-refresh,
 * retry buttons and refresh-on-focus. It keeps the same identity for the life
 * of the screen. `setData` applies optimistic updates.
 */
export function useAsyncData<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ key: null, data: undefined, error: false });
  const latest = useRef({ key, fetcher });

  // Declared before the load effect so it has already run when that one does.
  useEffect(() => {
    latest.current = { key, fetcher };
  });

  useEffect(() => {
    if (key === null) return;
    let active = true;
    latest.current.fetcher().then(
      (data) => { if (active) setState({ key, data, error: false }); },
      () => { if (active) setState((s) => ({ key, data: s.data, error: true })); },
    );
    return () => { active = false; };
  }, [key]);

  const reload = useCallback(async () => {
    const { key: k, fetcher: f } = latest.current;
    if (k === null) return;
    try {
      const data = await f();
      setState({ key: k, data, error: false });
    } catch {
      setState((s) => ({ key: k, data: s.data, error: true }));
    }
  }, []);

  const setData = useCallback((update: Updater<T>) => {
    setState((s) => ({ ...s, data: typeof update === 'function' ? (update as (prev: T | undefined) => T)(s.data) : update }));
  }, []);

  return {
    data: state.data,
    setData,
    loading: key !== null && state.key !== key,
    error: key !== null && state.key === key && state.error,
    reload,
  };
}

/**
 * Re-runs `reload` each time the screen comes back into focus (not on the
 * first focus — the initial load already covers that). For lists whose items
 * can change on a detail screen pushed on top of them.
 */
export function useRefreshOnRefocus(reload: () => Promise<void>) {
  const blurred = useRef(false);
  useFocusEffect(useCallback(() => {
    if (blurred.current) void reload();
    return () => { blurred.current = true; };
  }, [reload]));
}
