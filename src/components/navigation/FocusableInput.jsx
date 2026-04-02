/**
 * Componente FocusableInput
 * Input navegable que funciona con controles remotos de TV y mouse/teclado de PC
 */

import { forwardRef, useRef, useEffect } from 'react';
import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';

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
    onArrowPress,
    focusKey,
    className = '',
    ...inputProps 
  },
  externalRef
) {
  const { isTV } = useDevice();
  
  // Ref para acceder al elemento del input
  const inputElementRef = useRef(null);

  const { ref: spatialRef, focused } = useSpatialNavigation({
    onEnterPress: onEnterPress || (() => {
      // En TV, cuando la librería recibe el Enter virtual y redirige aquí,
      // nosotros podemos hacer foco nativo o click.
      if (isTV && inputElementRef.current) {
        inputElementRef.current.focus({ preventScroll: true });
        inputElementRef.current.click();
      }
    }),
    onArrowPress,
    focusKey: focusKey || undefined,
  });

  // Cuando la librería le da el "foco virtual" al wrapper, forzamos el foco nativo al input.
  // Así el teclado en pantalla de Tizen/webOS sabe de quién es el evento.
  useEffect(() => {
    if (isTV && focused && inputElementRef.current) {
      inputElementRef.current.focus({ preventScroll: true });
    } else if (isTV && !focused && inputElementRef.current && document.activeElement === inputElementRef.current) {
      inputElementRef.current.blur();
    }
  }, [focused, isTV]);

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
    // Asignar al ref de navegación
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
      tabIndex={isTV ? -1 : 0}
      {...inputProps}
    />
  );
});

FocusableInput.displayName = 'FocusableInput';

export default FocusableInput;

