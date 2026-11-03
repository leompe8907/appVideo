/**
 * Destinos de foco con nombre, para mover el foco a mano donde el motor de
 * foco de la TV no llega solo (p. ej. salir de un TextInput con texto: ◀ ▶
 * mueven el cursor dentro del texto y el foco no sale).
 */
const targets = new Map();

/** Registra (o con `null` quita) el ref de un destino. */
export function registerFocusTarget(name, ref) {
  if (ref) targets.set(name, ref);
  else targets.delete(name);
}

/** Pone el foco en el destino; devuelve false si no hay. */
export function focusTarget(name) {
  const node = targets.get(name)?.current;
  if (!node) return false;
  if (typeof node.requestTVFocus === 'function') node.requestTVFocus();
  else node.focus?.();
  return true;
}
