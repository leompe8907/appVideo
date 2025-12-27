/**
 * Componente FocusableInput
 * Input navegable que funciona con controles remotos de TV y mouse/teclado de PC
 */

import { forwardRef, useRef, useEffect } from 'react';
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
  
  // Ref para acceder al elemento del input
  const inputElementRef = useRef(null);

  // Usar el hook de navegación espacial
  const { ref: spatialRef, focused } = useSpatialNavigation({
    onEnterPress: () => {
      if (onEnterPress) {
        onEnterPress();
      } else {
        // En TV, cuando se presiona Enter en un input, abrir el teclado virtual
        // haciendo que el input reciba focus nativo del DOM
        if (isTV && inputElementRef.current) {
          // Forzar blur primero para asegurar que el input pueda recibir focus de nuevo
          // Esto resuelve el problema cuando el teclado se cierra pero el input mantiene focus virtual
          inputElementRef.current.blur();
          
          // Pequeño delay para asegurar que el blur se complete
          setTimeout(() => {
            if (inputElementRef.current) {
              // Hacer que el input reciba focus nativo para abrir el teclado virtual
              inputElementRef.current.focus();
              // También intentar hacer click para asegurar que se active
              inputElementRef.current.click();
            }
          }, 50);
        }
      }
    },
    focusKey: focusKey || inputProps.id || `input-${inputProps.name || 'default'}`,
  });

  // Combinar refs: el ref externo (si existe) y el ref de navegación espacial
  const combinedRef = (node) => {
    // Guardar referencia al elemento para poder accederlo
    inputElementRef.current = node;
    
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

