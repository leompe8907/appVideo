import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useDevice } from './DeviceContext';
import { useBrand } from './BrandContext';
import { createEngine } from '../player/engines/createEngine';
import { DEFAULT_SEEK_STEP_SECONDS, PLAYER_ENGINE_EVENTS } from '../player/engines/contracts';
import panaccessService from '../services/panaccessService';
import telemetryService from '../services/telemetryService';
import * as userSession from '../utils/userSession';
import { isLicenseInUseError } from '../utils/licenseInUse';
import { resolveBrandId } from '../utils/brandStorage';
import {
  applySavedTrackPreferences,
  getSavedTrackPreferences,
  persistAudioPreference,
  persistSubtitlePreference,
} from '../utils/playerTrackPreferences';
import { getSavedVolumePreference, saveVolumePreference } from '../utils/playerVolumePreference';

const PlayerContext = createContext(null);

function normalizeTracksSnapshot(raw) {
  if (!raw) return null;
  return {
    audio: Array.isArray(raw.audio) ? raw.audio : [],
    text: Array.isArray(raw.text) ? raw.text : [],
    selectedAudioId: raw.selectedAudioId ?? null,
    selectedTextId: raw.selectedTextId ?? null,
    textEnabled: raw.textEnabled === true,
  };
}

function tracksSnapshotsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.selectedAudioId !== b.selectedAudioId) return false;
  if (a.selectedTextId !== b.selectedTextId) return false;
  if (a.textEnabled !== b.textEnabled) return false;
  if (a.audio.length !== b.audio.length || a.text.length !== b.text.length) return false;
  for (let i = 0; i < a.audio.length; i++) {
    if (String(a.audio[i]?.id) !== String(b.audio[i]?.id)) return false;
  }
  for (let i = 0; i < a.text.length; i++) {
    if (String(a.text[i]?.id) !== String(b.text[i]?.id)) return false;
  }
  return true;
}

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
  const playbackRef = useRef({ type: null, id: null, url: null, item: null });
  const userTrackChoiceRef = useRef(false);
  const tracksRestoredRef = useRef(false);
  const debugRef = useRef(false);
  const engineHandlersRef = useRef({});
  // `handleEnded` vive dentro del efecto de montaje único (deps []) que crea
  // el engine — closure fija en el primer render. Este ref evita leer un
  // `state.currentTime` obsoleto al reportar telemetría de fin de reproducción.
  const currentTimeRef = useRef(0);

  const getPlaybackSnapshot = useCallback(
    () => ({
      type: playbackRef.current?.type ?? null,
      id: playbackRef.current?.id ?? null,
      item: playbackRef.current?.item ?? null,
    }),
    [],
  );

  const resetTrackMemoryForPlayback = useCallback(() => {
    userTrackChoiceRef.current = false;
    tracksRestoredRef.current = false;
  }, []);

  // Mantener brandRef sincronizado para evitar stale closures en el primer useEffect
  useEffect(() => {
    brandRef.current = currentBrand;
  }, [currentBrand]);

  useEffect(() => {
    telemetryService.init();
    return () => telemetryService.destroy();
  }, []);

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

  const [state, setState] = useState(() => {
    // Volumen/mute: memoria global por marca (no depende del canal/VOD que
    // se esté reproduciendo) -- ver playerVolumePreference.js. Solo lo usa
    // la UI si el brand activa features.playerVolumeControls; si no, estos
    // dos campos quedan en sus valores por defecto sin efecto visible.
    const brandId = resolveBrandId(currentBrand?.brand ?? currentBrand?.id);
    const { volume: savedVolume, muted: savedMuted } = getSavedVolumePreference(brandId);
    return {
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
      volume: savedVolume,
      muted: savedMuted,
    };
  });

  useEffect(() => {
    currentTimeRef.current = state.currentTime;
  }, [state.currentTime]);

  const [licenseInUsePrompt, setLicenseInUsePrompt] = useState(null);
  const [tracks, setTracks] = useState({
    audio: [],
    text: [],
    selectedAudioId: null,
    selectedTextId: null,
    textEnabled: false,
  });
  // Solo lo usa SamsungEngine (AVPlay) -- ver PLAYER_ENGINE_EVENTS.SUBTITLE_CUE
  // en contracts.js sobre por qué AVPlay necesita que la app dibuje el
  // subtítulo a mano. WebEngine (PC) y LG (native <video>) ya lo pintan solos
  // vía el propio navegador, así que esto queda '' para siempre en esas
  // plataformas -- el overlay que lo consume (HomePage.jsx) no se nota.
  const [subtitleCueText, setSubtitleCueText] = useState('');

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

  useEffect(() => {
    const tryRecoverAfterError = async (err, snapshot) => {
      const brand = brandRef.current;
      if (!brand || !snapshot?.url) return false;

      const active = userSession.getActiveLicense?.();
      const licenseKey = active?.licenseKey ? String(active.licenseKey).trim() : '';
      const pin = active?.pin != null ? String(active.pin) : '';
      if (!licenseKey) return false;

      const recoveryKey = `${snapshot.type || ''}::${snapshot.id || ''}::${snapshot.url || ''}`;
      if (recoveryRef.current.inProgress || recoveryRef.current.lastKey === recoveryKey) return false;

      recoveryRef.current.inProgress = true;
      recoveryRef.current.lastKey = recoveryKey;

      try {
        if (!panaccessService.client) {
          await panaccessService.initialize(brand);
        }
        await panaccessService.setStreamingLicense({ licenseKey, pin, failIfInUse: true });
        engineRef.current?.reset?.();
        engineRef.current?.load?.(snapshot.url, {
          type: snapshot.type,
          autoPlay: true,
          mediaOption: snapshot.mediaOption || {},
          drmConfig: snapshot.drmConfig || {},
        });
        return true;
      } catch (e) {
        if (isLicenseInUseError(e)) {
          setLicenseInUsePrompt({ licenseKey, pin, snapshot });
          return true;
        }
        return false;
      } finally {
        recoveryRef.current.inProgress = false;
      }
    };

    const isBenignEngineError = (err) => {
      if (!err) return false;
      const code = err.code ?? err?.status;
      if (code === 4) return true;
      return /no compatible source was found/i.test(String(err.message || ''));
    };

    const tryRestoreSavedTracks = (snap) => {
      if (userTrackChoiceRef.current || tracksRestoredRef.current) return;

      const playback = {
        type: playbackRef.current?.type ?? null,
        id: playbackRef.current?.id ?? null,
        item: playbackRef.current?.item ?? null,
      };
      if (playback.type !== 'service') {
        tracksRestoredRef.current = true;
        return;
      }

      const brandId = resolveBrandId(brandRef.current?.brand ?? brandRef.current?.id);
      const { subtitles: subtitleLabel } = getSavedTrackPreferences(brandId, playback);
      const hasAudioTracks = snap.audio?.length > 0;
      const hasTextTracks = snap.text?.length > 0;
      if (!hasAudioTracks && !subtitleLabel) return;
      if (subtitleLabel && !hasTextTracks && !hasAudioTracks) return;

      const engine = engineRef.current;
      if (!engine) return;

      applySavedTrackPreferences(engine, brandId, playback, snap);
      tracksRestoredRef.current = true;
    };

    engineHandlersRef.current = {
      handleTime: ({ currentTime, duration }) => {
        setState((s) => {
          const nextCurrentTime = typeof currentTime === 'number' ? currentTime : s.currentTime;
          const nextDuration = typeof duration === 'number' ? duration : s.duration;
          // timeupdate implica reproducción real (HLS/live a veces no dispara 'play').
          const playbackTickActive =
            typeof currentTime === 'number' && Number.isFinite(currentTime);
          const clearStaleBufferFlags =
            playbackTickActive && (s.isLoading || s.isSeeking || !s.isPlaying)
              ? { isPlaying: true, isLoading: false, isSeeking: false }
              : s.isPlaying && (s.isLoading || s.isSeeking)
                ? { isLoading: false, isSeeking: false }
                : null;

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
              ...clearStaleBufferFlags,
            };
          }

          return {
            ...s,
            currentTime: nextCurrentTime,
            duration: nextDuration,
            ...clearStaleBufferFlags,
          };
        });
      },
      handleDuration: ({ duration }) => {
        setState((s) => ({
          ...s,
          duration: typeof duration === 'number' ? duration : s.duration,
        }));
      },
      handleEnded: () => {
        clearSeekTimeout();
        log('engine:event ended');
        telemetryService.stopCurrent({ finished: true, timeIndex: currentTimeRef.current });
        setState((s) => ({
          ...s,
          isPlaying: false,
          isLoading: false,
          isSeeking: false,
        }));
      },
      handleError: (err) => {
        clearSeekTimeout();
        if (isBenignEngineError(err)) {
          log('engine:event error (ignored)', err);
          return;
        }
        log('engine:event error', err);
        setState((s) => {
          if (!s.url) {
            return { ...s, isPlaying: false, isLoading: false, isSeeking: false };
          }
          const snapshot = {
            type: s.type,
            id: s.id,
            url: s.url,
            item: s.item,
            mediaOption: s.mediaOption,
            drmConfig: s.drmConfig,
          };
          Promise.resolve().then(() => tryRecoverAfterError(err, snapshot));
          return {
            ...s,
            isPlaying: false,
            isLoading: false,
            isSeeking: false,
            error: err,
          };
        });
      },
      handleStateChange: ({ state: engineState }) => {
        log('engine:event statechange', engineState);
        if (engineState === 'loading') {
          setState((s) => ({ ...s, isLoading: true }));
        } else if (engineState === 'loaded') {
          setState((s) => ({ ...s, isLoading: false, error: null }));
        } else if (engineState === 'seeking') {
          armSeekTimeout();
          setState((s) => ({
            ...s,
            isSeeking: true,
            isLoading: s.isPlaying ? false : true,
          }));
        } else if (engineState === 'seeked') {
          setState((s) => ({
            ...s,
            isSeeking: false,
            isLoading: s.isPlaying ? false : s.isLoading,
          }));
        } else if (engineState === 'playing') {
          clearSeekTimeout();
          setState((s) => ({ ...s, isPlaying: true, isLoading: false, isSeeking: false, error: null }));
        } else if (engineState === 'paused' || engineState === 'ended') {
          clearSeekTimeout();
          setState((s) => ({ ...s, isPlaying: false, isLoading: false, isSeeking: false }));
        }
      },
      handleSeekStart: () => {
        armSeekTimeout();
        setState((s) => ({
          ...s,
          isSeeking: true,
          isLoading: s.isPlaying ? false : true,
        }));
      },
      handleSeekEnd: () => {
        clearSeekTimeout();
        setState((s) => ({
          ...s,
          isSeeking: false,
          isLoading: s.isPlaying ? false : s.isLoading,
        }));
      },
      handleTracksChange: (payload) => {
        const next = normalizeTracksSnapshot(payload);
        if (!next) return;
        setTracks((prev) => (tracksSnapshotsEqual(prev, next) ? prev : next));
        tryRestoreSavedTracks(next);
      },
      handleSubtitleCue: (payload) => {
        setSubtitleCueText(String(payload?.text || ''));
      },
    };
  });

  useEffect(() => {
    debugRef.current = isDebugEnabled();

    if (engineRef.current) {
      log('engine:skip (already exists)');
      return undefined;
    }

    let cancelled = false;
    const brand = brandRef.current;

    const dispatch = (key, payload) => engineHandlersRef.current[key]?.(payload);

    const boundHandlers = {
      handleTime: (p) => dispatch('handleTime', p),
      handleDuration: (p) => dispatch('handleDuration', p),
      handleEnded: () => dispatch('handleEnded'),
      handleError: (p) => dispatch('handleError', p),
      handleStateChange: (p) => dispatch('handleStateChange', p),
      handleSeekStart: () => dispatch('handleSeekStart'),
      handleSeekEnd: () => dispatch('handleSeekEnd'),
      handleTracksChange: (p) => dispatch('handleTracksChange', p),
      handleSubtitleCue: (p) => dispatch('handleSubtitleCue', p),
    };

    function bindEngineListeners(engine) {
      engine.on(PLAYER_ENGINE_EVENTS.TIME_UPDATE, boundHandlers.handleTime);
      engine.on(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, boundHandlers.handleDuration);
      engine.on(PLAYER_ENGINE_EVENTS.ENDED, boundHandlers.handleEnded);
      engine.on(PLAYER_ENGINE_EVENTS.ERROR, boundHandlers.handleError);
      engine.on(PLAYER_ENGINE_EVENTS.STATE_CHANGE, boundHandlers.handleStateChange);
      engine.on(PLAYER_ENGINE_EVENTS.SEEK_START, boundHandlers.handleSeekStart);
      engine.on(PLAYER_ENGINE_EVENTS.SEEK_END, boundHandlers.handleSeekEnd);
      engine.on(PLAYER_ENGINE_EVENTS.TRACKS_CHANGE, boundHandlers.handleTracksChange);
      engine.on(PLAYER_ENGINE_EVENTS.SUBTITLE_CUE, boundHandlers.handleSubtitleCue);
    }

    (async () => {
      const engine = await createEngine(deviceInfo, {
        nativeAdaptersEnabled: brand?.player?.nativeAdaptersEnabled === true,
        brandPlayerPolicy: brand?.player?.enginePolicy || 'auto',
      });
      if (cancelled) {
        try {
          engine.destroy?.();
        } catch {
          // noop
        }
        return;
      }

      engineRef.current = engine;
      log('engine:create', {
        deviceType: deviceInfo?.deviceType,
        isTV: !!deviceInfo?.isTV,
        userAgent: deviceInfo?.userAgent,
      });

      if (containerRef.current) {
        await engine.init(containerRef.current);
        log('engine:init', { hasContainer: true });
      }

      bindEngineListeners(engine);

      // Aplicar volumen/mute guardado (solo tiene efecto real en WebEngine --
      // los engines de TV no implementan setVolume/mute, optional chaining
      // los deja como no-op). `state` acá es el de la primera render (este
      // efecto corre una sola vez, deps []), que ya viene de
      // getSavedVolumePreference en el useState inicial de arriba.
      engine.setVolume?.(state.volume);
      if (state.muted) engine.mute?.();
      log('engine:volume:init', { volume: state.volume, muted: state.muted });
    })().catch((err) => {
      console.error('[PlayerProvider] Error creando engine', err);
      setState((s) => ({
        ...s,
        error: err,
        isLoading: false,
        isPlaying: false,
      }));
    });

    return () => {
      cancelled = true;
      const engine = engineRef.current;
      if (!engine) return;
      engine.off(PLAYER_ENGINE_EVENTS.TIME_UPDATE, boundHandlers.handleTime);
      engine.off(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, boundHandlers.handleDuration);
      engine.off(PLAYER_ENGINE_EVENTS.ENDED, boundHandlers.handleEnded);
      engine.off(PLAYER_ENGINE_EVENTS.ERROR, boundHandlers.handleError);
      engine.off(PLAYER_ENGINE_EVENTS.STATE_CHANGE, boundHandlers.handleStateChange);
      engine.off(PLAYER_ENGINE_EVENTS.SEEK_START, boundHandlers.handleSeekStart);
      engine.off(PLAYER_ENGINE_EVENTS.SEEK_END, boundHandlers.handleSeekEnd);
      engine.off(PLAYER_ENGINE_EVENTS.TRACKS_CHANGE, boundHandlers.handleTracksChange);
      engine.off(PLAYER_ENGINE_EVENTS.SUBTITLE_CUE, boundHandlers.handleSubtitleCue);
      clearSeekTimeout();
      log('engine:destroy (cleanup on unmount)');
      engine.destroy();
      engineRef.current = null;
    };
    // deviceInfo del primer render; recrear el engine aquí rompe listeners TV/PC.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const resetEngineMedia = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      if (typeof engine.reset === 'function') {
        engine.reset();
      } else {
        engine.stop?.();
      }
    } catch {
      // noop
    }
  }, []);

  const play = ({ type, id, url, item, autoPlay = true, mediaOption = {}, drmConfig = {} }) => {
    const engine = engineRef.current;
    if (!url) {
      console.warn('[PlayerProvider] No hay engine o URL para reproducir');
      return;
    }
    if (!engine) {
      console.warn('[PlayerProvider] No hay engine para reproducir');
      return;
    }

    void (async () => {
      try {
        url = panaccessService.normalizePlaybackUrl(url);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[PlayerProvider] normalizePlaybackUrl:', e?.message || e);
        }
      }

      log('action:play', { type, id, url });

      if (containerRef.current && (!engine.video || engine.container !== containerRef.current)) {
        await engine.init(containerRef.current);
      }

      const prev = playbackRef.current;
      const sameContent =
        prev.type === type && prev.id === id && prev.url === url && Boolean(url);

      if (sameContent && playbackRef.current.url) {
        setState((s) => ({ ...s, error: null, isLoading: false }));
        log('action:play (same content) -> engine.play()');
        engine.play();
        return;
      }

      playbackRef.current = { type, id, url, item: item ?? null };
      telemetryService.recordSwitch({ type, id, item: item ?? null });
      resetTrackMemoryForPlayback();

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

      setTracks({ audio: [], text: [], selectedAudioId: null, selectedTextId: null, textEnabled: false });
      setSubtitleCueText('');
      engine.load(url, { type, autoPlay, mediaOption, drmConfig });
    })().catch((err) => {
      console.error('[PlayerProvider] Error en play', err);
      setState((s) => ({
        ...s,
        error: err,
        isLoading: false,
        isPlaying: false,
        isSeeking: false,
      }));
    });
  };

  /**
   * Reintenta la reproducción actual tras un error visible en el HUD.
   * A diferencia de llamar `play()` con los mismos parámetros, esto limpia
   * `playbackRef` primero para forzar el camino de recarga completa
   * (`engine.load()`), no el atajo de "mismo contenido -> engine.play()",
   * que no sirve si la carga original fue la que falló.
   */
  const retry = () => {
    const { type, id, url, item, mediaOption, drmConfig } = state;
    if (!url) return;
    playbackRef.current = { type: null, id: null, url: null, item: null };
    play({ type, id, url, item, mediaOption, drmConfig, autoPlay: true });
  };

  const pause = () => {
    engineRef.current?.pause();
  };

  const stop = () => {
    clearSeekTimeout();
    log('action:stop');
    telemetryService.stopCurrent({ finished: false, timeIndex: state.currentTime });
    resetEngineMedia();
    playbackRef.current = { type: null, id: null, url: null, item: null };
    resetTrackMemoryForPlayback();
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
    telemetryService.stopCurrent({ finished: false, timeIndex: state.currentTime });
    resetEngineMedia();
    playbackRef.current = { type: null, id: null, url: null, item: null };
    resetTrackMemoryForPlayback();
    recoveryRef.current = { inProgress: false, lastKey: '' };
    // FIX: antes esto era un setState({...}) sin spread de `s` -- un
    // reemplazo COMPLETO del estado. Como el objeto nuevo no incluía
    // volume/muted, quedaban en `undefined` acá y se arrastraban a la
    // siguiente reproducción (play() sí hace spread de `s`). El audio real
    // seguía bien porque WebEngine guarda su propio _volume/_muted aparte,
    // pero el ícono/slider del HUD (que leen volume/muted de este estado)
    // quedaban mostrando el default. Con spread de `s`, volume/muted (y
    // cualquier otro campo no listado acá) se preservan, igual que en
    // play()/stop().
    setState((s) => ({
      ...s,
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
    }));
    setTracks({ audio: [], text: [], selectedAudioId: null, selectedTextId: null, textEnabled: false });
    setSubtitleCueText('');
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

  const persistVolume = (volume, muted) => {
    const brandId = resolveBrandId(brandRef.current?.brand ?? brandRef.current?.id);
    saveVolumePreference(brandId, { volume, muted });
  };

  const mute = () => {
    engineRef.current?.mute?.();
    setState((s) => {
      persistVolume(s.volume, true);
      return { ...s, muted: true };
    });
  };

  const unmute = () => {
    engineRef.current?.unmute?.();
    setState((s) => {
      persistVolume(s.volume, false);
      return { ...s, muted: false };
    });
  };

  /** Botón único de mute: alterna según el estado actual. */
  const toggleMute = () => {
    if (state.muted) unmute();
    else mute();
  };

  /**
   * @param {number} volume 0..1 (el slider del HUD manda 0..100 -- convertir antes de llamar).
   * Subir el volumen desde mute (>0) también desmutea, como en cualquier
   * reproductor estándar -- si el usuario arrastra el slider, espera oír
   * sonido de inmediato aunque haya estado muteado.
   */
  const setVolume = (volume) => {
    const v = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    engineRef.current?.setVolume?.(v);
    const shouldUnmute = v > 0 && state.muted;
    if (shouldUnmute) engineRef.current?.unmute?.();
    setState((s) => {
      const nextMuted = v > 0 ? false : s.muted;
      persistVolume(v, nextMuted);
      return { ...s, volume: v, muted: nextMuted };
    });
  };

  const refreshTracks = useCallback(() => {
    try {
      const next = normalizeTracksSnapshot(engineRef.current?.getTracks?.());
      if (!next) return;
      setTracks((prev) => (tracksSnapshotsEqual(prev, next) ? prev : next));
    } catch {
      // noop
    }
  }, []);

  const selectAudioTrack = useCallback(
    (id) => {
      userTrackChoiceRef.current = true;
      const engine = engineRef.current;
      engine?.selectAudioTrack?.(id);
      const brandId = resolveBrandId(brandRef.current?.brand ?? brandRef.current?.id);
      const snap = engine?.getTracks?.();
      const track = snap?.audio?.find((t) => String(t.id) === String(id));
      persistAudioPreference(brandId, getPlaybackSnapshot(), track);
    },
    [getPlaybackSnapshot],
  );

  const selectTextTrack = useCallback(
    (id) => {
      userTrackChoiceRef.current = true;
      const engine = engineRef.current;
      engine?.setSubtitlesEnabled?.(true);
      engine?.selectTextTrack?.(id);
      const brandId = resolveBrandId(brandRef.current?.brand ?? brandRef.current?.id);
      const snap = engine?.getTracks?.();
      const track = snap?.text?.find((t) => String(t.id) === String(id));
      persistSubtitlePreference(brandId, getPlaybackSnapshot(), { enabled: true, track });
    },
    [getPlaybackSnapshot],
  );

  const setSubtitlesEnabled = useCallback(
    (enabled) => {
      userTrackChoiceRef.current = true;
      engineRef.current?.setSubtitlesEnabled?.(enabled);
      if (enabled === false) {
        // Defensivo: en Samsung, el engine ya emite SUBTITLE_CUE('') al
        // desactivar (ver SamsungEngine.nativeSetSubtitlesEnabled), pero no
        // hay que depender de esa vuelta de evento para que el overlay
        // desaparezca al toque del click del usuario.
        setSubtitleCueText('');
        const brandId = resolveBrandId(brandRef.current?.brand ?? brandRef.current?.id);
        persistSubtitlePreference(brandId, getPlaybackSnapshot(), { enabled: false });
      }
    },
    [getPlaybackSnapshot],
  );

  const value = {
    state,
    tracks,
    subtitleCueText,
    play,
    retry,
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
    toggleMute,
    setVolume,
    getVideoElement: () => engineRef.current?.video ?? null,
    refreshTracks,
    selectAudioTrack,
    selectTextTrack,
    setSubtitlesEnabled,
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
          engineRef.current?.reset?.();
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

