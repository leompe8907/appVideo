import React from 'react';

/**
 * Wrapper simple de <button>.
 * Se eliminó completamente la lógica de navegación por foco/control remoto.
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

