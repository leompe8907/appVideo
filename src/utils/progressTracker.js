/**
 * Detecta una reproducción congelada mirando solo `currentTime`: algunos <video> de Smart TV no emiten
 * `waiting` ni bajan `readyState` cuando la red cae, así que los eventos no sirven para avisar.
 *
 * @param {() => number} [now]
 * @returns {{ update: (currentTime: number, active: boolean) => number, reset: () => void }}
 *   `update` devuelve los ms que lleva sin avanzar (0 si avanza o `active` es false).
 */
export function createProgressTracker(now = Date.now) {
  let lastTime = null;
  let since = now();
  return {
    update(currentTime, active) {
      const t = now();
      if (!active || currentTime !== lastTime) {
        lastTime = currentTime;
        since = t;
        return 0;
      }
      return t - since;
    },
    reset() {
      lastTime = null;
      since = now();
    },
  };
}
