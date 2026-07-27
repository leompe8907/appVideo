/**
 * "Dispositivos vinculados" (Fase 3 del backend externo, ver `deviceAuthService.js`) -- registro por
 * WebSocket de este dispositivo bajo la cuenta autenticada, para que el
 * usuario pueda verlo y revocarlo desde su panel (como "dispositivos
 * vinculados" de WhatsApp). Ver, en el repo del backend:
 * `docs/GUIA_INTEGRACION_APPS.md` §4 e `docs/INTEGRACION_PAREO_TV_DISPOSITIVOS.md`.
 *
 * ATENCIÓN -- identificación de dispositivo (PC vs TV), léase antes de tocar
 * `resolveDeviceType()`:
 *
 * A propósito NO se reutiliza `useDeviceDetection()`/`useDevice()` (el hook
 * ya existente, usado para decidir LAYOUT de UI) para calcular el
 * `device_type` que se manda al backend. Dos razones concretas:
 *
 *   1. Ese hook solo distingue "tv" vs "pc" (no LG de Samsung), y el
 *      backend sí quiere esa distinción para mostrarle al usuario cuál
 *      de sus TVs es cuál.
 *   2. Ese hook tiene un override manual de QA vía `?device=tv` (persistido
 *      en `localStorage['device']`) pensado para forzar el LAYOUT durante
 *      pruebas en una PC normal. Si se reutilizara ese valor para
 *      `device_type`, un tester forzando `?device=tv` en su propia laptop
 *      quedaría registrado en el backend real como si fuera un televisor
 *      -- un dato de cuenta real contaminado por un flag de UI de prueba.
 *
 * Tampoco se reutiliza `resolveEnginePlatform()` (`player/engines/`) tal
 * cual, porque esa función decide qué *engine de video* usar y está
 * encadenada a la política de negocio `nativeAdaptersEnabled` del player
 * (hoy en `false` en todos los brands, "modo seguro") -- con eso apagado,
 * SIEMPRE devuelve "web" aunque el dispositivo real sea una LG/Samsung.
 * Correcto para el player, incorrecto para "qué dispositivo le muestro al
 * usuario en su panel de cuenta".
 *
 * Por eso acá se recalculan las señales de vendor/runtime REALES
 * (`hasLgTvRuntime`/`hasSamsungTvRuntime`, las mismas primitivas de
 * `utils/tvPlatformApis.js` que ya usa `resolveEnginePlatform.js`) de forma
 * independiente de esas dos utilidades -- sin heredar ni el override de QA
 * ni la política de negocio del player.
 */

import {
  getBrandItem,
  removeBrandItem,
  resolveBrandId,
  setBrandItem,
} from '../utils/brandStorage';
import { detectTvVendorFromApis } from '../utils/tvPlatformApis';
import { resolveDeviceAuthBaseUrl } from './deviceAuthService';

const STORAGE_KEYS = {
  deviceToken: 'deviceSession.deviceToken',
};

export const DEVICE_TYPE = Object.freeze({
  WEB: 'web',
  LG: 'lg',
  SAMSUNG: 'samsung',
});

const HEARTBEAT_MS = 25000;

function detectLgFromUserAgent(ua) {
  return ua.includes('webos') || ua.includes('netcast') || (ua.includes('lg') && ua.includes('tv'));
}

function detectSamsungFromUserAgent(ua) {
  return ua.includes('tizen') || (ua.includes('samsung') && ua.includes('tv'));
}

/**
 * Determina el `device_type` a reportar al backend. El enum real del
 * backend Wind (`AppCredentials.APP_TYPES`) tiene más valores
 * (`android`/`androidtv`/`amazon`/`iOS`/`iOStv`), pero este repo (SPA web,
 * sin wrapper nativo Capacitor/Cordova/React Native) solo puede producir
 * de forma confiable `web`/`lg`/`samsung`.
 */
