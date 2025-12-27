/**
 * Componente FocusableCard
 * Card navegable que funciona con controles remotos de TV y mouse/teclado de PC
 */

import { useNavigate } from 'react-router-dom';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
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
export function FocusableCard({ 
  icon, 
  label, 
  path, 
  onEnterPress,
  className = '',
  focusKey,
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

  // Usar el hook de navegación espacial
  const { ref, focused } = useSpatialNavigation({
    onEnterPress: handleEnterPress,
    focusKey: focusKey || `nav-card-${label}`,
  });

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
    focused ? 'focused' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={cardClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isTV ? -1 : 0} // En TV, el focus lo maneja la librería (tabIndex -1)
      aria-label={label}
      {...restProps}
    >
      {icon && <span className="icon">{icon}</span>}
      {label && <span className="label">{label}</span>}
    </div>
  );
}

export default FocusableCard;

