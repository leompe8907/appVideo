/**
 * Tarjeta VOD: poster + título, focusable para TV y click para PC.
 * Imagen: posterListURL/posterInfoURL (de prepareDataForVOD) o fallback 10foot con image1Id + baseUrl.
 */

import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import { getVodImageUrl } from '../../services/vodService';

export function VodCard({ item, index, onSelect, focusKeyPrefix = 'vod-card', baseUrl }) {
  const posterUrl =
    item.posterListURL ||
    item.posterInfoURL ||
    (item.image1Id != null && baseUrl ? getVodImageUrl(baseUrl, item.image1Id, 'posterList') : null);
  const title = item.name || item.title || '';

  const { ref, focused } = useSpatialNavigation({
    onEnterPress: () => onSelect?.(item),
    focusKey: `${focusKeyPrefix}-${index}`,
    isFocusable: true,
  });

  const handleClick = () => onSelect?.(item);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(item);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`vod-card ${focused ? 'focused' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      aria-label={title}
    >
      <div className="vod-card-poster">
        {posterUrl ? (
          <img src={posterUrl} alt="" loading="lazy" />
        ) : (
          <div className="vod-card-poster-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="vod-card-title">{title}</div>
    </button>
  );
}

export default VodCard;
