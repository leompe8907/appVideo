import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import '../epg/epg-common.scss';

/**
 * Modal de detalles para eventos EPG.
 * Opcion A: catchup todavía no migrado, así que:
 * - Siempre permitimos "Reproducir canal (en vivo)"
 * - Si el evento no es live, mostramos el botón "Watch" como deshabilitado (por ahora).
 */
export function EpgEventModal({ open, channel, event, isLive, onClose, onPlayLive }) {
  const { t } = useTranslation();

  const eventTitle = event?.languages?.[0]?.title || event?.title || '';
  const eventDescription =
    event?.languages?.[0]?.extendedDescription || event?.languages?.[0]?.description || event?.description || '';

  const startMs = useMemo(() => {
    const v = event?.startDate;
    if (!v) return null;
    if (typeof v?.valueOf === 'function') return v.valueOf();
    return new Date(v).getTime();
  }, [event]);

  const endMs = useMemo(() => {
    const v = event?.endDate;
    if (!v) return null;
    if (typeof v?.valueOf === 'function') return v.valueOf();
    return new Date(v).getTime();
  }, [event]);

  const fmtTime = (ms) => {
    if (!ms || Number.isNaN(ms)) return '';
    const d = new Date(ms);
    const h = d.getHours();
    const m = d.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const startTime = fmtTime(startMs);
  const endTime = fmtTime(endMs);

  const { ref: closeRef, focused: closeFocused } = useSpatialNavigation({
    focusKey: 'epg-modal-close',
    isFocusable: !!open,
    onEnterPress: () => onClose?.(),
  });

  const { ref: playRef, focused: playFocused } = useSpatialNavigation({
    focusKey: 'epg-modal-play',
    isFocusable: !!open,
    onEnterPress: () => onPlayLive?.(),
  });

  if (!open) return null;

  const canWatch = false; // catchup no migrado (Opcion A)

  return (
    <div
      className="epg-event-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={() => onClose?.()}
    >
      <div className="epg-event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="epg-event-modal-header">
          <div className="epg-event-modal-channel">
            <div className="epg-event-modal-lcn">{channel?.lcn ?? ''}</div>
            <div className="epg-event-modal-name">{channel?.name ?? ''}</div>
          </div>

          <button
            ref={closeRef}
            className={`epg-event-modal-close ${closeFocused ? 'focused' : ''}`}
            onClick={() => onClose?.()}
            type="button"
            tabIndex={-1}
          >
            {t('common.close', { defaultValue: 'Cerrar' })}
          </button>
        </div>

        <div className="epg-event-modal-body">
          <h2 className="epg-event-modal-title">{eventTitle || t('epg.eventNoTitle', { defaultValue: 'Sin título' })}</h2>
          <div className="epg-event-modal-time">
            {startTime && endTime ? `${startTime} - ${endTime}` : ''}
          </div>

          <div className="epg-event-modal-live-badge">
            {isLive ? t('epg.live', { defaultValue: 'En vivo' }) : t('epg.notLive', { defaultValue: 'No en vivo' })}
          </div>

          {eventDescription ? (
            <p className="epg-event-modal-description">{eventDescription}</p>
          ) : (
            <p className="epg-event-modal-description epg-event-modal-description--empty">
              {t('epg.noDescription', { defaultValue: 'Sin descripción' })}
            </p>
          )}
        </div>

        <div className="epg-event-modal-footer">
          <button
            ref={playRef}
            className={`epg-event-modal-primary ${playFocused ? 'focused' : ''}`}
            onClick={() => onPlayLive?.()}
            type="button"
            tabIndex={-1}
          >
            {t('epg.playLiveChannel', { defaultValue: 'Reproducir canal (en vivo)' })}
          </button>

          <button
            className="epg-event-modal-secondary epg-event-modal-secondary--disabled"
            type="button"
            disabled={!canWatch}
            tabIndex={-1}
          >
            {t('epg.watchCatchup', { defaultValue: 'Watch / Catchup (no disponible)' })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EpgEventModal;

