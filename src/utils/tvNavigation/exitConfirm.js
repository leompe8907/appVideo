/**
 * Confirmación de salida con doble Atrás: el primer BACK en la raíz del Home solo "arma" la salida
 * (la UI avisa), el segundo dentro de `windowMs` la confirma. Evita que una ráfaga de Atrás cierre
 * la app por accidente.
 *
 * @param {{ windowMs?: number, now?: () => number }} [options]
 * @returns {() => boolean} true cuando hay que salir de verdad
 */
export function createExitConfirm({ windowMs = 2500, now = Date.now } = {}) {
  let armedAt = null;
  return () => {
    const t = now();
    if (armedAt !== null && t - armedAt <= windowMs) {
      armedAt = null;
      return true;
    }
    armedAt = t;
    return false;
  };
}

/** Aviso flotante sin React (no roba el foco). */
export function showExitHint(text, ms = 2500) {
  if (typeof document === 'undefined') return;
  document.querySelector('.exit-hint')?.remove();
  const el = document.createElement('div');
  el.className = 'exit-hint';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), ms);
}
