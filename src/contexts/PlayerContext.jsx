import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useDevice } from './DeviceContext';
import { useBrand } from './BrandContext';
import { createEngine } from '../player/engines/createEngine';
import { DEFAULT_SEEK_STEP_SECONDS, PLAYER_ENGINE_EVENTS } from '../player/engines/contracts';
import panaccessService from '../services/panaccessService';
import * as userSession from '../utils/userSession';
import { isLicenseInUseError } from '../utils/licenseInUse';

const PlayerContext = createContext(null);

// Hook para usar el contexto del player
// eslint-disable-next-line react-refresh/only-export-components
export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer debe usarse dentro de PlayerProvider');
  }
  return ctx;
}

export function PlayerProvider({ children }) {
  const deviceInfo = useDevice();
  const { currentBrand } = useBrand();
  const brandRef = useRef(currentBrand);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const seekTimeoutRef = useRef(null);
  const recoveryRef = useRef({ inProgress: false, lastKey: '' });
  const debugRef = useRef(false);

  // Mantener brandRef sincronizado para evitar stale closures en el primer useEffect
  useEffect(() => {
    brandRef.current = currentBrand;
  }, [currentBrand]);

  const isDebugEnabled = () => {
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
  };

  const log = useCallback((...args) => {
    if (!debugRef.current) return;
    console.log('[PlayerContext]', ...args);
  }, []);

  const [state, setState] = useState({
    type: null, // 'service' | 'vod' | 'catchup'
    id: null,
    url: null,
    item: null,
    mediaOption: {},
    drmConfig: {},
    isPlaying: false,
    isLoading: false,
    isSeeking: false,
    currentTime: 0,
    duration: 0,
    liveInitialPlayerTime: null,
    liveInitialServerMs: null,
    liveSecondsLate: 0,
    error: null,
  });

  const [licenseInUsePrompt, setLicenseInUsePrompt] = useState(null);
  const [tracks, setTracks] = useState({
    audio: [],
    text: [],
    selectedAudioId: null,
    selectedTextId: null,
    textEnabled: false,
  });

  const clearSeekTimeout = useCallback(() => {
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
  }, []);

  const armSeekTimeout = useCallback(() => {
    clearSeekTimeout();
    // Paridad con legacy: no dejar el estado "seeking" colgado indefinidamente.
    seekTimeoutRef.current = setTimeout(() => {
      setState((s) => ({ ...s, isSeeking: false, isLoading: false }));
      seekTimeoutRef.current = null;
    }, 20000);
  }, [clearSeekTimeout]);

  // Crear engine UNA SOLA VEZ al montar el provider.
  // El engine se mantiene vivo durante toda la sesión para evitar:
  // - Pantalla negra durante navegación entre páginas
  // - Pérdida del elemento <video> montado
  // - Re-registro de event listeners (overhead de CPU)
  // - Reset de estado de playback mid-playback
  useEffect(() => {
    debugRef.current = isDebugEnabled();
    
    // Si ya existe un engine, no recrear (protección contra cambios de signature)
    if (engineRef.current) {
      log('engine:skip (already exists)');
      return;
    }
    
    const engine = createEngine(deviceInfo);
    engineRef.current = engine;
    log('engine:create', { deviceType: deviceInfo?.deviceType, isTV: !!deviceInfo?.isTV, userAgent: deviceInfo?.userAgent });

    if (containerRef.current) {
      engine.init(containerRef.current);
      log('engine:init', { hasContainer: true });
    }

    const handleTime = ({ currentTime, duration }) => {
      setState((s) => {
        const nextCurrentTime = typeof currentTime === 'number' ? currentTime : s.currentTime;
        const nextDuration = typeof duration === 'number' ? duration : s.duration;

        if (s.type === 'service') {
          const initialPlayer = s.liveInitialPlayerTime ?? nextCurrentTime ?? 0;
          const initialServer = s.liveInitialServerMs ?? Date.now();
          const estimatedLivePoint = initialPlayer + (Date.now() - initialServer) / 1000;
          const liveSecondsLate = Math.max(0, estimatedLivePoint - (nextCurrentTime ?? 0));
          return {
            ...s,
            currentTime: nextCurrentTime,
            duration: nextDuration,
            liveInitialPlayerTime: initialPlayer,
            liveInitialServerMs: initialServer,
            liveSecondsLate,
          };
        }

        return {
          ...s,
          currentTime: nextCurrentTime,
          duration: nextDuration,
        };
      });
    };

    const handleDuration = ({ duration }) => {
      setState((s) => ({
        ...s,
        duration: typeof duration === 'number' ? duration : s.duration,
      }));
    };

    const handleEnded = () => {
      clearSeekTimeout();
      log('engine:event ended');
      setState((s) => ({
        ...s,
        isPlaying: false,
        isLoading: false,
        isSeeking: false,
      }));
    };

    const tryRecoverAfterError = async (err, snapshot) => {
      const brand = brandRef.current;
      if (!brand) return false;
      if (!snapshot?.url) return false;

      const active = userSession.getActiveLicense?.();
      const licenseKey = active?.licenseKey ? String(active.licenseKey).trim() : '';
      const pin = active?.pin != null ? String(active.pin) : '';
      if (!licenseKey) return false;

      // Evitar loops de recuperación sobre el mismo contenido.
      const recoveryKey = `${snapshot.type || ''}::${snapshot.id || ''}::${snapshot.url || ''}`;
      if (recoveryRef.current.inProgress) return false;
      if (recoveryRef.current.lastKey === recoveryKey) return false;

      recoveryRef.current.inProgress = true;
      recoveryRef.current.lastKey = recoveryKey;

      try {
        if (!panaccessService.client) {
          await panaccessService.initialize(brand);
        }

        // Intento 1 (legacy): fallar si está en uso, para saber si hay takeover.
        await panaccessService.setStreamingLicense({ licenseKey, pin, failIfInUse: true });

        // Si la licencia reactivó bien, reintentar playback del mismo contenido.
        engineRef.current?.load?.(snapshot.url, {
          type: snapshot.type,
          autoPlay: true,
          mediaOption: snapshot.mediaOption || {},
          drmConfig: snapshot.drmConfig || {},
        });

        return true;
      } catch (e) {
        if (isLicenseInUseError(e)) {
          // Mostrar confirm “continuar aquí” (takeover).
          setLicenseInUsePrompt({
            licenseKey,
            pin,
            snapshot,
          });
          return true;
        }
        return false;
      } finally {
        recoveryRef.current.inProgress = false;
      }
    };

    const handleError = (err) => {
      clearSeekTimeout();
      log('engine:event error', err);
      setState((s) => {
        const snapshot = {
          type: s.type,
          id: s.id,
          url: s.url,
          item: s.item,
          mediaOption: s.mediaOption,
          drmConfig: s.drmConfig,
        };

        // Recuperación async sin bloquear el setState.
        Promise.resolve().then(() => {
          tryRecoverAfterError(err, snapshot);
        });

        return {
          ...s,
          isPlaying: false,
          isLoading: false,
          isSeeking: false,
          error: err,
        };
      });
    };

    const handleStateChange = ({ state }) => {
      log('engine:event statechange', state);
      if (state === 'loading' || state === 'loaded') {
        setState((s) => ({ ...s, isLoading: true }));
      } else if (state === 'seeking') {
        armSeekTimeout();
        setState((s) => ({ ...s, isSeeking: true, isLoading: true }));
      } else if (state === 'seeked') {
        setState((s) => ({ ...s, isSeeking: false }));
      } else if (state === 'playing') {
        clearSeekTimeout();
        setState((s) => ({ ...s, isPlaying: true, isLoading: false, isSeeking: false }));
      } else if (state === 'paused' || state === 'ended') {
        clearSeekTimeout();
        setState((s) => ({ ...s, isPlaying: false, isLoading: false, isSeeking: false }));
      }
    };

    const handleSeekStart = () => {
      armSeekTimeout();
      setState((s) => ({ ...s, isSeeking: true, isLoading: true }));
    };

    const handleSeekEnd = () => {
      clearSeekTimeout();
      setState((s) => ({ ...s, isSeeking: false }));
    };

    const handleTracksChange = (payload) => {
      if (!payload) return;
      setTracks({
        audio: Array.isArray(payload.audio) ? payload.audio : [],
        text: Array.isArray(payload.text) ? payload.text : [],
        selectedAudioId: payload.selectedAudioId ?? null,
        selectedTextId: payload.selectedTextId ?? null,
        textEnabled: payload.textEnabled === true,
      });
    };

    engine.on(PLAYER_ENGINE_EVENTS.TIME_UPDATE, handleTime);
    engine.on(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, handleDuration);
    engine.on(PLAYER_ENGINE_EVENTS.ENDED, handleEnded);
    engine.on(PLAYER_ENGINE_EVENTS.ERROR, handleError);
    engine.on(PLAYER_ENGINE_EVENTS.STATE_CHANGE, handleStateChange);
    engine.on(PLAYER_ENGINE_EVENTS.SEEK_START, handleSeekStart);
    engine.on(PLAYER_ENGINE_EVENTS.SEEK_END, handleSeekEnd);
    engine.on(PLAYER_ENGINE_EVENTS.TRACKS_CHANGE, handleTracksChange);

    return () => {
      engine.off(PLAYER_ENGINE_EVENTS.TIME_UPDATE, handleTime);
      engine.off(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, handleDuration);
      engine.off(PLAYER_ENGINE_EVENTS.ENDED, handleEnded);
      engine.off(PLAYER_ENGINE_EVENTS.ERROR, handleError);
      engine.off(PLAYER_ENGINE_EVENTS.STATE_CHANGE, handleStateChange);
      engine.off(PLAYER_ENGINE_EVENTS.SEEK_START, handleSeekStart);
      engine.off(PLAYER_ENGINE_EVENTS.SEEK_END, handleSeekEnd);
      engine.off(PLAYER_ENGINE_EVENTS.TRACKS_CHANGE, handleTracksChange);
      clearSeekTimeout();
      log('engine:destroy (cleanup on unmount)');
      engine.destroy();
      engineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array vacío: engine se crea UNA SOLA VEZ al montar

  // Si la plataforma cambia (TV ↔ PC) sin recargar, recargar la app: recrear el engine
  // aquí dejaría listeners del PlayerContext sin enganchar (handlers viven en el mount inicial).
  const currentPlatform = deviceInfo?.isTV ? 'tv' : 'pc';
  useEffect(() => {
    if (!engineRef.current) return;

    const enginePlatform = engineRef.current.platform || 'unknown';
    if (enginePlatform !== 'unknown' && enginePlatform !== currentPlatform) {
      log('engine:platformChanged -> reload', { from: enginePlatform, to: currentPlatform });
      window.location.reload();
      return;
    }
    if (!engineRef.current.platform) {
      engineRef.current.platform = currentPlatform;
    }
  }, [currentPlatform, log]);

  const play = ({ type, id, url, item, autoPlay = true, mediaOption = {}, drmConfig = {} }) => {
    const engine = engineRef.current;
    if (!engine || !url) {
      console.warn('[PlayerProvider] No hay engine o URL para reproducir');
      return;
    }
    log('action:play', { type, id, url });

    // Si el engine nunca se inicializó, o el nodo contenedor cambió (ej. remount), inicializar ahora
    if (containerRef.current && (!engine.video || engine.container !== containerRef.current)) {
      engine.init(containerRef.current);
    }

    // Si ya estamos en el mismo contenido, solo darle play
    if (state.type === type && state.id === id && state.url === url) {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      log('action:play (same content) -> engine.play()');
      engine.play();
      return;
    }

    setState((s) => ({
      ...s,
      type,
      id,
      url,
      item,
      mediaOption,
      drmConfig,
      isPlaying: false,
      isLoading: true,
      isSeeking: false,
      error: null,
      currentTime: 0,
      duration: 0,
      liveInitialPlayerTime: null,
      liveInitialServerMs: null,
      liveSecondsLate: 0,
    }));

    // Reset tracks para no mostrar info anterior mientras llega el manifiesto nuevo.
    setTracks({ audio: [], text: [], selectedAudioId: null, selectedTextId: null, textEnabled: false });
    engine.load(url, { type, autoPlay, mediaOption, drmConfig });
  };

  const pause = () => {
    engineRef.current?.pause();
  };

  const stop = () => {
    clearSeekTimeout();
    log('action:stop');
    engineRef.current?.stop?.();
    setState((s) => ({
      ...s,
      isPlaying: false,
      isLoading: false,
      isSeeking: false,
      currentTime: 0,
    }));
  };

  const close = () => {
    clearSeekTimeout();
    log('action:close');
    try {
      engineRef.current?.stop?.();
    } catch {
      // noop
    }
    setState({
      type: null,
      id: null,
      url: null,
      item: null,
      mediaOption: {},
      drmConfig: {},
      isPlaying: false,
      isLoading: false,
      isSeeking: false,
      currentTime: 0,
      duration: 0,
      liveInitialPlayerTime: null,
      liveInitialServerMs: null,
      liveSecondsLate: 0,
      error: null,
    });
    setTracks({ audio: [], text: [], selectedAudioId: null, selectedTextId: null, textEnabled: false });
  };

  const seek = (seconds) => {
    armSeekTimeout();
    setState((s) => ({ ...s, isSeeking: true, isLoading: true }));
    engineRef.current?.seek(seconds);
  };

  const forward = (seconds = DEFAULT_SEEK_STEP_SECONDS) => {
    armSeekTimeout();
    setState((s) => ({ ...s, isSeeking: true, isLoading: true }));
    engineRef.current?.forward?.(seconds);
  };

  const backward = (seconds = DEFAULT_SEEK_STEP_SECONDS) => {
    armSeekTimeout();
    setState((s) => ({ ...s, isSeeking: true, isLoading: true }));
    engineRef.current?.backward?.(seconds);
  };

  const setPlaybackRate = (rate = 1) => {
    engineRef.current?.setPlaybackRate?.(rate);
  };

  const getEstimatedLivePoint = () => {
    const initialPlayer = Number.isFinite(state.liveInitialPlayerTime) ? state.liveInitialPlayerTime : null;
    const initialServer = Number.isFinite(state.liveInitialServerMs) ? state.liveInitialServerMs : null;
    if (initialPlayer == null || initialServer == null) return null;
    return initialPlayer + (Date.now() - initialServer) / 1000;
  };

  const skipLiveBy = (seconds = 0) => {
    if (state.type !== 'service') return false;
    const delta = Number.isFinite(seconds) ? seconds : 0;
    const livePoint = getEstimatedLivePoint();
    if (!Number.isFinite(livePoint)) return false;

    const current = Number.isFinite(state.currentTime) ? state.currentTime : livePoint;
    const target = Math.max(0, Math.min(livePoint, current + delta));
    const nextLate = Math.max(0, livePoint - target);

    setState((s) => ({ ...s, liveSecondsLate: nextLate }));
    seek(target);
    return true;
  };

  const goLive = () => {
    if (state.type !== 'service') return false;
    const livePoint = getEstimatedLivePoint();
    if (!Number.isFinite(livePoint)) return false;
    setState((s) => ({ ...s, liveSecondsLate: 0 }));
    seek(livePoint);
    return true;
  };

  const mute = () => {
    engineRef.current?.mute?.();
  };

  const unmute = () => {
    engineRef.current?.unmute?.();
  };

  const value = {
    state,
    tracks,
    play,
    pause,
    stop,
    close,
    seek,
    forward,
    backward,
    setPlaybackRate,
    skipLiveBy,
    goLive,
    mute,
    unmute,
    refreshTracks: () => {
      try {
        const next = engineRef.current?.getTracks?.();
        if (next) {
          setTracks({
            audio: Array.isArray(next.audio) ? next.audio : [],
            text: Array.isArray(next.text) ? next.text : [],
            selectedAudioId: next.selectedAudioId ?? null,
            selectedTextId: next.selectedTextId ?? null,
            textEnabled: next.textEnabled === true,
          });
        }
      } catch {
        // noop
      }
    },
    selectAudioTrack: (id) => engineRef.current?.selectAudioTrack?.(id),
    selectTextTrack: (id) => engineRef.current?.selectTextTrack?.(id),
    setSubtitlesEnabled: (enabled) => engineRef.current?.setSubtitlesEnabled?.(enabled),
    containerRef,
    licenseInUsePrompt,
    confirmLicenseInUse: async (accept) => {
      const prompt = licenseInUsePrompt;
      setLicenseInUsePrompt(null);
      if (!accept || !prompt?.licenseKey) return false;
      const brand = brandRef.current;
      if (!brand) return false;

      try {
        if (!panaccessService.client) {
          await panaccessService.initialize(brand);
        }
        await panaccessService.setStreamingLicense({
          licenseKey: prompt.licenseKey,
          pin: prompt.pin,
          failIfInUse: false,
        });
        // Reintentar playback después del takeover.
        const snap = prompt.snapshot;
        if (snap?.url) {
          engineRef.current?.load?.(snap.url, {
            type: snap.type,
            autoPlay: true,
            mediaOption: snap.mediaOption || {},
            drmConfig: snap.drmConfig || {},
          });
        }
        return true;
      } catch {
        return false;
      }
    },
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

