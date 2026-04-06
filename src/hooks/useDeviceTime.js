import { useEffect, useMemo, useState } from 'react';

function getDeviceNow() {
  try {
    // Samsung Tizen (si está disponible)
    const t = window?.tizen?.time?.getCurrentDateTime?.();
    if (t && typeof t.getTime === 'function') return t;
  } catch {
    // noop
  }
  return new Date();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Hora del dispositivo (Samsung/LG/Web) con update alineado al minuto.
 * @param {{ locale?: string, format?: 'HH:mm' | 'HH:mm:ss' }} options
 */
export function useDeviceTime(options = {}) {
  const { locale, format = 'HH:mm' } = options;
  const [now, setNow] = useState(() => getDeviceNow());

  useEffect(() => {
    let timeoutId = 0;
    let intervalId = 0;

    const tick = () => setNow(getDeviceNow());

    // Alinear al próximo segundo/minuto para no drift.
    const d = getDeviceNow();
    const ms = d.getMilliseconds();
    const s = d.getSeconds();
    const stepMs = format === 'HH:mm:ss' ? 1000 : 60_000;
    const remain = format === 'HH:mm:ss'
      ? (1000 - ms)
      : (60_000 - (s * 1000 + ms));

    timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, stepMs);
    }, Math.max(50, remain));

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [format]);

  const text = useMemo(() => {
    const d = now instanceof Date ? now : new Date(now);

    // Intl suele estar disponible en TVs modernas; si falla, fallback manual.
    try {
      const opts = format === 'HH:mm:ss'
        ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' };

      const value = new Intl.DateTimeFormat(locale || undefined, {
        hour12: false,
        ...opts,
      }).format(d);

      return value;
    } catch {
      const h = pad2(d.getHours());
      const m = pad2(d.getMinutes());
      const s = pad2(d.getSeconds());
      return format === 'HH:mm:ss' ? `${h}:${m}:${s}` : `${h}:${m}`;
    }
  }, [now, locale, format]);

  return { now, text };
}

export default useDeviceTime;

