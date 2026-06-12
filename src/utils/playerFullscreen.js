const CSS_FULLSCREEN_CLASS = 'home-global-player--browser-fullscreen';
const HTML_FULLSCREEN_CLASS = 'app-player-fullscreen';

/** @returns {Element | null} */
export function getNativeFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

export function getPlayerRootElement() {
  return document.querySelector('.home-global-player');
}

export function isCssPlayerFullscreen() {
  return getPlayerRootElement()?.classList.contains(CSS_FULLSCREEN_CLASS) === true;
}

/** Fullscreen nativo o fallback CSS (maximizado con cover). */
export function isAppFullscreenActive() {
  return Boolean(getNativeFullscreenElement()) || isCssPlayerFullscreen();
}

export function canUseNativeFullscreen() {
  return (
    document.fullscreenEnabled === true ||
    document.webkitFullscreenEnabled === true ||
    document.mozFullScreenEnabled === true ||
    document.msFullscreenEnabled === true ||
    // If all are undefined (like on iOS Safari), we still return true to allow attempting video-specific methods
    (document.fullscreenEnabled === undefined && 
     document.webkitFullscreenEnabled === undefined)
  );
}

/**
 * Solicita fullscreen nativo. Retorna una Promise que resuelve en `true` si tuvo éxito,
 * o `false` si ningún candidato la soporta o fue rechazado. Llamar dentro del gesto del usuario (click).
 *
 * Se pasa `{ navigationUI: 'hide' }` para pedir al browser que oculte su chrome
 * (barra de URL, tabs). No todos los browsers lo honran, pero es la señal correcta.
 *
 * @returns {Promise<boolean>}
 */
export async function requestNativeFullscreen() {
  if (!canUseNativeFullscreen()) return false;

  // 1. Preferir el estándar requestFullscreen en el documentElement
  if (document.documentElement && typeof document.documentElement.requestFullscreen === 'function') {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      return true;
    } catch {
      // Si el estándar falla (p. ej., por falta de permisos o contexto inseguro),
      // fallamos de inmediato en lugar de hacer loops asíncronos que perderían el gesto de usuario.
      return false;
    }
  }

  // 2. Fallbacks de prefijos antiguos o para iOS Safari (iPhone) que requiere webkitEnterFullscreen en el video
  const playerRoot = getPlayerRootElement();
  const videoEl = document.querySelector('.home-global-player video');

  const targets = [
    { el: document.documentElement, methods: ['webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'] },
    { el: document.body, methods: ['webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'] },
    { el: playerRoot, methods: ['webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'] },
    { el: videoEl, methods: ['webkitRequestFullscreen', 'webkitEnterFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'] }
  ].filter(t => t.el);

  for (const target of targets) {
    for (const method of target.methods) {
      if (typeof target.el[method] === 'function') {
        try {
          const res = target.el[method]();
          if (res instanceof Promise) {
            await res;
          }
          return true;
        } catch {
          // Abortamos de inmediato si falla el método seleccionado para no causar errores en cascada
          return false;
        }
      }
    }
  }

  return false;
}

/**
 * @deprecated Usar `requestNativeFullscreen()` (async) cuando sea posible.
 * Se conserva para compatibilidad con callers que no pueden await.
 * @returns {boolean}
 */
export function requestNativeFullscreenSync() {
  if (!canUseNativeFullscreen()) return false;

  if (document.documentElement && typeof document.documentElement.requestFullscreen === 'function') {
    try {
      const result = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  const playerRoot = getPlayerRootElement();
  const videoEl = document.querySelector('.home-global-player video');

  const targets = [
    { el: document.documentElement, methods: ['webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'] },
    { el: document.body, methods: ['webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'] },
    { el: playerRoot, methods: ['webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'] },
    { el: videoEl, methods: ['webkitRequestFullscreen', 'webkitEnterFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'] }
  ].filter(t => t.el);

  for (const target of targets) {
    for (const method of target.methods) {
      if (typeof target.el[method] === 'function') {
        try {
          const res = target.el[method]();
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
          return true;
        } catch {
          // noop
        }
      }
    }
  }

  return false;
}

export function exitNativeFullscreenSync() {
  try {
    if (typeof document.exitFullscreen === 'function') {
      const result = document.exitFullscreen();
      if (result && typeof result.catch === 'function') result.catch(() => {});
      return;
    }
    if (typeof document.webkitExitFullscreen === 'function') {
      document.webkitExitFullscreen();
      return;
    }
    if (typeof document.mozCancelFullScreen === 'function') {
      document.mozCancelFullScreen();
      return;
    }
    if (typeof document.msExitFullscreen === 'function') {
      document.msExitFullscreen();
    }
  } catch {
    // noop
  }
}

/** Maximizado con cover cuando la API nativa no está disponible (p. ej. http://IP:3000). */
export function setCssPlayerFullscreen(enabled) {
  const root = getPlayerRootElement();
  const html = document.documentElement;
  if (!root || !html) return;

  root.classList.toggle(CSS_FULLSCREEN_CLASS, enabled);
  html.classList.toggle(HTML_FULLSCREEN_CLASS, enabled);
  html.style.setProperty('--player-video-object-fit', enabled ? 'cover' : 'contain');
}

export function exitAppFullscreenSync() {
  exitNativeFullscreenSync();
  setCssPlayerFullscreen(false);
}

/**
 * Entra en fullscreen. Retorna una Promise que resuelve en `'native' | 'css'`.
 * El caller debe esperar esta Promise antes de sincronizar el layout,
 * porque `requestFullscreen()` es async y el viewport cambia después.
 *
 * @returns {Promise<'native' | 'css'>}
 */
export async function enterAppFullscreen() {
  const ok = await requestNativeFullscreen();
  if (ok) return 'native';
  setCssPlayerFullscreen(true);
  return 'css';
}

/**
 * @deprecated Usar `enterAppFullscreen()` (async).
 * @returns {'native' | 'css' | false}
 */
export function enterAppFullscreenSync() {
  if (requestNativeFullscreenSync()) {
    return 'native';
  }
  setCssPlayerFullscreen(true);
  return 'css';
}

export const FULLSCREEN_CHANGE_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange',
];
