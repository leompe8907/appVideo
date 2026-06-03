import { useTranslation } from 'react-i18next';

export function CatchupSeeMoreCard({ onSelect, label }) {
  const { t } = useTranslation();
  const displayLabel = label ?? t('catchup.seeMore', { defaultValue: 'Ver más' });

  const handleClick = () => onSelect?.();
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.();
    }
  };

  return (
    <button
      type="button"
      className="catchup-card catchup-see-more-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={displayLabel}
    >
      <div className="catchup-card-poster catchup-see-more-poster">
        <span className="catchup-see-more-icon" aria-hidden="true">+</span>
      </div>
      <div className="catchup-card-title catchup-see-more-title">{displayLabel}</div>
    </button>
  );
}

export default CatchupSeeMoreCard;
