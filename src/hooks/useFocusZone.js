import { useEffect, useRef } from 'react';
import { focusManager } from '../navigation/FocusManager';

/**
 * Registra una zona de `FocusManager` mientras `active` sea true.
 *
 * `onBack` se lee de una ref: si fuera dependencia del efecto, un callback no
 * memoizado (p. ej. `close` del PlayerContext) haría pop + push en cada render,
 * y cada pop devuelve el foco al elemento previo, fuera de la zona.
 *
 * @param {{ zoneId: string, active: boolean, containerRef: { current: HTMLElement|null }, onBack?: () => unknown }} opts
 */
export function useFocusZone({ zoneId, active, containerRef, onBack }) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return undefined;
    focusManager.push(zoneId, {
      containerEl: containerRef.current,
      onBack: () => onBackRef.current?.(),
    });
    return () => {
      focusManager.pop(zoneId);
    };
  }, [zoneId, active, containerRef]);
}

export default useFocusZone;
