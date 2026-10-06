/**
 * Almacenamiento clave/valor síncrono con la forma de `Storage` del navegador
 * (`getItem`, `setItem`, `removeItem`, `key`, `length`, `clear`).
 *
 * En la web usa `localStorage`. Otras plataformas (Vega / React Native, donde
 * no hay `localStorage` y AsyncStorage es asíncrono) registran su propio
 * backend con `setStorageBackend` antes de que arranque la app; ver
 * `createAsyncBackedStorage`.
 *
 * Todo el código compartido debe pasar por `getStorage()` en lugar de tocar
 * `localStorage` directamente.
 */

let customBackend = null;

/** @param {Storage | null} backend */
export function setStorageBackend(backend) {
  customBackend = backend || null;
}

/** @returns {Storage | null} `null` si no hay almacenamiento disponible (modo privado, SSR, etc.). */
export function getStorage() {
  if (customBackend) return customBackend;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Lectura que nunca lanza. */
export function storageGet(key) {
  try {
    const storage = getStorage();
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Escritura que nunca lanza (cuota llena, modo privado, etc.). */
export function storageSet(key, value) {
  try {
    const storage = getStorage();
    if (storage) storage.setItem(key, String(value));
  } catch {
    // noop
  }
}

export function storageRemove(key) {
  try {
    const storage = getStorage();
    if (storage) storage.removeItem(key);
  } catch {
    // noop
  }
}

/** Todas las claves actuales (copia, se puede borrar mientras se recorre). */
export function storageKeys() {
  const storage = getStorage();
  if (!storage) return [];
  const keys = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key != null) keys.push(key);
    }
  } catch {
    // noop
  }
  return keys;
}

/**
 * `Storage` en memoria. `onChange(key, value)` se llama en cada escritura
 * (`value === null` al borrar) para que un backend persistente escriba por detrás.
 *
 * @param {Record<string, string>} [initial]
 * @param {(key: string, value: string | null) => void} [onChange]
 */
export function createMemoryStorage(initial = {}, onChange) {
  const map = new Map(Object.entries(initial));
  const notify = (key, value) => {
    if (onChange) onChange(key, value);
  };

  return {
    get length() {
      return map.size;
    },
    key(index) {
      const keys = Array.from(map.keys());
      return index >= 0 && index < keys.length ? keys[index] : null;
    },
    getItem(key) {
      const value = map.get(String(key));
      return value === undefined ? null : value;
    },
    setItem(key, value) {
      const k = String(key);
      const v = String(value);
      if (map.get(k) === v) return;
      map.set(k, v);
      notify(k, v);
    },
    removeItem(key) {
      const k = String(key);
      if (!map.has(k)) return;
      map.delete(k);
      notify(k, null);
    },
    clear() {
      const keys = Array.from(map.keys());
      map.clear();
      keys.forEach((k) => notify(k, null));
    },
  };
}

/**
 * Backend para plataformas con almacenamiento asíncrono (AsyncStorage de
 * React Native / Vega). Se carga todo una vez al arrancar (`hydrate`) y desde
 * ahí lee/escribe en memoria; los cambios se persisten por detrás, agrupados.
 *
 * Uso en el arranque de la app Vega:
 *   const storage = await createAsyncBackedStorage(AsyncStorage);
 *   setStorageBackend(storage);
 *
 * @param {{
 *   getAllKeys: () => Promise<readonly string[]>,
 *   multiGet: (keys: readonly string[]) => Promise<readonly [string, string | null][]>,
 *   multiSet: (pairs: [string, string][]) => Promise<void>,
 *   multiRemove: (keys: string[]) => Promise<void>,
 * }} asyncStorage
 * @param {{ flushDelayMs?: number, onError?: (err: unknown) => void }} [options]
 */
export async function createAsyncBackedStorage(asyncStorage, options = {}) {
  const { flushDelayMs = 50, onError } = options;

  let initial = {};
  try {
    const keys = await asyncStorage.getAllKeys();
    if (keys.length > 0) {
      const pairs = await asyncStorage.multiGet(keys);
      initial = Object.fromEntries(pairs.filter(([, v]) => v != null));
    }
  } catch (err) {
    if (onError) onError(err);
  }

  /** @type {Map<string, string | null>} */
  const pending = new Map();
  let timer = null;
  let flushing = Promise.resolve();

  const flush = () => {
    timer = null;
    if (pending.size === 0) return flushing;
    const batch = Array.from(pending.entries());
    pending.clear();
    const toSet = batch.filter(([, v]) => v !== null);
    const toRemove = batch.filter(([, v]) => v === null).map(([k]) => k);
    flushing = flushing
      .then(() => Promise.all([
        toSet.length ? asyncStorage.multiSet(toSet) : null,
        toRemove.length ? asyncStorage.multiRemove(toRemove) : null,
      ]))
      .catch((err) => {
        if (onError) onError(err);
      });
    return flushing;
  };

  const storage = createMemoryStorage(initial, (key, value) => {
    pending.set(key, value);
    if (!timer) timer = setTimeout(flush, flushDelayMs);
  });

  /** Fuerza la escritura pendiente (p. ej. al pasar a segundo plano). */
  storage.flush = () => {
    if (timer) clearTimeout(timer);
    return flush();
  };

  return storage;
}
