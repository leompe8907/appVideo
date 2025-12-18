import React from 'react';
import { useDevice } from '../contexts/DeviceContext';
import { useFocusable } from '../hooks/useSpatialNavigation';

/**
 * Componente Focusable
 * En TV: elemento navegable con flechas
 * En PC: elemento normal (sin wrapper especial)
 * 
 * @param {object} props - Props del componente
 * @param {React.ReactNode} props.children - Contenido a envolver
 * @param {string} props.focusKey - Clave única para el foco (requerido)
 * @param {function} props.onFocus - Callback cuando recibe foco
 * @param {function} props.onBlur - Callback cuando pierde foco
 * @param {function} props.onEnterPress - Callback cuando se presiona Enter
 * @param {string} props.className - Clases CSS adicionales
 * @param {object} props.style - Estilos inline adicionales
 */
export function Focusable({ 
  children, 
  focusKey,
  onFocus,
  onBlur,
  onEnterPress,
  onEnterPressHandler, // Alias para compatibilidad
  className = '',
  style = {},
  ...rest 
}) {
  const { isTV } = useDevice();
  
  // En PC: renderizar sin wrapper especial
  if (!isTV) {
    return <>{children}</>;
  }

  // En TV: usar el hook de focusable
  const { ref, focused } = useFocusable({
    focusKey,
    onFocus,
    onBlur,
    onEnterPress: onEnterPress || onEnterPressHandler,
    focusable: true,
  });

  return (
    <div
      ref={ref}
      data-focusable="true"
      data-focus-key={focusKey}
      className={`focusable ${focused ? 'focused' : ''} ${className}`}
      style={style}
      tabIndex={-1}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Hook helper para crear props de Focusable condicionalmente
 * @param {object} config - Configuración del focusable
 * @returns {object} Props para pasar a Focusable o elemento normal
 */
export function useFocusableProps(config = {}) {
  const { isTV } = useDevice();

  if (!isTV) {
    return {}; // En PC no necesita props especiales
  }

  return {
    focusKey: config.focusKey,
    onFocus: config.onFocus,
    onBlur: config.onBlur,
    onEnterPress: config.onEnterPress || config.onEnterPressHandler,
  };
}
