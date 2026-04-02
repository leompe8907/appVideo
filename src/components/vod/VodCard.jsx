/**
 * Tarjeta VOD: poster + título, focusable para TV y click para PC.
 * Imagen: posterListURL/posterInfoURL (de prepareDataForVOD) o fallback 10foot con image1Id + baseUrl.
 */


import { getVodImageUrl } from '../../services/vodService';
import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';

export function VodCard({ item, index, onSelect, focusKeyPrefix = 'vod-card', baseUrl }) {
  const posterUrl =
    item.posterListURL ||
    item.posterInfoURL ||
    (item.image1Id != null && baseUrl ? getVodImageUrl(baseUrl, item.image1Id, 'posterList') : null);
  const title = item.name || item.title || '';

  const { isTV } = useDevice();
  const { ref, focused } = useSpatialNavigation({
    focusKey: `${focusKeyPrefix}-${item.id ?? index}`,
    onEnterPress: () => onSelect?.(item),
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
      tabIndex={isTV ? -1 : 0}
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
