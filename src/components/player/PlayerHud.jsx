import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlayer } from '../../contexts/PlayerContext';
import { resolveLiveWindowFromEpgItems } from '../../utils/epgCurrentEvent';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function formatClock(seconds) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  if (hh > 0) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function toMs(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value?.valueOf === 'function') {
    const ms = value.valueOf();
    if (typeof ms === 'number' && Number.isFinite(ms)) return ms;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function resolveLiveWindow(item) {
  if (!item) return null;
  const candidates = [
    item,
    item.liveEvent,
    item.currentEvent,
    item.event,
    item.playbackMetadata?.item,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const startMs = toMs(candidate?.startDate ?? candidate?.start ?? candidate?.startTime);
    const endMs = toMs(candidate?.endDate ?? candidate?.end ?? candidate?.endTime);
    if (startMs != null && endMs != null && endMs > startMs) {
      return { startMs, endMs };
    }
  }
  // Canales desde bouquets/EPG: el evento al aire está en epgItems (no en la raíz del canal).
  const fromEpg = resolveLiveWindowFromEpgItems(item?.epgItems);
  if (fromEpg) return fromEpg;
  return null;
}

export function PlayerHud({ className = '' }) {
  const { t } = useTranslation();
  const { state, pause, play, stop, close, forward, backward, skipLiveBy, goLive } = usePlayer();
  const [visible, setVisible] = useState(true);
  const [liveNowTickMs, setLiveNowTickMs] = useState(Date.now());
  const hideTimeoutRef = useRef(null);

  const hasContent = Boolean(state?.url);
  const liveWindow = useMemo(() => resolveLiveWindow(state?.item), [state?.item]);

  const progressModel = useMemo(() => {
    // Paridad legacy: para LIVE, usar la ventana temporal del evento.
    if (state?.type === 'service' && liveWindow) {
      const durationSec = Math.max(1, Math.floor((liveWindow.endMs - liveWindow.startMs) / 1000));
      const adjustedNowMs = liveNowTickMs - (Number.isFinite(state?.liveSecondsLate) ? state.liveSecondsLate * 1000 : 0);
      const serverNowSec = (adjustedNowMs - liveWindow.startMs) / 1000;
      const currentSec = clamp(serverNowSec, 0, durationSec);
      const percent = clamp((currentSec / durationSec) * 100, 0, 100);
      return {
        currentSec,
        durationSec,
        percent,
      };
    }

    const currentSec = Number.isFinite(state?.currentTime) ? Math.max(0, state.currentTime) : 0;
    const durationSec = Number.isFinite(state?.duration) && state.duration > 0 ? state.duration : 0;
    const percent = durationSec > 0 ? clamp((currentSec / durationSec) * 100, 0, 100) : 0;
    return {
      currentSec,
      durationSec,
      percent,
    };
  }, [state?.type, state?.currentTime, state?.duration, state?.liveSecondsLate, liveWindow, liveNowTickMs]);

  const shouldAutoHide = state?.isPlaying && !state?.isLoading && !state?.isSeeking;

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const armAutoHide = () => {
    clearHideTimeout();
    if (!shouldAutoHide) return;
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      hideTimeoutRef.current = null;
    }, 4000);
  };

  const wakeHud = () => {
    setVisible(true);
    armAutoHide();
  };

  useEffect(() => {
    if (!hasContent) return;
    wakeHud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasContent, state?.isPlaying, state?.isLoading, state?.isSeeking, state?.url]);

  useEffect(() => {
    if (!hasContent) return undefined;
    const onMouseMove = () => wakeHud();
    const onKeyDown = () => wakeHud();
    const onPointerDown = () => wakeHud();
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      clearHideTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasContent, shouldAutoHide]);

  useEffect(() => {
    if (!(state?.type === 'service' && liveWindow && hasContent)) return undefined;
    const timer = setInterval(() => setLiveNowTickMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state?.type, liveWindow, hasContent]);

  if (!hasContent) return null;

  const handlePlayPause = () => {
    if (state?.isPlaying) {
      pause();
      return;
    }
    play({
      type: state?.type,
      id: state?.id,
      url: state?.url,
      item: state?.item,
      autoPlay: true,
    });
  };

  const isLiveWithWindow = state?.type === 'service' && !!liveWindow;

  return (
    <div className={`player-hud ${visible ? 'player-hud--visible' : 'player-hud--hidden'} ${className}`.trim()}>
      <div className="player-hud__chrome">
        <div className="player-hud__status">
          <span className="player-hud__badge">{state?.type || 'stream'}</span>
          <div className="player-hud__status-right">
            {isLiveWithWindow && Number.isFinite(state?.liveSecondsLate) && state.liveSecondsLate > 0 && (
              <span className="player-hud__live-delay">
                -{formatClock(state.liveSecondsLate)}
              </span>
            )}
            <span className="player-hud__time">
              {formatClock(progressModel.currentSec)} / {formatClock(progressModel.durationSec)}
            </span>
          </div>
        </div>

        <div className="player-hud__controls">
          <button
            type="button"
            className="player-hud__btn"
            onClick={() => (isLiveWithWindow ? skipLiveBy(-10) : backward(10))}
          >
            {t('player.rewind10', { defaultValue: '-10s' })}
          </button>
          <button type="button" className="player-hud__btn player-hud__btn--primary" onClick={handlePlayPause}>
            {state?.isPlaying
              ? t('player.pause', { defaultValue: 'Pausar' })
              : t('player.play', { defaultValue: 'Reproducir' })}
          </button>
          <button
            type="button"
            className="player-hud__btn"
            onClick={() => (isLiveWithWindow ? skipLiveBy(10) : forward(10))}
          >
            {t('player.forward10', { defaultValue: '+10s' })}
          </button>
          {isLiveWithWindow && (
            <button type="button" className="player-hud__btn player-hud__btn--live" onClick={goLive}>
              {t('player.goLive', { defaultValue: 'En vivo' })}
            </button>
          )}
          <button type="button" className="player-hud__btn player-hud__btn--danger" onClick={stop}>
            {t('player.stop', { defaultValue: 'Detener' })}
          </button>
          <button type="button" className="player-hud__btn player-hud__btn--exit" onClick={close}>
            {t('player.exit', { defaultValue: 'Salir' })}
          </button>
        </div>

        <div className="player-hud__progress">
          <div className="player-hud__progress-fill" style={{ width: `${progressModel.percent}%` }} />
        </div>
      </div>
    </div>
  );
}

export default PlayerHud;

