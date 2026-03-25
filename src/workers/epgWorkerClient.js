let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./epgNormalize.worker.js', import.meta.url), { type: 'module' });
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

