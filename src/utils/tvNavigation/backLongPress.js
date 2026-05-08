// Long-press del botón BACK del control remoto y salida de app por plataforma.

const DEFAULT_LONG_PRESS_MS = 1600;

/**
 * Intenta cerrar la aplicación según la plataforma.
 * - Samsung Tizen: window.tizen.application.getCurrentApplication().exit()
 * - LG webOS / fallback: window.close()
 *
 * Es best-effort: si ningún método está disponible, falla en silencio.
 */
export function exitAppBestEffort() {
  try {
    const tizenApp = window?.tizen?.application?.getCurrentApplication?.();
    if (tizenApp?.exit) {
      tizenApp.exit();
      return true;
    }
  } catch {
    // continuar al fallback
  }
  try {
    window.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Crea un controlador de long-press para BACK.
 * Mantiene el estado encapsulado (timer + bandera "ya disparó") en un closure.
 *
 * Uso típico:
 *   const back = createBackLongPress({ onTrigger: exitAppBestEffort });
 *   // en keydown BACK (no en repeats): back.arm()
 *   // en keyup BACK: back.clear()
 *   // si back.didTrigger(), consumir el keyup para evitar efectos colaterales
 */
export function createBackLongPress({ onTrigger, ms = DEFAULT_LONG_PRESS_MS } = {}) {
  let timer = null;
  let triggered = false;

  const arm = () => {
    if (timer) return;
    triggered = false;
    timer = setTimeout(() => {
      triggered = true;
      timer = null;
      try {
        onTrigger?.();
      } catch {
        // noop
      }
    }, ms);
  };

  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const didTrigger = () => triggered;
  const reset = () => {
    clear();
    triggered = false;
  };

  return { arm, clear, didTrigger, reset };
}
