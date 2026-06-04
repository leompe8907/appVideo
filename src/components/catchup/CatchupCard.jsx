import { useTranslation } from 'react-i18next';
import { BrandFallbackImage } from '../common/BrandFallbackImage';
import {
  fmtCatchupSchedule,
  getCatchupId,
  getEventImage,
  getEventStartMs,
  getEventTitle,
} from '../../utils/catchupEvent';

export function CatchupCard({ event, onSelect }) {
  const { i18n } = useTranslation();
  const catchupId = getCatchupId(event);
  const unavailable = !catchupId;
  const title = getEventTitle(event);
  const startMs = getEventStartMs(event);
  const scheduleText = startMs ? fmtCatchupSchedule(startMs, i18n.language) : '';
  const imageUrl = getEventImage(event);

  const handleActivate = () => {
    onSelect?.(event);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  return (
    <button
      type="button"
      className={`catchup-card ${unavailable ? 'unavailable' : ''}`}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={scheduleText ? `${title}, ${scheduleText}` : title}
    >
      <div className="catchup-card-poster">
        <BrandFallbackImage
          src={imageUrl}
          alt=""
          loading="lazy"
          placeholderClassName="catchup-card-poster-placeholder"
        />
      </div>
      <div className="catchup-card-title">{title || '—'}</div>
      {scheduleText ? <div className="catchup-card-time">{scheduleText}</div> : null}
    </button>
  );
}

export default CatchupCard;
