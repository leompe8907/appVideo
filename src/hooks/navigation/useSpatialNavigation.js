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

  // En PC, retornar valores por defecto sin funcionalidad de navegación espacial
  if (!isTV) {
    const pcRef = useRef(null);
    
    return {
      ref: pcRef,
      focused: false,
      focusSelf: () => {
        // En PC, usar focus nativo si es necesario
        if (pcRef.current) {
          pcRef.current.focus();
        }
      },
      hasFocusedChild: false,
      isTV: false,
    };
  }

  // En TV, usar la librería de navegación espacial
  const {
    ref,
    focused,
    focusSelf,
    hasFocusedChild,
  } = useFocusable({
    // Solo activar si isFocusable es true
    isFocusable: isFocusable !== false,
    
    // Callback cuando se presiona Enter/OK
    onEnterPress: onEnterPress || undefined,
    
    // Callback cuando se presiona una flecha
    onArrowPress: onArrowPress || undefined,
    
    // Callback cuando recibe focus
    onFocus: onFocus || undefined,
    
    // Callback cuando pierde focus
    onBlur: onBlur || undefined,
    
    // Clave única para identificar el elemento
    focusKey: focusKey || undefined,
    
    // Pasar cualquier otra configuración adicional
    ...restConfig,
  });

  return {
    ref,
    focused: focused || false,
    focusSelf: focusSelf || (() => {}),
    hasFocusedChild: hasFocusedChild || false,
    isTV: true,
  };
}

export default useSpatialNavigation;

