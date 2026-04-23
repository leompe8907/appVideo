// Web Worker: normaliza eventos EPG sin bloquear UI.
// Entrada: { id, data, epgHoursLimit, nowMs }
// Salida: { id, events }

function toMs(dateLike) {
  if (dateLike == null) return null;
  if (typeof dateLike === 'number') return Number.isFinite(dateLike) ? dateLike : null;
  const s = String(dateLike).trim();
  if (!s) return null;

  // Igualar comportamiento con app (Android): timestamps EPG "naive" se tratan como UTC/GMT.
  // Formato esperado: "YYYY-MM-DD HH:mm[:ss]" o "YYYY-MM-DDTHH:mm[:ss]" (sin TZ).
  const hasExplicitTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  if (!hasExplicitTz) {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const h = Number(m[4]);
      const mi = Number(m[5]);
      const se = m[6] != null ? Number(m[6]) : 0;
      const msUtc = Date.UTC(y, mo - 1, d, h, mi, se, 0);
      return Number.isFinite(msUtc) ? msUtc : null;
    }
  }

  const ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function filterAndEnrichEvents(data, epgHoursLimit, nowMs) {
  const limit = Number.isFinite(epgHoursLimit) ? epgHoursLimit : 12;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const out = [];
  (data || []).forEach((event) => {
    const startMs = toMs(event?.start);
    const endMs = toMs(event?.end);
    if (startMs == null || endMs == null) return;
    const hoursDiff = Math.abs(startMs - now) / (1000 * 60 * 60);
    if (hoursDiff <= limit) {
      out.push({
        ...event,
        startDate: { valueOf: () => startMs },
        endDate: { valueOf: () => endMs },
      });
    }
  });
  return out;
}

self.onmessage = (e) => {
  const msg = e?.data || {};
  const id = msg.id;
  try {
    const events = filterAndEnrichEvents(msg.data, msg.epgHoursLimit, msg.nowMs);
    self.postMessage({ id, events });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};

