import { useSyncExternalStore } from 'react';

/**
 * One localStorage key as an external store. Blocked storage (private windows, disabled site data)
 * falls back to memory for this tab, so a page never breaks and a denied write is not undone by a stale read.
 * Server render and hydration see '' (nothing stored).
 */
export function deviceStore(key: string) {
  const changeEvent = `kahvedrop:store:${key}`;
  let memory = '';
  let useMemory = false;
  const subscribe = (callback: () => void) => {
    const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === key) callback(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(changeEvent, callback);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(changeEvent, callback); };
  };
  const get = () => {
    if (useMemory) return memory;
    try { memory = window.localStorage.getItem(key) ?? ''; } catch { useMemory = true; }
    return memory;
  };
  const set = (value: string) => {
    memory = value;
    try { window.localStorage.setItem(key, value); useMemory = false; } catch { useMemory = true; }
    window.dispatchEvent(new Event(changeEvent));
  };
  return { get, set, useValue: () => useSyncExternalStore(subscribe, get, () => '') };
}
