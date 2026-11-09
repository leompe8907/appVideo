/** Reposiciona el anillo tras cambios de layout (p. ej. sidebar expandido). */
export function requestTvFocusRingSync() {
  try {
    window.dispatchEvent(new CustomEvent('tv-focus-ring-sync'));
  } catch {
    // noop
  }
}
