/**
 * Qué hace BACK en el shell Home cuando no hay overlay ni player abierto.
 * - TV con el foco fuera del menú lateral: llevar el foco al menú (primer BACK).
 * - Con el foco ya en el menú:
 * - Subruta de /home/*: volver a la anterior; si no hay historial (la app abrió
 *   directo en esa ruta), ir a Inicio en vez de quedarse sin respuesta.
 * - /home/inicio en TV: salir de la app. Con `disableBackHistoryAPI` (webOS) el
 *   sistema ya no sale solo, así que lo hace la app.
 * - /home/inicio fuera de TV: dejar pasar la tecla (comportamiento del navegador).
 *
 * @param {{ pathname: string, isTV: boolean, historyIndex: number, focusInSidebar?: boolean }} params
 * @returns {'focus-sidebar' | 'history-back' | 'go-inicio' | 'exit' | 'pass'}
 */
export function resolveHomeBackAction({ pathname, isTV, historyIndex, focusInSidebar = false }) {
  if (isTV && !focusInSidebar) return 'focus-sidebar';
  const path = pathname || '';
  if (path.startsWith('/home/') && path !== '/home/inicio') {
    return historyIndex > 0 ? 'history-back' : 'go-inicio';
  }
  return isTV ? 'exit' : 'pass';
}
