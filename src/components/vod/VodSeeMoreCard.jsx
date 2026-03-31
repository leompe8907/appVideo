/**
 * Tarjeta "Ver más": décimo ítem en cada fila de género. Al seleccionar abre el modal con todo el género.
 */

import { useTranslation } from 'react-i18next';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';

export function VodSeeMoreCard({ focusKeyPrefix, onSelect }) {
  const { t } = useTranslation();
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
      className={`vod-card vod-see-more-card ${focused ? 'focused' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      aria-label={t('vod.seeMore')}
    >
      <div className="vod-card-poster vod-see-more-poster">
        <span className="vod-see-more-icon" aria-hidden="true">+</span>
      </div>
      <div className="vod-card-title vod-see-more-title">{t('vod.seeMore')}</div>
    </button>
  );
}

export default VodSeeMoreCard;
