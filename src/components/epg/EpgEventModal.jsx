import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { FocusableButton } from '../navigation/FocusableButton';
import { useSpatialSetFocus } from '../../hooks/navigation/useSpatialNavigation';
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
  nowMs,
  canPlayLive = true,
  showActions = true,
  onClose,
  onPlayLive,
  onWatchCatchup,
  onRemind,
  remindActive = false,
}) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const setFocus = useSpatialSetFocus();

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
    // capture=true para ganarle a norigin y handlers globales
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, onClose]);

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

  // El evento EPG puede incluir identificador de catchup (backend/config).
  // Si existe, habilitamos "Watch / Catchup".
  const catchupId = event?.catchupId ?? event?.catchup_id ?? event?.catchupEventId ?? null;
  const canWatch = catchupId != null && Number(catchupId) > -1;

  const isPast = useMemo(() => {
    if (nowMs == null || endMs == null) return false;
    return Number(nowMs) > Number(endMs);
  }, [nowMs, endMs]);

  const isFuture = useMemo(() => {
    if (nowMs == null || startMs == null) return false;
    return Number(nowMs) < Number(startMs);
  }, [nowMs, startMs]);

  useEffect(() => {
    if (isTV && open) {
      const t = setTimeout(() => {
        if (typeof setFocus === 'function') {
          // Si estamos en modo info-only, el foco debe ir al botón cerrar.
          if (!showActions) {
            setFocus('epg-event-close');
            return;
          }
          // Orden de foco:
          // - Play live si está disponible
          // - si es futuro, "Recordarme"
          // - si es pasado con catchup disponible, "Watch/Catchup"
          // - fallback cerrar
          if (canPlayLive) {
            setFocus('epg-event-play-live');
            return;
          }
          if (isFuture) {
            setFocus('epg-event-remind');
            return;
          }
          if (isPast && canWatch) {
            setFocus('epg-event-watch-catchup');
            return;
          }
          setFocus('epg-event-close');
        }
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isTV, open, canPlayLive, showActions, setFocus, isFuture, isPast, canWatch]);

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

            <FocusableButton
              className="epg-event-modal-close"
              onClick={() => onClose?.()}
              type="button"
              focusKey="epg-event-close"
              onArrowPress={() => {}}
            >
              {t('common.close', { defaultValue: 'Cerrar' })}
            </FocusableButton>
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

        {showActions ? (
          <div className="epg-event-modal-footer">
            <FocusableButton
              className="epg-event-modal-primary"
              onClick={() => onPlayLive?.()}
              type="button"
              disabled={!canPlayLive}
              focusKey="epg-event-play-live"
              onArrowPress={() => {}} // Catch para evitar salir si queremos trap, o dejar libre
            >
              {t('epg.playLiveChannel', { defaultValue: 'Reproducir canal (en vivo)' })}
            </FocusableButton>

            {isPast && canWatch ? (
              <FocusableButton
                className="epg-event-modal-secondary"
                type="button"
                onClick={() => onWatchCatchup?.(catchupId, event)}
                focusKey="epg-event-watch-catchup"
              >
                {t('epg.watchCatchup', { defaultValue: 'Watch (Catchup)' })}
              </FocusableButton>
            ) : null}

            {isFuture ? (
              <FocusableButton
                className="epg-event-modal-secondary"
                type="button"
                onClick={() => onRemind?.({ channel, event, startMs, endMs })}
                focusKey="epg-event-remind"
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

