/**
 * Tarjeta VOD: poster + título, focusable para TV y click para PC.
 * Imagen: posterListURL/posterInfoURL (de prepareDataForVOD) o fallback 10foot con image1Id + baseUrl.
 */


import { useState } from 'react';
import { getVodImageUrl } from '@appvideo/core/services/vodService';
import { usableImageUrl, markImageFailed } from '@appvideo/core/utils/remoteImage';

export function VodCard({ item, onSelect, baseUrl }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const candidate = usableImageUrl(
    item.posterListURL ||
      item.posterInfoURL ||
      (item.image1Id != null && baseUrl ? getVodImageUrl(baseUrl, item.image1Id, 'posterList') : null),
    { allowRelative: true },
  );
  // Poster roto: se recuerda (no se vuelve a pedir) y se muestra el placeholder.
  const posterUrl = candidate && candidate !== failedUrl ? candidate : null;
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
          <img
            src={posterUrl}
            alt=""
            loading="lazy"
            onError={() => {
              markImageFailed(posterUrl);
              setFailedUrl(posterUrl);
            }}
          />
        ) : (
          <div className="vod-card-poster-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="vod-card-title">{title}</div>
    </button>
  );
}

export default VodCard;
