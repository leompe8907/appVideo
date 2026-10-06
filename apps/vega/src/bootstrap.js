/**
 * Se importa antes que todo lo demás (ver index.js): registra los adaptadores
 * de plataforma de `@appvideo/core` antes de que sus módulos lean el
 * almacenamiento o el entorno.
 */
import {AppState, AsyncStorage} from 'react-native';
import {
  createAsyncBackedStorage,
  createMemoryStorage,
  setStorageBackend,
} from '@appvideo/core/platform/storage';
import {setPlatformRuntime} from '@appvideo/core/platform/runtime';
import {DEV_STORAGE_SEED} from './env.generated';
import {devLog, installDevErrorLogging} from './devLog';

installDevErrorLogging();

// En builds de desarrollo se puede precargar una sesión con
// `dev-session.local.json` (ver README.md); sólo completa claves que falten.
const seed = __DEV__ ? DEV_STORAGE_SEED : {};

// Hasta que cargue AsyncStorage (asíncrono) se usa memoria.
//
// TODO: el AsyncStorage heredado de react-native-kepler funciona durante la
// ejecución pero en el stick no conserva los datos al reiniciar la app (y su
// getAllKeys falla). Amazon recomienda
// @amazon-devices/react-native-async-storage__async-storage: instalarlo (hace
// falta red) y reemplazar el import de AsyncStorage de arriba. La sesión de
// desarrollo (dev-session.local.json) cubre las pruebas mientras tanto.
setStorageBackend(createMemoryStorage(seed));

/** Se resuelve cuando el almacenamiento persistente está listo (App espera esto). */
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
  getLaunchParam: () => null,
  onAppHidden(handler) {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') handler();
    });
    return () => sub.remove();
  },
});
