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
  return window.isSecureContext === true && document.fullscreenEnabled !== false;
}

/**
 * Solicita fullscreen nativo. Retorna una Promise que resuelve en `true` si tuvo éxito,
 * o `false` si ningún candidato la soporta. Llamar dentro del gesto del usuario (click).
 *
 * Se pasa `{ navigationUI: 'hide' }` para pedir al browser que oculte su chrome
 * (barra de URL, tabs). No todos los browsers lo honran, pero es la señal correcta.
 *
 * @returns {Promise<boolean>}
 */
export async function requestNativeFullscreen() {
  if (!canUseNativeFullscreen()) return false;

  // Preferimos documentElement para que el browser oculte su chrome completo.
  // El player ya está en position:fixed inset:0 z-index:1000, así que dentro del
  // fullscreen nativo de <html> el video cubre todo igualmente.
  const candidates = [
    document.documentElement,
    document.body,
    getPlayerRootElement(),
    document.querySelector('.home-global-player video'),
  ].filter(Boolean);

  for (const el of candidates) {
    try {
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen({ navigationUI: 'hide' });
        return true;
      }
      if (typeof el.webkitRequestFullscreen === 'function') {
        el.webkitRequestFullscreen();
        return true;
      }
      if (typeof el.mozRequestFullScreen === 'function') {
        el.mozRequestFullScreen();
        return true;
      }
      if (typeof el.msRequestFullscreen === 'function') {
        el.msRequestFullscreen();
        return true;
      }
    } catch {
      // Candidato rechazó (e.g. política del browser) → intentar siguiente
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

  const candidates = [
    document.documentElement,
    document.body,
    getPlayerRootElement(),
    document.querySelector('.home-global-player video'),
  ].filter(Boolean);

  for (const el of candidates) {
    try {
      if (typeof el.requestFullscreen === 'function') {
        const result = el.requestFullscreen({ navigationUI: 'hide' });
        if (result && typeof result.catch === 'function') {
          result.catch(() => {});
        }
        return true;
      }
      if (typeof el.webkitRequestFullscreen === 'function') {
        el.webkitRequestFullscreen();
        return true;
      }
      if (typeof el.mozRequestFullScreen === 'function') {
        el.mozRequestFullScreen();
        return true;
      }
      if (typeof el.msRequestFullscreen === 'function') {
        el.msRequestFullscreen();
        return true;
      }
    } catch {
      // Probar siguiente candidato
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
