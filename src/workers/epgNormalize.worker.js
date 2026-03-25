// Web Worker: normaliza eventos EPG sin bloquear UI.
// Entrada: { id, data, epgHoursLimit, nowMs }
// Salida: { id, events }

function toMs(dateLike) {
  if (dateLike == null) return null;
  if (typeof dateLike === 'number') return Number.isFinite(dateLike) ? dateLike : null;
  const ms = new Date(dateLike).getTime();
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

