import {useEffect} from 'react';
import {AppState} from 'react-native';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {setOnDeviceRevoked, setOnDeviceSessionUnexpectedClose} from '@appvideo/core/services/deviceSessionService';
import {
  ensureDeviceSessionConnected,
  resetDeviceSessionReconnect,
  scheduleDeviceSessionReconnect,
} from '@appvideo/core/services/deviceSessionWatchdog';
import {clearSessionBeforeNewLogin} from '@appvideo/core/services/loginFlow';
import {resetHomeMemory} from './homeMemory';
import {devLog} from './devLog';

/** Espera al arrancar, para que el login/splash abra su propia conexión primero (como la web). */
const STARTUP_DELAY_MS = 1500;

function connectNow(brand) {
  ensureDeviceSessionConnected(brand).then((result) => {
    devLog('dispositivo vinculado:', result ? JSON.stringify(result) : 'no aplica');
    if (result && !result.ok) scheduleDeviceSessionReconnect(brand, result);
  });
}

/**
 * "Dispositivo vinculado" (`/ws/device/`, backend Wind) en Vega -- lo que en
 * la web hacen `useAppLifecycle.js` y `App.jsx`. Antes Vega abría el socket
 * al loguearse pero nunca lo reabría si se caía, y un `device_revoked` (sesión
 * cerrada desde la cuenta, cambio de contraseña) no hacía nada: la app seguía
 * logueada.
 *
 * - Al arrancar y al volver al frente, asegura la conexión.
 * - Si se cae, la reabre con la espera de `deviceSessionWatchdog.js`.
 * - `device_revoked` cierra la sesión y vuelve al login.
 *
 * @param {import('@amazon-devices/react-navigation__native').NavigationContainerRef} navigationRef
 * @param {boolean} storageIsReady los tokens guardados se leen del almacenamiento: no arrancar antes.
 */
export function useDeviceSessionLifecycle(navigationRef, storageIsReady) {
  useEffect(() => {
    if (!storageIsReady) return undefined;
    const brand = getActiveBrandConfig();

    setOnDeviceRevoked((reason) => {
      devLog('dispositivo revocado:', reason);
      resetDeviceSessionReconnect();
      try {
        clearSessionBeforeNewLogin();
      } catch {
        // noop -- igual se vuelve al login aunque la limpieza falle a medias
      }
      resetHomeMemory();
      if (navigationRef.isReady()) navigationRef.reset({index: 0, routes: [{name: 'login'}]});
    });

    setOnDeviceSessionUnexpectedClose((info) => {
      devLog('dispositivo vinculado: se cortó', JSON.stringify(info));
      scheduleDeviceSessionReconnect(brand, info);
    });

    const startup = setTimeout(() => connectNow(brand), STARTUP_DELAY_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Volver al frente reinicia la espera: se intenta ahora.
      resetDeviceSessionReconnect();
      connectNow(brand);
    });

    return () => {
      clearTimeout(startup);
      sub.remove();
      setOnDeviceRevoked(null);
      setOnDeviceSessionUnexpectedClose(null);
      resetDeviceSessionReconnect();
    };
  }, [navigationRef, storageIsReady]);
}
