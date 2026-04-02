/**
 * Hook wrapper de @noriginmedia/norigin-spatial-navigation
 * Adapta el comportamiento de foco virtual para TV y nativo DOM para PC.
 */
import { useRef } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useDevice } from '../../contexts/DeviceContext';

export function useSpatialNavigation(config = {}) {
  const { isTV } = useDevice();
  const pcRef = useRef(null);

  const {
    onEnterPress,
    onArrowPress,
    onFocus,
    onBlur,
    isFocusable = true,
    focusKey,
    ...restConfig
  } = config;

  // Se inicializa el hook de @noriginmedia conservando reglas de hooks,
  // pero el registro lógico queda deshabilitado en PC.
  const {
    ref,
    focused,
    focusSelf,
    hasFocusedChild,
    setFocus
  } = useFocusable({
    isFocusable: isTV && isFocusable !== false,
    onEnterPress: isTV ? onEnterPress : undefined,
    onArrowPress: isTV ? onArrowPress : undefined,
    onFocus: isTV ? onFocus : undefined,
    onBlur: isTV ? onBlur : undefined,
    focusKey: isTV && focusKey ? focusKey : undefined,
    ...restConfig,
  });

  const mergedRef = (node) => {
    pcRef.current = node;
    // Alimentar la librería siempre y cuando estemos en TV y se haya devuelto ref
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref && typeof ref === 'object') {
      ref.current = node;
    }
  };

  return {
    ref: mergedRef,
    focused: isTV ? focused : false,
    focusSelf: () => {
      if (isTV) {
        if (typeof focusSelf === 'function') focusSelf();
      } else {
        if (pcRef.current) pcRef.current.focus({ preventScroll: true });
      }
    },
    setFocus: (...args) => {
      if (isTV && typeof setFocus === 'function') {
        setFocus(...args);
      }
    },
    hasFocusedChild: isTV ? hasFocusedChild : false,
    isTV,
  };
}

export default useSpatialNavigation;
