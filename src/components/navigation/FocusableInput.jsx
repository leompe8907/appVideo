/**
 * Componente FocusableInput
 * Input navegable que funciona con controles remotos de TV y mouse/teclado de PC
 */

import { forwardRef } from 'react';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import { useDevice } from '../../contexts/DeviceContext';

/**
 * Input navegable compatible con TV y PC
 * 
 * @param {Object} props - Todas las props estándar de input HTML
 * @param {Function} props.onEnterPress - Callback cuando se presiona Enter (opcional)
 * @param {string} props.focusKey - Clave única para identificar el elemento (opcional)
 * @param {string} props.className - Clases CSS adicionales (opcional)
 */
export const FocusableInput = forwardRef(function FocusableInput(
  { 
    onEnterPress,
    focusKey,
    className = '',
    ...inputProps 
  },
  externalRef
) {
  const { isTV } = useDevice();

  // Handler para cuando se presiona Enter (solo si no hay onEnterPress personalizado)
  const handleEnterPress = () => {
    if (onEnterPress) {
      onEnterPress();
    }
    // Si no hay callback, el comportamiento por defecto es mantener el focus en el input
  };

  // Usar el hook de navegación espacial
  const { ref: spatialRef, focused } = useSpatialNavigation({
    onEnterPress: handleEnterPress,
    focusKey: focusKey || inputProps.id || `input-${inputProps.name || 'default'}`,
  });

  // Combinar refs: el ref externo (si existe) y el ref de navegación espacial
  const combinedRef = (node) => {
    // Asignar al ref externo si existe
    if (externalRef) {
      if (typeof externalRef === 'function') {
        externalRef(node);
      } else if (externalRef) {
        externalRef.current = node;
      }
    }
    // Asignar al ref de navegación espacial
    if (spatialRef) {
      if (typeof spatialRef === 'function') {
        spatialRef(node);
      } else if (spatialRef) {
        spatialRef.current = node;
      }
    }
  };

  // Construir clases CSS
  const inputClasses = [
    className,
    focused ? 'focused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <input
      ref={combinedRef}
      className={inputClasses}
      tabIndex={isTV ? -1 : 0} // En TV, el focus lo maneja la librería (tabIndex -1)
      {...inputProps}
    />
  );
});

FocusableInput.displayName = 'FocusableInput';

export default FocusableInput;

