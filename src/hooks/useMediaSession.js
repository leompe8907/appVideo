import { useEffect } from 'react';
import { usePlayer } from '../contexts/PlayerContext';

/**
 * Integra la Media Session API del navegador: metadata + controles de
 * play/pause/seek (se conectan con las notificaciones del SO, auriculares,
 * teclas multimedia), y registra Picture-in-Picture automático al cambiar de
 * pestaña (`enterpictureinpicture`, disparado por Chrome solo cuando la
 * pestaña pierde foco mientras hay media reproduciéndose).
 *
 * Motivo real (no cosmético): Chrome exime de su "Memory Saver" (descarte de
 * pestañas en background) a las pestañas con audio/video activo — ver
 * https://support.google.com/chrome/answer/12929150. Sin esta integración,
 * una pestaña con el video en pausa (o sin señal de sesión de media activa)
 * es candidata normal a ser descartada, lo que se siente como "se cerró la
 * sesión" cuando el usuario vuelve a la pestaña.
 */
export function useMediaSession() {
  let player = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    player = usePlayer();
  } catch {
    // Fuera de PlayerProvider
  }

  const state = player?.state;
  const isSupported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

  // Metadata: título visible en notificaciones del SO / auriculares.
  useEffect(() => {
    if (!isSupported) return;
    if (!state?.type || !state?.item) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const title = state.item?.name ?? state.item?.title ?? '';
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title });
    } catch {
      // noop (MediaMetadata puede no estar disponible en algún navegador legacy)
    }
  }, [isSupported, state?.type, state?.item]);

  // Estado de reproducción (play/pause) para el SO.
  useEffect(() => {
    if (!isSupported) return;
    navigator.mediaSession.playbackState = state?.isPlaying ? 'playing' : state?.type ? 'paused' : 'none';
  }, [isSupported, state?.isPlaying, state?.type]);

  // Posición actual (scrubber del SO) — solo tiene sentido con duración finita
  // (VOD/catchup); un canal en vivo suele reportar duration 0/Infinity.
  useEffect(() => {
    if (!isSupported) return;
    const duration = state?.duration;
    const position = state?.currentTime;
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(position, duration),
      });
    } catch {
      // noop
    }
  }, [isSupported, state?.duration, state?.currentTime]);

  // Action handlers — se registran una sola vez (no dependen de `state`,
  // leen player.state en el momento de la acción vía closures estables).
  useEffect(() => {
    if (!isSupported || !player) return undefined;

    const resume = () => {
      const s = player.state;
      if (!s?.type || !s?.url) return;
      player.play({ type: s.type, id: s.id, url: s.url, item: s.item, mediaOption: s.mediaOption, drmConfig: s.drmConfig });
    };

    const handlers = {
      play: resume,
      pause: () => player.pause(),
      stop: () => player.pause(),
      seekbackward: (details) => player.backward(details?.seekOffset || undefined),
      seekforward: (details) => player.forward(details?.seekOffset || undefined),
      seekto: (details) => {
        if (Number.isFinite(details?.seekTime)) player.seek(details.seekTime);
      },
      enterpictureinpicture: async () => {
        try {
          const video = player.getVideoElement?.();
          if (video && document.pictureInPictureEnabled && !video.disablePictureInPicture) {
            await video.requestPictureInPicture();
          }
        } catch {
          // noop — PiP puede rechazarse (sin gesto reciente, ya en PiP, etc.)
        }
      },
    };

    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Acción no soportada en este navegador (ej. enterpictureinpicture en Firefox) — ignorar.
      }
    }

    return () => {
      for (const action of Object.keys(handlers)) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // noop
        }
      }
    };
  }, [isSupported, player]);
}

export default useMediaSession;