export function resolveDeviceType() {
  const vendor = detectTvVendorFromApis();
  if (vendor === 'lg') return DEVICE_TYPE.LG;
  if (vendor === 'samsung') return DEVICE_TYPE.SAMSUNG;

  const ua = String(typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
  const uaLg = detectLgFromUserAgent(ua);
  const uaSamsung = detectSamsungFromUserAgent(ua);
  if (uaLg && !uaSamsung) return DEVICE_TYPE.LG;
  if (uaSamsung && !uaLg) return DEVICE_TYPE.SAMSUNG;

  // Sin señal de vendor, o señal ambigua (samsung+lg a la vez, caso raro de
  // emulador): "web" es el fallback seguro -- nunca reporta un vendor de TV
  // equivocado por adivinar de más.
  return DEVICE_TYPE.WEB;
}

/**
 * Etiqueta legible para `device_model` (texto libre en el backend, no
 * crítico si queda impreciso). Ver `wind/models.py::DeviceSession.device_model`
 * en el backend Wind (otros backends que implementen el mismo contrato
 * pueden tratarlo igual, es texto libre).
 */
export function resolveDeviceModel(deviceType) {
  if (deviceType === DEVICE_TYPE.LG) return 'LG webOS TV';
  if (deviceType === DEVICE_TYPE.SAMSUNG) return 'Samsung Tizen TV';
  try {
    return String(navigator.userAgent || '').slice(0, 200);
  } catch {
    return '';
  }
}

export function getStoredDeviceToken(brand) {
  return getBrandItem(resolveBrandId(brand), STORAGE_KEYS.deviceToken) || '';
}

function setStoredDeviceToken(token, brand) {
  const id = resolveBrandId(brand);
  if (token) setBrandItem(id, STORAGE_KEYS.deviceToken, token);
  else removeBrandItem(id, STORAGE_KEYS.deviceToken);
}

export function clearStoredDeviceToken(brand) {
  removeBrandItem(resolveBrandId(brand), STORAGE_KEYS.deviceToken);
}

/**
 * `http(s)://host` -> `ws(s)://host/ws/device/`. Si el brand declaró una
 * `login.deviceSession.wsUrl` explícita, se usa esa tal cual (por si el
 * backend corre el WS en un host/puerto distinto del HTTP, p.ej. detrás de
 * un LB).
 */
function buildDeviceWsUrl(brandConfig) {
  const explicit =
    typeof brandConfig?.login?.deviceSession?.wsUrl === 'string'
      ? brandConfig.login.deviceSession.wsUrl.trim()
      : '';
  if (explicit) return explicit;

  const base = resolveDeviceAuthBaseUrl(brandConfig);
  if (!base) return '';
  return `${base.replace(/^http/i, 'ws')}/ws/device/`;
}

// Handle de la conexión de dispositivo actualmente activa (si alguna) --
// permite cerrarla desde `clearSessionBeforeNewLogin()` (loginFlow.js) sin
// que ese módulo necesite conocer el WebSocket en sí.
let activeDeviceSocket = null;

export function closeActiveDeviceSession() {
  if (activeDeviceSocket) {
    try {
      activeDeviceSocket.close();
    } catch {
      // noop
    }
    activeDeviceSocket = null;
  }
}

/**
 * Abre `wss://.../ws/device/?token=<jwt>`, registra este dispositivo, y
 * deja la conexión viva para poder recibir `device_revoked` en vivo (push
 * inmediato si el usuario revoca este dispositivo desde su panel, o si se
 * revoca en bloque por un cambio de contraseña/cierre de cuenta).
 *
 * Nunca lanza: cualquier fallo de red/JWT se resuelve como `{ok: false}`
 * sin afectar al caller -- el login principal contra PanAccess ya se
 * completó antes de llegar acá y no debe depender de esto.
 *
 * @param {Object} brandConfig
 * @param {string} accessToken - JWT del backend (ver `deviceAuthService.js`).
 * @param {{onRevoked?: (reason: string) => void}} [callbacks]
 * @returns {Promise<{ok: boolean, deviceToken?: string, isNew?: boolean, error?: string}>}
 */
export function registerDeviceSession(brandConfig, accessToken, callbacks = {}) {
  return new Promise((resolve) => {
    const wsUrl = buildDeviceWsUrl(brandConfig);
    if (!wsUrl || !accessToken) {
      resolve({ ok: false, error: 'missing_config' });
      return;
    }

    const brand = brandConfig?.brand;
    // Evita acumular conexiones si esta función se llama más de una vez
    // sin un logout explícito de por medio (p.ej. reactivación de sesión
    // en splash, o revalidación al volver de background -- ver
    // `useAppLifecycle`/`splashAuthFlow.js` -- ambas pueden reinvocar
    // `loginAndActivateLicense` sin pasar por `clearSessionBeforeNewLogin`).
    closeActiveDeviceSession();

    const deviceType = resolveDeviceType();
    const deviceModel = resolveDeviceModel(deviceType);
    const existingToken = getStoredDeviceToken(brand);

    let settled = false;
    let heartbeat = null;
    let ws;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const stopHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    };

    try {
      ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(accessToken)}`);
    } catch {
      resolve({ ok: false, error: 'ws_create_failed' });
      return;
    }

    ws.onopen = () => {
      try {
        const payload = {
          type: 'register_device',
          device_type: deviceType,
          device_model: deviceModel,
        };
        if (existingToken) payload.device_token = existingToken;
        ws.send(JSON.stringify(payload));
      } catch {
        finish({ ok: false, error: 'send_failed' });
        try {
          ws.close();
        } catch {
          // noop
        }
        return;
      }
      heartbeat = setInterval(() => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {
          // noop
        }
      }, HEARTBEAT_MS);
    };

    ws.onmessage = (event) => {
      let message = null;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      const type = message?.type;

      if (type === 'ping') {
        try {
          ws.send(JSON.stringify({ type: 'pong' }));
        } catch {
          // noop
        }
        return;
      }

      if (type === 'device_registered') {
        setStoredDeviceToken(message.device_token, brand);
        activeDeviceSocket = ws;
        finish({ ok: true, deviceToken: message.device_token, isNew: !!message.is_new });
        // A propósito no se cierra acá: la conexión queda viva para poder
        // recibir `device_revoked` en vivo (ver doc de la función). El
        // caller la cierra explícitamente vía `closeActiveDeviceSession()`
        // al hacer logout (`clearSessionBeforeNewLogin`, loginFlow.js).
        return;
      }

      if (type === 'device_revoked') {
        clearStoredDeviceToken(brand);
        stopHeartbeat();
        activeDeviceSocket = null;
        try {
          callbacks.onRevoked?.(message.reason || 'revoked_by_subscriber');
        } catch {
          // noop -- un callback roto del caller no debe impedir cerrar el socket
        }
        try {
          ws.close();
        } catch {
          // noop
        }
        return;
      }

      if (type === 'error') {
        // `device_token_invalid`: el token guardado ya no sirve (revocado,
        // o de otra cuenta) -- se limpia para que el próximo intento
        // registre uno nuevo en vez de reintentar en loop con el mismo.
        if (message.code === 'device_token_invalid') {
          clearStoredDeviceToken(brand);
        }
        stopHeartbeat();
        finish({ ok: false, error: message.code || 'error' });
        try {
          ws.close();
        } catch {
          // noop
        }
      }
    };

    ws.onerror = () => {
      finish({ ok: false, error: 'ws_error' });
    };

    ws.onclose = () => {
      // Si ya se resolvió con éxito (`device_registered`) este cierre es de
      // una conexión que estuvo viva un rato y luego se cayó/cerró -- no
      // hay nada más que resolver. `finish()` ya es un no-op en ese caso.
      stopHeartbeat();
      if (activeDeviceSocket === ws) activeDeviceSocket = null;
      finish({ ok: false, error: 'closed_before_ack' });
    };
  });
}
