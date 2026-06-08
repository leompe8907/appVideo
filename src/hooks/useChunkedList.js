import { useEffect, useState } from 'react';
import { useDevice } from '../contexts/DeviceContext';

/**
 * Pinta listas largas en tandas (sin spinner): primer frame liviano, resto en background.
 * @param {Array} items
 * @param {{ threshold?: number, initial?: number, chunkSize?: number, enabled?: boolean }} [options]
 */
export function useChunkedList(items, options = {}) {
  const { isTV } = useDevice();
  const {
    threshold = 24,
    initial = isTV ? 28 : 12,
    chunkSize = isTV ? 20 : 8,
    enabled = true,
  } = options;

  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const shouldChunk = enabled && total > threshold && (isTV || total > 48);

  const [visible, setVisible] = useState(() => {
    if (!shouldChunk) return total;
    return Math.min(initial, total);
  });

  useEffect(() => {
    if (!shouldChunk) {
      setVisible(total);
      return undefined;
    }

    let count = Math.min(initial, total);
    setVisible(count);
    let cancelled = false;
    let timerId = null;

    const tick = () => {
      if (cancelled) return;
      count = Math.min(count + chunkSize, total);
      setVisible(count);
      if (count < total) {
        timerId = requestAnimationFrame(tick);
      }
    };

    timerId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (timerId) cancelAnimationFrame(timerId);
    };
  }, [total, shouldChunk, initial, chunkSize]);

  return list.slice(0, visible);
}

export default useChunkedList;
