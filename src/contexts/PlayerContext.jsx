import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useDevice } from './DeviceContext';
import { createEngine } from '../player/engines/createEngine';
import { DEFAULT_SEEK_STEP_SECONDS, PLAYER_ENGINE_EVENTS } from '../player/engines/contracts';

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
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const seekTimeoutRef = useRef(null);

  const [state, setState] = useState({
    type: null, // 'service' | 'vod' | 'catchup'
    id: null,
    url: null,
    item: null,
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

  const clearSeekTimeout = () => {
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
  };

  const armSeekTimeout = () => {
    clearSeekTimeout();
    // Paridad con legacy: no dejar el estado "seeking" colgado indefinidamente.
    seekTimeoutRef.current = setTimeout(() => {
      setState((s) => ({ ...s, isSeeking: false, isLoading: false }));
      seekTimeoutRef.current = null;
    }, 20000);
  };

  // Inicializar engine una vez según el dispositivo
  useEffect(() => {
    const engine = createEngine(deviceInfo);
    engineRef.current = engine;

    if (containerRef.current) {
      engine.init(containerRef.current);
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
      setState((s) => ({
        ...s,
        isPlaying: false,
        isLoading: false,
        isSeeking: false,
      }));
    };

    const handleError = (err) => {
      clearSeekTimeout();
      setState((s) => ({
        ...s,
        isPlaying: false,
        isLoading: false,
        isSeeking: false,
        error: err,
      }));
    };

    const handleStateChange = ({ state }) => {
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

    engine.on(PLAYER_ENGINE_EVENTS.TIME_UPDATE, handleTime);
    engine.on(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, handleDuration);
    engine.on(PLAYER_ENGINE_EVENTS.ENDED, handleEnded);
    engine.on(PLAYER_ENGINE_EVENTS.ERROR, handleError);
    engine.on(PLAYER_ENGINE_EVENTS.STATE_CHANGE, handleStateChange);
    engine.on(PLAYER_ENGINE_EVENTS.SEEK_START, handleSeekStart);
    engine.on(PLAYER_ENGINE_EVENTS.SEEK_END, handleSeekEnd);

    return () => {
      engine.off(PLAYER_ENGINE_EVENTS.TIME_UPDATE, handleTime);
      engine.off(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, handleDuration);
      engine.off(PLAYER_ENGINE_EVENTS.ENDED, handleEnded);
      engine.off(PLAYER_ENGINE_EVENTS.ERROR, handleError);
      engine.off(PLAYER_ENGINE_EVENTS.STATE_CHANGE, handleStateChange);
      engine.off(PLAYER_ENGINE_EVENTS.SEEK_START, handleSeekStart);
      engine.off(PLAYER_ENGINE_EVENTS.SEEK_END, handleSeekEnd);
      clearSeekTimeout();
      engine.destroy();
      engineRef.current = null;
    };
  }, [deviceInfo]);

  const play = ({ type, id, url, item, autoPlay = true, mediaOption = {}, drmConfig = {} }) => {
    const engine = engineRef.current;
    if (!engine || !url) {
      console.warn('[PlayerProvider] No hay engine o URL para reproducir');
      return;
    }

    // Si el engine nunca se inicializó, o el nodo contenedor cambió (ej. remount), inicializar ahora
    if (containerRef.current && (!engine.video || engine.container !== containerRef.current)) {
      engine.init(containerRef.current);
    }

    // Si ya estamos en el mismo contenido, solo darle play
    if (state.type === type && state.id === id && state.url === url) {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      engine.play();
      return;
    }

    setState((s) => ({
      ...s,
      type,
      id,
      url,
      item,
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

    engine.load(url, { type, autoPlay, mediaOption, drmConfig });
  };

  const pause = () => {
    engineRef.current?.pause();
  };

  const stop = () => {
    clearSeekTimeout();
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
    containerRef,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

