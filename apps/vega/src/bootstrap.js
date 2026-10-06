/**
 * Se importa antes que todo lo demás (ver index.js): registra los adaptadores
 * de plataforma de `@appvideo/core` antes de que sus módulos lean el
 * almacenamiento o el entorno.
 */
import {AppState} from 'react-native';
import {createMemoryStorage, setStorageBackend} from '@appvideo/core/platform/storage';
import {setPlatformRuntime} from '@appvideo/core/platform/runtime';
import {DEV_STORAGE_SEED} from './env.generated';
import {installDevErrorLogging} from './devLog';

installDevErrorLogging();

// TODO(Fase 2): persistir con AsyncStorage (`createAsyncBackedStorage`) cuando
// se pueda instalar @amazon-devices/react-native-async-storage. Mientras
// tanto la sesión dura lo que dura la app; en builds de desarrollo se puede
// precargar una sesión con `dev-session.local.json` (ver README.md).
setStorageBackend(createMemoryStorage(__DEV__ ? DEV_STORAGE_SEED : {}));

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
