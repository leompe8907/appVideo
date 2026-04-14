import { useState, useEffect } from 'react';

/**
 * Hook para debouncar un valor.
 * Útil para inputs de búsqueda donde no se quiere ejecutar
 * una acción en cada keystroke (especialmente en TV con teclas repetidas).
 *
 * @param {any} value - Valor a debouncar
 * @param {number} delayMs - Delay en milisegundos (default: 300)
 * @returns {any} Valor debounced
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

export default useDebouncedValue;
