/**
 * Tarjeta "Ver más": décimo ítem en cada fila de género. Al seleccionar abre el modal con todo el género.
 * @param {string} [label] - Texto visible y aria-label; por defecto i18n `vod.seeMore`.
 * @param {boolean} [textInPoster] - Sin "+": muestra `label` centrado dentro del recuadro del póster (Inicio recomendados).
 */

import { useTranslation } from 'react-i18next';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';

export function VodSeeMoreCard({ focusKeyPrefix, onSelect, label, textInPoster }) {
  const { t } = useTranslation();
  const displayLabel = label ?? t('vod.seeMore');
  const { ref, focused } = useSpatialNavigation({
    onEnterPress: () => onSelect?.(),
    focusKey: `${focusKeyPrefix}-see-more`,
    isFocusable: true,
  });

  const handleClick = () => onSelect?.();
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.();
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className={[
        'vod-card',
        'vod-see-more-card',
        textInPoster ? 'vod-see-more-card--poster-text' : '',
        focused ? 'focused' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      aria-label={displayLabel}
    >
      <div className="vod-card-poster vod-see-more-poster">
        {textInPoster ? (
          <span className="vod-see-more-poster-label">{displayLabel}</span>
        ) : (
          <span className="vod-see-more-icon" aria-hidden="true">+</span>
        )}
      </div>
      {!textInPoster && (
        <div className="vod-card-title vod-see-more-title">{displayLabel}</div>
      )}
    </button>
  );
}

export default VodSeeMoreCard;
