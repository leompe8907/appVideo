import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { FocusableButton } from '../navigation/FocusableButton';
import { getCatchupStreamId, getEventDescription, getEventTitle } from '../../utils/catchupEvent';
import '../epg/epg-common.scss';
import AppIcon from '../AppIcon';
import { BrandFallbackImage } from '../common/BrandFallbackImage';

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
 * - detailContext='catchup': pantalla Catchup; solo detalle + reproducir catchup (sin en vivo / recordar).
 */
export function EpgEventModal({
  open,
  channel,
  event,
  isLive,
  nowMs,
  canPlayLive = true,
  showActions = true,
  detailContext = 'epg',
  onClose,
  onPlayLive,
  onWatchCatchup,
  onRemind,
  remindActive = false,
}) {
  const { t } = useTranslation();
  const { isTV } = useDevice();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      const key = String(e.key || '');
      const code = String(e.code || '');
      const keyCode = Number(e.keyCode || e.which || 0);
      const isEscape = key === 'Escape' || code === 'Escape' || keyCode === 27;
      const isBackspace = key === 'Backspace' || code === 'Backspace' || keyCode === 8;
      const isReturnLike = key === 'Return' || key === 'GoBack' || key === 'BrowserBack';
      const isTvBackCodes = keyCode === 10009 || keyCode === 461; // Tizen Back / LG Back (comunes)
      if (isEscape || isBackspace || isReturnLike || isTvBackCodes) {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    // capture=true para ejecutarse antes que handlers globales de teclado
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, onClose]);

  const eventTitle = getEventTitle(event);
  const eventDescription = getEventDescription(event);

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

  // El evento EPG puede incluir identificador de catchup (backend/config).
  // Si existe, habilitamos "Watch / Catchup".
  const catchupStreamId = getCatchupStreamId(event);
  const canWatch = catchupStreamId != null;

  const isCatchupContext = detailContext === 'catchup';

  const isPast = useMemo(() => {
    if (nowMs == null || endMs == null) return isCatchupContext;
    return Number(nowMs) > Number(endMs);
  }, [nowMs, endMs, isCatchupContext]);

  const isFuture = useMemo(() => {
    if (nowMs == null || startMs == null) return false;
    return Number(nowMs) < Number(startMs);
  }, [nowMs, startMs]);

  const showCatchupAction = isCatchupContext ? canWatch : isPast && canWatch;
  const showPlayLiveAction = !isCatchupContext && showActions;
  const showRemindAction = !isCatchupContext && isFuture && showActions;

  useEffect(() => {
    if (isTV && open) {
      const t = setTimeout(() => {
        const id =
          !showActions
            ? 'epg-event-close'
            : isCatchupContext
              ? showCatchupAction
                ? 'epg-event-watch-catchup'
                : 'epg-event-close'
              : canPlayLive
                ? 'epg-event-play-live'
                : isFuture
                  ? 'epg-event-remind'
                  : showCatchupAction
                    ? 'epg-event-watch-catchup'
                    : 'epg-event-close';
        const el = document.getElementById(id);
        if (el) el.focus();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isTV, open, canPlayLive, showActions, isFuture, showCatchupAction, isCatchupContext]);

  const durationMinutes = useMemo(() => {
    if (startMs == null || endMs == null) return null;
    const diffMs = endMs - startMs;
    if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
    return Math.max(0, Math.round(diffMs / 60000));
  }, [startMs, endMs]);

  if (!open) return null;

  return createPortal(
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
              <BrandFallbackImage
                src={channelImg}
                alt={channel?.name || ''}
                className="epg-event-modal-channel-logo"
              />
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
            <BrandFallbackImage
              key={eventImg || 'event-placeholder'}
              src={eventImg}
              alt={eventTitle || ''}
              className="epg-event-modal-event-img"
            />

            <FocusableButton
              className="epg-event-modal-close"
              onClick={() => onClose?.()}
              type="button"
              id="epg-event-close"
            >
              <AppIcon name="close" size={18} />
            </FocusableButton>
          </div>
        </div>

        <div className="epg-event-modal-body">
          {eventImg ? (
            <span aria-hidden="true" />
          ) : null}

          <h2 className="epg-event-modal-title">{eventTitle || t('epg.eventNoTitle', { defaultValue: 'Sin título' })}</h2>

          <div className="epg-event-modal-live-badge">
            {isCatchupContext
              ? t('catchup.title', { defaultValue: 'Catchup' })
              : isLive
                ? t('epg.live', { defaultValue: 'En vivo' })
                : t('epg.notLive', { defaultValue: 'No en vivo' })}
          </div>

          {eventDescription ? (
            <p className="epg-event-modal-description">{eventDescription}</p>
          ) : (
            <p className="epg-event-modal-description epg-event-modal-description--empty">
              {t('epg.noDescription', { defaultValue: 'Sin descripción' })}
            </p>
          )}
        </div>

        {showActions ? (
          <div className="epg-event-modal-footer">
            {showPlayLiveAction ? (
              <FocusableButton
                className="epg-event-modal-primary"
                onClick={() => onPlayLive?.()}
                type="button"
                disabled={!canPlayLive}
                id="epg-event-play-live"
              >
                {t('epg.playLiveChannel', { defaultValue: 'Reproducir canal (en vivo)' })}
              </FocusableButton>
            ) : null}

            {showCatchupAction ? (
              <FocusableButton
                className={`epg-event-modal-secondary ${isCatchupContext ? 'epg-event-modal-primary' : ''}`}
                type="button"
                onClick={() => onWatchCatchup?.(catchupStreamId, event)}
                id="epg-event-watch-catchup"
              >
                {isCatchupContext
                  ? t('catchup.play', { defaultValue: 'Reproducir' })
                  : t('epg.watchCatchup', { defaultValue: 'Ver (Catchup)' })}
              </FocusableButton>
            ) : isCatchupContext ? (
              <p className="epg-event-modal-unavailable">
                {t('catchup.notAvailableYet', { defaultValue: 'Este programa aún no está disponible en catchup' })}
              </p>
            ) : null}

            {showRemindAction ? (
              <FocusableButton
                className="epg-event-modal-secondary"
                type="button"
                onClick={() => onRemind?.({ channel, event, startMs, endMs })}
                id="epg-event-remind"
              >
                {remindActive
                  ? t('epg.reminded', { defaultValue: 'Recordado' })
                  : t('epg.remindMe', { defaultValue: 'Recordarme' })}
              </FocusableButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  , document.body);
}

export default EpgEventModal;

