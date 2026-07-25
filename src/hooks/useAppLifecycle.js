import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { usePlayer } from '../contexts/PlayerContext';
import { isAuthenticated } from '../utils/userSession';
import { validateSessionIfDue } from '../utils/sessionValidator';

/** Tiempo máximo en milisegundos en background antes de forzar revalidación silenciosa de token (30 min) */
const MAX_BACKGROUND_MS = 30 * 60 * 1000;
const SESSION_CHECK_KEY = 'app_last_background_time';
const LAST_ROUTE_KEY = 'app_last_active_route';

/**
 * Hook global para gestionar el ciclo de vida de la aplicación (Warm Start / Suspend-Resume).
 * Escucha eventos nativos de visibilidad en navegadores y Smart TVs (Tizen / webOS).
 */
export function useAppLifecycle() {
  const { currentBrand } = useBrand();
  const location = useLocation();
  const wasPlayingRef = useRef(false);

  let player = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    player = usePlayer();
  } catch {
    // Fuera de PlayerProvider
  }

  // Guardar continuamente la ruta activa cuando el usuario navega por la app
  useEffect(() => {
    const path = location.pathname + location.search;
    if (path.startsWith('/home') || path.startsWith('/profile') || path.startsWith('/smartcard')) {
      try {
        localStorage.setItem(LAST_ROUTE_KEY, path);
      } catch {
        // noop
      }
    }
  }, [location]);

  useEffect(() => {
    const handleHide = () => {
      try {
        const path = location.pathname + location.search;
        sessionStorage.setItem(SESSION_CHECK_KEY, String(Date.now()));
        if (path.startsWith('/home')) {
          localStorage.setItem(LAST_ROUTE_KEY, path);
        }
      } catch {
        // noop
      }

      // Si el reproductor estaba en reproducción, pausar para ahorrar recursos en background
      if (player?.isPlaying || player?.isPlayingLive || player?.isPlayingVod) {
        wasPlayingRef.current = true;
        try {
          player?.pause?.();
        } catch {
          // noop
        }
      }
    };

    const handleShow = async () => {
      const lastTimeStr = sessionStorage.getItem(SESSION_CHECK_KEY);
      const lastTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;
      const elapsed = lastTime ? Date.now() - lastTime : 0;

      if (import.meta.env.DEV) {
        console.log(`📱 [Lifecycle] App reanudada. Tiempo en background: ${Math.round(elapsed / 1000)}s`);
      }

      if (isAuthenticated() && currentBrand) {
        // Revalidar sesión en segundo plano si transcurrió el tiempo límite
        if (elapsed > MAX_BACKGROUND_MS) {
          validateSessionIfDue(currentBrand);
        }

        // Reanudar reproductor si estaba activo antes del suspend
        if (wasPlayingRef.current) {
          wasPlayingRef.current = false;
          try {
            player?.play?.();
          } catch {
            // noop
          }
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleHide();
      } else if (document.visibilityState === 'visible') {
        handleShow();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', handleHide);
    window.addEventListener('pageshow', handleShow);

    // Eventos específicos de Smart TVs (Samsung Tizen)
    let tizenListenerId = null;
    try {
      if (window?.tizen?.application?.getCurrentApplication) {
        const app = window.tizen.application.getCurrentApplication();
        tizenListenerId = app.addEventListener('appstatus', (status) => {
          if (status === 'HIDE' || status === 'SUSPEND') {
            handleHide();
          } else if (status === 'SHOW' || status === 'RESUME') {
            handleShow();
          }
        });
      }
    } catch {
      // noop
    }

    // Eventos específicos de Smart TVs (LG webOS)
    const onWebOSHide = () => handleHide();
    const onWebOSShow = () => handleShow();
    document.addEventListener('webOSHide', onWebOSHide);
    document.addEventListener('webOSShow', onWebOSShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', handleHide);
      window.removeEventListener('pageshow', handleShow);
      document.removeEventListener('webOSHide', onWebOSHide);
      document.removeEventListener('webOSShow', onWebOSShow);

      try {
        if (tizenListenerId != null && window?.tizen?.application?.getCurrentApplication) {
          window.tizen.application.getCurrentApplication().removeEventListener(tizenListenerId);
        }
      } catch {
        // noop
      }
    };
  }, [currentBrand, location, player]);
}

export default useAppLifecycle;
