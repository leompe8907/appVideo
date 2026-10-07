/**
 * Se importa antes que todo lo demás (ver index.js): registra los adaptadores
 * de plataforma de `@appvideo/core` antes de que sus módulos lean el
 * almacenamiento o el entorno.
 */
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createAsyncBackedStorage,
  createMemoryStorage,
  setStorageBackend,
} from '@appvideo/core/platform/storage';
import {setPlatformRuntime} from '@appvideo/core/platform/runtime';
import {DEFAULT_BRAND} from '@appvideo/core/config/defaultBrand';
import {DEV_STORAGE_SEED} from './env.generated';
import {devLog, installDevErrorLogging} from './devLog';

installDevErrorLogging();

// En builds de desarrollo se puede precargar una sesión con
// `dev-session.local.json` (ver README.md); sólo completa claves que falten y
// sólo las de la marca del build (`<marca>.*`): la clave `brand` u otra marca
// harían que esta app use el servidor y el token de otra.
const seed = __DEV__
  ? Object.fromEntries(Object.entries(DEV_STORAGE_SEED).filter(([key]) => key.startsWith(`${DEFAULT_BRAND}.`)))
  : {};

// Hasta que cargue AsyncStorage (asíncrono) se usa memoria.
setStorageBackend(createMemoryStorage(seed));

/** Se resuelve cuando el almacenamiento persistente está listo (App espera esto). */
if (__DEV__) {
  try {
    const sample = global.crypto.getRandomValues(new Uint8Array(4));
    devLog('crypto.getRandomValues OK', Array.from(sample).join(','));
  } catch (e) {
    devLog('crypto.getRandomValues ERROR', e?.message);
  }
}

export const storageReady = (async () => {
  try {
    const persistent = await createAsyncBackedStorage(AsyncStorage, {
      onError: (e) => devLog('storage: error', e),
    });
    for (const [key, value] of Object.entries(seed)) {
      if (persistent.getItem(key) == null) persistent.setItem(key, value);
    }
    setStorageBackend(persistent);
    AppState.addEventListener('change', (state) => {
      if (state !== 'active') persistent.flush();
    });
    devLog('storage: AsyncStorage con', persistent.length, 'claves');
  } catch (e) {
    devLog('storage: sin AsyncStorage, se usa memoria', e?.message);
  }
})();

setPlatformRuntime({
  name: 'vega',
  getUserAgent: () => 'appVideo Vega (Fire TV)',
  getLanguage: () => 'es',
  isOnline: () => true,
  // Cada app de Fire TV es de una sola marca (la del build, VEGA_BRAND): se
  // informa como el `?brand=` de la web, que tiene prioridad sobre la marca
  // guardada en el almacenamiento.
  getLaunchParam: (name) => (name === 'brand' ? DEFAULT_BRAND || null : null),
  onAppHidden(handler) {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') handler();
    });
    return () => sub.remove();
  },
});
