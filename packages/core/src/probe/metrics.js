/**
 * Cálculos puros de la sonda de rendimiento (sin DOM): los usa el reporte de
 * la prueba de resistencia (`tools/soak/report.mjs`) sobre los eventos que
 * manda `webProbe.js`. Ver `docs`/Fase 0 para los umbrales.
 */

/** Percentil por rango más cercano; `null` si no hay datos. */
export function percentile(values, p) {
  const sorted = values.filter((v) => typeof v === 'number' && isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** Pendiente por mínimos cuadrados (y por unidad de x). */
export function slope(points) {
  if (points.length < 2) return null;
  const n = points.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of points) {
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const den = n * sxx - sx * sx;
  return den === 0 ? null : (n * sxy - sx * sy) / den;
}

/**
 * Detecta recargas y cierres a partir de los eventos de una corrida.
 * - Recarga: un `boot` después del primero (la app volvió a cargar la página).
 * - Cierre: un hueco entre latidos mayor que `gapMs` (la app dejó de reportar
 *   sin que llegara un `boot` nuevo en ese intervalo, o con un `boot` después).
 */
export function detectRestarts(events, { gapMs = 35000 } = {}) {
  const boots = events.filter((e) => e.t === 'boot');
  const alive = events.filter((e) => e.t === 'hb' || e.t === 'boot').map((e) => e.ts).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < alive.length; i++) {
    if (alive[i] - alive[i - 1] > gapMs) gaps.push({ from: alive[i - 1], to: alive[i], ms: alive[i] - alive[i - 1] });
  }
  return { reloads: Math.max(0, boots.length - 1), gaps };
}

/**
 * Memoria: compara el heap usado entre `fromMin` y el final de la corrida, y
 * la pendiente en MB/hora. Un valor que vuelve a la base al regresar al Home
 * se mide aparte (eventos `route` con `path` del Home).
 */
export function memoryGrowth(events, { fromMin = 10 } = {}) {
  const hb = events.filter((e) => e.t === 'hb' && e.heap && e.heap.used > 0);
  if (!hb.length) return null;
  const t0 = hb[0].ts;
  const after = hb.filter((e) => e.ts - t0 >= fromMin * 60000);
  if (after.length < 2) return { samples: hb.length, enough: false };
  const first = after[0].heap.used;
  const last = after[after.length - 1].heap.used;
  const mbPerHour = slope(after.map((e) => [(e.ts - t0) / 3600000, e.heap.used / 1048576]));
  return {
    samples: after.length,
    enough: true,
    startMB: first / 1048576,
    endMB: last / 1048576,
    maxMB: Math.max(...after.map((e) => e.heap.used)) / 1048576,
    growthPct: ((last - first) / first) * 100,
    mbPerHour,
    domNodesEnd: after[after.length - 1].dom,
    domNodesMax: Math.max(...after.map((e) => e.dom || 0)),
  };
}

/** Latencia tecla→primer cambio visual y frames, a partir de `key` y `hb`. */
export function responsiveness(events) {
  const lat = events.filter((e) => e.t === 'key' && typeof e.lat === 'number').map((e) => e.lat);
  const noChange = events.filter((e) => e.t === 'key' && e.lat == null).length;
  const hb = events.filter((e) => e.t === 'hb' && e.frames);
  const frames = hb.reduce((a, e) => a + e.frames.n, 0);
  const slow33 = hb.reduce((a, e) => a + e.frames.over33, 0);
  const slow50 = hb.reduce((a, e) => a + e.frames.over50, 0);
  const longTasks = events.filter((e) => e.t === 'longtask').map((e) => e.ms);
  const routes = events.filter((e) => e.t === 'route' && typeof e.sinceKey === 'number').map((e) => e.sinceKey);
  return {
    keys: lat.length + noChange,
    keysWithoutVisualChange: noChange,
    p50: percentile(lat, 50),
    p95: percentile(lat, 95),
    max: lat.length ? Math.max(...lat) : null,
    framesSampled: frames,
    pctFramesOver33: frames ? (slow33 / frames) * 100 : null,
    pctFramesOver50: frames ? (slow50 / frames) * 100 : null,
    longTasks: longTasks.length,
    longTaskP95: percentile(longTasks, 95),
    longTaskMax: longTasks.length ? Math.max(...longTasks) : null,
    areaChangeP50: percentile(routes, 50),
    areaChangeP95: percentile(routes, 95),
  };
}

/** TTFF y proporción de tiempo en rebuffer (excluye esperas por seek). */
export function video(events) {
  const ttff = events.filter((e) => e.t === 'ttff').map((e) => e.ms);
  const stalls = events.filter((e) => e.t === 'stall');
  const stallMs = stalls.reduce((a, e) => a + e.ms, 0);
  const playMs = events.filter((e) => e.t === 'hb').reduce((a, e) => a + (e.playMs || 0), 0);
  return {
    starts: ttff.length,
    ttffP50: percentile(ttff, 50),
    ttffP90: percentile(ttff, 90),
    stalls: stalls.length,
    rebufferPct: playMs + stallMs > 0 ? (stallMs / (playMs + stallMs)) * 100 : null,
    mediaErrors: events.filter((e) => e.t === 'mediaerror').length,
  };
}

/** Arranque: ms desde navigationStart hasta el primer foco dentro de la app. */
export function startup(events) {
  const v = events.filter((e) => e.t === 'interactive').map((e) => e.ms);
  return { samples: v.length, first: v.length ? v[0] : null, p50: percentile(v, 50), max: v.length ? Math.max(...v) : null };
}
