import { useEffect, useState } from 'react';

/**
 * Spinner solo mientras el <video> aún no reproduce (ignora flags React desincronizados en HLS/live).
 */
export function usePlayerLoadingVisible(isPlayerActive, containerRef, playerState) {
  const [videoPlaybackActive, setVideoPlaybackActive] = useState(false);

  useEffect(() => {
    setVideoPlaybackActive(false);
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

      video.addEventListener('playing', markActive);
      video.addEventListener('timeupdate', markActive);
      video.addEventListener('canplay', markActive);
      video.addEventListener('loadeddata', markActive);
      markActive();

      return () => {
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
  if (videoPlaybackActive) return false;
  return Boolean(playerState?.isLoading || playerState?.isSeeking);
}
