/* global window, document, location, screen, requestAnimationFrame, MutationObserver, XMLHttpRequest */ // sólo web: la inyecta tools/soak, core no la importa
/**
 * Sonda de rendimiento para navegador / Tizen / webOS. Solo observa: no
 * cancela eventos, no cambia el DOM y no la importa la app. Se inyecta como
 * <script> en una copia empaquetada del build (`tools/soak/inject-probe.mjs`)
 * y manda eventos al recolector (`tools/soak/collector.mjs`).
 *
 * Eventos: boot, interactive, hb (latido con heap/DOM/frames), key (latencia
 * tecla→primer cambio visual), route, longtask, ttff, stall, mediaerror, error.
 * Los cálculos están en `metrics.js`.
 */

const KEY_WINDOW_MS = 1000;

function now() {
  return performance.now();
}

function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function currentPath() {
  return location.pathname + location.hash;
}

/** Primera clase del elemento con foco: evidencia de dónde quedó el foco. */
function focusLabel() {
  const a = document.activeElement;
  if (!a || a === document.body) return 'body';
  return String(a.className || a.tagName).split(' ')[0].slice(0, 40);
}

export function startWebProbe(options) {
  const endpoint = options.endpoint;
  const label = options.label || 'device';
  const flushMs = options.flushMs || 10000;
  const pageId = newId();
  let queue = [];
  let seq = 0;

  function emit(t, data) {
    const e = data || {};
    e.t = t;
    e.ts = Date.now();
    e.up = Math.round(now());
    e.seq = seq++;
    queue.push(e);
  }

  function flush() {
    if (!queue.length) return;
    const batch = { label: label, pageId: pageId, events: queue };
    queue = [];
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      // text/plain evita el preflight CORS en motores viejos.
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.send(JSON.stringify(batch));
    } catch {
      // El recolector caído no debe afectar a la app.
    }
  }

  // --- arranque y recargas -------------------------------------------------
  let loads = 1;
  try {
    loads = Number(sessionStorage.getItem('__probeLoads') || 0) + 1;
    sessionStorage.setItem('__probeLoads', String(loads));
  } catch { /* sin storage */ }
  const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  emit('boot', {
    loads: loads,
    navType: nav ? nav.type : (performance.navigation ? performance.navigation.type : null),
    ua: navigator.userAgent,
    screen: [screen.width, screen.height, window.devicePixelRatio],
    hasMemory: !!performance.memory,
  });

  // --- teclas: latencia hasta el primer cambio del DOM pintado ------------
  let pendingKey = null;
  let lastKeyAt = null;
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(function () {
      if (!pendingKey || pendingKey.mutated) return;
      pendingKey.mutated = true;
      const k = pendingKey;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (pendingKey !== k) return;
          emit('key', { code: k.code, lat: Math.round(now() - k.start), focus: focusLabel() });
          pendingKey = null;
        });
      });
    })
    : null;
  if (observer) {
    // Sin characterData: relojes y barras de progreso cambian texto todo el
    // tiempo y darían latencias falsamente bajas. El foco y el desplazamiento
    // se ven como cambios de clase/estilo o de nodos.
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-focused', 'aria-selected', 'tabindex'],
    });
  }
  // En window y en captura: la app corta la propagación en sus propios
  // listeners de window (captura), y la sonda se registra antes que ella.
  window.addEventListener('keydown', function (ev) {
    if (pendingKey && !pendingKey.mutated) emit('key', { code: pendingKey.code, lat: null, focus: focusLabel() });
    const start = ev.timeStamp > 0 && ev.timeStamp < now() + 1 ? ev.timeStamp : now();
    pendingKey = { code: ev.keyCode, start: start, mutated: false };
    lastKeyAt = start;
    const k = pendingKey;
    setTimeout(function () {
      if (pendingKey === k && !k.mutated) {
        emit('key', { code: k.code, lat: null, focus: focusLabel() });
        pendingKey = null;
      }
    }, KEY_WINDOW_MS);
  }, true);

  // --- frames, ruta y primer foco ------------------------------------------
  let frames = { n: 0, over33: 0, over50: 0, max: 0 };
  let lastFrame = null;
  let lastPath = currentPath();
  let interactiveSent = false;
  function onFrame(t) {
    const d = lastFrame !== null ? t - lastFrame : 0;
    // > 1 s entre frames = la página estuvo oculta o pausada, no un frame lento.
    if (lastFrame !== null && !document.hidden && d <= 1000) {
      frames.n++;
      if (d > 33.4) frames.over33++;
      if (d > 50) frames.over50++;
      if (d > frames.max) frames.max = d;
    }
    lastFrame = t;
    const p = currentPath();
    if (p !== lastPath) {
      emit('route', { from: lastPath, path: p, sinceKey: lastKeyAt != null ? Math.round(now() - lastKeyAt) : null });
      flush(); // los cambios de ruta salen al instante (el script de prueba los espera)
      lastPath = p;
    }
    if (!interactiveSent) {
      const a = document.activeElement;
      const root = document.getElementById('root');
      if (a && a !== document.body && root && root.contains(a)) {
        interactiveSent = true;
        emit('interactive', { ms: Math.round(now()), path: p });
      }
    }
    requestAnimationFrame(onFrame);
  }
  requestAnimationFrame(onFrame);

  // --- tareas largas -------------------------------------------------------
  try {
    const po = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        emit('longtask', { ms: Math.round(e.duration), path: lastPath });
      });
    });
    po.observe({ entryTypes: ['longtask'] });
  } catch { /* no soportado */ }

  // --- video: TTFF y rebuffer (eventos de media no burbujean: captura) ------
  let playMs = 0;
  const media = new WeakMap();
  function state(el) {
    let s = media.get(el);
    if (!s) {
      s = { loadAt: null, started: false, waitAt: null, seeking: false, playingAt: null };
      media.set(el, s);
    }
    return s;
  }
  function closePlaying(s) {
    if (s.playingAt != null) {
      playMs += now() - s.playingAt;
      s.playingAt = null;
    }
  }
  function onMedia(ev) {
    const el = ev.target;
    if (!el || (el.tagName !== 'VIDEO' && el.tagName !== 'AUDIO')) return;
    const s = state(el);
    switch (ev.type) {
      case 'loadstart':
        closePlaying(s);
        s.loadAt = now(); s.started = false; s.waitAt = null;
        break;
      case 'playing':
        if (!s.started && s.loadAt != null) {
          s.started = true;
          emit('ttff', { ms: Math.round(now() - s.loadAt) });
        } else if (s.waitAt != null && !s.seeking) {
          emit('stall', { ms: Math.round(now() - s.waitAt) });
        }
        s.waitAt = null; s.seeking = false;
        s.playingAt = now();
        break;
      case 'waiting':
        if (s.started) { closePlaying(s); s.waitAt = now(); }
        break;
      case 'seeking':
        s.seeking = true;
        break;
      case 'pause':
      case 'ended':
      case 'emptied':
        closePlaying(s);
        break;
      case 'error':
        emit('mediaerror', { code: el.error ? el.error.code : null });
        break;
      default:
    }
  }
  ['loadstart', 'playing', 'waiting', 'seeking', 'pause', 'ended', 'emptied', 'error'].forEach(function (type) {
    document.addEventListener(type, onMedia, true);
  });

  // --- errores no capturados -----------------------------------------------
  window.addEventListener('error', function (ev) {
    if (ev.target && ev.target !== window) return; // errores de recursos: ruido
    emit('error', { msg: String(ev.message || '').slice(0, 200) });
  });
  window.addEventListener('unhandledrejection', function (ev) {
    const r = ev.reason;
    emit('error', { msg: String((r && r.message) || r || '').slice(0, 200), rejection: true });
  });

  // --- latido --------------------------------------------------------------
  function heartbeat() {
    const m = performance.memory;
    const videos = document.getElementsByTagName('video');
    for (let i = 0; i < videos.length; i++) {
      const s = media.get(videos[i]);
      if (s && s.playingAt != null) { playMs += now() - s.playingAt; s.playingAt = now(); }
    }
    emit('hb', {
      path: lastPath,
      hidden: document.hidden,
      heap: m ? { used: m.usedJSHeapSize, total: m.totalJSHeapSize, limit: m.jsHeapSizeLimit } : null,
      dom: document.getElementsByTagName('*').length,
      imgs: document.images.length,
      videos: videos.length,
      frames: { n: frames.n, over33: frames.over33, over50: frames.over50, max: Math.round(frames.max) },
      playMs: Math.round(playMs),
    });
    frames = { n: 0, over33: 0, over50: 0, max: 0 };
    playMs = 0;
    flush();
  }
  setInterval(heartbeat, flushMs);
  window.addEventListener('pagehide', heartbeat);
  setTimeout(flush, 1000);

  return { pageId: pageId, flush: heartbeat };
}
