import { useEffect, useState } from 'react';
import { createProgressTracker } from '../utils/progressTracker';

/** Sin avanzar `currentTime` este tiempo (ms) en plena reproducción = se quedó sin datos. */
const FROZEN_MS = 4000;

/**
 * Spinner mientras el <video> aún no reproduce (ignora flags React desincronizados en HLS/live) y
 * también cuando se queda sin datos en plena reproducción (`currentTime` quieto; el `waiting` no llega en todas las TV): sin esto una red caída dejaba
 * la imagen congelada sin ningún aviso.
 */
export function usePlayerLoadingVisible(isPlayerActive, containerRef, playerState) {
  const [videoPlaybackActive, setVideoPlaybackActive] = useState(false);
  const [rebuffering, setRebuffering] = useState(false);

  useEffect(() => {
    setVideoPlaybackActive(false);
    setRebuffering(false);
    if (!isPlayerActive) return undefined;

    let cancelled = false;
    let detachVideo = () => {};

    const bindVideo = (video) => {
      if (!(video instanceof HTMLVideoElement)) return () => {};

      const markActive = () => {
        if (cancelled) return;
        if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          setVideoPlaybackActive(true);
        }
      };
      const tracker = createProgressTracker();
      const poll = window.setInterval(() => {
        if (cancelled) return;
        const active = !video.paused && !video.seeking && !video.ended && video.currentTime > 0;
        const frozen = tracker.update(video.currentTime, active) >= FROZEN_MS;
        // Reintento del stream tras un corte: el <video> queda en pausa y sin datos hasta que la red vuelva.
        const noData = video.paused && !video.ended && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA;
        setRebuffering(frozen || noData);
      }, 1000);
      const onWaiting = () => {
        if (!cancelled && !video.paused && !video.seeking) setRebuffering(true);
      };
      const onProgress = () => {
        if (!cancelled) setRebuffering(false);
      };

      video.addEventListener('waiting', onWaiting);
      video.addEventListener('playing', onProgress);
      video.addEventListener('timeupdate', onProgress);
      video.addEventListener('pause', onProgress);
      video.addEventListener('playing', markActive);
      video.addEventListener('timeupdate', markActive);
      video.addEventListener('canplay', markActive);
      video.addEventListener('loadeddata', markActive);
      markActive();

      return () => {
        window.clearInterval(poll);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onProgress);
        video.removeEventListener('timeupdate', onProgress);
        video.removeEventListener('pause', onProgress);
        video.removeEventListener('playing', markActive);
        video.removeEventListener('timeupdate', markActive);
        video.removeEventListener('canplay', markActive);
        video.removeEventListener('loadeddata', markActive);
      };
    };

    const attach = () => {
      detachVideo();
      const video = containerRef.current?.querySelector('video');
      detachVideo = bindVideo(video);
    };

    attach();

    const container = containerRef.current;
    const observer =
      container instanceof HTMLElement
        ? new MutationObserver(() => {
            attach();
          })
        : null;

    if (observer && container) {
      observer.observe(container, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      detachVideo();
    };
  }, [isPlayerActive, playerState?.url, containerRef]);

  if (!isPlayerActive) return false;
  if (playerState?.error) return false;
  if (rebuffering) return true;
  if (videoPlaybackActive) return false;
  return Boolean(playerState?.isLoading || playerState?.isSeeking);
}
