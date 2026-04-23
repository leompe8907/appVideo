/**
 * Componente FocusableCard
 * Card navegable que funciona con controles remotos de TV y mouse/teclado de PC
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevice } from '../../contexts/DeviceContext';

/**
 * Card navegable compatible con TV y PC
 *
 * @param {Object} props
 * @param {string} props.icon - Icono a mostrar (emoji o texto)
 * @param {string} props.label - Texto del label
 * @param {string} props.path - Ruta a la que navegar (opcional)
 * @param {Function} props.onEnterPress - Callback personalizado al presionar Enter (opcional)
 * @param {string} props.className - Clases CSS adicionales (opcional)
 * @param {string} props.focusKey - Clave única para identificar el elemento (opcional)
 */
function FocusableCard({
  icon,
  label,
  path,
  onEnterPress,
  className = '',
  ...restProps
}) {
  const navigate = useNavigate();
  const { isTV } = useDevice();

  // Handler para cuando se presiona Enter/OK
  const handleEnterPress = () => {
    if (onEnterPress) {
      onEnterPress();
    } else if (path) {
      navigate(path);
    }
  };

  // Handler para click (solo en PC)
  const handleClick = () => {
    if (!isTV && path) {
      navigate(path);
    } else if (!isTV && onEnterPress) {
      onEnterPress();
    }
  };

  // Handler para teclado nativo (solo en PC)
  const handleKeyDown = (e) => {
    if (!isTV) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEnterPress();
      }
    }
  };

  // Construir clases CSS
  const cardClasses = [
    'nav-card',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={label}
      {...restProps}
    >
      {icon && <span className="icon">{icon}</span>}
      {label && <span className="label">{label}</span>}
    </div>
  );
}

// Memoizado para evitar re-renders cuando las props no cambian
// (importante en listas/grids de tarjetas navegables)
const MemoizedFocusableCard = React.memo(FocusableCard);

export { FocusableCard, MemoizedFocusableCard };
export default FocusableCard;

