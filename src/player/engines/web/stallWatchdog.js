/**
 * Vigila el "buffering" de un stream: si el <video> queda esperando datos más de `stallMs` (red caída,
 * segmento colgado) llama a `onRetry` (recargar el stream) y sigue vigilando; tras `maxRetries` intentos
 * sin que la reproducción avance llama a `onGiveUp`. `clear()` se invoca cuando la reproducción avanza.
 *
 * @param {{ stallMs?: number, maxRetries?: number, onRetry: () => void, onGiveUp: () => void }} options
 */
export function createStallWatchdog({ stallMs = 20000, maxRetries = 3, onRetry, onGiveUp }) {
  let timer = null;
  let attempts = 0;

  const fire = () => {
    timer = null;
    attempts += 1;
    if (attempts > maxRetries) {
      attempts = 0;
      onGiveUp();
      return;
    }
    onRetry();
    timer = setTimeout(fire, stallMs);
  };

  return {
    arm() {
      if (timer !== null) return;
      timer = setTimeout(fire, stallMs);
    },
    clear() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      attempts = 0;
    },
  };
}
