import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { resolveSplashDestination } from '../services/splashAuthFlow';
import '../styles/components/_splash.scss';

/** Máximo tiempo en fase vídeo antes de forzar navegación (TV puede no disparar ended). */
const SPLASH_VIDEO_MAX_MS = 45000;
/** Si el vídeo no arranca, continuar igual. */
const SPLASH_VIDEO_START_TIMEOUT_MS = 12000;
/** Si auth/UDID tarda demasiado, no bloquear en splash. */
const SPLASH_AUTH_MAX_MS = 60000;

/**
 * Splash por fases: imagen → auth en background → vídeo opcional → app.
 * El video solo se monta tras auth (evita reproducción oculta en TV).
 */
export function SplashPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand, splashDuration, isLoading, getImage, appName } = useBrand();

  const [phase, setPhase] = useState('image');
  const [posterOverVideo, setPosterOverVideo] = useState(true);
  const destinationRef = useRef('/login');
  const imageShownAtRef = useRef(0);
  const navigatedRef = useRef(false);
  const videoRef = useRef(null);

  const splashVideoSrc =
    currentBrand?.assets?.splashVideo && String(currentBrand.assets.splashVideo).trim()
      ? currentBrand.assets.splashVideo
      : null;
  const hasSplashVideo = Boolean(splashVideoSrc);

  const splashPoster =
    currentBrand?.assets?.splashPoster ||
    currentBrand?.assets?.splash ||
    (currentBrand ? getImage('splash.png') : '') ||
    getImage('splash.gif') ||
    '';

  const navigateToDestination = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigate(destinationRef.current || '/login', { replace: true });
  }, [navigate]);

  // Auth en background mientras se muestra la imagen.
  useEffect(() => {
    if (isLoading) return undefined;
    if (!currentBrand) {
      const id = window.setTimeout(() => navigate('/login', { replace: true }), 3000);
      return () => window.clearTimeout(id);
    }

    const videoEnabled = Boolean(
      currentBrand.assets?.splashVideo && String(currentBrand.assets.splashVideo).trim(),
    );

    imageShownAtRef.current = Date.now();
    navigatedRef.current = false;
    setPhase('image');
    setPosterOverVideo(true);

    let cancelled = false;
    let navigateTimerId = null;
    const authTimeoutId = window.setTimeout(() => {
      if (cancelled || navigatedRef.current) return;
      if (import.meta.env.DEV) console.warn('[Splash] Timeout auth, continuando flujo');
      navigateToDestination();
    }, SPLASH_AUTH_MAX_MS);

    resolveSplashDestination(currentBrand)
      .then((path) => {
        window.clearTimeout(authTimeoutId);
        if (cancelled) return;
        destinationRef.current = path;

        if (videoEnabled) {
          setPhase('video');
        } else {
          const minMs = Math.max(0, Number(splashDuration) || 0);
          const elapsed = Date.now() - imageShownAtRef.current;
          const wait = Math.max(0, minMs - elapsed);
          navigateTimerId = window.setTimeout(navigateToDestination, wait);
        }
      })
      .catch((err) => {
        window.clearTimeout(authTimeoutId);
        if (import.meta.env.DEV) console.error('[Splash] resolveSplashDestination:', err);
        if (!cancelled) navigateToDestination();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(authTimeoutId);
      if (navigateTimerId != null) window.clearTimeout(navigateTimerId);
    };
  }, [currentBrand, isLoading, navigate, navigateToDestination, splashDuration]);

  // Vídeo: montado solo en fase "video".
  useEffect(() => {
    if (phase !== 'video' || !hasSplashVideo) return undefined;

    let cancelled = false;
    let removeListeners = () => {};
    let startTimeoutId = null;
    let maxPhaseTimeoutId = null;
    let rafId = null;

    const finish = () => {
      if (!cancelled) navigateToDestination();
    };

    const setupVideo = (video) => {
      const onPlaying = () => {
        if (startTimeoutId != null) {
          window.clearTimeout(startTimeoutId);
          startTimeoutId = null;
        }
        setPosterOverVideo(false);
      };
      const onEnded = () => finish();
      const onError = () => {
        if (import.meta.env.DEV) console.warn('[Splash] Error en vídeo splash, continuando');
        finish();
      };

      const startPlayback = () => {
        if (cancelled) return;
        try {
          video.currentTime = 0;
        } catch {
          // noop
        }
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => onError());
        }
      };

      video.addEventListener('playing', onPlaying);
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onError);

      removeListeners = () => {
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('error', onError);
      };

      try {
        video.load();
      } catch {
        // noop
      }

      if (video.readyState >= 2) {
        startPlayback();
      } else {
        video.addEventListener('loadeddata', startPlayback, { once: true });
        const prevRemove = removeListeners;
        removeListeners = () => {
          prevRemove();
          video.removeEventListener('loadeddata', startPlayback);
        };
      }

      startTimeoutId = window.setTimeout(() => {
        if (import.meta.env.DEV) {
          console.warn('[Splash] Timeout arranque vídeo, continuando flujo');
        }
        finish();
      }, SPLASH_VIDEO_START_TIMEOUT_MS);
    };

    const tryAttach = (attempt = 0) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video) {
        setupVideo(video);
        return;
      }
      if (attempt < 30) {
        rafId = requestAnimationFrame(() => tryAttach(attempt + 1));
        return;
      }
      if (import.meta.env.DEV) {
        console.warn('[Splash] No se pudo montar ref de vídeo, continuando flujo');
      }
      finish();
    };

    tryAttach();
    maxPhaseTimeoutId = window.setTimeout(finish, SPLASH_VIDEO_MAX_MS);

    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
      if (startTimeoutId != null) window.clearTimeout(startTimeoutId);
      if (maxPhaseTimeoutId != null) window.clearTimeout(maxPhaseTimeoutId);
      removeListeners();
    };
  }, [phase, hasSplashVideo, navigateToDestination]);

  const showPoster = Boolean(splashPoster);
  const showPosterLayer = showPoster && (phase === 'image' || posterOverVideo);
  const mountVideo = phase === 'video' && hasSplashVideo;

  if (isLoading || !currentBrand) {
    return (
      <div className="splash-page">
        <div className="splash-content">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="splash-page">
      <div className="splash-content">
        {mountVideo && (
          <video
            ref={videoRef}
            className="splash-video"
            src={splashVideoSrc}
            muted
            playsInline
            preload="auto"
            aria-label={t('splash.alt', { appName })}
          />
        )}
        {showPosterLayer && (
          <div
            className="splash-image-container splash-image-container--overlay"
            style={{ backgroundImage: `url(${splashPoster})` }}
            aria-label={phase === 'image' ? t('splash.alt', { appName }) : undefined}
            aria-hidden={phase === 'video' && !posterOverVideo}
          />
        )}
        {!showPoster && !hasSplashVideo && <div className="spinner" />}
      </div>
    </div>
  );
}

export default SplashPage;
