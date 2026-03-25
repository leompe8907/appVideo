/**
 * Hook wrapper para navegación espacial
 * Envuelve useFocusable de @noriginmedia/norigin-spatial-navigation
 * y adapta el comportamiento según el dispositivo (TV vs PC)
 */

import { useRef } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useDevice } from '../../contexts/DeviceContext';

/**
 * Hook que facilita el uso de navegación espacial en componentes
 * Solo activa la navegación espacial en dispositivos TV
 * En PC retorna valores por defecto para mantener compatibilidad
 * 
 * @param {Object} config - Configuración opcional
 * @param {Function} config.onEnterPress - Callback cuando se presiona Enter/OK
 * @param {Function} config.onArrowPress - Callback cuando se presiona una flecha
 * @param {Function} config.onFocus - Callback cuando el elemento recibe focus
 * @param {Function} config.onBlur - Callback cuando el elemento pierde focus
 * @param {boolean} config.isFocusable - Si el elemento puede recibir focus (default: true)
 * @param {string} config.focusKey - Clave única para identificar el elemento
 * @returns {Object} Objeto con ref, focused, focusSelf, isTV
 */
export function useSpatialNavigation(config = {}) {
  const { isTV } = useDevice();

  // Extraer callbacks de la configuración
  const {
    onEnterPress,
    onArrowPress,
    onFocus,
    onBlur,
    isFocusable = true,
    focusKey,
    ...restConfig
  } = config;

  // Mantener el orden de hooks estable (React Rules of Hooks):
  // siempre instanciamos useRef y useFocusable, y controlamos el comportamiento con flags.
  const pcRef = useRef(null);

  const {
    ref,
    focused,
    focusSelf,
    hasFocusedChild,
  } = useFocusable({
    // En PC desactivamos registro/focus para evitar interferir.
    isFocusable: isTV && isFocusable !== false,
    onEnterPress: isTV ? (onEnterPress || undefined) : undefined,
    onArrowPress: isTV ? (onArrowPress || undefined) : undefined,
    onFocus: isTV ? (onFocus || undefined) : undefined,
    onBlur: isTV ? (onBlur || undefined) : undefined,
    focusKey: isTV ? (focusKey || undefined) : undefined,
    ...restConfig,
  });

  // `ref` de norigin suele ser un callback-ref. En PC queremos un ref real para focus nativo.
  // Devolvemos un callback que alimenta ambos caminos.
  const mergedRef = (node) => {
    pcRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
      return;
    }
    // Fallback defensivo por si la librería expone ref como objeto mutable.
    if (ref && typeof ref === 'object') {
      // eslint-disable-next-line no-param-reassign
      ref.current = node;
    }
  };

  return {
    ref: mergedRef,
    focused: isTV ? (focused || false) : false,
    focusSelf: () => {
      if (isTV) {
        (focusSelf || (() => {}))();
        return;
      }
      if (pcRef.current) pcRef.current.focus();
    },
    hasFocusedChild: isTV ? (hasFocusedChild || false) : false,
    isTV,
  };
}

export default useSpatialNavigation;

