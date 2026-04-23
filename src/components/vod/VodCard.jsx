/**
 * Tarjeta VOD: poster + título, focusable para TV y click para PC.
 * Imagen: posterListURL/posterInfoURL (de prepareDataForVOD) o fallback 10foot con image1Id + baseUrl.
 */


import { getVodImageUrl } from '../../services/vodService';

export function VodCard({ item, onSelect, baseUrl }) {
  const posterUrl =
    item.posterListURL ||
    item.posterInfoURL ||
    (item.image1Id != null && baseUrl ? getVodImageUrl(baseUrl, item.image1Id, 'posterList') : null);
  const title = item.name || item.title || '';

  const handleClick = () => onSelect?.(item);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(item);
    }
  };

  return (
    <button
      type="button"
      className="vod-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
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
