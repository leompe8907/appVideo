import React from 'react';

/**
 * Botón de aplicación (HTML <button>).
 * No usa props de navegación espacial legacy (p. ej. focusKey, isFocusable de norigin).
 * La navegación TV en listas/grids va por tabindex nativo, data-tv-nav y hooks en utils/tvNavigation.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Contenido del botón
 * @param {Function} props.onClick - Callback cuando se hace click (opcional)
 * @param {string} props.className - Clases CSS adicionales (opcional)
 * @param {string} props.type - Tipo de botón: 'button', 'submit', 'reset' (default: 'button')
 * @param {boolean} props.disabled - Si el botón está deshabilitado
 */
function FocusableButton({
  children,
  onClick,
  className = '',
  type = 'button',
  disabled = false,
  ...restProps
}) {
  // Handler para click
  const handleClick = (e) => {
    if (onClick && !disabled) {
      onClick(e);
    }
  };

  // Construir clases CSS
  const buttonClasses = [
    className,
    disabled ? 'disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled}
      {...restProps}
    >
      {children}
    </button>
  );
}

// Memoizado para evitar re-renders cuando las props no cambian
// (importante en listas de botones navegables)
const MemoizedFocusableButton = React.memo(FocusableButton);

export { FocusableButton, MemoizedFocusableButton };
export default FocusableButton;

