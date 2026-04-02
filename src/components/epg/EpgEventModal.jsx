import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import '../epg/epg-common.scss';

function fmtHHmm(ms) {
  if (!ms || Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Modal de detalles para eventos EPG.
 * Opcion A: catchup todavía no migrado, así que:
 * - Siempre permitimos "Reproducir canal (en vivo)"
 * - Si el evento no es live, mostramos el botón "Watch" como deshabilitado (por ahora).
 */
export function EpgEventModal({
  open,
  channel,
  event,
  isLive,
  canPlayLive = true,
  onClose,
  onPlayLive,
  onWatchCatchup,
}) {
  const { t } = useTranslation();
  const { isTV } = useDevice();

  const eventTitle = event?.languages?.[0]?.title || event?.title || '';
  const eventDescription =
    event?.languages?.[0]?.extendedDescription || event?.languages?.[0]?.description || event?.description || '';

  const channelImg =
    channel?.img || channel?.imageUrl || channel?.logoUrl || channel?.logo || channel?.icon || null;
  const eventImg =
    event?.imageUrl ||
    event?.imageUrl2 ||
    event?.catchupImageUrl ||
    event?.imageUrlVod ||
    event?.imageUrl_vod ||
    event?.img ||
    event?.image ||
    event?.posterUrl ||
    null;
  const channelRating = channel?.parentalRating;

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

  const startTime = fmtHHmm(startMs);
  const endTime = fmtHHmm(endMs);

  const durationMinutes = useMemo(() => {
    if (startMs == null || endMs == null) return null;
    const diffMs = endMs - startMs;
    if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
    return Math.max(0, Math.round(diffMs / 60000));
  }, [startMs, endMs]);

  // El evento EPG puede incluir identificador de catchup (backend/config).
  // Si existe, habilitamos "Watch / Catchup".
  const catchupId = event?.catchupId ?? event?.catchup_id ?? event?.catchupEventId ?? null;
  const canWatch = !!catchupId;

  if (!open) return null;

  return (
    <div
      className="epg-event-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={() => onClose?.()}
    >
      <div className="epg-event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="epg-event-modal-header">
          <div className="epg-event-modal-header-left">
            <div className="epg-event-modal-channel">
              {channelImg ? (
                <img
                  src={channelImg}
                  alt={channel?.name || ''}
                  className="epg-event-modal-channel-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <div className="epg-event-modal-channel-text">
                <div className="epg-event-modal-name">{channel?.name ?? ''}</div>
                <div className="epg-event-modal-meta-row">
                  <div className="epg-event-modal-meta-item">
                    <div className="epg-event-modal-lcn">{channel?.lcn ?? ''}</div>
                  </div>

                  <div className="epg-event-modal-meta-item epg-event-modal-meta-time">
                    {channelRating != null ? <span className="epg-event-modal-rating">+{channelRating}</span> : null}
                    <span className="epg-event-modal-meta-time-value">
                      {startTime && endTime ? `${startTime} - ${endTime}` : ''}
                    </span>
                  </div>

                  {durationMinutes != null ? (
                    <div className="epg-event-modal-meta-item epg-event-modal-meta-duration">
                      {durationMinutes} {t('vod.minutes', { defaultValue: 'min' })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="epg-event-modal-header-right">
            {eventImg ? (
              <img
                key={eventImg}
                src={eventImg}
                alt={eventTitle || ''}
                className="epg-event-modal-event-img"
                onLoad={(e) => {
                  // Si el evento anterior falló y dejó opacidad baja, al cargar bien volvemos a mostrar al 100%.
                  e.currentTarget.style.opacity = '1';
                }}
                onError={(e) => {
                  // No ocultar para que podamos ver si el problema es de URL.
                  e.currentTarget.style.opacity = '0.25';
                }}
              />
            ) : null}

            {!isTV && (
              <button
                className="epg-event-modal-close"
                onClick={() => onClose?.()}
                type="button"
                tabIndex={0}
              >
                {t('common.close', { defaultValue: 'Cerrar' })}
              </button>
            )}
          </div>
        </div>

        <div className="epg-event-modal-body">
          {eventImg ? (
            <span aria-hidden="true" />
          ) : null}

          <h2 className="epg-event-modal-title">{eventTitle || t('epg.eventNoTitle', { defaultValue: 'Sin título' })}</h2>

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
            className="epg-event-modal-primary"
            onClick={() => onPlayLive?.()}
            type="button"
            disabled={!canPlayLive}
            tabIndex={canPlayLive ? 0 : -1}
          >
            {t('epg.playLiveChannel', { defaultValue: 'Reproducir canal (en vivo)' })}
          </button>

          <button
            className={`epg-event-modal-secondary ${!canWatch ? 'epg-event-modal-secondary--disabled' : ''}`}
            type="button"
            disabled={!canWatch}
            tabIndex={canWatch ? 0 : -1}
            onClick={() => {
              if (!canWatch) return;
              onWatchCatchup?.(catchupId, event);
            }}
          >
            {t('epg.watchCatchup', { defaultValue: 'Watch / Catchup (no disponible)' })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EpgEventModal;

