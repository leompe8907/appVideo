/**
 * Componente FocusableButton
 * Botón navegable que funciona con controles remotos de TV y mouse/teclado de PC
 */

import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import { useDevice } from '../../contexts/DeviceContext';

/**
 * Botón navegable compatible con TV y PC
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Contenido del botón
 * @param {Function} props.onClick - Callback cuando se hace click (opcional)
 * @param {Function} props.onEnterPress - Callback cuando se presiona Enter/OK (opcional)
 * @param {string} props.className - Clases CSS adicionales (opcional)
 * @param {string} props.focusKey - Clave única para identificar el elemento (opcional)
 * @param {string} props.type - Tipo de botón: 'button', 'submit', 'reset' (default: 'button')
 * @param {boolean} props.disabled - Si el botón está deshabilitado
 */
export function FocusableButton({ 
  children,
  onClick,
  onEnterPress,
  className = '',
  focusKey,
  type = 'button',
  disabled = false,
  ...restProps 
}) {
  const { isTV } = useDevice();

  // Handler para cuando se presiona Enter/OK
  const handleEnterPress = () => {
    if (disabled) return;
    
    if (onEnterPress) {
      onEnterPress();
    } else {
      // Si es tipo submit, ejecutar el submit del formulario
      if (type === 'submit' && ref?.current) {
        const form = ref.current.closest('form');
        if (form) {
          form.requestSubmit();
        }
      } else if (onClick) {
        // Si no hay onEnterPress pero sí onClick, ejecutar onClick
        onClick();
      }
    }
  };

  // Usar el hook de navegación espacial
  const { ref, focused } = useSpatialNavigation({
    onEnterPress: handleEnterPress,
    focusKey: focusKey || `button-${type}`,
    isFocusable: !disabled, // No focusable si está deshabilitado
  });

  // Handler para click
  const handleClick = (e) => {
    if (onClick && !disabled) {
      onClick(e);
    }
    // En TV, si es tipo submit, el formulario se enviará automáticamente
    // pero también ejecutamos onClick por si acaso
  };

  // Handler para teclado nativo (solo en PC)
  const handleKeyDown = (e) => {
    if (!isTV && !disabled) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEnterPress();
      }
    }
  };

  // Construir clases CSS
  const buttonClasses = [
    className,
    focused ? 'focused' : '',
    disabled ? 'disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      tabIndex={isTV ? -1 : 0} // En TV, el focus lo maneja la librería (tabIndex -1)
      {...restProps}
    >
      {children}
    </button>
  );
}

export default FocusableButton;

