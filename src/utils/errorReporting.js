/**
 * Reporte de errores para producción en TV (sin devtools accesible).
 *
 * Dos destinos independientes, ninguno obligatorio -- se manda a los que
 * estén configurados, no lanza si ninguno lo está:
 * 1. `VITE_ERROR_REPORT_URL` (legado): URL genérica por POST/beacon, para
 *    apuntar a un proveedor propio si hiciera falta en el futuro.
 * 2. `POST {base}/api/v1/logs/` (Back-Wind-V2, app `applogs`) -- el sistema
 *    propio de diagnóstico del backend, ver
 *    docs/GUIA_INTEGRACION_UNIFICADA.md sección 7 y
 *    docs/LOGS_DIAGNOSTICO_2026-09-01.md en ese repo. Requiere
 *    `VITE_APP_LOGS_INGEST_KEY` (secreto compartido, header
 *    `X-App-Log-Key`) y que el brand tenga una base de backend Wind
 *    resuelta (`resolveDeviceAuthBaseUrl` -- la misma que usa
 *    "dispositivos vinculados", pero sin depender de que esa feature esté
 *    activada: el endpoint de logs no exige JWT). Si hay una sesión de
 *    dispositivo activa, se manda igual el JWT (`Authorization`) para que
 *    el backend asocie el reporte al suscriptor -- si no hay, el reporte
 *    se manda de todos modos, sin asociar (útil para crashes antes del
 *    login).
 *
 * Resiliencia: además de intentar el envío remoto, guarda los últimos N
 * errores en localStorage (ring buffer) para que soporte pueda recuperarlos
 * (ej. desde una pantalla de diagnóstico oculta) aunque la red haya fallado
 * justo en el momento del crash. `reportError` nunca lanza ni bloquea.
 *
 * Breadcrumbs: ring buffer chico en memoria (no persiste, se pierde al
 * recargar) de "qué pasó antes del error" -- navegación, llamadas de red,
 * acciones del usuario. Se arma llamando a `addBreadcrumb()` desde los
 * puntos que se quieran instrumentar (todavía no hay ninguna llamada
 * agregada en el resto de la app -- este archivo solo deja lista la
 * infraestructura); lo acumulado se adjunta automáticamente a cada reporte
 * mandado al backend.
 */

import { detectTvVendorFromApis } from './tvPlatformApis';

const MAX_STORED_ERRORS = 20;
const MAX_REPORTS_PER_SESSION = 40; // corta ante tormentas de errores repetidos (ej. loop de render)
const STORAGE_KEY = 'app_error_log_v1';
const MAX_BREADCRUMBS = 50;

let reportCount = 0;
const seenSignatures = new Set();
const breadcrumbs = [];

/**
 * Registra un breadcrumb (contexto previo a un posible error futuro).
 * Nunca lanza. Ej.: `addBreadcrumb('nav', 'abrió BouquetPage')`,
 * `addBreadcrumb('http', 'GET /api/v1/epg -> 500')`.
 * @param {string} category
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
export function addBreadcrumb(category, message, data) {
  try {
    breadcrumbs.push({
      category: String(category || ''),
      message: String(message || ''),
      ...(data ? { data } : {}),
      ts: new Date().toISOString(),
    });
    while (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
  } catch {
    // noop
  }
}

function getReportUrl() {
  try {
    return (import.meta.env.VITE_ERROR_REPORT_URL || '').trim();
  } catch {
    return '';
  }
}

function getLogsIngestKey() {
  try {
    return (import.meta.env.VITE_APP_LOGS_INGEST_KEY || '').trim();
  } catch {
    return '';
  }
}

/** `tv_tizen` (Samsung), `tv_webos` (LG), o `web` -- mismos valores que `LogIssue.PLATFORM_CHOICES` en el backend. */
function resolvePlatform() {
  try {
    const vendor = detectTvVendorFromApis();
    if (vendor === 'samsung') return 'tv_tizen';
    if (vendor === 'lg') return 'tv_webos';
  } catch {
    // noop
  }
  return 'web';
}

/**
 * Envía un reporte a `POST {base}/api/v1/logs/` -- fire-and-forget, nunca
 * lanza hacia el caller. `sendBeacon` no sirve acá (no permite headers
 * custom como `X-App-Log-Key`), así que siempre es `fetch` con `keepalive`.
 */
