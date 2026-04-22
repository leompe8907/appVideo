import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../contexts/PlayerContext';
import { useDevice } from '../../contexts/DeviceContext';
import { FocusableButton } from '../navigation/FocusableButton';
import { resolveLiveWindowFromEpgItems } from '../../utils/epgCurrentEvent';
import { usePreload } from '../../store/usePreload';
import panaccessService from '../../services/panaccessService';
import { useBrand } from '../../contexts/BrandContext';
import EpgEventModal from '../epg/EpgEventModal';
import { useParentalGate } from '../../hooks/useParentalGate';
import { useParental } from '../../store/useParental';
import { getChannelStableId } from '../../utils/channelId';

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

function formatHHmm(dateLike) {
  if (!dateLike) return '';
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

function resolveNowNextFromEpgItems(epgItems, nowMs = Date.now()) {
  const list = Array.isArray(epgItems) ? [...epgItems] : [];
  if (list.length === 0) return { now: null, next: null };
  list.sort((a, b) => (toMs(a?.startDate) ?? 0) - (toMs(b?.startDate) ?? 0));
  const idx = list.findIndex((ev) => {
    const s = toMs(ev?.startDate ?? ev?.start);
    const e = toMs(ev?.endDate ?? ev?.end);
    if (s == null || e == null) return false;
    return nowMs >= s && nowMs <= e;
  });
  if (idx >= 0) return { now: list[idx] ?? null, next: list[idx + 1] ?? null };
  const firstFuture = list.find((ev) => {
    const s = toMs(ev?.startDate ?? ev?.start);
    return s != null && s > nowMs;
  });
  return { now: firstFuture ?? list[list.length - 1] ?? null, next: null };
}

// ChannelSidebar memoizado: se re-renderiza solo cuando cambian las props relevantes
const MemoizedChannelSidebar = React.memo(ChannelSidebar);

function ChannelSidebar({
  open,
  title,
  channels,
  activeId,
  autoCloseOnSelect = true,
  onClose,
  onSelectChannel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      const key = String(e.key || '');
      const code = String(e.code || '');
      const keyCode = Number(e.keyCode || e.which || 0);
      const isEscape = key === 'Escape' || code === 'Escape' || keyCode === 27;
      const isBackspace = key === 'Backspace' || code === 'Backspace' || keyCode === 8;
      const isReturnLike = key === 'Return' || key === 'GoBack' || key === 'BrowserBack';
      const isTvBackCodes = keyCode === 10009 || keyCode === 461;
      if (isEscape || isBackspace || isReturnLike || isTvBackCodes) {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="player-channel-sidebar-overlay" role="dialog" aria-modal="true" onClick={() => onClose?.()}>
      <div className="player-channel-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="player-channel-sidebar__header">
          <div className="player-channel-sidebar__title">{title}</div>
        </div>

        <div className="player-channel-sidebar__list" role="list">
          {(channels || []).slice(0, 400).map((ch) => {
            const chLogo = ch?.img || ch?.imageUrl || ch?.logoUrl || ch?.logo || ch?.icon || null;
            const id = ch?.id ?? ch?.lcn ?? ch?.name;
            const isActive = String(activeId ?? '') === String(ch?.id ?? '') || String(activeId ?? '') === String(ch?.lcn ?? '');
            const { now } = resolveNowNextFromEpgItems(ch?.epgItems, Date.now());
            const nowTitle = now?.languages?.[0]?.title || now?.title || now?.name || '';
            return (
              <FocusableButton
                key={id}
                type="button"
                className={`player-channel-sidebar__row${isActive ? ' player-channel-sidebar__row--active' : ''}`}
                onClick={() => {
                  onSelectChannel?.(ch);
                  if (autoCloseOnSelect) onClose?.();
                }}
                focusKey={`player-sidebar-channel-${id}`}
                role="listitem"
              >
                {chLogo ? (
                  <img className="player-channel-sidebar__logo" src={chLogo} alt="" />
                ) : (
                  <div className="player-channel-sidebar__logo player-channel-sidebar__logo--placeholder" />
                )}
                <span className="player-channel-sidebar__lcn">{ch?.lcn ?? ''}</span>
                <span className="player-channel-sidebar__meta">
                  <span className="player-channel-sidebar__name">{ch?.name ?? ''}</span>
                  {nowTitle ? <span className="player-channel-sidebar__now">{nowTitle}</span> : null}
                </span>
              </FocusableButton>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PlayerHud({ className = '' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isTV } = useDevice();
  const { requestPlayChannel, requestSetupPin } = useParentalGate();
  const parental = useParental();
  const {
    state,
    tracks,
    refreshTracks,
    selectAudioTrack,
    selectTextTrack,
    setSubtitlesEnabled,
    pause,
    play,
    stop,
    close,
    forward,
    backward,
    skipLiveBy,
    goLive,
    containerRef,
  } = usePlayer();
  const { epg } = usePreload();
  const { currentBrand } = useBrand();
  const [visible, setVisible] = useState(true);
  const [liveNowTickMs, setLiveNowTickMs] = useState(Date.now());
  const [overlay, setOverlay] = useState(''); // '' | 'channels' | 'info' | 'tracks'
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [tracksPopoverPos, setTracksPopoverPos] = useState(null); // { top, left, width } | null
  const hideTimeoutRef = useRef(null);

  const debugEnabled = useMemo(() => {
    if (import.meta.env.DEV) return true;
    try {
      const params = new URLSearchParams(window.location.search);
      const v = String(params.get('playerDebug') || '').toLowerCase();
      if (v === '1' || v === 'true') return true;
    } catch {
      // noop
    }
    try {
      const v = String(localStorage.getItem('player.debug') || '').toLowerCase();
      return v === '1' || v === 'true';
    } catch {
      return false;
    }
  }, []);

  const log = (...args) => {
    if (!debugEnabled) return;
    // eslint-disable-next-line no-console
    console.log('[PlayerHud]', ...args);
  };

  const forceHudVisible = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = String(params.get('hud') || '').toLowerCase();
      if (v === '1' || v === 'true') return true;
    } catch {
      // noop
    }
    // Por defecto, en DEV mantenemos el HUD visible para ajuste de UI.
    return import.meta.env.DEV;
  }, []);

  const hasContent = Boolean(state?.url);
  const isLiveService = state?.type === 'service' && !!state?.item;
  const liveWindow = useMemo(() => resolveLiveWindow(state?.item), [state?.item]);
  const nowNext = useMemo(() => {
    if (!state?.item?.epgItems) return { now: null, next: null };
    return resolveNowNextFromEpgItems(state.item.epgItems, liveNowTickMs);
  }, [state?.item, liveNowTickMs]);
  const channelMeta = useMemo(() => {
    const item = state?.item || null;
    if (!item) return null;
    const logo = item?.img || item?.imageUrl || item?.logoUrl || item?.logo || item?.icon || null;
    const lcn = item?.lcn ?? item?.channelNumber ?? null;
    const name = item?.name || item?.channelName || '';
    const { now, next } = nowNext;
    const nowTitle = now?.languages?.[0]?.title || now?.title || now?.name || '';
    const nextTitle = next?.languages?.[0]?.title || next?.title || next?.name || '';
    const nowStart = toMs(now?.startDate ?? now?.start);
    const nowEnd = toMs(now?.endDate ?? now?.end);
    const nowRange = nowStart != null && nowEnd != null ? `${formatHHmm(nowStart)} - ${formatHHmm(nowEnd)}` : '';
    return { logo, lcn, name, nowTitle, nextTitle, nowRange };
  }, [state?.item, liveNowTickMs, nowNext]);

  const channelList = useMemo(() => {
    const streams = epg?.streams || [];
    const list = Array.isArray(streams) ? [...streams] : [];
    list.sort((a, b) => Number(a?.lcn ?? 0) - Number(b?.lcn ?? 0));
    return list;
  }, [epg?.streams]);

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
    if (forceHudVisible) return;
    if (!shouldAutoHide) return;
    if (overlay) return;
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      hideTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    if (overlay !== 'tracks') return;
    refreshTracks?.();
  }, [overlay, refreshTracks]);

  useEffect(() => {
    if (overlay !== 'tracks') {
      setTracksPopoverPos(null);
      return undefined;
    }

    const compute = () => {
      const btn = document.getElementById('hud-top-tracks-btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const margin = 10;
      const top = Math.max(margin, Math.floor(r.bottom + 10));
      const left = Math.max(margin, Math.floor(r.left));
      const width = Math.max(420, Math.floor(Math.min(window.innerWidth - margin * 2, 860)));
      const clampedLeft = Math.min(left, Math.max(margin, window.innerWidth - width - margin));
      setTracksPopoverPos({ top, left: clampedLeft, width });
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, { passive: true });
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute);
    };
  }, [overlay]);

  useEffect(() => {
    if (overlay !== 'tracks') return undefined;
    const onKeyDown = (e) => {
      const key = String(e.key || '');
      const code = String(e.code || '');
      const keyCode = Number(e.keyCode || e.which || 0);
      const isEscape = key === 'Escape' || code === 'Escape' || keyCode === 27;
      const isBackspace = key === 'Backspace' || code === 'Backspace' || keyCode === 8;
      const isReturnLike = key === 'Return' || key === 'GoBack' || key === 'BrowserBack';
      const isTvBackCodes = keyCode === 10009 || keyCode === 461;
      if (isEscape || isBackspace || isReturnLike || isTvBackCodes) {
        e.preventDefault();
        e.stopPropagation();
        setOverlay('');
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [overlay]);

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
    if (forceHudVisible) {
      setVisible(true);
      clearHideTimeout();
      return undefined;
    }
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
  }, [hasContent, shouldAutoHide, forceHudVisible]);

  useEffect(() => {
    if (!(state?.type === 'service' && liveWindow && hasContent)) return undefined;
    const timer = setInterval(() => setLiveNowTickMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state?.type, liveWindow, hasContent]);

  if (!hasContent) return null;

  const currentChannelId = isLiveService ? getChannelStableId(state.item) : '';
  // El estado de bloqueo es independiente de si el control parental está habilitado.
  // Si el usuario bloquea un canal desde el Player, activamos el control parental automáticamente.
  const currentChannelBlocked = currentChannelId ? parental.isChannelBlocked(currentChannelId) : false;

  const toggleCurrentChannelBlock = () => {
    if (!isLiveService) return;
    if (!currentChannelId) return;

    // Si el usuario quiere bloquear y no hay PIN, guiar a configuración.
    if (!currentChannelBlocked && parental.hasPinConfigured?.() !== true) {
      requestSetupPin?.({
        channel: state.item,
        title: t('parental.title', { defaultValue: 'Control parental' }),
        message: t('parental.setupPinMessage', { defaultValue: 'Para usar el control parental debes configurar un PIN.' }),
      });
      return;
    }

    const ensureParentalEnabled = () => {
      if (parental.enabled) return;
      parental.setEnabled(true);
    };

    const doToggle = () => parental.toggleBlock(currentChannelId);

    // Si está bloqueado -> desbloquear requiere PIN (acción administrativa).
    if (currentChannelBlocked && parental.enabled && parental.hasPinConfigured()) {
      requestPlayChannel({
        channel: state.item,
        purpose: 'action',
        title: t('parental.title', { defaultValue: 'Control parental' }),
        message: t('parental.confirmChangeMessage', { defaultValue: 'Ingresa el PIN para cambiar el bloqueo del canal.' }),
        playFn: doToggle,
      });
      return;
    }

    // Si está permitido -> bloquear no requiere PIN.
    if (!currentChannelBlocked) ensureParentalEnabled();
    doToggle();
  };

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
  const clockText = formatHHmm(Date.now());
  const showPlaybackButtons =
    state?.type === 'vod' ||
    state?.type === 'catchup' ||
    (state?.type === 'service' && currentBrand?.player?.showPlaybackButtonsOnLive === true);
  const showSeekbar =
    state?.type === 'vod' ||
    state?.type === 'catchup' ||
    (state?.type === 'service' && currentBrand?.player?.showSeekbarOnLive === true);

  const resolveChannelLiveUrl = (channel) => {
    if (!channel) return null;
    let url =
      channel.url ||
      channel.streamUrl ||
      channel.hlsUrl ||
      channel.hls ||
      null;

    if (!url) {
      const streamId = channel.id ?? channel.epgStreamId;
      if (streamId != null && streamId !== '') {
        try {
          url = panaccessService.getStreamM3u8Url({ streamId });
        } catch {
          // noop
        }
      }
    }

    if (!url) return null;
    try {
      url = panaccessService.normalizePlaybackUrl(url);
    } catch {
      // noop
    }
    return url || null;
  };

  const handleZapToChannel = (channel) => {
    const url = resolveChannelLiveUrl(channel);
    if (!url) return;
    requestPlayChannel({
      channel,
      playFn: () =>
        play({
          type: 'service',
          id: channel.id ?? channel.lcn ?? undefined,
          url,
          item: channel,
          autoPlay: true,
        }),
    });
  };

  const shouldUseEpgInfoModal = state?.type === 'service' && !!state?.item && !!nowNext?.now;

  useEffect(() => {
    const onFsChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      try {
        document.documentElement.style.setProperty('--player-video-object-fit', fs ? 'cover' : 'contain');
      } catch {
        // noop
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    // Inicializar en montaje (por si el HUD aparece ya en fullscreen)
    onFsChange();
    if (debugEnabled) {
      const onVisibility = () => log('document:visibilitychange', { state: document.visibilityState });
      const onBlur = () => log('window:blur');
      const onFocus = () => log('window:focus');
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onFocus);
      return () => {
        document.removeEventListener('fullscreenchange', onFsChange);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
      };
    }
    return () => document.removeEventListener('fullscreenchange', onFsChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugEnabled]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        log('fullscreen:exit requested');
        await document.exitFullscreen?.();
        return;
      }

      // Modo "F11-like": fullscreen de toda la app (documento).
      // Es el enfoque más estable y evita que el engine pierda el <video>
      // o que el browser entre/salga inmediatamente del fullscreen.
      const el = document.documentElement;
      if (!el || typeof el.requestFullscreen !== 'function') return;
      log('fullscreen:enter requested', { target: 'documentElement' });
      await el.requestFullscreen();
    } catch (e) {
      log('fullscreen:error', e);
      // noop (browsers/TVs pueden bloquear si no hay gesto del usuario)
    }
  };

  return (
    <div className={`player-hud ${visible ? 'player-hud--visible' : 'player-hud--hidden'} ${className}`.trim()}>
      <div className="player-hud__topbar">
        <div className="player-hud__topbar-left">
          <FocusableButton
            type="button"
            className="player-hud__iconbtn"
            onClick={() => close()}
            aria-label={t('common.back', { defaultValue: 'Volver' })}
          >
            ⟵
          </FocusableButton>
          <FocusableButton
            type="button"
            className="player-hud__iconbtn"
            onClick={() => {
              setOverlay('');
              close();
              navigate('/home/epg');
            }}
            aria-label={t('epg.title', { defaultValue: 'EPG' })}
            title={t('epg.title', { defaultValue: 'EPG' })}
          >
            EPG
          </FocusableButton>
          {isLiveService && (
            <FocusableButton
              type="button"
              className="player-hud__iconbtn"
              onClick={toggleCurrentChannelBlock}
              aria-label={
                currentChannelBlocked
                  ? t('parental.unblock', { defaultValue: 'Desbloquear canal' })
                  : t('parental.block', { defaultValue: 'Bloquear canal' })
              }
              title={
                currentChannelBlocked
                  ? t('parental.unblock', { defaultValue: 'Desbloquear canal' })
                  : t('parental.block', { defaultValue: 'Bloquear canal' })
              }
            >
              {currentChannelBlocked ? '🔓' : '🔒'}
            </FocusableButton>
          )}
          <FocusableButton
            type="button"
            className="player-hud__iconbtn"
            onClick={() => setOverlay((v) => (v === 'channels' ? '' : 'channels'))}
            aria-label={t('player.channels', { defaultValue: 'Canales' })}
          >
            ☰
          </FocusableButton>
          <FocusableButton
            type="button"
            className="player-hud__iconbtn"
            onClick={() => setOverlay((v) => (v === 'info' ? '' : 'info'))}
            aria-label={t('player.info', { defaultValue: 'Información' })}
          >
            ⓘ
          </FocusableButton>
          <FocusableButton
            type="button"
            className="player-hud__iconbtn"
            onClick={() => setOverlay((v) => (v === 'tracks' ? '' : 'tracks'))}
            aria-label={t('player.tracks', { defaultValue: 'Audio/Subtítulos' })}
            id="hud-top-tracks-btn"
          >
            CC
          </FocusableButton>
        </div>

        {showPlaybackButtons ? (
          <div className="player-hud__topbar-center">
            <FocusableButton
              type="button"
              className="player-hud__iconbtn"
              onClick={() => (isLiveWithWindow ? skipLiveBy(-10) : backward(10))}
              aria-label={t('player.rewind10', { defaultValue: 'Retroceder 10s' })}
            >
              ⏪
            </FocusableButton>
            <FocusableButton
              type="button"
              className="player-hud__iconbtn player-hud__iconbtn--primary"
              onClick={handlePlayPause}
              aria-label={state?.isPlaying ? t('player.pause', { defaultValue: 'Pausar' }) : t('player.play', { defaultValue: 'Reproducir' })}
            >
              {state?.isPlaying ? '⏸' : '▶'}
            </FocusableButton>
            <FocusableButton
              type="button"
              className="player-hud__iconbtn"
              onClick={() => (isLiveWithWindow ? skipLiveBy(10) : forward(10))}
              aria-label={t('player.forward10', { defaultValue: 'Adelantar 10s' })}
            >
              ⏩
            </FocusableButton>
          </div>
        ) : (
          <div className="player-hud__topbar-center" />
        )}

        <div className="player-hud__topbar-right">
          {!isTV ? (
            <FocusableButton
              type="button"
              className="player-hud__iconbtn"
              onClick={toggleFullscreen}
              aria-label={
                isFullscreen
                  ? t('player.exitFullscreen', { defaultValue: 'Salir de pantalla completa' })
                  : t('player.fullscreen', { defaultValue: 'Pantalla completa' })
              }
              title={
                isFullscreen
                  ? t('player.exitFullscreen', { defaultValue: 'Salir de pantalla completa' })
                  : t('player.fullscreen', { defaultValue: 'Pantalla completa' })
              }
            >
              {isFullscreen ? '⤢' : '⛶'}
            </FocusableButton>
          ) : null}
          <div className="player-hud__clock" aria-label={t('common.time', { defaultValue: 'Hora' })}>
            {clockText}
          </div>
        </div>
      </div>

      {showSeekbar ? (
        <div className="player-hud__seek">
          <div className="player-hud__seek-times">
            <span className="player-hud__seek-time">{formatClock(progressModel.currentSec)}</span>
            <span className="player-hud__seek-time">{formatClock(progressModel.durationSec)}</span>
          </div>
          <div className="player-hud__progress">
            <div className="player-hud__progress-fill" style={{ width: `${progressModel.percent}%` }} />
          </div>
          {isLiveWithWindow && Number.isFinite(state?.liveSecondsLate) && state.liveSecondsLate > 0 && (
            <div className="player-hud__live-chip">
              -{formatClock(state.liveSecondsLate)}
            </div>
          )}
        </div>
      ) : null}

      <div className="player-hud__bottombar">
        <div className="player-hud__channel">
          {channelMeta?.logo ? (
            <img className="player-hud__channel-logo" src={channelMeta.logo} alt="" />
          ) : (
            <div className="player-hud__channel-logo player-hud__channel-logo--placeholder" />
          )}
          <div className="player-hud__channel-text">
            <div className="player-hud__channel-name">
              {channelMeta?.lcn != null ? <span className="player-hud__channel-lcn">{channelMeta.lcn}</span> : null}
              {channelMeta?.name || state?.type || '—'}
            </div>
            {channelMeta?.nowTitle ? (
              <div className="player-hud__program">
                <div className="player-hud__program-row">
                  <span className="player-hud__program-label">{t('player.now', { defaultValue: 'En este momento:' })}</span>
                  <span className="player-hud__program-title">{channelMeta.nowTitle}</span>
                </div>
                {channelMeta?.nextTitle ? (
                  <div className="player-hud__program-row">
                    <span className="player-hud__program-label">{t('player.next', { defaultValue: 'Siguiente:' })}</span>
                    <span className="player-hud__program-title">{channelMeta.nextTitle}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="player-hud__rightmeta">
          {channelMeta?.nowRange ? <div className="player-hud__event-range">{channelMeta.nowRange}</div> : null}
          <div className="player-hud__actions">
            {isLiveWithWindow ? (
              <FocusableButton
                type="button"
                className="player-hud__pillbtn"
                onClick={goLive}
              >
                {t('player.goLive', { defaultValue: 'En vivo' })}
              </FocusableButton>
            ) : null}
            <FocusableButton
              type="button"
              className="player-hud__pillbtn player-hud__pillbtn--danger"
              onClick={stop}
            >
              {t('player.stop', { defaultValue: 'Detener' })}
            </FocusableButton>
          </div>
        </div>
      </div>

      {overlay ? (
        overlay === 'tracks' ? null : overlay === 'info' && shouldUseEpgInfoModal ? null : (
        <div className="player-hud__overlay">
          <div className="player-hud__overlay-title">
            {overlay === 'channels'
              ? t('player.channelList', { defaultValue: 'Listado de canales' })
              : overlay === 'tracks'
              ? t('player.tracks', { defaultValue: 'Audio/Subtítulos' })
              : t('player.info', { defaultValue: 'Información' })}
          </div>
          <div className="player-hud__overlay-body">
            {overlay === 'tracks' ? (
              <div className="player-hud__tracks">
                <div className="player-hud__tracks-section">
                  <div className="player-hud__tracks-title">{t('player.audio', { defaultValue: 'Audio' })}</div>
                  <div className="player-hud__tracks-list" role="list">
                    {(tracks?.audio || []).length === 0 ? (
                      <div className="player-hud__tracks-empty">{t('player.noAudioTracks', { defaultValue: 'Sin pistas de audio' })}</div>
                    ) : (
                      (tracks?.audio || []).slice(0, 20).map((trk) => {
                        const isActive = String(tracks?.selectedAudioId ?? '') === String(trk?.id ?? '');
                        return (
                          <FocusableButton
                            key={`aud-${trk?.id}`}
                            type="button"
                            className={`player-hud__trackbtn${isActive ? ' player-hud__trackbtn--active' : ''}`}
                            onClick={() => selectAudioTrack?.(trk?.id)}
                            role="listitem"
                          >
                            <span className="player-hud__trackbtn-label">{trk?.label || trk?.lang || 'Audio'}</span>
                            {trk?.lang ? <span className="player-hud__trackbtn-meta">{trk.lang}</span> : null}
                          </FocusableButton>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="player-hud__tracks-section">
                  <div className="player-hud__tracks-title">{t('player.subtitles', { defaultValue: 'Subtítulos' })}</div>
                  <div className="player-hud__tracks-list" role="list">
                    <FocusableButton
                      type="button"
                      className={`player-hud__trackbtn${tracks?.textEnabled ? '' : ' player-hud__trackbtn--active'}`}
                      onClick={() => setSubtitlesEnabled?.(false)}
                      role="listitem"
                    >
                      <span className="player-hud__trackbtn-label">{t('player.subtitlesOff', { defaultValue: 'Desactivados' })}</span>
                    </FocusableButton>

                    {(tracks?.text || []).length === 0 ? (
                      <div className="player-hud__tracks-empty">{t('player.noSubtitleTracks', { defaultValue: 'Sin subtítulos' })}</div>
                    ) : (
                      (tracks?.text || []).slice(0, 30).map((trk) => {
                        const isActive =
                          tracks?.textEnabled === true &&
                          String(tracks?.selectedTextId ?? '') === String(trk?.id ?? '');
                        return (
                          <FocusableButton
                            key={`sub-${trk?.id}`}
                            type="button"
                            className={`player-hud__trackbtn${isActive ? ' player-hud__trackbtn--active' : ''}`}
                            onClick={() => {
                              setSubtitlesEnabled?.(true);
                              selectTextTrack?.(trk?.id);
                            }}
                            role="listitem"
                          >
                            <span className="player-hud__trackbtn-label">{trk?.label || trk?.lang || 'Sub'}</span>
                            {trk?.lang ? <span className="player-hud__trackbtn-meta">{trk.lang}</span> : null}
                          </FocusableButton>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="player-hud__placeholder">
                {t('common.comingSoon', { defaultValue: 'En preparación...' })}
              </div>
            )}
          </div>
          <FocusableButton
            type="button"
            className="player-hud__pillbtn player-hud__overlay-close"
            onClick={() => setOverlay('')}
          >
            {t('common.close', { defaultValue: 'Cerrar' })}
          </FocusableButton>
        </div>
        )
      ) : null}

      {overlay === 'tracks' && tracksPopoverPos ?
        createPortal(
          <div className="player-hud__tracks-popover-overlay" onClick={() => setOverlay('')}>
            <div
              className="player-hud__tracks-popover"
              style={{ top: `${tracksPopoverPos.top}px`, left: `${tracksPopoverPos.left}px`, width: `${tracksPopoverPos.width}px` }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="player-hud__tracks-popover-title">{t('player.tracks', { defaultValue: 'Audio/Subtítulos' })}</div>
              <div className="player-hud__tracks">
                <div className="player-hud__tracks-section">
                  <div className="player-hud__tracks-title">{t('player.audio', { defaultValue: 'Audio' })}</div>
                  <div className="player-hud__tracks-list" role="list">
                    {(tracks?.audio || []).length === 0 ? (
                      <div className="player-hud__tracks-empty">{t('player.noAudioTracks', { defaultValue: 'Sin pistas de audio' })}</div>
                    ) : (
                      (tracks?.audio || []).slice(0, 20).map((trk) => {
                        const isActive = String(tracks?.selectedAudioId ?? '') === String(trk?.id ?? '');
                        return (
                          <FocusableButton
                            key={`aud-${trk?.id}`}
                            type="button"
                            className={`player-hud__trackbtn${isActive ? ' player-hud__trackbtn--active' : ''}`}
                            onClick={() => selectAudioTrack?.(trk?.id)}
                            focusKey={`hud-tracks-audio-${trk?.id}`}
                            isFocusable={visible}
                            role="listitem"
                          >
                            <span className="player-hud__trackbtn-label">{trk?.label || trk?.lang || 'Audio'}</span>
                            {trk?.lang ? <span className="player-hud__trackbtn-meta">{trk.lang}</span> : null}
                          </FocusableButton>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="player-hud__tracks-section">
                  <div className="player-hud__tracks-title">{t('player.subtitles', { defaultValue: 'Subtítulos' })}</div>
                  <div className="player-hud__tracks-list" role="list">
                    <FocusableButton
                      type="button"
                      className={`player-hud__trackbtn${tracks?.textEnabled ? '' : ' player-hud__trackbtn--active'}`}
                      onClick={() => setSubtitlesEnabled?.(false)}
                      focusKey="hud-tracks-subs-off"
                      isFocusable={visible}
                      role="listitem"
                    >
                      <span className="player-hud__trackbtn-label">{t('player.subtitlesOff', { defaultValue: 'Desactivados' })}</span>
                    </FocusableButton>

                    {(tracks?.text || []).length === 0 ? (
                      <div className="player-hud__tracks-empty">{t('player.noSubtitleTracks', { defaultValue: 'Sin subtítulos' })}</div>
                    ) : (
                      (tracks?.text || []).slice(0, 30).map((trk) => {
                        const isActive =
                          tracks?.textEnabled === true &&
                          String(tracks?.selectedTextId ?? '') === String(trk?.id ?? '');
                        return (
                          <FocusableButton
                            key={`sub-${trk?.id}`}
                            type="button"
                            className={`player-hud__trackbtn${isActive ? ' player-hud__trackbtn--active' : ''}`}
                            onClick={() => {
                              setSubtitlesEnabled?.(true);
                              selectTextTrack?.(trk?.id);
                            }}
                            focusKey={`hud-tracks-subs-${trk?.id}`}
                            isFocusable={visible}
                            role="listitem"
                          >
                            <span className="player-hud__trackbtn-label">{trk?.label || trk?.lang || 'Sub'}</span>
                            {trk?.lang ? <span className="player-hud__trackbtn-meta">{trk.lang}</span> : null}
                          </FocusableButton>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="player-hud__tracks-popover-actions">
                <FocusableButton
                  type="button"
                  className="player-hud__pillbtn player-hud__overlay-close"
                  onClick={() => setOverlay('')}
                >
                  {t('common.close', { defaultValue: 'Cerrar' })}
                </FocusableButton>
              </div>
            </div>
          </div>,
          document.body
        )
      : null}

      <MemoizedChannelSidebar
        open={overlay === 'channels'}
        title={t('player.channelList', { defaultValue: 'Listado de canales' })}
        channels={channelList}
        activeId={state?.id}
        autoCloseOnSelect={currentBrand?.player?.closeChannelSidebarOnSelect === true}
        onClose={() => setOverlay('')}
        onSelectChannel={(ch) => handleZapToChannel(ch)}
      />

      {overlay === 'info' && shouldUseEpgInfoModal ? (
        <EpgEventModal
          open
          channel={state?.item}
          event={nowNext?.now}
          isLive={true}
          canPlayLive={true}
          showActions={false}
          onClose={() => setOverlay('')}
          onPlayLive={() => {
            // Reproducir canal en vivo: reusar el mismo flujo de zapping.
            handleZapToChannel(state?.item);
          }}
          onWatchCatchup={(catchupId) => {
            if (!catchupId) return;
            setOverlay('');
            navigate('/home/catchup', { state: { catchupId, from: 'player-info' }, replace: false });
          }}
        />
      ) : null}
    </div>
  );
}

// PlayerHud memoizado: evita re-renders innecesarios cuando el estado del player cambia
// pero las props del componente no cambian. El HUD recibe actualizaciones de currentTime
// cada ~250ms, pero la mayoría no requieren re-renderizar el componente completo.
const MemoizedPlayerHud = React.memo(PlayerHud);

export default MemoizedPlayerHud;

