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
import { refreshDeviceSessionAccessToken, resolveDeviceAuthBaseUrl } from './deviceAuthService';

const STORAGE_KEYS = {
  deviceToken: 'deviceSession.deviceToken',
  deviceId: 'deviceSession.deviceId',
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
 * `id` interno del `DeviceSession` de este mismo dispositivo (el que
 * devuelve `device_registered`, ver backend Wind `device_consumers.py`).
 * Permite a la UI de "dispositivos vinculados" (`LinkedDevicesPanel.jsx`)
 * marcar cuál fila de la lista es "este dispositivo" comparando contra
 * `GET /wind/devices/`, en vez de no poder distinguirlo nunca (antes
 * `device_registered` no devolvía este campo).
 */
export function getStoredDeviceId(brand) {
  return getBrandItem(resolveBrandId(brand), STORAGE_KEYS.deviceId) || '';
}

function setStoredDeviceId(id, brand) {
  const brandId = resolveBrandId(brand);
  if (id != null) setBrandItem(brandId, STORAGE_KEYS.deviceId, String(id));
  else removeBrandItem(brandId, STORAGE_KEYS.deviceId);
}

function clearStoredDeviceId(brand) {
  removeBrandItem(resolveBrandId(brand), STORAGE_KEYS.deviceId);
}

/**
 * Restaura explícitamente un `device_token`/`id` leídos de antemano --
 * pensado para un logout "normal" (mismo usuario, mismo dispositivo, ver
 * `MiCuentaPage.jsx`) que necesita sobrevivir al borrado general de
 * `userSession.setLoggedOut()` (limpia TODO el storage de la marca, sin
 * excepciones), para que el próximo login en este mismo dispositivo
 * pueda refrescar el mismo `DeviceSession` en vez de crear uno nuevo.
 */
export function restoreStoredDeviceSession({ token, id } = {}, brand) {
  if (token) setStoredDeviceToken(token, brand);
  if (id != null && id !== '') setStoredDeviceId(id, brand);
}

// Callback global para cuando ESTE dispositivo recibe `device_revoked` por
// su propio WebSocket -- antes, `registerDeviceSession()` solo se lo
// pasaba de vuelta al caller (`loginFlow.js`) vía `callbacks.onRevoked`,
// que en producción no hacía nada visible (`loginFlow.js` es un servicio
// plano, sin acceso al router de React para forzar un logout real). Acá
// se agrega un segundo canal, global y persistente entre llamadas, para
// que `App.jsx` se suscriba una sola vez al montar la app y reaccione en
// vivo -- mismo patrón que ya usa `sessionValidator.setOnSessionInvalid`
// para el caso de sesión de PanAccess inválida.
let onDeviceRevokedGlobal = null;

export function setOnDeviceRevoked(fn) {
  onDeviceRevokedGlobal = typeof fn === 'function' ? fn : null;
}

// Callback global para cuando termina un `register_device` (nuevo o
// refresco) -- el registro pasa una sola vez al hacer login
// (`maybeEstablishDeviceSession`, fire-and-forget, sin que el resto de la
// app lo espere), pero `LinkedDevicesPanel.jsx` puede montarse mucho
// después (el usuario recién entra a "Mi cuenta" > "Dispositivos") y
// necesita saber el `id` de este dispositivo para marcarlo en la lista.
// Antes lo leía una sola vez de `localStorage` al renderizar -- si el
// `GET /wind/devices/` de esa pantalla terminaba ANTES que el WS de
// `register_device` (una conexión nueva puede tardar más que un simple
// GET), el panel se quedaba con el id vacío/viejo para siempre, aunque el
// registro terminara un instante después (reporte real: en varias
// ventanas de prueba, solo la que ya llevaba un rato abierta mostraba
// "Cerrar sesión aquí" correctamente). Con este canal, el panel puede
// re-leer el id apenas el registro termina, sin depender de que la
// carrera le haya jugado a favor.
let onDeviceRegisteredGlobal = null;

export function setOnDeviceRegistered(fn) {
  onDeviceRegisteredGlobal = typeof fn === 'function' ? fn : null;
}

// Callback global para `device_list_changed` -- aviso del backend (grupo
// por CUENTA, no por dispositivo, ver `wind/services/device_session_service.py`
// `notify_device_list_changed`) de que la lista de "dispositivos vinculados"
// de esta cuenta cambió desde OTRO dispositivo (alguien revocó uno, o se
// registró uno nuevo). Antes no había ningún canal para esto: si dos
// dispositivos de la misma cuenta tenían el panel abierto a la vez, revocar
// uno desde el otro no actualizaba la lista del que se quedó con la sesión
// activa hasta apretar "Actualizar" a mano. No implica ninguna acción
// destructiva (a diferencia de `device_revoked`) -- solo un "volvé a pedir
// la lista si la tenés abierta".
let onDeviceListChangedGlobal = null;

export function setOnDeviceListChanged(fn) {
  onDeviceListChangedGlobal = typeof fn === 'function' ? fn : null;
}

// Callback global para cuando la conexión ACTIVA (ya registrada con éxito)
// se cae sola -- blip de red, reinicio/deploy del backend, lo que sea --
// sin haber pasado por un cierre esperado (`closeActiveDeviceSession()` en
// logout, o el propio `device_revoked`, ambos ya limpian `activeDeviceSocket`
// ANTES de cerrar el socket, ver más abajo). Antes de esto, el único momento
// en que algo volvía a intentar reconectar era el watchdog de
// `useAppLifecycle.js` (al montar la app o al volver de background) -- si el
// socket moría mientras la pestaña se quedaba todo el tiempo en primer plano
// (sin pasar nunca por background), quedaba muerto para el resto de la
// sesión: caso real, cambio de contraseña hecho desde otro dispositivo que
// nunca llegó a este porque su `ws/device/` se había caído horas antes sin
// que nada lo notara. Este canal deja que `useAppLifecycle.js` reaccione de
// inmediato al cierre inesperado, sin depender de un evento de
// background/foreground para notarlo.
let onUnexpectedCloseGlobal = null;

export function setOnDeviceSessionUnexpectedClose(fn) {
  onUnexpectedCloseGlobal = typeof fn === 'function' ? fn : null;
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
 * true si ya hay una conexión de "dispositivo vinculado" abierta y en
 * estado OPEN -- usado por el watchdog centralizado de useAppLifecycle.js
 * para no reconectar de más cuando ya hay una conexión viva (p. ej. si el
 * login/splash normal ya la estableció justo antes).
 */
export function isDeviceSessionActive() {
  return !!(activeDeviceSocket && activeDeviceSocket.readyState === WebSocket.OPEN);
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
  const wsUrl = buildDeviceWsUrl(brandConfig);
  const brand = brandConfig?.brand;

  // Evita acumular conexiones si esta función se llama más de una vez sin
  // un logout explícito de por medio (p.ej. reactivación de sesión en
  // splash, o revalidación al volver de background -- ver
  // `useAppLifecycle`/`splashAuthFlow.js` -- ambas pueden reinvocar
  // `loginAndActivateLicense` sin pasar por `clearSessionBeforeNewLogin`).
  // Se hace una sola vez acá afuera, no en cada intento/reintento.
  closeActiveDeviceSession();

  /**
   * Un intento de conexión con un access token dado. Devuelve una promesa
   * que SIEMPRE resuelve (nunca rechaza) con `{ok, ...}` o con
   * `{ok:false, error:'retry_with_refreshed_token', ...}` -- este último
   * valor especial es interno, lo consume `registerDeviceSession` para
   * decidir si reintenta una vez con un token refrescado (ver abajo);
   * nunca llega al caller final de `registerDeviceSession`.
   */
  function attempt(token) {
    return new Promise((resolve) => {
      if (!wsUrl || !token) {
        resolve({ ok: false, error: 'missing_config' });
        return;
      }

      const deviceType = resolveDeviceType();
      const deviceModel = resolveDeviceModel(deviceType);
      const existingToken = getStoredDeviceToken(brand);

      let settled = false;
      let heartbeat = null;
      let hasOpened = false;
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
        ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
      } catch {
        resolve({ ok: false, error: 'ws_create_failed' });
        return;
      }

      ws.onopen = () => {
        hasOpened = true;
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
          setStoredDeviceId(message.id, brand);
          activeDeviceSocket = ws;
          try {
            onDeviceRegisteredGlobal?.({ deviceToken: message.device_token, id: message.id, brand });
          } catch {
            // noop -- un listener global roto no debe impedir resolver la promesa
          }
          finish({ ok: true, deviceToken: message.device_token, deviceId: message.id, isNew: !!message.is_new });
          // A propósito no se cierra acá: la conexión queda viva para poder
          // recibir `device_revoked` en vivo (ver doc de la función). El
          // caller la cierra explícitamente vía `closeActiveDeviceSession()`
          // al hacer logout (`clearSessionBeforeNewLogin`, loginFlow.js).
          return;
        }

        if (type === 'device_list_changed') {
          try {
            onDeviceListChangedGlobal?.();
          } catch {
            // noop -- un listener global roto no debe afectar el resto del socket
          }
          return;
        }

        if (type === 'device_revoked') {
          const reason = message.reason || 'revoked_by_subscriber';
          clearStoredDeviceToken(brand);
          clearStoredDeviceId(brand);
          stopHeartbeat();
          activeDeviceSocket = null;
          try {
            callbacks.onRevoked?.(reason);
          } catch {
            // noop -- un callback roto del caller no debe impedir cerrar el socket
          }
          try {
            // Canal global (ver comentario en `setOnDeviceRevoked`) -- este
            // es el que de verdad fuerza el logout/redirect en producción;
            // `callbacks.onRevoked` (arriba) queda solo para que el caller
            // puntual (`loginFlow.js`) loguee/reaccione si quiere, sin
            // depender de él para el efecto principal.
            onDeviceRevokedGlobal?.(reason);
          } catch {
            // noop -- un listener global roto no debe impedir cerrar el socket
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
            clearStoredDeviceId(brand);
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
        // `wasActive`: esta conexión seguía siendo LA vigente (nadie la había
        // reemplazado ni desregistrado todavía) en el momento de cerrarse.
        // `closeActiveDeviceSession()` (logout) y el handler de
        // `device_revoked` (arriba) ya ponen `activeDeviceSocket = null`
        // ANTES de llamar a `ws.close()` -- así que si acá `wasActive` es
        // true, este cierre no vino de ninguno de esos dos caminos
        // esperados, es inesperado (red, backend reiniciado, etc.).
        const wasActive = activeDeviceSocket === ws;
        if (wasActive) activeDeviceSocket = null;
        // El backend valida el JWT solo en el `connect()` inicial (ver
        // `wind/utils/ws_auth.py` / `device_consumers.py`): si el token ya
        // expiró, cierra ANTES de aceptar la conexión (código 4001/4004) --
        // el navegador nunca dispara `onopen`. Se distingue de un cierre
        // normal (tras haber llegado a abrir) para no reintentar en casos
        // donde el problema es de red y no de JWT.
        if (!hasOpened) {
          finish({ ok: false, error: 'auth_failed_before_open' });
          return;
        }
        finish({ ok: false, error: 'closed_before_ack' });
        if (wasActive) {
          try {
            onUnexpectedCloseGlobal?.();
          } catch {
            // noop -- un listener global roto no debe afectar el resto del socket
          }
        }
      };
    });
  }

  return attempt(accessToken).then(async (result) => {
    if (result.ok) {
      return result;
    }

    if (result.error === 'auth_failed_before_open') {
      // Único reintento: refresca el access token con el refresh guardado
      // (`refreshDeviceSessionAccessToken`, antes código muerto) y reabre la
      // conexión una vez más. Si el refresh también falla (refresh vencido o
      // inexistente), se rinde -- el caller ya no puede hacer nada más sin
      // pasar por un login manual/social nuevo.
      const refreshedToken = await refreshDeviceSessionAccessToken(brandConfig, brand);
      if (!refreshedToken) {
        return { ok: false, error: 'auth_failed' };
      }
      return attempt(refreshedToken);
    }

    if (result.error === 'device_token_invalid') {
      // Único reintento, sin `device_token`: el que había guardado ya no
      // sirve -- pertenece a otro `subscriber_code` (dispositivo compartido
      // donde otro usuario acaba de loguearse) o quedó revocado del lado
      // del backend (ver `clearSessionBeforeNewLogin`, que ahora preserva
      // `device_token` "a ciegas" antes de cualquier login, confiando en
      // que el backend rechace uno que no corresponda). El handler de este
      // mensaje (arriba) ya lo borró de `localStorage`, así que este
      // segundo intento manda `register_device` sin ningún token existente
      // -- el backend crea un registro nuevo en vez de dejar esta sesión
      // sin ningún dispositivo vinculado hasta el próximo login.
      return attempt(accessToken);
    }

    return result;
  });
}