async function sendToDiagnosticsBackend(entry) {
  try {
    const apiKey = getLogsIngestKey();
    if (!apiKey) return;

    const [{ getActiveBrandConfig }, { resolveBrandId }, deviceAuth] = await Promise.all([
      import('../config/brandConfig'),
      import('./brandStorage'),
      import('./deviceAuthService'),
    ]);

    const brandConfig = getActiveBrandConfig();
    const base = deviceAuth.resolveDeviceAuthBaseUrl(brandConfig);
    if (!base) return;

    const brand = resolveBrandId();
    const headers = { 'Content-Type': 'application/json', 'X-App-Log-Key': apiKey };
    if (deviceAuth.hasDeviceSessionAuth(brand)) {
      const token = deviceAuth.getDeviceSessionAccessToken(brand);
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const appVersion = brandConfig?.appVersion || brandConfig?.version || '';

    const payload = {
      platform: resolvePlatform(),
      level: 'error',
      message: entry.message,
      stack: entry.stack,
      breadcrumbs: breadcrumbs.length ? breadcrumbs.slice() : undefined,
      extra: {
        context: entry.context || undefined,
        url: entry.url || undefined,
        userAgent: entry.userAgent || undefined,
        isTV: entry.isTV,
        sessionTag: entry.sessionTag,
        ...(entry.extra || {}),
      },
      appVersion: appVersion ? String(appVersion) : undefined,
      deviceType: entry.isTV ? 'tv' : 'web',
    };

    await fetch(`${base}/api/v1/logs/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Sin red, brand sin backend Wind, endpoint caído, etc -- el error ya
    // quedó en localStorage (ver storeError); no reintentamos en bucle.
  }
}

function getSessionTag() {
  if (typeof window === 'undefined') return '';
  try {
    if (!window.__errorReportSessionId) {
      window.__errorReportSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return window.__errorReportSessionId;
  } catch {
    return '';
  }
}

function readStoredErrors() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storeError(entry) {
  try {
    const list = readStoredErrors();
    list.push(entry);
    while (list.length > MAX_STORED_ERRORS) list.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage puede fallar (cuota, modo privado, storage no persistente en algunos TV) — no bloquear.
  }
}

function sendRemote(url, entry) {
  const body = JSON.stringify(entry);
  // sendBeacon es ideal para "la app se está yendo"/crash, pero no todos los
  // WebViews de TV 2019 lo soportan de forma confiable — fetch con keepalive
  // como fallback.
  let sent = false;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    }
  } catch {
    sent = false;
  }
  if (!sent && typeof fetch === 'function') {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Sin red o endpoint caído: el error ya quedó en localStorage; no reintentamos en bucle.
    });
  }
}

/** Últimos errores capturados en este dispositivo (para una futura pantalla de diagnóstico/soporte). */
export function getStoredErrorReports() {
  return readStoredErrors();
}

export function clearStoredErrorReports() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

/**
 * Reporta un error de forma resiliente: nunca lanza, nunca bloquea el hilo principal.
 * @param {unknown} error
 * @param {{ context?: string, extra?: Record<string, unknown> }} [opts]
 */
export function reportError(error, opts = {}) {
  try {
    const message = error?.message || (typeof error === 'string' ? error : String(error ?? 'Unknown error'));
    const stack = typeof error?.stack === 'string' ? error.stack.slice(0, 4000) : '';

    // Evitar tormentas del mismo error repetido (ej. un componente reintentando en loop).
    const signature = `${opts.context || ''}|${message}|${stack.slice(0, 300)}`;
    if (seenSignatures.has(signature)) return;
    seenSignatures.add(signature);

    const entry = {
      message,
      stack,
      context: opts.context || '',
      extra: opts.extra || undefined,
      url: typeof location !== 'undefined' ? location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      isTV: typeof document !== 'undefined' && document.documentElement.classList.contains('device-tv'),
      sessionTag: getSessionTag(),
      ts: new Date().toISOString(),
    };

    storeError(entry);

    if (import.meta.env.DEV) {
      // Nota: no hay regla `no-console` activa en eslint.config.js, así que
      // el eslint-disable que había acá quedaba marcado como "unused directive".
      console.error('[errorReporting]', entry);
    }

    if (reportCount >= MAX_REPORTS_PER_SESSION) return;
    reportCount += 1;

    const url = getReportUrl();
    if (url) sendRemote(url, entry);

    // Fire-and-forget: no se espera esta promesa, para no retrasar nada del
    // caller (`reportError` es sync en todo lo demás).
    sendToDiagnosticsBackend(entry);
  } catch {
    // El reporte de errores NUNCA debe generar un error nuevo.
  }
}

/**
 * Engancha listeners globales para errores que NO pasan por el render de React
 * (excepciones sueltas en handlers/timeouts, promesas rechazadas sin catch —
 * ej. fallos de red del player, del EPG, etc). Llamar una única vez al arrancar.
 */
export function installGlobalErrorReporting() {
  if (typeof window === 'undefined' || window.__errorReportingInstalled) return;
  window.__errorReportingInstalled = true;

  window.addEventListener('error', (event) => {
    reportError(event?.error || event?.message || 'window.onerror', { context: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event?.reason, { context: 'unhandledrejection' });
  });
}

export default {
  reportError,
  installGlobalErrorReporting,
  getStoredErrorReports,
  clearStoredErrorReports,
  addBreadcrumb,
};
