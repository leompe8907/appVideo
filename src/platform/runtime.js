/**
 * Información y eventos del entorno de ejecución que el código compartido
 * necesita sin depender del DOM: user agent, idioma, conectividad, parámetros
 * de arranque y paso a segundo plano.
 *
 * La implementación por defecto es la del navegador. Otras plataformas
 * (Vega / React Native) registran la suya con `setPlatformRuntime` al
 * arrancar; los métodos que no pasen se quedan con el comportamiento web,
 * que ya tolera la ausencia de `window`/`document`/`navigator`.
 */

const hasWindow = () => typeof window !== 'undefined';
const hasDocument = () => typeof document !== 'undefined';
const hasNavigator = () => typeof navigator !== 'undefined';

const webRuntime = {
  name: 'web',

  getUserAgent() {
    return hasNavigator() ? String(navigator.userAgent || '') : '';
  },

  getLanguage() {
    return hasNavigator() ? String(navigator.language || navigator.userLanguage || '') : '';
  },

  /** `false` sólo cuando se sabe que no hay red. */
  isOnline() {
    return hasNavigator() ? navigator.onLine !== false : true;
  },

  /** Parámetro de arranque (en la web, `?brand=...` de la URL). */
  getLaunchParam(name) {
    try {
      if (!hasWindow() || !window.location) return null;
      return new URLSearchParams(window.location.search).get(name);
    } catch {
      return null;
    }
  },

  /**
   * Llama a `handler` cuando la app pasa a segundo plano o se cierra.
   * @returns {() => void} para dejar de escuchar
   */
  onAppHidden(handler) {
    if (!hasWindow() || !hasDocument()) return () => {};
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') handler();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', handler);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', handler);
    };
  },
};

let runtime = webRuntime;

/** @param {Partial<typeof webRuntime>} overrides */
export function setPlatformRuntime(overrides) {
  runtime = { ...webRuntime, ...(overrides || {}) };
}

export function getPlatformName() {
  return runtime.name;
}

export function getUserAgent() {
  try {
    return runtime.getUserAgent();
  } catch {
    return '';
  }
}

export function getLanguage() {
  try {
    return runtime.getLanguage();
  } catch {
    return '';
  }
}

export function isOnline() {
  try {
    return runtime.isOnline();
  } catch {
    return true;
  }
}

export function getLaunchParam(name) {
  try {
    return runtime.getLaunchParam(name);
  } catch {
    return null;
  }
}

export function onAppHidden(handler) {
  try {
    return runtime.onAppHidden(handler) || (() => {});
  } catch {
    return () => {};
  }
}
