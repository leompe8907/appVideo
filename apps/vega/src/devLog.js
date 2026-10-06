/**
 * En builds de desarrollo manda los logs a la Mac (`scripts/logserver.py`),
 * porque el journal del dispositivo recorta los de la app. Necesita el túnel:
 *   vda -s <ip>:5555 reverse tcp:8765 tcp:8765
 */
const LOG_URL = 'http://127.0.0.1:8765/log';

export function devLog(...args) {
  const msg = args
    .map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'string' ? a : safeJson(a)))
    .join(' ');
  console.log('[appVideo] ' + msg);
  if (!__DEV__) return;
  fetch(LOG_URL, {method: 'POST', body: msg}).catch(() => {});
}

function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function installDevErrorLogging() {
  const prev = global.ErrorUtils?.getGlobalHandler?.();
  global.ErrorUtils?.setGlobalHandler?.((e, isFatal) => {
    devLog(`ERROR JS${isFatal ? ' fatal' : ''}:`, e);
    prev?.(e, isFatal);
  });
}
