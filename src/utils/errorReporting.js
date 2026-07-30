/**
 * Reporte de errores para producción en TV (sin devtools accesible).
 *
 * No asume ningún proveedor de pago concreto (Sentry, Bugsnag, etc.): envía un
 * payload JSON simple por POST/beacon a una URL configurable
 * (`VITE_ERROR_REPORT_URL`). Para usar un proveedor real, apuntar esa URL a su
 * endpoint de ingesta (o a una función propia que reenvíe), o reemplazar el
 * cuerpo de `sendRemote` por su SDK — sin tocar el resto de la app.
 *
 * Resiliencia: además de intentar el envío remoto, guarda los últimos N
 * errores en localStorage (ring buffer) para que soporte pueda recuperarlos
 * (ej. desde una pantalla de diagnóstico oculta) aunque la red haya fallado
 * justo en el momento del crash. `reportError` nunca lanza ni bloquea.
 */

const MAX_STORED_ERRORS = 20;
const MAX_REPORTS_PER_SESSION = 40; // corta ante tormentas de errores repetidos (ej. loop de render)
const STORAGE_KEY = 'app_error_log_v1';

let reportCount = 0;
const seenSignatures = new Set();

function getReportUrl() {
  try {
    return (import.meta.env.VITE_ERROR_REPORT_URL || '').trim();
  } catch {
    return '';
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

    const url = getReportUrl();
    if (!url) return;
    if (reportCount >= MAX_REPORTS_PER_SESSION) return;
    reportCount += 1;

    sendRemote(url, entry);
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
};
