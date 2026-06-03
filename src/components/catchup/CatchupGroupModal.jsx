import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { FocusableButton } from '../navigation/FocusableButton';
import AppIcon from '../AppIcon';
import CatchupCard from './CatchupCard';

export function CatchupGroupModal({ groupTitle, group, events = [], onSelectEvent, onClose }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();

  return (
    <div
      className="catchup-group-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catchup-group-modal-title"
    >
      <div className="catchup-group-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="catchup-group-modal">
        <div className="catchup-group-header">
          <h2 id="catchup-group-modal-title" className="catchup-group-title">
            {groupTitle}
          </h2>
          <FocusableButton
            type="button"
            className="catchup-group-close"
            id="catchup-group-close-tv"
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Cerrar' })}
          >
            {isTV ? t('common.close', { defaultValue: 'Cerrar' }) : <AppIcon name="close" size={18} />}
          </FocusableButton>
        </div>
        <div className="catchup-group-grid">
          {events.map((event, index) => (
            <CatchupCard
              key={event?.catchupId ?? event?.id ?? index}
              event={event}
              onSelect={() => {
                onSelectEvent?.(event, group);
                onClose?.();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CatchupGroupModal;
