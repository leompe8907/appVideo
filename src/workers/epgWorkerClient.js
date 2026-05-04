let worker = null;
let seq = 0;
const pending = new Map();

// Worker inline (Blob) para evitar problemas de rutas/SPA fallback en `vite preview`.
// Importante: debe ser "classic worker" (sin `type: 'module'`) para no depender de un asset externo.
const EPG_WORKER_SOURCE = `
function toMs(dateLike) {
  if (dateLike == null) return null;
  if (typeof dateLike === 'number') return Number.isFinite(dateLike) ? dateLike : null;
  var s = String(dateLike).trim();
  if (!s) return null;
  var hasExplicitTz = /([zZ]|[+-]\\d{2}:?\\d{2})$/.test(s);
  if (!hasExplicitTz) {
    var m = s.match(/^(\\d{4})-(\\d{2})-(\\d{2})[ T](\\d{2}):(\\d{2})(?::(\\d{2}))?/);
    if (m) {
      var y = Number(m[1]);
      var mo = Number(m[2]);
      var d = Number(m[3]);
      var h = Number(m[4]);
      var mi = Number(m[5]);
      var se = m[6] != null ? Number(m[6]) : 0;
      var msUtc = Date.UTC(y, mo - 1, d, h, mi, se, 0);
      return Number.isFinite(msUtc) ? msUtc : null;
    }
  }
  var ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function filterAndEnrichEvents(data, epgHoursLimit, nowMs) {
  var limit = Number.isFinite(epgHoursLimit) ? epgHoursLimit : 12;
  var now = Number.isFinite(nowMs) ? nowMs : Date.now();
  var out = [];
  (data || []).forEach(function (event) {
    var startMs = toMs(event && event.start);
    var endMs = toMs(event && event.end);
    if (startMs == null || endMs == null) return;
    var hoursDiff = Math.abs(startMs - now) / (1000 * 60 * 60);
    if (hoursDiff <= limit) {
      out.push(Object.assign({}, event, {
        startDate: { valueOf: function () { return startMs; } },
        endDate: { valueOf: function () { return endMs; } }
      }));
    }
  });
  return out;
}

self.onmessage = function (e) {
  var msg = (e && e.data) || {};
  var id = msg.id;
  try {
    var events = filterAndEnrichEvents(msg.data, msg.epgHoursLimit, msg.nowMs);
    self.postMessage({ id: id, events: events });
  } catch (err) {
    self.postMessage({ id: id, error: String((err && err.message) || err) });
  }
};
`;

function getWorker() {
  if (worker) return worker;
  try {
    const blob = new Blob([EPG_WORKER_SOURCE], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);
    worker.onmessage = (e) => {
      const { id, events, error } = e?.data || {};
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve(events || []);
    };
    worker.onerror = (e) => {
      // Si el worker falla, liberamos pendientes.
      const err = new Error(e?.message || 'EPG worker error');
      pending.forEach((p) => p.reject(err));
      pending.clear();
    };
    return worker;
  } catch {
    return null;
  }
}

export async function normalizeEpgInWorker(data, { epgHoursLimit, nowMs } = {}) {
  const w = getWorker();
  if (!w) return null;
  const id = ++seq;
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  w.postMessage({ id, data, epgHoursLimit, nowMs });
  return promise;
}

