import { useCallback, useEffect, useRef, useState } from 'react';
import { useDevice } from '../contexts/DeviceContext';

/**
 * Lógica pura de la ventana (sin React) — separada para poder testearla
 * directamente sin necesidad de montar el hook. Ver el docstring de
 * `useChunkedList` para el razonamiento completo.
 * @param {{ total: number, revealed: number, focusedIndex: number, buffer: number, shouldVirtualize: boolean, columns?: number }} params
 * @returns {{ start: number, end: number }}
 */
export function computeVisibleWindow({ total, revealed, focusedIndex, buffer, shouldVirtualize, columns = 1 }) {
  if (!shouldVirtualize) {
    return { start: 0, end: total };
  }

  // Alinear la ventana a bordes de fila completos cuando la lista es una
  // grilla de N columnas: si el recorte cae a mitad de fila, esa fila queda
  // con algunas tarjetas montadas y otras no, y la navegación espacial (que
  // solo ve lo que está montado) puede "saltar" a un candidato lejano en vez
  // de la fila siguiente. Redondeando start hacia abajo y end hacia arriba
  // al múltiplo de `columns` más cercano, cada ventana montada siempre
  // contiene filas completas.
  const cols = Number.isInteger(columns) && columns > 1 ? columns : 1;
  const alignStart = (n) => Math.max(0, Math.floor(n / cols) * cols);
  const alignEnd = (n) => Math.min(total, Math.ceil(n / cols) * cols);

  if (focusedIndex < 0) {
    return { start: 0, end: alignEnd(Math.min(revealed, total)) };
  }
  return {
    start: alignStart(Math.max(0, focusedIndex - buffer)),
    end: alignEnd(Math.min(total, focusedIndex + buffer + 1)),
  };
}

/**
 * Virtualiza listas largas: en vez de solo "revelar" de a tandas y dejar
 * CADA item montado para siempre una vez revelado (como hacía antes), acota
 * cuántos quedan montados en simultáneo a una ventana alrededor del ítem con
 * foco. Para listas muy largas (cientos de canales/VOD) esto es lo que
 * realmente baja nodos DOM/memoria — el paint-chunking por sí solo no lo hacía.
 *
 * Por qué la ventana se centra en el ÍNDICE con foco y no en scroll/viewport:
 * el motor de navegación espacial (`spatialNavigation.js`) mueve el foco por
 * geometría real (`getBoundingClientRect`) SOLO sobre lo que esté montado —
 * si al presionar una flecha el próximo candidato en esa dirección no está
 * montado todavía, `moveFocus` no encuentra nada y la tecla no hace nada
 * (foco "trabado", el peor resultado posible en un control remoto). Por eso:
 *   1. Antes de que haya foco puesto (primer paint), se usa el reveal
 *      progresivo de siempre (0..revealed, creciendo de a `chunkSize` por
 *      frame) — es lo que ya se ve en pantalla al entrar a la fila/grilla.
 *   2. Apenas el usuario pone foco en un ítem (vía `reportFocusIndex`, que
 *      cada fila/grilla llama desde el `onFocus` que ya tenía cada tarjeta),
 *      la ventana se recentra en ese índice con un buffer generoso a cada
 *      lado (mismo tamaño que `chunkSize`, ya ajustado más grande para TV)
 *      — bastante margen para que un solo paso de navegación SIEMPRE
 *      encuentre el próximo candidato ya montado.
 *
 * @param {Array} items
 * @param {{ threshold?: number, initial?: number, chunkSize?: number, buffer?: number, enabled?: boolean, columns?: number }} [options]
 * @returns {{ entries: Array<{item: any, index: number}>, reportFocusIndex: (index: number) => void }}
 */
export function useChunkedList(items, options = {}) {
  const { isTV } = useDevice();
  const {
    threshold = 24,
    initial = isTV ? 28 : 12,
    chunkSize = isTV ? 20 : 8,
    buffer = chunkSize,
    enabled = true,
    columns = 1,
  } = options;

  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const shouldVirtualize = enabled && total > threshold && (isTV || total > 48);

  const [revealed, setRevealed] = useState(() => (shouldVirtualize ? Math.min(initial, total) : total));
  // -1 = todavía no hay foco puesto en esta lista (usar el reveal progresivo).
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const focusedIndexRef = useRef(-1);

  // Reset del reveal/foco cuando cambia la lista de base (nuevo bouquet, etc.)
  // o cuando deja de hacer falta virtualizar (lista se achicó).
  useEffect(() => {
    focusedIndexRef.current = -1;
    setFocusedIndex(-1);

    if (!shouldVirtualize) {
      setRevealed(total);
      return undefined;
    }

    let count = Math.min(initial, total);
    setRevealed(count);
    let cancelled = false;
    let rafId = null;

    const tick = () => {
      if (cancelled) return;
      // Si mientras tanto el usuario ya puso foco lejos del frente de reveal,
      // no tiene sentido seguir revelando en orden — la ventana por foco ya
      // se encarga de lo que hace falta montar.
      if (focusedIndexRef.current >= 0) return;
      count = Math.min(count + chunkSize, total);
      setRevealed(count);
      if (count < total) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
    // Depende de `total` (largo), no de la referencia de `list`: igual que
    // antes, para no resetear el reveal/foco en cada render solo porque el
    // padre recrea el array (misma lista de fondo, referencia nueva).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, shouldVirtualize, initial, chunkSize]);

  const reportFocusIndex = useCallback(
    (index) => {
      if (!Number.isInteger(index) || index < 0 || index >= total) return;
      focusedIndexRef.current = index;
      setFocusedIndex(index);
    },
    [total],
  );

  const { start, end } = computeVisibleWindow({ total, revealed, focusedIndex, buffer, shouldVirtualize, columns });

  const entries = [];
  for (let i = start; i < end; i += 1) {
    entries.push({ item: list[i], index: i });
  }

  return { entries, reportFocusIndex };
}

export default useChunkedList;
