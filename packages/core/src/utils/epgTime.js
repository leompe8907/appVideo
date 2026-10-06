/**
 * Utilidades de tiempo para EPG.
 *
 * Problema: el backend suele enviar fechas como "YYYY-MM-DD HH:mm[:ss]" SIN timezone.
 * `new Date("YYYY-MM-DD HH:mm:ss")` es ambiguo y puede interpretarse como hora local
 * (y variar según engine). Para mantener paridad con Android, lo tratamos como GMT/UTC.
 */
const NAIVE_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * Convierte string/timestamp/dateLike a milisegundos.
 * - Si es "YYYY-MM-DD HH:mm[:ss]" o "YYYY-MM-DDTHH:mm[:ss]" SIN timezone, se parsea como UTC.
 * - Si trae timezone (ej: 'Z', '+02:00') o es otro formato, cae a `new Date(...)`.
 * @param {string|number|Date|{valueOf:Function}|null|undefined} dateLike
 * @returns {number|null}
 */
export function parseEpgDateToMs(dateLike) {
  if (dateLike == null) return null;
  if (typeof dateLike === 'number') return Number.isFinite(dateLike) ? dateLike : null;
  if (dateLike instanceof Date) {
    const t = dateLike.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof dateLike?.valueOf === 'function' && typeof dateLike !== 'string') {
    const v = dateLike.valueOf();
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }

  const s = String(dateLike).trim();
  if (!s) return null;

  // Si explícitamente trae TZ, respetamos el parser nativo.
  // Ejemplos: 2026-04-08T12:34:00Z, 2026-04-08T12:34:00+02:00
  const hasExplicitTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  if (!hasExplicitTz) {
    const m = s.match(NAIVE_UTC_RE);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const h = Number(m[4]);
      const mi = Number(m[5]);
      const se = m[6] != null ? Number(m[6]) : 0;
      if (
        Number.isFinite(y) &&
        Number.isFinite(mo) &&
        Number.isFinite(d) &&
        Number.isFinite(h) &&
        Number.isFinite(mi) &&
        Number.isFinite(se)
      ) {
        const ms = Date.UTC(y, mo - 1, d, h, mi, se, 0);
        return Number.isFinite(ms) ? ms : null;
      }
    }
  }

  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

export function formatHHmmFromMs(ms) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

