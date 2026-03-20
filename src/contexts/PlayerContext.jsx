import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useDevice } from './DeviceContext';
import { createEngine } from '../player/engines/createEngine';

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

  const [state, setState] = useState({
    type: null, // 'service' | 'vod' | 'catchup'
    id: null,
    url: null,
    item: null,
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    error: null,
  });

  // Inicializar engine una vez según el dispositivo
  useEffect(() => {
    const engine = createEngine(deviceInfo);
    engineRef.current = engine;

    if (containerRef.current) {
      engine.init(containerRef.current);
    }

    const handleTime = ({ currentTime, duration }) => {
      setState((s) => ({
        ...s,
        currentTime: typeof currentTime === 'number' ? currentTime : s.currentTime,
        duration: typeof duration === 'number' ? duration : s.duration,
      }));
    };

    const handleDuration = ({ duration }) => {
      setState((s) => ({
        ...s,
        duration: typeof duration === 'number' ? duration : s.duration,
      }));
    };

    const handleEnded = () => {
      setState((s) => ({
        ...s,
        isPlaying: false,
        isLoading: false,
      }));
    };

    const handleError = (err) => {
      setState((s) => ({
        ...s,
        isPlaying: false,
        isLoading: false,
        error: err,
      }));
    };

    const handleStateChange = ({ state }) => {
      if (state === 'loading' || state === 'loaded') {
        setState((s) => ({ ...s, isLoading: true }));
      } else if (state === 'playing') {
        setState((s) => ({ ...s, isPlaying: true, isLoading: false }));
      } else if (state === 'paused' || state === 'ended') {
        setState((s) => ({ ...s, isPlaying: false, isLoading: false }));
      }
    };

    engine.on('timeupdate', handleTime);
    engine.on('durationchange', handleDuration);
    engine.on('ended', handleEnded);
    engine.on('error', handleError);
    engine.on('statechange', handleStateChange);

    return () => {
      engine.off('timeupdate', handleTime);
      engine.off('durationchange', handleDuration);
      engine.off('ended', handleEnded);
      engine.off('error', handleError);
      engine.off('statechange', handleStateChange);
      engine.destroy();
      engineRef.current = null;
    };
  }, [deviceInfo]);

  const play = ({ type, id, url, item, autoPlay = true }) => {
    const engine = engineRef.current;
    if (!engine || !url) {
      console.warn('[PlayerProvider] No hay engine o URL para reproducir');
      return;
    }

    // Si el engine nunca se inicializó (container no existía al montar), inicializar ahora
    if (!engine.video && containerRef.current) {
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
      error: null,
      currentTime: 0,
      duration: 0,
    }));

    engine.load(url, { type, autoPlay });
  };

  const pause = () => {
    engineRef.current?.pause();
  };

  const seek = (seconds) => {
    engineRef.current?.seek(seconds);
  };

  const value = {
    state,
    play,
    pause,
    seek,
    containerRef,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

